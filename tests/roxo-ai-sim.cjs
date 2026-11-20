'use strict';
// A IA joga de Roxo (e contra o Roxo) em três mapas contra cada time: 150 s no RTS, sem exceção, só com unidades roxas.
// Fora do `npm test` (como ai-matrix): grava reports/roxo-2026-10-22/ia.json e imprime uma tabela-resumo.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const engine=new Function(fs.readFileSync(path.join(__dirname,'..','public','js','engine.js'),'utf8')+'\nreturn {Game,TYPES,ROXO,FRANCE,AIR,PLANE,UT};')();
const {Game,TYPES,ROXO,FRANCE,AIR,PLANE}=engine,SECONDS=+(process.env.RTS_AI_SECONDS||150),results=[],failures=[];
const tally=list=>list.reduce((o,t)=>(o[t]=(o[t]||0)+1,o),{});
function play(map,enemy,roxoSide){
 const other=roxoSide==='red'?'blue':'red',factions={[roxoSide]:ROXO,[other]:enemy},g=new Game(map,'normal',44,'rts',{posts:2},{},{},null,factions);
 const logistics={embarked:0,disembarked:0},transport=g.transportOrder.bind(g);
 g.transportOrder=(u,type,args)=>{const n=u.cargo?.length||0,ok=transport(u,type,args);if(ok&&u.owner==='red'){if(type==='embark')logistics.embarked+=u.cargo.length-n;else logistics.disembarked+=n-u.cargo.length;}return ok;};
 for(let i=0;i<SECONDS*30&&!g.winner;i++){g.update(1/30);g.events=[];}
 const mine=g.units.filter(u=>u.owner===roxoSide),ai=g.units.filter(u=>u.owner==='red');
 assert.ok(g.aiDecisions>0,'a IA decidiu algo');
 for(const u of g.units.filter(u=>u.owner===roxoSide))assert.equal(u.faction,ROXO,u.type+' do lado roxo tem a facção roxa');
 for(const u of g.units.filter(u=>u.owner===other))assert.equal(u.faction,enemy,u.type+' do outro lado tem a facção '+enemy);
 for(const u of mine)if(TYPES[u.type].plane)assert.equal(TYPES[u.type].team,'roxo',u.type);
 return {map,roxoSide,enemy,winner:g.winner||null,time:Math.round(g.time),aiDecisions:g.aiDecisions,units:tally(ai.filter(u=>!TYPES[u.type].structure).map(u=>u.type)),planes:ai.filter(u=>TYPES[u.type].plane).length,transports:ai.filter(u=>/^transport/.test(u.type)).length,logistics,credits:{...g.credits}};
}
for(const roxoSide of ['red','blue'])for(const map of ['river','desert','mountain'])for(const enemy of ['blue','red',FRANCE]){
 try{const r=play(map,enemy,roxoSide);results.push(r);console.log('OK',map,'Roxo no lado',roxoSide,'contra',enemy,'decisões',r.aiDecisions,'aviões da IA',r.planes,'transportes',r.transports,'embarques',r.logistics.embarked,'vencedor',r.winner);}
 catch(e){failures.push({map,roxoSide,enemy,error:e.message});console.log('FALHA',map,roxoSide,enemy,e.message);}
}
const dir=path.join(__dirname,'..','reports','roxo-2026-10-22');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'ia.json'),JSON.stringify({seconds:SECONDS,results,failures},null,1));
assert.equal(failures.length,0,'partidas com falha: '+JSON.stringify(failures));
assert.equal(results.length,18);
console.log(results.length+' partidas de IA com o Roxo passaram.');
