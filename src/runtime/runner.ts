import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { Suite,TestSpec } from '../spec/schema.js';
import { readBounded,sha256 } from '../spec/load.js';
import { prepareWorkflow } from '../security/workflow.js';
import { HarnessError,errorMessage } from '../security/errors.js';
import { redactor } from '../security/redact.js';
import { evaluate,type AssertionResult } from '../assertions/index.js';
import { Gateway } from '../gateway/server.js';
import type { RuntimeAdapter,RuntimeHandle,Evidence } from './types.js';
export interface CompiledTest {spec:TestSpec;source:string;fixture:Record<string,unknown>;fixtureHash:string;}
export interface TestResult {id:string;status:'passed'|'failed'|'error';durationMs:number;assertions:AssertionResult[];error?:{code:string;message:string};evidence?:Evidence;sourceHash?:string;fixtureHash?:string;changes?:string[];cleanup:{status:'not-created'|'cleaned'|'failed';workflowId?:string;message?:string};}
export interface SuiteResult {schemaVersion:1;runId:string;suite:string;startedAt:string;durationMs:number;plannedExecutions:number;tests:TestResult[];exitCode:0|1|2;}
export function newRunId():string{return randomUUID().replaceAll('-','');}
export async function compileSuite(suite:Suite,base:string):Promise<CompiledTest[]> {
  redactor.add(...suite.redactValues);
  const compiled:CompiledTest[]=[];
  for(const spec of suite.tests){
    const source=await readBounded(resolve(base,spec.workflow));const raw=await readBounded(resolve(base,spec.fixture));
    let fixture:unknown;try{fixture=JSON.parse(raw);}catch{throw new HarnessError('CONFIG',`Invalid JSON fixture for ${spec.id}`);}
    if(!fixture||typeof fixture!=='object'||Array.isArray(fixture)||Buffer.byteLength(raw)>65536)throw new HarnessError('CONFIG','Webhook fixture must be a JSON object of at most 64 KiB');
    const prepared=prepareWorkflow(source,'https://gateway.example.test/r/preflight/test','preflight',spec.id,'preflight-token',spec.timeoutMs);
    const ids=new Set(prepared.workflow.nodes.map(n=>n.id));
    for(const a of spec.assertions)if('nodeId'in a&&!ids.has(a.nodeId))throw new HarnessError('CONFIG',`Assertion references unknown node ID ${a.nodeId}`);
    compiled.push({spec,source,fixture:fixture as Record<string,unknown>,fixtureHash:sha256(raw)});
  }
  return compiled;
}
export async function runCompiled(suite:Suite,compiled:CompiledTest[],adapter:RuntimeAdapter,gateway:Gateway,publicUrl:string,runId=newRunId(),signal?:AbortSignal,onResult?:(result:TestResult)=>void):Promise<SuiteResult> {
  if(!compiled.length||compiled.length>20)throw new HarnessError('CONFIG','Suite must plan 1-20 serial executions');
  const start=Date.now();const tests:TestResult[]=[];let halted=false;
  for(const test of compiled){
    const started=Date.now();const result:TestResult={id:test.spec.id,status:'error',durationMs:0,assertions:[],cleanup:{status:'not-created'},fixtureHash:test.fixtureHash};
    let handle:RuntimeHandle|undefined;
    try {
      if(halted||signal?.aborted)throw new HarnessError('INTERRUPTED','Test not executed because an earlier infrastructure failure or interruption halted the suite');
      const token=gateway.register(runId,test.spec.id,test.spec.mocks,test.spec.timeoutMs+30000).token;redactor.add(token.slice(0,24));
      const prepared=prepareWorkflow(test.source,publicUrl+'/r/'+runId+'/'+test.spec.id,runId,test.spec.id,token,test.spec.timeoutMs);
      result.sourceHash=prepared.sourceHash;result.changes=prepared.changes;
      const caseSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(test.spec.timeoutMs)]):AbortSignal.timeout(test.spec.timeoutMs);
      handle=await adapter.importWorkflow(prepared,runId,test.spec.id);result.cleanup.workflowId=handle.workflowId;
      await adapter.activate(handle,caseSignal);
      const marker=randomUUID();await adapter.trigger(handle,test.fixture,marker,caseSignal);
      const execution=await adapter.observe(handle,marker,caseSignal);
      await gateway.drain(runId,test.spec.id);
      const snapshot=gateway.snapshot(runId,test.spec.id);
      result.evidence={execution,requests:snapshot.requests,gatewayErrors:snapshot.errors};
      result.assertions=evaluate(test.spec.assertions,result.evidence);result.status=result.assertions.every(a=>a.passed)?'passed':'failed';
    }catch(error){result.status='error';result.error={code:error instanceof HarnessError?error.code:'INFRASTRUCTURE',message:redactor.text(errorMessage(error))};halted=true;}
    finally{
      if(handle)try{await adapter.cleanup(handle);result.cleanup.status='cleaned';}catch(error){result.cleanup.status='failed';result.cleanup.message=redactor.text(errorMessage(error));result.status='error';result.error={code:'CLEANUP',message:`Leftover workflow ${handle.workflowId}. Run wfcheck cleanup with its manifest; ${result.cleanup.message}`};halted=true;}
      gateway.seal(runId,test.spec.id);
      try{const final=gateway.snapshot(runId,test.spec.id);if(result.evidence){result.evidence.requests=final.requests;result.evidence.gatewayErrors=final.errors;result.assertions=evaluate(test.spec.assertions,result.evidence);if(result.status!=='error')result.status=result.assertions.every(a=>a.passed)?'passed':'failed';}}catch(error){if(result.evidence){result.status='error';result.error={code:error instanceof HarnessError?error.code:'GATEWAY',message:redactor.text(errorMessage(error))};halted=true;}}
      gateway.seal(runId,test.spec.id);result.durationMs=Date.now()-started;tests.push(result);onResult?.(result);
    }
  }
  // Audit retained, sealed namespaces at the suite cutoff; never reuse them in a later run.
  await Promise.allSettled(tests.filter(t=>t.evidence).map(t=>gateway.drain(runId,t.id)));
  for(const result of tests)if(result.evidence){
    const previousStatus=result.status;
    const snapshot=gateway.snapshot(runId,result.id);result.evidence.requests=snapshot.requests;result.evidence.gatewayErrors=snapshot.errors;
    try{result.assertions=evaluate(compiled.find(t=>t.spec.id===result.id)!.spec.assertions,result.evidence);if(result.status!=='error')result.status=result.assertions.every(a=>a.passed)?'passed':'failed';}
    catch(error){result.status='error';result.error={code:error instanceof HarnessError?error.code:'GATEWAY',message:redactor.text(errorMessage(error))};}
    if(result.status!==previousStatus)onResult?.(result);
  }
  return {schemaVersion:1,runId,suite:suite.name,startedAt:new Date(start).toISOString(),durationMs:Date.now()-start,plannedExecutions:compiled.length,tests,exitCode:tests.some(t=>t.status==='error')?2:tests.some(t=>t.status==='failed')?1:0};
}
