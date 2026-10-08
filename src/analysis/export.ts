import {HarnessError} from '../security/errors.js';
import type {Workflow} from '../runtime/types.js';
export function object(value:unknown):value is Record<string,any>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
export const metadata=new Set(['id','description','active','activeVersionId','createdAt','updatedAt','isArchived','versionId','versionCounter','sourceWorkflowId','triggerCount','nodeGroups','shared','activeVersion','versionMetadata','meta','tags','pinData','staticData']);
export function parseExport(source:string):Record<string,any>{
 if(Buffer.byteLength(source)>1024*1024)throw new HarnessError('CONFIG','Workflow export exceeds 1 MiB');
 let raw:unknown;try{raw=JSON.parse(source);}catch{throw new HarnessError('CONFIG','Invalid workflow JSON');}
 if(!object(raw)||!Array.isArray(raw.nodes)||raw.nodes.length<1||raw.nodes.length>500)throw new HarnessError('CONFIG','Workflow must contain 1-500 nodes');
 return raw;
}
export function projectWorkflow(source:string):Workflow{
 const raw=parseExport(source);
 for(const field of ['pinData','staticData'])if(raw[field]!=null&&(!object(raw[field])||Object.keys(raw[field]).length))throw new HarnessError('UNSUPPORTED','Pinned or static state is unsupported');
 const unknown=Object.keys(raw).filter(k=>!metadata.has(k)&&!['name','nodes','connections','settings'].includes(k));
 if(unknown.length)throw new HarnessError('UNSUPPORTED','Unknown runtime export fields');
 if(typeof raw.name!=='string'||!object(raw.connections))throw new HarnessError('CONFIG','Invalid workflow runtime fields');
 return structuredClone({name:raw.name,nodes:raw.nodes,connections:raw.connections,settings:raw.settings??{}}) as Workflow;
}
