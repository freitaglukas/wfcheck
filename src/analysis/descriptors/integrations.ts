import type {CapabilityDescriptor} from '../types.js';
const base={analyzed:true,executable:false,mockable:false,observable:true,isolatable:false};
export const integrations:CapabilityDescriptor[]=[
 {...base,type:'n8n-nodes-base.httpRequest',versions:[4.2],operations:['GET','HEAD'],effect:'read',executable:true,mockable:true,isolatable:true},
 {...base,type:'n8n-nodes-base.httpRequest',versions:[4.2],operations:['POST','PUT','PATCH','DELETE'],effect:'write',executable:true,mockable:true,isolatable:true},
 {...base,type:'n8n-nodes-base.dataTable',versions:[1],operations:['get'],effect:'read',executable:true,isolatable:true},
 {...base,type:'n8n-nodes-base.dataTable',versions:[1],operations:['upsert'],effect:'write',executable:true,isolatable:true},
 {...base,type:'@n8n/n8n-nodes-langchain.lmChatOpenAi',versions:[1,1.1,1.2],effect:'llm'},
 {...base,type:'@n8n/n8n-nodes-langchain.lmChatOpenAi',versions:[1.3],effect:'llm',executable:true,isolatable:true},
 {...base,type:'@n8n/n8n-nodes-langchain.chainLlm',versions:[1.9],effect:'pure',executable:true,isolatable:true}
];
