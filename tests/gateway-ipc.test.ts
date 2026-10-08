import {it,expect} from 'vitest';import {PassThrough} from 'node:stream';import {GatewayIpc} from '../src/gateway/docker.js';
it('missing acknowledgements and transport loss are evidence errors',async()=>{const input=new PassThrough(),output=new PassThrough();const ipc=new GatewayIpc(input,output,20);await expect(ipc.call('snapshot',{runId:'r',testId:'t'})).rejects.toThrow(/acknowledgement/);const pending=ipc.call('snapshot',{runId:'r',testId:'t'});output.destroy();await expect(pending).rejects.toThrow(/transport/);});
it('rejects malformed replies instead of inventing an empty capture',async()=>{const input=new PassThrough(),output=new PassThrough();const ipc=new GatewayIpc(input,output,1000);const pending=ipc.call('snapshot',{});output.write('not JSON\n');await expect(pending).rejects.toThrow(/transport/);});

it('preserves UTF-8 evidence when stdout splits inside every multibyte character',async()=>{
 const input=new PassThrough(),output=new PassThrough();const ipc=new GatewayIpc(input,output,1000);
 let id='';input.once('data',chunk=>{id=JSON.parse(chunk.toString()).id;});
 const pending=ipc.call('snapshot',{});
 const bytes=Buffer.from(JSON.stringify({id,ok:true,value:{body:'Grüße: 12,90 € 🧾'}})+'\n');
 for(const byte of bytes)output.write(Buffer.from([byte]));
 expect(await pending).toEqual({body:'Grüße: 12,90 € 🧾'});
 output.destroy();input.destroy();
});

it('releases consumed frame bytes so later valid large snapshots remain within the limit',async()=>{
 const input=new PassThrough(),output=new PassThrough();const ipc=new GatewayIpc(input,output,1000);
 let id='';input.on('data',chunk=>{id=JSON.parse(chunk.toString()).id;});
 for(let i=0;i<2;i++){
  const pending=ipc.call('snapshot',{});
  output.write(JSON.stringify({id,ok:true,value:{body:'a'.repeat(5*1024*1024)}})+'\n');
  expect((await pending).body.length).toBe(5*1024*1024);
 }
 output.destroy();input.destroy();
});

it('rejects an oversized unfinished frame rather than continuing without bounded evidence',async()=>{
 const input=new PassThrough(),output=new PassThrough();const ipc=new GatewayIpc(input,output,1000);
 const pending=ipc.call('snapshot',{});
 output.write(Buffer.alloc(8*1024*1024+1,0x61));
 await expect(pending).rejects.toThrow(/transport/);
 output.destroy();input.destroy();
});
