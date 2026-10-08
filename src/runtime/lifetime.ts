import {HarnessError} from '../security/errors.js';
export class RuntimeLifetime {
 private closing?:Promise<void>;private retained=false;private unwatch?:()=>void;
 constructor(private cleanup:()=>Promise<void>,private keepOnFailure:boolean,private journalPath:string,private detach:()=>void=()=>{}){}
 watch(signal:AbortSignal){const stop=()=>{void this.close().catch(()=>{});};signal.addEventListener('abort',stop,{once:true});this.unwatch=()=>signal.removeEventListener('abort',stop);if(signal.aborted)stop();}
 async close(failed=false){if(failed&&this.keepOnFailure&&!this.closing&&!this.retained){this.retained=true;this.unwatch?.();this.detach();}if(this.retained)throw new HarnessError('CLEANUP',`Runtime retained explicitly; recover exact IDs using ${this.journalPath}`);this.closing??=(async()=>{this.unwatch?.();await this.cleanup();})();return this.closing;}
}
