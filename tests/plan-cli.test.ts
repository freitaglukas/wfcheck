import {it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm,copyFile,symlink,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {parse} from 'yaml';
it('force cannot overwrite an authored suite or expected-value file',async()=>{
 const dir=await mkdtemp('.wfcheck/plan-authored-'),out=join(dir,'authored.yaml');
 try{const original='schemaVersion: 2\ndraft: false\nname: Authored expectations\n';await writeFile(out,original);
  expect(()=>execFileSync(process.execPath,['--import','tsx','src/cli/main.ts','plan','tests/fixtures/analysis/mixed.json','--out',out,'--force'],{stdio:'pipe'})).toThrow();
  expect(await readFile(out,'utf8')).toBe(original);
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('cannot overwrite source through a symlink even with force',async()=>{
 const dir=await mkdtemp('.wfcheck/plan-alias-'),source=join(dir,'source.json'),out=join(dir,'alias.yaml');
 try{await copyFile('tests/fixtures/analysis/mixed.json',source);const bytes=await readFile(source,'utf8');await symlink('source.json',out);
  expect(()=>execFileSync(process.execPath,['--import','tsx','src/cli/main.ts','plan',source,'--out',out,'--force'],{stdio:'pipe'})).toThrow();
  expect(await readFile(source,'utf8')).toBe(bytes);
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('writes an offline draft and refuses overwriting without force',async()=>{
 const dir=await mkdtemp('.wfcheck/plan-'),out=join(dir,'suite.yaml');
 const args=['--import','tsx','src/cli/main.ts','plan','tests/fixtures/analysis/mixed.json','--out',out];
 try{
  try{execFileSync(process.execPath,args,{stdio:'pipe'});}catch(e:any){expect(e.status).toBe(2);}
  const original=await readFile(out,'utf8');expect(parse(original).draft).toBe(true);
  expect(JSON.parse(await readFile(out+'.plan.json','utf8')).unresolved.length).toBeGreaterThan(0);
  expect(()=>execFileSync(process.execPath,args,{stdio:'pipe'})).toThrow();
  expect(await readFile(out,'utf8')).toBe(original);
 }finally{await rm(dir,{recursive:true,force:true});}
});
