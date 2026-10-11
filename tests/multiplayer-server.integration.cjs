'use strict';
const assert=require('node:assert/strict'),{once}=require('node:events'),{WebSocket}=require('ws');
const {createMultiplayerServer}=require('../scripts/multiplayer-server.cjs');
async function peer(url,session){
 const ws=new WebSocket(url.replace(/^http/,'ws')+'/multiplayer'),messages=[];ws.on('message',raw=>messages.push(JSON.parse(raw)));await once(ws,'open');
 const wait=(predicate,from=0)=>new Promise((resolve,reject)=>{const find=()=>messages.slice(from).find(predicate),ready=find();if(ready){resolve(ready);return;}const timer=setTimeout(()=>{ws.off('message',check);reject(new Error('Mensagem esperada não recebida: '+predicate));},5000);function check(){const value=find();if(value){clearTimeout(timer);ws.off('message',check);resolve(value);}}ws.on('message',check);});
 const send=async(value,predicate)=>{const from=messages.length;ws.send(JSON.stringify(value));return predicate?wait(predicate,from):undefined;};
 await send({type:'auth',version:1,code:session.code,token:session.token},m=>m.type==='authenticated');let seq=0;
 return {ws,messages,wait,send,command(action,args={},number){const n=number??++seq;seq=Math.max(seq,n);return send({type:'command',seq:n,action,args},m=>m.type==='ack'&&m.seq===n);},reset(){seq=0;}};
}
(async()=>{
 let time=100000;const service=createMultiplayerServer({autoTick:false,now:()=>time,graceMs:120000,maxRooms:32});await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+service.server.address().port,all=[];
 const post=async(route,body)=>{const res=await fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,body:await res.json()};};
 const pair=async(map='river',mode='rts')=>{const a=(await post('/api/rooms',{nickname:'Piloto A',config:{map,mode,seed:71}})).body,b=(await post('/api/rooms/'+a.code+'/join',{nickname:'Piloto B'})).body,blue=await peer(url,a),red=await peer(url,b);all.push(blue.ws,red.ws);const room=service.rooms.get(a.code);await blue.send({type:'ready',ready:true},m=>m.type==='room'&&m.room.players[0].ready);await red.send({type:'ready',ready:true},m=>m.type==='room'&&m.room.players.every(p=>p.ready));await blue.send({type:'start'},m=>m.type==='state');return {room,blue,red,a,b};};
 const advance=n=>{for(let i=0;i<n;i++)service.tick();};
 const disconnect=async(room,side,client)=>{const wait=once(room.players.find(p=>p.side===side).ws,'close');client.ws.terminate();await wait;};
 const fixture=room=>{const g=room.game;g.units=[];g.structures=[];g.mines=[];g.events=[];g.logs=[];g.projectiles=[];g.actions=[];g.animation=null;g.winner=null;g.turn='blue';g.round=1;g.terrain.fill('plain');g.memory.blue.clear();g.memory.red.clear();g.add('blue','hq',0,93);g.add('red','hq',125,0);g.credits={blue:5000,red:5000};g.rng=()=>.2;return g;};
 try{
  assert.equal((await post('/api/rooms',{nickname:'',config:{}})).status,400);for(const options of [{unknown:.4},{water:2},{posts:3}])assert.equal((await post('/api/rooms',{nickname:'A',config:{options}})).status,400);
  for(const map of ['river','desert','mountain','random'])for(const mode of ['rts','turns']){
   const {room,blue,red}=await pair(map,mode),g=room.game,occupied=new Set();assert.equal(g.aiEnabled,false);assert.equal(g.multiplayer,true);assert.equal(g.credits.blue,150);assert.equal(g.credits.red,150);
   for(const s of g.structures){assert.ok(s.x>=0&&s.y>=0&&s.x+s.width<=128&&s.y+s.height<=96);for(let y=s.y;y<s.y+s.height;y++)for(let x=s.x;x<s.x+s.width;x++){const k=y*128+x;assert.ok(!occupied.has(k));occupied.add(k);assert.ok(!['river','mountain'].includes(g.terrain[k]));}assert.ok(g.structures.some(t=>t.type===s.type&&t.x===128-s.x-s.width&&t.y===96-s.y-s.height));}
   assert.ok(g.units.every(u=>!occupied.has(Math.round(u.y)*128+Math.round(u.x))));for(const side of ['blue','red'])assert.equal(g.units.filter(u=>u.owner===side&&u.type==='commander').length,1);
   assert.ok((await blue.command('enqueue',{type:'infantry',baseId:g.hq('blue').id})).ok);assert.equal(g.credits.blue,100);
   if(mode==='turns'){assert.equal((await red.command('enqueue',{type:'infantry',baseId:g.hq('red').id})).ok,false);assert.ok((await blue.command('endTurn')).ok);advance(60);assert.equal(g.turn,'red');assert.equal(g.aiDecisions,0);}
   assert.ok((await red.command('enqueue',{type:'infantry',baseId:g.hq('red').id})).ok);assert.equal(g.credits.red,100);
   if(mode==='turns'){assert.ok((await red.command('endTurn')).ok);advance(30);assert.equal(g.turn,'blue');assert.equal(g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').length,3);}
   else{advance(300);assert.equal(g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').length,3);assert.equal(g.units.filter(u=>u.owner==='red'&&u.type==='infantry').length,3);}
   for(const side of ['blue','red'])for(const type of ['helicopter','helicopterGround','helicopterAir']){
    const g=fixture(room),client=side==='blue'?blue:red;g.turn=side;const u=g.add(side,type,50,40),target=g.add(side==='blue'?'red':'blue','heavyTank',52,40);target.hp=target.maxHp=1000;target.cooldown=100;g.updateVision();
    assert.ok((await client.command('setWeapon',{id:u.id,weapon:'gun'})).ok);const before=g.shotsFired,args={ids:[u.id],type:'attack',args:{targetId:target.id}};
    const first=await client.command('order',args);assert.ok(first.ok);assert.ok((await client.command('order',args,first.seq)).ok);advance(45);
    const count=mode==='turns'?(type==='helicopter'?5:1):(type==='helicopter'?8:2);assert.equal(g.shotsFired-before,count);assert.equal(1000-target.hp,(type==='helicopter'?1:30)*(mode==='rts'&&type==='helicopter'?7:count));
    if(mode==='turns'){assert.equal(u.actionLeft,false);assert.equal((await client.command('order',args)).ok,false);}const view=service.viewState(room,side);assert.ok(view.units.some(v=>v.id===u.id&&v.weaponMode==='gun'));
    if(type==='helicopter'){g.shoot(u,target,'gun');const projectile=g.projectiles.at(-1);g.hurt(u,999,null);service.tick();const own=service.viewState(room,side).projectiles.find(p=>p.weapon==='gun');assert.ok(own);assert.equal(own.type,'helicopter','a Minigun própria conserva a aparência após perder o atirador');assert.equal(own.power,undefined);assert.equal(projectile.power,4);}
   }
   for(const side of ['blue','red']){
    let g=fixture(room);g.turn=side;const client=side==='blue'?blue:red,other=side==='blue'?'red':'blue',light=g.add(side,'lightTank',40,40),armor=g.add(other,'heavyTank',42,40);armor.cooldown=100;g.updateVision();
    const shots=g.shotsFired;assert.equal((await client.command('order',{ids:[light.id],type:'attack',args:{targetId:armor.id}})).ok,false);assert.equal(g.shotsFired,shots);assert.equal(light.actionLeft,true);
    g=fixture(room);g.turn=side;const medium=g.add(side,'tank',40,40),aim=g.add(other,'infantry',45,40);aim.cooldown=100;g.updateVision();
    assert.equal((await client.command('order',{ids:[medium.id],type:'attack',args:{targetId:aim.id}})).ok,true);let n=0;while(!g.projectiles.length&&n++<30)service.tick();assert.ok(g.projectiles.length);assert.ok(Math.abs(g.projectiles[0].accuracy-.55)<1e-8);assert.equal(medium.x,40);advance(20);assert.equal(aim.hp,40);
    g=fixture(room);g.turn=side;const heavy=g.add(side,'heavyTank',40,40),hidden=g.add(other,'infantry',47,40);hidden.cooldown=100;g.updateVision();assert.equal(service.viewState(room,side).units.some(u=>u.id===hidden.id),false);
    assert.equal((await client.command('order',{ids:[heavy.id],type:'attack',args:{targetId:hidden.id}})).ok,false);g.add(side,'recon',46,42);g.updateVision();assert.ok(service.viewState(room,side).units.some(u=>u.id===hidden.id));
    assert.equal((await client.command('order',{ids:[heavy.id],type:'attack',args:{targetId:hidden.id}})).ok,true);advance(20);assert.equal(hidden.hp,20);assert.equal(heavy.x,40);assert.equal(heavy.moveLeft,4);assert.ok(service.viewState(room,side).units.some(u=>u.id===heavy.id&&u.moveLeft===4));
   }
   await blue.send({type:'leave'});red.ws.close();console.log('OK geração, produção, helicópteros e novos tanques via WebSocket: '+map+' / '+mode);
  }
  for(const mode of ['rts','turns']){
   const {room,blue,red}=await pair('river',mode),g=fixture(room),a=g.add('blue','infantry',10,10),enemy=g.add('red','infantry',13,10),postBase=g.add('neutral','post',14,14),engineer=g.add('blue','engineer',12,13),repair=g.add('blue','lightTank',11,13);repair.hp=70;g.updateVision();
   const seqBefore=room.players[0].lastSeq;assert.equal((await blue.command('order',{ids:[enemy.id],type:'move',args:{x:12,y:10}})).code,'ownership');
   assert.equal((await blue.command('order',{ids:[a.id],type:'move',args:{x:'bad',y:10}})).ok,false);assert.equal(a.pending,false);
   assert.ok((await blue.command('order',{ids:[a.id],type:'move',args:{x:11,y:10}})).ok);advance(60);assert.equal(a.x,11);
   assert.ok((await blue.command('order',{ids:[engineer.id],type:'repair',args:{targetId:repair.id}})).ok);advance(60);assert.ok(repair.hp>=94);
   assert.ok((await blue.command('order',{ids:[a.id],type:'attack',args:{targetId:enemy.id}})).ok);advance(240);assert.ok(enemy.hp<100);
   const capture=g.add('blue','infantry',13,14);g.updateVision();assert.ok((await blue.command('order',{ids:[capture.id],type:'capture',args:{targetId:postBase.id}})).ok);advance(mode==='rts'?300:90);assert.equal(postBase.owner,'blue');
   if(mode==='turns'){assert.ok((await blue.command('endTurn')).ok);advance(60);assert.equal(g.turn,'red');assert.equal((await blue.command('order',{ids:[a.id],type:'stop',args:{}})).code,'turn');const redMover=g.add('red','infantry',30,30),blueNearby=g.add('blue','infantry',31,31);g.updateVision();assert.ok((await red.command('order',{ids:[redMover.id],type:'move',args:{x:30,y:31}})).ok);advance(90);assert.equal(g.turn,'red');assert.equal(blueNearby.hp,100);assert.equal(redMover.actionLeft,true);}
   assert.ok(room.players[0].lastSeq>seqBefore);g.hurt(g.hq('red'),999,null);service.tick();assert.equal(room.result.winner,'blue');console.log('OK ordens, captura, reparo, ataque e vitória: '+mode);blue.ws.close();red.ws.close();
  }
  {
   const {room,blue,red}=await pair('river','turns'),g=fixture(room),helicopter=g.add('blue','helicopter',20,20);g.updateVision();
   assert.ok((await blue.command('order',{ids:[helicopter.id],type:'move',args:{x:26,y:20}})).ok);assert.equal(g.busy,true);
   assert.ok((await blue.command('order',{ids:[helicopter.id],type:'stop',args:{}})).ok,'parar deve cancelar a ação aérea própria durante a execução');
   advance(60);assert.equal(helicopter.pending,false);assert.equal(helicopter.order.type,'stop');assert.equal(g.busy,false);assert.equal(g.turn,'blue');blue.ws.close();red.ws.close();console.log('OK cancelamento de ação aérea própria durante execução');
  }
  for(const mode of ['rts','turns']){
   const {room,blue,red}=await pair('river',mode),g=fixture(room),blueAirport=g.add('blue','airportAsphalt',20,50),redAirport=g.add('red','airportAsphalt',70,50),workers=[g.add('blue','engineer',39,30),g.add('blue','engineer',40,29)];g.updateVision();
   const until=(predicate,label)=>{let remaining=9000;while(!predicate()&&remaining-->0)service.tick();assert.ok(predicate(),label);};
   const switchSide=async side=>{if(mode==='turns'&&g.turn!==side){assert.ok((await (g.turn==='blue'?blue:red).command('endTurn')).ok);until(()=>g.turn===side&&!g.busy,'o turno deve passar ao jogador solicitado');}};
   const buildCredits=g.credits.blue;assert.ok((await blue.command('buildAirport',{ids:workers.map(u=>u.id),cell:{x:40,y:30}})).ok);assert.equal(g.credits.blue,buildCredits-400);const site=g.structures.find(s=>s.type==='airportSite');assert.equal(site.width,6);assert.equal(site.height,2);
   const bluePrice=g.recruitCost('fighterBlue',blueAirport),blueCredits=g.credits.blue;assert.equal(bluePrice,Math.round(g.recruitCost('fighterBlue',null)*.8));assert.ok((await blue.command('enqueue',{type:'fighterBlue',baseId:blueAirport.id})).ok);assert.equal(g.credits.blue,blueCredits-bluePrice);
   const bomberCredits=g.credits.blue;assert.ok((await blue.command('enqueue',{type:'bomberBlue',baseId:blueAirport.id})).ok);assert.equal(g.credits.blue,bomberCredits-1037);
   await switchSide('red');assert.equal((await red.command('prepareBomber',{load:{bombCommon:1}})).ok,false);
   for(const type of ['fighterRed','multiroleRed','stealthFighterRed','bomberRed']){const credits=g.credits.red,price=g.recruitCost(type,redAirport);assert.equal(price,Math.round(g.recruitCost(type,null)*.8));assert.ok((await red.command('enqueue',{type,baseId:redAirport.id})).ok);assert.equal(g.credits.red,credits-price);}
   assert.equal((await red.command('enqueue',{type:'fighterBlue',baseId:redAirport.id})).ok,false);assert.equal((await red.command('enqueue',{type:'bomberBlue',baseId:redAirport.id})).ok,false);
   if(mode==='rts')until(()=>redAirport.queue.length===0&&blueAirport.queue.length===0&&site.type==='airportDirt','a produção e a construção devem concluir');
   else for(let round=0;round<30&&redAirport.queue.length;round++){time+=1000;await switchSide('blue');await switchSide('red');}
   assert.equal(site.type,'airportDirt');assert.equal(blueAirport.queue.length,0);assert.equal(redAirport.queue.length,0);assert.ok(g.units.some(u=>u.type==='bomberBlue'&&u.flightState==='grounded'));
   for(const type of ['fighterRed','multiroleRed','stealthFighterRed','bomberRed']){const plane=g.units.find(u=>u.type===type);assert.ok(plane);assert.equal(plane.owner,'red');assert.equal(plane.flightState,'grounded');assert.equal(plane.airportId,redAirport.id);if(type==='bomberRed'){assert.equal(plane.ammo.jetGun,undefined);assert.equal(plane.ammo.cruiseMissile,2);}else assert.ok(plane.ammo.jetGun>0);}
   assert.equal((await blue.command('launchBomber',{start:{x:5,y:90},end:{x:11,y:90}})).ok,false,'apoio externo removido');
   await switchSide('red');const fighter=g.units.find(u=>u.type==='fighterRed');assert.ok((await red.command('order',{ids:[fighter.id],type:'takeoff',args:{}})).ok);assert.equal(fighter.flightState,'waitRunway');assert.equal((await red.command('order',{ids:[fighter.id],type:'stop',args:{}})).ok,false,'a pista continua bloqueando cancelamento');assert.equal((await red.command('order',{ids:[fighter.id],type:'move',args:{x:82,y:55}})).ok,false);
   until(()=>fighter.flightState==='patrol'&&!fighter.runway&&!g.busy,'a decolagem deve completar as fases');assert.equal(fighter.airportId,null);if(mode==='turns'){assert.equal((await red.command('order',{ids:[fighter.id],type:'land',args:{targetId:redAirport.id}})).ok,false,'a decolagem já consumiu a ação deste turno');await switchSide('blue');await switchSide('red');}assert.ok((await red.command('order',{ids:[fighter.id],type:'land',args:{targetId:redAirport.id}})).ok);
   until(()=>fighter.flightState==='service'&&!fighter.runway&&!g.busy,'o pouso deve tocar, estacionar e iniciar manutenção');assert.equal(fighter.airportId,redAirport.id);assert.equal((await red.command('servicePlane',{id:fighter.id})).ok,false);
   if(mode==='rts')until(()=>fighter.flightState==='grounded','a manutenção deve terminar');else{await switchSide('blue');await switchSide('red');assert.equal(fighter.flightState,'grounded');}
   blue.ws.close();red.ws.close();console.log('OK aeroportos, descontos, quatro aviões vermelhos, bombardeiro aliado no aeroporto, decolagem e pouso: '+mode);
  }
  {
   const {room,blue,red}=await pair(),g=fixture(room),shooter=g.add('blue','stealthFighterBlue',40,40),target=g.add('red','antiAirVehicle',65,40);target.smokeCharges=0;target.hp=target.maxHp=1000;g.updateVision();assert.equal(g.isVisible('red',shooter),false);g.shoot(shooter,target,'antiRadiation');g.impact(g.projectiles.at(-1));const hidden=service.viewState(room,'red');assert.ok(!hidden.units.some(u=>u.id===shooter.id));assert.ok(!hidden.logs.some(l=>l.text.includes('Caça furtivo')),'registro de dano não revela lançador furtivo');assert.ok(hidden.logs.some(l=>l.text.includes('Ataque não identificado')),'alvo conserva informação de dano');target.x=42;g.logs=[];g.updateVision();g.shoot(shooter,target,'antiRadiation');g.impact(g.projectiles.at(-1));assert.ok(service.viewState(room,'red').logs.some(l=>l.text.includes('Caça furtivo')),'visão direta permite nome no registro');blue.ws.close();red.ws.close();console.log('OK privacidade do nome do lançador nos registros de dano');
  }
  for(const mode of ['rts','turns']){
   const {room,blue,red}=await pair('river',mode),g=fixture(room),heavy=g.add('red','bomberRed',40,40),allied=g.add('blue','bomberBlue',60,60);g.turn='red';heavy.facing=Math.PI/2;allied.facing=Math.PI/2;g.updateVision();
   const until=predicate=>{let n=4000;while(!predicate()&&n-->0)service.tick();assert.ok(predicate());};
   for(const count of [6,12,24,48]){time+=1000;heavy.ammo.bombCommon=heavy.ammo.bombFragment=heavy.ammo.bombIncendiary=16;heavy.x=40;heavy.y=40;heavy.actionLeft=true;g.turn='red';const args={ids:[heavy.id],type:'bombRun',args:{start:{x:40,y:40},end:{x:48,y:40},bombCount:count}},seq=room.players[1].lastSeq+1;
    assert.ok((await red.command('order',args,seq)).ok);assert.ok((await red.command('order',args,seq)).ok);assert.equal(heavy.flightJob.bombs.length,count);assert.equal(g.actions.length,mode==='turns'?1:0,'ordem duplicada não cria ação extra');until(()=>heavy.flightJob?.type!=='bombRun'&&!g.busy);assert.equal(heavy.ammo.bombCommon+heavy.ammo.bombFragment+heavy.ammo.bombIncendiary,48-count);
   }
   for(const value of [0,7,'12',24.5,null])assert.equal((await red.command('order',{ids:[heavy.id],type:'bombRun',args:{start:{x:40,y:40},end:{x:48,y:40},bombCount:value}})).ok,false);
   g.turn='blue';allied.actionLeft=true;assert.equal((await blue.command('order',{ids:[allied.id],type:'bombRun',args:{start:{x:60,y:60},end:{x:68,y:60},bombCount:24}})).ok,false);assert.equal((await blue.command('order',{ids:[heavy.id],type:'bombRun',args:{start:{x:40,y:40},end:{x:48,y:40},bombCount:12}})).ok,false);
   g.units=[];const aa=g.add('red','antiAirVehicle',4,4);aa.radarOn=true;const observer=g.add('red','reconDrone',4,6);
   for(const type of ['stealthFighterBlue','bomberBlue']){const p=g.add('blue',type,70,70);p.flightJob={type:'bombRun',start:{x:70,y:70},end:{x:78,y:70},bombs:[],index:0,phase:'run'};g.updateVision();const hidden=service.viewState(room,'red');assert.ok(!hidden.units.some(u=>u.id===p.id)&&!hidden.radarContacts.red.includes(p.id),'furtivo atacando oculto não é transmitido');g.event('shot',p,{weapon:'jetAam'});assert.ok(!service.viewState(room,'red').events.some(e=>e.id===p.id||e.sourceType===type));observer.x=70;observer.y=69;g.updateVision();assert.ok(service.viewState(room,'red').units.some(u=>u.id===p.id),'visão compartilhada identifica');observer.x=4;observer.y=6;g.updateVision();assert.ok(!service.viewState(room,'red').units.some(u=>u.id===p.id),'perde identificação');g.units=g.units.filter(u=>u!==p);}
   const stealth=g.add('red','stealthFighterRed',70,70),blueRadar=g.add('blue','fighterBlue',54,70),bomber=g.add('red','bomberRed',70,72);g.updateVision();assert.ok(!service.viewState(room,'blue').units.some(u=>u.id===stealth.id));assert.ok(service.viewState(room,'blue').units.some(u=>u.id===bomber.id),'pesado detectado por radar do caça');
   g.projectiles.push({owner:'red',type:stealth.type,attackerId:stealth.id,targetId:blueRadar.id,weapon:'jetAam',air:true,sx:70,sy:70,x:69,y:70,tx:54,ty:70,elapsed:.1,duration:2,trail:[],power:75});const visual=service.viewState(room,'blue').projectiles[0];assert.equal(visual.attackerId,undefined);assert.equal(visual.type,'missile');assert.equal(visual.power,undefined);
   console.log('OK salvas/validação/deduplicação e furtividade visual/radar/rede: '+mode);blue.ws.close();red.ws.close();
  }
  {
   const {room,blue,red}=await pair(),g=fixture(room),base=g.hq('blue'),hidden=g.add('red','tank',70,50),observer=g.add('blue','recon',10,10);g.updateVision();
   const number=room.players[0].lastSeq+1,credits=g.credits.blue;const first=await blue.command('enqueue',{type:'infantry',baseId:base.id},number),again=await blue.command('enqueue',{type:'infantry',baseId:base.id},number);assert.ok(first.ok&&again.ok);assert.equal(base.queue.length,1);assert.equal(g.credits.blue,credits-50);
   const view=service.viewState(room,'blue');assert.ok(!view.units.some(u=>u.id===hidden.id));assert.equal(view.credits.red,0);assert.deepEqual(view.intel,[]);assert.equal(view.rng,undefined);assert.equal(view.mines.length,0);assert.equal(view.bomberReserve,undefined);assert.equal(view.visible.red,undefined);assert.ok(typeof view.visible.blue==='string');
   hidden.x=11;hidden.y=10;hidden.order={type:'attack',targetId:base.id};hidden.path=[{x:70,y:70}];g.updateVision();const visible=service.viewState(room,'blue').units.find(u=>u.id===hidden.id);assert.equal(visible.hp,hidden.hp);assert.deepEqual(visible.path,[]);assert.deepEqual(visible.order,{type:'stop'});assert.equal(visible.job,undefined);
   hidden.x=70;hidden.y=50;g.updateVision();g.event('shot',hidden,{weapon:'tank'});assert.ok(!service.viewState(room,'blue').events.some(e=>e.sourceType==='tank'));g.log('segredo vermelho',['red']);assert.ok(!service.viewState(room,'blue').logs.some(l=>l.text==='segredo vermelho'));
   const before=service.viewState(room,'blue').terrainRevision;g.terrain[50*128+70]='plain';g.terrain[50*128+71]='forest';assert.equal(service.viewState(room,'blue').terrainRevision,before);observer.x=71;observer.y=50;g.updateVision();assert.ok(service.viewState(room,'blue').terrainRevision>before);
   const missile={owner:'red',type:'tank',attackerId:hidden.id,targetId:observer.id,weapon:'jetAam',air:true,sx:70,sy:50,x:65,y:45,tx:10,ty:10,elapsed:.2,duration:1,power:999,hit:true,critical:true,trail:[]};g.projectiles.push(missile);const projectile=service.viewState(room,'blue').projectiles[0];for(const key of ['power','hit','critical','accuracy','deflected','decoy'])assert.equal(projectile[key],undefined);assert.equal(projectile.sx,projectile.x);assert.equal(projectile.tx,projectile.x);
   g.mode='turns';const bomber=g.add('blue','bomberBlue',90,70);bomber.flightJob={type:'transfer'};g.add('red','antiAirVehicle',120,4);const drone=g.add('blue','stealthDrone',10,10);drone.spotted.red=true;g.updateVision();assert.equal(g.radarContacts.red.has(bomber.id),false);
   const privateView=service.viewState(room,'blue');assert.equal(privateView.bomberReserve,undefined);assert.equal(privateView.bomberRadar,undefined);assert.equal(privateView.units.find(u=>u.id===drone.id).spotted.red,undefined);assert.ok(!service.viewState(room,'red').units.some(u=>u.id===bomber.id),'bombardeiro furtivo oculto não é enviado');
   console.log('OK deduplicação, validação e privacidade dos estados');blue.ws.close();red.ws.close();
  }
  {
   const {room,blue,red,a,b}=await pair(),gameTime=room.game.time;await disconnect(room,'red',red);service.tick();assert.equal(room.paused,true);advance(30);assert.equal(room.game.time,gameTime);
   time+=60000;const resumed=await peer(url,b);all.push(resumed.ws);assert.equal(room.paused,false);advance(3);assert.ok(room.game.time>gameTime);assert.equal(resumed.messages.filter(m=>m.type==='state').flatMap(m=>m.state.events).length,0);
   await disconnect(room,'red',resumed);time+=120001;service.tick();assert.equal(room.result.winner,'blue');assert.equal(room.result.reason,'abandonment');
   const restored=await peer(url,b);all.push(restored.ws);await blue.send({type:'rematch'},m=>m.type==='room'&&m.room.players[0].rematch);await restored.send({type:'rematch'},m=>m.type==='room'&&m.room.status==='waiting');assert.equal(room.players.find(p=>p.token===a.token).side,'red');assert.equal(room.players.find(p=>p.token===b.token).side,'blue');assert.ok(room.players.every(p=>!p.ready));blue.ws.close();restored.ws.close();console.log('OK reconexão, congelamento, abandono e revanche com troca de lados');
  }
  {
   const {room,blue,red}=await pair();await Promise.all([disconnect(room,'blue',blue),disconnect(room,'red',red)]);time+=120001;service.tick();assert.equal(room.status,'cancelled');assert.equal(room.result.winner,null);console.log('OK cancelamento quando os dois desconectam');
  }
  {
   const {room,blue,red,b}=await pair();await disconnect(room,'red',red);time+=120001;const late=await peer(url,b);all.push(late.ws);assert.equal(room.status,'finished');assert.equal(room.result.winner,'blue');blue.ws.close();late.ws.close();console.log('OK autenticação tardia não ultrapassa o prazo de reconexão');
  }
  {
   // Aposta do avião: ordem strikeCell numa casa invisível ao lado, recusada numa visível e com entrada inválida.
   const {room,blue,red}=await pair('river','rts'),g=fixture(room),plane=g.add('blue','multiroleBlue',20,60);plane.facing=Math.PI/2;g.terrain[60*128+80]='forest';g.add('red','tank',80,60);g.updateVision();
   const ok=await blue.command('order',{ids:[plane.id],type:'strikeCell',args:{x:80,y:60,weapon:'jetAgm',salvo:1}});assert.equal(ok.ok,true);assert.equal(plane.flightJob.type,'cellStrike');
   const seen=await blue.command('order',{ids:[plane.id],type:'strikeCell',args:{x:21,y:60,weapon:'jetAgm'}});assert.equal(seen.ok,false);
   const bad=await blue.command('order',{ids:[plane.id],type:'strikeCell',args:{x:'80',y:60}});assert.equal(bad.ok,false);
   const foreign=await red.command('order',{ids:[plane.id],type:'strikeCell',args:{x:80,y:60}});assert.equal(foreign.code,'ownership');
   console.log('OK aposta do avião: aceita em casa invisível, recusada visível, inválida e alheia');blue.ws.close();red.ws.close();
  }
  {
   const rejected=new WebSocket(url.replace(/^http/,'ws')+'/multiplayer',{origin:'null'});const denied=await new Promise(resolve=>{rejected.once('error',()=>resolve(true));rejected.once('open',()=>resolve(false));});assert.equal(denied,true);rejected.terminate();assert.equal((await fetch(url+'/health')).status,200);console.log('OK origem inválida recusada sem interromper o servidor');
  }
  for(const mode of ['rts','turns']){
   const {room,blue,red}=await pair('river',mode),g=fixture(room),b=g.add('blue','bomberBlue',20,60),fighter=g.add('blue','fighterBlue',20,62),hidden=g.add('red','heavyTank',45,60);g.doctrines={blue:'balanced',red:'balanced'};hidden.cooldown=100;hidden.idle=-100;g.updateVision();
   const order={ids:[b.id],type:'strikeCell',args:{x:45,y:60,weapon:'cruiseMissile',salvo:2}};
   assert.equal(service.viewState(room,'blue').units.some(u=>u.id===hidden.id),false);
   assert.equal((await red.command('order',order)).code,mode==='turns'?'turn':'ownership');
   assert.equal((await blue.command('order',{...order,args:{...order.args,x:128}})).ok,false);
   assert.equal((await blue.command('order',{...order,ids:[fighter.id]})).ok,false);
   const ack=await blue.command('order',order);assert.equal(ack.ok,true);assert.equal((await blue.command('order',order,ack.seq)).ok,true);
   let n=0;while(b.ammo.cruiseMissile===2&&n++<100)service.tick();assert.equal(b.ammo.cruiseMissile,1);
   const own=service.viewState(room,'blue'),foe=service.viewState(room,'red'),p=own.projectiles.find(p=>p.weapon==='cruiseMissile');assert.ok(p);assert.deepEqual(p.area,{x:45,y:60});assert.equal(p.power,undefined);assert.equal(foe.projectiles.find(p=>p.weapon==='cruiseMissile').area,undefined);assert.equal(own.units.some(u=>u.id===hidden.id),false,'não revela alvo');
   assert.equal(own.units.find(u=>u.id===b.id).ammo.cruiseMissile,1);advance(150);assert.equal(hidden.hp,120);assert.equal(b.ammo.cruiseMissile,1,'uma única munição mesmo com salva 2 e repetição de seq');
   const drone=g.add('blue','reconDrone',70,40),furtive=g.add('blue','stealthDrone',90,40),woods=g.add('red','infantry',75,40),hedge=g.add('red','infantry',95,40);g.terrain[40*128+75]='forest';g.terrain[40*128+95]='hedge';g.updateVision();let view=service.viewState(room,'blue');assert.ok(view.units.some(u=>u.id===woods.id));assert.ok(view.units.some(u=>u.id===hedge.id));g.hurt(drone,999,null);g.hurt(furtive,999,null);g.updateVision();view=service.viewState(room,'blue');assert.equal(view.units.some(u=>u.id===woods.id||u.id===hedge.id),false);
   fixture(room);g.doctrines={blue:'balanced',red:'balanced'};const launch=g.add('blue','bomberBlue',20,40),aa=g.add('red','antiAirVehicle',24,40),safe=g.add('red','heavyTank',25,40);safe.cooldown=100;safe.idle=-100;g.rng=()=>.7;g.updateVision();assert.equal((await blue.command('order',{ids:[launch.id],type:'strikeCell',args:{x:25,y:40,weapon:'cruiseMissile'}})).ok,true);let steps=0;while(!g.projectiles.some(p=>p.interceptor)&&steps++<10)service.tick();assert.ok(g.projectiles.some(p=>p.interceptor&&p.interceptSuccess));assert.ok(service.viewState(room,'red').projectiles.some(p=>p.weapon==='antiAirVehicle'));advance(40);assert.equal(safe.hp,280);assert.equal(aa.hp,70);assert.equal(aa.smokeCharges,2);assert.equal(g.projectiles.some(p=>p.weapon==='cruiseMissile'),false);
   console.log('OK cruzeiro e drones via WebSocket: coordenadas, propriedade, carga, névoa, dano e interceptação / '+mode);blue.ws.close();red.ws.close();
  }
  assert.equal((await post('/api/rooms/INVALID1/join',{nickname:'A'})).status,404);
  console.log('OK multiplayer integration server: apenas cenários funcionais, sem testes de desempenho');
 }finally{for(const ws of all)ws.terminate();await service.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
