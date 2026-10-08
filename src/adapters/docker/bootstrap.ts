import {HarnessError} from '../../security/errors.js';
export function assertBootstrapSchema(version:string,entities:string[]){if(version!=='2.42.4'||!['User','Project','ProjectRelation','ApiKey'].every(n=>entities.includes(n)))throw new HarnessError('CAPABILITY','Unqualified bootstrap version or entity schema');}
import {ownedLoopbackClient} from '../n8n-api/client.js';
import {randomBytes} from 'node:crypto';import {setTimeout as delay} from 'node:timers/promises';
import {DockerEngine,containerArguments} from './engine.js';import {selectImages,imagePins,type ImageSet} from './images.js';import {ResourceJournal} from '../../runtime/journal.js';import {createOwned,recoverOwned} from '../n8n-api/resources.js';import {ApiError} from '../n8n-cloud/client.js';import {redactor} from '../../security/redact.js';import {sha256} from '../../spec/load.js';import type {NodeCatalog} from '../../analysis/types.js';import {seedScript,catalogScript} from './seed-script.js';
const executeHttp=String.raw`(async()=>{const i=JSON.parse(require('fs').readFileSync(0,'utf8'));const r=await fetch('http://127.0.0.1:5678'+i.path,{method:i.method,headers:{'X-N8N-API-KEY':i.apiKey,'content-type':'application/json',...i.headers},body:i.body===undefined?undefined:JSON.stringify(i.body),redirect:'error',signal:AbortSignal.timeout(15000)});let size=0;const chunks=[];for await(const c of r.body){size+=c.length;if(size>8388608)throw Error('response budget');chunks.push(c);}process.stdout.write(JSON.stringify({status:r.status,text:Buffer.concat(chunks).toString()}));})().catch(()=>process.exit(1));`;
export class InternalApiClient {
 readonly baseUrl='http://127.0.0.1:5678';
 #apiKey:string;
 constructor(readonly engine:DockerEngine,readonly containerId:string,apiKey:string){this.#apiKey=apiKey;redactor.add(apiKey);}
 forContainer(id:string){return new InternalApiClient(this.engine,id,this.#apiKey);}
 loopback(origin:string,journal:ResourceJournal,ingressId:string){return ownedLoopbackClient(origin,this.#apiKey,journal,ingressId);}
 async http(path:string,method='GET',body?:unknown,signal?:AbortSignal,headers?:Record<string,string>){const raw=await this.engine.exec(['exec','-i',this.containerId,'node','-e',executeHttp],signal,JSON.stringify({apiKey:this.#apiKey,path,method,body,headers}));return JSON.parse(raw) as {status:number;text:string};}
 async request(path:string,method='GET',body?:unknown,signal?:AbortSignal){const r=await this.http('/api/v1/'+path,method,body,signal);if(r.status>=400)throw new ApiError(r.status,`Public API ${method} ${path.split('?')[0]} returned HTTP ${r.status}`);return r.text?JSON.parse(r.text):undefined;}
}
export interface BootstrapOptions {stateDirectory:string;journal:ResourceJournal;engine?:DockerEngine;pins?:ImageSet;}
export interface BootstrappedInstance {containerId:string;networkId:string;volumeId:string;client:InternalApiClient;catalog:NodeCatalog;version:string;imageDigest:string;}
export async function waitForApi(client:{request(path:string,method?:string,body?:unknown,signal?:AbortSignal):Promise<unknown>},signal:AbortSignal,pauseMs=1000){
 for(let i=0;i<60;i++){try{for(const path of ['discover','workflows?limit=1','executions?limit=1&includeData=true'])await client.request(path,'GET',undefined,signal);return;}catch(error){if(signal.aborted||i===59)throw error;await delay(pauseMs,undefined,{signal});}}
}
export async function bootstrap(o:BootstrapOptions,signal:AbortSignal):Promise<BootstrappedInstance>{
 const engine=o.engine??new DockerEngine(),journal=o.journal,owner=await engine.identity();if(owner!==journal.ownerIdentity)throw new HarnessError('OWNERSHIP','Bootstrap daemon differs from journal');const pins=selectImages(await engine.architecture(),o.pins??imagePins),name='wfcheck-'+journal.runId;
 const owned=async(kind:'network'|'volume'|'container',suffix:string,args:string[])=>createOwned(journal,{kind,name:name+suffix},async()=>({name:name+suffix,id:await engine.exec(args,signal)}));
 try{
  const network=await owned('network','-net',['network','create','--internal','--label','wfcheck.run='+journal.runId,name+'-net']);
  const volume=await owned('volume','-state',['volume','create','--label','wfcheck.run='+journal.runId,name+'-state']);
  const initial=await owned('container','-initialize',containerArguments({name:name+'-initialize',runId:journal.runId,image:pins.n8n,network:network.id!,volume:volume.id!}));await engine.exec(['start',initial.id!],signal);
  for(let i=0;i<90;i++){try{await engine.exec(['exec',initial.id!,'node','-e',"fetch('http://127.0.0.1:5678/healthz',{signal:AbortSignal.timeout(1000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"],signal);break;}catch{if(signal.aborted||i===89)throw new HarnessError('TIMEOUT','Fresh n8n readiness deadline expired');await delay(1000,undefined,{signal});}}
  if(await engine.exec(['exec',initial.id!,'n8n','--version'],signal)!==pins.version)throw new HarnessError('CAPABILITY','Pinned image version mismatch');
  await engine.exec(['exec',initial.id!,'node','-e',"require('fs').writeFileSync('/home/node/.n8n/seed-key',require('crypto').randomBytes(32).toString('hex'),{mode:0o600})"],signal);
  await engine.exec(['exec',initial.id!,'n8n','export:entities','--outputDir=/home/node/.n8n/export','--keyFile=/home/node/.n8n/seed-key'],signal);
  const key='n8n_api_'+randomBytes(32).toString('hex');redactor.add(key);
  await engine.exec(['exec','-i','-w','/usr/local/lib/node_modules/n8n',initial.id!,'node','-e',seedScript],signal,JSON.stringify({apiKey:key}));
  await engine.exec(['stop',initial.id!],signal);
  const imported=await owned('container','-import',containerArguments({name:name+'-import',runId:journal.runId,image:pins.n8n,network:network.id!,volume:volume.id!,command:['import:entities','--inputDir=/home/node/.n8n/seed','--keyFile=/home/node/.n8n/seed-key','--truncateTables']}));
  const output=await engine.exec(['start','-a',imported.id!],signal);if(!output.includes('Migration validation passed')||!output.includes('Import completed successfully!'))throw new HarnessError('CAPABILITY','Documented bootstrap import was not confirmed');await engine.remove(imported);await journal.markCleaned(imported.intentId);
  await engine.exec(['start',initial.id!],signal);const client=new InternalApiClient(engine,initial.id!,key);
  await waitForApi(client,signal);
  const nodes=JSON.parse(await engine.exec(['exec','-w','/usr/local/lib/node_modules/n8n',initial.id!,'node','-e',catalogScript],signal));if(!Array.isArray(nodes)||nodes.length<1||nodes.length>1500)throw new HarnessError('CAPABILITY','Packaged node catalog unavailable');
  const catalog={runtimeVersion:pins.version,sha256:sha256(JSON.stringify(nodes)),nodes};
  return {containerId:initial.id!,networkId:network.id!,volumeId:volume.id!,client,catalog,version:pins.version,imageDigest:pins.n8n.split('@')[1]!};
 }catch(error){const recovery=await recoverOwned(journal,owner,engine);if(recovery.leftovers.length)throw new HarnessError('CLEANUP',`Bootstrap failed; recovery journal ${journal.path} retains ${recovery.leftovers.length} exact resources/intents`);throw error;}
}
import {Manifest} from '../../runtime/manifest.js';import {N8nCloudAdapter} from '../n8n-cloud/index.js';import {prepareWorkflow} from '../../security/workflow.js';import {randomUUID} from 'node:crypto';import type {ExecutionObservation} from '../../runtime/types.js';
export async function qualifyBootstrap(stateDirectory:string,pins:ImageSet=imagePins,signal=AbortSignal.timeout(180000)){
 const engine=new DockerEngine(),owner=await engine.identity(),runId=randomUUID().replaceAll('-','');const journal=new ResourceJournal(stateDirectory,runId,owner);const executions:ExecutionObservation[]=[];let instance:BootstrappedInstance|undefined;let diagnostic:string|undefined;
 try{
  instance=await bootstrap({stateDirectory,journal,engine,pins},signal);
  const manifest=new Manifest(stateDirectory,runId+'-proof',instance.client.baseUrl),adapter=new N8nCloudAdapter(instance.client as any,manifest,{managedDocker:true});await adapter.doctor();
  const source=JSON.stringify({name:'Webhook qualification',nodes:[{id:'input',name:'Input',type:'n8n-nodes-base.webhook',typeVersion:2,position:[0,0],parameters:{httpMethod:'POST',path:'proof',responseMode:'onReceived',options:{}}},{id:'result',name:'Result',type:'n8n-nodes-base.noOp',typeVersion:1,position:[200,0],parameters:{}}],connections:{Input:{main:[[{node:'Result',type:'main',index:0}]]}}});
  const p=prepareWorkflow(source,'http://gateway.invalid',runId,'proof','proof-token'),h=await adapter.importWorkflow(p,runId,'proof');
  try{await adapter.activate(h,signal);const marker=randomUUID(),r=await instance.client.http('/webhook/'+p.webhookPath,'POST',{synthetic:'qualification'},signal,{'x-wfcheck-correlation':marker});if(r.status!==200)throw new HarnessError('TRIGGER','Qualification Webhook was rejected');executions.push(await adapter.observe(h,marker,signal));}finally{await adapter.cleanup(h);}
 }catch(error){diagnostic=error instanceof HarnessError?error.code+': '+redactor.text(error.message):'INFRASTRUCTURE';}
 const recovery=await recoverOwned(journal,owner,engine);
 return {status:!diagnostic&&executions.some(e=>e.status==='success')&&!recovery.leftovers.length?'qualified':'blocked',executions,...(instance?{version:instance.version,imageDigest:instance.imageDigest,catalogHash:instance.catalog.sha256}:{}),diagnostics:diagnostic?[diagnostic]:[],leftovers:recovery.leftovers};
}
