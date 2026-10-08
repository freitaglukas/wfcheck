import {normalizeSuite} from '../spec/normalized.js';
import {assertionV2Schema} from '../spec/schema-v2.js';
import type {Diagnostic} from '../analysis/types.js';
import type {DraftPlan,PlanConfiguration,PlanValidation} from './types.js';
import {sha256} from '../spec/load.js';
import {prepareV2Workflow} from '../security/bindings.js';
export function validatePlan(draft:DraftPlan,config:PlanConfiguration):PlanValidation{
 const diagnostics:Diagnostic[]=[...draft.analysis.diagnostics.filter(d=>d.severity==='error')];
 let suite;try{suite=normalizeSuite(config.candidateSuite);}catch{diagnostics.push({code:'INVALID_OR_DRAFT_SUITE',severity:'error',summary:'Suite is invalid or remains a draft'});return {ready:false,executable:null,diagnostics};}
 const ids=new Set(draft.analysis.nodes.map(n=>n.id));
 if(draft.catalogHash&&config.runtimeCapabilities?.nodeCatalogHash&&draft.catalogHash!==config.runtimeCapabilities.nodeCatalogHash)diagnostics.push({code:'CATALOG_MISMATCH',severity:'error',summary:'Runtime node catalog changed'});
 for(const test of suite.tests){
  const add=(code:string,summary:string,nodeId?:string)=>diagnostics.push({code,severity:'configuration',summary,...(nodeId?{nodeId}:{})});
  const source=config.workflowSources?.[test.workflow];
  const sourceMatches=typeof source==='string'&&sha256(source)===draft.sourceHash;
  if(typeof source!=='string')add('SOURCE_REQUIRED','Supply resolved original bytes for each candidate workflow path');
  else if(!sourceMatches)add('SOURCE_HASH_MISMATCH','Candidate workflow bytes no longer match the inspected source');
  if(test.trust&&test.trust.sourceHash!==draft.sourceHash)add('SOURCE_HASH_MISMATCH','Reviewed source hash no longer matches the export');
  if(!draft.analysis.triggers.some(t=>t.nodeId===(test.triggerId??draft.selectedTrigger)))add('TRIGGER_REQUIRED','A supported trigger must be selected');
  if(sourceMatches)try{prepareV2Workflow(source!,test,'https://gateway.example.test/r/planning/'+test.id,'planning',test.id,'planning-token');}
  catch{add('PARAMETERS_REQUIRED','Candidate workflow parameters or bindings do not satisfy the qualified version-two profile');}
  if(!config.validatedInputs.some(i=>i.path===test.input.fixture&&i.kind===test.input.kind))add('INPUT_REQUIRED','Input fixture has not been validated');
  for(const a of test.assertions){if('nodeId'in a&&!ids.has(a.nodeId))add('UNKNOWN_ASSERTION_NODE','Assertion references an unknown node',a.nodeId);if('tableId'in a&&!test.tables.some(t=>t.id===a.tableId))add('UNKNOWN_ASSERTION_TABLE','Assertion references an unknown table');}
  for(const n of draft.analysis.nodes){
   if(!n.capabilities?.executable)add('ADAPTER_UNAVAILABLE','Node requires a qualified execution adapter',n.id);
   if(n.code&&!test.trust?.reviewedCode.some(c=>c.nodeId===n.id&&c.codeHash===n.code!.sha256&&c.noExternalEffects))add('CODE_REVIEW_REQUIRED','Code is not reviewed under its exact hash',n.id);
  }
  for(const r of draft.analysis.requirements){
   if(r.kind==='http-binding'&&!test.bindings.some(b=>b.nodeId===r.nodeId))add('BINDING_REQUIRED','HTTP node has no test binding',r.nodeId);
   if(r.kind==='table-binding'&&!test.tableBindings.some(b=>b.nodeId===r.nodeId))add('TABLE_BINDING_REQUIRED','Table node has no isolated binding',r.nodeId);
   if(r.kind==='expression-review'&&test.trust?.sourceHash!==draft.sourceHash)add('EXPRESSION_REVIEW_REQUIRED','Executable expressions require a reviewed source pin',r.nodeId);
  }
  if(test.verificationKind==='behavior'&&!config.authoredContracts.length)add('ORACLE_REQUIRED','Independent behavior expectations are missing');
  for(const contract of config.authoredContracts.filter(c=>c.fixtureId===test.id))if(!test.assertions.some(a=>JSON.stringify(a)===JSON.stringify(assertionV2Schema.parse(contract.assertion))))add('CONTRACT_MISSING','Authored expectations must remain unchanged');
 }
 return {ready:diagnostics.length===0,executable:diagnostics.length?null:suite,diagnostics};
}
