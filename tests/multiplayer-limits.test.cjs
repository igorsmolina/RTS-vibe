'use strict';
// Multiplayer: limite de tropas por jogador, visão refeita a 10 Hz no RTS e rota curta no estado enviado a cada jogador.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createMultiplayerServer}=require('../scripts/multiplayer-server.cjs');
const {Game,UNIT_CAP,STEP}=new Function(fs.readFileSync(path.join(__dirname,'..','public','js','engine.js'),'utf8')+'\nreturn {Game,UNIT_CAP,STEP};')();
const cases=[],test=(name,fn)=>cases.push([name,fn]);
function field(mode='rts',multiplayer=true){
 const g=new Game('river','normal',123,mode,{posts:2});g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.actions=[];g.animation=null;g.projectiles=[];g.memory.blue.clear();g.memory.red.clear();g.aiEnabled=false;g.multiplayer=multiplayer;
 g.add('blue','hq',1,90);g.add('red','hq',120,2);g.rng=()=>.5;g.credits={blue:5000,red:5000};g.updateVision();return g;
}
const fill=(g,owner,n,type='infantry')=>{for(let i=0;i<n;i++)g.add(owner,type,5+i%40,60-Math.floor(i/40)*2);};
const detach=(g,u)=>{g.units=g.units.filter(v=>v!==u);return u;};

test('o limite conta tropas em campo e na fila, por jogador',()=>{
 const g=field();fill(g,'blue',UNIT_CAP-1);
 assert.equal(g.armySize('blue'),UNIT_CAP-1);assert.equal(g.atUnitCap('blue'),false);
 assert.equal(g.enqueue('blue','infantry'),true,'a 50ª entra na fila');assert.equal(g.armySize('blue'),UNIT_CAP);assert.equal(g.credits.blue,5000-50);
 assert.equal(g.enqueue('blue','infantry'),false,'a 51ª é recusada');assert.equal(g.credits.blue,5000-50,'sem débito');
 assert.equal(g.enqueue('red','infantry'),true,'o outro jogador tem o próprio limite');
});
test('embarcadas, em queda e unidades mortas: contagem',()=>{
 const g=field(),truck=g.add('blue','transportTruck',10,60);
 truck.cargo=[detach(g,g.add('blue','infantry',11,60)),detach(g,g.add('blue','engineer',12,60))];
 g.drops=[{x:20,y:20,owner:'blue',passenger:detach(g,g.add('blue','infantry',0,0)),elapsed:0,destination:{x:20,y:20}},{x:21,y:20,owner:'red',passenger:detach(g,g.add('red','infantry',0,0)),elapsed:0,destination:{x:21,y:20}}];
 assert.equal(g.armySize('blue'),1+2+1,'caminhão + 2 embarcados + 1 em queda');assert.equal(g.armySize('red'),1);
 const dead=g.add('blue','infantry',30,60);dead.hp=0;assert.equal(g.armySize('blue'),4,'unidade destruída não conta');
});
test('comandante, avião de transporte e estruturas não contam',()=>{
 const g=field();g.add('blue','commander',3,88);g.add('blue','post',30,30);const plane=g.add('blue','transportPlane',0,50);plane.cargo=[detach(g,g.add('blue','infantry',0,0))];
 assert.equal(g.armySize('blue'),1,'só o passageiro do avião');
});
test('fora do multiplayer não há limite',()=>{
 const g=field('rts',false);fill(g,'blue',UNIT_CAP+10);
 assert.equal(g.atUnitCap('blue'),false);assert.equal(g.enqueue('blue','infantry'),true);
});
test('reforço aéreo e compra no avião respeitam o limite',()=>{
 const g=field(),base=g.add('blue','airportDirt',20,20);g.add('blue','recon',30,30);fill(g,'blue',UNIT_CAP-3);g.updateVision();
 assert.equal(g.canAirdrop('blue',base.id,{infantry:3},{x:30,y:30}),false,'48 + 3 passa de 50');
 assert.equal(g.requestAirdrop('blue',base.id,{infantry:3},{x:30,y:30}),false);
 assert.equal(g.requestAirdrop('blue',base.id,{infantry:2},{x:30,y:30}),true,'48 + 2 = 50 cabe');
 assert.equal(g.armySize('blue'),UNIT_CAP,'passageiros contam, o avião não');
 const plane=g.airdropPlane('blue');plane.airdrop.phase='parked';plane.airportId=base.id;
 assert.equal(g.canBoardPurchase('blue',base.id,'infantry'),false,'no limite não embarca mais ninguém');
 const solo=field('rts',false),sb=solo.add('blue','airportDirt',20,20);fill(solo,'blue',UNIT_CAP+5);solo.add('blue','recon',30,30);solo.updateVision();
 assert.equal(solo.requestAirdrop('blue',sb.id,{infantry:2},{x:30,y:30}),true,'solo sem limite');
});
test('multiplayer RTS refaz a visão a 10 Hz e mantém a visibilidade',()=>{
 const run=multiplayer=>{
  const g=field('rts',multiplayer);const kinds=['infantry','lightTank','tank','recon','antitank','engineer'];for(let i=0;i<60;i++)g.add('blue',kinds[i%kinds.length],5+i%30,40+Math.floor(i/30)*2);g.add('blue','reconDrone',20,50);g.updateVision();
  for(const u of g.units.filter(u=>u.owner==='blue'&&u.type!=='reconDrone'&&u.type!=='commander'))g.order(u,'move',{x:u.x,y:20},true);
  let calls=0;const original=g.updateVision;g.updateVision=function(){calls++;return original.call(this);};
  for(let i=0;i<60;i++)g.update(STEP);return calls;
 };
 const online=run(true),solo=run(false);
 assert.ok(online<=60/3+2,'multiplayer: '+online+' passadas em 60 ticks');assert.ok(solo>=online*2,'solo segue refazendo a cada passo: '+solo+' contra '+online);
 const g=field('rts',true),scout=g.add('blue','infantry',30,40),foe=g.add('red','infantry',40,40);scout.cooldown=foe.cooldown=1e6;g.updateVision();
 assert.equal(g.isVisible('blue',foe),false);g.order(scout,'move',{x:36,y:40},true);
 let ticks=0;while(!g.isVisible('blue',foe)&&ticks++<400)g.update(STEP);
 assert.ok(g.isVisible('blue',foe),'o inimigo aparece quando a tropa chega perto');
});
test('o estado enviado leva só as 16 próximas casas da rota e o destino',async()=>{
 const g=field();const u=g.add('blue','infantry',5,60);u.path=Array.from({length:40},(_,i)=>({x:6+i,y:60}));const short=g.add('blue','infantry',5,62);short.path=[{x:6,y:62},{x:7,y:62}];
 const service=createMultiplayerServer({autoTick:false}),room={game:g,paused:false,terrainRevision:0,players:[{side:'blue',eventCursor:0,terrainRevision:-1},{side:'red',eventCursor:0,terrainRevision:-1}]};
 try{
  const units=service.viewState(room,'blue').units,sent=units.find(v=>v.id===u.id);
  assert.equal(sent.path.length,17);assert.deepEqual(sent.path[0],{x:6,y:60});assert.deepEqual(sent.path[15],{x:21,y:60});assert.deepEqual(sent.path[16],{x:45,y:60});
  assert.equal(units.find(v=>v.id===short.id).path.length,2,'rota curta segue inteira');assert.equal(u.path.length,40,'o motor mantém a rota inteira');
 }finally{await service.close();}
});
(async()=>{let n=0;for(const [name,fn] of cases){await fn();n++;console.log('OK '+name);}console.log(n+' verificações de limite e carga do multiplayer passaram.');})().catch(e=>{console.error(e);process.exitCode=1;});
