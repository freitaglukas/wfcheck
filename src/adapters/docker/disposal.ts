import type {ResourceJournal} from '../../runtime/journal.js';
import {HarnessError} from '../../security/errors.js';
interface StateInspector {identity():Promise<string>;exec(args:string[]):Promise<string>;}
/** API records cannot outlive their exact, removed SQLite/binary state volume. */
export async function reconcileDisposedState(journal:ResourceJournal,engine:StateInspector){
 if(journal.ownerIdentity!==await engine.identity()||!journal.ownerIdentity.startsWith('docker:'))throw new HarnessError('OWNERSHIP','State disposal daemon identity changed');
 const records=journal.records(),volumes=records.filter(e=>e.kind==='volume'&&e.state==='cleaned'&&e.id&&e.id===e.name);
 if(!volumes.length)return;
 const raw=await engine.exec(['volume','ls','--format','{{json .Name}}']);const present=new Set(raw?raw.split('\n').map(line=>JSON.parse(line)):[]);
 if([...present].some(v=>typeof v!=='string'))throw new HarnessError('EVIDENCE','Volume absence evidence is malformed');
 for(const volume of volumes){if(present.has(volume.id!))continue;
  for(const e of journal.leftovers().filter(e=>['workflow','execution','credential','table'].includes(e.kind))){const parent=e.kind==='execution'?records.find(w=>w.kind==='workflow'&&w.id===e.parentId)?.parentId:e.parentId;if(parent===volume.id)await journal.markStateDisposed(e.intentId,volume.id!);}
 }
}
