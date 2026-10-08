import {writeFile} from 'node:fs/promises';
import {z} from 'zod';
import {suiteV2Schema} from '../src/spec/schema-v2.js';

// Publish authored input, before normalization supplies defaults.
await writeFile(new URL('../docs/suite-schema-v2.json',import.meta.url),
 JSON.stringify(z.toJSONSchema(suiteV2Schema,{io:'input'}),null,2)+'\n');
