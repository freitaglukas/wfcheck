import {writeFileSync} from 'node:fs';
import {stringify} from 'yaml';
const node=(id,name,type,typeVersion,parameters,extra={})=>({id,name,type:'n8n-nodes-base.'+type,typeVersion,position:[0,0],parameters,...extra});
const condition=(left,operation,right='')=>({options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},combinator:'and',conditions:[{id:'condition',leftValue:left,rightValue:right,operator:{type:'string',operation,...(['empty','notEmpty'].includes(operation)?{singleValue:true}:{})}}]});
const webhook=node('webhook','Webhook','webhook',2,{httpMethod:'POST',path:'wfcheck-demo',responseMode:'onReceived',options:{}});
const check=node('required','Required Input','if',2.2,{conditions:condition('={{ $json.body.email }}','notEmpty'),options:{}});
const map=node('map','Map Contact','set',3.4,{assignments:{assignments:[{id:'email',name:'email',value:'={{ $json.body.email }}',type:'string'}]},options:{}});
const request=node('crm','Create Contact','httpRequest',4.2,{method:'POST',url:'{{WFCHECK_GATEWAY}}/contacts',authentication:'none',sendHeaders:true,headerParameters:{parameters:[{name:'x-api-key',value:'fake-crm-key'}]},sendBody:true,contentType:'json',specifyBody:'keypair',bodyParameters:{parameters:[{name:'email',value:'={{ $json.email }}'}]},options:{timeout:3000,response:{response:{responseFormat:'json'}}}});
const rejected=node('rejected','Rejected Input','noOp',1,{});
const edge=name=>({node:name,type:'main',index:0});
const correct={name:'Synthetic create contact',nodes:[webhook,check,map,request,rejected],connections:{Webhook:{main:[[edge(check.name)]]},[check.name]:{main:[[edge(map.name)],[edge(rejected.name)]]},[map.name]:{main:[[edge(request.name)]]}},settings:{executionOrder:'v1'}};
const save=(name,w)=>writeFileSync('examples/workflows/'+name+'.json',JSON.stringify(w,null,2)+'\n');
save('correct',correct);
const broken=structuredClone(correct);broken.name='Synthetic wrong mapping';broken.nodes.find(n=>n.id==='map').parameters.assignments.assignments[0].value='={{ $json.body.name }}';save('broken-mapping',broken);
const filter=structuredClone(correct);filter.name='Synthetic wrong filter';const f=node('filter','Filter Contact','filter',2.2,{conditions:condition('={{ $json.email }}','equals','never@example.test'),options:{}});filter.nodes.push(f);filter.connections[map.name]={main:[[edge(f.name)]]};filter.connections[f.name]={main:[[edge(request.name)]]};save('broken-filter',filter);
const retry=structuredClone(correct);Object.assign(retry.nodes.find(n=>n.id==='crm'),{retryOnFail:true,maxTries:3,waitBetweenTries:250});save('retry',retry);
const errorPath=structuredClone(correct);const err=node('error-path','Handle Error','set',3.4,{assignments:{assignments:[{id:'outcome',name:'outcome',value:'handled',type:'string'}]},options:{}});errorPath.nodes.push(err);errorPath.nodes.find(n=>n.id==='crm').onError='continueErrorOutput';errorPath.connections[request.name]={main:[[],[edge(err.name)]]};save('error-path',errorPath);
const timeout=structuredClone(correct);timeout.nodes.find(n=>n.id==='crm').parameters.options.timeout=1500;save('timeout',timeout);
const text=structuredClone(correct);text.nodes.find(n=>n.id==='crm').parameters.options.response.response.responseFormat='text';save('text',text);
writeFileSync('examples/fixtures/contact.json',JSON.stringify({email:'customer@example.test',name:'Wrong Mapped Name'},null,2)+'\n');writeFileSync('examples/fixtures/missing-email.json','{"email":"","name":"No Email"}\n');
const status=equals=>({target:'execution.status',equals});const count=equals=>({target:'requests.count',mockId:'crm',equals});const body={target:'request.json',mockId:'crm',requestIndex:0,pointer:'/email',equals:'customer@example.test'};
const nodeCount=(nodeId,equals)=>({target:'node.count',nodeId,runIndex:0,outputIndex:0,equals});
const mock=(responses)=>[{id:'crm',method:'POST',path:'/contacts',responses}];const ok={kind:'json',status:201,json:{id:'fake-contact-1'}};
const test=(id,workflow,assertions,responses=[ok],fixture='contact')=>({id,workflow:'../workflows/'+workflow+'.json',fixture:'../fixtures/'+fixture+'.json',mocks:mock(responses),assertions});
const good=test('correct','correct',[status('success'),count(1),body,nodeCount('map',1),{target:'node.json',nodeId:'map',pointer:'/email',equals:'customer@example.test'},{target:'node.json',nodeId:'crm',pointer:'/id',equals:'fake-contact-1'}]);
const bad=test('broken-mapping','broken-mapping',good.assertions);
for(const [name,tests]of [['correct',[good]],['broken',[bad]],['demo',[good,bad]],['acceptance',[
 good,test('missing-input','correct',[status('success'),count(0),{target:'node.executed',nodeId:'crm',equals:false},nodeCount('rejected',1)],[ok],'missing-email'),
 test('broken-filter','broken-filter',[status('success'),nodeCount('filter',1),count(1),body]),
 test('retry-429','retry',[status('success'),count(2),body,{...body,requestIndex:1}],[{kind:'json',status:429,json:{error:'rate limited'}},ok]),
 test('error-path-500','error-path',[status('success'),count(1),{target:'node.json',nodeId:'error-path',pointer:'/outcome',equals:'handled'}],[{kind:'json',status:500,json:{error:'fake upstream failure'}}]),
 test('delayed-timeout','timeout',[status('error'),count(1),{target:'node.executed',nodeId:'crm',equals:true}],[{...ok,delayMs:4000}]),
 test('malformed-json','correct',[status('error'),count(1),{target:'node.executed',nodeId:'crm',equals:true}],[{kind:'malformed-json',status:200,text:'{invalid-json'}]),
 test('text-response','text',[status('success'),count(1),{target:'node.json',nodeId:'crm',pointer:'/data',equals:'hello synthetic world'}],[{kind:'text',status:200,text:'hello synthetic world'}])
]]])writeFileSync('examples/suites/'+name+'.yaml',stringify({schemaVersion:1,name:'wfcheck-'+name,tests},{aliasDuplicateObjects:false}));
