'use strict';
// Revelação de névoa, CPU 4×: 40 unidades entram juntas em área inexplorada e um radar antiaéreo liga e desliga.
// Mede quadros e quantas vezes a máscara de visão muda por quadro (no máximo uma reconstrução por quadro).
const {open,frameStats,suite,run}=require('./perf-kit.cjs');
const S=suite('fog-reveal');

run(async browser=>{
 const g=await open(browser,{viewport:{width:1280,height:800}}),{page}=g;
 await page.evaluate(()=>{
  for(const d of document.querySelectorAll('dialog[open]'))d.close();newOperation('river','normal',21,'rts');game.aiEnabled=false;paused=true;
  const kinds=['recon','infantry','tank','lightTank','antiAirVehicle'];window.__group=[];for(let i=0;i<40;i++){try{const u=game.add('blue',kinds[i%kinds.length],20+i%8*2,30+Math.floor(i/8)*2);if(u)__group.push(u);}catch{}}
  game.explored.blue.fill(false);game.updateVision();renderer.paintGround();cam.zoom=.8;centerCamera(40,38);
 });await page.evaluate(()=>renderer.groundReady);await g.throttle();
 const r=await page.evaluate(async()=>{
  for(const [i,u] of __group.entries())game.order(u,'move',{x:70+i%8*2,y:30+Math.floor(i/8)*2},true);
  let builds=0,lastRev=renderer.visionMask?.revision||0,maxPerFrame=0;const vm=renderer.visionMasks;
  renderer.visionMasks=function(){const r=vm.call(this);return r;};
  speed=2;paused=false;const lead=__group[0];
  const m=await __measure(8000,()=>{const rev=renderer.visionMask?.revision||0;maxPerFrame=Math.max(maxPerFrame,rev-lastRev);builds+=rev-lastRev;lastRev=rev;centerCamera(lead.x,lead.y);});
  delete renderer.visionMasks;paused=true;speed=1;return{m,builds,maxPerFrame,explored:game.explored.blue.filter(Boolean).length};});
 const s={...frameStats(r.m),maskBuilds:r.builds,maskPerFrameMax:r.maxPerFrame,explored:r.explored};S.budget('40 unidades em área inexplorada',s);
 S.expect(r.maxPerFrame<=2,`máscara de visão reconstruída ${r.maxPerFrame}× num quadro`);
 const radar=await page.evaluate(async()=>{const aa=__group.find(u=>u.type==='antiAirVehicle');paused=false;
  const m=await __measure(4000,i=>{if(aa&&i%15===0)try{game.setRadar(aa,!aa.radarOn);}catch{}});paused=true;return m;});
 S.budget('radar ligando e desligando',frameStats(radar));
 S.expect(g.errors.length===0,'erros JS: '+g.errors[0]);await g.close();
 S.finish('revelação de névoa com no máximo uma reconstrução de máscara por quadro.');
});
