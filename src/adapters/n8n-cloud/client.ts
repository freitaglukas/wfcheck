import { HarnessError } from '../../security/errors.js';
import { redactor } from '../../security/redact.js';
export class CloudClient {
  readonly baseUrl:string;
  constructor(baseUrl:string,private key:string){
    const u=new URL(baseUrl);
    if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw new HarnessError('CONFIG','N8N_BASE_URL must be an HTTPS instance origin');
    if(!key)throw new HarnessError('CONFIG','N8N_API_KEY is required');
    this.baseUrl=u.origin;redactor.add(key);
  }
  async request(path:string,method='GET',body?:unknown,signal?:AbortSignal):Promise<any> {
    const abort=signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000);
    let response:Response;
    try{response=await fetch(this.baseUrl+'/api/v1/'+path,{method,headers:{'X-N8N-API-KEY':this.key,'content-type':'application/json','accept':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:abort});}
    catch{throw new HarnessError(signal?.aborted?'TIMEOUT':'API',`${method} ${path.split('?')[0]} failed or timed out; writes are not retried`);}
    if(!response.ok)throw new HarnessError('API',`${method} ${path.split('?')[0]} returned HTTP ${response.status}`);
    if(response.status===204)return undefined;
    let bytes=0;const chunks:Uint8Array[]=[];
    if(response.body)for await(const c of response.body){bytes+=c.length;if(bytes>8*1024*1024)throw new HarnessError('EVIDENCE','Public API response exceeds 8 MiB');chunks.push(c);}
    const text=Buffer.concat(chunks).toString('utf8');if(!text)return undefined;
    try{return JSON.parse(text);}catch{throw new HarnessError('API','Public API returned invalid JSON');}
  }
}
