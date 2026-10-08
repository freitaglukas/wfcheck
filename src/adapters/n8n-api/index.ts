import {requireActive} from '../../runtime/cancellation.js';
import {createTables,collectTables,type OwnedTable} from './tables.js';
import {randomBytes,randomUUID} from 'node:crypto';import {N8nCloudAdapter} from '../n8n-cloud/index.js';import {CloudClient,ApiError} from '../n8n-cloud/client.js';import {Manifest} from '../../runtime/manifest.js';import {ResourceJournal,type OwnedRecord} from '../../runtime/journal.js';import {createOwned,recoverOwned} from './resources.js';import {apiRecovery} from './recovery.js';import {submitTrigger,type TriggerAuth} from './trigger.js';import {HarnessError} from '../../security/errors.js';import {redactor} from '../../security/redact.js';import type {PreparedWorkflow,RuntimeHandle,CompiledInput,TriggerAttempt,ExecutionObservation} from '../../runtime/types.js';
export interface ApiAdapterOptions {managedDocker?:boolean;parentId?:string;credentialReader?:(id:string)=>Promise<{id:string;name:string}>;}
export class N8nApiAdapter extends N8nCloudAdapter {
 #preparations=new Set<Promise<RuntimeHandle>>();#preparationStop=new AbortController();
 #tables=new Map<string,OwnedTable[]>();
 #executions=new Map<string,string>();
 #auth=new Map<string,TriggerAuth>();#testIds=new Map<string,string>();
 constructor(client:CloudClient,manifest:Manifest,readonly journal:ResourceJournal,private options:ApiAdapterOptions={}){super(client,manifest,options);}
 async importWorkflow(prepared:PreparedWorkflow,runId:string,testId:string,signal?:AbortSignal):Promise<RuntimeHandle>{const deadline=signal?AbortSignal.any([signal,this.#preparationStop.signal]):this.#preparationStop.signal;const task=this.prepareImport(prepared,runId,testId,deadline);this.#preparations.add(task);try{return await task;}finally{this.#preparations.delete(task);}}
 async settlePreparations(){this.#preparationStop.abort();await Promise.allSettled([...this.#preparations]);}
 private async prepareImport(prepared:PreparedWorkflow,runId:string,testId:string,signal?:AbortSignal):Promise<RuntimeHandle>{
  requireActive(signal);
  const copy=structuredClone(prepared),auth:TriggerAuth={user:'wfcheck',password:randomBytes(32).toString('hex')};redactor.add(auth.password);
  if(copy.trigger?.kind==='form-file'){
   const name=copy.workflow.name+'-form-auth';const credential=await createOwned(this.journal,{kind:'credential',name,testId,parentId:this.options.parentId},()=>{requireActive(signal);return this.client.request('credentials','POST',{name,type:'httpBasicAuth',data:auth},signal);});copy.workflow.nodes.find(n=>n.id===copy.trigger!.nodeId)!.credentials={httpBasicAuth:{id:credential.id,name}};
  }
  for(const n of copy.workflow.nodes.filter(n=>n.type==='@n8n/n8n-nodes-langchain.lmChatOpenAi')){requireActive(signal);const name=copy.workflow.name+'-chat-'+n.id;const credential=await createOwned(this.journal,{kind:'credential',name,testId,parentId:this.options.parentId},()=>{requireActive(signal);return this.client.request('credentials','POST',{name,type:'openAiApi',data:{apiKey:copy.modelToken,url:n.parameters.options.baseURL}},signal);});n.credentials={openAiApi:{id:credential.id,name}};}
  const tables=await createTables(this.client,this.journal,copy,testId,this.options.parentId,signal);
  requireActive(signal);
  const intent=await this.journal.begin({kind:'workflow',name:copy.workflow.name,runId:this.journal.runId,testId,ownerIdentity:this.journal.ownerIdentity,parentId:this.options.parentId});
  const h=await super.importWorkflow(copy,runId,testId,signal);await this.journal.confirm(intent.intentId,h.workflowId);this.#tables.set(h.workflowId,tables);this.#auth.set(h.workflowId,auth);this.#testIds.set(h.workflowId,testId);return h;
 }
 async trigger(h:RuntimeHandle,input:Record<string,unknown>|CompiledInput,marker:string,signal:AbortSignal):Promise<void|TriggerAttempt>{const intent=await this.journal.begin({kind:'execution',name:marker,runId:this.journal.runId,testId:this.#testIds.get(h.workflowId),ownerIdentity:this.journal.ownerIdentity,parentId:h.workflowId});this.#executions.set(h.workflowId,intent.intentId);try{if(h.prepared.trigger?.kind==='form-file')return await submitTrigger(this.client.baseUrl,h,input as CompiledInput,marker,signal,this.#auth.get(h.workflowId));return await super.trigger(h,input,marker,signal);}catch(error){if(error instanceof HarnessError&&/HTTP (401|403|404)/.test(error.message))await this.journal.cancelRejectedExecution(intent.intentId);throw error;}}
 protected async recordCorrelation(h:RuntimeHandle,id:string){const intent=this.#executions.get(h.workflowId);if(!intent)throw new HarnessError('OWNERSHIP','Execution has no recorded trigger intent');await this.journal.confirm(intent,id);}
 async tables(h:RuntimeHandle,signal:AbortSignal){const tables=this.#tables.get(h.workflowId);if(!tables)throw new HarnessError('EVIDENCE','Table evidence scope is unavailable');return collectTables(this.client,this.journal,tables,signal);}
 async removeResource(e:OwnedRecord){
  if(e.kind==='credential'){
   let actual:{id:string;name:string}|undefined;
   if(this.options.credentialReader)actual=await this.options.credentialReader(e.id!);
   else{let cursor:string|undefined;const seen=new Set<string>();for(let count=0;count<20;count++){const page=await this.client.request('credentials?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''));if(!Array.isArray(page?.data))throw new HarnessError('EVIDENCE','Credential identity listing is unavailable or incomplete');actual=page.data.find((r:any)=>r.id===e.id);if(actual||!page.nextCursor)break;if(typeof page.nextCursor!=='string'||page.nextCursor.length>4096||seen.has(page.nextCursor)||count===19)throw new HarnessError('EVIDENCE','Credential identity listing is incomplete or has a cursor cycle');const next=String(page.nextCursor);cursor=next;seen.add(next);}}
   if(!actual)throw new HarnessError('OWNERSHIP','Credential exact identity is unavailable');if(actual.id!==e.id||actual.name!==e.name)throw new HarnessError('OWNERSHIP','Credential exact name changed');try{await this.client.request('credentials/'+encodeURIComponent(e.id!),'DELETE');}catch(error){if(!(error instanceof ApiError&&error.status===404))throw error;}return;
  }
  if(e.kind==='workflow'){
   const local=this.manifest.entries.find(r=>r.workflowId===e.id);if(local?.state==='owned'){await super.cleanup({workflowId:e.id!,prepared:{} as any});return;}
  }
  await apiRecovery(this.client).remove(e);
 }
 async recover(testId?:string){const result=await recoverOwned(this.journal,this.journal.ownerIdentity,{remove:e=>this.removeResource(e)},testId);if(result.leftovers.length)throw new HarnessError('CLEANUP',`Recovery required: ${this.journal.path}; ${result.errors.join('; ')}`);}
 async cleanup(h:RuntimeHandle){const testId=this.#testIds.get(h.workflowId);await this.recover(testId);this.#auth.delete(h.workflowId);}
}
