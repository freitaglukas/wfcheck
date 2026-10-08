import { it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const exec=promisify(execFile);
it('retains actual failed-assertion evidence and Unicode requests when keeping a real Docker runtime',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wfcheck-retained-evidence-'));
 const cli=join(process.cwd(),'dist/cli/main.js');
 const invoke=async(args:string[])=>{
  try{const result=await exec(process.execPath,[cli,...args],{cwd:root,env:{...process.env,N8N_BASE_URL:'',N8N_API_KEY:'',WFCHECK_STATE_DIR:join(root,'.wfcheck')},timeout:240000,maxBuffer:2*1024*1024});return {code:0,...result};}
  catch(error:any){if(typeof error.code!=='number')throw error;return {code:error.code,stdout:error.stdout,stderr:error.stderr};}
 };
 try{
  await writeFile(join(root,'workflow.json'),await readFile('examples/workflows/correct.json'));
  await writeFile(join(root,'input.json'),JSON.stringify({email:'Grüße: 12,90 € 🧾',name:'Synthetic transport'}));
  await writeFile(join(root,'suite.json'),JSON.stringify({schemaVersion:2,name:'Retained evidence',tests:[{
   id:'regression',workflow:'workflow.json',input:{kind:'json',fixture:'input.json'},timeoutMs:30000,verificationKind:'behavior',
   mocks:[{id:'crm',method:'POST',path:'/contacts',responses:[{kind:'json',status:201,json:{id:'fake-contact-1'}}]}],
   assertions:[{target:'execution.status',equals:'success'},{target:'requests.count',mockId:'crm',equals:1},{target:'request.json',mockId:'crm',pointer:'/email',equals:'Deliberately different expected value'}],
  }]}));
  const result=await invoke(['run','suite.json','--runtime','docker','--keep-runtime-on-failure','--json','result.json','--junit','result.xml']);
  expect(result.code,result.stdout+result.stderr).toBe(2);
  const report=JSON.parse(await readFile(join(root,'result.json'),'utf8'));
  expect(report.tests.map((t:any)=>t.id)).toEqual(['regression']);
  expect(report.tests[0].status).toBe('failed');
  expect(report.tests[0].evidence.execution.status).toBe('success');
  expect(report.tests[0].evidence.requests).toHaveLength(1);
  expect(report.tests[0].evidence.requests[0].json.email).toBe('Grüße: 12,90 € 🧾');
  expect(report.runtimeError.code).toBe('CLEANUP');expect(report.exitCode).toBe(2);
  const junit=await readFile(join(root,'result.xml'),'utf8');
  expect(junit).toContain('failures="1" errors="1"');expect(junit).toContain('name="regression"');
  const journals=(await readdir(join(root,'.wfcheck'))).filter(name=>name.startsWith('journal-'));
  expect(journals).toHaveLength(1);
  const journal=JSON.parse(await readFile(join(root,'.wfcheck',journals[0]!),'utf8'));
  expect(journal.entries.some((e:any)=>e.kind==='container'&&e.state==='owned')).toBe(true);
 }finally{
  const names=await readdir(join(root,'.wfcheck')).catch(()=>[] as string[]);
  for(const name of names.filter(n=>n.startsWith('journal-'))){
   const cleaned=await invoke(['cleanup',join('.wfcheck',name)]);
   if(cleaned.code!==0)throw new Error(`Exact-ID cleanup failed; recover using ${join(root,'.wfcheck',name)}; ${cleaned.stderr}`);
   const journal=JSON.parse(await readFile(join(root,'.wfcheck',name),'utf8'));
   expect(journal.entries.every((e:any)=>e.state==='cleaned')).toBe(true);
  }
  await rm(root,{recursive:true,force:true});
 }
},300000);
