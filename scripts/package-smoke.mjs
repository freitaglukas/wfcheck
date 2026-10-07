import {mkdtemp,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {promisify} from 'node:util';import {execFile} from 'node:child_process';import {createHash} from 'node:crypto';
import {CloudClient} from '../dist/adapters/n8n-cloud/client.js';import {N8nCloudAdapter} from '../dist/adapters/n8n-cloud/index.js';import {Manifest} from '../dist/runtime/manifest.js';import {newRunId} from '../dist/runtime/runner.js';import {prepareWorkflow} from '../dist/security/workflow.js';
const gatewayUrl=process.env.WFCHECK_GATEWAY_URL;if(!gatewayUrl)throw new Error('Set WFCHECK_GATEWAY_URL to your running approved tunnel');
const exec=promisify(execFile),root=process.cwd(),install=await mkdtemp(join(tmpdir(),'wfcheck-package-'));const tar=resolve('wfcheck-local-alpha-0.1.0.tgz');const installEnv={...process.env};delete installEnv.N8N_API_KEY;
console.log('Install smoke directory: '+install);await exec('npm',['install','--prefix',install,'--ignore-scripts','--omit=dev',tar],{env:installEnv});
const bin=join(install,'node_modules/.bin/wfcheck');console.log((await exec(bin,['--version'],{env:installEnv})).stdout.trim());console.log((await exec(bin,['init','project'],{cwd:install,env:installEnv})).stdout.trim());
process.loadEnvFile(join(root,'.env'));const env={...process.env,WFCHECK_GATEWAY_PORT:'43199',WFCHECK_GATEWAY_URL:gatewayUrl};const cwd=join(install,'project');console.log((await exec(bin,['doctor','--tunnel','external'],{cwd,env})).stdout.trim());
const client=new CloudClient(process.env.N8N_BASE_URL,process.env.N8N_API_KEY),runId=newRunId(),manifest=new Manifest(join(root,'.wfcheck'),runId,client.baseUrl),adapter=new N8nCloudAdapter(client,manifest);await adapter.doctor();
const wf=JSON.parse(await readFile('examples/workflows/correct.json','utf8'));wf.nodes=wf.nodes.filter(n=>n.id==='webhook');wf.connections={};
const prepared=prepareWorkflow(JSON.stringify(wf),gatewayUrl+'/r/'+runId+'/sentinel',runId,'preservation-sentinel','fake-unused-sentinel');const handle=await adapter.importWorkflow(prepared,runId,'preservation-sentinel');let result;
try{
 console.log('Planned Cloud executions: 2 (serial packaged demo; limit 20)');
 const before=await client.request('workflows/'+handle.workflowId);let exit=0,out='';
 try{const run=await exec(bin,['run','examples/suites/demo.yaml','--tunnel','external','--json',join(root,'artifacts/package-demo.json'),'--junit',join(root,'artifacts/package-demo.xml')],{cwd,env,timeout:120000});out=run.stdout;}catch(e){exit=e.code;out=e.stdout;}
 console.log(out);if(exit!==1)throw new Error('Packaged demo expected assertion exit 1, got '+exit);
 const after=await client.request('workflows/'+handle.workflowId);const unchanged=before.name===after.name&&before.active===after.active&&JSON.stringify(before.nodes)===JSON.stringify(after.nodes)&&JSON.stringify(before.connections)===JSON.stringify(after.connections);
 if(!unchanged)throw new Error('Unrelated-to-run sentinel changed');
 const report=JSON.parse(await readFile('artifacts/package-demo.json','utf8'));const earlier=JSON.parse(await readFile('artifacts/demo.json','utf8'));const isolated=report.runId!==earlier.runId&&report.tests.every(t=>t.evidence.requests.length===1&&t.cleanup.status==='cleaned');if(!isolated)throw new Error('Repeat run isolation failed');
 result={package:tar,artifactSha256:createHash('sha256').update(await readFile(tar)).digest('hex'),install,cwd,version:'0.1.0',doctor:'passed',demoExit:exit,executions:report.tests.map(t=>({test:t.id,id:t.evidence.execution.id,n8n:t.evidence.execution.status,status:t.status})),repeatIsolation:isolated,sentinelId:handle.workflowId,sentinelUnchanged:unchanged};
}finally{await adapter.cleanup(handle);console.log('Preservation sentinel cleaned: '+handle.workflowId);}
await writeFile('artifacts/package-smoke.json',JSON.stringify({...result,sentinelCleanup:'cleaned'},null,2)+'\n',{mode:0o600});
