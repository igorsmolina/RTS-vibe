'use strict';
// Início e reinício de partida, CPU 4×: 10 partidas seguidas trocando mapa e modo, depois volta ao menu.
// Mede newOperation até o primeiro quadro e até groundReady (limitado a 15 s; 15000 = não terminou); heap, nós, listeners, timers pendentes e canvases não crescem.
const {open,metrics,suite,run}=require('./perf-kit.cjs');
const S=suite('restart');

run(async browser=>{
 const g=await open(browser,{viewport:{width:1280,height:800}}),{page}=g,samples=[];await g.throttle();
 const plan=[['river','rts'],['desert','turns'],['mountain','rts'],['random','turns'],['river','turns'],['desert','rts'],['mountain','turns'],['random','rts'],['river','rts'],['desert','turns']];
 for(const [i,[map,mode]] of plan.entries()){
  const r=await page.evaluate(async([map,mode,seed])=>{
   for(const d of document.querySelectorAll('dialog[open]'))d.close();const t0=performance.now();newOperation(map,'normal',seed,mode);const sync=performance.now()-t0;
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const first=performance.now()-t0;
   // Os blocos de zoom distante ficam prontos em segundo plano; com CPU 4× levam dezenas de segundos, então a espera é limitada a 15 s.
   const done=await Promise.race([renderer.groundReady.then(()=>true),new Promise(r=>setTimeout(()=>r(false),15000))]);const ready=done?performance.now()-t0:-1;
   for(let k=0;k<30;k++)game.update(STEP);renderer.consume();paused=true;return{sync,first,ready,timers:__timers.size,canvases:__canvases};
  },[map,mode,100+i]);
  const m=await metrics(g.cdp);samples.push({...r,...m});console.log(`  ${String(i+1).padStart(2)} ${map}/${mode}: newOperation ${r.sync.toFixed(0)} ms · 1º quadro ${r.first.toFixed(0)} ms · terreno pronto ${r.ready.toFixed(0)} ms · heap ${m.heapMB} MB · nós ${m.nodes} · listeners ${m.listeners} · timers ${r.timers} · canvases ${r.canvases}`);
 }
 const menu=await page.evaluate(async()=>{const t=performance.now();openTitle();await new Promise(r=>requestAnimationFrame(r));return performance.now()-t;});
 const a=samples[2],z=samples.at(-1),q=k=>Math.max(...samples.map(s=>s[k]));
 const s={newOperationMax:Math.round(q('sync')),firstFrameMax:Math.round(q('first')),groundReadyMax:samples.some(s=>s.ready<0)?15000:Math.round(q('ready')),menuMs:Math.round(menu),heapGrowthMB:Math.round((z.heapMB-a.heapMB)*100)/100,
  nodesGrowth:z.nodes-a.nodes,listenersGrowth:z.listeners-a.listeners,timersMax:q('timers'),canvasGrowth:Math.round((z.canvases-a.canvases)/(samples.length-3))};
 S.budget('10 partidas seguidas',s);
 S.expect(s.heapGrowthMB<=4,`heap cresceu ${s.heapGrowthMB} MB entre a 3ª e a 10ª partida`);S.expect(s.listenersGrowth<=10,`listeners cresceram ${s.listenersGrowth}`);
 S.target(s.nodesGrowth<=100,`nós DOM cresceram ${s.nodesGrowth}`);S.expect(s.timersMax<=12,`até ${s.timersMax} timers pendentes`);
 S.expect(g.errors.length===0,'erros JS: '+g.errors[0]);await g.close();
 S.finish('10 reinícios sem vazamento, com tempos de início medidos.');
});
