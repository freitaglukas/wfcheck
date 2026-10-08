import {sha256} from '../spec/load.js';
import {object} from './export.js';
import type {NodeAnalysis,PlanRequirement} from './types.js';
export function analyzeDependencies(node:NodeAnalysis,params:Record<string,any>,pointer:string):PlanRequirement[]{
 const requirements:PlanRequirement[]=[];
 const require=(kind:string,summary:string)=>requirements.push({id:node.id+'-'+kind,kind,nodeId:node.id,pointer,summary,provenance:{source:'deterministic',pointer}});
 const fact=(kind:string,value:unknown,path=pointer)=>node.facts.push({kind,value,provenance:{source:'deterministic',pointer:path}});
 if(node.type==='n8n-nodes-base.formTrigger'){
  const fields=params.formFields?.values;
  if(Array.isArray(fields))fact('file.fields',fields.filter(f=>object(f)&&f.fieldType==='file').map((f,i)=>({index:i,name:typeof f.fieldLabel==='string'&&/^[A-Za-z0-9 _-]{1,64}$/.test(f.fieldLabel)?f.fieldLabel:undefined,multiple:f.multipleFiles===true})),pointer+'/formFields');
 }
 if(typeof params.binaryPropertyName==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(params.binaryPropertyName))fact('binary.input',params.binaryPropertyName,pointer+'/binaryPropertyName');
 if(object(params.conditions)&&Array.isArray(params.conditions.conditions))fact('branch.operators',params.conditions.conditions.filter(object).map((c:any)=>({type:['string','number','boolean'].includes(c.operator?.type)?c.operator.type:undefined,operation:['notEmpty','empty','equals','notEquals','true','false','gt','gte','lt','lte'].includes(c.operator?.operation)?c.operator.operation:undefined})),pointer+'/conditions');
 if(node.type==='n8n-nodes-base.httpRequest'){
  const url=params.url;
  if(typeof url!=='string'||url.includes('{{')&& !url.startsWith('{{WFCHECK_GATEWAY}}/')){
   node.diagnostics.push({code:'DYNAMIC_DESTINATION',severity:'configuration',nodeId:node.id,pointer:pointer+'/url',summary:'HTTP destination must be a known literal bound to a test endpoint'});
  }else if(url.startsWith('{{WFCHECK_GATEWAY}}/'))fact('http.destination',{kind:'gateway-placeholder',sha256:sha256(url)},pointer+'/url');
  else{
   try{const parsed=new URL(url);fact('http.destination',{kind:'literal',origin:parsed.origin,sha256:sha256(url)},pointer+'/url');if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('unsafe');require('http-binding','Bind this HTTP node to a synthetic mock or supported local model protocol');}
   catch{node.diagnostics.push({code:'INVALID_DESTINATION',severity:'error',nodeId:node.id,pointer:pointer+'/url',summary:'Unsupported HTTP destination'});}
  }
 }
 if(node.type==='n8n-nodes-base.dataTable'){
  if(params.resource!=='row')node.diagnostics.push({code:'OPERATION_UNSUPPORTED',severity:'error',nodeId:node.id,pointer,summary:'Only row get/upsert/update can be isolated'});
  const resource=object(params.dataTableId)?params.dataTableId.value:params.dataTableId;
  if(typeof resource!=='string'||resource.includes('{{')||resource.startsWith('='))node.diagnostics.push({code:'DYNAMIC_RESOURCE',severity:'configuration',nodeId:node.id,pointer,summary:'Table identity must be a literal bound to an isolated test table'});
  else fact('table.sourceHash',sha256(resource),pointer+'/dataTableId');
  require('table-binding','Supply an explicit table schema, seed rows and isolated logical table binding');
 }
 if(node.type==='n8n-nodes-base.executeWorkflow')require('subworkflow-binding','Bind the source child workflow ID to a reviewed isolated child export');
 if(node.type==='n8n-nodes-base.gmail')require('node-mock','Bind this outbound send to a pinned synthetic delivery boundary');
 if(node.code)require('code-review','Review immutable Code and explicitly declare its effects before execution');
 if(node.type==='n8n-nodes-base.formTrigger')require('file-fixture','Supply one file fixture with field name, MIME type and byte hash');
 if(node.credentialTypes.length)require('credential-isolation','Replace source credential references with disposable test authentication');
 if(node.capabilities?.effect==='llm')require('llm-policy','Choose deterministic mock, local model or approved replay');
 function references(value:unknown,path:string):void{
  if(typeof value==='string'&&(value.startsWith('=')||value.includes('{{'))){
   const fields=[...value.matchAll(/\$json((?:\.[A-Za-z_][A-Za-z0-9_]*)+)/g)].map(m=>m[1]!.slice(1));
   if(fields.length)fact('input.references',[...new Set(fields)],path);
   if(!/^=\{\{\s*\$json(?:\.[A-Za-z_][A-Za-z0-9_]*)+\s*\}\}$/.test(value)&&!value.startsWith('{{WFCHECK_GATEWAY}}/'))require('expression-review','Review executable expressions under an immutable source pin');
  }else if(Array.isArray(value))value.forEach((v,i)=>references(v,path+'/'+i));
  else if(object(value))for(const[k,v]of Object.entries(value))if(!(node.type==='n8n-nodes-base.code'&&path===pointer&&k==='jsCode'))references(v,path+'/'+k.replaceAll('~','~0').replaceAll('/','~1'));
 }
 references(params,pointer);
 return requirements.filter((r,i,a)=>a.findIndex(x=>x.id===r.id)===i);
}
