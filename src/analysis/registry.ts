import {core} from './descriptors/core.js';
import {integrations} from './descriptors/integrations.js';
import type {CapabilityDescriptor} from './types.js';
export function lookupCapability(type:string,version:number,operation?:string):CapabilityDescriptor|undefined{
 const found=[...core,...integrations].find(d=>d.type===type&&d.versions.includes(version)&&(!d.operations||d.operations.includes(operation??(type==='n8n-nodes-base.httpRequest'?'GET':''))));
 return found?structuredClone(found):undefined;
}
