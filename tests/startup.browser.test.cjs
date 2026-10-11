'use strict';
// Abertura a frio com CPU 4× desde o início: navegador sem cache até DOMContentLoaded, load, terrainReady, battlefieldReady
// e o primeiro quadro de uma partida nova até groundReady. Lista as tarefas longas do carregamento.
const path=require('node:path'),{pathToFileURL}=require('node:url');
const {root,launch,suite,THROTTLE}=require('./perf-kit.cjs');
const S=suite('startup');

(async()=>{const browser=await launch();try{
 for(const run of [1,2]){
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await context.setOffline(true);
  await page.addInitScript(()=>{window.__longTasks=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__longTasks.push(Math.round(e.duration));}).observe({type:'longtask',buffered:true});}catch{}});
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Emulation.setCPUThrottlingRate',{rate:THROTTLE});
  const t0=Date.now();await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});const dom=Date.now()-t0;
  await page.waitForLoadState('load');const load=Date.now()-t0;await page.evaluate(()=>terrainReady);const terrain=Date.now()-t0;await page.evaluate(()=>typeof battlefieldReady==='undefined'?null:battlefieldReady);const battle=Date.now()-t0;
  const op=await page.evaluate(async()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();const t=performance.now();newOperation('river','normal',3,'rts');const sync=performance.now()-t;
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const first=performance.now()-t;
   // Blocos de zoom distante em segundo plano: espera limitada a 20 s (20000 = não terminou).
   const done=await Promise.race([renderer.groundReady.then(()=>true),new Promise(r=>setTimeout(()=>r(false),20000))]);return{sync,first,ready:done?performance.now()-t:20000,tasks:__longTasks};});
  const s={domMs:dom,loadMs:load,terrainReadyMs:terrain,battlefieldReadyMs:battle,newOperationMs:Math.round(op.sync),firstFrameMs:Math.round(op.first),groundReadyMs:Math.round(op.ready),longTasks:op.tasks.length,longTaskMax:Math.max(0,...op.tasks)};
  S.budget(run===1?'abertura a frio':'segunda abertura',s);if(op.tasks.length)console.log('  tarefas longas (ms): '+op.tasks.join(', '));
  S.expect(errors.length===0,'erros JS: '+errors[0]);await context.close();
 }
 S.finish('tempos de abertura e da primeira partida medidos com CPU 4×.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
