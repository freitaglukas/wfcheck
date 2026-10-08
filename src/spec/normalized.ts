import {suiteSchema} from './schema.js';
import {suiteV2Schema,type SuiteV2} from './schema-v2.js';
import {HarnessError} from '../security/errors.js';
export type NormalizedSuite=SuiteV2 & {sourceSchemaVersion:1|2};
export type NormalizedTest=SuiteV2['tests'][number];
export type NormalizedInput=NormalizedTest['input'];
export type HttpBinding=NormalizedTest['bindings'][number];
export type LogicalTable=NormalizedTest['tables'][number];
export type TableBinding=NormalizedTest['tableBindings'][number];
export type WorkflowTrust=NonNullable<NormalizedTest['trust']>;
export function normalizeSuite(raw:unknown):NormalizedSuite{
 let candidate:unknown=raw;
 if((raw as any)?.schemaVersion===1){
  const old=suiteSchema.parse(raw);
  candidate={schemaVersion:2,name:old.name,redactValues:old.redactValues,tests:old.tests.map(t=>({id:t.id,workflow:t.workflow,input:{kind:'json',fixture:t.fixture},timeoutMs:t.timeoutMs,mocks:t.mocks,assertions:t.assertions,verificationKind:t.assertions.some(a=>a.target!=='execution.status')?'behavior':'smoke'}))};
 }
 const parsed=suiteV2Schema.safeParse(candidate);
 if(!parsed.success)throw new HarnessError('CONFIG','Invalid suite: '+parsed.error.issues.map(i=>i.path.join('.')+': '+i.message).join('; '));
 if(parsed.data.draft)throw new HarnessError('CONFIG','Draft suite requires reviewed fixtures, bindings and expectations before execution');
 return {...parsed.data,sourceSchemaVersion:(raw as any)?.schemaVersion===1?1:2};
}
