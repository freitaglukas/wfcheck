import type {CapabilityDescriptor} from '../types.js';
const pure=(type:string,versions:number[]):CapabilityDescriptor=>({type,versions,effect:'pure',analyzed:true,executable:true,mockable:false,observable:true,isolatable:true});
export const core:CapabilityDescriptor[]=[
 {...pure('n8n-nodes-base.webhook',[2]),driver:'webhook-json'},
 pure('n8n-nodes-base.set',[3.4]),pure('n8n-nodes-base.if',[2.2]),pure('n8n-nodes-base.filter',[2.2]),pure('n8n-nodes-base.noOp',[1]),
 {...pure('n8n-nodes-base.formTrigger',[2.2]),driver:'form-file'},
 pure('n8n-nodes-base.extractFromFile',[1]),
 {...pure('n8n-nodes-base.code',[2]),effect:'opaque'}
];
