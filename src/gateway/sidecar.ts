import {createInterface} from 'node:readline';import {createServer,connect} from 'node:net';import {z} from 'zod';import {Gateway} from './server.js';import {mockSchema} from '../spec/schema.js';
const id=z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);const base={id:z.string().uuid()};
const command=z.discriminatedUnion('op',[
 z.strictObject({...base,op:z.literal('ready')}),z.strictObject({...base,op:z.literal('close')}),
 z.strictObject({...base,op:z.literal('register'),runId:id,testId:id,mocks:z.array(mockSchema).max(20),ttlMs:z.int().min(1).max(180000),models:z.unknown().optional()}),
 ...(['snapshot','drain','seal'] as const).map(op=>z.strictObject({...base,op:z.literal(op),runId:id,testId:id}))
]);
const host=process.env.WFCHECK_N8N_HOST;if(!host||!/^wfcheck-[A-Za-z0-9_-]+$/.test(host))throw Error('Owned n8n peer required');
const gateway=new Gateway();await gateway.start(43199,'0.0.0.0');
// Fixed peer/port ingress only; no request can choose a proxy destination.
const sockets=new Set<import('node:net').Socket>();const ingress=createServer(socket=>{sockets.add(socket);const peer=connect({host,port:5678});sockets.add(peer);socket.pipe(peer);peer.pipe(socket);const stop=()=>{sockets.delete(socket);sockets.delete(peer);socket.destroy();peer.destroy();};socket.on('error',stop);peer.on('error',stop);socket.on('close',stop);});await new Promise<void>((resolve,reject)=>{ingress.once('error',reject);ingress.listen(5678,'0.0.0.0',resolve);});
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});let queue=Promise.resolve();let closing=false;
lines.on('line',line=>{queue=queue.then(async()=>{let identity='invalid';try{if(Buffer.byteLength(line)>256*1024)throw Error();const c=command.parse(JSON.parse(line));identity=c.id;let value:unknown;
 switch(c.op){case'ready':value={ready:true};break;case'register':{const config=c.models as import('../llm/gateway.js').ModelGatewayConfig|undefined;if(config?.policy.mode==='local'&&config.selection){const endpoint=new URL(config.selection.endpoint);if(['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)){const address=await (await import('node:dns/promises')).lookup('host.docker.internal',{family:4});endpoint.hostname=address.address;config.selection={...config.selection,endpoint:endpoint.origin};}}value=gateway.register(c.runId,c.testId,c.mocks,c.ttlMs,config);break;}case'snapshot':value=gateway.snapshot(c.runId,c.testId);break;case'drain':await gateway.drain(c.runId,c.testId);break;case'seal':gateway.seal(c.runId,c.testId);break;case'close':closing=true;await gateway.close();for(const s of sockets)s.destroy();await new Promise<void>(resolve=>ingress.close(()=>resolve()));break;}
 process.stdout.write(JSON.stringify({id:identity,ok:true,value})+'\n');if(closing){lines.close();process.stdin.pause();}
 }catch{process.stdout.write(JSON.stringify({id:identity,ok:false,error:'Invalid command or unavailable evidence'})+'\n');}});});
process.stdin.on('end',()=>{if(!closing&&process.env.WFCHECK_KEEP_ON_DISCONNECT!=='true'){void gateway.close();for(const s of sockets)s.destroy();ingress.close();}});
