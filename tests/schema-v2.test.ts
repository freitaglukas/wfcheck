import {it,expect} from 'vitest';
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
