'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});
vm.runInContext(fs.readFileSync('public/js/engine.js','utf8')+'\nthis.api={Game,TYPES,PLAN,STARTING_BUDGET,armyCost};',ctx);
const {Game,TYPES,PLAN,STARTING_BUDGET,armyCost}=ctx.api;
function field(mode){const g=new Game('river','normal',173,mode,{posts:2});g.aiEnabled=false;g.units=[];g.structures=[];g.mines=[];g.terrain.fill('plain');g.rng=()=>.5;g.add('blue','hq',1,80);g.add('red','hq',115,1);return g;}
const cases=[];const test=(name,fn)=>cases.push([name,fn]);
test('prices, recruitment and initial budget',()=>{
 assert.equal(TYPES.helicopter.cost,150);assert.equal(TYPES.fighterRed.cost,610);
 assert.ok(armyCost({fighterRed:1})>STARTING_BUDGET);
 for(const mode of ['rts','turns']){const g=field(mode);g.turn='red';g.credits.red=1000;const airport=g.add('red','airportAsphalt',95,70);assert.equal(g.recruitCost('fighterRed',airport),488);assert.ok(g.enqueue('red','fighterRed',airport));assert.equal(g.credits.red,512);g.production('red',g.trainDuration('fighterRed'));assert.ok(g.units.some(u=>u.type==='fighterRed'));}
});
test('air helicopter cannon changes only its vehicle damage',()=>{
 for(const mode of ['rts','turns'])for(const [type,damage]of [['helicopterAir',25],['helicopterGround',30]]){const g=field(mode),a=g.add('blue',type,30,40),b=g.add('red','tank',31,40);g.shoot(a,b,'gun');g.impact(g.projectiles.pop());assert.equal(b.hp,170-damage);assert.equal(g.weaponStats(a,'gun').infantryMultiplier,.6);assert.equal(g.weaponStats(a,'gun').cooldown,1);}
});
test('air helicopter can issue and resolve AAM attacks on either bomber',()=>{
 for(const mode of ['rts','turns'])for(const bomber of ['bomberBlue','bomberRed']){const g=field(mode),enemy=TYPES[bomber].team,owner=enemy==='blue'?'red':'blue';g.turn=owner;const a=g.add(owner,'helicopterAir',30,40),b=g.add(enemy,bomber,32,40);b.flares=0;b.cooldown=1000;g.updateVision();assert.equal(g.weapon(a,b),'aam');assert.ok(g.canFire(a,b));assert.ok(g.command([a.id],'attack',{targetId:b.id},owner));for(let i=0;i<60;i++)g.update(1/30);assert.ok(b.hp<b.maxHp);assert.equal(g.helicopterWeaponFits(a,'gun',b),false);}
});
test('post survives peripheral cruise and needs three central rockets',()=>{
 for(const mode of ['rts','turns']){const g=field(mode),a=g.add('blue','bomberBlue',30,40),p=g.add('red','post',40,40);assert.equal(p.hp,90);g.rocketImpact({weapon:'cruiseMissile',attackerId:a.id,owner:'blue',tx:39,ty:40,power:160,hit:true});assert.equal(p.hp,10);p.hp=90;for(const hp of [50,10,0]){g.rocketImpact({weapon:'rocket',attackerId:a.id,owner:'blue',tx:40,ty:40,power:20,hit:true});assert.equal(p.hp,hp);}}
});
test('post income applies in both modes and all doctrines',()=>{
 for(const mode of ['rts','turns']){const g=field(mode);g.add('blue','post',30,40);assert.equal(g.income('blue'),21);for(const [doctrine,income]of [['economic',24],['offensive',21],['defensive',19]]){g.doctrines={blue:doctrine,red:'balanced'};assert.equal(g.income('blue'),income);}g.doctrines={blue:'balanced',red:'balanced'};if(mode==='rts'){for(let i=0;i<300;i++)g.update(1/30);}else{g.round=2;g.beginTurn('blue');}assert.equal(g.credits.blue,171);}
});
test('normal AI recruits the fourth aircraft without raising other limits',()=>{
 assert.equal(PLAN.normal.planes,4);
 for(const mode of ['rts','turns']){const g=field(mode);g.aiEnabled=true;g.turn='red';g.credits.red=10000;const airport=g.add('red','airportAsphalt',95,70);for(const type of ['fighterRed','multiroleRed','stealthFighterRed','bomberRed']){g.aiBuy();assert.equal(airport.queue[0]?.type,type);g.production('red',g.trainDuration(type));}assert.equal(g.units.filter(u=>TYPES[u.type].plane).length,4);g.aiBuy();assert.ok(!airport.queue.some(q=>TYPES[q.type].plane));}
});
let failed=0;for(const [name,fn]of cases)try{fn();console.log('OK '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}if(failed)process.exitCode=1;
