'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});for(const f of ['engine.js','story.js','story-scenes.js','world.js','missions.js'])if(fs.existsSync('public/js/'+f))vm.runInContext(fs.readFileSync('public/js/'+f,'utf8'),ctx);
assert.equal(vm.runInContext('typeof Missions',ctx),'object','missões ausentes');
vm.runInContext('Object.assign(this,{Game,Story,Missions,newCampaign})',ctx);const {Game,Story,Missions,newCampaign}=ctx;
const make=(chapter,mode,discoveries=[],terminalRecon=false)=>{const c=newCampaign(55,'normal',mode,'story');c.story.discoveries=discoveries;c.story.rewards.terminalRecon=terminalRecon;c.story.choices={secondary:'records',ivo:'protect',contracts:'secret',channel:'civil'};const g=new Game('river','normal',55,mode);Missions.setup(g,c,{chapter,region:1,id:'attempt',campaignId:c.story.id,seed:55});g.aiEnabled=false;return g;};
const emptyEnemies=g=>{g.units=g.units.filter(u=>u.owner==='blue');};
const engineerAt=(g,key)=>{const t=g.get(g.mission.ids[key]),u=g.units.find(u=>u.type==='engineer'&&u.owner==='blue');u.x=t.x-1;u.y=t.y;u.order={type:'stop'};t.owner='blue';g.updateVision();return u;};
const advance=(g,n)=>{if(g.mode==='rts')for(let i=0;i<n*30+1&&!g.winner;i++)g.update(1/30);else for(let i=0;i<n&&!g.winner;i++){g.beginTurn('red');g.beginTurn('blue');}};
const startRound=g=>{g.checkVictory();if(g.mode==='turns')g.beginTurn('blue');};
for(const mode of ['rts','turns']){
 let g=make(1,mode);emptyEnemies(g);engineerAt(g,'station');g.get(g.mission.ids.records).owner='blue';g.checkVictory();
 startRound(g);
 const waveTest=make(7,mode);Missions.wave(waveTest);Missions.wave(waveTest);assert.ok(waveTest.units.some(u=>u.owner==='red'&&u.type==='helicopter'),'terceira onda traz helicóptero');
 const before=g.mission.progress;g.paused=true;g.update(.1);assert.equal(g.mission.progress,before);g.paused=false;
 advance(g,mode==='rts'?61:2);assert.equal(g.winner,'blue','cópia missão 1 '+mode);assert.equal(g.mission.outcome.records,true);
 g=make(1,mode);g.structures=g.structures.filter(s=>s.id!==g.mission.ids.station);g.checkVictory();assert.equal(g.winner,'red','estação perdida');
 g=make(2,mode);emptyEnemies(g);const ivo=g.get(g.mission.ids.ivo),truck=g.get(g.mission.ids.truck);truck.x=ivo.x-1;truck.y=ivo.y;g.updateVision();
 assert.equal(g.weapon(ivo,truck),null);assert.equal(g.canCapture(ivo,g.structures[0]),false);
 assert.ok(g.order(truck,'embark',{targetId:ivo.id}));Object.assign(truck,g.mission.extraction);g.checkVictory();assert.equal(g.winner,'blue');
 const snap=g.snapshot();assert.equal(Game.fromSnapshot(snap).mission.ids.ivo,g.mission.ids.ivo);
 g=make(4,mode);emptyEnemies(g);engineerAt(g,'archive');g.get(g.mission.ids.power).owner='blue';startRound(g);advance(g,mode==='rts'?10:1);const copied=g.mission.progress;
 g.get(g.mission.ids.power).owner='red';advance(g,mode==='rts'?5:1);assert.equal(g.mission.progress,copied,'central perdida pausa');
 g.get(g.mission.ids.power).owner='blue';startRound(g);advance(g,mode==='rts'?51:1);assert.equal(g.winner,'blue');
 g=make(7,mode);g.get(g.mission.ids.aux).owner='blue';emptyEnemies(g);startRound(g);assert.equal(g.mission.waves,1);
 if(mode==='rts'){for(let i=0;i<181*30&&!g.winner;i++){emptyEnemies(g);g.update(1/30);}}else for(let i=0;i<6&&!g.winner;i++){emptyEnemies(g);g.beginTurn('red');g.beginTurn('blue');emptyEnemies(g);g.checkVictory();}
 assert.equal(g.mission.waves,3);assert.equal(g.winner,'blue','defesa '+mode);
 g=make(8,mode);emptyEnemies(g);engineerAt(g,'archive');startRound(g);advance(g,mode==='rts'?61:2);assert.equal(g.mission.copied,true);assert.equal(g.winner,null);
 const vehicle=g.get(g.mission.ids.truck),archive=g.get(g.mission.ids.archive);vehicle.x=archive.x-1;vehicle.y=archive.y;g.checkVictory();assert.equal(g.mission.loaded,true);Object.assign(vehicle,g.mission.extraction);g.checkVictory();assert.equal(g.winner,'blue');
 g=make(8,mode);g.structures=g.structures.filter(s=>s.owner!=='blue');g.checkVictory();assert.equal(g.winner,'red','última base');
 console.log('OK missões originais remapeadas, objetivos, pausa e carga: '+mode);
}
const partial=make(4,'turns');emptyEnemies(partial);partial.get(partial.mission.ids.power).owner='blue';partial.get(partial.mission.ids.archive).owner='blue';partial.beginTurn('red');engineerAt(partial,'archive');partial.checkVictory();partial.beginTurn('blue');assert.equal(partial.mission.progress,0,'meia rodada não conta como rodada completa');
const automatic=make(1,'rts'),station=automatic.get(automatic.mission.ids.station),tank=automatic.units.find(u=>u.type==='tank');Object.assign(tank,{x:station.x-4,y:station.y});automatic.updateVision();assert.notEqual(automatic.acquire(tank)?.id,station.id,'alvo protegido não recebe fogo automático');
const corrupt=make(1,'rts').snapshot();corrupt.state.mission.ids={};assert.throws(()=>Game.fromSnapshot(corrupt),/missão/,'IDs obrigatórios no save');
const clean=make(7,'rts');assert.ok(['blue','red'].every(owner=>[...clean.memory[owner].values()].every(s=>clean.structures.some(x=>x.id===s.id))),'sem postos fantasmas do mapa-base');
const remembered=make(4,'rts'),file=remembered.get(remembered.mission.ids.archive),observer=remembered.units.find(u=>u.type==='infantry');observer.x=file.x-1;observer.y=file.y;remembered.updateVision();observer.x=12;observer.y=75;remembered.updateVision();assert.ok(remembered.canCapture(observer,remembered.knownObjective('blue',file.id,file)),'arquivo reconhecido continua capturável sob névoa');

for(const mode of ['rts','turns']){
 let g=make(3,mode);emptyEnemies(g);const one=g.get(g.mission.ids.civilian1),two=g.get(g.mission.ids.civilian2);assert.ok(one&&two);assert.equal(g.canCapture(one,g.structures[0]),false);Object.assign(one,g.mission.extraction);g.checkVictory();assert.equal(g.winner,null);Object.assign(two,g.mission.extraction);g.checkVictory();assert.equal(g.winner,'blue');
 g=make(3,mode);g.units=g.units.filter(u=>u.id!==g.mission.ids.civilian2);g.checkVictory();assert.equal(g.winner,'red');
 g=make(5,mode);emptyEnemies(g);engineerAt(g,'archive');g.get(g.mission.ids.terminal).owner='blue';startRound(g);advance(g,mode==='rts'?61:2);assert.equal(g.winner,'blue');
 g=make(5,mode);g.structures=g.structures.filter(u=>u.id!==g.mission.ids.archive);g.checkVictory();assert.equal(g.winner,'red');
 g=make(6,mode);emptyEnemies(g);const nara=g.get(g.mission.ids.nara),truck=g.get(g.mission.ids.truck);assert.equal(g.weapon(nara,truck),null);assert.equal(g.canCapture(nara,g.structures[0]),false);Object.assign(truck,{x:nara.x-1,y:nara.y});g.updateVision();assert.ok(g.order(truck,'embark',{targetId:nara.id}));Object.assign(truck,g.mission.extraction);g.checkVictory();assert.equal(g.winner,'blue');
 g=make(6,mode);g.units=g.units.filter(u=>u.id!==g.mission.ids.nara);g.checkVictory();assert.equal(g.winner,'red');
 g=make(6,mode);emptyEnemies(g);const passenger=g.get(g.mission.ids.nara),carrier=g.get(g.mission.ids.truck);Object.assign(carrier,{x:passenger.x-1,y:passenger.y});g.updateVision();assert.ok(g.order(carrier,'embark',{targetId:passenger.id}));g.units=g.units.filter(u=>u.id!==carrier.id);g.checkVictory();assert.equal(g.winner,'red','perda do caminhão com Nara encerra a extração');
}

for(const mode of ['rts','turns'])for(let chapter=1;chapter<=8;chapter++){
 const g=make(chapter,mode),restored=Game.fromSnapshot(g.snapshot());assert.equal(restored.mission.chapter,chapter);assert.equal(restored.mission.version,2);
 const old=g.snapshot();old.state.mission.version=1;assert.throws(()=>Game.fromSnapshot(old),/missão/,'missão antiga não pode ser reinterpretada');
}
console.log('OK oito missões, perdas e snapshots em RTS e turnos');

for(const [chapter,key]of [[4,'power'],[5,'terminal']]){const g=make(chapter,'turns');g.structures=g.structures.filter(u=>u.id!==g.mission.ids[key]);g.checkVictory();assert.equal(g.winner,'red','objetivo necessário destruído termina a missão');}

for(const mode of ['rts','turns']){
 const plain=make(3,mode),route=make(3,mode,['records:route']);assert.equal(plain.mission.route,undefined);assert.ok(route.mission.route);assert.ok(Game.fromSnapshot(route.snapshot()).mission.route);
 let g=make(5,mode,['contracts:cargo']);emptyEnemies(g);assert.ok(g.mission.ids.cargo);g.get(g.mission.ids.cargo).owner='blue';g.checkVictory();assert.equal(g.mission.terminalRecon,true);engineerAt(g,'archive');g.get(g.mission.ids.terminal).owner='blue';startRound(g);advance(g,mode==='rts'?61:2);assert.equal(g.mission.outcome.terminalRecon,true);
 assert.equal(make(5,mode).mission.ids.cargo,undefined);assert.ok(make(6,mode,[],true).mission.ids.recon);assert.equal(make(6,mode).mission.ids.recon,undefined);
 g=make(6,mode,['manifest:contact']);emptyEnemies(g);const before=g.credits.blue;g.get(g.mission.ids.contact).owner='blue';g.checkVictory();assert.equal(g.credits.blue,before+50);g.checkVictory();assert.equal(g.credits.blue,before+50);const resumed=Game.fromSnapshot(g.snapshot());resumed.checkVictory();assert.equal(resumed.credits.blue,before+50,'recompensa não duplica ao carregar');
}
console.log('OK pistas, reconhecimento e recompensa única');

for(const seed of [7,55])for(const map of ['river','desert','mountain'])for(const chapter of [3,5,6]){
 const c=newCampaign(seed,'normal','rts','story'),g=new Game(map,'normal',seed,'rts');Missions.setup(g,c,{chapter,region:1,id:'reach',campaignId:c.story.id,seed});g.aiEnabled=false;
 if(chapter===3)for(const key of ['civilian1','civilian2'])assert.ok(g.pathToRange(g.get(g.mission.ids[key]),g.mission.extraction,2)!==null,'rota de extração '+map+seed+key);
 if(chapter===5){const engineer=g.get(g.mission.ids.engineer),infantry=g.units.find(u=>u.type==='infantry'&&u.owner==='blue');for(const key of ['terminal','archive'])assert.ok(g.pathToRange(infantry,g.get(g.mission.ids[key]),1)!==null,'captura acessível '+map+seed+key);assert.ok(g.pathToRange(engineer,g.get(g.mission.ids.archive),1)!==null,'engenheiro alcança arquivo '+map+seed);}
 if(chapter===6){const truck=g.get(g.mission.ids.truck);assert.ok(g.pathToRange(truck,g.get(g.mission.ids.nara),1)!==null);assert.ok(g.pathToRange(truck,g.mission.extraction,2)!==null);}
}
console.log('OK acesso aos novos objetivos em três biomas e duas sementes');
