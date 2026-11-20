'use strict';
// Transporte P2P sem fila: só o estado mais recente importa. Estados que não saíram (canal cheio) ou que chegaram juntos
// (rajada) são trocados pelo mais novo; mensagens que não são estado nunca somem nem mudam de ordem.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const sandbox={window:{},location:{protocol:'http:'},Blob,Response,CompressionStream,DecompressionStream,MessageEvent,EventTarget,setTimeout,clearTimeout,btoa,atob,crypto:globalThis.crypto,console};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','public','js','p2p.js'),'utf8'),sandbox);
const {wrap,coalesce}=sandbox.window.P2P;
const cases=[],test=(name,fn)=>cases.push([name,fn]);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const inflate=async d=>typeof d==='string'?d:new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
const deflate=async text=>new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
function fakeChannel(){
 const handlers={},channel={readyState:'open',bufferedAmount:0,bufferedAmountLowThreshold:0,binaryType:'',sent:[],
  addEventListener(type,fn){(handlers[type]||=new Set()).add(fn);},removeEventListener(type,fn){handlers[type]?.delete(fn);},
  send(data){this.sent.push(data);},dispatch(type,event={}){for(const fn of [...(handlers[type]||[])])fn(event);}};
 return channel;
}
const state=n=>JSON.stringify({type:'state',n,pad:'x'.repeat(3000)}),ack=n=>JSON.stringify({type:'ack',seq:n});
const kinds=async sent=>(await Promise.all(sent.map(inflate))).map(t=>{const m=JSON.parse(t);return m.type==='state'?'s'+m.n:'a'+m.seq;});

test('saída mantém no máximo um estado pendente quando o canal está cheio',async()=>{
 const channel=fakeChannel(),link=wrap(channel);channel.bufferedAmount=300*1024;
 for(let n=1;n<=50;n++)link.send(state(n));link.send(ack(1));await wait(30);
 assert.equal(channel.sent.length,0,'nada sai com o canal cheio');
 channel.bufferedAmount=0;channel.dispatch('bufferedamountlow');await wait(60);
 assert.deepEqual(await kinds(channel.sent),['s50','a1'],'sai só o estado mais novo e o ack, nessa ordem');
 assert.equal(channel.bufferedAmountLowThreshold,64*1024);
});
test('saída não descarta mensagens que não são estado e mantém a ordem',async()=>{
 const channel=fakeChannel(),link=wrap(channel),expected=[];
 for(let n=1;n<=20;n++){link.send(state(n));link.send(ack(n));expected.push('s'+n,'a'+n);}
 await wait(200);assert.deepEqual(await kinds(channel.sent),expected);
});
test('saída: dois estados seguidos num canal livre viram um só quando o primeiro ainda não começou a sair',async()=>{
 const channel=fakeChannel(),link=wrap(channel);
 for(let n=1;n<=30;n++)link.send(state(n));await wait(200);
 const got=await kinds(channel.sent);assert.equal(got.at(-1),'s30','o último estado sempre sai');assert.ok(got.length<30,'estados intermediários foram trocados ('+got.length+' enviados)');
});
test('entrada aplica só o último estado de uma rajada e mantém a ordem com outras mensagens',async()=>{
 const got=[],deliver=coalesce(t=>got.push(t));
 for(let n=1;n<=30;n++)deliver(state(n));deliver(JSON.stringify({type:'room'}));
 assert.equal(got.length,2);assert.equal(JSON.parse(got[0]).n,30);assert.equal(JSON.parse(got[1]).type,'room');
 await wait(10);assert.equal(got.length,2,'nada é entregue de novo depois');
 deliver(state(31));await wait(10);assert.equal(got.length,3,'estado sozinho também chega');assert.equal(JSON.parse(got[2]).n,31);
});
test('entrada entrega mensagem isolada na hora',()=>{
 const got=[],deliver=coalesce(t=>got.push(t));deliver(JSON.stringify({type:'error',code:'x'}));assert.equal(got.length,1);
});
test('canal binário: o estado comprimido chega inteiro pelo wrap',async()=>{
 const channel=fakeChannel(),link=wrap(channel),got=[];link.onText(t=>got.push(t));
 channel.dispatch('message',{data:(await deflate(state(7))).buffer});await wait(30);
 assert.equal(got.length,1);assert.equal(JSON.parse(got[0]).n,7);
});

const full=(n,extra)=>JSON.stringify({type:'state',state:{n,terrain:undefined,events:[],pad:'x'.repeat(3000),...extra}});
test('trocar estados leva o terreno do descartado, não os eventos (saída)',async()=>{
 const channel=fakeChannel(),link=wrap(channel);channel.bufferedAmount=300*1024;
 link.send(full(1,{terrain:['plain','river'],terrainRevision:1,events:[{seq:1}]}));link.send(full(2,{terrainRevision:1,events:[{seq:2}]}));link.send(full(3,{terrainRevision:1,events:[]}));
 channel.bufferedAmount=0;channel.dispatch('bufferedamountlow');await wait(60);
 const sent=await Promise.all(channel.sent.map(async d=>JSON.parse(await inflate(d))));
 assert.equal(sent.length,1);assert.equal(sent[0].state.n,3);assert.deepEqual(sent[0].state.terrain,['plain','river']);assert.deepEqual(sent[0].state.events,[],'eventos visuais do descartado se perdem de propósito');
});
test('trocar estados leva o terreno do descartado, não os eventos (entrada)',async()=>{
 const got=[],deliver=coalesce(t=>got.push(JSON.parse(t)));
 deliver(full(1,{terrain:['a'],events:[{seq:1}]}));deliver(full(2,{events:[{seq:2}]}));await wait(10);
 assert.equal(got.length,1);assert.deepEqual(got[0].state.terrain,['a']);assert.deepEqual(got[0].state.events.map(e=>e.seq),[2]);
});
test('estado novo com terreno próprio mantém o dele',async()=>{
 const got=[],deliver=coalesce(t=>got.push(JSON.parse(t)));
 deliver(full(1,{terrain:['velho']}));deliver(full(2,{terrain:['novo']}));await wait(10);assert.deepEqual(got[0].state.terrain,['novo']);
});

(async()=>{for(const [name,fn] of cases){await fn();console.log('OK '+name);}console.log(cases.length+' verificações do transporte sem fila passaram.');process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});
