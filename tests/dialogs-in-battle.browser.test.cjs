'use strict';
// Menus durante o combate, CPU 4×: abre e fecha manual, ajustes, perfil e preparação 20 vezes com a batalha rodando.
// Sem pico acima do normal e com nós DOM e listeners voltando ao valor inicial.
const {open,frameStats,metrics,suite,run}=require('./perf-kit.cjs');
const S=suite('dialogs-in-battle');

run(async browser=>{
 const g=await open(browser,{viewport:{width:1280,height:800}}),{page}=g;
 await page.evaluate(()=>{__army({blue:100,red:100,planes:8});cam.zoom=1;});await page.evaluate(()=>renderer.groundReady);
 // Um ciclo de aquecimento cria o conteúdo de cada menu.
 const cycle=()=>page.evaluate(async()=>{for(const [openIt,id] of [[()=>openMenu('manual'),'manual'],[()=>openSettings(),'settings'],[()=>openProfile(),'profile'],[()=>openSetup(),'setup']]){openIt();await new Promise(r=>requestAnimationFrame(r));closeChild(id);for(const d of document.querySelectorAll('dialog[open]'))d.close();await new Promise(r=>requestAnimationFrame(r));}});
 await cycle();const before=await metrics(g.cdp);await g.throttle();
 const still=frameStats(await page.evaluate(()=>{speed=1;paused=false;return __measure(3000);}));S.budget('combate sem menus',still);
 const pending=page.evaluate(()=>__measure(12000));for(let i=0;i<5;i++){await cycle();await page.evaluate(()=>{paused=false;});}const m=frameStats(await pending);
 await page.evaluate(()=>{paused=true;});await g.throttle(1);const after=await metrics(g.cdp);
 const s={...m,nodesGrowth:after.nodes-before.nodes,listenersGrowth:after.listeners-before.listeners,heapGrowthMB:Math.round((after.heapMB-before.heapMB)*100)/100};S.budget('20 aberturas de menu em combate',s);
 S.target(m.longTaskMax<=Math.max(100,still.longTaskMax*1.3),`abrir menus gerou tarefa de ${m.longTaskMax} ms (sem menus: ${still.longTaskMax} ms)`);
 S.expect(s.nodesGrowth<=60&&s.listenersGrowth<=10,`DOM cresceu: ${s.nodesGrowth} nós, ${s.listenersGrowth} listeners`);
 S.expect(g.errors.length===0,'erros JS: '+g.errors[0]);await g.close();
 S.finish('menus em combate sem picos nem vazamento de DOM.');
});
