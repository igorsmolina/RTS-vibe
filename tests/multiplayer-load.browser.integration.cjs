'use strict';
// Multiplayer sob carga: servidor local com 4 clientes WebSocket (um por canto do mapa) e 300 unidades em combate RTS.
// Servidor: custo do tick (simulação + estado por jogador a cada 3 ticks), tamanho e frequência das mensagens.
// Cliente (Chrome, CPU 4×): os estados reais gravados são aplicados a 10 Hz com Multiplayer.applyState e medidos quadro a quadro.
// Latência e perda são simuladas no cliente: atraso de 150 ms com variação e 5% dos estados descartados.
// Rajada: 30 estados atrasados que chegam juntos (rede que travou e liberou) passam por P2P.coalesce e só o último é aplicado.
const path=require('node:path'),{once}=require('node:events'),{WebSocket}=require('ws');
const {createMultiplayerServer}=require('../scripts/multiplayer-server.cjs');
const {open,frameStats,quantiles,suite,run,KINDS}=require('./perf-kit.cjs');
const S=suite('multiplayer-load'),TYPES_STRUCT=u=>/^(hq|post|airport)/.test(u.type);

async function peer(url,session){
 const ws=new WebSocket(url.replace(/^http/,'ws')+'/multiplayer'),messages=[];ws.on('message',raw=>messages.push({at:performance.now(),size:raw.length,data:JSON.parse(raw)}));await once(ws,'open');
 const wait=(predicate,from=0)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('mensagem esperada não chegou')),8000);const check=()=>{const m=messages.slice(from).find(x=>predicate(x.data));if(m){clearTimeout(timer);ws.off('message',check);resolve(m.data);}};ws.on('message',check);check();});
 const send=(value,predicate)=>{const from=messages.length;ws.send(JSON.stringify(value));return predicate?wait(predicate,from):undefined;};
 await send({type:'auth',version:1,code:session.code,token:session.token},m=>m.type==='authenticated');return{ws,messages,send};
}

run(async browser=>{
 let time=100000;const service=createMultiplayerServer({autoTick:false,now:()=>time});await new Promise(r=>service.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+service.server.address().port;
 const post=async(route,body)=>(await fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
 let blue,red,green,gold;try{
  const a=await post('/api/rooms',{nickname:'Azul',config:{map:'river',mode:'rts',seed:71}}),b=await post('/api/rooms/'+a.code+'/join',{nickname:'Vermelho'}),c3=await post('/api/rooms/'+a.code+'/join',{nickname:'Verde'}),c4=await post('/api/rooms/'+a.code+'/join',{nickname:'Amarelo'});
  blue=await peer(url,a);red=await peer(url,b);green=await peer(url,c3);gold=await peer(url,c4);const room=service.rooms.get(a.code);
  await blue.send({type:'ready',ready:true},m=>m.type==='room'&&m.room.players[0].ready);await red.send({type:'ready',ready:true});await green.send({type:'ready',ready:true});await gold.send({type:'ready',ready:true},m=>m.type==='room'&&m.room.players.every(p=>p.ready));await blue.send({type:'start'},m=>m.type==='state');
  const g=room.game;for(const [owner,x0,y0] of [['blue',30,6],['red',70,6],['green',70,52],['gold',30,52]]){let placed=0,i=0;while(placed<75&&i<6000){try{if(g.add(owner,KINDS[placed%KINDS.length],x0+i%12*2,y0+(Math.floor(i/12)*3)%40))placed++;}catch{}i++;}}
  g.updateVision();for(const u of g.units)if(u.owner!=='neutral'&&!TYPES_STRUCT(u))g.order(u,'attackMove',{x:64,y:48},true);
  const start=blue.messages.length,startRed=red.messages.length,ticks=[];const bytesBefore=[blue,red,green,gold].map(p=>p.messages.reduce((n,m)=>n+m.size,0));
  for(let i=0;i<300;i++){const t=performance.now();service.tick();ticks.push(performance.now()-t);time+=1000/30;if(i%3===2)await new Promise(r=>setTimeout(r,100));} // em tempo real (um estado a cada 100 ms): mais rápido que isso o buffer enche e os estados são pulados de propósito
  await new Promise(r=>setTimeout(r,300));
  const states=blue.messages.slice(start).filter(m=>m.data.type==='state'),sizes=quantiles(states.map(m=>m.size/1024)),tq=quantiles(ticks);
  const server={units:g.units.length,tickP50:tq.p50,tickP95:tq.p95,tickMax:tq.max,statesPer10s:states.length,stateKBp50:sizes.p50,stateKBmax:sizes.max,kbPerSecond:Math.round(states.reduce((a,m)=>a+m.size,0)/1024/10),redStates:red.messages.slice(startRed).filter(m=>m.data.type==='state').length,kbPerSecondPerPlayerMax:Math.round(Math.max(...[blue,red,green,gold].map((p,i)=>p.messages.reduce((n,m)=>n+m.size,0)-bytesBefore[i]))/1024/10)};
  S.budget('servidor, 4 jogadores, 300 unidades',server);// 300 unidades é o dobro do limite real (4 × 50 tropas); medido depois de descomprimir (o WebSocket usa permessage-deflate)
  S.expect(server.kbPerSecondPerPlayerMax<=700,'banda por jogador '+server.kbPerSecondPerPlayerMax+' KB/s sem compressão (meta 700 neste estresse)');S.expect(server.tickP95<=20&&server.tickMax<=60,'tick p95 '+server.tickP95+' ms (meta 20), máx. '+server.tickMax+' ms (meta 60)');S.expect(states.length>=90,`${states.length} estados em 10 s (esperado ~100)`);S.expect(server.stateKBmax<=512,`estado de ${server.stateKBmax} KB`);

  // Cliente: aplica os estados gravados no navegador como se chegassem da rede.
  // O terreno só vai no primeiro estado da conexão: ele abre a sequência gravada.
  const withTerrain=blue.messages.filter(m=>m.data.type==='state'&&m.data.state.terrain).at(-1).data,recorded=[withTerrain,...states.map(m=>m.data)],c=await open(browser,{viewport:{width:1280,height:800}}),{page}=c;
  await page.evaluate(first=>{Multiplayer.session={code:'PERF',token:'x',side:'blue',nickname:'Azul'};Multiplayer.connected=true;Multiplayer.applyState(first);paused=false;},recorded[0]);
  await page.evaluate(()=>renderer.groundReady);await c.throttle();
  const r=await page.evaluate(async recorded=>{
   const apply=__wrap(Multiplayer,'applyState');let i=1,next=performance.now(),seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
   const m=await __measure(9000,(i0,now)=>{while(now>=next&&i<recorded.length){if(rnd()>=.05)Multiplayer.applyState(recorded[i]);i++;next+=100+(rnd()-.5)*80;}});
   apply.restore();return{m,applied:apply.calls,applyMs:apply.ms/Math.max(1,apply.calls)};},recorded);
  const s={...frameStats(r.m),applied:r.applied,applyMs:Math.round(r.applyMs*10)/10};S.budget('cliente aplicando estados a 10 Hz',s);
  S.expect(r.applied>=60,`só ${r.applied} estados aplicados`);
  // Rajada de 30 estados juntos: sem coalescer cada um custa um applyState; com P2P.coalesce só o último.
  const burst=await page.evaluate(async recorded=>{const texts=recorded.slice(1,31).map(x=>JSON.stringify({type:'state',side:'blue',matchId:x.matchId,state:x.state}));
   let cost=0;const timed=t=>{const t0=performance.now();Multiplayer.applyState(JSON.parse(t));cost+=performance.now()-t0;};
   for(const t of texts)timed(t);const raw=cost;cost=0;
   const deliver=P2P.coalesce(timed);for(const t of texts)deliver(t);await new Promise(r=>setTimeout(r,0));return{raw,merged:cost};},recorded);
  S.budget('rajada de 30 estados',{rawMs:Math.round(burst.raw),coalescedMs:Math.round(burst.merged)});S.expect(burst.merged<=100,`rajada coalescida bloqueou ${Math.round(burst.merged)} ms (meta 100)`);S.expect(burst.merged*5<=burst.raw,`coalescer deveria custar menos de 1/5 (${Math.round(burst.merged)} contra ${Math.round(burst.raw)} ms)`);S.expect(c.errors.length===0,'erros JS: '+c.errors[0]);await c.close();
 }finally{blue?.ws.close();red?.ws.close();green?.ws.close();gold?.ws.close();service.close?.();service.server.close();}
 S.finish('multiplayer com 4 jogadores e 300 unidades: servidor, rede e cliente medidos.');
});
