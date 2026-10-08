import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {normalizeSuite} from '../../src/spec/normalized.js';
import {sha256} from '../../src/spec/load.js';
import {compileSuiteV2,runCompiledV2} from '../../src/runtime/runner-v2.js';
import {createRuntime,type RuntimeSession} from '../../src/runtime/factory.js';

it('executes an owned native-only child and returns its data to the parent',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wfcheck-native-child-'));
 let session:RuntimeSession|undefined;
 const node=(id:string,type:string,typeVersion:number,parameters:unknown)=>({id,name:id,type:'n8n-nodes-base.'+type,typeVersion,position:[0,0],parameters});
 const child=JSON.stringify({name:'Native child',nodes:[
  node('entry','executeWorkflowTrigger',1.1,{inputSource:'passthrough'}),
  node('result','noOp',1,{}),
 ],connections:{entry:{main:[[{node:'result',type:'main',index:0}]]}}});
 const parent=JSON.stringify({name:'Parent',nodes:[
  node('input','webhook',2,{httpMethod:'POST',path:'source',responseMode:'onReceived',options:{}}),
  node('call','executeWorkflow',1.3,{source:'database',workflowId:{__rl:true,mode:'id',value:'source-child'},mode:'once',options:{waitForSubWorkflow:true},workflowInputs:{mappingMode:'passThrough',value:{},matchingColumns:[],schema:[],attemptToConvertTypes:false,convertFieldsToString:false}}),
 ],connections:{input:{main:[[{node:'call',type:'main',index:0}]]}}});
 try{
  await writeFile(join(root,'parent.json'),parent);
  await writeFile(join(root,'child.json'),child);
  await writeFile(join(root,'input.json'),'{"value":7}');
  const suite=normalizeSuite({schemaVersion:2,name:'Native child',tests:[{
   id:'native-child',workflow:'parent.json',input:{kind:'json',fixture:'input.json'},
   subworkflows:[{nodeId:'call',expectedWorkflowId:'source-child',workflow:'child.json',triggerId:'entry',trust:{sourceHash:sha256(child)},tableBindings:[]}],
   mocks:[],assertions:[{target:'execution.status',equals:'success'},{target:'node.json',nodeId:'call',pointer:'/body/value',equals:7}],verificationKind:'behavior',
  }]});
  const compiled=await compileSuiteV2(suite,root,root);
  session=await createRuntime({runtime:'docker',stateDirectory:join(root,'state')},AbortSignal.timeout(180000));
  const result=await runCompiledV2(suite,compiled,session.adapter,session.gateway,session.gatewayUrl,'native-child-proof',AbortSignal.timeout(120000));
  expect(result.exitCode,JSON.stringify(result)).toBe(0);
  expect(result.plannedExecutions).toBe(2);
  expect(result.tests[0]?.evidence?.execution.nodes.call?.[0]?.outputs[0]?.[0]).toMatchObject({body:{value:7}});
  expect(session.journal.leftovers().filter(e=>['workflow','execution','credential','table'].includes(e.kind))).toEqual([]);
  console.log('Native child Docker proof:',JSON.stringify({runtime:session.capabilities.version,execution:result.tests[0]?.evidence?.execution.id,request:{value:7},output:result.tests[0]?.evidence?.execution.nodes.call?.[0]?.outputs[0]?.[0],exitCode:result.exitCode,cleanup:result.tests[0]?.cleanup.status}));
 }finally{
  await session?.close();
  if(session && !session.journal.leftovers().length)await rm(root,{recursive:true,force:true});
 }
});
