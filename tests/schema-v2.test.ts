import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {z} from 'zod';
import {parse} from 'yaml';
import {normalizeSuite} from '../src/spec/normalized.js';
import {loadSuiteDocument} from '../src/spec/load.js';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
const status={target:'execution.status',equals:'success'};
const v2={schemaVersion:2,name:'v2',tests:[{id:'one',workflow:'workflow.json',input:{kind:'json',fixture:'in.json'},mocks:[],assertions:[status],verificationKind:'smoke'}]};
it('loads version two YAML through version dispatch',async()=>{
 const dir=await mkdtemp('.wfcheck/suite-');try{await writeFile(dir+'/suite.yaml',JSON.stringify(v2));expect((await loadSuiteDocument(dir+'/suite.yaml')).suite.schemaVersion).toBe(2);}finally{await rm(dir,{recursive:true,force:true});}
});
it('normalizes old suites and defaults without relaxing version one',()=>{
 const a=normalizeSuite({schemaVersion:1,name:'old',tests:[{id:'one',workflow:'w.json',fixture:'in.json',mocks:[],assertions:[status]}]});
 expect(a.tests[0]?.input).toEqual({kind:'json',fixture:'in.json'});
 expect(normalizeSuite(v2).tests[0]?.timeoutMs).toBe(30000);
});
it('rejects drafts, unknown grants and invalid file/table settings',()=>{
 expect(()=>normalizeSuite({...v2,draft:true})).toThrow(/draft/i);
 expect(()=>normalizeSuite({...v2,permission:'all'})).toThrow();
 expect(()=>normalizeSuite({...v2,tests:[{...v2.tests[0],input:{kind:'file',fixture:'f',field:'file',mimeType:'text/javascript'}}]})).toThrow();
});
it('rejects schema references, unknown keywords and deep recursion',()=>{
 const test=v2.tests[0]!;
 for(const schema of [{type:'object',$ref:'https://evil.test'}, {type:'string',format:'custom'}]){
  expect(()=>normalizeSuite({...v2,tests:[{...test,assertions:[status,{target:'node.schema',nodeId:'n',schema}]}]})).toThrow();
 }
 let schema:any={type:'string'};for(let i=0;i<10;i++)schema={type:'array',items:schema};
 expect(()=>normalizeSuite({...v2,tests:[{...test,assertions:[status,{target:'node.schema',nodeId:'n',schema}]}]})).toThrow();
});

it('published JSON Schema accepts authored suites without defaulted fields',()=>{
 // JSON Schema defaults are annotations, not permission to omit required keys.
 const published=JSON.parse(readFileSync('docs/suite-schema-v2.json','utf8'),(key,value)=>key==='default'?undefined:value);
 const authored=z.fromJSONSchema(published);
 expect(authored.safeParse(v2).success).toBe(true);
 const reviewed={...v2,tests:[{...v2.tests[0],trust:{sourceHash:'a'.repeat(64)},assertions:[status,{target:'node.schema',nodeId:'result',schema:{type:'object'}}]}]};
 expect(normalizeSuite(reviewed).tests[0]?.trust?.reviewedCode).toEqual([]);
 expect(authored.safeParse(reviewed).success).toBe(true);
 for(const file of ['chat','generated-smoke','native-table']){
  const suite=parse(readFileSync('examples/suites/'+file+'.yaml','utf8'));
  expect(authored.safeParse(suite).success,file).toBe(true);
 }
 expect(authored.safeParse({...v2,tests:[{...v2.tests[0],workflow:undefined}]}).success).toBe(false);
});
