import {mkdir,writeFile,unlink} from 'node:fs/promises';import {join} from 'node:path';import {HarnessError} from '../../security/errors.js';import {redactor} from '../../security/redact.js';
export class GeneratedEnvironment {
 private constructor(readonly path:string,readonly runId:string){}
 static async create(directory:string,runId:string,role:string,values:Record<string,string>){if(!/^[A-Za-z0-9_-]{1,128}$/.test(runId)||!/^[a-z-]+$/.test(role)||Object.entries(values).some(([k,v])=>!/^([A-Z][A-Z0-9_]+)$/.test(k)||/[\r\n\0]/.test(v)))throw new HarnessError('CONFIG','Invalid generated runtime environment');await mkdir(directory,{recursive:true,mode:0o700});const path=join(directory,`runtime-${runId}-${role}.env`);for(const[k,v]of Object.entries(values))if(/TOKEN|SECRET|KEY|PASSWORD/.test(k))redactor.add(v);await writeFile(path,Object.entries(values).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600,flag:'wx'});return new GeneratedEnvironment(path,runId);}
 async dispose(){await unlink(this.path);}
}
