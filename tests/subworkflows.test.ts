import {it,expect,vi} from 'vitest';
// This unit API registers synchronously; real Docker tests exercise publication settling.
vi.mock('node:timers/promises',()=>({setTimeout:async()=>{}}));import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {normalizeSuite} from '../src/spec/normalized.js';import {compileSuiteV2,prepareCompiledTest} from '../src/runtime/runner-v2.js';import {sha256} from '../src/spec/load.js';import {N8nApiAdapter} from '../src/adapters/n8n-api/index.js';import {Manifest} from '../src/runtime/manifest.js';import {ResourceJournal} from '../src/runtime/journal.js';
const node=(id:string,type:string,version:number,parameters:any)=>({id,name:id,type:'n8n-nodes-base.'+type,typeVersion:version,position:[0,0],parameters});
it('imports reviewed child copies first and binds the parent only to the owned child ID',async()=>{
 const root=await mkdtemp(join(tmpdir(),'child-workflow-'));
 const input=node('input','webhook',2,{httpMethod:'POST',path:'original',responseMode:'onReceived',options:{}});
 const child=JSON.stringify({name:'Child',nodes:[input,node('child-input','executeWorkflowTrigger',1.1,{inputSource:'passthrough'}),node('result','noOp',1,{})],connections:{input:{main:[[{node:'result',type:'main',index:0}]]},'child-input':{main:[[{node:'result',type:'main',index:0}]]}}});
 const parent=JSON.stringify({name:'Parent',nodes:[input,node('call','executeWorkflow',1.3,{source:'database',workflowId:{__rl:true,mode:'id',value:'private-source-id'},mode:'once',options:{waitForSubWorkflow:true},workflowInputs:{mappingMode:'passThrough',value:{},matchingColumns:[],schema:[],attemptToConvertTypes:false,convertFieldsToString:false}})],connections:{input:{main:[[{node:'call',type:'main',index:0}]]}}});
 try{
  await writeFile(join(root,'parent.json'),parent);await writeFile(join(root,'child.json'),child);await writeFile(join(root,'input.json'),'{}');
  const suite=normalizeSuite({schemaVersion:2,name:'child',tests:[{id:'child',workflow:'parent.json',input:{kind:'json',fixture:'input.json'},subworkflows:[{nodeId:'call',expectedWorkflowId:'private-source-id',workflow:'child.json',triggerId:'input',trust:{sourceHash:sha256(child)},tableBindings:[]}],mocks:[],assertions:[{target:'execution.status',equals:'success'}],verificationKind:'behavior'}]});
  const compiled=await compileSuiteV2(suite,root,root),prepared=prepareCompiledTest(compiled[0]!,'http://gateway.test','run','token');
  expect(prepared.resources!.subworkflows![0]!.prepared.workflow.nodes.find(n=>n.id==='input')?.disabled).toBe(true);
  expect(prepared.resources!.subworkflows![0]!.prepared.workflow.nodes.find(n=>n.id==='child-input')?.disabled).not.toBe(true);
  for(const entryMode of ['missing','disabled','multiple']){
   const changed=JSON.parse(child);const entry=changed.nodes.find((n:any)=>n.id==='child-input');
   if(entryMode==='missing')changed.nodes=changed.nodes.filter((n:any)=>n.id!=='child-input');
   else if(entryMode==='disabled')entry.disabled=true;
   else changed.nodes.push({...entry,id:'second-entry',name:'second-entry'});
   const altered=structuredClone(compiled[0]!);altered.subworkflowSources![0]=JSON.stringify(changed);altered.spec.subworkflows[0]!.trust.sourceHash=sha256(altered.subworkflowSources![0]!);
   expect(()=>prepareCompiledTest(altered,'http://gateway.test','run','token')).toThrow(/exactly one enabled native subworkflow entry/);
  }
  const created:any[]=[];let childPublished=false;const client:any={baseUrl:'http://127.0.0.1:5678',request:async(path:string,method:string,body:any)=>{if(path==='workflows/owned-child/activate'&&method==='POST'){childPublished=true;return {active:true};}if(path!=='workflows'||method!=='POST')throw Error('unexpected API operation');created.push(body);return {id:created.length===1?'owned-child':'owned-parent',name:body.name};}};
  const adapter=new N8nApiAdapter(client,new Manifest(root,'run',client.baseUrl),new ResourceJournal(root,'run','docker:fake'),{managedDocker:true,parentId:'owned-volume'});
  const handle=await adapter.importWorkflow(prepared,'run','child',AbortSignal.timeout(2000));
  expect(childPublished).toBe(true);expect(handle.prepared.workflow.nodes.find(n=>n.id==='call')?.parameters.workflowId.value).toBe('owned-child');expect(created).toHaveLength(2);expect(created[0].name).toContain('child-0');
  const unqualified=new N8nApiAdapter(client,new Manifest(root,'cloud',client.baseUrl),new ResourceJournal(root,'cloud',client.baseUrl));
  await expect(unqualified.importWorkflow(prepared,'cloud','child')).rejects.toThrow(/managed Docker/);
  suite.tests[0]!.subworkflows[0]!.trust.sourceHash='a'.repeat(64);await expect(compileSuiteV2(suite,root,root)).rejects.toThrow(/hash changed/);
 }finally{await rm(root,{recursive:true,force:true});}
});
it('rejects child native model transport before startup until its credentials/routes are qualified',()=>{
 const child=JSON.stringify({name:'child model',nodes:[node('input','webhook',2,{httpMethod:'POST',path:'original',responseMode:'onReceived',options:{}}),{...node('model','noOp',1,{}),type:'@n8n/n8n-nodes-langchain.lmChatOpenAi',typeVersion:1.3}],connections:{}});
 const compiled:any={sourceSchemaVersion:2,source:JSON.stringify({name:'parent',nodes:[node('input','webhook',2,{httpMethod:'POST',path:'original',responseMode:'onReceived',options:{}}),node('call','executeWorkflow',1.3,{source:'database',workflowId:{__rl:true,mode:'id',value:'source'},mode:'once',options:{waitForSubWorkflow:true},workflowInputs:{mappingMode:'passThrough',value:{},matchingColumns:[],schema:[],attemptToConvertTypes:false,convertFieldsToString:false}})],connections:{input:{main:[[{node:'call',type:'main',index:0}]]}}}),subworkflowSources:[child],spec:normalizeSuite({schemaVersion:2,name:'model',tests:[{id:'one',workflow:'parent.json',input:{kind:'json',fixture:'i.json'},subworkflows:[{nodeId:'call',expectedWorkflowId:'source',workflow:'child.json',triggerId:'input',trust:{sourceHash:sha256(child)},tableBindings:[]}],mocks:[],assertions:[{target:'execution.status',equals:'success'}],verificationKind:'behavior'}]}).tests[0]};
 expect(()=>prepareCompiledTest(compiled,'http://gateway.test','run','token')).toThrow(/child.*model.*qualified/i);
});
