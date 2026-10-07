const sensitive=/(?:authorization|cookie|password|passwd|secret|token|api[-_]?key|credential|x-forwarded-for|x-real-ip|cf-connecting-ip)/i;
export function isSensitiveField(name:string):boolean{return sensitive.test(name);}
export class Redactor {
  private values=new Set<string>();
  add(...values:string[]):void { for(const v of values) if(v) this.values.add(v); }
  text(s:string):string {
    try{const parsed:unknown=JSON.parse(s);if(parsed&&typeof parsed==='object')return JSON.stringify(this.object(parsed));}catch{}
    for(const v of [...this.values].sort((a,b)=>b.length-a.length))s=s.split(v).join('[REDACTED]');
    return s.replace(/("[^"\n]*(?:password|passwd|secret|token|api[-_]?key|authorization|cookie|credential)[^"\n]*"\s*:\s*)(?:"(?:\\.|[^"\\])*"|[-\d.+eE]+|true|false|null|[^\n]*)/gi,'$1"[REDACTED]"')
      .replace(/Bearer\s+[^\s"<>]+/gi,'Bearer [REDACTED]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,email=>email.toLowerCase().endsWith('.test')?email:'[REDACTED EMAIL]');
  }
  object(value:unknown):unknown {
    if(typeof value==='string')return this.text(value);
    if(Array.isArray(value))return value.map(v=>this.object(v));
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,sensitive.test(k)?'[REDACTED]':this.object(v)]));
    return value;
  }
}
export const redactor=new Redactor();
