'use strict';
// Voos longos no motor: transferências não buscam rota, a visão é agrupada, todos chegam no prazo e o custo por tick fica estável.
// Roda fora do vm de propósito: a medição de tempo reflete a velocidade real do motor.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Game,TYPES,AIR,PLANE}=new Function(fs.readFileSync(path.join(__dirname,'..','public','js','engine.js'),'utf8')+'\nreturn {Game,TYPES,AIR,PLANE};')();

function field(mode){
 const g=new Game('river','normal',123,mode,{posts:2});g.units=[];g.structures=[];g.projectiles=[];g.mines=[];g.actions=[];g.animation=null;g.terrain.fill('plain');g.aiEnabled=false;
 g.add('blue','hq',1,94);g.add('red','hq',126,1);g.rng=()=>.5;g.updateVision();return g;
}
// Dois esquadrões de 12 aviões cruzando o mapa de ponta a ponta, em faixas alternadas.
function squadrons(g,withRed){
 const planes=[];
 for(let i=0;i<12;i++){
  const y=6+i*7;
  planes.push({u:g.add('blue',i%2?'fighterBlue':'multiroleBlue',6,y),goal:{x:121,y:y+2}});
  if(withRed)planes.push({u:g.add('red',i%2?'fighterRed':'multiroleRed',121,y+3),goal:{x:6,y:y+5}});
 }
 return planes;
}
function instrument(g){
 const calls={updateVision:0,findPath:0,pathToRange:0,reachable:0};
 for(const name of Object.keys(calls)){const original=g[name];g[name]=function(...a){calls[name]++;return original.apply(this,a);};}
 return calls;
}
const percentile=(values,p)=>{const s=[...values].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(s.length*p))];};
const expectedTicks=planes=>Math.ceil(Math.max(...planes.map(({u,goal})=>Math.hypot(goal.x+4-u.x,goal.y-u.y)/TYPES[u.type].speed))*30);
const report={};

// RTS: 24 aviões voando ao mesmo tempo.
{
 const g=field('rts'),planes=squadrons(g,true);g.updateVision();const calls=instrument(g);
 for(const {u,goal} of planes){assert.ok(AIR(u)&&PLANE(u));assert.ok(g.order(u,'move',goal),'ordem de voo aceita');}
 const expected=expectedTicks(planes),limit=Math.ceil(expected*1.5)+90,ticks=[],visionPerTick=[];let tick=0;
 while(tick<limit&&planes.some(({u})=>u.flightJob?.type==='transfer')){
  const before=calls.updateVision,t=performance.now();g.update(1/30);ticks.push(performance.now()-t);visionPerTick.push(calls.updateVision-before);tick++;
 }
 const arrived=planes.every(({u})=>u.flightJob?.type!=='transfer');
 assert.ok(arrived,`todos chegam em ${limit} ticks (esperado ~${expected})`);
 assert.equal(calls.findPath+calls.pathToRange+calls.reachable,0,'voo de transferência não usa busca de rota');
 const result={ticks:tick,expected,meanMs:+(ticks.reduce((a,b)=>a+b,0)/ticks.length).toFixed(3),p95Ms:+percentile(ticks,.95).toFixed(3),maxMs:+Math.max(...ticks).toFixed(2),visionMean:+(visionPerTick.reduce((a,b)=>a+b,0)/visionPerTick.length).toFixed(2),visionMax:Math.max(...visionPerTick)};
 report.rts=result;
 assert.ok(result.visionMax<=2,'visão no máximo duas vezes por tick: '+result.visionMax);
 assert.ok(result.visionMean<=1.6,'visão em média até 1,6 por tick: '+result.visionMean);
 assert.ok(result.p95Ms<=15,'p95 do tick '+result.p95Ms+' ms');
}

// Por turnos: os 12 aviões azuis voam um de cada vez, uma ação por avião.
{
 const g=field('turns'),planes=squadrons(g,false);g.updateVision();const calls=instrument(g);
 for(const {u,goal} of planes)assert.ok(g.order(u,'move',goal,true),'ordem de voo aceita');
 const ticks=[],visionPerTick=[];let tick=0;
 while(g.busy&&tick<30000){const before=calls.updateVision,t=performance.now();g.update(1/30);ticks.push(performance.now()-t);visionPerTick.push(calls.updateVision-before);tick++;}
 assert.ok(!g.busy,'a execução termina');assert.ok(planes.every(({u})=>u.flightJob?.type!=='transfer'),'todos chegam');
 assert.equal(calls.findPath+calls.pathToRange+calls.reachable,0,'voo de transferência não usa busca de rota');
 const result={ticks:tick,meanMs:+(ticks.reduce((a,b)=>a+b,0)/ticks.length).toFixed(3),p95Ms:+percentile(ticks,.95).toFixed(3),maxMs:+Math.max(...ticks).toFixed(2),visionMean:+(visionPerTick.reduce((a,b)=>a+b,0)/visionPerTick.length).toFixed(2),visionMax:Math.max(...visionPerTick)};
 report.turns=result;
 assert.ok(result.visionMax<=2,'visão no máximo duas vezes por tick: '+result.visionMax);
 assert.ok(result.p95Ms<=15,'p95 do tick '+result.p95Ms+' ms');
}

// Um avião isolado em voo longo: o custo por tick não cresce com a distância percorrida.
{
 const g=field('rts'),p=g.add('blue','fighterBlue',6,48);g.updateVision();const early=[],late=[];g.order(p,'move',{x:121,y:48});
 for(let i=0;i<560&&p.flightJob?.type==='transfer';i++){const t=performance.now();g.update(1/30);(i<150?early:late).push(performance.now()-t);}
 const a=percentile(early,.5),b=percentile(late,.5);report.single={earlyMedianMs:+a.toFixed(3),lateMedianMs:+b.toFixed(3)};
 assert.ok(b<=Math.max(a*3,.5),`custo por tick estável ao longo do voo (${a.toFixed(3)} → ${b.toFixed(3)} ms)`);
}
console.log('Medições reais: '+JSON.stringify(report));
console.log('OK voos longos: sem busca de rota, visão agrupada, chegada no prazo e custo por tick estável em RTS e turnos.');
