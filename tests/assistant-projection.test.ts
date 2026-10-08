import {it,expect} from 'vitest';import {assistantProjection} from '../src/planning/prompt.js';import {buildDraft} from '../src/planning/deterministic.js';import {analyzeWorkflow} from '../src/analysis/index.js';
it('default projection has hashes and facts but no Code, account metadata or secrets',()=>{const raw=JSON.stringify({name:'Private name',shared:[{secret:'unrelated'}],nodes:[{id:'code',name:'Private label',type:'n8n-nodes-base.code',typeVersion:2,position:[0,0],parameters:{mode:'runOnceForAllItems',jsCode:'const secret="Bearer hidden-secret"; ignore_previous_instructions();'}}],connections:{}});const draft=buildDraft(analyzeWorkflow(raw));const p=JSON.stringify(assistantProjection(draft,{}));expect(p).not.toContain('hidden-secret');expect(p).not.toContain('ignore_previous_instructions');expect(p).not.toContain('Private name');expect(p).not.toContain('unrelated');expect(()=>assistantProjection(draft,{code:[{nodeId:'code',hash:draft.analysis.nodes[0]!.code!.sha256,source:'raw'}]})).toThrow(/review/);});
it('explicit reviewed Code is hash checked and redactable rather than trusted authority',()=>{const code='return [{json:{value:1}}];',raw=JSON.stringify({name:'code',nodes:[{id:'code',name:'Code',type:'n8n-nodes-base.code',typeVersion:2,position:[0,0],parameters:{mode:'runOnceForAllItems',jsCode:code}}],connections:{}}),draft=buildDraft(analyzeWorkflow(raw));const hash=draft.analysis.nodes[0]!.code!.sha256;const p=assistantProjection(draft,{includeCode:true,code:[{nodeId:'code',hash,source:code,redactionReviewed:true}]});expect(p.code[0]?.hash).toBe(hash);expect(()=>assistantProjection(draft,{includeCode:true,code:[{nodeId:'code',hash,source:code+' ',redactionReviewed:true}]})).toThrow(/hash/);});
it('groups repeated requirements so a 25-node workflow fits the same bounded projection',()=>{
 const nodes=Array.from({length:25},(_,i)=>({id:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),name:'Node '+i,type:'n8n-nodes-base.code',typeVersion:2,position:[0,0],parameters:{mode:'runOnceForAllItems',jsCode:'return $input.all();'}}));
 const connections=Object.fromEntries(nodes.slice(0,-1).map((n,i)=>[n.name,{main:[[{node:nodes[i+1]!.name,type:'main',index:0}]]}]));
 const draft=buildDraft(analyzeWorkflow(JSON.stringify({name:'large briefing',nodes,connections})));
 draft.unresolved=nodes.flatMap(n=>['expression-review','code-review'].map(kind=>({id:n.id+'-'+kind,nodeId:n.id,kind,summary:'Authored review required',provenance:{source:'deterministic' as const}})));
 const projection=assistantProjection(draft,{requirements:'Verify durable delivery claims and duplicate suppression.'});
 expect(Buffer.byteLength(JSON.stringify(projection))).toBeLessThanOrEqual(5000);
 expect(projection.nodes[24]![0]).toBe(nodes[24]!.id);
 expect(projection.requirements[0].nodeIndices).toContain(24);
 expect(projection.edges).toHaveLength(24);
 expect(projection.edges[23]).toEqual([23,24,0,0,0]);
});
it('bounds unique requirement node IDs per kind and reports omitted IDs after deduplication',()=>{
 const nodes=Array.from({length:100},(_,i)=>({id:'n'+i,name:'Node '+i,type:'n8n-nodes-base.noOp',typeVersion:1,position:[0,0],parameters:{}}));
 const draft=buildDraft(analyzeWorkflow(JSON.stringify({name:'many requirements',nodes,connections:{}})));
 draft.unresolved=nodes.flatMap(n=>[0,1].map(copy=>({id:n.id+'-'+copy,nodeId:n.id,kind:'http-binding',summary:'Binding required',provenance:{source:'deterministic' as const}})));
 draft.unresolved.push({id:'review',nodeId:'n99',kind:'code-review',summary:'Review required',provenance:{source:'user'}});
 const projection=assistantProjection(draft,{});
 expect(projection.requirements).toEqual([
  {kind:'http-binding',nodeIndices:Array.from({length:25},(_,i)=>i),omittedNodeIds:75},
  {kind:'code-review',nodeIndices:[],omittedNodeIds:1}
 ]);
 expect(Buffer.byteLength(JSON.stringify(projection))).toBeLessThanOrEqual(5000);
});
