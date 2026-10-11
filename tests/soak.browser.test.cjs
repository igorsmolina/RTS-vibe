'use strict';
// Sessão longa: 15 min de jogo simulado em RTS com IA ligada, reforços contínuos e câmera passeando pelo mapa.
// A cada minuto mede heap, nós DOM, canvases, timers e o tamanho de todos os caches e listas; o custo de desenho do último
// minuto não pode crescer em relação ao 2º. Sem throttle: aqui o alvo é vazamento, não velocidade. RTS_SOAK_MINUTES muda a duração.
const {open,quantiles,metrics,suite,run}=require('./perf-kit.cjs');
const S=suite('soak'),MINUTES=Number(process.env.RTS_SOAK_MINUTES)||15;

run(async browser=>{
 const g=await open(browser,{viewport:{width:1280,height:800}}),{page}=g,samples=[];
 await page.evaluate(()=>{__army({blue:60,red:60,planes:8,ai:true});cam.zoom=.8;});await page.evaluate(()=>renderer.groundReady);
 for(let minute=1;minute<=MINUTES;minute++){
  const r=await page.evaluate(minute=>{
   // Reforços e QGs intactos mantêm o combate vivo pelos 15 minutos.
   for(const s of game.structures)if(s.type==='hq')s.hp=s.maxHp;game.winner=null;
   const kinds=['infantry','tank','antitank','artillery','antiAirVehicle','helicopter','recon','machinegun'];
   for(const owner of ['blue','red'])for(let i=0,n=game.units.filter(u=>u.owner===owner).length;n<50&&i<400;i++){try{if(game.add(owner,kinds[i%kinds.length],owner==='blue'?30+i%10*2:84+i%10*2,10+Math.floor(i/10)*3)){n++;}}catch{}}
   game.updateVision();for(const u of game.units)if(u.owner==='blue'&&u.order.type==='stop')game.order(u,'attackMove',{x:100,y:48},true);
   const draws=[];for(let i=0;i<900;i++){
    game.update(STEP);game.update(STEP);renderer.consume();
    const a=(minute*900+i)/900*Math.PI*2;cam.x=(COLS*CELL/2)*(1+.7*Math.cos(a))-500;cam.y=(ROWS*CELL/2)*(1+.6*Math.sin(a*1.3))-350;clampCamera();
    const t=performance.now();renderer.draw(STEP*2);draws.push(performance.now()-t);if(i%4===0){updateUI();renderer.drawMini();}
   }
   const fx=renderer.fx;
   return{draws,sizes:{terrainTiles:terrainTiles.size,materialTiles:materialTiles.size,terrainMasks:terrainMasks.size,roadOverlays:roadOverlays.size,sprites:sprites.size,lighting:renderer.lighting.size,
    fxArt:Object.keys(fx.art||{}).length,fxCache:Object.keys(fx.cache||{}).length,fxParticles:fx.particles.length,fxCap:fx.profile().particles,fxTrails:fx.trails?.size??0,fxMarks:fx.marks?.length??0,wrecks:fx.wrecks?.length??0,
    particles:renderer.particles.length,texts:renderer.texts.length,events:game.events.length,logs:game.logs.length,projectiles:game.projectiles.length,fires:game.fires.length,aiQueue:game.aiQueue.length,units:game.units.length,
    timers:__timers.size,canvases:__canvases}};
  },minute);
  const m=await metrics(g.cdp),d=quantiles(r.draws);samples.push({minute,...m,drawP50:d.p50,drawP95:d.p95,...r.sizes});
  console.log(`  min ${String(minute).padStart(2)}: heap ${m.heapMB} MB · nós ${m.nodes} · listeners ${m.listeners} · canvases ${r.sizes.canvases} · tiles ${r.sizes.terrainTiles} · sprites ${r.sizes.sprites} · desenho p95 ${d.p95} ms · unidades ${r.sizes.units}`);
 }
 const second=samples[Math.min(1,samples.length-1)],last=samples.at(-1);
 const s={heapGrowthMB:Math.round((last.heapMB-second.heapMB)*100)/100,nodesGrowth:last.nodes-second.nodes,listenersGrowth:last.listeners-second.listeners,
  canvasGrowth:last.canvases-samples.at(-2)?.canvases||0,drawP95First:second.drawP95,drawP95Last:last.drawP95,timers:last.timers,heapMB:last.heapMB};
 S.budget('15 min RTS',s);
 S.expect(s.heapGrowthMB<=8,`heap cresceu ${s.heapGrowthMB} MB do 2º ao último minuto`);
 S.expect(s.nodesGrowth<=200&&s.listenersGrowth<=20,`DOM cresceu: ${s.nodesGrowth} nós, ${s.listenersGrowth} listeners`);
 S.expect(last.drawP95<=second.drawP95*1.2+3,`desenho p95 ${last.drawP95} ms no fim contra ${second.drawP95} ms no 2º minuto`);
 for(const [k,cap] of Object.entries({terrainTiles:4096,sprites:512,texts:60,particles:640,events:0,logs:70,fxArt:40,timers:12}))S.expect(Math.max(...samples.map(x=>x[k]))<=cap,`${k} chegou a ${Math.max(...samples.map(x=>x[k]))} (teto ${cap})`);
 S.expect(samples.every(x=>x.fxParticles<=x.fxCap),'partículas do FX acima do limite do perfil');
 for(const k of ['materialTiles','terrainMasks','roadOverlays','lighting','fxCache'])S.expect(last[k]<=second[k]*1.5+16,`${k} não para de crescer: ${second[k]} → ${last[k]}`);
 S.results.amostras=samples;S.expect(g.errors.length===0,'erros JS: '+g.errors[0]);await g.close();
 S.finish(`sessão de ${MINUTES} min: heap, DOM, canvases, caches e custo de desenho estáveis.`);
});
