import { describe, it, expect } from 'vitest';
import { suiteSchema } from '../src/spec/schema.js';
const valid = {schemaVersion:1,name:'demo',tests:[{id:'good',workflow:'wf.json',fixture:'in.json',mocks:[],assertions:[{target:'execution.status',equals:'success'}]}]};
describe('versioned strict spec',()=>{
 it('accepts explicit tests with defaults',()=>expect(suiteSchema.parse(valid).tests[0]?.timeoutMs).toBe(30000));
 it.each([{...valid,schemaVersion:2},{...valid,command:'echo pwn'}, {...valid,tests:[]},{...valid,tests:[{...valid.tests[0],assertions:[]}]}])('rejects unsafe/empty/unknown spec',x=>expect(()=>suiteSchema.parse(x)).toThrow());
 it('rejects duplicate tests and unknown mocks in assertions',()=>{
  expect(()=>suiteSchema.parse({...valid,tests:[valid.tests[0],valid.tests[0]]})).toThrow();
  expect(()=>suiteSchema.parse({...valid,tests:[{...valid.tests[0],assertions:[{target:'requests.count',mockId:'absent',equals:0}]}]})).toThrow();
 });
 it('bounds delays, sequence sizes, pointers and execution count',()=>{
  for(const responses of [[{status:200,json:{},delayMs:6000}],[]]) expect(()=>suiteSchema.parse({...valid,tests:[{...valid.tests[0],mocks:[{id:'m',method:'POST',path:'/contacts',responses}]}]})).toThrow();
  expect(()=>suiteSchema.parse({...valid,tests:Array.from({length:21},(_,i)=>({...valid.tests[0],id:'t'+i}))})).toThrow();
 });
});
