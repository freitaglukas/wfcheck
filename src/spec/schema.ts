import { z } from 'zod';
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const pointer = z.string().max(512).refine(s => s === '' || /^\/(?:[^~]|~[01])*$/.test(s), 'Use an RFC 6901 JSON Pointer');
const index = z.int().min(0).max(1000);
const value = z.json();
const method = z.enum(['GET','POST','PUT','PATCH','DELETE','HEAD']);
export const responseSchema = z.discriminatedUnion('kind', [
  z.strictObject({kind:z.literal('json'),status:z.int().min(200).max(599),json:value.refine(v=>Buffer.byteLength(JSON.stringify(v))<=65536,'Response JSON exceeds 64 KiB'),delayMs:z.int().min(0).max(5000).default(0)}),
  z.strictObject({kind:z.literal('text'),contentType:z.enum(['text/plain','application/rss+xml','application/xml','text/xml']).optional(),status:z.int().min(200).max(599),text:z.string().max(65536).refine(v=>Buffer.byteLength(v)<=65536,'Text exceeds 64 KiB'),delayMs:z.int().min(0).max(5000).default(0)}),
  z.strictObject({kind:z.literal('malformed-json'),status:z.int().min(200).max(599),text:z.string().max(65536).refine(v=>Buffer.byteLength(v)<=65536,'Text exceeds 64 KiB').refine(s=>{try{JSON.parse(s);return false;}catch{return true;}},'Must be invalid JSON'),delayMs:z.int().min(0).max(5000).default(0)})
]);
export const mockSchema = z.strictObject({
  id, method, path:z.string().max(256).regex(/^\/[a-zA-Z0-9/_-]*$/),
  headers:z.record(z.string().regex(/^[a-z0-9-]+$/),z.string().max(4096)).default({}),
  bodyFields:z.record(pointer,value).default({}),
  responses:z.array(responseSchema).min(1).max(20)
});
const node = {nodeId:id,runIndex:index.default(0),outputIndex:index.default(0)};
export const assertionSchema = z.discriminatedUnion('target',[
  z.strictObject({target:z.literal('execution.status'),equals:z.enum(['success','error','canceled','crashed'])}),
  z.strictObject({target:z.literal('node.count'),...node,equals:index}),
  z.strictObject({target:z.literal('node.json'),...node,itemIndex:index.default(0),pointer,equals:value}),
  z.strictObject({target:z.literal('node.executed'),nodeId:id,equals:z.boolean()}),
  z.strictObject({target:z.literal('requests.count'),mockId:id,equals:index}),
  z.strictObject({target:z.literal('request.json'),mockId:id,requestIndex:index.default(0),pointer,equals:value}),
  z.strictObject({target:z.literal('request.header'),mockId:id,requestIndex:index.default(0),header:z.string().regex(/^[a-z0-9-]+$/),equals:z.string()})
]);
export const testSchema=z.strictObject({
  id,workflow:z.string().min(1).max(512),fixture:z.string().min(1).max(512),timeoutMs:z.int().min(1000).max(120000).default(30000),
  mocks:z.array(mockSchema).max(20),assertions:z.array(assertionSchema).min(1).max(100)
}).superRefine((t,ctx)=>{
  const ids=t.mocks.map(m=>m.id);
  if(new Set(ids).size!==ids.length) ctx.addIssue({code:'custom',message:'Duplicate mock IDs'});
  if(!t.assertions.some(a=>a.target==='execution.status')) ctx.addIssue({code:'custom',message:'An explicit execution.status assertion is required'});
  for(const a of t.assertions) if('mockId' in a&&!ids.includes(a.mockId)) ctx.addIssue({code:'custom',message:'Assertion refers to unknown mock'});
  if(new Set(t.mocks.map(m=>m.method+' '+m.path)).size!==t.mocks.length) ctx.addIssue({code:'custom',message:'Use one mock per method/path with ordered responses'});
});
export const suiteSchema=z.strictObject({schemaVersion:z.literal(1),name:z.string().min(1).max(128),redactValues:z.array(z.string().min(1).max(4096)).max(100).default([]),tests:z.array(testSchema).min(1).max(20)})
  .superRefine((s,ctx)=>{if(new Set(s.tests.map(t=>t.id)).size!==s.tests.length)ctx.addIssue({code:'custom',message:'Duplicate test IDs'});});
export type Suite=z.infer<typeof suiteSchema>;
export type TestSpec=z.infer<typeof testSchema>;
export type Assertion=z.infer<typeof assertionSchema>;
export type MockRule=z.infer<typeof mockSchema>;
