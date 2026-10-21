'use strict';
// Fichas por time (verde = 'blue', vermelho = 'red', azul = França) conforme a planilha.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const names='Game,TYPES,FR_TYPES,RED_TYPES,SPEC,UT,FRANCE,PLANE_MODELS'.split(',');
const E=new Function(fs.readFileSync(path.join(__dirname,'..','public','js','engine.js'),'utf8')+'\nreturn {'+names.join(',')+'};')();
const {Game,SPEC,UT,FRANCE,PLANE_MODELS}=E;
const cases=[],test=(name,fn)=>cases.push([name,fn]);
function field(factions){
 const g=new Game('river','normal',123,'rts',{posts:2},{},{},null,factions);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.actions=[];g.animation=null;g.projectiles=[];g.memory.blue.clear();g.memory.red.clear();g.intel.clear();g.aiEnabled=false;
 g.add('blue','hq',1,90);g.add('red','hq',120,2);g.rng=()=>.5;g.updateVision();return g;
}

test('ficha verde, vermelha e azul seguem a planilha',()=>{
 const v=t=>SPEC(t,'blue'),r=t=>SPEC(t,'red'),a=t=>SPEC(t,FRANCE);
 assert.deepEqual([v('lightTank').speed,v('lightTank').vision,r('lightTank').speed,r('lightTank').vision,a('lightTank').speed],[2.2,6,1.9,5,2.5]);
 assert.deepEqual([v('tank').speed,v('tank').vision,r('tank').speed,r('tank').falloff,a('tank').speed,a('tank').vision],[2,6,1.8,4,2,5]);
 assert.deepEqual([v('heavyTank').speed,v('heavyTank').vision,r('heavyTank').speed,r('heavyTank').vision,a('heavyTank').speed,a('heavyTank').vision],[1.7,6,1.5,5,1.7,5]);
 assert.equal(r('recon').speed,2.5);assert.equal(a('recon').speed,3);
 assert.deepEqual([a('infantry').damage,a('engineer').cost,a('machinegun').cost,a('machinegun').damage,a('antitank').cost,a('missileInfantry').cost],[55,50,60,20,60,55]);
 assert.deepEqual([v('missileInfantry').damage,r('missileInfantry').damage,r('missileInfantry').range,a('missileInfantry').damage,a('missileInfantry').range],[55,45,15,40,12]);
 assert.deepEqual([a('artillery').speed,a('artillery').cooldown,a('rocketArtillery').speed,a('rocketArtillery').damage,a('rocketArtillery').range],[1.8,4,1,20,25]);
 assert.deepEqual([a('antiAirVehicle').damage,a('antiAirVehicle').range,a('helicopterGround').speed,a('helicopterAir').speed,a('reconDrone').vision,a('transportPlane').speed],[90,25,3.5,3.8,15,5]);
 assert.deepEqual([SPEC('bomberRed','red').speed,SPEC('fighterFr',FRANCE).speed,SPEC('multiroleFr',FRANCE).speed,SPEC('stealthFighterFr',FRANCE).speed],[3,6.5,6,5.7]);
 assert.deepEqual([PLANE_MODELS.fighterBlue.ammo.antiRadiation,PLANE_MODELS.multiroleBlue.ammo.jetAgm,PLANE_MODELS.multiroleBlue.ammo.antiRadiation,PLANE_MODELS.multiroleRed.ammo.jetAgm,PLANE_MODELS.fighterFr.ammo.antiRadiation,PLANE_MODELS.multiroleFr.ammo.antiRadiation,PLANE_MODELS.bomberFr.ammo.cruiseMissile],[4,6,4,4,2,2,4]);
});
test('a ficha vem do kit, não do dono',()=>{
 const g=field({blue:'red',red:'blue'});const mine=g.add('blue','lightTank',10,80),theirs=g.add('red','lightTank',100,10);
 assert.equal(UT(mine).speed,1.9);assert.equal(UT(theirs).speed,2.2);
});
for(const [name,fn] of cases){fn();console.log('OK '+name);}
console.log(cases.length+' verificações de ficha por time passaram.');
