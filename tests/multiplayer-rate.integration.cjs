'use strict';
// Servidor multiplayer sob rajada de ordens: acima de 60 mensagens/s a ordem volta recusada (code 'rate') sem perder a sequência,
// o envio periódico leva só o estado e o estado não carrega a rota duplicada (job) das unidades.
const assert=require('node:assert/strict'),{once}=require('node:events'),{WebSocket}=require('ws');
const {createMultiplayerServer}=require('../scripts/multiplayer-server.cjs');
async function peer(url,session){
 const ws=new WebSocket(url.replace(/^http/,'ws')+'/multiplayer'),messages=[];ws.on('message',raw=>messages.push(JSON.parse(raw)));await once(ws,'open');
 const wait=(predicate,from=0)=>new Promise((resolve,reject)=>{const find=()=>messages.slice(from).find(predicate),ready=find();if(ready){resolve(ready);return;}const timer=setTimeout(()=>{ws.off('message',check);reject(new Error('Mensagem esperada não recebida: '+predicate));},5000);function check(){const value=find();if(value){clearTimeout(timer);ws.off('message',check);resolve(value);}}ws.on('message',check);});
 const send=(value,predicate)=>{const from=messages.length;ws.send(JSON.stringify(value));return predicate?wait(predicate,from):undefined;};
 await send({type:'auth',version:1,code:session.code,token:session.token},m=>m.type==='authenticated');let seq=0;
 return {ws,messages,wait,send,command(action,args={}){const n=++seq;return send({type:'command',seq:n,action,args},m=>m.type==='ack'&&m.seq===n);}};
}
const count=(peer,type)=>peer.messages.filter(m=>m.type===type).length,pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let time=100000;const service=createMultiplayerServer({autoTick:false,now:()=>time});await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+service.server.address().port,all=[];
 const post=async(route,body)=>(await fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
 try{
  const a=await post('/api/rooms',{nickname:'Piloto A',config:{map:'river',mode:'rts',seed:71}}),b=await post('/api/rooms/'+a.code+'/join',{nickname:'Piloto B'});
  const blue=await peer(url,a),red=await peer(url,b);all.push(blue.ws,red.ws);const room=service.rooms.get(a.code);
  await blue.send({type:'ready',ready:true},m=>m.type==='room'&&m.room.players[0].ready);await red.send({type:'ready',ready:true},m=>m.type==='room'&&m.room.players.every(p=>p.ready));
  await blue.send({type:'start'},m=>m.type==='state');const g=room.game,own=g.units.filter(u=>u.owner==='blue'&&u.type!=='commander');
  const stop={ids:[own[0].id],type:'stop',args:{}};

  // 1. Rajada: 60 ordens passam, a 61ª volta recusada e a sequência continua válida na janela seguinte.
  time+=1000;
  for(let i=0;i<60;i++)assert.equal((await blue.command('order',stop)).ok,true,'ordem '+(i+1)+' de 60');
  const limited=await blue.command('order',stop);assert.equal(limited.ok,false);assert.equal(limited.code,'rate');
  time+=1000;const next=await blue.command('order',stop);assert.equal(next.ok,true,'a ordem seguinte não perde a sequência');assert.equal(next.seq,limited.seq+1);
  console.log('OK rajada de ordens: 61ª recusada com code rate e sequência preservada');

  // 2. Mensagens que não são ordens continuam recebendo o erro 429 acima do limite.
  time+=1000;const from=blue.messages.length;for(let i=0;i<65;i++)blue.ws.send(JSON.stringify({type:'prepare'}));
  await blue.wait(m=>m.type==='error'&&m.code==='rate',from);
  console.log('OK mensagens comuns acima do limite recebem erro rate');

  // 3. Ordem não dispara estado; o envio periódico (a cada 3 ticks) leva só o estado, sem sala nem resultado.
  time+=1000;await pause(50);const states=count(blue,'state'),rooms=count(blue,'room');
  assert.equal((await blue.command('order',stop)).ok,true);await pause(50);assert.equal(count(blue,'state'),states,'a ordem não reenvia o estado inteiro');
  const mark=blue.messages.length;for(let i=0;i<3;i++)service.tick();await blue.wait(m=>m.type==='state',mark);await pause(50);
  assert.equal(count(blue,'state'),states+1,'um estado a cada 3 ticks');assert.equal(count(blue,'room'),rooms,'sala só quando a sala muda');assert.equal(count(blue,'result'),0);
  console.log('OK envio periódico leva só o estado');

  // 4. A rota de um grupo vai em path; job (duplicado) não é enviado.
  time+=1000;g.terrain.fill('plain');const pair=g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').slice(0,2),group=pair.map(u=>u.id);
  const moved=await blue.command('order',{ids:group,type:'move',args:{x:Math.min(120,Math.round(pair[0].x)+5),y:Math.round(pair[0].y)}});assert.equal(moved.ok,true);
  assert.ok(group.some(id=>g.get(id).job),'o motor mantém job');
  const view=service.viewState(room,'blue'),mine=view.units.filter(u=>group.includes(u.id));
  assert.ok(mine.length>0&&mine.every(u=>!('job' in u)),'job não é enviado');assert.ok(mine.some(u=>u.path.length>0),'path segue sendo enviado');
  assert.ok(!('job' in JSON.parse(JSON.stringify(view)).units.find(u=>u.id===group[0])));
  console.log('OK estado sem job e com path');

  // 5. Limite de tropas: com 50 tropas a produção volta recusada com code cap e a mensagem diz o limite.
  time+=1000;g.credits.blue=5000;const hq=g.hq('blue');
  for(let i=g.armySize('blue');i<50;i++)g.add('blue','infantry',10+i%30,60);
  const capped=await blue.command('enqueue',{type:'infantry',baseId:hq.id});
  assert.equal(capped.ok,false);assert.equal(capped.code,'cap');assert.match(capped.message,/50 tropas/);assert.equal(hq.queue.length,0);assert.equal(g.credits.blue,5000);
  g.units=g.units.filter(u=>u.owner!=='blue'||u.type==='commander'||u.id===pair[0].id);time+=1000;
  assert.equal((await blue.command('enqueue',{type:'infantry',baseId:hq.id})).ok,true,'abaixo do limite volta a produzir');
  console.log('OK limite de 50 tropas recusado com code cap');

  // 6. /health informa a carga do servidor.
  const health=await (await fetch(url+'/health')).json();
  assert.equal(health.ok,true);assert.equal(health.multiplayer,true);assert.equal(health.rooms,1);assert.equal(typeof health.tickRate,'number');assert.equal(typeof health.cpu,'number');
  console.log('OK /health com rooms, tickRate e cpu');
  console.log('OK multiplayer: limite de taxa, envio periódico e estado enxuto');
 }finally{for(const ws of all)ws.terminate();await service.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
