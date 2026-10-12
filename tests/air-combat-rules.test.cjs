'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});
vm.runInContext(fs.readFileSync('public/js/engine.js','utf8')+'\nthis.api={Game,TYPES,WEAPONS};',ctx);
const {Game,TYPES,WEAPONS}=ctx.api;
function field(mode){const g=new Game('river','normal',17,mode,{posts:2});g.terrain.fill('plain');g.units=[];g.structures=[];g.projectiles=[];g.aiEnabled=false;g.rng=()=>.5;return g;}
const cases=[];const test=(name,fn)=>cases.push([name,fn]);
test('helicopter guns cannot damage planes; AAM can intercept bombers',()=>{
 for(const mode of ['turns','rts'])for(const type of ['helicopter','helicopterGround','helicopterAir'])for(const plane of Object.keys(TYPES).filter(t=>TYPES[t].plane)){
  const g=field(mode),h=g.add('blue',type,20,20),p=g.add('red',plane,22,20);g.updateVision();
  const expected=type==='helicopterAir'?'aam':null;
  assert.equal(g.weapon(h,p),expected,type+' vs '+plane);
  h.weaponMode='gun';assert.equal(g.weapon(h,p),null);assert.equal(g.shoot(h,p,'gun'),false);
  g.impact({type,weapon:'gun',targetId:p.id,attackerId:h.id,owner:'blue',power:100,hit:true,tx:p.x,ty:p.y});assert.equal(p.hp,p.maxHp);
  if(!expected){assert.equal(g.shoot(h,p,'aam'),false);g.impact({type,weapon:'aam',targetId:p.id,owner:'blue',power:100,hit:true,tx:p.x,ty:p.y});assert.equal(p.hp,p.maxHp);}
 }
});
test('helicopter missiles fly slower and grant extra plane evasion',()=>{
 const g=field('rts'),h=g.add('blue','helicopterAir',20,20),p=g.add('red','fighterRed',24,20);p.flares=0;g.shoot(h,p,'aam');const shot=g.projectiles.at(-1);
 assert.equal(shot.duration,1);assert.equal(shot.accuracy,shot.accuracyBase*.5);assert.ok(WEAPONS.aam.speed<WEAPONS.jetAam.speed);
 shot.hit=true;g.impact(shot);assert.ok(p.hp<p.maxHp);
});
test('stealth detection expires outside recognition, including stale saved flags',()=>{
 for(const mode of ['turns','rts']){const g=field(mode),d=g.add('red','stealthDrone',20,20),seer=g.add('blue','infantry',22,20);g.updateVision();assert.ok(g.isVisible('blue',d));seer.x=60;g.updateVision();assert.equal(d.spotted.blue,false);assert.equal(g.isVisible('blue',d),false);d.spotted.blue=true;assert.equal(g.isVisible('blue',d),false);seer.x=22;g.updateVision();assert.ok(g.isVisible('blue',d));}
});
test('bombs increase damage against every ground troop class',()=>{
 for(const [weapon,old]of [['bombCommon',80],['bombFragment',45],['bombIncendiary',20]])for(const type of Object.keys(TYPES).filter(t=>!TYPES[t].air&&!TYPES[t].structure)){
  const g=field('rts'),b=g.add('blue','bomberBlue',19,20),t=g.add('red',type,20,20);t.hp=t.maxHp=10000;
  g.bombImpact({weapon,attackerId:b.id,owner:'blue',tx:20,ty:20,hit:true,power:g.attackPower(b,weapon)});
  const previous=Math.round(old*(weapon==='bombFragment'?(TYPES[type].vehicle?.25:1.5):1));assert.ok(10000-t.hp>previous,weapon+' vs '+type);
 }
});
test('anti-radiation interception succeeds less often than before',()=>{
 const g=field('rts'),a=g.add('red','antiAirVehicle',22,20);g.projectiles.push({weapon:'antiRadiation',owner:'blue',x:20,y:20,targetId:a.id,duration:1,elapsed:0});g.rng=()=>.2;g.defendAir();assert.equal(g.projectiles.at(-1).interceptSuccess,false);
});
let failed=0;for(const [name,fn]of cases)try{fn();console.log('OK '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}if(failed)process.exitCode=1;
