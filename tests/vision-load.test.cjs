'use strict';
// Visão sob carga: 300 unidades em movimento, radares e aeronaves. updateVision no máximo 4 por tick no RTS (meta: 1) e custo por chamada.
const {battle,ticks,tickStats,quantiles,suite}=require('./perf-kit.cjs');
const S=suite('vision-load');
const g=battle({blue:150,red:150,planes:12});for(const u of g.units)if(u.type==='antiAirVehicle')try{g.setRadar(u,true);}catch{}
const original=g.updateVision,calls=[],cost=[];let tickCalls=0;g.updateVision=function(){tickCalls++;const t=performance.now();const r=original.call(this);cost.push(performance.now()-t);return r;};
const t=ticks(g,300,undefined,()=>{calls.push(tickCalls);tickCalls=0;});const c=quantiles(cost);
S.budget('300 unidades em movimento',{...tickStats(t),visionPerTickMax:Math.max(...calls),visionPerTickMean:Math.round(calls.reduce((a,b)=>a+b,0)/calls.length*100)/100,visionMs:c.mean,visionP95:c.p95});
S.expect(Math.max(...calls)<=4,`até ${Math.max(...calls)} passadas de visão num tick`);S.target(Math.max(...calls)<=1,`visão: até ${Math.max(...calls)} passadas num tick (meta: 1)`);
S.finish('visão agrupada sob carga.');
