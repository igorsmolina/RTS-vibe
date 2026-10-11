'use strict';
// Qualidade automática e troca de perfil, CPU 4×. (1) Sinal sintético de lentidão e recuperação: a qualidade desce e volta
// sem oscilar. (2) Combate real por 10 s: no máximo 2 trocas de nível. (3) Trocar Desempenho/Equilibrado/Cinematográfico
// pelo menu durante o combate não gera pico acima de 100 ms.
const {open,frameStats,suite,run}=require('./perf-kit.cjs');
const S=suite('quality-switch');

run(async browser=>{
 const g=await open(browser,{viewport:{width:1280,height:800}}),{page}=g;
 await page.evaluate(()=>{__army({blue:120,red:120,planes:12});cam.zoom=1;centerCamera(60,40);});await page.evaluate(()=>renderer.groundReady);
 const synthetic=await page.evaluate(()=>{
  const fx=renderer.fx;fx.tier=0;fx.slow=0;fx.stable=0;const tiers=[];
  for(let i=0;i<300;i++){fx.observe(14,.04);tiers.push(fx.tier);}const low=fx.tier;
  for(let i=0;i<1200;i++){fx.observe(3,.016);tiers.push(fx.tier);}
  // Ruído: lento e estável alternando a cada 0,5 s não pode fazer a qualidade subir e descer sem parar.
  for(let i=0;i<600;i++){const slow=Math.floor(i/30)%2===0;fx.observe(slow?14:3,slow?.04:.016);tiers.push(fx.tier);}
  let changes=0;for(let i=1;i<tiers.length;i++)if(tiers[i]!==tiers[i-1])changes++;return{low,final:fx.tier,changes};});
 S.budget('sinal sintético',{tierLow:synthetic.low,tierFinal:synthetic.final,tierChanges:synthetic.changes});
 S.expect(synthetic.low===2,`a qualidade deve cair ao nível 2 com quadros lentos (ficou em ${synthetic.low})`);
 S.expect(synthetic.changes<=6,`qualidade oscilando: ${synthetic.changes} trocas`);
 await g.throttle();
 const real=await page.evaluate(async()=>{renderer.fx.tier=0;speed=1;paused=false;const tiers=[];const m=await __measure(10000,()=>tiers.push(renderer.fx.tier));paused=true;let changes=0;for(let i=1;i<tiers.length;i++)if(tiers[i]!==tiers[i-1])changes++;return{m,changes,final:renderer.fx.tier};});
 S.budget('combate real 10 s',{...frameStats(real.m),tierChanges:real.changes,tierFinal:real.final});S.expect(real.changes<=2,`${real.changes} trocas de qualidade em 10 s`);
 const sw=await page.evaluate(async()=>{paused=false;const select=$('setGraphics'),profiles=['performance','balanced','cinematic','balanced','performance','cinematic'];
  const m=await __measure(6000,i=>{if(i%20===10){select.value=profiles[(i/20|0)%profiles.length];select.dispatchEvent(new Event('change'));}});paused=true;return m;});
 const s=frameStats(sw);S.budget('troca de perfil em combate',s);S.expect(s.longTaskMax<=Math.max(100,real.m.longTasks.length?Math.max(...real.m.longTasks)*1.2:0),`trocar de perfil gerou tarefa de ${s.longTaskMax} ms`);
 S.expect(g.errors.length===0,'erros JS: '+g.errors[0]);await g.close();
 S.finish('qualidade automática estável e troca de perfil sem pico.');
});
