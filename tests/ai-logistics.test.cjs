'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});
vm.runInContext(fs.readFileSync(process.env.RTS_AI_ENGINE||'public/js/engine.js','utf8')+'\nthis.api={Game,TYPES,KEY,DIST};',ctx);
const {Game,TYPES,KEY,DIST}=ctx.api,results=[];
function field(mode='rts'){
 const g=new Game('river','normal',17,mode);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.memory.red.clear();g.intel.clear();g.actions=[];g.aiQueue=[];g.aiEnabled=false;g.turn='red';
 g.add('red','hq',100,70);g.add('blue','hq',5,5);g.plan.rally={x:90,y:65};g.credits.red=1000;g.updateVision();return g;
}
function remember(g,s){g.memory.red.set(KEY(s.x,s.y),{id:s.id,type:s.type,owner:s.owner,x:s.x,y:s.y,width:s.width,height:s.height});}
function advance(g,seconds){for(let i=0;i<seconds*30;i++)g.update(1/30);}
function test(name,fn){try{fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.stack});}console.log(JSON.stringify(results.at(-1)));}
for(const mode of ['rts','turns']){
 test(mode+': transporte procura reforcos alem de 12 casas',()=>{
  const g=field(mode),truck=g.add('red','transportTruck',60,60),foot=g.add('red','infantry',90,60);g.plan.objective={x:30,y:60};g.aiAct(truck);
  assert.equal(truck.aiPassengerId,foot.id);assert.equal(truck.order.type,'move');assert.ok(truck.path.length||g.actions.length);
 });
 test(mode+': dois transportes nao reservam o mesmo passageiro',()=>{
  const g=field(mode),a=g.add('red','transportTruck',80,60),b=g.add('red','transportTruck',80,62),foot=g.add('red','infantry',85,60);g.plan.objective={x:30,y:60};g.aiTransport(a);g.aiTransport(b);
  assert.equal(a.aiPassengerId,foot.id);assert.notEqual(b.aiPassengerId,foot.id);
 });
 test(mode+': entrega mantem missao de captura fora da onda',()=>{
  const g=field(mode),post=g.add('neutral','post',30,60),truck=g.add('red','transportTruck',50,60),foot=g.add('red','infantry',51,60);remember(g,post);g.plan.objective={...g.memory.red.get(KEY(30,60))};g.aiTransport(truck);assert.equal(truck.cargo[0],foot);
  truck.x=34;truck.actionLeft=true;g.aiTransport(truck);assert.equal(truck.cargo.length,0);foot.actionLeft=true;foot.moveLeft=TYPES.infantry.move;g.aiAct(foot);
  assert.equal(foot.order.type,'capture');assert.equal(foot.order.targetId,post.id);
 });
 test(mode+': antitanque vazio busca municao na base',()=>{
  const g=field(mode),u=g.add('red','antitank',99,70);u.atMissiles=0;g.aiAct(u);assert.equal(u.order.type,'service');advance(g,13);assert.ok(u.atMissiles>0);
 });
 test(mode+': comandante e antiaerea acompanham a frente',()=>{
  for(const type of ['commander','antiAirVehicle','missileInfantry']){
   const g=field(mode),tank=g.add('red','tank',60,60),u=g.add('red',type,50,60);g.plan={phase:'attack',since:0,rally:{x:90,y:65},objective:{x:30,y:60},wave:[tank.id],waveStart:150};g.aiAct(u);
   assert.equal(u.order.type,'move');const target=u.job?.goal||g.actions.find(a=>a.id===u.id)?.route.at(-1);assert.ok(target);assert.ok(target.x>50,'apoio recua atras da linha');assert.ok(target.x<=64,'apoio permanece com a frente');
  }
 });
}
test('compra transporte para duas tropas livres sem aguardar quatro',()=>{
 const g=field();g.plan.objective={x:30,y:60};g.add('red','infantry',98,68);g.add('red','antitank',98,67);assert.equal(g.aiBuyTransport(),true);assert.equal(g.hq('red').queue[0].type,'transportTruck');
});
test('rota evita ameaca visivel antes da primeira perda, mas nao adivinha ocultos',()=>{
 const g=field(),truck=g.add('red','transportTruck',80,60),enemy=g.add('blue','heavyTank',65,60),route=[{x:76,y:60},{x:72,y:60},{x:68,y:60}];g.updateVision();assert.equal(g.isVisible('red',enemy),false);assert.equal(g.aiTransportRouteSafe(truck,route),true);
 g.add('red','reconDrone',66,64);g.updateVision();assert.equal(g.isVisible('red',enemy),true);assert.equal(g.aiTransportRouteSafe(truck,route),false);
});
test('desembarque bloqueado reposiciona transporte com carga',()=>{
 const g=field(),truck=g.add('red','transportTruck',64,60),foot=g.add('red','infantry',65,60);g.order(truck,'embark',{targetId:foot.id});g.plan.objective={x:60,y:60};
 for(const [x,y]of [[63,60],[65,60],[64,59],[64,61]])g.terrain[KEY(x,y)]='river';
 // Helicopter can move out of a landing zone surrounded by water.
 truck.type='transportHelicopter';truck.altitude='low';g.aiTransport(truck);assert.equal(truck.cargo.length,1);assert.equal(truck.order.type,'move');
});
test('reforco de paraquedas recebe objetivo e composicao contra blindados observados',()=>{
 const g=field(),a=g.add('red','airportDirt',80,60),post=g.add('neutral','post',60,60);remember(g,post);g.add('red','reconDrone',62,62);g.add('blue','heavyTank',66,65);g.updateVision();g.plan.objective={...g.memory.red.get(KEY(60,60))};assert.ok(g.aiBuyTransport());
 const plane=g.airdropPlane('red');assert.ok(plane);assert.ok(plane.cargo.some(u=>u.type==='antitank'));assert.ok(plane.cargo.every(u=>u.aiObjective?.id===post.id));assert.ok(g.credits.red>=0);
});
test('artilharia nao dispara quando o unico alvo exporia aliados',()=>{
 const g=field(),u=g.add('red','artillery',70,60),enemy=g.add('blue','infantry',75,60);g.add('red','infantry',75,61);g.updateVision();assert.ok(g.canFire(u,enemy));assert.equal(g.aiAcquire(u),null);
 g.plan={phase:'attack',objective:{x:80,y:60},rally:{x:70,y:60},wave:[u.id],waveStart:180};g.aiAct(u);assert.notEqual(u.order.type,'attack');
});
test('save preserva coleta e missao dos passageiros',()=>{
 const g=field(),u=g.add('red','transportTruck',80,60),p=g.add('red','infantry',81,60);g.plan.objective={x:30,y:60};g.aiTransport(u);const saved=Game.fromSnapshot(g.snapshot());assert.equal(saved.get(u.id).cargo[0].aiObjective?.x,30);
});
for(const type of ['transportTruck','transportHelicopter'])test('RTS: ciclo real coleta, entrega e captura com '+type,()=>{
 const g=field(),post=g.add('neutral','post',30,60),carrier=g.add('red',type,60,60),p=g.add('red','infantry',90,60);remember(g,post);g.plan.objective={...g.memory.red.get(KEY(30,60))};
 if(type==='transportHelicopter')for(let y=0;y<96;y++)g.terrain[KEY(50,y)]='river';
 let boarded=false,delivered=false;
 for(let i=0;i<180*30&&post.owner!=='red';i++){
  if(i%18===0)for(const u of [...g.units])if(u.owner==='red'&&(!u.pending&&!u.segment||TYPES[u.type].capacity&&u.job?.type==='move'))g.aiAct(u);
  g.update(1/30);boarded||=carrier.cargo?.some(u=>u.id===p.id);delivered||=boarded&&!!g.get(p.id);g.events=[];
 }
 assert.ok(boarded,'passageiro embarcou');assert.ok(delivered,'passageiro desembarcou');assert.equal(post.owner,'red','captura apos viagem real');
});
test('RTS: paraquedistas concluem captura apos voo e descida reais',()=>{
 const g=field(),post=g.add('neutral','post',30,60);g.add('red','airportDirt',80,60);g.add('red','reconDrone',32,60);remember(g,post);g.plan.objective={...g.memory.red.get(KEY(30,60))};g.updateVision();assert.ok(g.aiBuyTransport());
 let airborne=false,landed=false;const plane=g.airdropPlane('red');
 for(let i=0;i<150*30&&post.owner!=='red';i++){
  if(i%18===0)for(const u of [...g.units])if(u.owner==='red'&&!u.pending&&!u.segment)g.aiAct(u);
  g.update(1/30);airborne||=g.drops.length>0;landed||=g.units.some(u=>u.aiObjective?.id===post.id);g.events=[];
 }
 assert.ok(airborne);assert.ok(landed);assert.equal(post.owner,'red');assert.ok(plane.hp>0);
});
assert.equal(results.filter(r=>!r.ok).length,0,'Falhas de logistica/tatica da IA');
console.log(results.length+' cenarios de logistica/tatica OK');
