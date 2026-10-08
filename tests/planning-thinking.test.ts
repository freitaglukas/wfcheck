import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {discoverModels} from '../src/llm/discovery.js';
import {assistPlan} from '../src/planning/assistant.js';
import {buildDraft} from '../src/planning/deterministic.js';
import {analyzeWorkflow} from '../src/analysis/index.js';
it('uses a supported no-thinking completion for bounded structured planning',async()=>{
 const server=createServer(async(req,res)=>{
  let text='';for await(const chunk of req)text+=chunk;
  const body=text?JSON.parse(text):{};
  const result=req.url==='/api/version'?{version:'test'}:req.url==='/api/tags'?{models:[{name:'local',digest:'a'.repeat(64)}]}:req.url==='/api/show'?{capabilities:['completion','thinking'],thinking:{values:[false,true],default:true}}:{model:'local',done:true,done_reason:body.think===false?'stop':'length',message:{content:body.think===false&&body.format?.properties?.proposals?'{"proposals":[{"kind":"intent","text":"Validate the supplied webhook input"}]}':''}};
  res.setHeader('content-type','application/json');res.end(JSON.stringify(result));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const models=await discoverModels('http://127.0.0.1:'+(server.address() as any).port,AbortSignal.timeout(2000));
  const draft=buildDraft(analyzeWorkflow(JSON.stringify({name:'test',nodes:[{id:'in',name:'Input',type:'n8n-nodes-base.webhook',typeVersion:2,position:[0,0],parameters:{httpMethod:'POST',path:'test',responseMode:'onReceived',options:{}}}],connections:{}})));
  const proposals=await assistPlan(draft,{},models[0]!,AbortSignal.timeout(2000));
  expect(proposals[0]).toMatchObject({kind:'intent',text:'Validate the supplied webhook input',provenance:{source:'inferred'}});
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
