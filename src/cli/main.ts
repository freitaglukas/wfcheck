#!/usr/bin/env node
import { Command } from 'commander';
import { cp,mkdir,writeFile,readFile } from 'node:fs/promises';
import { resolve,join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configuration } from './config.js';
import { publicGateway,acquireLock } from './setup.js';
import { CloudClient } from '../adapters/n8n-cloud/client.js';
import { N8nCloudAdapter } from '../adapters/n8n-cloud/index.js';
import { Manifest } from '../runtime/manifest.js';
import { newRunId,compileSuite,runCompiled,type SuiteResult } from '../runtime/runner.js';
import { loadSuite } from '../spec/load.js';
import { Gateway } from '../gateway/server.js';
import { TemporaryTunnel } from '../gateway/tunnel.js';
import { consoleTest,jsonReport,junitReport } from '../reporters/index.js';
import { HarnessError,errorMessage } from '../security/errors.js';
import { redactor } from '../security/redact.js';
const program=new Command().name('wfcheck').description('Local-first regression tests against real n8n Cloud workflows').version('0.1.0');
program.exitOverride();
program.configureOutput({outputError:(s,write)=>write(redactor.text(s))});
async function reports(result:SuiteResult,opts:{json?:string;junit?:string}):Promise<void> {
  for(const [path,content] of [[opts.json,jsonReport(result)],[opts.junit,junitReport(result)]])if(path){const p=resolve(path);await mkdir(dirname(p),{recursive:true});await writeFile(p,content!,{mode:0o600});}
}
function signals():{signal:AbortSignal;dispose:()=>void}{const controller=new AbortController();const stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);return {signal:controller.signal,dispose:()=>{process.off('SIGINT',stop);process.off('SIGTERM',stop);}};}
program.command('init').argument('[directory]','New example project directory','wfcheck-example').action(async(directory:string)=>{
  const root=resolve(directory);await mkdir(root,{recursive:false});const pkg=fileURLToPath(new URL('../../',import.meta.url));
  await cp(join(pkg,'examples'),join(root,'examples'),{recursive:true,errorOnExist:true,force:false});
  await cp(join(pkg,'.env.example'),join(root,'.env.example'),{errorOnExist:true,force:false});
  await writeFile(join(root,'.gitignore'),'.env\n.env.*\n!.env.example\n.wfcheck/\nartifacts/\n');
  console.log(`Created ${root}. Copy .env.example to a private .env, configure it, then run wfcheck doctor and wfcheck run examples/suites/correct.yaml from that directory.`);
});
program.command('doctor').option('--tunnel <kind>','cloudflared or external','cloudflared').action(async(opts)=>{
  const cfg=configuration();const client=new CloudClient(cfg.baseUrl,cfg.apiKey);const adapter=new N8nCloudAdapter(client,new Manifest(cfg.stateDirectory,newRunId(),client.baseUrl));
  const gateway=new Gateway(process.env.WFCHECK_GATEWAY_DNS_SERVER),tunnel=new TemporaryTunnel(),s=signals();
  try{const diagnosis=await adapter.doctor() as Record<string,unknown>;const url=await publicGateway(gateway,tunnel,cfg,opts.tunnel,s.signal);console.log(JSON.stringify(redactor.object({...diagnosis,node:process.version,gateway:{https:url,probe:'Authenticated HTTPS probe from this controller verified; Cloud-origin requests verified only by run'},cloudExecutions:0}),null,2));}
  finally{tunnel.close();await gateway.close();s.dispose();}
});
program.command('run').argument('<suite>').option('--tunnel <kind>','cloudflared or external','cloudflared').option('--max-executions <number>','Lower the maximum (1-20)','20').option('--json <path>','Write redacted JSON report').option('--junit <path>','Write redacted JUnit report').action(async(path:string,opts)=>{
  const began=Date.now(),runId=newRunId();let name=path,planned=0,announced=false;
  const gateway=new Gateway(process.env.WFCHECK_GATEWAY_DNS_SERVER),tunnel=new TemporaryTunnel(),s=signals();let unlock:(()=>Promise<void>)|undefined;
  try{
    const {suite,base}=await loadSuite(path);name=suite.name;const compiled=await compileSuite(suite,base);
    const max=Number(opts.maxExecutions);if(!Number.isInteger(max)||max<1||max>20||compiled.length>max)throw new HarnessError('CONFIG','Planned suite exceeds --max-executions or the hard limit of 20');
    planned=compiled.length;console.log(`Planned Cloud executions: ${planned} (serial; limit ${max}; webhook triggers are never retried)`);announced=true;
    const cfg=configuration();const client=new CloudClient(cfg.baseUrl,cfg.apiKey);unlock=await acquireLock(cfg.stateDirectory);
    const manifest=new Manifest(cfg.stateDirectory,runId,client.baseUrl);const adapter=new N8nCloudAdapter(client,manifest);
    await adapter.doctor();const url=await publicGateway(gateway,tunnel,cfg,opts.tunnel,s.signal);
    console.log('Temporary HTTPS gateway verified: '+url);
    const result=await runCompiled(suite,compiled,adapter,gateway,url,runId,s.signal,t=>console.log(consoleTest(t)));
    await reports(result,opts);process.exitCode=result.exitCode;
    console.log(`${result.tests.filter(t=>t.status==='passed').length} passed, ${result.tests.filter(t=>t.status==='failed').length} failed, ${result.tests.filter(t=>t.status==='error').length} errors. Exit ${result.exitCode}.`);
    if(manifest.leftovers().length){console.error('Leftovers: '+JSON.stringify(redactor.object(manifest.leftovers())));console.error(`Recovery: wfcheck cleanup ${manifest.path}`);process.exitCode=2;}
  }catch(error){
    if(!announced)console.log('Planned Cloud executions: 0 (preflight rejected)');
    const failure={code:error instanceof HarnessError?error.code:'INFRASTRUCTURE',message:redactor.text(errorMessage(error))};console.error(`${failure.code}: ${failure.message}`);
    const result:SuiteResult={schemaVersion:1,runId,suite:name,startedAt:new Date(began).toISOString(),durationMs:Date.now()-began,plannedExecutions:planned,tests:[{id:'preflight',status:'error',durationMs:Date.now()-began,assertions:[],error:failure,cleanup:{status:'not-created'}}],exitCode:2};
    await reports(result,opts);process.exitCode=2;
  }finally{tunnel.close();await gateway.close();s.dispose();await unlock?.();}
});
program.command('cleanup').description('Recover exact resource IDs from a local ownership manifest').argument('<manifest>').action(async(path:string)=>{
  const cfg=configuration();const client=new CloudClient(cfg.baseUrl,cfg.apiKey);const manifest=await Manifest.load(resolve(path));
  if(manifest.baseUrl!==client.baseUrl)throw new HarnessError('OWNERSHIP','Manifest belongs to a different instance');
  const unlock=await acquireLock(cfg.stateDirectory);try{
    const adapter=new N8nCloudAdapter(client,manifest);await adapter.doctor();
    for(const e of manifest.leftovers()){
      if(!e.workflowId)throw new HarnessError('OWNERSHIP',`Uncertain create for ${e.name}; use n8n UI to identify its exact ID and record it in the private manifest before cleanup. No prefix cleanup is performed.`);
      await adapter.cleanup({workflowId:e.workflowId,prepared:{} as any});console.log('Cleaned workflow '+e.workflowId);
    }
  }finally{await unlock();}
});
try{await program.parseAsync();}catch(error:any){if(error.code==='commander.helpDisplayed'||error.code==='commander.version')process.exitCode=0;else {console.error(redactor.text(errorMessage(error)));process.exitCode=2;}}
