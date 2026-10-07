const sensitive=/(?:authorization|cookie|password|passwd|secret|token|api[-_]?key|credential|x-forwarded-for|x-real-ip|cf-connecting-ip)/i;
export function isSensitiveField(name:string):boolean{return sensitive.test(name);}
export class Redactor {
  private values=new Set<string>();
  add(...values:string[]):void { for(const v of values) if(v) this.values.add(v); }
  text(s:string):string {
    try{const parsed:unknown=JSON.parse(s);if(parsed&&typeof parsed==='object')return JSON.stringify(this.object(parsed));}catch{}
    s=this.embeddedJson(s);
    for(const v of [...this.values].sort((a,b)=>b.length-a.length))s=s.split(v).join('[REDACTED]');
    return s.replace(/("[^"\n]*(?:password|passwd|secret|token|api[-_]?key|authorization|cookie|credential)[^"\n]*"\s*:\s*)(?:"(?:\\.|[^"\\])*"|[-\d.+eE]+|true|false|null|[^\n]*)/gi,'$1"[REDACTED]"')
      .replace(/Bearer\s+[^\s"<>]+/gi,'Bearer [REDACTED]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,email=>email.toLowerCase().endsWith('.test')?email:'[REDACTED EMAIL]');
  }
  private embeddedJson(s:string):string {
    // Index balanced containers in one pass, including ones after stray delimiters.
    const ends=new Map<number,number>();
    const stack:Array<{start:number;char:string}>=[];
    let quoted=false,escaped=false;
    for(let i=0;i<s.length;i++){
      const c=s[i]!;
      if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
      if(c==='"'){quoted=true;continue;}
      if(c==='{'||c==='[')stack.push({start:i,char:c});
      else if(c==='}'||c===']'){
        const open=stack.pop();
        if(open?.char===(c==='}'?'{':'['))ends.set(open.start,i+1);
        else stack.length=0;
      }
    }
    let output='',offset=0;
    while(offset<s.length){
      const end=ends.get(offset);
      if(end===undefined){output+=s[offset++];continue;}
      const fragment=s.slice(offset,end);
      try{output+=JSON.stringify(this.object(JSON.parse(fragment)));}catch{output+=fragment;}
      offset=end;
    }
    return output;
  }
  object(value:unknown):unknown {
    if(typeof value==='string')return this.text(value);
    if(Array.isArray(value))return value.map(v=>this.object(v));
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,sensitive.test(k)?'[REDACTED]':this.object(v)]));
    return value;
  }
}
export const redactor=new Redactor();
