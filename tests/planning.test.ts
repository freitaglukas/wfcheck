import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {analyzeWorkflow} from '../src/analysis/index.js';
import {buildDraft} from '../src/planning/deterministic.js';
import {validatePlan} from '../src/planning/validate.js';
const source=()=>readFile('examples/workflows/broken-mapping.json','utf8');
it('blocks missing trigger selection and changed catalog identity',async()=>{
 const a=analyzeWorkflow(await source(),{catalog:{runtimeVersion:'test',sha256:'b'.repeat(64),nodes:[]}});
 const draft=buildDraft(a);const suite={...draft.proposedSuite,draft:false};
 const result=validatePlan(draft,{candidateSuite:suite,validatedInputs:[],authoredContracts:[],runtimeCapabilities:{kind:'docker',triggerKinds:['webhook-json'],operations:[],nodeCatalogHash:'c'.repeat(64)}});
 expect(result.diagnostics.some(d=>d.code==='CATALOG_MISMATCH')).toBe(true);
 const empty=buildDraft(analyzeWorkflow(JSON.stringify({name:'no-trigger',nodes:[{id:'n',name:'n',type:'n8n-nodes-base.noOp',typeVersion:1,parameters:{},position:[0,0]}],connections:{}})));
 expect(validatePlan(empty,{candidateSuite:{...empty.proposedSuite,draft:false},validatedInputs:[{path:'fixtures/input.json',kind:'json',sha256:'a'.repeat(64)}],authoredContracts:[]}).ready).toBe(false);
});
it('lists missing configuration and does not use current outputs as an oracle',async()=>{
 const a=analyzeWorkflow(await source()),draft=buildDraft(a);
 expect(draft.unresolved.some(r=>r.kind==='oracle')).toBe(true);
 expect(draft.unresolved.some(r=>r.kind==='input-fixture')).toBe(true);
 expect(validatePlan(draft,{candidateSuite:draft.proposedSuite,validatedInputs:[],authoredContracts:[]}).ready).toBe(false);
});
it('preserves an independently supplied assertion against a broken mapping',async()=>{
 const contract:any={id:'expected-email',fixtureId:'one',assertion:{target:'node.json',nodeId:'map',pointer:'/email',equals:'correct@example.test'},provenance:{source:'user',artifactHash:'a'.repeat(64)}};
 const draft=buildDraft(analyzeWorkflow(await source()),[contract]);
 expect(draft.proposedSuite.tests[0]?.assertions).toContainEqual(expect.objectContaining(contract.assertion));
 expect(draft.verificationKind).toBe('behavior');
 const candidate=structuredClone(draft.proposedSuite);candidate.draft=false;
 candidate.tests[0]!.assertions=[{target:'execution.status',equals:'success'}];
 expect(validatePlan(draft,{candidateSuite:candidate,validatedInputs:[],authoredContracts:[contract]}).diagnostics.some(d=>d.code==='CONTRACT_MISSING')).toBe(true);
});
it('proposes retry and schema scenarios only from declared workflow facts',async()=>{
 const raw=JSON.parse(await source());raw.nodes.find((n:any)=>n.type==='n8n-nodes-base.httpRequest').retryOnFail=true;
 const analysis=analyzeWorkflow(JSON.stringify(raw));
 analysis.nodes[0].facts.push({kind:'output.schema',value:{type:'object',required:['email']},provenance:{source:'user'}});
 const scenarios=buildDraft(analysis).scenarios;
 expect(scenarios.some(s=>s.kind==='retry')).toBe(true);
 expect(scenarios.some(s=>s.kind==='declared-schema')).toBe(true);
});
it('blocks source/catalog drift and unknown assertions or table references',async()=>{
 const draft=buildDraft(analyzeWorkflow(await source()));
 const suite:any={...draft.proposedSuite,draft:false};
 suite.tests[0].trust={sourceHash:'a'.repeat(64),reviewedCode:[]};
 suite.tests[0].assertions.push({target:'node.executed',nodeId:'unknown',equals:true});
 const result=validatePlan(draft,{candidateSuite:suite,validatedInputs:[],authoredContracts:[],runtimeCapabilities:{kind:'docker',triggerKinds:['webhook-json'],operations:[],nodeCatalogHash:'changed'}});
 expect(result.diagnostics.some(d=>d.code==='SOURCE_HASH_MISMATCH')).toBe(true);
 expect(result.diagnostics.some(d=>d.code==='UNKNOWN_ASSERTION_NODE')).toBe(true);
 expect(result.ready).toBe(false);
});
