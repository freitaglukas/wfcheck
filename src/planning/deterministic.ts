import {sha256} from '../spec/load.js';
import {suiteV2Schema} from '../spec/schema-v2.js';
import type {WorkflowAnalysis,PlanRequirement} from '../analysis/types.js';
import type {BehaviorContract,DraftPlan} from './types.js';
export function buildDraft(analysis:WorkflowAnalysis,contracts:BehaviorContract[]=[]):DraftPlan{
 const trigger=analysis.triggers.length===1?analysis.triggers[0]:undefined;
 const unresolved:PlanRequirement[]=[...analysis.requirements,{id:'input-fixture',kind:'input-fixture',nodeId:trigger?.nodeId,summary:'Supply an independently authored input fixture',provenance:{source:'unknown'}}];
 if(!contracts.length)unresolved.push({id:'oracle',kind:'oracle',summary:'Supply behavior expectations or explicitly choose smoke-only verification',provenance:{source:'unknown'}});
 for(const d of analysis.diagnostics)if(d.severity==='error'||d.code==='ADAPTER_UNAVAILABLE')unresolved.push({id:d.nodeId+'-'+d.code,kind:'adapter',nodeId:d.nodeId,pointer:d.pointer,summary:d.summary,provenance:{source:'deterministic',pointer:d.pointer}});
 const verificationKind=contracts.length?'behavior':'smoke';
 const proposedSuite=suiteV2Schema.parse({schemaVersion:2,name:'Generated workflow tests',draft:true,tests:[{id:'one',workflow:'workflow.json',input:trigger?.kind==='form-file'?{kind:'file',fixture:'fixtures/input.pdf',field:'REVIEW_FIELD',mimeType:'application/pdf'}:{kind:'json',fixture:'fixtures/input.json'},triggerId:trigger?.nodeId,mocks:[],assertions:[{target:'execution.status',equals:'success'},...contracts.map(c=>c.assertion)],verificationKind}]});
 const scenarios:DraftPlan['scenarios']=[{id:'happy-path',kind:'normal-input',provenance:{source:'inferred'}}];
 for(const n of analysis.nodes){
  if(n.facts.some(f=>f.kind==='branch.operators'))scenarios.push({id:n.id+'-branch',kind:'branch-and-missing-input',nodeId:n.id,provenance:{source:'inferred'}});
  if(['read','write','llm'].includes(n.capabilities?.effect??''))scenarios.push({id:n.id+'-dependency-error',kind:'dependency-error',nodeId:n.id,provenance:{source:'inferred'}});
  if(n.facts.some(f=>f.kind==='execution.policy'&&(f.value as any)?.retry))scenarios.push({id:n.id+'-retry',kind:'retry',nodeId:n.id,provenance:{source:'deterministic'}});
  if(n.facts.some(f=>f.kind==='output.schema'))scenarios.push({id:n.id+'-schema',kind:'declared-schema',nodeId:n.id,provenance:{source:'user'}});
 }
 return {schemaVersion:1,sourceHash:analysis.sourceHash,analysisHash:sha256(JSON.stringify(analysis)),...(analysis.catalogHash?{catalogHash:analysis.catalogHash}:{}),analysis,selectedTrigger:trigger?.nodeId,proposedSuite,unresolved,verificationKind,scenarios};
}
