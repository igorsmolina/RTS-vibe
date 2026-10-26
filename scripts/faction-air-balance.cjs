'use strict';
// Equilíbrio dos aviões por facção (Verde 'blue', Vermelho 'red', Azul/França 'franca'): custo-benefício analítico + duelos simulados.
// Alvo de projeto: Verde > Vermelho >= França, com a França a ~15% do Vermelho em eficácia por crédito.
// Uso: node scripts/faction-air-balance.cjs [--seeds 60] [--md saida.md] [--json saida.json] [--titulo "Antes"]
//   --partes ar,bomb   quais simulações rodar (padrão: ambas)   --papeis caca,multi,furtivo,bombardeiro   filtra papéis
//   --engine caminho/engine.js   mede outra versão do motor (ex.: o engine.js do commit anterior)
//   --so-franca   pula o par Verde×Vermelho (só pares com a França)
//   --so-roxo     mede o Roxo no lugar da França: pares Roxo×Verde e Roxo×Vermelho, veredito com colunas P/R e P/V
//   --set fighterFr.hp=150,multiroleFr.ammo.jetAgm=2   simula uma ficha alternativa sem editar o motor (custo recalculado)
const fs=require('node:fs'),path=require('node:path');
const names='Game,TYPES,AIR,FRANCE,ROXO,AMMO_PRICE'.split(',');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d;};
const E=new Function(fs.readFileSync(arg('engine',path.join(__dirname,'..','public','js','engine.js')),'utf8')+'\nreturn {'+names.map(n=>n+':typeof '+n+"==='undefined'?undefined:"+n).join(',')+'};')(); // motores antigos (--engine) não têm ROXO
const {Game,TYPES,AIR,FRANCE,ROXO,AMMO_PRICE}=E;
const SET=arg('set','');
for(const kv of SET.split(',').filter(Boolean)){const [k,v]=kv.split('='),ks=k.split('.');let o=TYPES;for(const x of ks.slice(0,-1))o=o[x];o[ks.at(-1)]=+v;const t=TYPES[ks[0]];t.cost=t.hull+Object.entries(t.ammo).reduce((n,[w,q])=>n+AMMO_PRICE[w]*q,0);}
const SEEDS=+arg('seeds',60),PARTES=arg('partes','ar,bomb').split(','),FAC={verde:'blue',vermelho:'red',franca:FRANCE,roxo:ROXO};
// Terceira facção medida: França (padrão) ou Roxo (--so-roxo). X = chave, XN = nome, XL = letra do veredito.
const SO_ROXO=process.argv.includes('--so-roxo'),X=SO_ROXO?'roxo':'franca',XN=SO_ROXO?'Roxo':'França',XL=SO_ROXO?'P':'F';delete FAC[SO_ROXO?'franca':'roxo'];
const ROLES={
 caca:{nome:'Caça',verde:'fighterBlue',vermelho:'fighterRed',franca:'fighterFr',roxo:'fighterRoxo'},
 multi:{nome:'Multifunção',verde:'multiroleBlue',vermelho:'multiroleRed',franca:'multiroleFr',roxo:'multiroleRoxo'},
 furtivo:{nome:'Caça furtivo',verde:'stealthFighterBlue',vermelho:'stealthFighterRed',franca:'stealthFighterFr',roxo:'stealthFighterRoxo'},
 bombardeiro:{nome:'Bombardeiro',verde:'bomberBlue',vermelho:'bomberRed',franca:'bomberFr',roxo:'bomberRoxo'}
};
const PAPEIS=arg('papeis','caca,multi,furtivo,bombardeiro').split(',');
const FRACOES=[1,.5,.25];
const PAIRS=[['verde','vermelho'],['franca','verde'],['franca','vermelho'],['roxo','verde'],['roxo','vermelho']].filter(p=>p.every(k=>k in FAC)&&(!process.argv.includes('--so-franca')||p.includes('franca'))&&(!SO_ROXO||p.includes('roxo')));
const f1=n=>n.toFixed(1),f2=n=>n.toFixed(2),f3=n=>n.toFixed(3),pct=n=>(100*n).toFixed(0)+'%';

function field(factions,seed){
 const g=new Game('river','normal',seed,'rts',{posts:2},{},{},null,factions);
 g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.actions=[];g.animation=null;g.projectiles=[];g.memory.blue.clear();g.memory.red.clear();g.intel.clear();g.aiEnabled=false;
 g.add('blue','hq',1,90);g.add('red','hq',120,2);for(const s of ['blue','red'])g.explored[s].fill(true);g.updateVision();return g;
}
const step=(g,n=1)=>{for(let i=0;i<n;i++){g.update(1/30);g.events=[];}};

/* ---------- 1. Análise analítica (funções do próprio motor) ---------- */
const REF_EVASION=.25; // evasão média do elenco, usada como alvo-padrão aéreo
function analitico(type){
 const t=TYPES[type],g=field({blue:t.team,red:t.team==='red'?'blue':'red'},1);
 const a=g.add('blue',type,50,50),air=g.add('red','fighterBlue',50,65),tank=g.add('red','tank',50,55),aav=g.add('red','antiAirVehicle',50,56);
 let aa=0,solo=0;
 for(const [w,q] of Object.entries(t.ammo)){
  if(w==='jetGun'||!q)continue;
  const s=g.planeWeapon(a,w);
  if(w==='jetAam'){aa+=q*s.damage*g.accuracy(a,air,w)*(1-REF_EVASION);continue;}
  if(w==='antiRadiation'){aa+=0;solo+=q*s.damage*g.accuracy(a,aav,w);continue;}
  solo+=q*s.damage*g.accuracy(a,tank,w)*(w==='jetAgm'?1.5:1);
 }
 const dano=aa+solo,ehp=t.hp/(1-t.evasion),cost=t.cost;
 return {type,team:t.team,cost,hp:t.hp,speed:t.speed,evasion:t.evasion,flares:t.flares,dmgAA:aa,dmgSolo:solo,dano,
  danoPorCredito:dano/cost,hpPorCredito:t.hp/cost,ehpPorCredito:ehp/cost,indice:Math.sqrt(dano*ehp)/cost*100};
}

/* ---------- 2. Duelos ar-ar ---------- */
function duelo(tipoA,facA,tipoB,facB,seed,trocar){
 // A joga pelo lado azul e B pelo vermelho; com trocar=true os lados se invertem (descarta viés de lado).
 const lados=trocar?['red','blue']:['blue','red'],fac={};fac[lados[0]]=facA;fac[lados[1]]=facB;
 const g=field(fac,seed),off=(seed%5)-2;
 const a=g.add(lados[0],tipoA,50+off,50),b=g.add(lados[1],tipoB,50-off,61);
 a.facing=Math.PI/2;b.facing=-Math.PI/2;g.updateVision();
 const hp0=[a.hp,b.hp];
 for(let i=0;i<60*30&&g.get(a.id)&&g.get(b.id);i++){
  if(i%9===0)for(const [p,q] of [[a,b],[b,a]])if(g.get(p.id)&&AIR(p)&&!p.pending)g.order(p,'attack',{targetId:q.id,weapon:'auto',salvo:p.ammo.jetAam>=2?2:1});
  step(g);
 }
 for(let n=0;n<300&&g.projectiles.length;n++)step(g); // mísseis já lançados ainda resolvem
 const vivo=[!!g.get(a.id),!!g.get(b.id)],frac=[vivo[0]?Math.min(1,Math.max(0,a.hp)/hp0[0]):0,vivo[1]?Math.min(1,Math.max(0,b.hp)/hp0[1]):0];// veterania pode elevar a vida acima da inicial: limita em 100%
 const custo=[TYPES[tipoA].cost,TYPES[tipoB].cost];
 const placar=vivo[0]&&!vivo[1]?1:!vivo[0]&&vivo[1]?0:.5;
 return {placar,perdaA:(1-frac[0])*custo[0],perdaB:(1-frac[1])*custo[1]};
}
function serieAr(tipoA,facA,tipoB,facB){
 let w=0,pa=0,pb=0,n=0;
 for(let s=1;s<=SEEDS;s++)for(const trocar of [false,true]){const r=duelo(tipoA,facA,tipoB,facB,s,trocar);w+=r.placar;pa+=r.perdaA;pb+=r.perdaB;n++;}
 // troca = valor (créditos) destruído no adversário / valor perdido por si
 const vit=w/n,troca=pb/Math.max(1,pa),v=Math.min(.98,Math.max(.02,vit)),porCredito=v/(1-v)*TYPES[tipoB].cost/TYPES[tipoA].cost;
 // eficácia por crédito de A sobre B = média geométrica de (vitórias por crédito) e (troca de valor); 1 = equivalentes
 return {n,vitoria:vit,troca,porCredito,eficacia:Math.sqrt(porCredito*troca),perdaA:pa/n,perdaB:pb/n};
}

/* ---------- 3. Bombardeiro contra defesa antiaérea de custo igual ---------- */
// Defesa: metade do orçamento em veículos antiaéreos e metade em soldados lançadores, espalhada em torno do alvo, da facção defensora.
function bombardeio(tipo,facDef,seed,fracao){
 const t=TYPES[tipo],fb=t.team,g=field({blue:fb,red:facDef},seed),orc=t.cost*fracao,cx=50,cy=20;
 const b=g.add('blue',tipo,cx,82);b.facing=-Math.PI/2;
 const nA=Math.round(orc*.5/TYPES.antiAirVehicle.cost),nM=Math.round(orc*.5/TYPES.missileInfantry.cost),ds=[];
 for(let i=0;i<nA;i++)ds.push(g.add('red','antiAirVehicle',cx-4+(i%4)*3,cy+Math.floor(i/4)*3));
 for(let i=0;i<nM;i++)ds.push(g.add('red','missileInfantry',cx-4+(i%5)*2,cy+2+Math.floor(i/5)*2));
 const ds0=ds.map(d=>({u:d,hp:d.hp})),hp0=b.hp;g.updateVision();
 let soltas=0;const total0=Object.entries(b.ammo).reduce((n,[w,q])=>n+(/^bomb/.test(w)||w==='cruiseMissile'?q:0),0);
 for(let i=0;i<150*30&&g.get(b.id);i++){
  if(i%9===0&&!b.pending&&AIR(b)){
   const bombas=['bombCommon','bombFragment','bombIncendiary'].reduce((n,w)=>n+b.ammo[w],0),cap=[48,24,12,6].find(c=>c<=bombas);
   if(b.ammo.cruiseMissile>0&&b.cooldown<=1e-8)g.order(b,'strikeCell',{x:cx,y:cy+2,weapon:'cruiseMissile'});
   else if(!b.ammo.cruiseMissile&&cap)g.order(b,'bombRun',{start:{x:cx-5,y:cy+2},end:{x:cx+5,y:cy+2},bombCount:cap});
   else if(!b.ammo.cruiseMissile&&!cap)break;
  }
  step(g);
 }
 for(let n=0;n<400&&g.projectiles.length;n++)step(g);
 const vivo=!!g.get(b.id),restante=Object.entries(b.ammo).reduce((n,[w,q])=>n+(/^bomb/.test(w)||w==='cruiseMissile'?q:0),0);
 const destruido=ds0.reduce((n,d)=>n+(g.get(d.u.id)?(1-d.u.hp/d.hp):1)*TYPES[d.u.type].cost,0),perda=(vivo?1-b.hp/hp0:1)*t.cost;
 return {vivo,usadas:(total0-restante)/total0,destruido,perda,liquido:(destruido-perda)/t.cost,defesa:ds0.reduce((n,d)=>n+TYPES[d.u.type].cost,0)};
}
function serieBomb(tipo,facDef,fracao){
 let n=0,v=0,d=0,p=0,u=0,l=0,win=0;
 for(let s=1;s<=SEEDS;s++){const r=bombardeio(tipo,facDef,s,fracao);n++;v+=r.vivo;d+=r.destruido;p+=r.perda;u+=r.usadas;l+=r.liquido;win+=r.liquido>0;}
 return {n,sobrevive:v/n,destruido:d/n,perda:p/n,usadas:u/n,liquidoPorCredito:l/n,vitoria:win/n};
}

/* ---------- Execução e relatório ---------- */
const titulo=arg('titulo','Medição'),out=[],P=s=>out.push(s);
const lista=[];for(const r of Object.values(ROLES))for(const k of Object.keys(FAC))lista.push(analitico(r[k]));
const A=Object.fromEntries(lista.map(x=>[x.type,x]));
P('## '+titulo+'\n');
P('### Análise analítica (funções do motor: dano de `planeWeapon`, precisão de `accuracy`, evasão-padrão '+REF_EVASION+')\n');
P('Dano esperado = soma por arma de munição × dano × precisão (antiar-ar contra caça com evasão '+REF_EVASION+'; antirradiação contra antiaéreo; antiblindado ×1,5 contra tanque; cruzeiro e bombas contra tanque). Índice = √(dano × (vida/(1−evasão)))/custo × 100.\n');
P('| Modelo | Facção | Custo | Vida | Vel. | Evasão | Flares | Dano ar-ar | Dano solo | Dano/crédito | Vida/crédito | Vida efet./crédito | Índice |');P('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for(const [rk,r] of Object.entries(ROLES))for(const k of Object.keys(FAC)){const x=A[r[k]];P(`| ${x.type} | ${k} | ${x.cost} | ${x.hp} | ${x.speed} | ${x.evasion} | ${x.flares} | ${f1(x.dmgAA)} | ${f1(x.dmgSolo)} | ${f3(x.danoPorCredito)} | ${f3(x.hpPorCredito)} | ${f3(x.ehpPorCredito)} | ${f1(x.indice)} |`);}
P(`\nRazão do índice analítico por papel (alvo: Verde > Vermelho ≥ ${XN}, ${XN} ≥ 0,85 × Vermelho):\n`);
P(`| Papel | Verde/Vermelho | ${XN}/Vermelho | ${XN}/Verde | Custo ${SO_ROXO?'P':'FR'}/Verde |`);P('|---|---:|---:|---:|---:|');
const veredito=[];
for(const [rk,r] of Object.entries(ROLES)){const v=A[r.verde],m=A[r.vermelho],f=A[r[X]];P(`| ${r.nome} | ${f2(v.indice/m.indice)} | ${f2(f.indice/m.indice)} | ${f2(f.indice/v.indice)} | ${f2(f.cost/v.cost)} |`);veredito.push({rk,analitico:f.indice/m.indice});}

P('\n### Duelos 1×1 no ar (caça, multifunção, furtivo), '+SEEDS+' sementes × 2 lados = '+2*SEEDS+' duelos por par\n');
P('Vitória = 1 se só o oponente cai, 0,5 se ambos vivos/mortos. Troca = valor em créditos destruído no oponente (fração de vida perdida × custo) ÷ valor perdido por si. Vit./crédito = razão de vitórias normalizada pelo custo. Eficácia = √(vit./crédito × troca); > 1 favorece o primeiro, 1 = equivalentes por crédito.\n');
P('| Papel | Par (1º × 2º) | Custos | Vitória 1º | Troca 1º/2º | Eficácia 1º/2º |');P('|---|---|---|---:|---:|---:|');
const duelos={};
for(const rk of ['caca','multi','furtivo'].filter(r=>PAPEIS.includes(r))){const r=ROLES[rk];duelos[rk]={};if(PARTES.includes('ar'))for(const [x,y] of PAIRS){const s=serieAr(r[x],FAC[x],r[y],FAC[y]);duelos[rk][x+'x'+y]=s;P(`| ${r.nome} | ${x} × ${y} | ${A[r[x]].cost} × ${A[r[y]].cost} | ${pct(s.vitoria)} | ${f2(s.troca)} | ${f2(s.eficacia)} |`);}}

P('\n### Bombardeiro contra defesa antiaérea terrestre\n');
P('Cada bombardeiro lança primeiro os mísseis de cruzeiro (fora do alcance da defesa) e depois uma passada de bombas sobre o grupo. Defesa = veículos antiaéreos + soldados lançadores da facção defensora, orçamento = fração do custo do bombardeiro (100% = custo igual). Líquido/crédito = (valor destruído − valor perdido do bombardeiro) ÷ custo do bombardeiro; vitória = líquido > 0.\n');
P('| Bombardeiro | Defesa | Orçamento | Sobrevive | Munição gasta | Valor destruído | Líquido/crédito | Vitória |');P('|---|---|---:|---:|---:|---:|---:|---:|');
const bomb={};
for(const fracao of PARTES.includes('bomb')&&PAPEIS.includes('bombardeiro')?FRACOES:[])for(const k of Object.keys(FAC)){bomb[k+'@'+fracao]={};for(const d of Object.keys(FAC)){const s=serieBomb(ROLES.bombardeiro[k],FAC[d],fracao);bomb[k+'@'+fracao][d]=s;P(`| ${ROLES.bombardeiro[k]} | ${d} | ${pct(fracao)} | ${pct(s.sobrevive)} | ${pct(s.usadas)} | ${Math.round(s.destruido)} | ${f2(s.liquidoPorCredito)} | ${pct(s.vitoria)} |`);}}
const B=PARTES.includes('bomb')&&PAPEIS.includes('bombardeiro'),mediaB={};
if(B){P('\nRetorno por crédito = 1 + líquido/crédito (valor destruído + o que sobra do bombardeiro, ÷ custo), média contra as três defesas:\n');
P('| Bombardeiro | Defesa 100% | Defesa 50% | Defesa 25% |');P('|---|---:|---:|---:|');
for(const k of Object.keys(FAC)){mediaB[k]={};for(const f of FRACOES)mediaB[k][f]=1+Object.values(bomb[k+'@'+f]).reduce((n,s)=>n+s.liquidoPorCredito,0)/3;P(`| ${ROLES.bombardeiro[k]} | ${FRACOES.map(f=>f2(mediaB[k][f])).join(' | ')} |`);}}

// Veredito: ordem Verde > Vermelho >= França e França a até 15% do Vermelho em eficácia por crédito.
// Eficácia por crédito de A contra B: caça e furtivo = eficácia do duelo (média geométrica de vitórias por crédito e troca de valor);
// multifunção = média geométrica da eficácia aérea com a razão de dano ao solo por crédito (o Vermelho paga por munição que o duelo não usa);
// bombardeiro = razão do retorno por crédito contra a defesa de metade do custo.
P('\n### Veredito\n');
P(`Eficácia por crédito (razão): V/R = Verde ÷ Vermelho, ${XL}/R = ${XN} ÷ Vermelho, ${XL}/V = ${XN} ÷ Verde. Meta: V/R > 1, 0,85 ≤ ${XL}/R ≤ 1,05, ${XL}/V < 1.\n`);
P(`| Papel | Medida | V/R | ${XL}/R | ${XL}/V | Verde > Vermelho | ${XN} ≤ 1,05 × Vermelho | ${XN} ≥ 0,85 × Vermelho |`);P('|---|---|---:|---:|---:|---|---|---|');
const sim=b=>b?'sim':'NÃO',solo=(r,k)=>A[ROLES[r][k]].dmgSolo/A[ROLES[r][k]].cost,veredicto={};
for(const rk of Object.keys(duelos)){const d=duelos[rk],t=(a,b)=>d[a+'x'+b]?.eficacia;
 const f=rk==='multi'?(tr,a,b)=>Math.sqrt(tr*solo(rk,a)/solo(rk,b)):tr=>tr;
 const vr=f(t('verde','vermelho')??NaN,'verde','vermelho'),fr=f(t(X,'vermelho'),X,'vermelho'),fv=f(t(X,'verde'),X,'verde'); // fr/fv = terceira facção ÷ Vermelho/Verde
 veredicto[rk]={vr,fr,fv};P(`| ${ROLES[rk].nome} | ${rk==='multi'?'√(eficácia aérea × dano solo/crédito)':'eficácia do duelo'} | ${f2(vr)} | ${f2(fr)} | ${f2(fv)} | ${sim(vr>1)} | ${sim(fr<=1.05)} | ${sim(fr>=.85)} |`);}
if(B){const m=mediaB,vr=m.verde[.5]/m.vermelho[.5],fr=m[X][.5]/m.vermelho[.5],fv=m[X][.5]/m.verde[.5];veredicto.bombardeiro={vr,fr,fv};P(`| Bombardeiro | retorno por crédito (defesa 50%) | ${f2(vr)} | ${f2(fr)} | ${f2(fv)} | ${sim(vr>1)} | ${sim(fr<=1.05)} | ${sim(fr>=.85)} |`);}

const md=out.join('\n')+'\n';console.log(md);
if(arg('md'))fs.writeFileSync(arg('md'),md);
if(arg('json'))fs.writeFileSync(arg('json'),JSON.stringify({titulo,seeds:SEEDS,analitico:lista,duelos,bombardeiro:bomb,veredicto},null,1));
