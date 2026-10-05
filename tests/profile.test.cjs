// Perfil do jogador (public/js/profile.js): estatísticas, histórico, conquistas, mescla e validação; placar no motor. node tests/profile.test.cjs
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console}),load=f=>fs.readFileSync(path.join(__dirname,'..','public','js',f),'utf8');
vm.runInContext(load('engine.js')+'\n'+load('profile.js')+'\nObject.assign(this,{Game,MAPS,COLS,ROWS,ACHIEVEMENTS,HISTORY_MAX,newProfile,matchRecord,recordMatch,recordCampaign,mergeProfiles,validateBundle,mergeBundles});',ctx);
const {Game,MAPS,COLS,ROWS,ACHIEVEMENTS,HISTORY_MAX,newProfile,matchRecord,recordMatch,recordCampaign,mergeProfiles,validateBundle,mergeBundles}=ctx;
let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
const copy=v=>JSON.parse(JSON.stringify(v));
const match=(o={})=>({id:'m'+(o.date||1),date:1,map:'river',seed:1,difficulty:'normal',mode:'turns',result:'win',time:0,round:15,kills:{},lost:{infantry:5},region:null,...o});
const ids=list=>[...list].map(a=>a.id).sort();

check('Motor: placar por tipo conta perdas de cada lado e abates de quem atirou; estruturas não contam',()=>{
 const g=new Game('river','normal',3);g.terrain.fill('plain');g.units=[];g.structures=[];g.add('blue','hq',0,ROWS-1);g.add('red','hq',COLS-1,0);
 const shooter=g.add('blue','tank',5,5),target=g.add('red','helicopter',6,5),post=g.add('red','post',10,10);
 g.hurt(target,999,shooter);g.hurt(post,999,shooter);
 assert.deepEqual(copy(g.stats),{blue:{kills:{helicopter:1},losses:{}},red:{kills:{},losses:{helicopter:1}}});
});
check('Registro: matchRecord lê o placar azul; recordMatch soma estatísticas e mantém só as últimas 30 partidas',()=>{
 const g=new Game('desert','hard',9);g.winner='blue';g.stats.blue.kills.tank=2;g.stats.blue.losses.infantry=1;
 const m=matchRecord(g,4,1000);assert.equal(m.result,'win');assert.equal(m.difficulty,'hard');assert.equal(m.region,4);assert.deepEqual(copy(m.kills),{tank:2});
 const p=newProfile();recordMatch(p,m);
 assert.equal(p.stats.matches,1);assert.equal(p.stats.wins,1);assert.deepEqual(copy(p.stats.byDifficulty.hard),{played:1,won:1});assert.equal(p.stats.kills.tank,2);assert.equal(p.stats.mapsWon.desert,true);
 for(let i=0;i<40;i++)recordMatch(p,match({date:2000+i,result:'loss'}));
 assert.equal(p.history.length,HISTORY_MAX);assert.equal(p.history[0].date,2039,'Mais recente primeiro');assert.equal(p.stats.matches,41);assert.equal(p.stats.losses,40);
});
check('Conquistas: cada uma desbloqueia no caso certo e só uma vez',()=>{
 const p=newProfile();assert.deepEqual(ids(recordMatch(p,match({result:'loss',date:1}))),[],'Derrota não desbloqueia nada');
 assert.deepEqual(ids(recordMatch(p,match({date:2,round:15}))),['firstWin','turnsWin']);
 assert.deepEqual(ids(recordMatch(p,match({date:3,round:10,lost:{}}))),['blitz','fewLosses']);
 assert.deepEqual(ids(recordMatch(p,match({date:4,mode:'rts',time:481,difficulty:'veteran'}))),['rtsWin','veteranWin'],'RTS acima de 8 min não é blitz');
 assert.deepEqual(ids(recordMatch(p,match({date:5,difficulty:'hard',kills:{helicopter:6,helicopterAir:4,tank:50,infantry:40}}))),['airHunter','armorBreaker','centurion','hardWin']);
 assert.deepEqual(ids(recordMatch(p,match({date:6,map:'desert'}))),[]);recordMatch(p,match({date:7,map:'mountain'}));
 assert.deepEqual(ids(recordMatch(p,match({date:8,map:'random'}))),['cartographer']);
 assert.deepEqual(ids(recordCampaign(p,true,false,9)),['firstRegion']);for(let i=0;i<8;i++)recordCampaign(p,true,false,10);
 assert.deepEqual(ids(recordCampaign(p,true,true,11)),['campaignWin','conqueror']);
 for(let i=0;i<17;i++)recordMatch(p,match({date:20+i,result:'loss'}));assert.ok(p.achievements.warVeteran,'25 operações');
 assert.equal(Object.keys(p.achievements).length,ACHIEVEMENTS.length,'Todas testadas');assert.equal(p.achievements.firstWin,2,'Data da primeira vez');
});
check('Mescla: conquistas em união (data mais antiga), contadores pelo maior, histórico sem duplicar',()=>{
 const a=newProfile(),b=newProfile();recordMatch(a,match({date:5}));recordMatch(b,match({date:3,id:'other'}));recordMatch(b,match({date:5}));recordMatch(b,match({date:6,result:'loss'}));
 a.achievements.blitz=9;const m=mergeProfiles(a,b);
 assert.equal(m.achievements.firstWin,3);assert.equal(m.achievements.blitz,9);assert.equal(m.stats.matches,3);
 assert.deepEqual([...m.history].map(h=>h.date),[6,5,3]);
});
check('Validação: pacote inválido é recusado; lixo e __proto__ são descartados',()=>{
 for(const bad of [null,1,'x',{},{version:2,profile:{}},{version:1},{version:1,profile:{},campaign:5}])assert.equal(validateBundle(bad),null,JSON.stringify(bad));
 const evil=JSON.parse('{"version":1,"profile":{"stats":{"wins":"9","matches":-3,"kills":{"__proto__":{"polluted":1},"tank":4}},"history":[{"id":"x"},5],"achievements":{"firstWin":7,"fake":1}},"settings":[1]}');
 const b=validateBundle(evil);assert.equal(b.profile.stats.wins,0);assert.equal(b.profile.stats.matches,0);assert.equal(b.profile.stats.kills.tank,4);
 assert.equal(vm.runInContext("({}).polluted",ctx),undefined);assert.equal(b.profile.stats.kills.polluted,undefined);
 assert.deepEqual(copy(b.profile.history),[]);assert.deepEqual(copy(b.profile.achievements),{firstWin:7});assert.deepEqual(copy(b.settings),{});
});
check('Pacote: campanha e configurações vêm do lado salvo por último; ida e volta pelo JSON',()=>{
 const local={version:1,profile:{...newProfile(),campaignAt:10,settingsAt:50},campaign:'L',settings:{grid:false}},remote={version:1,profile:{...newProfile(),campaignAt:20,settingsAt:40},campaign:'R',settings:{grid:true}};
 const m=mergeBundles(local,remote);assert.equal(m.campaign,'R');assert.deepEqual(copy(m.settings),{grid:false});
 assert.deepEqual(copy(validateBundle(JSON.parse(JSON.stringify(m)))),copy(m));
});
console.log(checks+' verificações de perfil concluídas.');
