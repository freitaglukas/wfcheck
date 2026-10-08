import {projectEvidence} from '../reporters/evidence.js';
import { isDeepStrictEqual } from 'node:util';
import {assertionV2Schema,type AssertionV2} from '../spec/schema-v2.js';
import {matchesSchema} from './schema.js';
import {tableValue} from './tables.js';
import type { Evidence } from '../runtime/types.js';
import { HarnessError } from '../security/errors.js';
import { redactor,isSensitiveField } from '../security/redact.js';
export const MISSING=Symbol('missing');
export function atPointer(value:unknown,pointer:string):unknown {
  if(pointer==='')return value;
  let current=value;
  for(const part of pointer.slice(1).split('/').map(x=>x.replace(/~1/g,'/').replace(/~0/g,'~'))) {
    if(!current||typeof current!=='object'||!Object.hasOwn(current,part))return MISSING;
    current=(current as Record<string,unknown>)[part];
  }
  return current;
}
export interface AssertionResult {target:string;passed:boolean;message:string;expected?:unknown;actual?:unknown;}
export function evaluate(assertions:AssertionV2[],evidence:Evidence):AssertionResult[] {
  if(!evidence.execution?.id||!evidence.execution.nodes)throw new HarnessError('EVIDENCE','Missing terminal execution evidence');
  if(evidence.gatewayErrors.length)throw new HarnessError('GATEWAY','Gateway evidence incomplete: '+evidence.gatewayErrors.join('; '));
  const results:AssertionResult[]=assertions.map(raw=>{const a=assertionV2Schema.parse(raw);
    let actual:unknown;let label:string=a.target;
    if(a.target==='execution.status')actual=evidence.execution.status;
    else if(a.target==='node.executed') {actual=Object.hasOwn(evidence.execution.nodes,a.nodeId);label+=' '+a.nodeId;}
    else if(a.target==='table.count'||a.target==='table.row'){const v=tableValue(a,evidence);actual=a.target==='table.row'?atPointer(v,a.pointer):v;label+=' '+a.tableId;}
    else if(a.target==='node.count'||a.target==='node.json'||a.target==='node.schema') {
      const items=evidence.execution.nodes[a.nodeId]?.[a.runIndex]?.outputs[a.outputIndex];
      if(!items)throw new HarnessError('EVIDENCE',`Missing node/output evidence: ${a.nodeId} run ${a.runIndex} output ${a.outputIndex}`);
      label+=` ${a.nodeId}[${a.runIndex}][${a.outputIndex}]`;
      actual=a.target==='node.count'?items.length:Object.hasOwn(items,a.itemIndex)?atPointer(items[a.itemIndex],a.pointer):MISSING;if(a.target==='node.schema'&&actual===MISSING)throw new HarnessError('EVIDENCE','Missing node schema evidence');
    }else{
      const requests=evidence.requests.filter(r=>r.mockId===a.mockId);
      label+=' '+a.mockId;
      if(a.target==='requests.count')actual=requests.length;
      else {const r=requests[a.requestIndex];actual=a.target==='request.header'?r?.headers[a.header]??MISSING:r&&Object.hasOwn(r,'json')&&r.json!==undefined?atPointer(r.json,a.pointer):MISSING;if(a.target==='request.schema'&&actual===MISSING)throw new HarnessError('EVIDENCE','Missing request schema evidence');}
    }
    const schemaAssertion=a.target==='node.schema'||a.target==='request.schema';const expectedValue=schemaAssertion?a.schema:a.equals;const passed=actual!==MISSING&&(schemaAssertion?matchesSchema(actual,a.schema):isDeepStrictEqual(actual,a.equals));
    const sensitive=('pointer'in a&&isSensitiveField(a.pointer))||('header'in a&&isSensitiveField(a.header));
    const expected=sensitive?'[REDACTED]':redactor.object(projectEvidence(expectedValue));const safeActual=actual===MISSING?'[MISSING]':sensitive?'[REDACTED]':redactor.object(projectEvidence(actual));
    return {target:label,passed,message:passed?label+' passed':`${label}: expected ${JSON.stringify(expected)}, observed ${JSON.stringify(safeActual)}`,expected,actual:safeActual};
  });
  const unexpected=evidence.requests.filter(r=>r.unexpected);
  results.push({target:'requests.unexpected',passed:unexpected.length===0,message:unexpected.length?`${unexpected.length} unexpected request(s): ${unexpected.map(r=>r.method+' '+r.path+' ('+r.reason+')').join(', ')}`:'No unexpected requests'});
  return results;
}
