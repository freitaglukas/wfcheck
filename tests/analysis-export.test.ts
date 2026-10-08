import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {analyzeWorkflow} from '../src/analysis/index.js';
import {projectWorkflow} from '../src/analysis/export.js';
const source=()=>readFile('tests/fixtures/analysis/mixed.json','utf8');
it('does not call malformed known parameters ready',()=>{
 const wf={name:'bad',nodes:[{id:'w',name:'Start',type:'n8n-nodes-base.webhook',typeVersion:2,position:[0,0],parameters:{httpMethod:'GET',path:'x',responseMode:'onReceived',options:{}}}],connections:{}};
 expect(analyzeWorkflow(JSON.stringify(wf)).status).not.toBe('ready');
});
it('inventory continues after an unknown node and normal public metadata',async()=>{
 const analysis=analyzeWorkflow(await source());
 expect(analysis.nodes.map(n=>n.id)).toEqual(['trigger','unknown','output']);
 expect(analysis.diagnostics.some(d=>d.nodeId==='unknown')).toBe(true);
 expect(analysis.status).toBe('unsupported');
});
it('projects runtime fields without modifying source bytes or copying account state',async()=>{
 const original=await source(),projected=projectWorkflow(original);
 expect(projected).not.toHaveProperty('id');expect(projected).not.toHaveProperty('shared');
 expect(projected).not.toHaveProperty('activeVersion');expect(await source()).toBe(original);
});
it('rejects malformed JSON and nonempty pinned or static state',async()=>{
 expect(()=>analyzeWorkflow('bad')).toThrow(/JSON/);
 const original=JSON.parse(await source());
 for(const key of ['pinData','staticData'])expect(()=>projectWorkflow(JSON.stringify({...original,[key]:{secret:'value'}}))).toThrow(/state|pinned/i);
});
it('does not publish arbitrary Code, headers, URL queries or metadata values',()=>{
 const wf={name:'private',nodes:[{id:'c',name:'fake-secret-name',type:'n8n-nodes-base.code',typeVersion:2,position:[0,0],parameters:{jsCode:'return [{json:{password:"fake-secret"}}]'},credentials:{httpHeaderAuth:{id:'fake-secret',name:'fake-secret'}}}],connections:{},description:'fake-secret'};
 const a=analyzeWorkflow(JSON.stringify(wf));expect(JSON.stringify(a)).not.toContain('fake-secret');
 expect(a.nodes[0]?.code?.sha256).toMatch(/^[a-f0-9]{64}$/);
 expect(a.nodes[0]?.credentialTypes).toEqual(['httpHeaderAuth']);
});
