import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { MockRule } from '../spec/schema.js';
import type { RequestObservation, GatewayCase } from '../runtime/types.js';
import { atPointer } from '../assertions/index.js';
import { isDeepStrictEqual } from 'node:util';
import { HarnessError } from '../security/errors.js';
import { redactor } from '../security/redact.js';
import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Agent,fetch as gatewayFetch } from 'undici';
interface State extends GatewayCase {requests:RequestObservation[];errors:string[];cursors:Map<string,number>;sealed:boolean;accepted:number;}
function same(a:string,b:string):boolean {const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export class Gateway {
  private dispatcher?:Agent;
  constructor(dnsServer?:string){
    if(dnsServer){
      if(!isIP(dnsServer))throw new HarnessError('CONFIG','WFCHECK_GATEWAY_DNS_SERVER must be an IP address');
      const resolver=new Resolver({timeout:2000,tries:1});resolver.setServers([dnsServer]);
      this.dispatcher=new Agent({connect:{lookup:(hostname,options,callback)=>{
        resolver.resolve4(hostname).then(addresses=>{
          if(options.all)callback(null,addresses.map(address=>({address,family:4})));
          else callback(null,addresses[0]!,4);
        }).catch(error=>callback(error,'',4));
      }}});
    }
  }
  private server?:Server;
  private cases=new Map<string,State>();
  private timers=new Set<NodeJS.Timeout>();
  private probeToken=randomBytes(32).toString('hex');
  private total=0;
  localUrl='';
  async start(port=0):Promise<void> {
    this.server=createServer((req,res)=>{void this.handle(req,res).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end();});});
    this.server.requestTimeout=10000;this.server.headersTimeout=5000;this.server.maxHeadersCount=32;
    await new Promise<void>((resolve,reject)=>{this.server!.once('error',reject);this.server!.listen(port,'127.0.0.1',()=>resolve());});
    const address=this.server.address();if(!address||typeof address==='string')throw new HarnessError('GATEWAY','Cannot bind gateway');
    this.localUrl='http://127.0.0.1:'+address.port;
  }
  register(runId:string,testId:string,mocks:MockRule[],ttlMs:number):GatewayCase {
    if(!/^[a-zA-Z0-9_-]{1,64}$/.test(runId)||!/^[a-zA-Z0-9_-]{1,64}$/.test(testId))throw new HarnessError('GATEWAY','Invalid namespace');
    const key=runId+'/'+testId;
    if(this.cases.has(key)||this.cases.size>=20)throw new HarnessError('GATEWAY','Duplicate namespace or retention limit');
    const state:State={runId,testId,mocks:structuredClone(mocks),token:randomBytes(32).toString('hex'),expiresAt:Date.now()+Math.min(ttlMs,180000),requests:[],errors:[],cursors:new Map(),sealed:false,accepted:0};
    this.cases.set(key,state);redactor.add(state.token);return state;
  }
  unregister(runId:string,testId:string):void {this.cases.delete(runId+'/'+testId);}
  snapshot(runId:string,testId:string):{requests:RequestObservation[];errors:string[]} {
    const c=this.cases.get(runId+'/'+testId);if(!c)throw new HarnessError('GATEWAY','Missing gateway namespace');
    return structuredClone({requests:c.requests,errors:c.errors});
  }
  seal(runId:string,testId:string):void {const c=this.cases.get(runId+'/'+testId);if(c)c.sealed=true;}
  async probe(publicUrl:string):Promise<void> {
    const url=new URL('/_wfcheck/probe',publicUrl);
    const r=await gatewayFetch(url,{method:'POST',headers:{'x-wfcheck-probe':this.probeToken},redirect:'error',signal:AbortSignal.timeout(10000),dispatcher:this.dispatcher});
    if(r.status!==200||await r.text()!=='wfcheck-gateway')throw new HarnessError('GATEWAY',`HTTPS endpoint does not reach this gateway (HTTP ${r.status})`);
  }
  private async handle(req:IncomingMessage,res:ServerResponse):Promise<void> {
    const finish=(code:number,text:string)=>{res.writeHead(code,{'content-type':'text/plain','cache-control':'no-store'});res.end(text);};
    if(++this.total>3000){finish(429,'Gateway global quota exceeded');for(const c of this.cases.values())c.errors.push('Global request quota exceeded');return;}
    if(req.url==='/_wfcheck/probe'&&req.method==='POST'&&same(String(req.headers['x-wfcheck-probe']??''),this.probeToken)){finish(200,'wfcheck-gateway');return;}
    const match=/^\/r\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)(\/[^?]*)(?:\?.*)?$/.exec(req.url??'');
    if(!match){finish(404,'No route');return;}
    const c=this.cases.get(match[1]+'/'+match[2]);
    if(!c||!same(String(req.headers['x-wfcheck-token']??''),c.token)||Date.now()>c.expiresAt){finish(401,'Invalid or expired test token');return;}
    if(c.sealed){c.errors.push('Request received after test completed');finish(410,'Test completed');return;}
    if(++c.accepted>100){if(!c.errors.includes('Request quota exceeded'))c.errors.push('Request quota exceeded');finish(429,'Request quota exceeded');return;}
    let body='';const chunks:Buffer[]=[];let size=0;
    for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>65536){c.errors.push('Payload limit exceeded');finish(413,'Payload limit exceeded');return;}chunks.push(Buffer.from(chunk));}
    body=Buffer.concat(chunks).toString('utf8');let json:unknown;try{json=JSON.parse(body);}catch{}
    const headers:Record<string,string>={};
    for(const [name,v] of Object.entries(req.headers))if(name!=='x-wfcheck-token'&&name!=='cookie'&&name!=='authorization')headers[name]=Array.isArray(v)?v.join(','):v??'';
    const observation:RequestObservation={method:req.method??'',path:match[3]!,headers,body,json,unexpected:false,receivedAt:new Date().toISOString()};
    c.requests.push(observation);
    const rule=c.mocks.find(m=>m.method===req.method&&m.path===observation.path&&Object.entries(m.headers).every(([k,v])=>headers[k]===v)&&Object.entries(m.bodyFields).every(([p,v])=>isDeepStrictEqual(atPointer(json,p),v)));
    const cursor=rule?c.cursors.get(rule.id)??0:0;const response=rule?.responses[cursor];
    if(!rule||!response){observation.unexpected=true;observation.reason=rule?'Response sequence exhausted':'No matching rule';if(rule)observation.mockId=rule.id;observation.responseStatus=409;finish(409,'Unexpected request');return;}
    observation.mockId=rule.id;observation.responseStatus=response.status;c.cursors.set(rule.id,cursor+1);
    if(response.delayMs)await new Promise<void>(resolve=>{const timer=setTimeout(()=>{this.timers.delete(timer);resolve();},response.delayMs);this.timers.add(timer);});
    if(res.destroyed)return;
    res.writeHead(response.status,{'content-type':response.kind==='text'?'text/plain':'application/json','cache-control':'no-store'});
    res.end(response.kind==='json'?JSON.stringify(response.json):response.text);
  }
  async close():Promise<void> {
    await this.dispatcher?.close();
    for(const t of this.timers)clearTimeout(t);this.timers.clear();
    if(this.server){this.server.closeAllConnections();await new Promise<void>(resolve=>this.server!.close(()=>resolve()));this.server=undefined;}
    this.cases.clear();
  }
}
