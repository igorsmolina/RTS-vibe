'use strict';
// Escala do motor: ticks RTS com 50, 100, 200, 400 e 800 unidades em marcha de ataque e combate (IA desligada).
// A curva de custo do tick deve ser quase linear: 800 unidades custam no máximo 10× o tick de 100 (pega O(n²)).
const {battle,ticks,tickStats,suite}=require('./perf-kit.cjs');
const S=suite('engine-scaling'),curve={};
for(const n of [50,100,200,400,800]){
 const g=battle({blue:n/2,red:n/2,planes:Math.min(12,n/20)});ticks(g,30);
 const s={units:g.units.length,...tickStats(ticks(g,300))};curve[n]=s;S.budget(n+' unidades',s);
}
const ratio=Math.round(curve[800].tickP50/Math.max(.01,curve[100].tickP50)*10)/10;S.budget('curva',{ratio800to100:ratio});
S.expect(curve[800].units>=700,`só ${curve[800].units} unidades couberam no mapa`);
S.target(ratio<=10,`custo cresce mais que linear: tick com 800 = ${ratio}× o de 100`);
S.target(curve[400].tickP99<=16,`p99 do tick com 400 unidades: ${curve[400].tickP99} ms`);
S.finish('escala do motor: custo do tick quase linear de 50 a 800 unidades.');
