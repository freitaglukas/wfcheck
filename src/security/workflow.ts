import { z } from 'zod';
import type { PreparedWorkflow, Workflow } from '../runtime/types.js';
import { sha256 } from '../spec/load.js';
import { HarnessError } from './errors.js';
const s=z.string(), value=z.union([s,z.number(),z.boolean()]);
const pairs=z.strictObject({parameters:z.array(z.strictObject({name:s,value})).max(20)});
const options=z.strictObject({caseSensitive:z.boolean(),leftValue:s,typeValidation:z.literal('strict'),version:z.literal(2)});
const conditions=z.strictObject({options,combinator:z.enum(['and','or']),conditions:z.array(z.strictObject({id:s,leftValue:value,rightValue:value.optional(),operator:z.strictObject({type:z.enum(['string','number','boolean']),operation:z.enum(['notEmpty','empty','equals','notEquals','gt','gte','lt','lte','true','false']),singleValue:z.boolean().optional()})})).min(1).max(10)});
const httpOptions=z.strictObject({timeout:z.int().min(100).max(10000).optional(),response:z.strictObject({response:z.strictObject({responseFormat:z.enum(['json','text']),fullResponse:z.boolean().optional(),neverError:z.boolean().optional()})}).optional(),redirect:z.strictObject({redirect:z.strictObject({followRedirects:z.literal(false),maxRedirects:z.literal(0).optional()})}).optional()});
const nodeSchema=z.strictObject({id:s.min(1).max(64),name:s.min(1).max(128),type:s,typeVersion:z.number(),position:z.tuple([z.number(),z.number()]),parameters:z.record(s,z.unknown()),retryOnFail:z.boolean().optional(),maxTries:z.int().min(1).max(3).optional(),waitBetweenTries:z.int().min(0).max(2000).optional(),onError:z.enum(['stopWorkflow','continueRegularOutput','continueErrorOutput']).optional(),credentials:z.strictObject({}).optional(),webhookId:s.optional(),notes:s.optional(),notesInFlow:z.boolean().optional()});
const workflowSchema=z.strictObject({name:s,nodes:z.array(nodeSchema).min(1).max(20),connections:z.record(s,z.strictObject({main:z.array(z.array(z.strictObject({node:s,type:z.literal('main'),index:z.int().min(0).max(1)}))).max(2)})),settings:z.record(s,z.unknown()).optional(),id:s.optional(),active:z.boolean().optional(),versionId:s.optional(),meta:z.record(s,z.unknown()).nullable().optional(),pinData:z.strictObject({}).nullable().optional(),staticData:z.strictObject({}).nullable().optional(),tags:z.array(z.unknown()).optional()});
const allow:Record<string,{versions:number[];params:z.ZodType}>={
  'n8n-nodes-base.webhook':{versions:[2],params:z.strictObject({httpMethod:z.literal('POST'),path:s.regex(/^[a-zA-Z0-9_-]+$/),responseMode:z.literal('onReceived'),options:z.strictObject({})})},
  'n8n-nodes-base.set':{versions:[3.4],params:z.strictObject({mode:z.literal('manual').optional(),assignments:z.strictObject({assignments:z.array(z.strictObject({id:s,name:s.regex(/^[a-zA-Z0-9_-]+$/),value,type:z.enum(['string','number','boolean'])})).max(20)}),includeOtherFields:z.boolean().optional(),options:z.strictObject({})})},
  'n8n-nodes-base.if':{versions:[2.2],params:z.strictObject({conditions,options:z.strictObject({})})},
  'n8n-nodes-base.filter':{versions:[2.2],params:z.strictObject({conditions,options:z.strictObject({})})},
  'n8n-nodes-base.noOp':{versions:[1],params:z.strictObject({})},
  'n8n-nodes-base.httpRequest':{versions:[4.2],params:z.strictObject({method:z.enum(['GET','POST','PUT','PATCH','DELETE','HEAD']),url:s.regex(/^\{\{WFCHECK_GATEWAY\}\}\/[a-zA-Z0-9/_-]*$/),authentication:z.literal('none').optional(),sendHeaders:z.boolean().optional(),headerParameters:pairs.optional(),sendBody:z.boolean().optional(),contentType:z.literal('json').optional(),specifyBody:z.literal('keypair').optional(),bodyParameters:pairs.optional(),options:httpOptions})}
};
function validateValues(value:unknown):void {
  if(typeof value==='string'&&(value.startsWith('=')||value.includes('{{')||value.includes('}}'))&&!/^=\{\{\s*\$json(?:\.[A-Za-z_][A-Za-z0-9_]*)+\s*\}\}$/.test(value))throw new HarnessError('UNSUPPORTED','Only simple $json field-reference expressions are supported');
  if(Array.isArray(value))for(const v of value)validateValues(v);
  else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(k))throw new HarnessError('UNSUPPORTED','Reserved object field');validateValues(v);}
}
export function prepareWorkflow(source:string,gatewayUrl:string,runId:string,testId:string,token:string,timeoutMs=30000):PreparedWorkflow {
  let parsed:unknown;try{parsed=JSON.parse(source);}catch{throw new HarnessError('CONFIG','Invalid workflow JSON');}
  const shape=workflowSchema.safeParse(parsed);if(!shape.success)throw new HarnessError('UNSUPPORTED','Unsupported workflow export: '+shape.error.issues.map(x=>x.path.join('.')+': '+x.message).join('; '));
  const wf=shape.data as Workflow;
  const ids=new Set(wf.nodes.map(n=>n.id)),names=new Set(wf.nodes.map(n=>n.name));
  if(ids.size!==wf.nodes.length||names.size!==wf.nodes.length)throw new HarnessError('UNSUPPORTED','Duplicate node IDs or names');
  for(const n of wf.nodes)if(!allow[n.type]||!allow[n.type]!.versions.includes(n.typeVersion))throw new HarnessError('UNSUPPORTED',`Unsupported node/version ${n.type} ${n.typeVersion}`);
  const webhooks=wf.nodes.filter(n=>n.type==='n8n-nodes-base.webhook');if(webhooks.length!==1)throw new HarnessError('UNSUPPORTED','Exactly one Webhook trigger is required');
  const trigger=webhooks[0]!;
  for(const n of wf.nodes){
    const definition=allow[n.type];if(!definition||!definition.versions.includes(n.typeVersion))throw new HarnessError('UNSUPPORTED',`Unsupported node/version ${n.type} ${n.typeVersion}`);
    const p=definition.params.safeParse(n.parameters);if(!p.success)throw new HarnessError('UNSUPPORTED',`Unsupported parameters on ${n.name}: `+p.error.issues.map(x=>x.path.join('.')+': '+x.message).join('; '));
    const params=structuredClone(n.parameters);if(n.type==='n8n-nodes-base.httpRequest')delete params.url;validateValues(params);
    if(n.retryOnFail&&(n.type!=='n8n-nodes-base.httpRequest'||!n.maxTries||n.waitBetweenTries===undefined))throw new HarnessError('UNSUPPORTED','Retries require explicit bounded HTTP maxTries/waitBetweenTries');
    if(n.type==='n8n-nodes-base.httpRequest')for(const h of n.parameters.headerParameters?.parameters??[]){if(h.name.toLowerCase()==='x-wfcheck-token'||h.name.toLowerCase()==='host'||typeof h.value!=='string'||!h.value.startsWith('fake-'))throw new HarnessError('UNSUPPORTED','HTTP headers must contain literal fake-* values; reserved headers are forbidden');}
  }
  for(const [name,c] of Object.entries(wf.connections)){
    if(!names.has(name))throw new HarnessError('UNSUPPORTED','Unknown connection source');
    for(const output of c.main)for(const edge of output){if(!names.has(edge.node)||edge.node===trigger.name||edge.index!==0)throw new HarnessError('UNSUPPORTED','Invalid connection target');}
  }
  const visited=new Set<string>(),stack=new Set<string>();
  function visit(name:string):void {if(stack.has(name))throw new HarnessError('UNSUPPORTED','Workflow cycles are unsupported');if(visited.has(name))return;visited.add(name);stack.add(name);for(const branch of wf.connections[name]?.main??[])for(const e of branch)visit(e.node);stack.delete(name);}
  visit(trigger.name);if(visited.size!==wf.nodes.length)throw new HarnessError('UNSUPPORTED','All nodes must be reachable from the Webhook');
  const changes=['name: unique project-owned wfcheck-dev name','settings: save successful/error execution data; bound execution timeout; remove account-dependent settings',`webhook ${trigger.id}: unique capability path`];
  const copy:Workflow={name:`wfcheck-dev-${runId}-${testId}`,nodes:structuredClone(wf.nodes),connections:structuredClone(wf.connections),settings:{saveDataSuccessExecution:'all',saveDataErrorExecution:'all',saveExecutionProgress:true,saveManualExecutions:true,executionTimeout:Math.ceil(timeoutMs/1000),executionOrder:'v1'}};
  const webhook=copy.nodes.find(n=>n.id===trigger.id)!;webhook.parameters.path=`wfcheck-${runId}-${testId}-${token.slice(0,24)}`;delete webhook.webhookId;
  for(const n of copy.nodes)if(n.type==='n8n-nodes-base.httpRequest'){
    n.parameters.url=n.parameters.url.replace('{{WFCHECK_GATEWAY}}',gatewayUrl);
    n.parameters.sendHeaders=true;n.parameters.headerParameters??={parameters:[]};n.parameters.headerParameters.parameters.push({name:'x-wfcheck-token',value:token});
    n.parameters.options.redirect={redirect:{followRedirects:false,maxRedirects:0}};
    changes.push(`HTTP ${n.id}: gateway namespace URL; short-lived authentication header; disable redirects`);
  }
  return {workflow:copy,sourceHash:sha256(source),changes,webhookNodeId:trigger.id,webhookNodeName:trigger.name,webhookPath:webhook.parameters.path};
}
