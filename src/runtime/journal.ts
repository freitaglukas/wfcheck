import {mkdir,open,rename,readFile,unlink,stat} from 'node:fs/promises';
import {join,dirname} from 'node:path';import {randomUUID} from 'node:crypto';import {z} from 'zod';
import {HarnessError} from '../security/errors.js';
const identity=z.string().min(1).max(512);
const recordSchema=z.strictObject({intentId:identity,runId:identity,testId:identity.optional(),kind:z.enum(['workflow','execution','credential','table','container','network','volume']),name:identity,id:identity.optional(),ownerIdentity:identity,parentId:identity.optional(),notCreated:z.literal('authenticated-trigger-rejected').optional(),disposition:z.literal('owned-state-volume-removed').optional(),state:z.enum(['creating','owned','cleaned'])});
const documentSchema=z.strictObject({schemaVersion:z.literal(2),runId:identity,ownerIdentity:identity,entries:z.array(recordSchema).max(1000)});
export type OwnedRecord=z.infer<typeof recordSchema>;export type ResourceKind=OwnedRecord['kind'];
export class ResourceJournal {
 readonly path:string;private entries:OwnedRecord[]=[];private pending=Promise.resolve();private expectedDisk:string|undefined;
 constructor(readonly directory:string,readonly runId:string,readonly ownerIdentity:string){identity.parse(runId);identity.parse(ownerIdentity);if(!/^[A-Za-z0-9_-]{1,128}$/.test(runId))throw new HarnessError('CONFIG','Invalid run identity');this.path=join(directory,`journal-${runId}.json`);}
 private async mutation(action:()=>void):Promise<void>{
  const work=this.pending.then(async()=>{await mkdir(this.directory,{recursive:true,mode:0o700});let lock;try{lock=await open(this.path+'.lock','wx',0o600);}catch{throw new HarnessError('LOCK','Journal lock exists; verify the recorded controller before recovery');}
   try{const current=await readFile(this.path,'utf8').catch((e:any)=>{if(e.code==='ENOENT')return undefined;throw e;});if(current!==this.expectedDisk)throw new HarnessError('LOCK','Ownership journal changed; reload after the controller has stopped');action();const content=JSON.stringify({schemaVersion:2,runId:this.runId,ownerIdentity:this.ownerIdentity,entries:this.entries},null,2)+'\n';const temp=this.path+'.'+randomUUID()+'.tmp';const file=await open(temp,'wx',0o600);try{await file.writeFile(content);await file.sync();}finally{await file.close();}await rename(temp,this.path);this.expectedDisk=content;}finally{await lock.close();await unlink(this.path+'.lock');}
  });this.pending=work.catch(()=>{});return work;
 }
 async begin(input:Omit<OwnedRecord,'intentId'|'id'|'state'>):Promise<OwnedRecord>{
  if(input.runId!==this.runId||input.ownerIdentity!==this.ownerIdentity)throw new HarnessError('OWNERSHIP','Resource identity differs from journal identity');
  const entry=recordSchema.parse({...input,intentId:randomUUID(),state:'creating'});await this.mutation(()=>{if(this.entries.length>=1000)throw new HarnessError('CONFIG','Ownership journal resource budget exhausted');this.entries.push(entry);});return structuredClone(entry);
 }
 private entry(intentId:string){const e=this.entries.find(e=>e.intentId===intentId);if(!e)throw new HarnessError('OWNERSHIP','Unknown recovery intent');return e;}
 async confirm(intentId:string,id:string):Promise<void>{const e=this.entry(intentId);identity.parse(id);if(e.state!=='creating'||e.id&&e.id!==id)throw new HarnessError('OWNERSHIP','Recovery intent already has a different identity');e.id=id;await this.mutation(()=>{e.state='owned';});}
 async markCleaned(intentId:string):Promise<void>{const e=this.entry(intentId);if(!e.id)throw new HarnessError('OWNERSHIP','Uncertain intent cannot be marked clean');await this.mutation(()=>{e.state='cleaned';});}
 async cancelRejectedExecution(intentId:string){const e=this.entry(intentId);if(e.kind!=='execution'||e.state!=='creating'||e.id)throw new HarnessError('OWNERSHIP','Only a definitely rejected execution intent can be cancelled');await this.mutation(()=>{e.state='cleaned';e.notCreated='authenticated-trigger-rejected';});}
 records():OwnedRecord[]{return structuredClone(this.entries);}
 async markStateDisposed(intentId:string,volumeId:string){const e=this.entry(intentId),volume=this.entries.find(v=>v.kind==='volume'&&v.id===volumeId&&v.state==='cleaned');const parent=e.kind==='execution'?this.entries.find(w=>w.kind==='workflow'&&w.id===e.parentId)?.parentId:e.parentId;if(!this.ownerIdentity.startsWith('docker:')||!volume||!['workflow','execution','credential','table'].includes(e.kind)||parent!==volumeId)throw new HarnessError('OWNERSHIP','API intent is not backed by the confirmed removed state volume');await this.mutation(()=>{e.state='cleaned';e.disposition='owned-state-volume-removed';});}
 leftovers():OwnedRecord[]{return structuredClone(this.entries.filter(e=>e.state!=='cleaned'));}
 static async load(path:string):Promise<ResourceJournal>{
  if((await stat(path)).size>1024*1024)throw new HarnessError('CONFIG','Ownership journal too large');const text=await readFile(path,'utf8'),raw=JSON.parse(text);
  if(raw.schemaVersion===1){
   const legacy=z.strictObject({schemaVersion:z.literal(1),runId:identity,baseUrl:identity,entries:z.array(z.strictObject({runId:identity,testId:identity,name:identity,workflowId:identity.optional(),executionIds:z.array(identity),state:z.enum(['creating','owned','cleaned'])}))}).parse(raw);
   const j=new ResourceJournal(dirname(path),legacy.runId,legacy.baseUrl);j.expectedDisk=text;
   for(const e of legacy.entries){if(e.runId!==j.runId)throw new HarnessError('OWNERSHIP','Legacy manifest identity mismatch');j.entries.push({intentId:randomUUID(),runId:e.runId,testId:e.testId,kind:'workflow',name:e.name,id:e.workflowId,ownerIdentity:j.ownerIdentity,state:e.state});for(const id of e.executionIds)j.entries.push({intentId:randomUUID(),runId:e.runId,testId:e.testId,kind:'execution',name:id,id,parentId:e.workflowId,ownerIdentity:j.ownerIdentity,state:e.state});}return j;
  }
  const d=documentSchema.parse(raw),j=new ResourceJournal(dirname(path),d.runId,d.ownerIdentity);if(d.entries.some(e=>e.ownerIdentity!==d.ownerIdentity||e.runId!==d.runId||e.state==='owned'&&!e.id)||new Set(d.entries.map(e=>e.intentId)).size!==d.entries.length)throw new HarnessError('OWNERSHIP','Journal identity mismatch');j.entries=d.entries;j.expectedDisk=text;return j;
 }
}
