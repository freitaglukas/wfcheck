import {it,expect} from 'vitest';
import {analyzeWorkflow} from '../src/analysis/index.js';
const node=(id:string)=>({id,name:id,type:'n8n-nodes-base.noOp',typeVersion:1,position:[0,0],parameters:{}});
it('preserves main and AI edges using stable IDs',()=>{
 const a=analyzeWorkflow(JSON.stringify({name:'graph',nodes:[node('a'),node('b')],connections:{a:{main:[[{node:'b',type:'main',index:0}]],ai_languageModel:[[{node:'b',type:'ai_languageModel',index:0}]]}}}));
 expect(a.edges).toEqual([{from:'a',to:'b',connectionType:'main',outputIndex:0,inputIndex:0},{from:'a',to:'b',connectionType:'ai_languageModel',outputIndex:0,inputIndex:0}]);
});
it('reports duplicate identities, cycles, missing targets and trigger alternatives together',()=>{
 const a=analyzeWorkflow(JSON.stringify({name:'graph',nodes:[node('a'),node('a'),node('b')],connections:{a:{main:[[{node:'b',type:'main',index:0},{node:'missing',type:'main',index:0}]]},b:{main:[[{node:'a',type:'main',index:0}]]}}}));
 const codes=a.diagnostics.map(d=>d.code);
 expect(codes).toContain('DUPLICATE_IDENTITY');expect(codes).toContain('GRAPH_CYCLE');
 expect(codes).toContain('MISSING_TARGET');expect(codes).toContain('TRIGGER_SELECTION');
});
it('inventories 201 nodes without applying the old execution ceiling',()=>{
 const a=analyzeWorkflow(JSON.stringify({name:'large',nodes:Array.from({length:201},(_,i)=>node('n'+i)),connections:{}}));
 expect(a.nodes).toHaveLength(201);
});
it('never emits malformed raw identities through graph edges',()=>{const raw={name:'graph',nodes:[{id:'secret with spaces',name:'Start',type:'n8n-nodes-base.webhook',typeVersion:2,parameters:{}},{id:'out',name:'Out',type:'n8n-nodes-base.noOp',typeVersion:1,parameters:{}}],connections:{Start:{main:[[{node:'Out',type:'main',index:0}]]}}};const result=analyzeWorkflow(JSON.stringify(raw));expect(JSON.stringify(result)).not.toContain('secret with spaces');expect(result.edges[0]?.from).toBe('node-0');});
it('retains malformed-node diagnostics without throwing during single-trigger reachability',()=>{
 const input={id:'input',name:'input',type:'n8n-nodes-base.webhook',typeVersion:2,position:[0,0],parameters:{httpMethod:'POST',path:'input',responseMode:'onReceived',options:{}}};
 const result=analyzeWorkflow(JSON.stringify({name:'malformed',nodes:[input,null,42,'invalid',true,[],node('out')],connections:{input:{main:[[{node:'out',type:'main',index:0}]]}}}));
 expect(result.status).toBe('unsupported');
 expect(result.diagnostics.filter(d=>d.code==='INVALID_NODE')).toHaveLength(5);
 expect(result.edges).toEqual([{from:'input',to:'out',connectionType:'main',outputIndex:0,inputIndex:0}]);
});
