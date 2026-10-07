import {it, expect} from 'vitest';
import { evaluate } from '../src/assertions/index.js';
const evidence:any={execution:{id:'12',workflowId:'wf',status:'success',nodes:{map:[{outputs:[[{email:'wrong@example.test',nothing:null}]]}]}},requests:[{mockId:'crm',method:'POST',path:'/contacts',headers:{'x-api-key':'fake-key'},json:{email:'wrong@example.test'},body:'{}',unexpected:false}],gatewayErrors:[]};
it('catches wrong mapping despite n8n success',()=>{
 const r=evaluate([{target:'execution.status',equals:'success'},{target:'request.json',mockId:'crm',requestIndex:0,pointer:'/email',equals:'right@example.test'}],evidence);
 expect(r.slice(0,2).map(x=>x.passed)).toEqual([true,false]);expect(r[1]?.message).toContain('wrong@example.test');
});
it('distinguishes missing from null and errors on missing evidence',()=>{
 expect(()=>evaluate([{target:'node.count',nodeId:'missing',runIndex:0,outputIndex:0,equals:0}],evidence)).toThrow(/evidence/i);
 expect(evaluate([{target:'node.json',nodeId:'map',runIndex:0,outputIndex:0,itemIndex:0,pointer:'/absent',equals:null}],evidence)[0]?.passed).toBe(false);
 expect(evaluate([{target:'node.json',nodeId:'map',runIndex:0,outputIndex:0,itemIndex:0,pointer:'/nothing',equals:null}],evidence)[0]?.passed).toBe(true);
});
it('fails unexpected requests and gateway errors even with passing explicit assertions',()=>{
 const r=evaluate([{target:'execution.status',equals:'success'}],{...evidence,requests:[{...evidence.requests[0],unexpected:true}]});expect(r.some(x=>!x.passed)).toBe(true);
 expect(()=>evaluate([{target:'execution.status',equals:'success'}],{...evidence,gatewayErrors:['quota']})).toThrow();
});
it('zero requests succeeds only with complete execution evidence',()=>{
 expect(evaluate([{target:'requests.count',mockId:'crm',equals:0}],{...evidence,requests:[]})[0]?.passed).toBe(true);
 expect(()=>evaluate([{target:'requests.count',mockId:'crm',equals:0}],{...evidence,execution:undefined})).toThrow();
});
it('redacts sensitive scalar assertion pointers and headers',()=>{
 const e:any={...evidence,requests:[{...evidence.requests[0],json:{password:'private-password'},headers:{'x-api-key':'private-api-key'}}]};
 const r=evaluate([{target:'request.json',mockId:'crm',requestIndex:0,pointer:'/password',equals:'expected-password'},{target:'request.header',mockId:'crm',requestIndex:0,header:'x-api-key',equals:'expected-api-key'}],e);expect(JSON.stringify(r)).not.toMatch(/private-password|private-api-key|expected-password|expected-api-key/);
});
