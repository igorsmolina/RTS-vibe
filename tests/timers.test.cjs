'use strict';
// timerFor/serviceEta: tempo restante dos processos com duração (RTS) e segurança com campos ausentes (multiplayer).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/js/engine.js'),'utf8')+'\nObject.assign(this,{Game});',ctx);
const {Game}=ctx;
const tests=[],test=(name,fn)=>tests.push([name,fn]),DT=1/30;
function field(mode='rts'){const g=new Game('river','normal',123,mode,{posts:2});g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.projectiles=[];g.actions=[];g.animation=null;g.aiEnabled=false;g.add('blue','hq',1,92);g.add('red','hq',126,1);g.updateVision();return g;}
const run=(g,s)=>{for(let i=0;i<Math.round(s*30);i++){g.update(DT);g.events=[];}};
const near=(a,b,e=.05)=>assert.ok(Math.abs(a-b)<=e,a+' != '+b);

test('captura mostra 2 s',()=>{const g=field(),post=g.add('neutral','post',30,30),u=g.add('blue','infantry',29,30);g.updateVision();assert.ok(g.order(u,'capture',{targetId:post.id,position:post}));run(g,.5);const t=g.timerFor(u);assert.equal(t.label,'Capturando');near(t.progress,.25,.06);near(t.left,1.5,.06);});
test('manutenção do antitanque conta até zerar',()=>{const g=field(),hq=g.structures.find(s=>s.type==='hq'&&s.owner==='blue'),u=g.add('blue','antitank',4,93);u.atMissiles=1;assert.ok(g.order(u,'service',{targetId:hq.id}));run(g,.1);const a=g.timerFor(u);assert.equal(a.label,'Manutenção');near(a.left,9,.4);run(g,3);near(g.timerFor(u).left,6,.4);run(g,7);assert.equal(g.timerFor(u),null);assert.equal(u.atMissiles,4);});
test('helicóptero sem crédito não fica preso',()=>{const g=field(),hq=g.structures.find(s=>s.type==='hq'&&s.owner==='blue'),h=g.add('blue','helicopterGround',4,93);h.altitude='low';h.hp=10;g.credits.blue=0;assert.equal(g.serviceEta(h),0);});
test('antiaéreo: 20 s com 0 cargas',()=>{const g=field(),u=g.add('blue','antiAirVehicle',4,93);u.smokeCharges=0;u.serviceClock=0;assert.equal(g.serviceEta(u),20);});
test('avião em manutenção: 10 s no concreto, 20 s na terra',()=>{const g=field();for(const [type,s] of [['airportAsphalt',10],['airportDirt',20]]){const a=g.add('blue',type,20,20),p=g.add('blue','fighterBlue',21,21);p.airportId=a.id;p.flightState='service';p.serviceProgress=0;const t=g.timerFor(p);assert.equal(t.label,'Manutenção');near(t.left,s,1e-6);p.serviceProgress=s/2;near(g.timerFor(p).progress,.5,1e-6);}});
test('treino e obra de aeroporto',()=>{const g=field(),hq=g.structures.find(s=>s.type==='hq'&&s.owner==='blue');g.credits.blue=9999;assert.ok(g.enqueue('blue','tank',hq));run(g,1);const t=g.timerFor(hq);assert.equal(t.label,'Treinando');assert.ok(t.left>0&&t.left<g.trainDuration('tank'));const site=g.add('blue','airportSite',40,40);site.work=3;const o=g.timerFor(site);assert.equal(o.label,'Obra');assert.ok(o.progress>0&&o.progress<1);});
test('campos ausentes e modo por turnos devolvem null',()=>{const g=field();const stripped={id:99,type:'infantry',owner:'red',x:5,y:5,hp:100,maxHp:100};assert.equal(g.timerFor(stripped),null);assert.equal(g.timerFor({id:98,type:'fighterBlue',owner:'red',x:5,y:5,hp:100,maxHp:100,flightState:'service'}),null);assert.equal(g.timerFor({id:97,type:'hq',owner:'red',x:5,y:5,hp:100,maxHp:100}),null);const t=field('turns'),u=t.add('blue','infantry',29,30);assert.equal(t.timerFor(u),null);});
for(const [name,fn] of tests){fn();console.log('OK '+name);}
console.log(tests.length+' verificações de cronômetro passaram.');
