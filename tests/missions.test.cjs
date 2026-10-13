'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});for(const f of ['engine.js','story.js','world.js','missions.js'])if(fs.existsSync('public/js/'+f))vm.runInContext(fs.readFileSync('public/js/'+f,'utf8'),ctx);
assert.equal(vm.runInContext('typeof Missions',ctx),'object','missões ausentes');
vm.runInContext('Object.assign(this,{Game,Story,Missions,newCampaign})',ctx);const {Game,Story,Missions,newCampaign}=ctx;
const make=(chapter,mode)=>{const c=newCampaign(55,'normal',mode,'story');c.story.choices={secondary:'records',ivo:'protect',contracts:'secret',channel:'civil'};const g=new Game('river','normal',55,mode);Missions.setup(g,c,{chapter,region:1,id:'attempt',campaignId:c.story.id,seed:55});g.aiEnabled=false;return g;};
const emptyEnemies=g=>{g.units=g.units.filter(u=>u.owner==='blue');};
const engineerAt=(g,key)=>{const t=g.get(g.mission.ids[key]),u=g.units.find(u=>u.type==='engineer'&&u.owner==='blue');u.x=t.x-1;u.y=t.y;u.order={type:'stop'};t.owner='blue';g.updateVision();return u;};
const advance=(g,n)=>{if(g.mode==='rts')for(let i=0;i<n*30+1&&!g.winner;i++)g.update(1/30);else for(let i=0;i<n&&!g.winner;i++){g.beginTurn('red');g.beginTurn('blue');}};
const startRound=g=>{g.checkVictory();if(g.mode==='turns')g.beginTurn('blue');};
for(const mode of ['rts','turns']){
 let g=make(1,mode);emptyEnemies(g);engineerAt(g,'station');g.get(g.mission.ids.records).owner='blue';g.checkVictory();
 startRound(g);
 const waveTest=make(4,mode);Missions.wave(waveTest);Missions.wave(waveTest);assert.ok(waveTest.units.some(u=>u.owner==='red'&&u.type==='helicopter'),'terceira onda traz helicóptero');
 const before=g.mission.progress;g.paused=true;g.update(.1);assert.equal(g.mission.progress,before);g.paused=false;
 advance(g,mode==='rts'?61:2);assert.equal(g.winner,'blue','cópia missão 1 '+mode);assert.equal(g.mission.outcome.records,true);
 g=make(1,mode);g.structures=g.structures.filter(s=>s.id!==g.mission.ids.station);g.checkVictory();assert.equal(g.winner,'red','estação perdida');
 g=make(2,mode);emptyEnemies(g);const ivo=g.get(g.mission.ids.ivo),truck=g.get(g.mission.ids.truck);truck.x=ivo.x-1;truck.y=ivo.y;g.updateVision();
 assert.equal(g.weapon(ivo,truck),null);assert.equal(g.canCapture(ivo,g.structures[0]),false);
 assert.ok(g.order(truck,'embark',{targetId:ivo.id}));Object.assign(truck,g.mission.extraction);g.checkVictory();assert.equal(g.winner,'blue');
 const snap=g.snapshot();assert.equal(Game.fromSnapshot(snap).mission.ids.ivo,g.mission.ids.ivo);
 g=make(3,mode);emptyEnemies(g);engineerAt(g,'archive');g.get(g.mission.ids.power).owner='blue';startRound(g);advance(g,mode==='rts'?10:1);const copied=g.mission.progress;
 g.get(g.mission.ids.power).owner='red';advance(g,mode==='rts'?5:1);assert.equal(g.mission.progress,copied,'central perdida pausa');
 g.get(g.mission.ids.power).owner='blue';startRound(g);advance(g,mode==='rts'?51:1);assert.equal(g.winner,'blue');
 g=make(4,mode);g.get(g.mission.ids.aux).owner='blue';emptyEnemies(g);startRound(g);assert.equal(g.mission.waves,1);
 if(mode==='rts'){for(let i=0;i<181*30&&!g.winner;i++){emptyEnemies(g);g.update(1/30);}}else for(let i=0;i<6&&!g.winner;i++){emptyEnemies(g);g.beginTurn('red');g.beginTurn('blue');emptyEnemies(g);g.checkVictory();}
 assert.equal(g.mission.waves,3);assert.equal(g.winner,'blue','defesa '+mode);
 g=make(5,mode);emptyEnemies(g);engineerAt(g,'archive');startRound(g);advance(g,mode==='rts'?61:2);assert.equal(g.mission.copied,true);assert.equal(g.winner,null);
 const vehicle=g.get(g.mission.ids.truck),archive=g.get(g.mission.ids.archive);vehicle.x=archive.x-1;vehicle.y=archive.y;g.checkVictory();assert.equal(g.mission.loaded,true);Object.assign(vehicle,g.mission.extraction);g.checkVictory();assert.equal(g.winner,'blue');
 g=make(5,mode);g.structures=g.structures.filter(s=>s.owner!=='blue');g.checkVictory();assert.equal(g.winner,'red','última base');
 console.log('OK cinco missões, objetivos, pausa e carga: '+mode);
}
const partial=make(3,'turns');emptyEnemies(partial);partial.get(partial.mission.ids.power).owner='blue';partial.get(partial.mission.ids.archive).owner='blue';partial.beginTurn('red');engineerAt(partial,'archive');partial.checkVictory();partial.beginTurn('blue');assert.equal(partial.mission.progress,0,'meia rodada não conta como rodada completa');
const automatic=make(1,'rts'),station=automatic.get(automatic.mission.ids.station),tank=automatic.units.find(u=>u.type==='tank');Object.assign(tank,{x:station.x-4,y:station.y});automatic.updateVision();assert.notEqual(automatic.acquire(tank)?.id,station.id,'alvo protegido não recebe fogo automático');
const corrupt=make(1,'rts').snapshot();corrupt.state.mission.ids={};assert.throws(()=>Game.fromSnapshot(corrupt),/missão/,'IDs obrigatórios no save');
const clean=make(4,'rts');assert.ok(['blue','red'].every(owner=>[...clean.memory[owner].values()].every(s=>clean.structures.some(x=>x.id===s.id))),'sem postos fantasmas do mapa-base');
const remembered=make(3,'rts'),file=remembered.get(remembered.mission.ids.archive),observer=remembered.units.find(u=>u.type==='infantry');observer.x=file.x-1;observer.y=file.y;remembered.updateVision();observer.x=12;observer.y=75;remembered.updateVision();assert.ok(remembered.canCapture(observer,remembered.knownObjective('blue',file.id,file)),'arquivo reconhecido continua capturável sob névoa');
