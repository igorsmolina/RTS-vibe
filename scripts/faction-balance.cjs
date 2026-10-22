'use strict';
// Balanceamento por time: mesmo orçamento dos dois lados, preço pela ficha de cada facção (SPEC), lados trocados e várias sementes.
// Uso: node scripts/faction-balance.cjs [--label antes|depois] [--seeds 4] [--only infantaria,tanques]
const fs=require('node:fs'),path=require('node:path');
const E=new Function(fs.readFileSync(path.join(__dirname,'..','public','js','engine.js'),'utf8')+'\nreturn {Game,SPEC,UT,seeded,FRANCE};')();
const {Game,SPEC,UT,seeded,FRANCE}=E;
const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf('--'+k);return i<0?d:args[i+1];};
const SEEDS=+opt('seeds',4),LABEL=opt('label','atual'),ONLY=opt('only','').split(',').filter(Boolean),BUDGET=+opt('budget',900);
const FACTION={V:'blue',R:'red',F:FRANCE},NAME={V:'Verde',R:'Vermelho',F:'França'};
// Composições por domínio: tipos em ordem de compra (ciclo) até esgotar o orçamento.
const COMPOSITIONS={
 infantaria:['infantry','antitank','infantry','machinegun','infantry','engineer'],
 tanques:['lightTank','tank','heavyTank','tank'],
 misto:['infantry','tank','antitank','heavyTank','infantry','recon'],
 apoio:['artillery','tank','infantry','antiAirVehicle'],
 helicopteros:['helicopter','helicopterGround','helicopterAir'],
 tigre:['helicopterGround'],
 reconhecimento:['recon','recon','infantry'],
 blindados_leves:['lightTank','recon','lightTank'],
 antitanque:['antitank','antitank','infantry'],
};
function field(factions,seed){
 const g=new Game('river','normal',123,'rts',{posts:2},{},{},null,factions);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.actions=[];g.animation=null;g.projectiles=[];
 g.memory.blue.clear();g.memory.red.clear();g.intel.clear();g.aiEnabled=false;g.add('blue','hq',1,90);g.add('red','hq',124,2);g.rng=seeded(seed);g.updateVision();return g;
}
function build(types,faction,budget){const out=[];let spent=0;for(let i=0;i<60;i++){const t=types[i%types.length],c=SPEC(t,faction).cost;if(spent+c>budget)break;out.push(t);spent+=c;}return {out,spent};}
const value=(g,side)=>g.units.filter(u=>u.owner===side&&u.hp>0&&!UT(u).structure).reduce((a,u)=>a+SPEC(u.type,g.factions[side]).cost*u.hp/u.maxHp,0);
function fight(fa,fb,types,seed){
 const g=field({blue:FACTION[fa],red:FACTION[fb]},seed),A=build(types,FACTION[fa],BUDGET),B=build(types,FACTION[fb],BUDGET);
 for(const [side,list] of [['blue',A.out],['red',B.out]])list.forEach((t,i)=>g.add(side,t,side==='blue'?50-(i%4)*2:78+(i%4)*2,40+Math.floor(i/4)*2));
 g.updateVision();
 for(let i=0;i<30*240;i++){
  if(i%15===0)for(const u of g.units){
   if(u.hp<=0||UT(u).structure||u.order?.type!=='stop'&&u.pending)continue;
   const e=g.acquire(u);if(e){g.order(u,'attack',{targetId:e.id});continue;}
   if(!u.pending){const foes=g.units.filter(x=>x.owner!==u.owner&&x.hp>0&&!UT(x).structure).sort((p,q)=>Math.hypot(p.x-u.x,p.y-u.y)-Math.hypot(q.x-u.x,q.y-u.y));if(foes[0])g.order(u,'move',{x:Math.round(foes[0].x),y:Math.round(foes[0].y)});}
  }
  g.update(1/30);
  const a=g.units.some(u=>u.owner==='blue'&&!UT(u).structure&&u.hp>0),b=g.units.some(u=>u.owner==='red'&&!UT(u).structure&&u.hp>0);if(!a||!b)break;
 }
 return {a:value(g,'blue')/A.spent,b:value(g,'red')/B.spent,time:g.time};
}
function match(fa,fb,types){let wins=0,n=0,sa=0,sb=0;
 for(let s=1;s<=SEEDS;s++)for(const flip of [0,1]){const r=flip?fight(fb,fa,types,s):fight(fa,fb,types,s);const [x,y]=flip?[r.b,r.a]:[r.a,r.b];if(x>y)wins++;else if(x===y)wins+=.5;sa+=x;sb+=y;n++;}
 return {wins,n,pct:Math.round(100*wins/n),left:[Math.round(100*sa/n),Math.round(100*sb/n)]};
}
const result={label:LABEL,budget:BUDGET,seeds:SEEDS,matches:{}};
const lines=[`| Composição | França×Verde | França×Vermelho | Verde×Vermelho |`,`|---|---|---|---|`];
for(const [name,types] of Object.entries(COMPOSITIONS)){
 if(ONLY.length&&!ONLY.includes(name))continue;
 const row={};for(const [a,b] of [['F','V'],['F','R'],['V','R']])row[a+b]=match(a,b,types);
 result.matches[name]=row;
 lines.push(`| ${name} | ${row.FV.pct}% (${row.FV.left.join('/')}) | ${row.FR.pct}% (${row.FR.left.join('/')}) | ${row.VR.pct}% (${row.VR.left.join('/')}) |`);
}
console.log(`Vitórias da 1ª facção (valor restante % de cada lado) · orçamento ${BUDGET} · ${SEEDS*2} duelos por célula · ${LABEL}\n`+lines.join('\n'));
const dir=path.join(__dirname,'..','reports','franca-2026-10-22');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,`resultado-${LABEL}.json`),JSON.stringify(result,null,1));
fs.writeFileSync(path.join(dir,`tabela-${LABEL}.md`),lines.join('\n')+'\n');
