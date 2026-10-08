import {it,expect} from 'vitest';import {normalizeSuite} from '../src/spec/normalized.js';import {plannedExecutions} from '../src/runtime/runner-v2.js';
it('rejects file intake with JSON stateful steps during schema validation',()=>{
 expect(()=>normalizeSuite({schemaVersion:2,name:'forms',tests:[{id:'one',workflow:'w.json',input:{kind:'file',fixture:'i.png',field:'receipt',mimeType:'image/png'},steps:[{id:'step',input:{kind:'json',fixture:'i.json'},assertions:[{target:'execution.status',equals:'success'}]}],mocks:[],assertions:[{target:'execution.status',equals:'success'}],verificationKind:'behavior'}]})).toThrow(/Stateful steps currently require JSON intake/);
});
it('retains terminal execution evidence when table collection fails in either phase',async()=>{
 const {loadSuiteDocument}=await import('../src/spec/load.js'),{compileSuiteV2,runCompiledV2}=await import('../src/runtime/runner-v2.js');
 for(const failAt of [1,2]){
  const {suite,base}=await loadSuiteDocument('examples/suites/correct.yaml'),test=suite.tests[0]!;
  test.tables=[{id:'records',columns:[{name:'key',type:'string'}],seedRows:[]}];
  test.steps=[{id:'repeat',input:test.input as {kind:'json';fixture:string},assertions:[{target:'execution.status',equals:'success'}]}];test.assertions=[{target:'execution.status',equals:'success'}];
  const compiled=await compileSuiteV2(suite,base);let iteration=0,cleaned=false;
  const adapter:any={importWorkflow:async(prepared:any)=>({workflowId:'owned',prepared}),activate:async()=>{},trigger:async()=>{iteration++;},observe:async()=>({id:String(iteration),workflowId:'owned',status:'success',nodes:{map:[{outputs:[[{email:'customer@example.test'}]]}]}}),tables:async()=>{if(iteration===failAt)throw Error('Incomplete native table evidence');return [{tableId:'records',rows:[]}];},cleanup:async()=>{cleaned=true;}};
  const gateway:any={register:async()=>({token:'synthetic-token'}),drain:async()=>{},snapshot:async()=>({requests:[],errors:[]}),seal:async()=>{}};
  const result=await runCompiledV2(suite,compiled,adapter,gateway,'http://gateway.test','run',AbortSignal.timeout(2000));
  expect(result.exitCode).toBe(2);expect(cleaned).toBe(true);expect(result.tests[0]!.evidence?.execution.id).toBe('1');
  if(failAt===2)expect(result.tests[0]!.steps?.[0]?.evidence.execution.id).toBe('2');
 }
});
it('preserves the original runtime error alongside an owned cleanup failure',async()=>{
 const {loadSuiteDocument}=await import('../src/spec/load.js'),{compileSuiteV2,runCompiledV2}=await import('../src/runtime/runner-v2.js');
 const {HarnessError}=await import('../src/security/errors.js');
 const {suite,base}=await loadSuiteDocument('examples/suites/correct.yaml'),compiled=await compileSuiteV2(suite,base);
 const adapter:any={importWorkflow:async(prepared:any)=>({workflowId:'owned',prepared}),activate:async()=>{},trigger:async()=>{throw new HarnessError('TRIGGER','Original submission failure');},cleanup:async()=>{throw Error('Owned cleanup failed');}};
 const gateway:any={register:async()=>({token:'synthetic-token'}),drain:async()=>{},snapshot:async()=>({requests:[],errors:[]}),seal:async()=>{}};
 const result=await runCompiledV2(suite,compiled,adapter,gateway,'http://gateway.test','run',AbortSignal.timeout(2000));
 expect(result.exitCode).toBe(2);expect(result.tests[0]!.error).toEqual({code:'TRIGGER',message:'Original submission failure'});
 expect(result.tests[0]!.cleanup).toMatchObject({status:'failed',workflowId:'owned',message:'Owned cleanup failed'});
});
it('counts replay steps and native child calls against the execution ceiling',()=>{
 const suite=normalizeSuite({schemaVersion:2,name:'replay',tests:[{id:'one',workflow:'workflow.json',input:{kind:'json',fixture:'input.json'},steps:[{id:'repeat',input:{kind:'json',fixture:'input.json'},assertions:[{target:'execution.status',equals:'success'}]}],subworkflows:[{nodeId:'child',expectedWorkflowId:'source',workflow:'child.json',triggerId:'input',trust:{sourceHash:'a'.repeat(64)},tableBindings:[]}],mocks:[],assertions:[{target:'execution.status',equals:'success'}],verificationKind:'behavior'}]});
 expect(plannedExecutions(suite.tests)).toBe(4);
});
it('rejects unknown stateful table/mock assertions before any runtime can start',()=>{
 for(const assertion of [{target:'table.count',tableId:'missing',equals:0},{target:'requests.count',mockId:'missing',equals:0}]){
  expect(()=>normalizeSuite({schemaVersion:2,name:'invalid',tests:[{id:'one',workflow:'workflow.json',input:{kind:'json',fixture:'input.json'},steps:[{id:'step',input:{kind:'json',fixture:'input.json'},assertions:[{target:'execution.status',equals:'success'},assertion]}],mocks:[],assertions:[{target:'execution.status',equals:'success'}],verificationKind:'behavior'}]})).toThrow(/Unknown assertion/);
 }
});
it('keeps earlier request windows intact and detects late requests in the last step',async()=>{
 const {loadSuiteDocument}=await import('../src/spec/load.js'),{compileSuiteV2,runCompiledV2}=await import('../src/runtime/runner-v2.js');
 const {suite,base}=await loadSuiteDocument('examples/suites/correct.yaml');const test=suite.tests[0]!;
 test.steps=[{id:'repeat',input:test.input,assertions:[{target:'execution.status',equals:'success'},{target:'requests.count',mockId:test.mocks[0]!.id,equals:1}]}];
 const compiled=await compileSuiteV2(suite,base),requests:any[]=[];let iteration=0;
 const adapter:any={importWorkflow:async(prepared:any)=>({workflowId:'owned',prepared}),activate:async()=>{},trigger:async()=>{iteration++;requests.push({mockId:test.mocks[0]!.id,method:'POST',path:'/contacts',headers:{},body:'{}',json:{email:'correct@example.test'},unexpected:false,receivedAt:'2026-10-08'});},observe:async()=>({id:String(iteration),workflowId:'owned',status:'success',nodes:{map:[{outputs:[[{email:'customer@example.test'}]]}]}}),cleanup:async()=>{}};
 test.assertions=[{target:'execution.status',equals:'success'},{target:'requests.count',mockId:test.mocks[0]!.id,equals:1}];
 let sealed=false;const gateway:any={register:async()=>({token:'synthetic-token'}),drain:async()=>{},snapshot:async()=>({requests:structuredClone(requests),errors:[]}),seal:async()=>{if(!sealed){sealed=true;requests.push({mockId:test.mocks[0]!.id,method:'POST',path:'/contacts',headers:{},body:'{}',unexpected:true,receivedAt:'2026-10-08'});}}};
 const result=await runCompiledV2(suite,compiled,adapter,gateway,'http://gateway.test','run',AbortSignal.timeout(2000));
 expect(result.tests[0]!.assertions.every(a=>a.passed)).toBe(true);
 expect(result.tests[0]!.steps![0]!.assertions.some(a=>a.target==='requests.unexpected'&&!a.passed)).toBe(true);
 expect(result.exitCode).toBe(1);
});
it('reserves every possible DAG path to a child call before applying the execution ceiling',()=>{
 const test=normalizeSuite({schemaVersion:2,name:'branch',tests:[{id:'one',workflow:'w.json',input:{kind:'json',fixture:'i.json'},subworkflows:[{nodeId:'call',expectedWorkflowId:'source',workflow:'child.json',triggerId:'input',trust:{sourceHash:'a'.repeat(64)},tableBindings:[]}],mocks:[],assertions:[{target:'execution.status',equals:'success'}],verificationKind:'behavior'}]}).tests[0]!;
 const source=JSON.stringify({nodes:[{id:'input',name:'input',type:'n8n-nodes-base.webhook'},{id:'left',name:'left'},{id:'right',name:'right'},{id:'call',name:'call'}],connections:{input:{main:[[{node:'left',type:'main',index:0},{node:'right',type:'main',index:0}]]},left:{main:[[{node:'call',type:'main',index:0}]]},right:{main:[[{node:'call',type:'main',index:0}]]}}});
 expect(plannedExecutions([test],[source])).toBe(3);
});
