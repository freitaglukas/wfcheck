import { spawn, type ChildProcess } from 'node:child_process';
import { HarnessError } from '../security/errors.js';
export class TemporaryTunnel {
  private child?:ChildProcess;
  async open(localUrl:string,signal?:AbortSignal):Promise<string> {
    return new Promise<string>((resolve,reject)=>{
      const child=spawn('cloudflared',['tunnel','--url',localUrl,'--no-autoupdate','--protocol','http2'],{stdio:['ignore','pipe','pipe']});this.child=child;
      let buffer='';let done=false;let publicUrl:string|undefined;
      const end=(error?:Error,url?:string)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error){this.close();reject(error);}else resolve(url!);};
      const timer=setTimeout(()=>end(new HarnessError('TUNNEL','Temporary HTTPS tunnel startup timed out')),30000);
      const abort=()=>end(new HarnessError('INTERRUPTED','Tunnel interrupted'));
      signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      const read=(chunk:Buffer)=>{buffer=(buffer+chunk.toString()).slice(-8192);const match=/https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(buffer);if(match)publicUrl=match[0];if(publicUrl&&buffer.includes('Registered tunnel connection'))end(undefined,publicUrl);};
      child.stdout!.on('data',read);child.stderr!.on('data',read);
      child.once('error',()=>end(new HarnessError('TUNNEL','cloudflared is unavailable; install it or configure WFCHECK_GATEWAY_URL')));
      child.once('exit',()=>end(new HarnessError('TUNNEL','Temporary HTTPS tunnel exited during startup')));
    });
  }
  close():void {this.child?.kill('SIGTERM');this.child=undefined;}
}
