'use strict';
// Exército (facção) separado do lado: quem escolhe as unidades vermelhas joga com elas e a IA passa a usar as azuis.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Game,TYPES,KEY,UNIT_CAP,startingCatalog,cleanStartingArmy,STANDARD_FACTIONS,BARRAGE,heliHigh}=new Function(fs.readFileSync(path.join(__dirname,'..','public','js','engine.js'),'utf8')+'\nreturn {Game,TYPES,KEY,UNIT_CAP,startingCatalog,cleanStartingArmy,STANDARD_FACTIONS,BARRAGE,heliHigh};')();
const SWAPPED={blue:'red',red:'blue'},cases=[],test=(name,fn)=>cases.push([name,fn]);
function field(factions,mode='rts'){
 const g=new Game('river','normal',123,mode,{posts:2},{},{},null,factions);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.actions=[];g.animation=null;g.projectiles=[];g.memory.blue.clear();g.memory.red.clear();g.intel.clear();g.aiEnabled=false;
 g.add('blue','hq',1,90);g.add('red','hq',120,2);g.rng=()=>.5;g.updateVision();return g;
}
test('padrão: cada lado usa o próprio exército',()=>{
 const g=field();assert.deepEqual({...g.factions},{...STANDARD_FACTIONS});
 assert.ok(g.planeCatalog('blue').includes('fighterBlue')&&!g.planeCatalog('blue').includes('fighterRed'));
 assert.ok(g.planeCatalog('red').includes('bomberRed'));
 const heli=g.add('red','transportHelicopter',100,50);assert.equal(BARRAGE(heli),true);assert.equal(heli.salvos,2);assert.equal(g.add('blue','transportHelicopter',10,50).salvos,undefined);
});
test('trocado: o lado azul usa aviões e helicóptero vermelhos, e o vermelho os azuis',()=>{
 const g=field(SWAPPED);assert.deepEqual({...g.factions},SWAPPED);
 assert.ok(g.planeCatalog('blue').includes('fighterRed')&&g.planeCatalog('blue').includes('bomberRed')&&!g.planeCatalog('blue').includes('fighterBlue'));
 assert.ok(g.planeCatalog('red').includes('fighterBlue')&&g.planeCatalog('red').includes('stealthFighterBlue'));
 assert.equal(g.canRecruit('blue','multiroleRed',g.add('blue','airportAsphalt',10,70)),true);assert.equal(g.canRecruit('blue','multiroleBlue',g.structures.find(s=>s.type==='airportAsphalt')),false);
 const own=g.add('blue','transportHelicopter',10,50),foe=g.add('red','transportHelicopter',100,50);
 assert.equal(BARRAGE(own),true,'o helicóptero do azul trocado tem a rajada');assert.equal(own.salvos,2);assert.equal(BARRAGE(foe),false);assert.equal(foe.salvos,undefined);
 own.altitude='high';assert.equal(heliHigh(own),false);foe.altitude='high';assert.equal(heliHigh(foe),true);
 const tank=g.add('red','lightTank',100,51);g.updateVision();foe.altitude='low';assert.equal(g.canEmbark(foe,tank),true,'a IA trocada leva o tanque leve pendurado');
});
test('exército inicial de cada lado respeita a facção',()=>{
 const g=new Game('river','normal',123,'rts',{posts:2},{},{blue:{infantry:2,tank:1}},null,SWAPPED);
 assert.deepEqual(g.initialArmies.blue,{infantry:2,tank:1});
 assert.ok(g.units.filter(u=>u.owner==='blue').every(u=>u.faction==='red'));assert.ok(g.units.filter(u=>u.owner==='red').every(u=>u.faction==='blue'));
 for(const type of Object.keys(g.initialArmies.red))assert.ok(startingCatalog('blue').includes(type),'IA trocada só usa o catálogo azul: '+type);
 assert.deepEqual(cleanStartingArmy({infantry:2,tank:1},'red'),{infantry:2,tank:1});
});
test('a IA compra os aviões da facção que recebeu',()=>{
 for(const [factions,suffix] of [[STANDARD_FACTIONS,'Red'],[SWAPPED,'Blue']]){
  const g=field(factions);g.aiEnabled=true;g.turn='red';g.credits.red=20000;const airport=g.add('red','airportAsphalt',100,60);g.add('red','infantry',100,50);g.add('blue','infantry',90,50);g.updateVision();
  for(let i=0;i<6;i++){g.aiBuy();g.production('red',200);}
  const bought=g.units.filter(u=>u.owner==='red'&&TYPES[u.type].plane).map(u=>u.type).concat(airport.queue.map(q=>q.type));
  assert.ok(bought.length>0,'IA comprou algum avião ('+suffix+')');for(const type of bought)assert.equal(TYPES[type].team,suffix.toLowerCase(),type+' na facção '+suffix);
 }
});
test('o limite de tropas e os saves seguem a facção',()=>{
 const g=field(SWAPPED);g.multiplayer=true;for(let i=0;i<UNIT_CAP;i++)g.add('blue','infantry',5+i%40,60-Math.floor(i/40)*2);assert.equal(g.atUnitCap('blue'),true);
 g.multiplayer=false;const copy=Game.fromSnapshot(g.snapshot());assert.deepEqual({...copy.factions},SWAPPED);
 assert.equal(copy.units.find(u=>u.owner==='blue').faction,'red');
 const old=g.snapshot();delete old.state.factions;for(const u of old.state.units)delete u.faction;const legacy=Game.fromSnapshot(old);assert.equal(legacy.factionOf('red'),'red');
});
for(const [name,fn] of cases){fn();console.log('OK '+name);}
console.log(cases.length+' verificações de facção passaram.');
