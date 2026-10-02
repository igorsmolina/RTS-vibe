// Comparação reproduzível usando ordens e combate do motor real, sem alterar atributos.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','engine.js'),'utf8')+'\nthis.Game=Game;this.TYPES=TYPES;this.DIST=DIST;',ctx);const {Game,TYPES,DIST}=ctx;
const scenarios=[
 ['leve × médio',['lightTank'],['tank']],['leve × pesado',['lightTank'],['heavyTank']],['médio × pesado',['tank'],['heavyTank']],
 ['3 leves × 2 médios',Array(3).fill('lightTank'),Array(2).fill('tank')],
 ['5 leves × 2 pesados',Array(5).fill('lightTank'),Array(2).fill('heavyTank')],
 ['3 médios × 2 pesados',Array(3).fill('tank'),Array(2).fill('heavyTank')],
 ['2 antitanques × pesado',Array(2).fill('antitank'),['heavyTank']]
];
function battle(mode,seed,left,right,swapped){
 const g=new Game('desert','normal',seed,mode);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.aiEnabled=false;g.add('blue','hq',0,13);g.add('red','hq',17,0);
 for(const [owner,types]of [['blue',swapped?right:left],['red',swapped?left:right]])types.forEach((type,i)=>g.add(owner,type,owner==='blue'?6-Math.floor(i/3):9+Math.floor(i/3),5+i%3));
 g.updateVision();
 const issue=u=>{const targets=g.units.filter(v=>v.owner!==u.owner&&g.isVisible(u.owner,v)).sort((a,b)=>DIST(u,a)-DIST(u,b)||a.id-b.id);for(const target of targets)if(g.order(u,'attack',{targetId:target.id}))break;};
 if(mode==='rts'){
  for(let tick=0;tick<6000&&!g.winner;tick++){if(tick%15===0)for(const u of g.units)if(!u.pending)issue(u);g.update(1/30);}
 }else for(let turn=0;turn<80&&!g.winner;turn++){
  const owner=turn%2?'red':'blue';g.beginTurn(owner);g.aiWait=Infinity;
  for(const u of [...g.units])if(u.owner===owner&&u.hp>0){issue(u);let ticks=0;while(g.busy&&!g.winner&&ticks++<1000)g.update(1/30);assert.ok(ticks<1000,'Ordem bloqueada');}g.checkVictory();
 }
 return {winner:!g.winner||g.winner==='draw'?'draw':((g.winner==='blue')!==swapped?'left':'right'),time:g.time,round:g.round,survivors:g.units.map(u=>({side:(u.owner==='blue')!==swapped?'left':'right',type:u.type,hp:u.hp,level:u.level}))};
}
const report={method:'Sementes 1–50, lados alternados; planície, nível 1 inicial, sem comandante, minas, renda aplicada à compra ou produção. Turnos: lado azul age primeiro; RTS: ordens simultâneas, passo 1/30 s. Alvo visível mais próximo; perseguição e combate reais, incluindo erros, críticos, cobertura ociosa e veterania. Limites: 80 meios-turnos / 200 s RTS. Resultados de confronto, não validação de partidas completas.',attributes:Object.fromEntries(['lightTank','tank','heavyTank'].map(type=>[type,TYPES[type]])),results:[]};
for(const mode of ['turns','rts'])for(const swapped of [false,true]){
 assert.equal(battle(mode,17,[],[],swapped).winner,'draw','Neutralização das duas forças deve ser empate');
 assert.deepEqual(battle(mode,17,scenarios[5][1],scenarios[5][2],swapped),battle(mode,17,scenarios[5][1],scenarios[5][2],swapped),'Mesma semente e lado devem reproduzir o confronto');
}
assert.equal(battle('rts',9,['tank'],['tank'],false).winner,'draw','Destruição simultânea deve manter o empate informado pelo motor');
for(const mode of ['turns','rts'])for(const [name,left,right]of scenarios){
 const entry={mode,scenario:name,left,right,costLeft:left.reduce((s,t)=>s+TYPES[t].cost,0),costRight:right.reduce((s,t)=>s+TYPES[t].cost,0),winsLeft:0,winsRight:0,draws:0,battles:[]};
 for(let seed=1;seed<=50;seed++)for(const swapped of [false,true]){const result=battle(mode,seed,left,right,swapped);entry[result.winner==='left'?'winsLeft':result.winner==='right'?'winsRight':'draws']++;entry.battles.push({seed,swapped,...result});}
 assert.equal(entry.winsLeft+entry.winsRight+entry.draws,100);report.results.push(entry);console.log(`${mode}: ${name} (${entry.costLeft}/${entry.costRight} créditos): ${entry.winsLeft}/${entry.winsRight}, ${entry.draws} empates`);
}
const dir=path.join(__dirname,'..','docs','tanks');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'balance-results.json'),JSON.stringify(report,null,2)+'\n');
