'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync('public/js/engine.js','utf8')+'\nthis.api={Game,TYPES,KEY,AIR};',ctx);
const {Game,TYPES,KEY,AIR}=ctx.api;
function field(mode='rts'){const g=new Game('river','normal',17,mode);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.aiEnabled=false;g.add('blue','hq',1,88);g.add('red','hq',120,1);g.credits.blue=5000;g.credits.red=5000;g.rng=()=>.5;g.canIdentify=()=>true;g.updateVision();return g;}
function advance(g,s){for(let t=0;t<s-1e-8;t+=1/30)g.update(Math.min(1/30,s-t));}
let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}

check('Alcances: infantaria 3, metralhador 3, antitanque 7 (míssil) / 3 (fuzil), lançador 10',()=>{
 const g=field(),inf=g.add('blue','infantry',20,20),mg=g.add('blue','machinegun',20,22),at=g.add('blue','antitank',20,24),sl=g.add('blue','missileInfantry',20,26);
 const foot=g.add('red','infantry',23,20),tank=g.add('red','lightTank',27,24),plane=g.add('red','helicopter',30,26);plane.altitude='high';g.updateVision();
 assert.equal(g.range(inf,foot),3);assert.equal(g.canFire(inf,foot),true);
 foot.x=24;assert.equal(g.canFire(inf,foot),false);foot.x=23;
 const foot2=g.add('red','infantry',23,22);g.updateVision();assert.equal(g.range(mg,foot2),3);assert.equal(g.canFire(mg,foot2),true);
 assert.equal(g.range(at,tank),7);assert.equal(g.canFire(at,tank),true);assert.equal(g.weapon(at,tank),'atMissile');
 assert.equal(g.weapon(at,foot2),'rifle');assert.equal(g.range(at,foot2),3);
 assert.equal(g.range(sl,plane),10);assert.equal(g.canFire(sl,plane),true);plane.x=31;assert.equal(g.canFire(sl,plane),false);
});

check('Metralhador é menos preciso que a infantaria; fuzil do antitanque iguala a infantaria',()=>{
 const g=field(),inf=g.add('blue','infantry',20,20),mg=g.add('blue','machinegun',20,22),at=g.add('blue','antitank',20,24),foe=g.add('red','infantry',22,21);g.updateVision();
 assert.ok(g.accuracy(mg,foe)<g.accuracy(inf,foe));assert.equal(g.accuracy(at,foe),g.accuracy(inf,foe));
 assert.equal(g.attackPower(at,'rifle'),g.attackPower(inf));
});

check('Míssil antitanque: dano maior contra veículo, 4 mísseis, depois só fuzil (não fere blindado)',()=>{
 const g=field(),at=g.add('blue','antitank',20,20),med=g.add('red','tank',26,20),light=g.add('red','lightTank',20,26);g.updateVision();
 assert.equal(at.atMissiles,4);assert.equal(g.weapon(at,med),'atMissile');
 const before=light.hp;g.shoot(at,light);advance(g,2);assert.equal(at.atMissiles,3);assert.ok(before-light.hp>=60,'dano antitanque ×2,25');
 at.atMissiles=0;assert.equal(g.weapon(at,med),null);assert.equal(g.canFire(at,med),false);assert.equal(g.weapon(at,light),'rifle');
 const h=field(),pre=h.add('blue','antitank',20,20),base=h.add('red','post',25,20);h.updateVision();assert.equal(h.weapon(pre,base),'atMissile');assert.equal(h.range(pre,base),7);
});

check('Manutenção repõe os mísseis do antitanque junto ao QG',()=>{
 const g=field(),hq=g.structures.find(s=>s.owner==='blue'),at=g.add('blue','antitank',hq.x+hq.width,hq.y);at.atMissiles=0;g.updateVision();
 assert.equal(g.canService(at,hq),true);assert.ok(g.order(at,'service',{targetId:hq.id}));advance(g,14);assert.equal(at.atMissiles,4);
 assert.equal(g.canService(at,hq),false);
});

check('Lançador só dispara contra aeronaves; míssil portátil é mais fácil de despistar',()=>{
 const g=field(),sl=g.add('blue','missileInfantry',20,20),foe=g.add('red','infantry',21,20),heli=g.add('red','helicopter',24,20),plane=g.add('red','fighterRed',26,20);
 heli.altitude='high';plane.flightState='patrol';g.updateVision();
 assert.equal(g.weapon(sl,foe),null);assert.equal(g.canFire(sl,foe),false);assert.equal(g.weapon(sl,heli),'missileInfantry');assert.equal(g.canFire(sl,heli),true);
 const base=g.accuracy(sl,heli);assert.ok(base<=.9);
 const aa=g.add('blue','antiAirVehicle',20,24);g.updateVision();
 let hits=0;g.rng=()=>.62;for(const u of [sl,aa]){g.shoot(u,plane);const p=g.projectiles.at(-1);if(p.hit)hits++;}
 assert.equal(hits,1,'antiaérea acerta onde o lançador falha com o mesmo sorteio');
});

check('Helicóptero vermelho: rajada 3×3 alcance 10 (baixo) / 30 (alto), 2 salvas, parado e com Manutenção',()=>{
 const g=field(),hq=g.structures.find(s=>s.owner==='red'),heli=g.add('red','transportHelicopter',60,60),foe=g.add('red','infantry',120,7);
 heli.altitude='low';assert.equal(heli.salvos,2);
 assert.equal(g.canBombard(heli,{x:70,y:60}),true);assert.equal(g.canBombard(heli,{x:71,y:60}),false);
 heli.altitude='high';assert.equal(g.canBombard(heli,{x:90,y:60}),true);assert.equal(g.canBombard(heli,{x:91,y:60}),false);
 const blue=g.add('blue','transportHelicopter',10,10);assert.equal(g.canBombard(blue,{x:12,y:10}),false);assert.equal(blue.salvos,undefined);
 const enemy=g.add('blue','infantry',70,60);g.updateVision();heli.altitude='low';
 assert.ok(g.order(heli,'bombard',{x:70,y:60}));assert.equal(g.order(heli,'move',{x:50,y:50}),false);
 advance(g,.6);assert.equal(heli.salvos,1);assert.equal(g.order(heli,'move',{x:50,y:50}),false);assert.equal(g.order(heli,'altitude',{altitude:'low'}),false);
 const x=heli.x,y=heli.y;advance(g,3);assert.equal(heli.x,x);assert.equal(heli.y,y);assert.ok(enemy.hp<enemy.maxHp);
 heli.cooldown=0;assert.ok(g.order(heli,'bombard',{x:70,y:60}));advance(g,3);assert.equal(heli.salvos,0);heli.cooldown=0;assert.equal(g.order(heli,'bombard',{x:70,y:60}),false);
 assert.ok(g.order(heli,'move',{x:50,y:50}));
});

check('Manutenção repõe as salvas do helicóptero vermelho',()=>{
 const g=field(),hq=g.structures.find(s=>s.owner==='red'),h=g.add('red','transportHelicopter',hq.x-1,hq.y);h.altitude='low';h.salvos=0;g.updateVision();
 assert.equal(g.canService(h,hq),true);assert.ok(g.order(h,'service',{targetId:hq.id}));advance(g,8);assert.equal(h.salvos,2);assert.equal(g.canService(h,hq),false);
});

console.log(checks+' verificações de rebalanceamento concluídas.');
