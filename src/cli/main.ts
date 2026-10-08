#!/usr/bin/env node
import {checkReportTargets} from '../reporters/files.js';
import { Command } from 'commander';
import { cp,mkdir,writeFile,readFile,lstat,stat,realpath,chmod } from 'node:fs/promises';
import { resolve,join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configuration } from './config.js';
import { publicGateway,acquireLock } from './setup.js';
import { CloudClient } from '../adapters/n8n-cloud/client.js';
import { N8nCloudAdapter } from '../adapters/n8n-cloud/index.js';
import { Manifest } from '../runtime/manifest.js';
import {ResourceJournal} from '../runtime/journal.js';
import {recoverOwned} from '../adapters/n8n-api/resources.js';
import {apiRecovery} from '../adapters/n8n-api/recovery.js';
import {recoverDocker} from '../adapters/docker/recovery.js';
import {DockerEngine} from '../adapters/docker/engine.js';
import {assistPlan,mergeProposals} from '../planning/assistant.js';
import {assistantProjection} from '../planning/prompt.js';
import {resolveModel} from '../llm/resolve.js';
import {resolveLlmPolicy} from '../llm/policy.js';
import {createRuntime,type RuntimeSession} from '../runtime/factory.js';
import { newRunId,compileSuite,runCompiled,type SuiteResult } from '../runtime/runner.js';
import {compileSuiteV2,runCompiledV2,prepareModelSelections} from '../runtime/runner-v2.js';
import {N8nApiAdapter} from '../adapters/n8n-api/index.js';
import { loadSuiteDocument } from '../spec/load.js';
import { loadSuite } from '../spec/load.js';
import { readBounded } from '../spec/load.js';
import { analyzeWorkflow } from '../analysis/index.js';
import { buildDraft } from '../planning/deterministic.js';
import { stringify,parse } from 'yaml';
import { relative } from 'node:path';
import { Gateway } from '../gateway/server.js';
import { TemporaryTunnel } from '../gateway/tunnel.js';
import { consoleTest,jsonReport,junitReport } from '../reporters/index.js';
import { HarnessError,errorMessage } from '../security/errors.js';
import { redactor } from '../security/redact.js';
const program=new Command().name('wfcheck').description('Local-first regression tests against real n8n Cloud workflows').version('0.1.0');
program.exitOverride();
program.configureOutput({outputError:(s,write)=>write(redactor.text(s))});
program.command('plan').argument('<workflow>').requiredOption('--out <path>','Write a draft suite').option('--json <path>','Write the analysis plan sidecar').option('--assist <kind>','Optional local planning assistance').option('--model <name>','Installed planning model or auto').option('--llm-endpoint <origin>','Trusted local planning model origin').option('--include-code','Include explicitly reviewed redacted Code').option('--requirements <path>','Independent requirements file').option('--smoke','Explicitly plan only structural smoke checks').option('--force','Overwrite a previous generated file').action(async(path:string,opts)=>{
  const source=await readBounded(resolve(path));let draft=buildDraft(analyzeWorkflow(source));let requirementText:string|undefined;
  if(opts.requirements){const text=await readBounded(resolve(opts.requirements));requirementText=text;draft.unresolved.push({id:'requirements-review',kind:'requirements-review',summary:'Review the supplied requirements into authored assertions',provenance:{source:'user',artifactHash:(await import('../spec/load.js')).sha256(text)}});}
  if(opts.assist){if(opts.assist!=='local')throw new HarnessError('CONFIG','Planning assistance supports local inference only');try{const policy=resolveLlmPolicy({mode:'local',model:opts.model??'auto',endpoint:opts.llmEndpoint,preferences:['qwen2.5:0.5b','qwen3.5:9b']},{},{}),selection=await resolveModel(policy,['completion'],AbortSignal.timeout(60000));const raw=JSON.parse(source);const input={requirements:requirementText,includeCode:opts.includeCode===true,code:opts.includeCode?raw.nodes.filter((n:any)=>typeof n.parameters?.jsCode==='string').map((n:any)=>({nodeId:n.id,hash:draft.analysis.nodes.find(a=>a.id===n.id)?.code?.sha256,source:n.parameters.jsCode,redactionReviewed:true})):[]};const projection=assistantProjection(draft,input);draft=mergeProposals(draft,await assistPlan(draft,input,selection!,AbortSignal.timeout(60000)));draft.assistance={status:'proposed',projectionHash:(await import('../spec/load.js')).sha256(JSON.stringify(projection))};}catch(error){draft.assistance={status:'error',message:redactor.text(errorMessage(error))};draft.unresolved.push({id:'assistance-error',kind:'assistance-error',summary:'Local assistance failed; deterministic draft retained',provenance:{source:'deterministic'}});}}
  if(opts.smoke)draft.unresolved=draft.unresolved.filter(r=>r.kind!=='oracle');
  const out=resolve(opts.out),sidecar=resolve(opts.json??opts.out+'.plan.json');
  if(out===resolve(path)||sidecar===resolve(path)||out===sidecar)throw new HarnessError('CONFIG','Output cannot overwrite the source or share the sidecar path');
  const protectedFiles=await Promise.all([path,opts.requirements].filter(Boolean).map(p=>stat(resolve(p))));
  for(const output of [out,sidecar]){
    const existing=await lstat(output).catch((e:any)=>{if(e.code==='ENOENT')return null;throw e;});
    if(existing?.isSymbolicLink()||existing&&protectedFiles.some(s=>s.dev===existing.dev&&s.ino===existing.ino))throw new HarnessError('CONFIG','Output aliases a source/requirements file or symlink');
    if(existing&&!opts.force)throw new HarnessError('CONFIG','Generated output already exists; use --force only for a prior draft');
    if(existing&&opts.force){const previous=parse(await readFile(output,'utf8'));if(output===out?(previous?.schemaVersion!==2||previous?.draft!==true):(previous?.schemaVersion!==1||typeof previous?.analysisHash!=='string'))throw new HarnessError('CONFIG','Force only replaces generated drafts and their sidecars; authored expectations are protected');}
  }
  draft.proposedSuite.tests[0]!.workflow=relative(dirname(out),resolve(path));
  for(const output of [out,sidecar])await mkdir(dirname(output),{recursive:true});
  const flag=opts.force?'w':'wx';
  await writeFile(out,stringify(redactor.object(draft.proposedSuite)),{mode:0o600,flag});
  await writeFile(sidecar,JSON.stringify(redactor.object(draft),null,2)+'\n',{mode:0o600,flag});
  console.log('Draft suite: '+out+'; unresolved requirements: '+draft.unresolved.length);process.exitCode=draft.unresolved.length?2:0;
});
program.command('inspect').argument('<workflow>').option('--json <path>','Write a private inspection report').action(async(path:string,opts)=>{
  const analysis=analyzeWorkflow(await readBounded(resolve(path)));
  const content=JSON.stringify(redactor.object(analysis),null,2)+'\n';
  if(opts.json){const output=resolve(opts.json),input=await stat(resolve(path));const existing=await lstat(output).catch((e:any)=>{if(e.code==='ENOENT')return null;throw e;});if(output===resolve(path)||existing?.isSymbolicLink()||existing&&existing.dev===input.dev&&existing.ino===input.ino)throw new HarnessError('CONFIG','Inspection output aliases the source or a symlink');await mkdir(dirname(output),{recursive:true});await writeFile(output,content,{mode:0o600});}
  console.log(content);process.exitCode=analysis.status==='ready'?0:2;
});
async function reports(result:SuiteResult,opts:{json?:string;junit?:string},protectedInputs:string[]=[]):Promise<void> {
  await checkReportTargets(opts,protectedInputs);
  for(const [path,content] of [[opts.json,jsonReport(result)],[opts.junit,junitReport(result)]])if(path){const p=resolve(path);await mkdir(dirname(p),{recursive:true});await writeFile(p,content!,{mode:0o600});await chmod(p,0o600);}
}
function signals():{signal:AbortSignal;dispose:()=>void}{const controller=new AbortController();const stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);return {signal:controller.signal,dispose:()=>{process.off('SIGINT',stop);process.off('SIGTERM',stop);}};}
program.command('init').argument('[directory]','New example project directory','wfcheck-example').action(async(directory:string)=>{
  const root=resolve(directory);await mkdir(root,{recursive:false});const pkg=fileURLToPath(new URL('../../',import.meta.url));
  await cp(join(pkg,'examples'),join(root,'examples'),{recursive:true,errorOnExist:true,force:false});
  await cp(join(pkg,'.env.example'),join(root,'.env.example'),{errorOnExist:true,force:false});
  await writeFile(join(root,'.gitignore'),'.env\n.env.*\n!.env.example\n.wfcheck/\nartifacts/\n');
  console.log(`Created ${root}. Copy .env.example to a private .env, configure it, then run wfcheck doctor and wfcheck run examples/suites/correct.yaml from that directory.`);
});
program.command('doctor').option('--runtime <kind>','cloud or docker','cloud').option('--tunnel <kind>','cloudflared or external','cloudflared').action(async(opts)=>{
  if(opts.runtime==='docker'){const s=signals();let session:RuntimeSession|undefined;try{session=await createRuntime({runtime:'docker',stateDirectory:resolve(process.env.WFCHECK_STATE_DIR??'.wfcheck')},s.signal);console.log(JSON.stringify(redactor.object({...session.capabilities,node:process.version,workflowExecutions:0}),null,2));}finally{await session?.close();s.dispose();}return;}if(opts.runtime!=='cloud')throw new HarnessError('CONFIG','Unknown runtime');
  const cfg=configuration();const client=new CloudClient(cfg.baseUrl,cfg.apiKey);const adapter=new N8nCloudAdapter(client,new Manifest(cfg.stateDirectory,newRunId(),client.baseUrl));
  const gateway=new Gateway(process.env.WFCHECK_GATEWAY_DNS_SERVER),tunnel=new TemporaryTunnel(),s=signals();
  try{const diagnosis=await adapter.doctor() as Record<string,unknown>;const url=await publicGateway(gateway,tunnel,cfg,opts.tunnel,s.signal);console.log(JSON.stringify(redactor.object({...diagnosis,node:process.version,gateway:{https:url,probe:'Authenticated HTTPS probe from this controller verified; Cloud-origin requests verified only by run'},cloudExecutions:0}),null,2));}
  finally{tunnel.close();await gateway.close();s.dispose();}
});
program.command('run').argument('<suite>').option('--runtime <kind>','cloud or docker').option('--llm <mode>','mock, local or replay').option('--model <name>','Installed model name or auto').option('--llm-endpoint <origin>','Trusted local model service origin').option('--llm-provider <kind>','ollama or openai-compatible').option('--llm-identities <path>','Operator-authored compatible local identities').option('--record <path>','Private model recording').option('--replay-hash <sha256>','Independent approval of recording bytes').option('--replay <path>','Approved private model recording').option('--keep-runtime-on-failure','Retain exact owned Docker resources for recovery').option('--tunnel <kind>','cloudflared or external','cloudflared').option('--max-executions <number>','Lower the maximum (1-20)','20').option('--json <path>','Write redacted JSON report').option('--junit <path>','Write redacted JUnit report').action(async(path:string,opts)=>{
  const began=Date.now(),runId=newRunId();let name=path,planned=0,announced=false;const reportInputs:string[]=[path,opts.record,opts.replay,opts.llmIdentities].filter(Boolean);
  const gateway=new Gateway(process.env.WFCHECK_GATEWAY_DNS_SERVER),tunnel=new TemporaryTunnel(),s=signals();let unlock:(()=>Promise<void>)|undefined;let runtime:RuntimeSession|undefined;
  try{
    await checkReportTargets(opts,reportInputs);
    const {suite,base}=await loadSuiteDocument(path);name=suite.name;const compiled=await compileSuiteV2(suite,base,process.cwd(),{mode:opts.llm,model:opts.model,endpoint:opts.llmEndpoint,provider:opts.llmProvider,identities:opts.llmIdentities,record:opts.record,replay:opts.replay,replayHash:opts.replayHash});reportInputs.push(...compiled.flatMap(t=>[resolve(base,t.spec.workflow),resolve(base,t.spec.input.fixture),t.llm.record,t.llm.replay,t.llm.identities].filter((p):p is string=>!!p)));await checkReportTargets(opts,reportInputs);opts.runtime??=suite.runtime??'cloud';
    const max=Number(opts.maxExecutions);if(!Number.isInteger(max)||max<1||max>20||compiled.length>max)throw new HarnessError('CONFIG','Planned suite exceeds --max-executions or the hard limit of 20');
    await prepareModelSelections(compiled,s.signal);planned=compiled.length;console.log(`Planned n8n executions: ${planned} (serial; limit ${max}; webhook triggers are never retried)`);announced=true;
    if(!['cloud','docker'].includes(opts.runtime))throw new HarnessError('CONFIG','Unknown runtime');
    if(opts.runtime==='docker'){
      const stateDirectory=resolve(process.env.WFCHECK_STATE_DIR??'.wfcheck');unlock=await acquireLock(stateDirectory);
      runtime=await createRuntime({runtime:'docker',stateDirectory,keepOnFailure:opts.keepRuntimeOnFailure},s.signal);
      const result=await runCompiledV2(suite,compiled,runtime.adapter,runtime.gateway,runtime.gatewayUrl,runId,s.signal,t=>console.log(consoleTest(t)),runtime.capabilities);
      await reports(result,opts,reportInputs);process.exitCode=result.exitCode;
      const session=runtime;runtime=undefined;
      try{await session.close(result.exitCode!==0);}
      catch(error){
        result.runtimeError={code:error instanceof HarnessError?error.code:'INFRASTRUCTURE',message:redactor.text(errorMessage(error))};
        result.exitCode=2;process.exitCode=2;
        console.error(`${result.runtimeError.code}: ${result.runtimeError.message}`);
        try{await reports(result,opts,reportInputs);}catch(reportError){console.error(`REPORT: ${redactor.text(errorMessage(reportError))}`);}
      }
      return;
    }
    const cfg=configuration();const client=new CloudClient(cfg.baseUrl,cfg.apiKey);unlock=await acquireLock(cfg.stateDirectory);
    const manifest=new Manifest(cfg.stateDirectory,runId,client.baseUrl);const journal=new ResourceJournal(cfg.stateDirectory,runId,client.baseUrl);const adapter=new N8nApiAdapter(client,manifest,journal);
    await adapter.doctor();const url=await publicGateway(gateway,tunnel,cfg,opts.tunnel,s.signal);
    console.log('Temporary HTTPS gateway verified: '+url);
    const result=await runCompiledV2(suite,compiled,adapter,gateway,url,runId,s.signal,t=>console.log(consoleTest(t)),{kind:'cloud',triggerKinds:['webhook-json','form-file'],operations:['public-api']});
    await reports(result,opts,reportInputs);process.exitCode=result.exitCode;
    console.log(`${result.tests.filter(t=>t.status==='passed').length} passed, ${result.tests.filter(t=>t.status==='failed').length} failed, ${result.tests.filter(t=>t.status==='error').length} errors. Exit ${result.exitCode}.`);
    if(manifest.leftovers().length){console.error('Leftovers: '+JSON.stringify(redactor.object(manifest.leftovers())));console.error(`Recovery: wfcheck cleanup ${manifest.path}`);process.exitCode=2;}
  }catch(error){
    if(!announced)console.log('Planned n8n executions: 0 (preflight rejected)');
    const failure={code:error instanceof HarnessError?error.code:'INFRASTRUCTURE',message:redactor.text(errorMessage(error))};console.error(`${failure.code}: ${failure.message}`);
    const result:SuiteResult={schemaVersion:1,runId,suite:name,startedAt:new Date(began).toISOString(),durationMs:Date.now()-began,plannedExecutions:planned,tests:[{id:'preflight',status:'error',durationMs:Date.now()-began,assertions:[],error:failure,cleanup:{status:'not-created'}}],exitCode:2};
    await reports(result,opts,reportInputs);process.exitCode=2;
  }finally{tunnel.close();await gateway.close();s.dispose();await runtime?.close().catch(error=>{console.error(redactor.text(errorMessage(error)));process.exitCode=2;});await unlock?.();}
});
program.command('cleanup').description('Recover exact resource IDs from a local ownership manifest').argument('<manifest>').action(async(path:string)=>{
  const unlock=await acquireLock(dirname(resolve(path)));try{const raw=JSON.parse(await readFile(resolve(path),'utf8'));
  if(raw.schemaVersion===2){const journal=await ResourceJournal.load(resolve(path));if(journal.ownerIdentity.startsWith('docker:')){const result=await recoverDocker(journal);console.log(JSON.stringify(redactor.object(result)));if(result.leftovers.length)process.exitCode=2;return;}const cfg=configuration(),client=new CloudClient(cfg.baseUrl,cfg.apiKey);if(journal.ownerIdentity!==client.baseUrl)throw new HarnessError('OWNERSHIP','Journal belongs to a different instance');await client.request('discover');const adapter=new N8nApiAdapter(client,new Manifest(journal.directory,journal.runId,client.baseUrl),journal);const result=await recoverOwned(journal,client.baseUrl,{remove:e=>adapter.removeResource(e)});console.log(JSON.stringify(redactor.object(result)));if(result.leftovers.length)process.exitCode=2;return;}
  const cfg=configuration();const client=new CloudClient(cfg.baseUrl,cfg.apiKey);const manifest=await Manifest.load(resolve(path));
  if(manifest.baseUrl!==client.baseUrl)throw new HarnessError('OWNERSHIP','Manifest belongs to a different instance');
  const adapter=new N8nCloudAdapter(client,manifest);await adapter.doctor();
    for(const e of manifest.leftovers()){
      if(!e.workflowId)throw new HarnessError('OWNERSHIP',`Uncertain create for ${e.name}; use n8n UI to identify its exact ID and record it in the private manifest before cleanup. No prefix cleanup is performed.`);
      await adapter.cleanup({workflowId:e.workflowId,prepared:{} as any});console.log('Cleaned workflow '+e.workflowId);
    }
  }finally{await unlock();}
});
try{await program.parseAsync();}catch(error:any){if(error.code==='commander.helpDisplayed'||error.code==='commander.version')process.exitCode=0;else {console.error(redactor.text(errorMessage(error)));process.exitCode=2;}}
