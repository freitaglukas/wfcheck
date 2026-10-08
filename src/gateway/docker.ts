import {randomUUID} from 'node:crypto';import type {Readable,Writable} from 'node:stream';import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {HarnessError} from '../security/errors.js';import type {GatewayTransport,GatewaySnapshot} from './transport.js';import type {GatewayCase} from '../runtime/types.js';import type {MockRule} from '../spec/schema.js';import {redactor} from '../security/redact.js';
export class GatewayIpc {
 private pending=new Map<string,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:NodeJS.Timeout}>();private buffer='';private failed?:Error;
 constructor(private input:Writable,output:Readable,private timeoutMs=5000){output.on('data',chunk=>{this.buffer+=chunk.toString();if(Buffer.byteLength(this.buffer)>8*1024*1024){this.fail();return;}let index;while((index=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,index);this.buffer=this.buffer.slice(index+1);try{const frame=JSON.parse(line);if(typeof frame.id!=='string'||typeof frame.ok!=='boolean')throw Error();const call=this.pending.get(frame.id);if(!call)throw Error();this.pending.delete(frame.id);clearTimeout(call.timer);if(frame.ok)call.resolve(frame.value);else call.reject(new HarnessError('GATEWAY','Gateway sidecar rejected command: '+(typeof frame.error==='string'?frame.error:'invalid reply')));}catch{this.fail();return;}}});output.on('close',()=>this.fail());output.on('error',()=>this.fail());input.on('error',()=>this.fail());}
 private fail(){this.failed=new HarnessError('GATEWAY','Gateway transport failed; capture is unavailable');for(const c of this.pending.values()){clearTimeout(c.timer);c.reject(this.failed);}this.pending.clear();}
 call(op:string,args:Record<string,unknown>):Promise<any>{if(this.failed)return Promise.reject(this.failed);const id=randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new HarnessError('GATEWAY','Gateway acknowledgement missing; evidence is unavailable'));},this.timeoutMs);this.pending.set(id,{resolve,reject,timer});this.input.write(JSON.stringify({id,op,...args})+'\n');});}
}
export class DockerGateway implements GatewayTransport {
 private child:ChildProcessWithoutNullStreams;private ipc:GatewayIpc;
 constructor(readonly containerId:string){this.child=spawn('docker',['start','-a','-i',containerId],{shell:false,stdio:'pipe'});this.child.stderr.on('data',()=>{});this.child.on('error',()=>this.child.stdout.destroy());this.ipc=new GatewayIpc(this.child.stdin,this.child.stdout);}
 async ready(){await this.ipc.call('ready',{});}
 async register(runId:string,testId:string,mocks:MockRule[],ttlMs:number,models?:import('../llm/gateway.js').ModelGatewayConfig):Promise<GatewayCase>{const c=await this.ipc.call('register',{runId,testId,mocks,ttlMs,...(models?{models}:{})});if(typeof c?.token!=='string'||c.runId!==runId||c.testId!==testId)throw new HarnessError('EVIDENCE','Invalid gateway registration');redactor.add(c.token);return c;}
 async drain(runId:string,testId:string){await this.ipc.call('drain',{runId,testId});}
 async snapshot(runId:string,testId:string):Promise<GatewaySnapshot>{const s=await this.ipc.call('snapshot',{runId,testId});if(!Array.isArray(s?.requests)||!Array.isArray(s?.errors))throw new HarnessError('EVIDENCE','Gateway capture missing');return s;}
 async seal(runId:string,testId:string){await this.ipc.call('seal',{runId,testId});}
 detach(){this.child.stdin.end();this.child.stdout.destroy();this.child.stderr.destroy();this.child.unref();}
 async close(){try{await this.ipc.call('close',{});}finally{this.child.stdin.end();this.child.kill();}}
}
