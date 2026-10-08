// This helper only edits a documented CLI export archive in an owned fresh volume.
// It never opens SQLite or invokes private editor routes.
export const seedScript=String.raw`(async()=>{
 const fs=require('fs'),ff=require('fflate'),crypto=require('crypto'),{Cipher}=require('n8n-core');
 const input=JSON.parse(fs.readFileSync(0,'utf8'));
 if(require('./package.json').version!=='2.42.4')throw Error('Unsupported seed version');
 const key=fs.readFileSync('/home/node/.n8n/seed-key','utf8'),cipher=new Cipher({encryptionKey:key},{});
 const zip=ff.unzipSync(fs.readFileSync('/home/node/.n8n/export/entities.zip')),data={};
 for(const [name,bytes]of Object.entries(zip))if(name.endsWith('.jsonl'))data[name]=(await cipher.decryptV2(Buffer.from(bytes).toString(),key)).trim().split('\n').filter(Boolean).map(JSON.parse);
 const users=data['user.jsonl'],projects=data['project.jsonl'],relations=data['projectrelation.jsonl'];
 if(users?.length!==1||projects?.length!==1||relations?.length!==1||users[0].email!==null||users[0].roleSlug!=='global:owner'||relations[0].userId!==users[0].id||relations[0].projectId!==projects[0].id)throw Error('Fresh owner/project seed schema changed');
 const user=users[0];user.email='owner@wfcheck.test';user.firstName='Workflow';user.lastName='Test';user.password=await require('bcryptjs').hash(crypto.randomBytes(32).toString('hex'),10);user.settings=JSON.stringify({userActivated:true});
 const settings=data['settings.jsonl'].filter(r=>r.key==='userManagement.isInstanceOwnerSetUp');
 if(settings.length!==1||settings[0].value!=='false')throw Error('Fresh owner setting changed');settings[0].value='true';
 const scopes=['workflow:create','workflow:read','workflow:list','workflow:delete','workflow:activate','workflow:deactivate','execution:read','execution:list','execution:delete','credential:create','credential:delete','credential:list','dataTable:create','dataTable:read','dataTable:list','dataTable:delete','dataTableRow:create','dataTableRow:read','dataTableRow:upsert','dataTableRow:delete'];
 if(scopes.some(s=>!require('@n8n/permissions').OWNER_API_KEY_SCOPES.includes(s)))throw Error('Required public API scope unavailable');
 const selected={'migrations.jsonl':data['migrations.jsonl'],'user.jsonl':users,'project.jsonl':projects,'projectrelation.jsonl':relations,'settings.jsonl':settings,'apikey.jsonl':[{id:crypto.randomUUID(),userId:user.id,label:'wfcheck disposable',scopes,apiKey:input.apiKey,audience:'public-api'}]};
 const output={};for(const [name,rows]of Object.entries(selected))output[name]=Buffer.from(await cipher.encryptV2(rows.map(r=>JSON.stringify(r)).join('\n'),key));
 fs.mkdirSync('/home/node/.n8n/seed',{mode:0o700});fs.writeFileSync('/home/node/.n8n/seed/entities.zip',ff.zipSync(output),{mode:0o600});
})().catch(()=>{console.error('Versioned bootstrap seed rejected');process.exit(1)});`;
export const catalogScript=String.raw`const fs=require('fs');const nodes=[];for(const[prefix,path]of [['n8n-nodes-base','node_modules/n8n-nodes-base/dist/types/nodes.json'],['@n8n/n8n-nodes-langchain','node_modules/@n8n/n8n-nodes-langchain/dist/types/nodes.json']]){for(const n of JSON.parse(fs.readFileSync(path))){nodes.push({type:prefix+'.'+n.name,versions:Array.isArray(n.version)?n.version:[n.version],description:{displayName:n.displayName,inputs:n.inputs,outputs:n.outputs,parameters:n.properties?.map(p=>({name:p.name,type:p.type,required:p.required}))}});}}process.stdout.write(JSON.stringify(nodes));`;
