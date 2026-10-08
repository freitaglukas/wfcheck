import {analyzeWorkflow} from '../analysis/index.js';
import {sha256} from '../spec/load.js';
import {resolveModel} from '../llm/resolve.js';
import {approvedRecording,writeRecording} from '../llm/recordings.js';
import type {ModelGatewayConfig} from '../llm/gateway.js';
import {resolveLlmPolicy} from '../llm/policy.js';
import type {ResolvedLlmPolicy,LlmOverrides} from '../llm/types.js';
import {randomUUID} from 'node:crypto';import {resolve,relative} from 'node:path';import type {NormalizedSuite,NormalizedTest} from '../spec/normalized.js';import {readBounded} from '../spec/load.js';import {loadInput} from './inputs.js';import type {CompiledInput,RuntimeAdapter,RuntimeHandle,TriggerAttempt,Evidence,PreparedWorkflow} from './types.js';import {prepareV2Workflow} from '../security/bindings.js';import {prepareWorkflow} from '../security/workflow.js';import {HarnessError,errorMessage} from '../security/errors.js';import type {GatewayTransport} from '../gateway/transport.js';import type {TestResult,SuiteResult} from './runner.js';import {evaluate} from '../assertions/index.js';import {redactor} from '../security/redact.js';
export interface CompiledTestV2 {spec:NormalizedTest;source:string;input:CompiledInput;sourceSchemaVersion:1|2;llm:ResolvedLlmPolicy;modelConfig?:ModelGatewayConfig;subworkflowSources?:string[];stepInputs?:CompiledInput[];}
export async function compileSuiteV2(suite:NormalizedSuite,base:string,projectRoot=process.cwd(),llmOverrides:LlmOverrides={}):Promise<CompiledTestV2[]>{redactor.add(...suite.redactValues);const tests:CompiledTestV2[]=[];for(const spec of suite.tests){const source=await readBounded(resolve(base,spec.workflow),projectRoot),input=await loadInput({...spec.input,fixture:relative(projectRoot,resolve(base,spec.input.fixture))},projectRoot);if(input.kind==='file'&&input.mimeType.startsWith('image/')&&spec.bindings.some(b=>b.protocol==='openai-chat')&&Math.ceil(input.bytes.length/3)*4+4096>65536)throw new HarnessError('CONFIG','Inline image exceeds the 64 KiB model request budget');const subworkflowSources=await Promise.all(spec.subworkflows.map(child=>readBounded(resolve(base,child.workflow),projectRoot)));const stepInputs=await Promise.all(spec.steps.map(step=>loadInput({...step.input,fixture:relative(projectRoot,resolve(base,step.input.fixture))},projectRoot)));const compiled={spec,source,input,stepInputs,sourceSchemaVersion:suite.sourceSchemaVersion,llm:resolveLlmPolicy(llmOverrides,spec.llm,suite.llm),subworkflowSources};const p=prepareCompiledTest(compiled,'https://mock.test/r/preflight/'+spec.id,'preflight','preflight-token');const ids=new Set(p.workflow.nodes.map(n=>n.id));for(const a of [...spec.assertions,...spec.steps.flatMap(step=>step.assertions)])if('nodeId'in a&&!ids.has(a.nodeId))throw new HarnessError('CONFIG','Assertion references an unknown node');if(spec.steps.length&&compiled.llm.mode!=='mock')throw new HarnessError('CAPABILITY','Stateful steps currently require deterministic mock mode');tests.push(compiled);}if(plannedExecutions(tests.map(t=>t.spec),tests.map(t=>t.source))>20)throw new HarnessError('CONFIG','Planned DAG execution bound exceeds the hard limit of 20');return tests;}
export function plannedExecutions(tests:NormalizedTest[],sources?:string[]):number{
 return tests.reduce((total,test,index)=>{
  let calls=test.subworkflows.length;
  if(calls&&sources){
   const workflow=JSON.parse(sources[index]!);
   const trigger=test.triggerId??workflow.nodes.filter((n:any)=>['n8n-nodes-base.webhook','n8n-nodes-base.formTrigger'].includes(n.type))[0]?.id;
   const ids=new Map<string,string>(workflow.nodes.map((n:any)=>[n.name,n.id]));
   const incoming=new Map<string,string[]>();
   for(const [name,groups]of Object.entries(workflow.connections) as any)for(const branch of groups.main??[])for(const edge of branch??[]){const id=ids.get(edge.node)!;incoming.set(id,[...(incoming.get(id)??[]),ids.get(name)!]);}
   const memo=new Map<string,number>(),active=new Set<string>();
   const paths=(id:string):number=>{
    if(id===trigger)return 1;if(memo.has(id))return memo.get(id)!;
    if(active.has(id))throw new HarnessError('CONFIG','Cyclic child execution budget');active.add(id);
    const count=Math.min(21,(incoming.get(id)??[]).reduce((sum,parent)=>sum+paths(parent),0));active.delete(id);memo.set(id,count);return count;
   };
   calls=test.subworkflows.reduce((count,child)=>count+paths(child.nodeId),0);
  }
  return total+(1+test.steps.length)*(1+calls);
 },0);
}
export function prepareCompiledTest(test:CompiledTestV2,url:string,runId:string,token:string):PreparedWorkflow{
 const prepared=test.sourceSchemaVersion===1?prepareWorkflow(test.source,url,runId,test.spec.id,token,test.spec.timeoutMs):prepareV2Workflow(test.source,test.spec,url,runId,test.spec.id,token);
 if(test.spec.subworkflows.length){
  if(test.subworkflowSources?.length!==test.spec.subworkflows.length)throw new HarnessError('CONFIG','Child workflow sources are missing');
  prepared.resources!.subworkflows=test.spec.subworkflows.map((child,index)=>{
   const source=test.subworkflowSources![index]!;const childWorkflow=JSON.parse(source);if(childWorkflow.nodes.some((n:any)=>n.type.startsWith('@n8n/n8n-nodes-langchain.')))throw new HarnessError('CAPABILITY','Child native model transports are not yet qualified');
   if(childWorkflow.nodes.filter((n:any)=>n.type==='n8n-nodes-base.executeWorkflowTrigger'&&n.disabled!==true).length!==1)throw new HarnessError('CAPABILITY','Child needs exactly one enabled native subworkflow entry');
   const spec={...test.spec,id:test.spec.id+'-child-'+index,triggerId:child.triggerId,trust:child.trust,tableBindings:child.tableBindings,bindings:[],nodeMocks:[],subworkflows:[],assertions:[]};
   const isolated=prepareV2Workflow(source,spec,url,runId,spec.id,token);for(const node of isolated.workflow.nodes)if(['n8n-nodes-base.webhook','n8n-nodes-base.formTrigger'].includes(node.type))node.disabled=true;isolated.changes.push('Child: external intake triggers disabled; native subworkflow entry retained');
   return {nodeId:child.nodeId,expectedWorkflowId:child.expectedWorkflowId,prepared:isolated};
  });
 }
 return prepared;
}
export async function prepareModelSelections(compiled:CompiledTestV2[],signal:AbortSignal){for(const t of compiled){const workflow=JSON.parse(t.source),routes=[...t.spec.bindings.filter(b=>b.protocol==='openai-chat').map(b=>({path:b.mockPath,nodeId:b.nodeId})),...workflow.nodes.filter((n:any)=>n.type==='@n8n/n8n-nodes-langchain.lmChatOpenAi').map((n:any)=>({path:'/native-model/'+n.id+'/v1/chat/completions',nodeId:n.id}))];if(!routes.length)continue;const policy=t.llm??resolveLlmPolicy();const selection=await resolveModel(policy,t.input.kind==='file'&&t.input.mimeType.startsWith('image/')?['completion','vision']:['completion'],signal);const config:ModelGatewayConfig={policy,selection,routes,sourceHash:(await import('../spec/load.js')).sha256(t.source),fixtureHash:t.input.sha256,caseTimeoutMs:t.spec.timeoutMs};if(policy.mode==='replay'){if(!policy.replayHash||!policy.replay)throw new HarnessError('CONFIG','Replay needs an independently approved recording hash');const recording=await approvedRecording(policy.replay,{approvedHash:policy.replayHash,sourceHash:config.sourceHash,fixtureHash:config.fixtureHash,settings:policy.settings});if(policy.model!=='auto'&&policy.model!==recording.selection.model)throw new HarnessError('CONFIG','Replay model identity changed');config.selection=recording.selection;config.replayCalls=recording.calls;}t.modelConfig=config;}}
interface EvidenceWindow {requestsEnd:number;modelsEnd:number;}
function refreshEvidence(result:TestResult,spec:NormalizedTest,capture:{requests:Evidence['requests'];errors:string[];modelCalls?:Evidence['modelCalls']},windows:EvidenceWindow[]){
 const phases=[{evidence:result.evidence!,assertions:spec.assertions},...(result.steps??[]).map((s,i)=>({evidence:s.evidence,assertions:spec.steps[i]!.assertions}))];
 let requestsStart=0,modelsStart=0;
 for(const [i,phase]of phases.entries()){
  const last=i===phases.length-1,window=windows[i]!;
  phase.evidence.requests=capture.requests.slice(requestsStart,last?undefined:window.requestsEnd);
  phase.evidence.modelCalls=(capture.modelCalls??[]).slice(modelsStart,last?undefined:window.modelsEnd);
  phase.evidence.gatewayErrors=capture.errors;
  const assertions=evaluate(phase.assertions as any,phase.evidence);
  if(i===0)result.assertions=assertions;else result.steps![i-1]!.assertions=assertions;
  requestsStart=window.requestsEnd;modelsStart=window.modelsEnd;
 }
 if(result.status!=='error')result.status=result.assertions.every(a=>a.passed)&&(result.steps??[]).every(s=>s.assertions.every(a=>a.passed))?'passed':'failed';
}
export async function runCompiledV2(suite:NormalizedSuite,compiled:CompiledTestV2[],adapter:RuntimeAdapter & {recover?:(testId?:string)=>Promise<void>;tables?:(h:RuntimeHandle,signal:AbortSignal)=>Promise<import('./types.js').TableEvidence[]>},gateway:GatewayTransport,url:string,runId:string,signal:AbortSignal,onResult?:(t:TestResult)=>void,runtime?:import('./factory.js').RuntimeCapabilities):Promise<SuiteResult>{
 if(!compiled.length||plannedExecutions(compiled.map(t=>t.spec),compiled.map(t=>t.source))>20)throw new HarnessError('CONFIG','Suite must plan 1-20 serial executions');const start=Date.now(),results:TestResult[]=[],windows=new Map<string,EvidenceWindow[]>();let halted=false;
 for(const test of compiled){const began=Date.now(),r:TestResult={id:test.spec.id,verificationKind:test.spec.verificationKind,status:'error',durationMs:0,assertions:[],fixtureHash:test.input.sha256,cleanup:{status:'not-created'}};let handle:RuntimeHandle|undefined;
 try{if(halted||signal.aborted)throw new HarnessError('INTERRUPTED','Case not executed after infrastructure error or interruption');const registration=await gateway.register(runId,test.spec.id,test.spec.mocks,test.spec.timeoutMs+30000,test.modelConfig);redactor.add(registration.token,registration.token.slice(0,24));const prepared=prepareCompiledTest(test,url+'/r/'+runId+'/'+test.spec.id,runId,registration.token);r.sourceHash=prepared.sourceHash;r.analysisHash=sha256(JSON.stringify(analyzeWorkflow(test.source)));r.changes=prepared.changes;const deadline=AbortSignal.any([signal,AbortSignal.timeout(test.spec.timeoutMs)]);handle=await adapter.importWorkflow(prepared,runId,test.spec.id,deadline);r.cleanup.workflowId=handle.workflowId;await adapter.activate(handle,deadline);const marker=randomUUID(),trigger=await adapter.trigger(handle,test.input,marker,deadline);const execution=await adapter.observe(handle,marker,deadline);await gateway.drain(runId,test.spec.id);const capture=await gateway.snapshot(runId,test.spec.id);windows.set(test.spec.id,[{requestsEnd:capture.requests.length,modelsEnd:capture.modelCalls?.length??0}]);r.evidence={execution,requests:capture.requests,gatewayErrors:capture.errors,modelCalls:capture.modelCalls??[],...(trigger?{trigger}:{})};if(test.spec.tables.length)r.evidence.tables=await adapter.tables?.(handle,deadline);if(test.llm?.record&&test.modelConfig?.selection&&test.modelConfig.policy.mode==='local'){const calls=(capture.modelCalls??[]).filter(c=>c.status==='success'&&c.responseHash&&c.response);await writeRecording(test.llm.record,{formatVersion:1,protocol:'openai-chat',sourceHash:prepared.sourceHash,fixtureHash:test.input.sha256,selection:test.modelConfig.selection,settings:test.llm.settings,calls:calls.map(c=>({requestHash:c.requestHash,responseHash:c.responseHash!,response:c.response}))});}
 r.assertions=evaluate(test.spec.assertions as any,r.evidence);
 for(const [index,step]of test.spec.steps.entries()){
  const input=test.stepInputs?.[index];if(!input)throw new HarnessError('CONFIG','Stateful step input missing');
  const marker=randomUUID(),trigger=await adapter.trigger(handle,input,marker,deadline),execution=await adapter.observe(handle,marker,deadline);await gateway.drain(runId,test.spec.id);const capture=await gateway.snapshot(runId,test.spec.id);
  const previous=windows.get(test.spec.id)!.at(-1)!;const evidence:Evidence={execution,requests:capture.requests.slice(previous.requestsEnd),gatewayErrors:capture.errors,modelCalls:(capture.modelCalls??[]).slice(previous.modelsEnd),...(trigger?{trigger}:{})};
  windows.get(test.spec.id)!.push({requestsEnd:capture.requests.length,modelsEnd:capture.modelCalls?.length??0});const observed={id:step.id,fixtureHash:input.sha256,evidence,assertions:[] as TestResult['assertions']};(r.steps??=[]).push(observed);if(test.spec.tables.length)evidence.tables=await adapter.tables?.(handle,deadline);observed.assertions=evaluate(step.assertions as any,evidence);
 }
 r.status=r.assertions.every(a=>a.passed)&&(r.steps??[]).every(s=>s.assertions.every(a=>a.passed))?'passed':'failed';
 }catch(error){r.error={code:error instanceof HarnessError?error.code:'INFRASTRUCTURE',message:redactor.text(errorMessage(error))};halted=true;}
 finally{try{await gateway.seal(runId,test.spec.id);}catch(error){r.status='error';r.error??={code:'GATEWAY',message:redactor.text(errorMessage(error))};halted=true;}try{if(handle)await adapter.cleanup(handle);else await adapter.recover?.(test.spec.id);r.cleanup.status='cleaned';}catch(error){r.status='error';r.cleanup.status='failed';r.cleanup.message=redactor.text(errorMessage(error));r.error??={code:'CLEANUP',message:r.cleanup.message};halted=true;}try{await gateway.seal(runId,test.spec.id);if(r.evidence){const capture=await gateway.snapshot(runId,test.spec.id);refreshEvidence(r,test.spec,capture,windows.get(test.spec.id)!);}}catch(error){if(r.evidence){r.status='error';r.error??={code:'EVIDENCE',message:redactor.text(errorMessage(error))};halted=true;}}r.durationMs=Date.now()-began;results.push(r);onResult?.(r);}
 }
 for(const r of results)if(r.evidence){try{await gateway.drain(runId,r.id);const capture=await gateway.snapshot(runId,r.id);refreshEvidence(r,compiled.find(t=>t.spec.id===r.id)!.spec,capture,windows.get(r.id)!);}catch(error){r.status='error';r.error??={code:'EVIDENCE',message:redactor.text(errorMessage(error))};}}
 return {schemaVersion:2,...(runtime?{runtime}:{}),runId,suite:suite.name,startedAt:new Date(start).toISOString(),durationMs:Date.now()-start,plannedExecutions:plannedExecutions(compiled.map(t=>t.spec),compiled.map(t=>t.source)),tests:results,exitCode:results.some(r=>r.status==='error')?2:results.some(r=>r.status==='failed')?1:0};
}
