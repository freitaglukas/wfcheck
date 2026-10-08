import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { analyzeWorkflow } from '../src/analysis/index.js';
import { buildDraft } from '../src/planning/deterministic.js';
import { validatePlan } from '../src/planning/validate.js';
import { normalizeSuite } from '../src/spec/normalized.js';
import { sha256 } from '../src/spec/load.js';

function readiness(source:string,candidate:unknown){
 const {sourceSchemaVersion:_,...suite}=normalizeSuite(candidate);
 const contracts=suite.tests.map(t=>({id:'authored-'+t.id,fixtureId:t.id,assertion:t.assertions[0]!,provenance:{source:'user' as const}}));
 const draft=buildDraft(analyzeWorkflow(source),contracts);
 // Source is private validation input, never embedded in exported draft reports.
 const config={workflowSources:Object.fromEntries(suite.tests.map(t=>[t.workflow,source])),candidateSuite:suite,validatedInputs:suite.tests.map(t=>({path:t.input.fixture,kind:t.input.kind,sha256:'a'.repeat(64)})),authoredContracts:contracts};
 return {draft,config,result:validatePlan(draft,config)};
}

it('accepts a fully bound literal HTTP workflow under the version-two profile',async()=>{
 const workflow=JSON.parse(await readFile('examples/workflows/correct.json','utf8'));
 workflow.nodes.find((n:any)=>n.id==='crm').parameters.url='https://synthetic.example.test/contacts';
 const suite=parse(await readFile('examples/suites/correct.yaml','utf8'));
 const normalized=normalizeSuite(suite);normalized.tests[0]!.bindings=[{nodeId:'crm',expectedUrl:'https://synthetic.example.test/contacts',mockPath:'/contacts'}];
 const {sourceSchemaVersion:_,...candidate}=normalized;
 const {result}=readiness(JSON.stringify(workflow),candidate);
 expect(result.diagnostics).toEqual([]);expect(result.ready).toBe(true);
});

for(const name of ['native-table','chat'])it(`accepts complete qualified ${name} configuration without inheriting v1 restrictions`,async()=>{
 const source=await readFile(`examples/workflows/${name}.json`,'utf8');
 const suite=parse(await readFile(`examples/suites/${name}.yaml`,'utf8'));
 const {result}=readiness(source,suite);
 expect(result.diagnostics).toEqual([]);expect(result.ready).toBe(true);
});

it('accepts a single-file Form with PDF extraction and exactly reviewed Code',()=>{
 const source=JSON.stringify({name:'Synthetic file plan',nodes:[
  {id:'input',name:'Input',type:'n8n-nodes-base.formTrigger',typeVersion:2.2,position:[0,0],parameters:{formTitle:'Synthetic input',formFields:{values:[{fieldLabel:'document',fieldType:'file',multipleFiles:false}]},responseMode:'onReceived',options:{}}},
  {id:'pdf',name:'PDF',type:'n8n-nodes-base.extractFromFile',typeVersion:1,position:[200,0],parameters:{operation:'pdf',binaryPropertyName:'document',options:{maxPages:1,joinPages:true}}},
  {id:'code',name:'Code',type:'n8n-nodes-base.code',typeVersion:2,position:[400,0],parameters:{mode:'runOnceForAllItems',jsCode:'return items;'}},
 ],connections:{Input:{main:[[{node:'PDF',type:'main',index:0}]]},PDF:{main:[[{node:'Code',type:'main',index:0}]]}}});
 const suite={schemaVersion:2,name:'Files',tests:[{id:'one',workflow:'workflow.json',input:{kind:'file',fixture:'document.pdf',field:'document',mimeType:'application/pdf'},mocks:[],verificationKind:'behavior',trust:{sourceHash:sha256(source),reviewedCode:[{nodeId:'code',codeHash:sha256('return items;'),noExternalEffects:true}]},assertions:[{target:'execution.status',equals:'success'}]}]};
 const {result}=readiness(source,suite);
 expect(result.diagnostics).toEqual([]);expect(result.ready).toBe(true);
});

it('requires the actual source and rejects source drift even when the candidate has no trust pin',async()=>{
 const source=await readFile('examples/workflows/correct.json','utf8');
 const suite=parse(await readFile('examples/suites/correct.yaml','utf8'));
 const {draft,config}=readiness(source,suite);
 const missing={...config,workflowSources:undefined};
 expect(validatePlan(draft,missing).ready).toBe(false);
 expect(validatePlan(draft,{...config,workflowSources:Object.fromEntries(Object.keys(config.workflowSources).map(path=>[path,source+' ']))}).ready).toBe(false);
});

it('rejects invalid v2 parameters after all independent requirements have been supplied',async()=>{
 const workflow=JSON.parse(await readFile('examples/workflows/correct.json','utf8'));
 workflow.nodes.find((n:any)=>n.id==='crm').parameters.sendBody='invalid';
 const suite=parse(await readFile('examples/suites/correct.yaml','utf8'));
 const {result}=readiness(JSON.stringify(workflow),suite);
 expect(result.ready).toBe(false);
 expect(result.diagnostics.some(d=>d.code==='PARAMETERS_REQUIRED')).toBe(true);
});

it('does not approve another workflow path using source bytes supplied for the original candidate',async()=>{
 const source=await readFile('examples/workflows/correct.json','utf8');
 const suite=parse(await readFile('examples/suites/correct.yaml','utf8'));
 const {draft,config}=readiness(source,suite);
 const changed=structuredClone(config.candidateSuite);
 changed.tests[0]!.workflow='unrelated-workflow.json';
 expect(validatePlan(draft,{...config,candidateSuite:changed}).ready).toBe(false);
});
