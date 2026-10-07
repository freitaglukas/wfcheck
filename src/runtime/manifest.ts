import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HarnessError } from '../security/errors.js';
export interface OwnedResource {runId:string;testId:string;name:string;workflowId?:string;executionIds:string[];state:'creating'|'owned'|'cleaned';}
export class Manifest {
  readonly path:string;
  entries:OwnedResource[]=[];
  constructor(readonly directory:string,readonly runId:string,readonly baseUrl:string){this.path=join(directory,`manifest-${runId}.json`);}
  async save():Promise<void>{await mkdir(this.directory,{recursive:true,mode:0o700});const tmp=this.path+'.tmp';await writeFile(tmp,JSON.stringify({schemaVersion:1,runId:this.runId,baseUrl:this.baseUrl,entries:this.entries},null,2)+'\n',{mode:0o600});await rename(tmp,this.path);}
  async begin(testId:string,name:string):Promise<OwnedResource>{const e:OwnedResource={runId:this.runId,testId,name,executionIds:[],state:'creating'};this.entries.push(e);await this.save();return e;}
  owned(id:string):OwnedResource {const e=this.entries.find(e=>e.workflowId===id&&e.state==='owned');if(!e)throw new HarnessError('OWNERSHIP',`Workflow ${id} is absent from the exact-ID ownership manifest`);return e;}
  leftovers():OwnedResource[]{return this.entries.filter(e=>e.state!=='cleaned');}
  static async load(path:string):Promise<Manifest>{const j=JSON.parse(await readFile(path,'utf8'));if(j.schemaVersion!==1||!Array.isArray(j.entries))throw new HarnessError('CONFIG','Invalid ownership manifest');const m=new Manifest(join(path,'..'),j.runId,j.baseUrl);m.entries=j.entries;return m;}
}
