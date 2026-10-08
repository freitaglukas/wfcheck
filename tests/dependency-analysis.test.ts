import {it,expect} from 'vitest';
import {analyzeWorkflow} from '../src/analysis/index.js';
const make=(type:string,parameters:any,id='n')=>({id,name:id,type,typeVersion:type==='n8n-nodes-base.httpRequest'?4.2:1,parameters,position:[0,0]});
const analyze=(n:any,catalog?:any)=>analyzeWorkflow(JSON.stringify({name:'test',nodes:[n],connections:{}}),{catalog});
it('does not expose invalid branch operator values',()=>{
 const a=analyze({...make('n8n-nodes-base.if',{conditions:{conditions:[{operator:{type:'fake-secret',operation:'fake-secret'}}]}}),typeVersion:2.2});
 expect(JSON.stringify(a)).not.toContain('fake-secret');
});
it('reports file/binary inputs and bounded retry/error configuration',()=>{
 const form=analyze({...make('n8n-nodes-base.formTrigger',{formFields:{values:[{fieldType:'file',fieldLabel:'Attachment',multipleFiles:false}]}}),typeVersion:2.2});
 expect(form.nodes[0]?.facts.some(f=>f.kind==='file.fields')).toBe(true);
 const pdf=analyze(make('n8n-nodes-base.extractFromFile',{operation:'pdf',binaryPropertyName:'attachment'}));
 expect(pdf.nodes[0]?.facts.some(f=>f.kind==='binary.input'&&f.value==='attachment')).toBe(true);
 const retry=analyze({...make('n8n-nodes-base.httpRequest',{url:'{{WFCHECK_GATEWAY}}/test'}),retryOnFail:true,maxTries:3,onError:'continueErrorOutput'});
 expect(retry.nodes[0]?.facts.some(f=>f.kind==='execution.policy')).toBe(true);
});
it('requires a binding for a literal HTTP destination without exposing queries or headers',()=>{
 const a=analyze(make('n8n-nodes-base.httpRequest',{method:'POST',url:'https://api.example.test/v1/chat/completions?key=fake-secret',headerParameters:{parameters:[{name:'x-api-key',value:'fake-secret'}]}}));
 expect(a.requirements.some(r=>r.kind==='http-binding'&&r.nodeId==='n')).toBe(true);
 expect(JSON.stringify(a)).not.toContain('fake-secret');
 expect(a.nodes[0]?.facts.find(f=>f.kind==='http.destination')?.provenance.source).toBe('deterministic');
});
it('does not resolve dynamic destinations or authorize effects from runtime metadata',()=>{
 const a=analyze(make('n8n-nodes-base.httpRequest',{url:'={{ $json.endpoint }}'}));
 expect(a.diagnostics.some(d=>d.code==='DYNAMIC_DESTINATION')).toBe(true);
 const b=analyze(make('community.new',{write:true}),{runtimeVersion:'test',sha256:'a'.repeat(64),nodes:[{type:'community.new',versions:[1],description:{safe:true}}]});
 expect(b.status).toBe('unsupported');
 expect(b.nodes[0]?.capabilities?.executable).not.toBe(true);
});
it('uses operations and stable IDs rather than node names and keeps provenance',()=>{
 const n=make('n8n-nodes-base.dataTable',{resource:'row',operation:'upsert',dataTableId:{value:'source',mode:'id'}});
 const a=analyze(n),b=analyze({...n,name:'Completely renamed'});
 expect(a.nodes[0]?.capabilities).toEqual(b.nodes[0]?.capabilities);
 expect(a.requirements.some(r=>r.kind==='table-binding')).toBe(true);
 expect(a.nodes[0]?.facts.every(f=>f.provenance.pointer)).toBe(true);
});
it('inventories 201 nodes and reports the execution budget without truncation',()=>{
 const a=analyzeWorkflow(JSON.stringify({name:'large',nodes:Array.from({length:201},(_,i)=>make('n8n-nodes-base.noOp',{},'n'+i)),connections:{}}));
 expect(a.nodes).toHaveLength(201);expect(a.diagnostics.some(d=>d.code==='EXECUTION_NODE_LIMIT')).toBe(true);
});
it('requires expression review for jsCode keys outside the top-level Code implementation',()=>{const a=analyze(make('n8n-nodes-base.httpRequest',{method:'POST',url:'{{WFCHECK_GATEWAY}}/test',jsonBody:{jsCode:'={{ $env.WFCHECK_FAKE_PRIVATE_VALUE }}'}}));expect(a.requirements.some(r=>r.kind==='expression-review')).toBe(true);});
