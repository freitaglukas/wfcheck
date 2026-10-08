import {it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
it('inspects offline without a key or runtime and emits a private complete report',async()=>{
 const dir=await mkdtemp('.wfcheck/inspect-'),report=join(dir,'report.json');
 try{
  let code=0;try{execFileSync(process.execPath,['--import','tsx','src/cli/main.ts','inspect','tests/fixtures/analysis/mixed.json','--json',report],{env:{...process.env,N8N_API_KEY:'',N8N_BASE_URL:''},stdio:'pipe'});}catch(e:any){code=e.status;}
  expect(code).toBe(2);
  const a=JSON.parse(await readFile(report,'utf8'));expect(a.nodes).toHaveLength(3);
  expect(a.sourceHash).toMatch(/^[a-f0-9]{64}$/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('refuses an inspection output that aliases the source file',async()=>{const dir=await mkdtemp('.wfcheck/inspect-');const {writeFile,link}=await import('node:fs/promises');const source=await readFile('examples/workflows/correct.json','utf8');const original=join(dir,'workflow.json'),alias=join(dir,'report.json');try{await writeFile(original,source);await link(original,alias);let code=0;try{execFileSync(process.execPath,['--import','tsx','src/cli/main.ts','inspect',original,'--json',alias],{stdio:'pipe'});}catch(e:any){code=e.status;}expect(code).toBe(2);expect(await readFile(original,'utf8')).toBe(source);}finally{await rm(dir,{recursive:true,force:true});}});
