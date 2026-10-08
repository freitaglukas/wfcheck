import {it,expect} from 'vitest';import {imagePins,selectImages} from '../src/adapters/docker/images.js';import {assertBootstrapSchema} from '../src/adapters/docker/bootstrap.js';
it('does not export entities until database migrations have completed',async()=>{
 const {bootstrap}=await import('../src/adapters/docker/bootstrap.js');
 const {ResourceJournal}=await import('../src/runtime/journal.js');
 const {runInNewContext}=await import('node:vm');
 const fs=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const directory=await fs.mkdtemp(join(tmpdir(),'bootstrap-readiness-'));
 let migrationsComplete=false,readinessChecks=0,exportedAfterMigrations=false;
 const engine:any={identity:async()=>'docker:fake',architecture:async()=>'arm64',remove:async()=>{},exec:async(args:string[])=>{
  if(args.includes('export:entities')){exportedAfterMigrations=migrationsComplete;throw Error('stop after export boundary');}
  if(args.includes('--version'))return '2.42.4';
  const script=args.at(-1)!;
  if(script.startsWith('fetch('))return runInNewContext(script,{
   AbortSignal,process:{exit:()=>{throw Error('not ready');}},fetch:async(url:string)=>{
    if(new URL(url).pathname==='/healthz/readiness')migrationsComplete=++readinessChecks>1;
    return {ok:new URL(url).pathname==='/healthz'||migrationsComplete};
   }
  });
  return args[0]+'-id';
 }};
 try{
  await expect(bootstrap({stateDirectory:directory,journal:new ResourceJournal(directory,'run','docker:fake'),engine},AbortSignal.timeout(5000))).rejects.toThrow('stop after export boundary');
  expect(exportedAfterMigrations).toBe(true);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
it('selects pinned matching server and runner for qualified architecture',()=>{const selected=selectImages('arm64');expect(selected.n8n).toContain('@sha256:');expect(selected.runner).toContain('@sha256:');expect(imagePins.version).toBe('2.42.4');expect(()=>selectImages('riscv')).toThrow();});
it('refuses unqualified seed schema/version instead of using private APIs',()=>{expect(()=>assertBootstrapSchema('2.42.5',['UserEntity'])).toThrow();expect(()=>assertBootstrapSchema('2.42.4',[])).toThrow();});
it('startup failure recovers the exact resources created before the deadline',async()=>{const {bootstrap}=await import('../src/adapters/docker/bootstrap.js');const {ResourceJournal}=await import('../src/runtime/journal.js');const fs=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');const directory=await fs.mkdtemp(join(tmpdir(),'bootstrap-'));try{const removed:string[]=[];const engine:any={identity:async()=>'docker:fake',architecture:async()=>'arm64',exec:async(a:string[])=>{if(a[0]==='start')throw Error('deadline');return a[0]+'-id';},remove:async(e:any)=>{removed.push(e.id);}};const j=new ResourceJournal(directory,'run','docker:fake');await expect(bootstrap({stateDirectory:directory,journal:j,engine},AbortSignal.timeout(1000))).rejects.toThrow(/deadline/);expect(j.leftovers()).toEqual([]);expect(removed).toEqual(['create-id','volume-id','network-id']);}finally{await fs.rm(directory,{recursive:true,force:true});}});
it('readiness requires the authenticated API operations used by the runtime',async()=>{const {waitForApi}=await import('../src/adapters/docker/bootstrap.js');let round=0;const paths:string[]=[];await waitForApi({request:async(path:string)=>{paths.push(path);if(path==='discover')round++;if(path.startsWith('workflows')&&round===1)throw Error('initialization not complete');return {data:[]};}},AbortSignal.timeout(1000),0);expect(round).toBe(2);expect(paths.at(-1)).toBe('executions?limit=1&includeData=true');});
