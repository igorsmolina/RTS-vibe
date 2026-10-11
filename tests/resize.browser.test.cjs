'use strict';
// Redimensionar durante o combate, CPU 4×: 20 trocas de tamanho da janela. Cada troca repinta o terreno uma vez (ResizeObserver),
// sem crescer canvases nem heap. Tela cheia real exige gesto do usuário e não roda em headless; a troca de tamanho cobre o mesmo caminho.
const {open,frameStats,metrics,suite,run}=require('./perf-kit.cjs');
const S=suite('resize');

run(async browser=>{
 const g=await open(browser,{viewport:{width:1280,height:800}}),{page}=g;
 await page.evaluate(()=>{__army({blue:60,red:60,planes:6});cam.zoom=1;});await page.evaluate(()=>renderer.groundReady);
 await page.evaluate(()=>{speed=1;paused=false;window.__full=0;const paint=renderer.paintGroundCells;renderer.paintGroundCells=function(q,z,ox,oy,rects){if(rects.length===1&&rects[0][2]===renderer.canvas.width&&rects[0][3]===renderer.canvas.height)__full++;return paint.apply(this,arguments);};});
 const sizes=[[1280,800],[1600,900],[1024,640],[1920,1080],[1366,768]];
 // Um ciclo de aquecimento cria as camadas de cada tamanho.
 for(const [w,h] of sizes){await page.setViewportSize({width:w,height:h});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
 const before=await metrics(g.cdp),canvases=await page.evaluate(()=>[__canvases,__full]);await g.throttle();
 const pending=page.evaluate(()=>__measure(9000));
 for(let i=0;i<20;i++){const [w,h]=sizes[i%sizes.length];await page.setViewportSize({width:w,height:h});await page.waitForTimeout(300);}
 const m=frameStats(await pending);await g.throttle(1);
 const after=await metrics(g.cdp),[created,full]=await page.evaluate(([c,f])=>[__canvases-c,__full-f],canvases);
 const s={...m,resizes:20,fullRepaints:full,canvasGrowth:created,heapGrowthMB:Math.round((after.heapMB-before.heapMB)*100)/100,nodesGrowth:after.nodes-before.nodes};S.budget('20 trocas de tamanho em combate',s);
 S.expect(full<=20*2+4,`${full} repinturas completas para 20 trocas de tamanho`);S.expect(created<=4,`${created} canvases novos ao redimensionar`);
 S.expect(s.heapGrowthMB<=3,`heap cresceu ${s.heapGrowthMB} MB`);
 S.expect(g.errors.length===0,'erros JS: '+g.errors[0]);await g.close();
 S.finish('redimensionar em combate: uma repintura por troca, sem crescer canvases nem heap.');
});
