'use strict';
// Balanceamento por time: mesmo orçamento dos dois lados, preço pela ficha de cada facção (SPEC), lados trocados e várias sementes.
// Uso: node scripts/faction-balance.cjs [--label antes|depois] [--seeds 4] [--only infantaria,tanques]
//   --transport: infantaria dentro de caminhões/helicópteros de transporte (o orçamento inclui os veículos); composições infantaria_transporte e infantaria_helicoptero.
const fs=require('node:fs'),path=require('node:path');
const E=new Function(fs.readFileSync(path.join(__dirname,'..','public','js','engine.js'),'utf8')+'\nreturn {Game,SPEC,UT,seeded,FRANCE};')();
const {Game,SPEC,UT,seeded,FRANCE}=E;
const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf('--'+k);return i<0?d:args[i+1];};
const SEEDS=+opt('seeds',4),LABEL=opt('label',args.includes('--transport')?'transporte':'atual'),ONLY=opt('only','').split(',').filter(Boolean),BUDGET=+opt('budget',900);
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
 for(let s=1;s<=SEEDS;s++)for(const flip of [0,1]){const r=flip?fightAny(fb,fa,types,s):fightAny(fa,fb,types,s);const [x,y]=flip?[r.b,r.a]:[r.a,r.b];if(x>y)wins++;else if(x===y)wins+=.5;sa+=x;sb+=y;n++;}
 return {wins,n,pct:Math.round(100*wins/n),left:[Math.round(100*sa/n),Math.round(100*sb/n)]};
}
// --- Cenário de transporte: a infantria começa embarcada, os veículos avançam, desembarcam perto do inimigo e depois todos lutam.
const TRANSPORT=args.includes('--transport');
const CARRIERS={infantaria_transporte:'transportTruck',infantaria_helicoptero:'transportHelicopter'};
const FOOT_MIX=['infantry','antitank','infantry','machinegun','infantry'];
// Compra tropas a pé em ciclo; cada nova tropa só entra se couber, junto dos transportes necessários (ceil(n/capacidade)), no orçamento.
function buildCargo(carrier,faction,budget){const cap=SPEC(carrier,faction).capacity,cc=SPEC(carrier,faction).cost,foot=[];let spent=0;
 for(let i=0;i<60;i++){const t=FOOT_MIX[i%FOOT_MIX.length],n=foot.length+1,cost=foot.reduce((a,x)=>a+SPEC(x,faction).cost,SPEC(t,faction).cost)+Math.ceil(n/cap)*cc;if(cost>budget)break;foot.push(t);spent=cost;}
 return {foot,cap,carriers:Math.ceil(foot.length/cap),spent};}
function fightTransport(fa,fb,carrier,seed){
 const g=field({blue:FACTION[fa],red:FACTION[fb]},seed),air=carrier==='transportHelicopter',info={},trucks=[];
 for(const [side,fac,x] of [['blue',FACTION[fa],50],['red',FACTION[fb],78]]){
  const B=info[side]=buildCargo(carrier,fac,BUDGET);
  for(let k=0;k<B.carriers;k++){const t=g.add(side,carrier,x,34+k*3);if(air)t.altitude='low';t.cargo=[];trucks.push(t);
   B.foot.slice(k*B.cap,(k+1)*B.cap).forEach(type=>{const p=g.add(side,type,x+(side==='blue'?-1:1),34+k*3);g.order(t,'embark',{targetId:p.id});});}
 }
 g.updateVision();
 const alive=side=>g.units.some(u=>u.owner===side&&u.hp>0&&!UT(u).structure&&!trucks.includes(u))||trucks.some(t=>t.owner===side&&t.hp>0&&g.units.includes(t)&&t.cargo?.length);
 const foes=u=>g.units.filter(x=>x.owner!==u.owner&&x.hp>0&&!UT(x).structure).sort((p,q)=>Math.hypot(p.x-u.x,p.y-u.y)-Math.hypot(q.x-u.x,q.y-u.y));
 // ordem de mover para a casa de um inimigo falha (casa ocupada): tenta casas vizinhas dele, a mais próxima de quem anda primeiro
 const advance=(u,f)=>{const c=[[0,0],[-1,0],[1,0],[0,-1],[0,1],[-2,0],[2,0],[-1,-1],[1,1],[-1,1],[1,-1]].map(([dx,dy])=>({x:Math.round(f.x)+dx,y:Math.round(f.y)+dy})).sort((p,q)=>Math.hypot(p.x-u.x,p.y-u.y)-Math.hypot(q.x-u.x,q.y-u.y));for(const p of c)if(g.order(u,'move',p))return true;return false;};
 for(let i=0;i<30*240;i++){
  if(i%15===0)for(const u of g.units){
   if(u.hp<=0||UT(u).structure)continue;
   if(trucks.includes(u)){ // transporte: avança até ~8 casas do inimigo, desembarca e fica parado
    if(!u.cargo?.length)continue;const e=foes(u)[0];if(!e)continue;
    if(Math.hypot(e.x-u.x,e.y-u.y)<=8){if(u.pending||u.segment)g.order(u,'stop');else g.order(u,'disembark');}else if(!u.pending||u.order?.type!=='move')advance(u,e);
    continue;}
   if(u.order?.type!=='stop'&&u.pending)continue;
   const e=g.acquire(u);if(e){g.order(u,'attack',{targetId:e.id});continue;}
   if(!u.pending){const f=foes(u)[0];if(f)advance(u,f);}
  }
  g.update(1/30);
  if(!alive('blue')||!alive('red'))break;
 }
 // valor restante: unidades vivas + tropas ainda embarcadas, sobre o orçamento gasto (tropas + transportes)
 const v=side=>{const f=g.factions[side];return g.units.filter(u=>u.owner===side&&u.hp>0&&!UT(u).structure).concat(trucks.filter(t=>t.owner===side&&t.hp>0&&g.units.includes(t)).flatMap(t=>t.cargo||[])).reduce((a,u)=>a+SPEC(u.type,f).cost*u.hp/u.maxHp,0);};
 return {a:v('blue')/info.blue.spent,b:v('red')/info.red.spent,time:g.time,n:[info.blue.foot.length,info.blue.carriers,info.red.foot.length,info.red.carriers]};
}
if(TRANSPORT)for(const k of Object.keys(COMPOSITIONS))delete COMPOSITIONS[k];
if(TRANSPORT)for(const k of Object.keys(CARRIERS))COMPOSITIONS[k]=CARRIERS[k];
const fightAny=TRANSPORT?(fa,fb,t,seed)=>fightTransport(fa,fb,t,seed):fight;
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
