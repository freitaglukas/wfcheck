import {sha256} from '../spec/load.js';
import {parseExport,metadata,object} from './export.js';
import {inventoryGraph} from './graph.js';
import type {AnalysisOptions,Diagnostic,NodeAnalysis,TriggerAnalysis,WorkflowAnalysis,PlanRequirement} from './types.js';
import {lookupCapability} from './registry.js';
import {analyzeDependencies} from './dependencies.js';
import {legacyNodeDefinitions} from '../security/workflow.js';
const identity=(v:unknown,fallback:string)=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v)?v:fallback;
export function analyzeWorkflow(source:string,options:AnalysisOptions={}):WorkflowAnalysis{
 const raw=parseExport(source),diagnostics:Diagnostic[]=[],nodes:NodeAnalysis[]=[],triggers:TriggerAnalysis[]=[],requirements:PlanRequirement[]=[];
 if(raw.nodes.length>200)diagnostics.push({code:'EXECUTION_NODE_LIMIT',severity:'error',summary:'Execution supports at most 200 nodes; full inventory retained'});
 const seenIds=new Set<string>(),seenNames=new Set<string>();
 for(const field of ['pinData','staticData'])if(raw[field]!=null&&(!object(raw[field])||Object.keys(raw[field]).length))diagnostics.push({code:'PINNED_STATE',severity:'error',pointer:'/'+field,summary:'Pinned/static execution state is unsupported'});
 for(const k of Object.keys(raw))if(!metadata.has(k)&&!['name','nodes','connections','settings'].includes(k))diagnostics.push({code:'UNKNOWN_EXPORT_FIELD',severity:'error',summary:'Unknown top-level runtime field'});
 raw.nodes.forEach((n:unknown,i:number)=>{
  const v=object(n)?n:{},id=identity(v.id,'node-'+i);
  const type=typeof v.type==='string'&&/^[A-Za-z0-9_@/.-]{1,256}$/.test(v.type)?v.type:'unknown';
  const version=typeof v.typeVersion==='number'&&Number.isFinite(v.typeVersion)?v.typeVersion:0;
  const local:Diagnostic[]=[];const pointer='/nodes/'+i;
  if(id!==v.id||typeof v.name!=='string'||!object(v.parameters))local.push({code:'INVALID_NODE',severity:'error',nodeId:id,pointer,summary:'Node identity or parameters are malformed'});
  if(seenIds.has(id)||seenNames.has(v.name))local.push({code:'DUPLICATE_IDENTITY',severity:'error',nodeId:id,pointer,summary:'Duplicate node identity'});
  seenIds.add(id);seenNames.add(v.name);
  const capability=lookupCapability(type,version,v.parameters?.operation??v.parameters?.method);
  if(!capability)local.push({code:'NODE_UNSUPPORTED',severity:'error',nodeId:id,pointer,summary:'Node type/version/operation needs an execution adapter'});
  else if(!capability.executable)local.push({code:'ADAPTER_UNAVAILABLE',severity:'configuration',nodeId:id,pointer,summary:'Analyzed integration needs a qualified execution adapter'});
  // These core parameter schemas are shared by v1 and v2. Do not apply the
  // v1 workflow/HTTP/credential restrictions to inventory of v2 capabilities.
  const sharedCore=type==='n8n-nodes-base.httpRequest'?undefined:legacyNodeDefinitions[type];
  if(sharedCore&&!sharedCore.params.safeParse(v.parameters).success)local.push({code:'EXECUTION_CONFIGURATION',severity:'configuration',nodeId:id,pointer,summary:'Known core node parameters require qualified configuration'});
  if(type==='n8n-nodes-base.webhook')triggers.push({nodeId:id,kind:'webhook-json',provenance:{source:'deterministic',pointer}});
  if(type==='n8n-nodes-base.formTrigger')triggers.push({nodeId:id,kind:'form-file',provenance:{source:'deterministic',pointer}});
  const code=typeof v.parameters?.jsCode==='string'?{sha256:sha256(v.parameters.jsCode),bytes:Buffer.byteLength(v.parameters.jsCode)}:undefined;
  const node:NodeAnalysis={id,type,typeVersion:version,summary:type+' v'+version,capabilityKey:type+':'+version,credentialTypes:object(v.credentials)?Object.keys(v.credentials).filter(k=>/^[A-Za-z0-9_-]{1,64}$/.test(k)):[],facts:[],diagnostics:local,...(capability?{capabilities:capability}:{}),...(code?{code}:{})};
  node.facts.push({kind:'execution.policy',value:{retry:v.retryOnFail===true,maxTries:Number.isInteger(v.maxTries)?v.maxTries:undefined,onError:['stopWorkflow','continueRegularOutput','continueErrorOutput'].includes(v.onError)?v.onError:'stopWorkflow'},provenance:{source:'deterministic',pointer}});
  requirements.push(...analyzeDependencies(node,object(v.parameters)?v.parameters:{},pointer+'/parameters'));
  nodes.push(node);diagnostics.push(...local);
 });
 if(triggers.length!==1)diagnostics.push({code:'TRIGGER_SELECTION',severity:'configuration',summary:'Select exactly one supported trigger'});
 const edges=inventoryGraph(raw,diagnostics,triggers);
 return {schemaVersion:1,sourceHash:sha256(source),...(options.catalog?{catalogHash:options.catalog.sha256}:{}),status:diagnostics.some(d=>d.severity==='error')?'unsupported':diagnostics.length||requirements.length?'configuration-needed':'ready',nodes,edges,triggers,requirements,diagnostics};
}
