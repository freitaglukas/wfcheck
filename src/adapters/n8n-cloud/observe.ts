import type { ExecutionObservation, Workflow, NodeRun } from '../../runtime/types.js';
import { HarnessError } from '../../security/errors.js';
export const terminal=new Set(['success','error','canceled','crashed']);
export function runData(execution:any):any {return execution.data?.resultData?.runData;}
export function normalizeExecution(raw:any,workflow:Workflow):ExecutionObservation {
  if(!raw.id||!raw.workflowId||!terminal.has(raw.status)||(!raw.stoppedAt&&raw.finished!==true))throw new HarnessError('EVIDENCE','Missing terminal execution identity/completion evidence');
  const data=runData(raw);
  if(!data||typeof data!=='object'||Array.isArray(data)||!Object.keys(data).length)throw new HarnessError('EVIDENCE','Saved execution runData is missing, redacted or unavailable; enable saved success/error execution data for the project copy');
  const nodes:Record<string,NodeRun[]>={};
  for(const n of workflow.nodes){
    if(!Object.hasOwn(data,n.name))continue;
    if(!Array.isArray(data[n.name])||!data[n.name].length)throw new HarnessError('EVIDENCE',`Invalid node run evidence for ${n.name}`);
    nodes[n.id]=data[n.name].map((r:any)=>{
      if(!r.data?.main){if(r.error)return {outputs:[],error:r.error};throw new HarnessError('EVIDENCE',`Missing node output evidence for ${n.name}`);}
      if(!Array.isArray(r.data.main))throw new HarnessError('EVIDENCE','Invalid output evidence');
      return {outputs:r.data.main.map((items:any)=>{if(!Array.isArray(items))throw new HarnessError('EVIDENCE','Missing output branch data');return items.map((item:any)=>{if(!item||!Object.hasOwn(item,'json'))throw new HarnessError('EVIDENCE','Missing item JSON evidence');return item.json;});}),error:r.error};
    });
  }
  return {id:String(raw.id),workflowId:String(raw.workflowId),status:raw.status,nodes};
}
