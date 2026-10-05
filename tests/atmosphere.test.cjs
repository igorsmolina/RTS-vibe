'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync('public/js/engine.js','utf8')+'\nthis.api={Game,ALTITUDE_TIME,flightLevel};',ctx);
const {Game,ALTITUDE_TIME,flightLevel}=ctx.api;
function field(mode){const g=new Game('river','normal',91,mode);g.aiEnabled=false;g.terrain.fill('plain');g.units=[];g.structures=[];g.add('blue','hq',0,27);g.add('red','hq',35,0);g.add('red','infantry',34,1);return g;}
function advance(g,s){for(let t=0;t<s-1e-8;t+=1/30)g.update(Math.min(1/30,s-t));}
assert.equal(ALTITUDE_TIME,1);
for(const mode of ['turns','rts'])for(const type of ['helicopter','helicopterGround','helicopterAir']){
 const g=field(mode),h=g.add('blue',type,5,5),enemy=g.add('red','helicopter',6,5);enemy.cooldown=100;h.cooldown=100;
 for(const altitude of ['high','low']){
  h.actionLeft=true;const previous=h.altitude,base=g.accuracy(h,enemy,'aam');assert.ok(g.order(h,'altitude',{altitude}));advance(g,.5);
  assert.equal(h.altitude,previous);assert.ok(Math.abs(flightLevel(h)-.5)<1e-7);assert.equal(g.accuracy(h,enemy,'aam'),base);
  const state=JSON.stringify(h);g.update(0);assert.equal(JSON.stringify(h),state);g.hurt(h,1,null);advance(g,.4);assert.equal(h.altitude,previous);assert.equal(g.shotsFired,0);
  advance(g,.1);assert.equal(h.altitude,altitude);assert.equal(h.pending,false);assert.equal(flightLevel(h),altitude==='high'?1:0);if(mode==='turns')assert.equal(h.actionLeft,false);
 }
}
for(const replacement of ['stop','move','attack']){
 const g=field('rts'),h=g.add('blue','helicopterAir',5,5),enemy=g.add('red','helicopter',6,5);h.cooldown=enemy.cooldown=100;g.updateVision();
 g.order(h,'altitude',{altitude:'high'});advance(g,.5);assert.ok(Math.abs(flightLevel(h)-.5)<1e-7);
 assert.ok(g.order(h,replacement,replacement==='move'?{x:8,y:5}:{targetId:enemy.id}));assert.equal(h.altitude,'low');assert.ok(Math.abs(flightLevel(h)-.5)<1e-7);
 advance(g,.1);assert.ok(flightLevel(h)>0&&flightLevel(h)<.5);advance(g,.2);assert.equal(flightLevel(h),0);advance(g,1);assert.equal(h.altitude,'low');
}
const g=field('rts'),h=g.add('blue','helicopter',5,5);g.order(h,'move',{x:8,y:5});advance(g,.1);const endpoint=h.segment.to.x;
g.order(h,'altitude',{altitude:'high'});assert.equal(flightLevel(h),0);while(h.segment)g.update(.01);assert.equal(h.x,endpoint);const elapsed=h.altitudeTransition.elapsed;
advance(g,1-elapsed-.01);assert.equal(h.altitude,'low');advance(g,.01);assert.equal(h.altitude,'high');
for(const mode of ['turns','rts']){const g=field(mode),units=['helicopter','helicopterGround','helicopterAir'].map((type,i)=>g.add('blue',type,5+i,5));assert.equal(g.command(units.map(u=>u.id),'altitude',{altitude:'high'}),3);advance(g,3.1);assert.ok(units.every(u=>u.altitude==='high'&&!u.pending));}
console.log('OK altitude 1 s, três classes e grupos nos dois modos; pausa, dano, bônus tardio, segmento e cancelamento suave.');
