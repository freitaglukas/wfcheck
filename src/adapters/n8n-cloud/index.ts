import {requireActive} from '../../runtime/cancellation.js';
import { setTimeout as delay } from 'node:timers/promises';
import type { RuntimeAdapter,RuntimeHandle,PreparedWorkflow,ExecutionObservation,CompiledInput,TriggerAttempt } from '../../runtime/types.js';
import { Manifest } from '../../runtime/manifest.js';
import { HarnessError } from '../../security/errors.js';
import { CloudClient,ApiError } from './client.js';
import {executionMarker,selectCorrelated} from '../n8n-api/observe.js';
import {submitTrigger} from '../n8n-api/trigger.js';
import { normalizeExecution,runData,terminal } from './observe.js';
export class N8nCloudAdapter implements RuntimeAdapter {
  private publishPath='activate';
  private unpublishPath='deactivate';
  constructor(readonly client:CloudClient,readonly manifest:Manifest,private policy:{managedDocker?:boolean}={}){}
  async doctor():Promise<unknown>{
    const discovery=await this.client.request('discover');const resources=discovery?.data?.resources;
    const requirements:Record<string,string[]>={workflow:['createWorkflow','getWorkflow','deleteWorkflow','activateWorkflow','deactivateWorkflow'],executions:['getExecutions','getExecution','deleteExecution',...(this.policy.managedDocker?[]:['stopExecution'])]};
    for(const [resource,ops] of Object.entries(requirements))for(const op of ops)if(!resources?.[resource]?.endpoints?.some((e:any)=>e.operationId===op))throw new HarnessError('CAPABILITY',`Required public API capability unavailable: ${op}`);
    if(resources.workflow.endpoints.some((e:any)=>e.operationId==='publishWorkflow'))this.publishPath='publish';
    if(resources.workflow.endpoints.some((e:any)=>e.operationId==='unpublishWorkflow'))this.unpublishPath='unpublish';
    await this.client.request('workflows?limit=1');await this.client.request('executions?limit=1&includeData=true');
    return {executionStop:this.policy.managedDocker?'runtime teardown only':'public API',authentication:'verified',publicApi:'discovery verified',capabilities:requirements,runtimeVersion:'not exposed by these documented public APIs',executionData:'Saving/accessibility verified per real run; doctor performs no execution',writes:'Advertised by authenticated discovery; doctor performs no writes'};
  }
  async importWorkflow(prepared:PreparedWorkflow,runId:string,testId:string,signal?:AbortSignal):Promise<RuntimeHandle>{
    requireActive(signal);const entry=await this.manifest.begin(testId,prepared.workflow.name);
    requireActive(signal);const created=await this.client.request('workflows','POST',prepared.workflow,signal);
    if(typeof created?.id!=='string'||created.name!==entry.name)throw new HarnessError('OWNERSHIP','Create outcome lacks exact identity; inspect manifest intent before recovery');
    entry.workflowId=created.id;entry.state='owned';
    try{await this.manifest.save();}catch{try{await this.client.request('workflows/'+encodeURIComponent(created.id),'DELETE');entry.state='cleaned';}catch{}throw new HarnessError('OWNERSHIP',`Failed to persist ownership for workflow ${created.id}; verify cleanup manually`);}
    return {workflowId:created.id,versionId:created.versionId,prepared};
  }
  async activate(h:RuntimeHandle,signal?:AbortSignal):Promise<void>{
    this.manifest.owned(h.workflowId);const result=await this.client.request(`workflows/${encodeURIComponent(h.workflowId)}/${this.publishPath}`,'POST',h.versionId?{versionId:h.versionId}:undefined,signal);
    if(result?.active!==true)throw new HarnessError('CAPABILITY','Public API publication did not confirm active workflow');
    // Cloud registration is asynchronous: verified minimum settling time, not a readiness guarantee.
    await delay(3000,undefined,{signal});
  }
  async trigger(h:RuntimeHandle,input:Record<string,unknown>|CompiledInput,marker:string,signal:AbortSignal):Promise<void|TriggerAttempt>{
    if((input as CompiledInput).kind==='json')return submitTrigger(this.client.baseUrl,h,input as CompiledInput,marker,signal);
    this.manifest.owned(h.workflowId);const url=this.client.baseUrl+'/webhook/'+h.prepared.webhookPath;
    let r:Response;try{r=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-wfcheck-correlation':marker,'x-wfcheck-run':this.manifest.runId},body:JSON.stringify(input),redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});}
    catch{throw new HarnessError('TRIGGER','Webhook transport failed; trigger is never retried to avoid duplicate paid executions');}
    await r.body?.cancel();if(!r.ok)throw new HarnessError('TRIGGER',`Webhook returned HTTP ${r.status}; this is not an expected workflow error`);
  }
  async observe(h:RuntimeHandle,marker:string,signal:AbortSignal):Promise<ExecutionObservation>{
    const entry=this.manifest.owned(h.workflowId);let matched:string|undefined;
    for(let poll=0;poll<120&&!signal.aborted;poll++){
      const list=await this.client.request(`executions?workflowId=${encodeURIComponent(h.workflowId)}&includeData=true&limit=25`,'GET',undefined,signal);
      if(!Array.isArray(list?.data)||list.nextCursor)throw new HarnessError('CORRELATION','Execution listing is malformed or exceeds the bounded correlation window');
      const candidate=selectCorrelated(list.data,h,marker);if(candidate){if(matched&&matched!==candidate)throw new HarnessError('CORRELATION','Multiple executions contain the marker');matched=candidate;if(!entry.executionIds.includes(matched)){entry.executionIds.push(matched);await this.manifest.save();await this.recordCorrelation(h,matched);}}
      if(matched){const raw=await this.client.request(`executions/${encodeURIComponent(matched)}?includeData=true`,'GET',undefined,signal);if(String(raw.workflowId)!==h.workflowId||!executionMarker(raw,h,marker))throw new HarnessError('CORRELATION','Execution detail does not match workflow and marker');if(terminal.has(raw.status))return normalizeExecution(raw,h.prepared.workflow);}
      await delay(750,undefined,{signal}).catch(()=>{});
    }
    if(!matched)throw new HarnessError('EVIDENCE','No saved execution with the required workflow/marker was available within the deadline. Verify execution saving, API data access and runtime completion; webhook acceptance alone is insufficient.');
    throw new HarnessError('TIMEOUT','Correlated execution did not complete within the bounded timeout');
  }
  protected async recordCorrelation(_h:RuntimeHandle,_id:string):Promise<void>{}
  async cleanup(h:RuntimeHandle):Promise<void>{
    const entry=this.manifest.owned(h.workflowId);const id=encodeURIComponent(h.workflowId);const signal=AbortSignal.timeout(30000);
    let raw:any;
    try{raw=await this.client.request(`workflows/${id}`,'GET',undefined,signal);}catch(error){
      if(!(error instanceof ApiError&&error.status===404))throw error;
      // Exact recorded IDs are still checked, even if the workflow deletion succeeded before a crash.
      for(const eid of entry.executionIds)try{
        const e=await this.client.request(`executions/${encodeURIComponent(eid)}`,'GET',undefined,signal);
        if(String(e.workflowId)!==h.workflowId)throw new HarnessError('OWNERSHIP','Recorded execution belongs to another workflow');
        await this.client.request(`executions/${encodeURIComponent(eid)}`,'DELETE',undefined,signal);
      }catch(error){if(!(error instanceof ApiError&&error.status===404))throw error;}
      entry.state='cleaned';await this.manifest.save();return;
    }
    if(raw.name!==entry.name)throw new HarnessError('OWNERSHIP',`Workflow ${h.workflowId} no longer has its recorded exact name; refusing cleanup`);
    await this.client.request(`workflows/${id}/${this.unpublishPath}`,'POST',undefined,signal);
    const executions=await this.client.request(`executions?workflowId=${id}&limit=25`,'GET',undefined,signal);
    if(!Array.isArray(executions?.data)||executions.nextCursor)throw new HarnessError('CLEANUP',`Too many executions to clean workflow ${h.workflowId}`);
    for(const e of executions.data){
      if(String(e.workflowId)!==h.workflowId)throw new HarnessError('OWNERSHIP','Cleanup execution belongs to another workflow');
      const eid=String(e.id);if(!entry.executionIds.includes(eid)){entry.executionIds.push(eid);await this.manifest.save();}
      if(!terminal.has(e.status)){
        await this.client.request(`executions/${encodeURIComponent(eid)}/stop`,'POST',undefined,signal);
        let stopped=false;for(let i=0;i<10;i++){const current=await this.client.request(`executions/${encodeURIComponent(eid)}`,'GET',undefined,signal);if(terminal.has(current.status)){stopped=true;break;}await delay(500,undefined,{signal});}
        if(!stopped)throw new HarnessError('CLEANUP',`Execution ${eid} did not stop within the cleanup bound`);
      }
      try{await this.client.request(`executions/${encodeURIComponent(eid)}`,'DELETE',undefined,signal);}catch(error){if(!(error instanceof ApiError&&error.status===404))throw error;}
    }
    for(let attempt=0;attempt<4;attempt++){
      try{await this.client.request(`workflows/${id}`,'DELETE',undefined,signal);break;}catch(error){
        if(error instanceof ApiError&&error.status===404)break;
        if(!(error instanceof ApiError&&error.status===409)||attempt===3)throw error;
        await delay(1000,undefined,{signal});const current=await this.client.request(`workflows/${id}`,'GET',undefined,signal);
        if(current.name!==entry.name)throw new HarnessError('OWNERSHIP','Workflow ownership changed during cleanup retry');
      }
    }
    entry.state='cleaned';await this.manifest.save();
  }
}
