import {lstat,stat,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {HarnessError} from '../security/errors.js';
export interface ReportPaths {json?:string;junit?:string;}
/** Reports may replace previous reports, never source, fixtures, journals or recordings. */
export async function checkReportTargets(paths:ReportPaths,protectedPaths:string[]=[]){
 const targets=[paths.json,paths.junit].filter((p):p is string=>!!p).map(p=>resolve(p));
 if(new Set(targets).size!==targets.length)throw new HarnessError('CONFIG','Reports must have distinct output paths');
 const protectedNames=new Set(protectedPaths.map(p=>resolve(p)));const protectedStats=await Promise.all([...protectedNames].map(p=>stat(p).catch((e:any)=>{if(e.code==='ENOENT')return undefined;throw e;})));
 const outputStats:import('node:fs').Stats[]=[];
 for(const [kind,path]of [['json',paths.json],['junit',paths.junit]] as const){if(!path)continue;const target=resolve(path);if(protectedNames.has(target))throw new HarnessError('CONFIG','Report output aliases a protected input or recording');const info=await lstat(target).catch((e:any)=>{if(e.code==='ENOENT')return undefined;throw e;});if(!info)continue;
  if(!info.isFile()||info.isSymbolicLink()||protectedStats.some(s=>s&&s.dev===info.dev&&s.ino===info.ino)||outputStats.some(s=>s.dev===info.dev&&s.ino===info.ino))throw new HarnessError('CONFIG','Report output aliases an input, another report or symlink');outputStats.push(info);
  if(info.size>8*1024*1024)throw new HarnessError('CONFIG','Existing report exceeds its size budget');const text=await readFile(target,'utf8');let owned=false;
  if(kind==='json')try{const p=JSON.parse(text);owned=[1,2].includes(p.schemaVersion)&&typeof p.runId==='string'&&typeof p.suite==='string'&&typeof p.startedAt==='string'&&Array.isArray(p.tests)&&[0,1,2].includes(p.exitCode);}catch{}
  else owned=text.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<testsuite ')&&text.trimEnd().endsWith('</testsuite>');
  if(!owned)throw new HarnessError('CONFIG','Existing output is not a wfcheck report; choose a new path');
 }
}
