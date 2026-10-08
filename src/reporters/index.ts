import type { SuiteResult,TestResult } from '../runtime/runner.js';
import {generationSchema} from '../llm/client.js';
import {projectEvidence} from './evidence.js';
import { redactor } from '../security/redact.js';
function xml(value:unknown):string{return String(value??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');}
export function jsonReport(result:SuiteResult):string{const safe=redactor.object(projectEvidence(result)) as any;for(const [i,test]of result.tests.entries())for(const [j,call]of (test.evidence?.modelCalls??[]).entries()){const settings=generationSchema.safeParse(call.settings);if(settings.success)safe.tests[i].evidence.modelCalls[j].settings=settings.data;}return JSON.stringify(safe,null,2)+'\n';}
export function consoleTest(t:TestResult):string {
  const lines=[`${t.status==='passed'?'PASS':t.status==='failed'?'FAIL':'ERROR'} ${t.id} (${t.durationMs}ms)${t.evidence?` n8n=${t.evidence.execution.status} execution=${t.evidence.execution.id}`:''}`];
  for(const a of t.assertions)if(!a.passed)lines.push('  '+a.message);
  for(const step of t.steps??[]){lines.push(`  Step ${step.id}: n8n=${step.evidence.execution.status} execution=${step.evidence.execution.id}`);for(const a of step.assertions)if(!a.passed)lines.push('    '+a.message);}
  if(t.error)lines.push(`  ${t.error.code}: ${t.error.message}`);
  if(t.cleanup.status==='failed')lines.push(`  Cleanup failed for workflow ${t.cleanup.workflowId}: ${t.cleanup.message}`);
  return redactor.text(lines.join('\n'));
}
export function junitReport(result:SuiteResult):string {
  const safe=redactor.object(projectEvidence(result)) as SuiteResult;
  const failures=safe.tests.filter(t=>t.status==='failed').length,errors=safe.tests.filter(t=>t.status==='error').length+(safe.runtimeError?1:0);
  const cases=safe.tests.map(t=>{
    const level=t.verificationKind?`<properties><property name="wfcheck.verificationKind" value="${xml(t.verificationKind)}"/></properties>`:'';
    const body=t.status==='error'?`<error type="${xml(t.error?.code)}" message="${xml(t.error?.message)}"/>`:t.status==='failed'?`<failure message="Regression assertion failure">${xml([...t.assertions.filter(a=>!a.passed).map(a=>a.message),...(t.steps??[]).flatMap(step=>step.assertions.filter(a=>!a.passed).map(a=>`Step ${step.id} execution=${step.evidence.execution.id}: ${a.message}`))].join('\n'))}</failure>`:'';
    return `  <testcase name="${xml(t.id)}" classname="${xml(safe.suite)}" time="${t.durationMs/1000}">${level}${body}</testcase>`;
  });
  if(safe.runtimeError)cases.push(`  <testcase name="Runtime cleanup" classname="wfcheck.harness" time="0"><error type="${xml(safe.runtimeError.code)}" message="${xml(safe.runtimeError.message)}"/></testcase>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${xml(safe.suite)}" tests="${cases.length}" failures="${failures}" errors="${errors}" skipped="0" time="${safe.durationMs/1000}">\n${cases.join('\n')}\n</testsuite>\n`;
}
