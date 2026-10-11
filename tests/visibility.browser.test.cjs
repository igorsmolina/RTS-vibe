'use strict';
// Aba oculta e retomada, CPU 4×: a página é congelada por 5 s (como uma aba em segundo plano) no meio do combate e volta.
// O jogo não pode processar o tempo perdido de uma vez (sem espiral de recuperação): o primeiro quadro avança no máximo 0,1 s
// de jogo por velocidade. Também pausa longa e retomada pelo botão.
const {open,frameStats,suite,run}=require('./perf-kit.cjs');
const S=suite('visibility');

run(async browser=>{
 const g=await open(browser,{viewport:{width:1280,height:800}}),{page}=g;
 await page.evaluate(()=>{__army({blue:100,red:100,planes:8});cam.zoom=1;});await page.evaluate(()=>renderer.groundReady);await g.throttle();
 await page.evaluate(()=>{speed=2;paused=false;});await page.waitForTimeout(1500);
 // Ocultar: o jogo pausa sozinho no visibilitychange; o congelamento simula o navegador parando a aba.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 const autoPaused=await page.evaluate(()=>paused);
 await g.cdp.send('Page.setWebLifecycleState',{state:'frozen'});await new Promise(r=>setTimeout(r,5000));await g.cdp.send('Page.setWebLifecycleState',{state:'active'});
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 const resume=await page.evaluate(async()=>{const t0=game.time;togglePause();const m=await __measure(3000,null,{warmup:1});return{m,first:m.frames.slice(0,3),advanced:game.time-t0,speed};});
 const s={...frameStats(resume.m),firstFrame:Math.round(Math.max(...resume.first)),gameSecondsIn3s:Math.round(resume.advanced*10)/10};S.budget('aba oculta 5 s e volta',s);
 S.expect(autoPaused,'sair da aba deve pausar');S.expect(resume.advanced<=3*2+.5,`o jogo avançou ${resume.advanced.toFixed(1)} s em 3 s reais a 2× (recuperação acumulada)`);
 S.expect(Math.max(...resume.first)<=s.p95*1.5+20,`primeiros quadros após voltar (${resume.first.map(Math.round).join(', ')} ms) bem acima do p95 ${s.p95} ms`);
 const pause=await page.evaluate(async()=>{paused=true;await new Promise(r=>setTimeout(r,4000));const t0=game.time;paused=false;const m=await __measure(2000,null,{warmup:0});return{m,advanced:game.time-t0};});
 S.budget('pausa longa e retomada',{...frameStats(pause.m),firstFrame:Math.round(pause.m.frames[0]||0),gameSecondsIn2s:Math.round(pause.advanced*10)/10});
 S.expect(pause.advanced<=2*2+.5,`depois da pausa o jogo avançou ${pause.advanced.toFixed(1)} s em 2 s reais`);
 S.expect(g.errors.length===0,'erros JS: '+g.errors[0]);await g.close();
 S.finish('aba oculta e pausa longa retomam sem recuperar o tempo perdido.');
});
