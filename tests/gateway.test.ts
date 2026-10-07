import {it,expect,afterEach} from 'vitest';
import {Gateway} from '../src/gateway/server.js';
import {mockSchema} from '../src/spec/schema.js';
const servers:Gateway[]=[];
afterEach(async()=>{await Promise.all(servers.splice(0).map(s=>s.close()));});
async function start(responses:any[]=[{kind:'json',status:201,json:{id:'fake-1'}}]){
 const g=new Gateway();servers.push(g);await g.start();
 const c=g.register('run1','test1',[mockSchema.parse({id:'crm',method:'POST',path:'/contacts',responses})],5000);
 return {g,c,url:g.localUrl+'/r/run1/test1/contacts'};
}
it('requires a token and has no remote control endpoint',async()=>{
 const {g,c,url}=await start();expect((await fetch(url,{method:'POST'})).status).toBe(401);
 expect((await fetch(g.localUrl+'/admin')).status).toBe(404);
 expect((await fetch(url,{method:'POST',headers:{'x-wfcheck-token':c.token},body:'{"email":"fake@example.test"}'})).status).toBe(201);
 expect(g.snapshot('run1','test1').requests[0]?.json).toEqual({email:'fake@example.test'});
});
it('orders responses and makes exhaustion an unexpected request',async()=>{
 const {g,c,url}=await start([{kind:'text',status:429,text:'retry'},{kind:'json',status:200,json:{ok:true}}]);
 const status=[];for(let i=0;i<3;i++)status.push((await fetch(url,{method:'POST',headers:{'x-wfcheck-token':c.token}})).status);
 expect(status).toEqual([429,200,409]);expect(g.snapshot('run1','test1').requests[2]?.unexpected).toBe(true);
});
it('isolates run/test state and rejects using a token in another namespace',async()=>{
 const {g,c,url}=await start();const other=g.register('run2','test1',[],5000);
 expect((await fetch(g.localUrl+'/r/run2/test1/contacts',{method:'POST',headers:{'x-wfcheck-token':c.token}})).status).toBe(401);
 await fetch(url,{method:'POST',headers:{'x-wfcheck-token':c.token}});
 expect(g.snapshot('run2','test1').requests).toHaveLength(0);expect(other.token).not.toBe(c.token);
});
it('matches selected fields, records misses and never forwards',async()=>{
 const {g,c,url}=await start();g.unregister('run1','test1');
 const n=g.register('run1','test1',[mockSchema.parse({id:'crm',method:'POST',path:'/contacts',bodyFields:{'/email':'yes'},headers:{'x-fake':'ok'},responses:[{kind:'json',status:200,json:{}}]})],5000);
 expect((await fetch(url,{method:'POST',headers:{'x-wfcheck-token':n.token,'x-fake':'ok'},body:'{"email":"no"}'})).status).toBe(409);
 expect(g.snapshot('run1','test1').requests[0]?.unexpected).toBe(true);
});
it('returns malformed JSON and bounded delay; payload/count quotas fail evidence',async()=>{
 const {g,c,url}=await start([{kind:'malformed-json',status:200,text:'{bad',delayMs:50}]);const started=Date.now();
 const r=await fetch(url,{method:'POST',headers:{'x-wfcheck-token':c.token}});expect(await r.text()).toBe('{bad');expect(Date.now()-started).toBeGreaterThanOrEqual(45);
 expect((await fetch(url,{method:'POST',headers:{'x-wfcheck-token':c.token},body:'x'.repeat(65537)})).status).toBe(413);
 expect(g.snapshot('run1','test1').errors).not.toHaveLength(0);
});
it('expired tokens cannot start work',async()=>{
 const {g,url}=await start();g.unregister('run1','test1');const c=g.register('run1','test1',[],1);await new Promise(r=>setTimeout(r,5));
 expect((await fetch(url,{method:'POST',headers:{'x-wfcheck-token':c.token}})).status).toBe(401);
});
