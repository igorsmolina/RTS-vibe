'use strict';
// Troca de velocidade em combate, CPU 4×: 0,25×, 0,5×, 1× e 2× pelo botão, 3 s cada. O custo do quadro acompanha os ticks por quadro
// e o tempo de jogo não acumula atraso: em cada trecho avança no máximo velocidade × tempo real (o quadro é limitado a 0,1 s).
const {open,frameStats,suite,run}=require('./perf-kit.cjs');
const S=suite('speed-change');

run(async browser=>{
 const g=await open(browser,{viewport:{width:1280,height:800}}),{page}=g;
 await page.evaluate(()=>{__army({blue:100,red:100,planes:8});cam.zoom=1;});await page.evaluate(()=>renderer.groundReady);await g.throttle();
 for(const target of [.25,.5,1,2]){
  const r=await page.evaluate(async target=>{while(speed!==target)$('speed').click();paused=false;const upd=__wrap(game,'update'),t0=game.time,w0=performance.now();
   const m=await __measure(3000);const wall=(performance.now()-w0)/1000;upd.restore();paused=true;return{m,advanced:game.time-t0,wall,ticks:upd.calls,tickMs:upd.ms/Math.max(1,upd.calls)};},target);
  const s={...frameStats(r.m),ticksPerFrame:Math.round(r.ticks/Math.max(1,r.m.frames.length+3)*10)/10,tickMs:Math.round(r.tickMs*10)/10,gameSeconds:Math.round(r.advanced*10)/10,wallSeconds:Math.round(r.wall*10)/10};
  S.budget(target+'×',s);S.expect(r.advanced<=target*r.wall+.2,`${target}×: o jogo avançou ${r.advanced.toFixed(1)} s em ${r.wall.toFixed(1)} s reais`);
 }
 S.expect(g.errors.length===0,'erros JS: '+g.errors[0]);await g.close();
 S.finish('troca de velocidade sem acúmulo de atraso.');
});
