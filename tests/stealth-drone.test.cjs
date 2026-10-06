'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync('public/js/engine.js','utf8')+'\nthis.api={Game,TYPES,KEY,AIR,DIST};',ctx);const {Game,TYPES,KEY,DIST}=ctx.api;
function field(mode='turns'){const g=new Game('river','normal',17,mode);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.aiEnabled=false;g.add('blue','hq',0,13);g.add('red','hq',35,0);g.add('blue','infantry',0,12);g.add('red','infantry',35,1);g.rng=()=>.6;g.updateVision();return g;}
function advance(g,s){for(let t=0;t<s-1e-8;t+=1/30)g.update(Math.min(1/30,s-t));}
function settle(g){let n=0;while(g.busy&&n++<5000)g.update(1/30);assert.ok(n<5000);}
let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}

check('Atributos: sempre alto, sem flares, altitude ou manutenção; 2 mísseis de alcance 2',()=>{
 const t=TYPES.stealthDrone;assert.deepEqual([t.hp,t.move,t.speed,t.vision,t.cost,t.train,t.reward,t.missiles],[50,6,2.2,TYPES.reconDrone.vision,160,3,45,2]);
 for(const mode of ['turns','rts']){const g=field(mode),d=g.add('blue','stealthDrone',10,10),post=g.add('blue','post',10,11),near=g.add('red','infantry',12,10),far=g.add('red','infantry',13,10);g.updateVision();
  assert.equal(d.altitude,'high');assert.equal(d.flares,0);assert.equal(d.missiles,2);assert.equal(g.flareReady(d),false);
  assert.equal(g.order(d,'altitude',{altitude:'low'}),false);assert.equal(g.canService(d,post),false);assert.equal(g.sight(d),12,'Visão do drone de reconhecimento, não a 15 dos helicópteros altos');
  assert.equal(g.range(d,near),2,'Sem o +5 dos mísseis em altitude alta');assert.ok(g.canFire(d,near));assert.equal(g.canFire(d,far),false);}
});
check('Radar não detecta; visão de qualquer tropa inimiga descobre, inclusive a antiaérea',()=>{
 const g=field(),d=g.add('blue','stealthDrone',5,25),scout=g.add('blue','reconDrone',6,25),aa=g.add('red','antiAirVehicle',33,2);g.updateVision();
 assert.equal(g.radarContact('red',scout),true,'Drone comum aparece no radar');assert.equal(g.radarContact('red',d),false);assert.equal(g.isVisible('red',d),false);
 aa.x=11;aa.y=25;g.updateVision();assert.equal(d.spotted.red,true,'Antiaérea a 6 casas vê o drone');assert.equal(g.isVisible('red',d),true);assert.equal(g.radarContact('red',d),false,'Descoberto, mas não vira contato de radar');
 const h=field(),e=h.add('red','stealthDrone',20,10),heli=h.add('blue','helicopter',24,14);h.updateVision();assert.equal(h.isVisible('blue',e),false,'Fora da visão (8 casas)');heli.x=23;heli.y=12;h.updateVision();assert.equal(h.isVisible('blue',e),true,'Aeronave inimiga também descobre');assert.ok(h.logs.some(l=>/descoberto/.test(l.text)));
});
check('Revelação permanente: posição atual visível para toda a equipe até ser destruído',()=>{
 const g=field(),d=g.add('blue','stealthDrone',10,10),seer=g.add('red','infantry',13,10);g.updateVision();assert.equal(d.spotted.red,true);
 g.hurt(seer,999,null);d.x=25;d.y=20;g.updateVision();assert.equal(g.isVisible('red',d),true,'Continua visível longe de qualquer tropa vermelha');
 const foe=g.add('red','helicopterAir',27,20);g.updateVision();assert.equal(g.weapon(foe,d),'aam');assert.ok(g.canFire(foe,d),'A revelação permite atacar respeitando alcance e arma');
 const intel=[...g.intel.values()].find(e=>e.id===d.id);assert.equal(intel.x+','+intel.y,'25,20','A IA acompanha a posição atual');
 g.hurt(d,999,null);assert.equal(g.isVisible('red',d),false);
});
check('Dois mísseis sem reposição, um por ação; depois só reconhecimento',()=>{
 const g=field(),d=g.add('blue','stealthDrone',10,10),foe=g.add('red','infantry',12,10);g.updateVision();
 assert.ok(g.order(d,'attack',{targetId:foe.id}));settle(g);assert.equal(d.missiles,1);assert.equal(foe.hp,80,'Dano 20');assert.equal(g.order(d,'attack',{targetId:foe.id}),false,'Uma ação por turno');
 g.endTurn();for(let n=0;g.turn==='red'&&n<20000;n++)g.update(1/30);assert.ok(g.order(d,'attack',{targetId:foe.id}));settle(g);assert.equal(d.missiles,0);
 g.endTurn();for(let n=0;g.turn==='red'&&n<20000;n++)g.update(1/30);assert.equal(g.weapon(d,foe),null);assert.equal(g.canFire(d,foe),false);assert.equal(g.acquire(d),undefined);assert.equal(g.order(d,'attack',{targetId:foe.id}),false);
 assert.ok(g.order(d,'move',{x:14,y:14}),'Continua voando como olheiro');
 const r=field('rts'),e=r.add('blue','stealthDrone',10,10),t=r.add('red','infantry',12,10);t.hp=t.maxHp=1000;r.updateVision();
 advance(r,5);assert.equal(r.shotsFired,0,'Parado, não dispara sozinho');assert.ok(r.order(e,'attack',{targetId:t.id}));
 advance(r,.1);assert.equal(r.shotsFired,1);advance(r,2.8);assert.equal(r.shotsFired,1,'Intervalo de 3 s');advance(r,.3);assert.equal(r.shotsFired,2,'A ordem do jogador continua até acabar o estoque');advance(r,10);assert.equal(r.shotsFired,2);assert.equal(e.missiles,0);assert.equal(e.order.type,'stop','Sem mísseis, a ordem termina');assert.equal(e.x+','+e.y,'10,10','Não persegue o alvo');
});
check('Blindagem: não fere tanque médio e pesado; atinge alvos leves, estruturas e aeronaves',()=>{
 const g=field(),d=g.add('blue','stealthDrone',10,10);
 for(const type of ['tank','heavyTank'])assert.equal(g.weapon(d,g.add('red',type,11,10+(type==='tank'?1:-1))),null,type);
 for(const [type,x,y]of [['lightTank',12,10],['infantry',9,10],['post',10,12],['helicopter',10,8]])assert.equal(g.weapon(d,g.add('red',type,x,y)),'stealthMissile',type);
});
check('IA: caça antiaérea ao alcance, persegue lançadores vistos e, sem mísseis, patrulha',()=>{
 const g=field(),d=g.add('red','stealthDrone',20,10),inf=g.add('blue','infantry',21,10),aa=g.add('blue','antiAirVehicle',20,12);g.turn='red';g.updateVision();
 g.aiAct(d);assert.equal(d.order.type,'attack');assert.equal(d.order.targetId,aa.id,'Prefere a antiaérea');
 const h=field(),e=h.add('red','stealthDrone',20,10),launcher=h.add('blue','missileInfantry',20,15);h.turn='red';h.updateVision();h.aiAct(e);assert.equal(e.order.type,'move');assert.ok(DIST(e.order.goal,launcher)<=2);
 const k=field(),f=k.add('red','stealthDrone',30,4);f.missiles=0;k.turn='red';k.aiEnabled=true;k.updateVision();k.aiAct(f);assert.equal(f.order.type,'move','Patrulha');
 for(const mode of ['turns','rts']){const m=new Game('river','normal',23,mode);m.add('red','stealthDrone',31,4);m.add('blue','stealthDrone',4,23);m.updateVision();
  if(mode==='turns')for(let i=0;i<8&&!m.winner;i++){m.endTurn();for(let n=0;m.turn==='red'&&!m.winner&&n<20000;n++)m.update(1/30);settle(m);}else advance(m,60);
  for(const u of m.units)if(u.type==='stealthDrone'){assert.equal(u.altitude,'high');assert.ok(u.missiles>=0&&u.missiles<=2);}assert.ok(m.aiDecisions>0);}
});
console.log(checks+' verificações do drone furtivo concluídas.');
