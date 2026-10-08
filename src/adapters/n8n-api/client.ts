import {CloudClient} from '../n8n-cloud/client.js';import {ResourceJournal} from '../../runtime/journal.js';import {HarnessError} from '../../security/errors.js';
export function ownedLoopbackClient(origin:string,key:string,journal:ResourceJournal,containerId:string):CloudClient {
 const u=new URL(origin);if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!u.port||u.pathname!=='/'||u.search||u.hash||u.username||u.password||!journal.ownerIdentity.startsWith('docker:')||!journal.leftovers().some(e=>e.kind==='container'&&e.state==='owned'&&e.id===containerId))throw new HarnessError('OWNERSHIP','Insecure API origin requires an exact owned loopback container');
 return new CloudClient(origin,key,{ownedLoopback:true});
}
