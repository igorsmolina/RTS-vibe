'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync('public/js/engine.js','utf8')+'\nthis.api={Game,TYPES,KEY};',ctx);const {Game,TYPES,KEY}=ctx.api;
function field(mode='turns'){const g=new Game('river','normal',71,mode,{posts:2},{});g.units=[];g.structures=[];g.projectiles=[];g.mines=[];g.terrain.fill('plain');g.aiEnabled=false;g.actions=[];g.animation=null;g.add('blue','hq',1,94);g.add('red','hq',126,1);g.rng=()=>.49;return g;}
function advance(g,s){for(let t=0;t<s-1e-8;t+=1/30)g.update(Math.min(1/30,s-t));}
const tests=[],test=(n,f)=>tests.push([n,f]),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,a+' != '+b);
const line=(from,to)=>{const out=[];for(let x=from;x<=to;x++)out.push({x,y:40});return out;};

test('transport helicopter base stats: low-altitude speed and move raised',()=>{assert.equal(TYPES.transportHelicopter.move,10);near(TYPES.transportHelicopter.speed,3.4);});

test('turn step cost: allied transport helicopter at high altitude moves 1.5x per cell; other cases unchanged',()=>{
  const g=field('turns'),blue=g.add('blue','transportHelicopter',20,40),red=g.add('red','transportHelicopter',20,40);
  const from={x:20,y:40},to={x:21,y:40};
  blue.altitude='low';near(g.stepCost(blue,from,to),1);
  blue.altitude='high';near(g.stepCost(blue,from,to),1/1.5);
  near(g.stepCost(blue,from,{x:21,y:41}),Math.SQRT2/1.5);
  red.altitude='high';near(g.stepCost(red,from,to),1);
});

test('turn budget: allied helicopter at high altitude covers 15 cells on move 10, low altitude only 10',()=>{
  const g=field('turns'),u=g.add('blue','transportHelicopter',20,40),path=line(21,35);
  u.moveLeft=10;u.altitude='low';assert.equal(g.trimPath(u,path).length,10);
  u.moveLeft=10;u.altitude='high';assert.equal(g.trimPath(u,path).length,15);
  const red=g.add('red','transportHelicopter',20,40);red.altitude='high';red.moveLeft=10;assert.equal(g.trimPath(red,line(21,35)).length,10);
});

test('RTS speed: allied helicopter at high altitude flies 1.5x faster than at low altitude',()=>{
  const dist=altitude=>{const g=field('rts'),u=g.add('blue','transportHelicopter',20,40);u.altitude=altitude;assert.ok(g.order(u,'move',{x:50,y:40}));advance(g,1);return u.x-20;};
  const low=dist('low'),high=dist('high');
  assert.ok(low>0);
  assert.ok(Math.abs(high/low-1.5)<0.05,high+' / '+low);
});

test('vision: allied helicopter at high altitude sees through forest, low altitude does not',()=>{
  const g=field('turns'),u=g.add('blue','transportHelicopter',20,40);g.terrain[KEY(24,40)]='forest';
  u.altitude='low';g.updateVision();assert.ok(!g.visible.blue[KEY(24,40)]);
  u.altitude='high';g.updateVision();assert.ok(g.visible.blue[KEY(24,40)]);
});

test('flares: allied helicopter at high altitude halves missile accuracy less and recharges in 4s; low keeps 0.5 and 8s',()=>{
  const shot=altitude=>{const g=field('turns'),target=g.add('blue','transportHelicopter',20,40),attacker=g.add('red','fighterRed',23,40);g.turn='red';attacker.flightState='approach';target.altitude=altitude;g.shoot(attacker,target,'jetAam');assert.equal(g.projectiles.length,1);const p=g.projectiles.at(-1);assert.ok(p.flareProtected);return {ratio:p.accuracy/p.accuracyBase,cooldown:target.flareCooldown};};
  const low=shot('low'),high=shot('high');
  near(low.ratio,.5);near(low.cooldown,8);
  near(high.ratio,.35);near(high.cooldown,4);
});

let fails=0;for(const [n,f]of tests)try{f();console.log('OK '+n);}catch(e){fails++;console.error('FAIL '+n+'\n'+e.stack);}if(fails)process.exitCode=1;
