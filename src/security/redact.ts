const sensitive=/(?:authorization|cookie|password|passwd|secret|token|api[-_]?key|credential)/i;
export class Redactor {
  private values=new Set<string>();
  add(...values:string[]):void { for(const v of values) if(v) this.values.add(v); }
  text(s:string):string {
    for(const v of [...this.values].sort((a,b)=>b.length-a.length))s=s.split(v).join('[REDACTED]');
    return s.replace(/("[^"\n]*(?:password|secret|token|api[-_]?key|authorization|cookie)[^"\n]*"\s*:\s*)"(?:\\.|[^"\\])*"/gi,'$1"[REDACTED]"')
      .replace(/Bearer\s+[^\s"<>]+/gi,'Bearer [REDACTED]');
  }
  object(value:unknown):unknown {
    if(typeof value==='string')return this.text(value);
    if(Array.isArray(value))return value.map(v=>this.object(v));
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,sensitive.test(k)?'[REDACTED]':this.object(v)]));
    return value;
  }
}
export const redactor=new Redactor();
