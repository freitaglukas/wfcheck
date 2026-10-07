import {it,expect} from 'vitest';
import {jsonReport,junitReport,consoleTest} from '../src/reporters/index.js';
import {Redactor,redactor} from '../src/security/redact.js';
it('redacts nested secrets and literal tokens',()=>{const r=new Redactor();r.add('actual-private-key');expect(JSON.stringify(r.object({password:'bad',nested:{authorization:'bad'},value:'actual-private-key'}))).not.toMatch(/bad|actual-private-key/);});
it('preserves failed vs infrastructure error and escapes XML',()=>{
 redactor.add('private-value');const r:any={schemaVersion:1,runId:'r',suite:'a<&',plannedExecutions:2,durationMs:1000,exitCode:2,tests:[{id:'broken',status:'failed',durationMs:2,assertions:[{passed:false,message:'bad < mapping private-value'}],cleanup:{status:'cleaned'}},{id:'missing',status:'error',durationMs:3,assertions:[],error:{code:'EVIDENCE',message:'missing > evidence'},cleanup:{status:'failed'}}]};
 const xml=junitReport(r);expect(xml).toContain('failures="1"');expect(xml).toContain('errors="1"');expect(xml).toContain('&lt;');expect(xml).not.toContain('private-value');expect(jsonReport(r)).not.toContain('private-value');expect(consoleTest(r.tests[0])).toContain('FAIL');
});
it('redacts raw JSON body strings including numeric credential values',()=>{const r=new Redactor();const raw=r.object({body:'{"credential":"private-value","password":1234}',json:{credential:'private-value',password:1234}});expect(JSON.stringify(raw)).not.toMatch(/private-value|1234/);});
it('redacts credential scalars in surrounding text and malformed JSON',()=>{const r=new Redactor();expect(JSON.stringify(r.object({data:'prefix {"credential":"secret-value-123","password":123456789,"passwd":false}'}))).not.toMatch(/secret-value-123|123456789|false/);});
it('preserves public evidence after redacting nested credentials in embedded JSON',()=>{
 const r=new Redactor();const out=r.text('prefix {"credential":{"password":"nested-private"},"visible":"keep"} suffix');
 expect(out).not.toContain('nested-private');expect(out).toContain('"visible":"keep"');expect(out).toContain(' suffix');
});
it('preserves adjacent fields when embedded secret arrays contain escaped braces',()=>{
 const r=new Redactor();const out=r.text('prefix {"note":"} [","secret":[{"value":"private-array"}],"visible":42} suffix');
 expect(out).not.toContain('private-array');expect(out).toContain('"visible":42');expect(out).toContain(' suffix');
});
it('preserves valid JSON evidence after stray unclosed or mismatched brackets',()=>{
 const r=new Redactor();for(const prefix of ['trace [','trace { ] ']){const out=r.text(prefix+'{"credential":{"password":"nested-private"},"visible":"keep"} suffix');expect(out).not.toContain('nested-private');expect(out).toContain('"visible":"keep"');expect(out).toContain(' suffix');}
});
