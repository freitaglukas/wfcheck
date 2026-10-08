import {it,expect} from 'vitest';
import {prepareV2Workflow} from '../src/security/bindings.js';
import {normalizeSuite} from '../src/spec/normalized.js';
import {sha256} from '../src/spec/load.js';
const n=(id:string,type:string,version:number,parameters:any,extra:any={})=>({id,name:id,type:'n8n-nodes-base.'+type,typeVersion:version,position:[0,0],parameters,...extra});
const expression="={{ $('context').first().json.table }}";
const make=()=>JSON.stringify({name:'Native tables with alternate triggers',nodes:[
 n('input','webhook',2,{httpMethod:'POST',path:'original',authentication:'headerAuth',responseMode:'lastNode',options:{}},{credentials:{httpHeaderAuth:{id:'original-private',name:'Original'}}}),
 n('schedule','scheduleTrigger',1.2,{rule:{interval:[{field:'cronExpression',expression:'0 30 7 * * 1-5'}]}},{disabled:false}),
 n('context','code',2,{mode:'runOnceForAllItems',jsCode:'return $input.all(); //'+ ' '.repeat(70000)}),
 n('read','dataTable',1.1,{resource:'row',operation:'get',dataTableId:{__rl:true,value:expression,mode:'id'},returnAll:false,limit:1001,matchType:'allConditions',filters:{conditions:[]}}),
 n('write','dataTable',1.1,{resource:'row',operation:'update',dataTableId:{__rl:true,value:expression,mode:'id'},matchType:'allConditions',filters:{conditions:[{keyName:'key',condition:'eq',keyValue:'={{ $json.key }}'}]},columns:{mappingMode:'defineBelow',value:{value:'={{ $json.value }}'},matchingColumns:[],schema:[]},options:{}})
 ],connections:{input:{main:[[{node:'context',type:'main',index:0}]]},schedule:{main:[[{node:'context',type:'main',index:0}]]},context:{main:[[{node:'read',type:'main',index:0}]]},read:{main:[[{node:'write',type:'main',index:0}]]}}});
const spec=(source:string)=>normalizeSuite({schemaVersion:2,name:'test',tests:[{id:'test',workflow:'source.json',input:{kind:'json',fixture:'input.json'},triggerId:'input',trust:{sourceHash:sha256(source),reviewedExpressions:true,reviewedCode:[{nodeId:'context',codeHash:sha256(JSON.parse(source).nodes[2].parameters.jsCode),noExternalEffects:true}]},tables:[{id:'records',columns:[{name:'key',type:'string'},{name:'value',type:'string'}]}],tableBindings:['read','write'].map(nodeId=>({nodeId,expectedResourceId:expression,tableId:'records'})),mocks:[],assertions:[{target:'execution.status',equals:'success'}],verificationKind:'behavior'}]}).tests[0]!;
it('isolates exact dynamic table bindings and prevents scheduled execution without changing source',()=>{
 const source=make(),test=spec(source),prepared=prepareV2Workflow(source,test,'http://gateway.test','run','test','token');
 expect(prepared.workflow.nodes.find(n=>n.id==='schedule')?.disabled).toBe(true);
 expect(JSON.parse(source).nodes[1].disabled).toBe(false);
 expect(prepared.workflow.nodes.find(n=>n.id==='input')?.credentials).toBeUndefined();
 expect(prepared.workflow.nodes.find(n=>n.id==='input')?.parameters.authentication).toBe('none');
 expect(prepared.resources?.bindings).toHaveLength(2);
});
it('rejects changed resource expressions and unreviewed nontrivial expressions',()=>{
 const source=make(),test=spec(source);test.tableBindings[0]!.expectedResourceId='some other expression';
 expect(()=>prepareV2Workflow(source,test,'http://gateway.test','run','test','token')).toThrow(/Exact table binding/);
 const unreviewed=spec(source);delete unreviewed.trust!.reviewedExpressions;
 expect(()=>prepareV2Workflow(source,unreviewed,'http://gateway.test','run','test','token')).toThrow(/expressions.*review/i);
});
it('never accepts a schedule as a synthetic trigger and requires exact source pins',()=>{
 const source=make(),test=spec(source);test.triggerId='schedule';
 expect(()=>prepareV2Workflow(source,test,'http://gateway.test','run','test','token')).toThrow(/trigger/i);
 test.triggerId='input';test.trust!.sourceHash='a'.repeat(64);
 expect(()=>prepareV2Workflow(source,test,'http://gateway.test','run','test','token')).toThrow(/hash changed/);
});
it('validates disabled flags as booleans and enforces Code size in UTF-8 bytes',()=>{
 const malformed=JSON.parse(make());malformed.nodes[2].disabled='false';const source=JSON.stringify(malformed);
 expect(()=>prepareV2Workflow(source,spec(source),'http://gateway.test','run','test','token')).toThrow();
 const oversized=JSON.parse(make());oversized.nodes[2].parameters.jsCode='return $input.all(); //'+ '€'.repeat(100000);const unicode=JSON.stringify(oversized);
 expect(Buffer.byteLength(oversized.nodes[2].parameters.jsCode)).toBeGreaterThan(262144);
 expect(()=>prepareV2Workflow(unicode,spec(unicode),'http://gateway.test','run','test','token')).toThrow(/256 KiB/);
});
it('substitutes only an explicitly pinned Gmail send boundary and retains its message fields',()=>{
 const parameters={resource:'message',operation:'send',sendTo:'owner@example.test',subject:'Synthetic message',emailType:'text',message:'Synthetic test content',options:{appendAttribution:false}};
 const source=JSON.stringify({name:'Mail boundary',nodes:[n('input','webhook',2,{httpMethod:'POST',path:'test',responseMode:'onReceived',options:{}}),n('send','gmail',2.1,parameters,{credentials:{gmailOAuth2:{id:'private-source'}}})],connections:{input:{main:[[{node:'send',type:'main',index:0}]]}}});
 const test=normalizeSuite({schemaVersion:2,name:'test',tests:[{id:'mail',workflow:'source.json',input:{kind:'json',fixture:'input.json'},nodeMocks:[{nodeId:'send',expectedParametersHash:sha256(JSON.stringify(parameters)),mockPath:'/mail'}],mocks:[{id:'mail',method:'POST',path:'/mail',responses:[{kind:'json',status:200,json:{id:'synthetic'}}]}],assertions:[{target:'execution.status',equals:'success'}],verificationKind:'behavior'}]}).tests[0]!;
 const prepared=prepareV2Workflow(source,test,'http://gateway.test','run','mail','token');
 const send=prepared.workflow.nodes.find(n=>n.id==='send')!;
 expect(send.type).toBe('n8n-nodes-base.httpRequest');expect(send.credentials).toBeUndefined();expect(send.parameters.url).toBe('http://gateway.test/mail');
 expect(send.parameters.bodyParameters.parameters).toContainEqual({name:'message',value:'Synthetic test content'});
 test.nodeMocks[0]!.expectedParametersHash='a'.repeat(64);
 expect(()=>prepareV2Workflow(source,test,'http://gateway.test','run','mail','token')).toThrow(/pin/i);
});
it('requires an exact isolated child workflow binding instead of a source instance workflow ID',()=>{
 const parameters={source:'database',workflowId:{__rl:true,mode:'id',value:'source-child'},mode:'once',options:{waitForSubWorkflow:true},workflowInputs:{mappingMode:'passThrough',value:{},matchingColumns:[],schema:[],attemptToConvertTypes:false,convertFieldsToString:false}};
 const source=JSON.stringify({name:'Child workflow',nodes:[n('input','webhook',2,{httpMethod:'POST',path:'test',responseMode:'onReceived',options:{}}),n('child','executeWorkflow',1.3,parameters)],connections:{input:{main:[[{node:'child',type:'main',index:0}]]}}});
 const test=normalizeSuite({schemaVersion:2,name:'test',tests:[{id:'child',workflow:'source.json',input:{kind:'json',fixture:'input.json'},subworkflows:[{nodeId:'child',expectedWorkflowId:'source-child',workflow:'child.json',triggerId:'child-input',trust:{sourceHash:'a'.repeat(64)},tableBindings:[]}],mocks:[],assertions:[{target:'execution.status',equals:'success'}],verificationKind:'behavior'}]}).tests[0]!;
 expect(prepareV2Workflow(source,test,'http://gateway.test','run','child','token').workflow.nodes[1]!.type).toBe('n8n-nodes-base.executeWorkflow');
 test.subworkflows[0]!.expectedWorkflowId='different';expect(()=>prepareV2Workflow(source,test,'http://gateway.test','run','child','token')).toThrow(/child.*binding/i);
});
it('disables every alternate Form so publication cannot expose a second unauthenticated intake',()=>{
 const form=(id:string,field:string)=>n(id,'formTrigger',2.2,{authentication:'none',formTitle:'Test',formFields:{values:[{fieldLabel:field,fieldType:'file',requiredField:true,multipleFiles:false}]},responseMode:'onReceived',options:{}});
 const source=JSON.stringify({name:'Multiple forms',nodes:[form('first','document'),form('second','other'),n('result','noOp',1,{})],connections:{first:{main:[[{node:'result',type:'main',index:0}]]},second:{main:[[{node:'result',type:'main',index:0}]]}}});
 const test=normalizeSuite({schemaVersion:2,name:'forms',tests:[{id:'form',workflow:'forms.json',input:{kind:'file',fixture:'document.png',field:'document',mimeType:'image/png'},triggerId:'first',mocks:[],assertions:[{target:'execution.status',equals:'success'}],verificationKind:'behavior'}]}).tests[0]!;
 expect(prepareV2Workflow(source,test,'http://gateway.test','run','form','token').workflow.nodes.find(n=>n.id==='second')?.disabled).toBe(true);
 const mixed=JSON.parse(source);mixed.nodes[0]=n('first','webhook',2,{httpMethod:'POST',path:'test',responseMode:'onReceived',options:{}});
 test.input={kind:'json',fixture:'input.json'};
 expect(prepareV2Workflow(JSON.stringify(mixed),test,'http://gateway.test','run','form','token').workflow.nodes.find(n=>n.id==='second')?.disabled).toBe(true);
});
