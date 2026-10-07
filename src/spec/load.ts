import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, relative, dirname, isAbsolute, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { parseDocument } from 'yaml';
import { suiteSchema, type Suite } from './schema.js';
import { HarnessError } from '../security/errors.js';
interface PathApi {relative:(from:string,to:string)=>string;isAbsolute:(path:string)=>boolean;sep:string;}
export function isWithinDirectory(root:string,file:string,paths:PathApi={relative,isAbsolute,sep}):boolean {
  const rel=paths.relative(root,file);
  return !paths.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+paths.sep);
}
export async function readBounded(path:string,root=process.cwd()):Promise<string> {
  const [real,base]=await Promise.all([realpath(path),realpath(root)]);
  if(!isWithinDirectory(base,real))throw new HarnessError('CONFIG','Input file escapes the project directory');
  const s=await stat(real);
  if(!s.isFile()||s.size>1024*1024)throw new HarnessError('CONFIG','Input must be a file of at most 1 MiB');
  return readFile(real,'utf8');
}
export function sha256(s:string):string{return createHash('sha256').update(s).digest('hex');}
export async function loadSuite(path:string):Promise<{suite:Suite;base:string}> {
  const text=await readBounded(resolve(path));
  const doc=parseDocument(text,{uniqueKeys:true,customTags:[]});
  if(doc.errors.length||doc.warnings.length)throw new HarnessError('CONFIG','Invalid YAML: '+[...doc.errors,...doc.warnings].map(e=>e.message).join('; '));
  const parsed=suiteSchema.safeParse(doc.toJS({maxAliasCount:0}));
  if(!parsed.success)throw new HarnessError('CONFIG','Invalid suite: '+parsed.error.issues.map(x=>x.path.join('.')+': '+x.message).join('; '));
  return {suite:parsed.data,base:dirname(resolve(path))};
}
