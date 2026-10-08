import { it, expect, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const state=vi.hoisted(()=>({create:vi.fn(),run:vi.fn()}));
vi.mock('../src/runtime/factory.js',()=>({createRuntime:state.create}));
vi.mock('../src/runtime/runner-v2.js',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/runtime/runner-v2.js')>();
 return {...actual,runCompiledV2:state.run};
});

for(const reason of ['explicit retention','teardown failure'])it(`preserves completed CLI reports after ${reason}`,async()=>{
 vi.resetModules();
 const {HarnessError}=await import('../src/security/errors.js');
 const directory=await mkdtemp(join(tmpdir(),'wfcheck-cli-report-'));
 const oldArgv=process.argv,oldExit=process.exitCode;
 const log=vi.spyOn(console,'log').mockImplementation(()=>{}),error=vi.spyOn(console,'error').mockImplementation(()=>{});
 const close=vi.fn().mockRejectedValue(new HarnessError('CLEANUP',reason==='explicit retention'?'Runtime retained explicitly; recover exact IDs using private/journal.json':'Owned runtime cleanup failed; recover exact IDs using private/journal.json'));
 const capabilities={kind:'docker',triggerKinds:['webhook-json'],operations:['public-api']};
 state.create.mockResolvedValue({capabilities,close,adapter:{},gateway:{},gatewayUrl:'http://gateway.example.test'});
 state.run.mockResolvedValue({schemaVersion:2,runId:'unit-report',suite:'Observed regression',startedAt:'2026-10-08T00:00:00Z',durationMs:10,plannedExecutions:1,exitCode:1,tests:[{
  id:'observed-case',status:'failed',durationMs:10,verificationKind:'behavior',cleanup:{status:'cleaned',workflowId:'unit-owned'},
  assertions:[{target:'request.json crm',passed:false,message:'Expected correct email; observed wrong mapping',expected:'correct@example.test',actual:'wrong@example.test'}],
  evidence:{execution:{id:'unit-execution',workflowId:'unit-owned',status:'success',nodes:{}},requests:[{method:'POST',path:'/contacts',json:{email:'wrong@example.test'},headers:{},body:'{"email":"wrong@example.test"}',unexpected:false,receivedAt:'2026-10-08T00:00:00Z',mockId:'crm',responseStatus:201}],gatewayErrors:[]},
 }]});
 try{
  process.argv=[process.execPath,'wfcheck','run','examples/suites/correct.yaml','--runtime','docker','--json',join(directory,'result.json'),'--junit',join(directory,'result.xml'),...(reason==='explicit retention'?['--keep-runtime-on-failure']:[])];
  await import('../src/cli/main.js');
  const report=JSON.parse(await readFile(join(directory,'result.json'),'utf8'));
  expect(report.tests.map((t:any)=>t.id)).toEqual(['observed-case']);
  expect(report.tests[0].status).toBe('failed');
  expect(report.tests[0].evidence.execution.status).toBe('success');
  expect(report.tests[0].evidence.requests[0].json.email).toBe('wrong@example.test');
  expect(report.exitCode).toBe(2);expect(report.runtimeError.code).toBe('CLEANUP');
  const junit=await readFile(join(directory,'result.xml'),'utf8');
  expect(junit).toContain('failures="1" errors="1"');expect(junit).toContain('observed-case');expect(junit).toContain('Runtime cleanup');
  expect(process.exitCode).toBe(2);expect(close).toHaveBeenCalledTimes(1);
 }finally{process.argv=oldArgv;process.exitCode=oldExit;log.mockRestore();error.mockRestore();state.create.mockReset();state.run.mockReset();await rm(directory,{recursive:true,force:true});}
});
