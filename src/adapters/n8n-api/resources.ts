import {ResourceJournal,type OwnedRecord} from '../../runtime/journal.js';import {HarnessError,errorMessage} from '../../security/errors.js';
export async function createOwned(journal:ResourceJournal,input:Pick<OwnedRecord,'kind'|'name'> & {testId?:string;parentId?:string},create:()=>Promise<{id:string;name:string}>):Promise<OwnedRecord>{
 const entry=await journal.begin({...input,runId:journal.runId,ownerIdentity:journal.ownerIdentity});
 const result=await create();if(typeof result?.id!=='string'||result.name!==entry.name)throw new HarnessError('OWNERSHIP','Uncertain create identity; inspect the exact intent before recovery');
 try{await journal.confirm(entry.intentId,result.id);}catch{throw new HarnessError('OWNERSHIP',`Ownership persistence failed for ${entry.kind} ${result.id}; retain its exact intent for recovery`);}return {...entry,id:result.id,state:'owned'};
}
export interface RecoveryDriver {remove(entry:OwnedRecord):Promise<void>;}
export async function recoverOwned(journal:ResourceJournal,ownerIdentity:string,driver:RecoveryDriver,testId?:string):Promise<{errors:string[];leftovers:OwnedRecord[]}>{
 if(journal.ownerIdentity!==ownerIdentity)throw new HarnessError('OWNERSHIP','Recovery runtime identity mismatch');const errors:string[]=[];
 const order={execution:0,workflow:1,credential:2,table:3,container:4,volume:5,network:6};
 const entries=journal.leftovers().filter(e=>!testId||e.testId===testId).sort((a,b)=>order[a.kind]-order[b.kind]);
 for(const e of entries){try{if(!e.id)throw new HarnessError('OWNERSHIP',`Uncertain create ${e.intentId}; identify the exact resource without retrying creation`);if((e.kind==='volume'||e.kind==='network')&&journal.leftovers().some(r=>r.kind==='container'))throw new HarnessError('CLEANUP','Owned container still requires recovery');await driver.remove(e);await journal.markCleaned(e.intentId);}catch(error){errors.push(`${e.kind} ${e.id??e.intentId}: ${errorMessage(error)}`);}}
 return {errors,leftovers:journal.leftovers().filter(e=>!testId||e.testId===testId)};
}
