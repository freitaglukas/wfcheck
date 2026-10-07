import { setTimeout as delay } from 'node:timers/promises';
import { mkdir,open,unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Gateway } from '../gateway/server.js';
import { TemporaryTunnel } from '../gateway/tunnel.js';
import { HarnessError } from '../security/errors.js';
export async function publicGateway(gateway:Gateway,tunnel:TemporaryTunnel,options:{gatewayUrl?:string;gatewayPort:number},kind:string,signal:AbortSignal):Promise<string> {
  if(!['cloudflared','external'].includes(kind))throw new HarnessError('CONFIG','--tunnel must be cloudflared or external');
  if(kind==='external'&&!options.gatewayUrl)throw new HarnessError('CONFIG','External tunnel requires WFCHECK_GATEWAY_URL and WFCHECK_GATEWAY_PORT');
  await gateway.start(options.gatewayPort);
  const url=kind==='external'?options.gatewayUrl!:await tunnel.open(gateway.localUrl,signal);
  for(let attempt=0;attempt<10&&!signal.aborted;attempt++){
    try{await gateway.probe(url);return url;}catch{if(attempt===9)throw new HarnessError('GATEWAY','Temporary HTTPS endpoint did not reach the authenticated gateway after 10 bounded probes');}
    await delay(1000,undefined,{signal}).catch(()=>{});
  }
  throw new HarnessError('INTERRUPTED','Gateway setup interrupted');
}
export async function acquireLock(directory:string):Promise<()=>Promise<void>> {
  await mkdir(directory,{recursive:true,mode:0o700});const path=join(directory,'run.lock');
  let file;try{file=await open(path,'wx',0o600);}catch{throw new HarnessError('LOCK',`A run lock exists at ${path}. Verify no wfcheck process is active before removing a stale lock and recovering manifests.`);}
  await file.writeFile(String(process.pid));await file.close();return ()=>unlink(path);
}
