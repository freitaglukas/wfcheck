import type {OwnedRecord} from '../../runtime/journal.js';import {HarnessError} from '../../security/errors.js';import {ApiError,type CloudClient} from '../n8n-cloud/client.js';
export function apiRecovery(client:Pick<CloudClient,'request'>){return {async remove(e:OwnedRecord){
 if(e.kind==='credential')throw new HarnessError('CAPABILITY','Credential recovery requires a qualified exact-identity reader; an unsupported lookup must not be treated as absence');
 if(!e.id)throw new HarnessError('OWNERSHIP','No exact ID');const plural={workflow:'workflows',execution:'executions',table:'data-tables',credential:'credentials'}[e.kind as 'workflow'];if(!plural)throw new HarnessError('CLEANUP','Resource requires its recorded Docker runtime');const path=plural+'/'+encodeURIComponent(e.id);
 try{
  const raw=await client.request(path);const data=e.kind==='execution'?raw:raw?.data??raw;
  if(e.kind==='execution'){if(String(data.workflowId)!==e.parentId)throw new HarnessError('OWNERSHIP','Execution parent changed');if(!['success','error','crashed','canceled'].includes(data.status))await client.request(path+'/stop','POST');}
  else if(data.name!==e.name)throw new HarnessError('OWNERSHIP','Resource exact name changed; refusing cleanup');
  if(e.kind==='workflow'&&data.active)await client.request(path+'/deactivate','POST');
  await client.request(path,'DELETE');
 }catch(error){if(!(error instanceof ApiError&&error.status===404))throw error;}
}};}
