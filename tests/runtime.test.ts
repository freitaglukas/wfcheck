import {it,expect} from 'vitest';
import {prepareWorkflow} from '../src/security/workflow.js';
import {normalizeExecution} from '../src/adapters/n8n-cloud/observe.js';
const webhook={id:'webhook',name:'Webhook',type:'n8n-nodes-base.webhook',typeVersion:2,position:[0,0],parameters:{httpMethod:'POST',path:'demo',responseMode:'onReceived',options:{}}};
const wf=JSON.stringify({name:'demo',nodes:[webhook],connections:{},settings:{}});
it('preserves source and only patches a copy',()=>{const p=prepareWorkflow(wf,'https://gateway.example.test/r/run/test','run','test','token');expect(p.workflow.nodes[0]?.parameters.path).not.toBe('demo');expect(JSON.parse(wf).nodes[0].parameters.path).toBe('demo');expect(p.changes.length).toBeGreaterThan(0);});
it.each(['n8n-nodes-base.code','n8n-nodes-base.gmail','n8n-nodes-base.executeCommand'])('rejects unsupported nodes %s',type=>expect(()=>prepareWorkflow(JSON.stringify({name:'bad',nodes:[{...webhook,type}],connections:{}}),'https://g.example.test/r/r/t','r','t','token')).toThrow(/unsupported/i));
it('rejects credentials and pinned data',()=>{
 for(const change of [{nodes:[{...webhook,credentials:{httpHeaderAuth:{id:'1'}}}]},{pinData:{Webhook:[{}]}}])expect(()=>prepareWorkflow(JSON.stringify({...JSON.parse(wf),...change}),'https://g.example.test/r/r/t','r','t','token')).toThrow();
});
it('requires actual runData and terminal status; normalizes explicit outputs',()=>{
 expect(()=>normalizeExecution({id:'1',workflowId:'wf',status:'success'},JSON.parse(wf))).toThrow(/evidence/i);
 const e=normalizeExecution({id:'1',workflowId:'wf',status:'success',stoppedAt:'date',data:{resultData:{runData:{Webhook:[{data:{main:[[{json:{body:{x:1}}}]]}}]}}}},JSON.parse(wf));
 expect(e.nodes.webhook?.[0]?.outputs).toEqual([[{body:{x:1}}]]);
 expect(()=>normalizeExecution({id:'1',status:'running'},JSON.parse(wf))).toThrow();
});
it('rejects dynamic headers and HTTP destinations that bypass the gateway',async()=>{const {readFile}=await import('node:fs/promises');const good=JSON.parse(await readFile('examples/workflows/correct.json','utf8'));for(const mutation of ['name','url']){const w=structuredClone(good);const h=w.nodes.find((n:any)=>n.id==='crm');if(mutation==='name')h.parameters.headerParameters.parameters[0].name='={{ $json.body.headerName }}';else h.parameters.url='https://unrelated.example.test/contacts';expect(()=>prepareWorkflow(JSON.stringify(w),'https://g.example.test/r/r/t','r','t','token')).toThrow();}});
it('rejects reserved node identities',()=>{const w=JSON.parse(wf);w.nodes[0].id='__proto__';expect(()=>prepareWorkflow(JSON.stringify(w),'https://g.example.test','r','t','token')).toThrow(/reserved/);});
