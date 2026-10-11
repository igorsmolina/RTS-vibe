'use strict';
// Combate pesado com câmera em movimento, CPU 4×: 300 tropas e 12 jatos em marcha de ataque, câmera seguindo um avião
// ou um tanque a cada quadro, 1× e 2×, perfis Equilibrado e Cinematográfico. Todos os fatores juntos.
const {open,frameStats,metrics,suite,run}=require('./perf-kit.cjs');
const S=suite('heavy-combat-camera');

run(async browser=>{
 for(const [name,follow,rate,graphics] of [['tanque, 1×, equilibrado','tank',1,'balanced'],['avião, 1×, equilibrado','plane',1,'balanced'],['avião, 2×, equilibrado','plane',2,'balanced'],['tanque, 2×, cinematográfico','tank',2,'cinematic']]){
  const g=await open(browser,{viewport:{width:1440,height:900}}),{page}=g;
  const units=await page.evaluate(graphics=>{settings.graphics=graphics;const n=__army();cam.zoom=1;return n;},graphics);await page.evaluate(()=>renderer.groundReady);
  S.expect(units>=300,`${name}: ${units} unidades`);await g.throttle();
  const r=await page.evaluate(async([follow,rate])=>{
   const leader=game.units.find(u=>u.owner==='blue'&&(follow==='plane'?TYPES[u.type].plane:TYPES[u.type].tank));let peak={projectiles:0,particles:0};
   const upd=__wrap(game,'update'),ui=__wrap(window,'updateUI'),cons=__wrap(renderer,'consume');speed=rate;paused=false;
   const m=await __measure(6000,()=>{if(leader.hp>0){const p=follow==='plane'&&typeof flightPose==='function'?flightPose(leader):leader;centerCamera(p.x,p.y);renderer.drawMini();}
    peak.projectiles=Math.max(peak.projectiles,game.projectiles.length);peak.particles=Math.max(peak.particles,renderer.fx.particles.length+renderer.particles.length);});
   paused=true;speed=1;const n=Math.max(1,m.frames.length+3),per=w=>Math.round(w.ms/n*10)/10;upd.restore();ui.restore();cons.restore();
   return{m,peak,alive:game.units.length,split:{engineMsPerFrame:per(upd),uiMsPerFrame:per(ui),consumeMsPerFrame:per(cons),ticksPerFrame:Math.round(upd.calls/n*10)/10}};
  },[follow,rate]);
  const s={...frameStats(r.m),...(await metrics(g.cdp)),peakProjectiles:r.peak.projectiles,peakParticles:r.peak.particles,...r.split};S.budget(name,s);
  S.expect(r.peak.projectiles>0,`${name}: o combate deve acontecer (nenhum projétil)`);
  S.expect(g.errors.length===0,`${name}: erros JS ${g.errors[0]}`);await g.close();
 }
 S.finish('combate pesado com câmera seguindo, 1× e 2×, com CPU 4×.');
});
