import 'dotenv/config';
import {mkdir,writeFile} from 'node:fs/promises';
import {loadSuite} from '../src/spec/load.js';
import {compileSuite,runCompiled,newRunId} from '../src/runtime/runner.js';
import {CloudClient} from '../src/adapters/n8n-cloud/client.js';
import {N8nCloudAdapter} from '../src/adapters/n8n-cloud/index.js';
import {Manifest} from '../src/runtime/manifest.js';
import {Gateway} from '../src/gateway/server.js';
import {TemporaryTunnel} from '../src/gateway/tunnel.js';
import {redactor} from '../src/security/redact.js';
const controller=new AbortController();process.once('SIGINT',()=>controller.abort());process.once('SIGTERM',()=>controller.abort());
const {suite,base}=await loadSuite(process.argv[2]!);const compiled=await compileSuite(suite,base);
console.log('Planned Cloud executions: '+compiled.length+' (serial; limit 20)');
const client=new CloudClient(process.env.N8N_BASE_URL!,process.env.N8N_API_KEY!);const runId=newRunId();const manifest=new Manifest('.wfcheck',runId,client.baseUrl);const adapter=new N8nCloudAdapter(client,manifest);
console.log(JSON.stringify(await adapter.doctor()));const gateway=new Gateway(process.env.WFCHECK_GATEWAY_DNS_SERVER);const tunnel=new TemporaryTunnel();
try{
 await gateway.start();const url=await tunnel.open(gateway.localUrl,controller.signal);console.log('Temporary HTTPS gateway: '+url);
 let reached=false;for(let i=0;i<10;i++){try{await gateway.probe(url);reached=true;break;}catch{await new Promise(r=>setTimeout(r,1000));}}if(!reached)throw new Error('HTTPS gateway unreachable');
 const result=await runCompiled(suite,compiled,adapter,gateway,url,runId,controller.signal,t=>console.log(JSON.stringify(redactor.object({id:t.id,status:t.status,error:t.error,executionId:t.evidence?.execution.id,n8nStatus:t.evidence?.execution.status,requests:t.evidence?.requests.map(r=>({json:r.json,method:r.method,path:r.path,status:r.responseStatus})),failures:t.assertions.filter(a=>!a.passed),cleanup:t.cleanup}))));
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/'+runId+'.json',JSON.stringify(redactor.object(result),null,2)+'\n',{mode:0o600});process.exitCode=result.exitCode;
 console.log('Manifest leftovers: '+JSON.stringify(manifest.leftovers()));
}finally{tunnel.close();await gateway.close();}
