'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync('public/js/engine.js','utf8')+'\nthis.api={Game,TYPES,KEY,AIR,DIST};',ctx);const {Game,TYPES,KEY,AIR,DIST}=ctx.api;
function field(mode='turns'){const g=new Game('river','normal',17,mode);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.aiEnabled=false;g.add('blue','hq',0,13);g.add('red','hq',35,0);g.add('blue','infantry',0,12);g.add('red','infantry',35,1);g.rng=()=>.6;g.updateVision();return g;}
function advance(g,s){for(let t=0;t<s-1e-8;t+=1/30)g.update(Math.min(1/30,s-t));}
function settle(g){let n=0;while(g.busy&&n++<5000)g.update(1/30);assert.ok(n<5000);}
let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}

check('Artilharia de mísseis: atributos, alcance 3–13 sem bônus de colina e sem tiro direto',()=>{
 const t=TYPES.rocketArtillery;assert.deepEqual([t.hp,t.move,t.speed,t.min,t.range,t.vision,t.cost,t.train,t.cooldown],[90,2,.85,3,13,3,240,4,10]);assert.equal(t.vehicle,true);
 const g=field(),u=g.add('blue','rocketArtillery',5,5),foe=g.add('red','infantry',6,5);g.updateVision();
 assert.equal(g.canBombard(u,{x:18,y:5}),true);assert.equal(g.canBombard(u,{x:19,y:5}),false);assert.equal(g.canBombard(u,{x:5,y:7}),false);assert.equal(g.canBombard(u,{x:5,y:8}),true);
 g.terrain[KEY(5,5)]='hill';assert.equal(g.range(u),13);assert.equal(g.canBombard(u,{x:19,y:5}),false);
 assert.equal(g.weapon(u,foe),null);assert.equal(g.canFire(u,foe),false);assert.equal(g.acquire(u),undefined);
});
check('Bombardeio sob a névoa: casa inexplorada, 4 mísseis, ação e movimento gastos, nada revelado',()=>{
 const g=field(),u=g.add('blue','rocketArtillery',2,20),hidden=g.add('red','infantry',14,20);g.updateVision();const cell=KEY(14,20);
 assert.equal(g.explored.blue[cell],false);assert.equal(g.isVisible('blue',hidden),false);
 assert.ok(g.order(u,'bombard',{x:14,y:20}));settle(g);
 assert.equal(g.shotsFired,4);assert.equal(u.actionLeft,false);assert.equal(u.moveLeft,0);assert.equal(hidden.hp,20,'4 × 20 na casa central');
 assert.equal(g.explored.blue[cell],false);assert.ok(!g.events.some(e=>e.visible&&DIST(e,{x:14,y:20})<=1.5),'Nenhum efeito visível na névoa');assert.ok(!g.logs.some(l=>/Infantaria/.test(l.text)));
 assert.equal(g.order(u,'bombard',{x:14,y:20}),false,'Uma salva por turno');
});
check('Dano: ×2 contra estruturas, metade nas vizinhas, fogo amigo, aeronaves ilesas, sem queda pela distância',()=>{
 for(const at of [{x:25,y:0},{x:32,y:0}]){
  const g=field(),u=g.add('blue','rocketArtillery',at.x,at.y),ally=g.add('blue','infantry',34,1),heli=g.add('red','helicopter',34,0),hq=g.hq('red'),foe=g.units.find(v=>v.owner==='red'&&v.type==='infantry');g.updateVision();
  assert.ok(g.order(u,'bombard',{x:35,y:0}));settle(g);
  assert.equal(hq.hp,300-160,'QG: 4 × 40');assert.equal(foe.hp,100-40,'Vizinha: 4 × 10');assert.equal(ally.hp,100-40,'Fogo amigo');assert.equal(heli.hp,120);
 }
 const g=field(),u=g.add('blue','rocketArtillery',25,0),hq=g.hq('red');g.rng=()=>.9;g.updateVision();g.order(u,'bombard',{x:35,y:0});settle(g);assert.equal(hq.hp,300,'Sem impacto efetivo, sem dano');
});
check('Por turnos: aproxima dentro do movimento; fora do alcance a ordem é recusada sem gastar ação',()=>{
 const g=field(),u=g.add('blue','rocketArtillery',2,20);g.updateVision();
 assert.equal(g.order(u,'bombard',{x:18,y:20}),false);assert.equal(u.actionLeft,true);
 assert.ok(g.order(u,'bombard',{x:17,y:20}));settle(g);assert.equal(u.x,4);assert.equal(g.shotsFired,4);
 const h=field(),r=h.add('blue','rocketArtillery',2,20),seen=h.add('red','infantry',5,20);h.updateVision();assert.ok(h.order(r,'attack',{targetId:seen.id}));assert.equal(r.order.type,'bombard');assert.deepEqual({...r.order.cell},{x:5,y:20});
});
check('RTS: preparo antes da salva, intervalo de 0,25 s, recarga de 10 s, pausa congela mísseis',()=>{
 const g=field('rts'),u=g.add('blue','rocketArtillery',2,20);g.updateVision();assert.ok(g.order(u,'bombard',{x:14,y:20}));
 advance(g,.4);assert.equal(g.shotsFired,1);advance(g,.25);assert.equal(g.shotsFired,2);advance(g,.5);assert.equal(g.shotsFired,4);assert.equal(u.x,2);assert.equal(u.order.type,'stop');
 const p=g.projectiles[0],elapsed=p.elapsed;g.update(0);assert.equal(p.elapsed,elapsed);
 assert.ok(g.order(u,'bombard',{x:14,y:20}));advance(g,8.5);assert.equal(g.shotsFired,4,'Aguarda a recarga');advance(g,1.9);assert.ok(g.shotsFired>4);
 const m=field('rts'),r=m.add('blue','rocketArtillery',2,20);m.updateVision();m.order(r,'bombard',{x:14,y:20});advance(m,.65);m.order(r,'stop');advance(m,1);assert.equal(m.shotsFired,2,'Nova ordem interrompe a salva');
});
check('Lançadores: subida, pausa, dano, salva e recolhimento nas duas equipes e modos',()=>{
 for(const mode of ['turns','rts'])for(const owner of ['blue','red']){
  const g=field(mode),u=g.add(owner,'rocketArtillery',2,20);g.turn=owner;g.updateVision();let rolls=0;g.rng=()=>{rolls++;return .6;};
  assert.ok(g.order(u,'bombard',{x:14,y:20}));advance(g,.2);assert.equal(g.shotsFired,0,'Não dispara antes de elevar');assert.ok(u.launcherLevel>0&&u.launcherLevel<1);
  const level=u.launcherLevel,time=g.time;g.update(0);assert.equal(u.launcherLevel,level);assert.equal(g.time,time);g.hurt(u,1,null);assert.equal(u.launcherLevel,level,'Dano não reinicia a animação');
  advance(g,.25);assert.equal(g.shotsFired,1);assert.equal(u.launcherLevel,1);advance(g,.8);assert.equal(g.shotsFired,4);advance(g,.4);assert.equal(u.launcherLevel,0);assert.equal(u.pending,false);assert.equal(rolls,4,'Animação não consome RNG');
 }
});
check('RTS: cancelar o preparo ou mover durante recolhimento não dispara nem anda com lançadores elevados',()=>{
 const g=field('rts'),u=g.add('blue','rocketArtillery',2,20);g.updateVision();g.order(u,'bombard',{x:14,y:20});advance(g,.2);assert.ok(g.order(u,'move',{x:4,y:20}));
 advance(g,.1);assert.equal(u.x,2);assert.ok(u.launcherLevel>0);advance(g,.5);assert.equal(u.launcherLevel,0);assert.ok(u.x>2);assert.equal(g.shotsFired,0);
 const h=field('rts'),v=h.add('blue','rocketArtillery',2,20);h.updateVision();h.order(v,'bombard',{x:14,y:20});advance(h,.2);h.order(v,'stop');advance(h,.4);assert.equal(v.launcherLevel,0);assert.equal(h.shotsFired,0);assert.equal(v.pending,false);
});
check('Drone: nasce alto, sem armas, flares, altitude, manutenção, captura ou construção',()=>{
 const t=TYPES.reconDrone;assert.deepEqual([t.hp,t.move,t.speed,t.vision,t.cost,t.train],[60,7,2.4,12,90,2]);
 for(const mode of ['turns','rts']){const g=field(mode),d=g.add('blue','reconDrone',5,5),post=g.add('blue','post',5,6),foe=g.add('red','infantry',6,5);g.updateVision();
  assert.equal(d.altitude,'high');assert.equal(d.flares,0);assert.equal(d.weaponMode,undefined);assert.equal(g.flareReady(d),false);
  assert.equal(g.weapon(d,foe),null);assert.equal(g.range(d),0);assert.equal(g.acquire(d),undefined);assert.equal(g.order(d,'attack',{targetId:foe.id}),false);
  assert.equal(g.order(d,'altitude',{altitude:'low'}),false);assert.equal(g.setWeapon(d,'auto'),false);assert.equal(g.canService(d,post),false);assert.equal(g.canBuild(d),false);
  assert.ok(g.order(d,'move',{x:12,y:5}));if(mode==='turns'){settle(g);assert.equal(d.x,12);}else{advance(g,.5);assert.ok(Math.abs(d.x-6.2)<1e-6);}}
});
check('Drone: visão 12 com ocultação da floresta, sem revelar minas',()=>{
 const g=field(),d=g.add('blue','reconDrone',10,10);g.mines.push({x:12,y:10,known:{blue:false,red:false}});g.terrain[KEY(10,15)]='forest';g.terrain[KEY(10,12)]='forest';g.updateVision();
 assert.equal(g.visible.blue[KEY(22,10)],true);assert.equal(g.visible.blue[KEY(23,10)],false);assert.equal(g.visible.blue[KEY(10,15)],false);assert.equal(g.visible.blue[KEY(10,12)],true);assert.equal(g.mines[0].known.blue,false);
});
check('Drone: radar inimigo detecta globalmente; antiaérea 99% e lançador 95%, sem flares',()=>{
 const g=field(),d=g.add('blue','reconDrone',3,25),aa=g.add('red','antiAirVehicle',33,2),s=g.add('red','missileInfantry',4,25),heli=g.add('blue','helicopter',4,24);heli.altitude='high';g.updateVision();
 assert.equal(g.radarContact('red',d),true);assert.equal(g.isVisible('red',d),true);assert.ok(g.canFire(aa,d));
 assert.equal(g.accuracy(aa,d),.99);assert.equal(Math.round(g.accuracy(s,d)*100),95);assert.equal(Math.round(g.accuracy(aa,heli)*100),90,'Helicóptero alto continua 90%');
 g.setRadar(aa,false);assert.equal(g.radarContact('red',d),false);
});
check('IA: bombardeia só posições vistas ou lembradas e evita área com tropa própria',()=>{
 const g=field(),r=g.add('red','rocketArtillery',30,5),hidden=g.add('blue','infantry',22,5);g.turn='red';g.updateVision();
 assert.equal(g.isVisible('red',hidden),false);assert.equal(g.bombardTargets(r).length,0,'Tropa oculta não é consultada');
 g.intel.set(hidden.id,{id:hidden.id,type:'infantry',x:21,y:5,hp:100,maxHp:100});
 assert.equal(g.bombardTargets(r).map(c=>c.x+','+c.y).join(),'21,5','Última posição vista, não a atual');
 g.memory.red.set(KEY(0,13),{id:g.hq('blue').id,x:0,y:13,type:'hq',owner:'blue'});assert.equal(g.bombardTargets(r)[0].x,0,'Estrutura lembrada vale mais');
 g.add('red','infantry',22,6);assert.ok(!g.bombardTargets(r).some(c=>c.x===21&&c.y===5),'Área com aliado é descartada');
 g.aiAct(r);assert.equal(r.order.type,'move','Sem alvo ao alcance, só se aproxima');
 const k=field(),q=k.add('red','rocketArtillery',30,5);k.turn='red';k.intel.set(999,{id:999,type:'tank',x:20,y:8,hp:170,maxHp:170});k.aiAct(q);assert.equal(q.order.type,'bombard');assert.equal(q.order.cell.x+','+q.order.cell.y,'20,8');
});
check('IA: drone acompanha a artilharia de mísseis; sem ela, patrulha; partidas completas sem travar',()=>{
 const g=field(),d=g.add('red','reconDrone',30,4);g.turn='red';g.aiEnabled=true;g.updateVision();g.aiAct(d);assert.equal(d.order.type,'move');
 const h=field(),e=h.add('red','reconDrone',30,4),r=h.add('red','rocketArtillery',33,3);h.turn='red';h.aiEnabled=true;h.updateVision();h.aiAct(e);assert.equal(e.order.type,'move');assert.ok(DIST(e.order.goal,r)<=10);
 for(const mode of ['turns','rts']){const m=new Game('river','normal',23,mode);m.credits.red=5000;for(const [type,x,y]of [['rocketArtillery',30,3],['reconDrone',31,4]])m.add('red',type,x,y);m.updateVision();
  if(mode==='turns')for(let i=0;i<8&&!m.winner;i++){m.endTurn();for(let n=0;m.turn==='red'&&!m.winner&&n<20000;n++)m.update(1/30);settle(m);}else advance(m,60);
  for(const u of m.units){assert.ok(u.hp>0&&u.hp<=u.maxHp);if(u.type==='reconDrone')assert.equal(u.altitude,'high');}assert.ok(m.aiDecisions>0);}
});
console.log(checks+' verificações das novas tropas concluídas.');
