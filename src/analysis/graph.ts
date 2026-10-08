import type {Diagnostic,TypedEdge,TriggerAnalysis} from './types.js';
import {object} from './export.js';
export function inventoryGraph(raw:Record<string,any>,diagnostics:Diagnostic[],triggers:TriggerAnalysis[]):TypedEdge[]{
 const byName=new Map<string,string>();for(const [i,n]of raw.nodes.entries())if(object(n)&&typeof n.name==='string')byName.set(n.name,typeof n.id==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(n.id)&&!['constructor','prototype','__proto__'].includes(n.id)?n.id:'node-'+i);
 const edges:TypedEdge[]=[];
 if(!object(raw.connections)){diagnostics.push({code:'INVALID_CONNECTIONS',severity:'error',summary:'Connections must be an object'});return edges;}
 for(const [name,groups]of Object.entries(raw.connections)){
  const from=byName.get(name);
  if(!from||!object(groups)){diagnostics.push({code:'MISSING_SOURCE',severity:'error',summary:'Connection source is missing or malformed'});continue;}
  for(const [type,outputs]of Object.entries(groups)){
   if(!Array.isArray(outputs)){diagnostics.push({code:'INVALID_EDGE',severity:'error',nodeId:from,summary:'Connection outputs must be arrays'});continue;}
   if(!['main','ai_languageModel','ai_memory','ai_tool','ai_outputParser','ai_retriever','ai_document','ai_embedding','ai_vectorStore'].includes(type))diagnostics.push({code:'CONNECTION_UNSUPPORTED',severity:'error',nodeId:from,summary:'Connection type is not supported for execution'});
   outputs.forEach((output,outputIndex)=>{
    if(!Array.isArray(output)){diagnostics.push({code:'INVALID_EDGE',severity:'error',nodeId:from,summary:'Malformed output branch'});return;}
    for(const e of output){
     const to=object(e)&&typeof e.node==='string'?byName.get(e.node):undefined;
     if(!to){diagnostics.push({code:'MISSING_TARGET',severity:'error',nodeId:from,summary:'Connection target is missing'});continue;}
     if(!Number.isInteger(e.index)||e.index<0||e.type!==type){diagnostics.push({code:'INVALID_EDGE',severity:'error',nodeId:from,summary:'Connection type/index is invalid'});continue;}
     edges.push({from,to,connectionType:type,outputIndex,inputIndex:e.index});
    }
   });
  }
 }
 const visited=new Set<string>(),active=new Set<string>();
 function visit(id:string){if(active.has(id)){diagnostics.push({code:'GRAPH_CYCLE',severity:'error',nodeId:id,summary:'Main execution graph contains a cycle'});return;}if(visited.has(id))return;visited.add(id);active.add(id);for(const e of edges)if(e.from===id&&e.connectionType==='main')visit(e.to);active.delete(id);}
 for(const id of byName.values())visit(id);
 if(triggers.length===1){const reachable=new Set<string>();const pending=[triggers[0]!.nodeId];while(pending.length){const id=pending.pop()!;if(reachable.has(id))continue;reachable.add(id);for(const e of edges){if(e.from===id)pending.push(e.to);if(e.to===id&&e.connectionType!=='main')pending.push(e.from);}}for(const id of byName.values())if(!reachable.has(id))diagnostics.push({code:'DISCONNECTED_NODE',severity:'error',nodeId:id,summary:'Node is disconnected from the selected trigger'});}
 return edges;
}
