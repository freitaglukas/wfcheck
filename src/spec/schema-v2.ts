import {z} from 'zod';
import {assertionSchema,mockSchema} from './schema.js';
const id=z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),hash=z.string().regex(/^[a-f0-9]{64}$/);
const path=z.string().min(1).max(512),pointer=z.string().max(512).refine(v=>v===''||/^\/(?:[^~]|~[01])*$/.test(v));
const index=z.int().min(0).max(1000),column=z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/);
export interface JsonSchemaNode {type?:string|string[];required?:string[];properties?:Record<string,JsonSchemaNode>;additionalProperties?:boolean;enum?:unknown[];items?:JsonSchemaNode;minLength?:number;maxLength?:number;minimum?:number;maximum?:number;minItems?:number;maxItems?:number;}
const jsonTypes=z.enum(['object','array','string','number','integer','boolean','null']);
export const jsonSchemaNode:z.ZodType<JsonSchemaNode>=z.lazy(()=>z.strictObject({type:z.union([jsonTypes,z.array(jsonTypes).min(1).max(7)]).optional(),required:z.array(column).max(100).optional(),properties:z.record(column,jsonSchemaNode).optional(),additionalProperties:z.boolean().optional(),enum:z.array(z.json()).min(1).max(100).optional(),items:jsonSchemaNode.optional(),minLength:index.optional(),maxLength:index.optional(),minimum:z.number().optional(),maximum:z.number().optional(),minItems:index.optional(),maxItems:index.optional()}));
function depth(s:JsonSchemaNode,n=0):boolean{return n<=8&&Object.values(s.properties??{}).every(v=>depth(v,n+1))&&(!s.items||depth(s.items,n+1));}
const schemaBounded=jsonSchemaNode.refine(s=>depth(s)&&Buffer.byteLength(JSON.stringify(s))<=65536,'Schema exceeds depth/size limit');
const node={nodeId:id,runIndex:index.default(0),outputIndex:index.default(0),itemIndex:index.default(0),pointer:pointer.default('')};
export const assertionV2Schema=z.union([assertionSchema,
 z.strictObject({target:z.literal('node.schema'),...node,schema:schemaBounded}),
 z.strictObject({target:z.literal('request.schema'),mockId:id,requestIndex:index.default(0),pointer:pointer.default(''),schema:schemaBounded}),
 z.strictObject({target:z.literal('table.count'),tableId:id,equals:index}),
 z.strictObject({target:z.literal('table.row'),tableId:id,key:z.strictObject({field:column,value:z.json()}),pointer,equals:z.json()})
]);
export const llmDefaultsSchema=z.strictObject({mode:z.enum(['mock','local','replay']).optional(),provider:z.enum(['ollama','openai-compatible']).optional(),endpoint:z.string().url().optional(),model:z.string().min(1).max(256).optional(),preferences:z.array(z.string().max(256)).max(20).optional(),temperature:z.number().min(0).max(2).optional(),seed:z.int().min(0).max(2147483647).optional(),maxOutputTokens:z.int().min(1).max(2048).optional(),contextTokens:z.int().min(1).max(8192).optional(),timeoutMs:z.int().min(100).max(60000).optional(),maxCalls:z.int().min(1).max(20).optional(),record:path.optional(),replay:path.optional(),replayHash:hash.optional(),identities:path.optional()});
const logicalTable=z.strictObject({id,columns:z.array(z.strictObject({name:column,type:z.enum(['string','number','boolean'])})).min(1).max(20),seedRows:z.array(z.record(column,z.json())).max(100).default([])}).superRefine((t,ctx)=>{
 const names=t.columns.map(c=>c.name);if(new Set(names).size!==names.length)ctx.addIssue({code:'custom',message:'Duplicate table columns'});
 if(t.seedRows.some(r=>Object.keys(r).some(k=>!names.includes(k))))ctx.addIssue({code:'custom',message:'Seed row has unknown column'});
});
export const testV2Schema=z.strictObject({
 id,workflow:path,input:z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('json'),fixture:path}),
 z.strictObject({kind:z.literal('file'),fixture:path,field:z.string().min(1).max(128),mimeType:z.enum(['image/png','image/jpeg','image/webp','application/pdf'])})
 ]),triggerId:id.optional(),timeoutMs:z.int().min(1000).max(120000).default(30000),
 trust:z.strictObject({sourceHash:hash,reviewedCode:z.array(z.strictObject({nodeId:id,codeHash:hash,noExternalEffects:z.literal(true)})).max(200).default([])}).optional(),
 bindings:z.array(z.strictObject({nodeId:id,expectedUrl:z.string().min(1).max(2048),mockPath:z.string().max(256).regex(/^\/[A-Za-z0-9/_-]*$/),protocol:z.enum(['http-json','openai-chat']).default('http-json')})).max(20).default([]),
 tables:z.array(logicalTable).max(20).default([]),
 tableBindings:z.array(z.strictObject({nodeId:id,expectedResourceId:z.string().min(1).max(128),tableId:id,fault:z.literal('missing-table').optional()})).max(200).default([]),
 mocks:z.array(mockSchema).max(20),assertions:z.array(assertionV2Schema).min(1).max(100),
 verificationKind:z.enum(['smoke','baseline','behavior']),llm:llmDefaultsSchema.optional()
}).superRefine((t,ctx)=>{
 if(!t.assertions.some(a=>a.target==='execution.status'))ctx.addIssue({code:'custom',message:'An explicit execution.status assertion is required'});
 for(const list of [t.mocks.map(m=>m.id),t.bindings.map(b=>b.nodeId),t.tableBindings.map(b=>b.nodeId),t.tables.map(v=>v.id),t.trust?.reviewedCode.map(c=>c.nodeId)??[]])if(new Set(list).size!==list.length)ctx.addIssue({code:'custom',message:'Duplicate configuration identity'});
 for(const a of t.assertions){if('mockId'in a&&!t.mocks.some(m=>m.id===a.mockId))ctx.addIssue({code:'custom',message:'Unknown assertion mock'});if('tableId'in a&&!t.tables.some(v=>v.id===a.tableId))ctx.addIssue({code:'custom',message:'Unknown assertion table'});}
 if(t.tableBindings.some(b=>!t.tables.some(v=>v.id===b.tableId)))ctx.addIssue({code:'custom',message:'Unknown table binding'});
 if(new Set(t.mocks.map(m=>m.method+' '+m.path)).size!==t.mocks.length)ctx.addIssue({code:'custom',message:'Duplicate mock method/path'});
});
export const suiteV2Schema=z.strictObject({schemaVersion:z.literal(2),name:z.string().min(1).max(128),draft:z.boolean().default(false),redactValues:z.array(z.string().min(1).max(4096)).max(100).default([]),runtime:z.enum(['cloud','docker']).optional(),llm:llmDefaultsSchema.optional(),tests:z.array(testV2Schema).min(1).max(20)}).superRefine((s,ctx)=>{if(new Set(s.tests.map(t=>t.id)).size!==s.tests.length)ctx.addIssue({code:'custom',message:'Duplicate test IDs'});});
export type SuiteV2=z.infer<typeof suiteV2Schema>;
export type AssertionV2=z.infer<typeof assertionV2Schema>;
export type LlmDefaults=z.infer<typeof llmDefaultsSchema>;
