import {it,expect} from 'vitest';
import {lookupCapability} from '../src/analysis/registry.js';
it('classifies table operations and rejects unknown versions',()=>{
 expect(lookupCapability('n8n-nodes-base.dataTable',1,'get')?.effect).toBe('read');
 expect(lookupCapability('n8n-nodes-base.dataTable',1,'upsert')?.effect).toBe('write');
 expect(lookupCapability('n8n-nodes-base.dataTable',999,'upsert')).toBeUndefined();
 expect(lookupCapability('n8n-nodes-base.dataTable',1,'delete')).toBeUndefined();
});
it('keeps unsupported model versions unqualified and pure Code opaque',()=>{
 expect(lookupCapability('n8n-nodes-base.code',2)?.effect).toBe('opaque');
 expect(lookupCapability('@n8n/n8n-nodes-langchain.lmChatOpenAi',1.2)?.executable).toBe(false);
});
