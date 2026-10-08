import {it,expect} from 'vitest';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,readdir,writeFile,rm,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {sha256} from '../../src/spec/load.js';
import {DockerEngine} from '../../src/adapters/docker/engine.js';
import {selectImages} from '../../src/adapters/docker/images.js';
const exec=promisify(execFile);
it('installed package onboards an unfamiliar consumer and preserves an unrelated Docker sentinel',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wfcheck-consumer-')),engine=new DockerEngine();let sentinel:string|undefined;let clean=false;
 try{
  const name='acceptance-sentinel-'+Date.now();const pins=selectImages(await engine.architecture());
  sentinel=await engine.exec(['create','--name',name,'--network','none','--label','wfcheck.acceptance=sentinel',pins.gatewayBase,'node','-e','setInterval(()=>{},1000)']);await engine.exec(['start',sentinel]);
  const pack=await exec('npm',['pack','--pack-destination',root],{cwd:process.cwd(),maxBuffer:1048576});const archive=pack.stdout.trim().split('\n').at(-1)!;
  await mkdir(join(root,'consumer'));await exec('npm',['install','--no-audit','--no-fund','--prefix',join(root,'consumer'),join(root,archive)],{maxBuffer:1048576});
  const cli=join(root,'consumer/node_modules/wfcheck-local-alpha/dist/cli/main.js');
  const run=async(args:string[],expected=0)=>{try{const r=await exec(process.execPath,[cli,...args],{cwd:join(root,'consumer'),maxBuffer:2097152,timeout:180000});expect(expected,r.stdout+r.stderr).toBe(0);return r.stdout;}catch(e:any){expect(e.code,e.stdout+e.stderr).toBe(expected);return e.stdout;}};
  expect(await run(['--help'])).toContain('inspect');await run(['init','new-project']);
  const workflow={name:'Unfamiliar order acknowledgement',nodes:[{id:'input',name:'Input',type:'n8n-nodes-base.webhook',typeVersion:2,position:[0,0],parameters:{httpMethod:'POST',path:'orders',responseMode:'onReceived',options:{}}},{id:'map',name:'Fields',type:'n8n-nodes-base.set',typeVersion:3.4,position:[200,0],parameters:{assignments:{assignments:[{id:'reference',name:'reference',value:'={{ $json.body.reference }}',type:'string'}]},options:{}}},{id:'notify',name:'Acknowledge',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[400,0],parameters:{method:'POST',url:'https://orders.example.test/acknowledge',sendBody:true,contentType:'json',specifyBody:'keypair',bodyParameters:{parameters:[{name:'reference',value:'={{ $json.reference }}'}]},options:{}}}],connections:{Input:{main:[[{node:'Fields',type:'main',index:0}]]},Fields:{main:[[{node:'Acknowledge',type:'main',index:0}]]}}};
  const source=JSON.stringify(workflow);await writeFile(join(root,'consumer/workflow.json'),source);await writeFile(join(root,'consumer/input.json'),JSON.stringify({reference:'order-synthetic-42'}));
  const inventory=JSON.parse(await run(['inspect','workflow.json'],2));expect(inventory.nodes).toHaveLength(3);
  await run(['plan','workflow.json','--out','draft.yaml'],2);await run(['run','draft.yaml','--runtime','docker'],2);
  const unknown=structuredClone(workflow);unknown.nodes[2]!.type='unfamiliar.customNode';await writeFile(join(root,'consumer/unknown.json'),JSON.stringify(unknown));const diagnostic=JSON.parse(await run(['inspect','unknown.json'],2));expect(diagnostic.nodes).toHaveLength(3);expect(diagnostic.diagnostics.length).toBeGreaterThan(0);
  // Independent behavior oracle: caller reference must reach the acknowledged JSON.
  const suite={schemaVersion:2,name:'external-order-acknowledgement',tests:[{id:'acknowledge',workflow:'workflow.json',trust:{sourceHash:sha256(source),reviewedCode:[]},input:{kind:'json',fixture:'input.json'},timeoutMs:30000,verificationKind:'behavior',bindings:[{nodeId:'notify',expectedUrl:'https://orders.example.test/acknowledge',mockPath:'/ack'}],mocks:[{id:'ack',method:'POST',path:'/ack',responses:[{kind:'json',status:200,json:{accepted:true}}]}],assertions:[{target:'execution.status',equals:'success'},{target:'request.json',mockId:'ack',pointer:'/reference',equals:'order-synthetic-42'},{target:'requests.count',mockId:'ack',equals:1}]}]};
  await writeFile(join(root,'consumer/suite.json'),JSON.stringify(suite));await run(['run','suite.json','--runtime','docker','--json','result.json']);const result=JSON.parse(await readFile(join(root,'consumer/result.json'),'utf8'));expect(result.runtime?.version).toBe('2.42.4');expect(result.runtime?.nodeCatalogHash).toMatch(/^[a-f0-9]{64}$/);expect(result.exitCode).toBe(0);expect(result.tests[0].evidence.execution.status).toBe('success');
  const journals=(await readdir(join(root,'consumer/.wfcheck'))).filter(n=>n.startsWith('journal-'));expect(journals).toHaveLength(1);await run(['cleanup','.wfcheck/'+journals[0]]);expect(JSON.parse(await engine.exec(['inspect',sentinel]))[0].State.Running).toBe(true);
  const bad=structuredClone(suite);bad.tests[0]!.trust.sourceHash='0'.repeat(64);await writeFile(join(root,'consumer/bad.json'),JSON.stringify(bad));expect(await run(['run','bad.json','--runtime','docker'],2)).toContain('executions: 0');expect((await readdir(join(root,'consumer/.wfcheck'))).filter(n=>n.startsWith('journal-'))).toEqual(journals);
  if(process.env.WFCHECK_E2E_EVIDENCE_DIR){await mkdir(process.env.WFCHECK_E2E_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.WFCHECK_E2E_EVIDENCE_DIR,'installed-consumer.json'),JSON.stringify({package:archive,inventoryHash:sha256(JSON.stringify(inventory)),sourceHash:sha256(source),result,journal:JSON.parse(await readFile(join(root,'consumer/.wfcheck',journals[0]!),'utf8')),sentinel:{id:sentinel,name,preserved:true}},null,2));}clean=true;
 }finally{if(sentinel)await engine.exec(['rm','-f',sentinel]);if(clean)await rm(root,{recursive:true,force:true});}
},300000);

it('interrupt during real Docker bootstrap cleans confirmed exact resources without triggering a workflow',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'wfcheck-abort-')),controller=new AbortController();let caught:unknown;let stopped=false;
 const {createRuntime}=await import('../../src/runtime/factory.js');
 const startup=createRuntime({runtime:'docker',stateDirectory:directory},controller.signal).catch(e=>{caught=e;});
 try{
  const deadline=Date.now()+15000;let found=false;
  while(Date.now()<deadline&&!found){for(const file of await readdir(directory)){if(file.startsWith('journal-')){const j=JSON.parse(await readFile(join(directory,file),'utf8'));found=j.entries.some((e:any)=>e.kind==='container'&&e.state==='owned');}}if(!found)await new Promise(r=>setTimeout(r,100));}
  expect(found).toBe(true);controller.abort();await startup;stopped=true;expect(caught).toBeDefined();
  for(const file of (await readdir(directory)).filter(n=>n.startsWith('journal-'))){const j=JSON.parse(await readFile(join(directory,file),'utf8'));expect(j.entries.some((e:any)=>e.kind==='execution')).toBe(false);expect(j.entries.every((e:any)=>e.state==='cleaned'),JSON.stringify(j)).toBe(true);}
 }finally{controller.abort();await startup;if(stopped)await rm(directory,{recursive:true,force:true});}
});
