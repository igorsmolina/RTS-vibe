'use strict';
// Custo de um quadro com a câmera parada, por camada, com CPU 4×: 0, 50, 150 e 300 unidades visíveis. Terreno, entidades, efeitos,
// ambiente, régua, radar, máscara de visão, minimapa e updateUI medidos separadamente; o resto do desenho fica em "outros".
// Também compara os perfis gráficos e o movimento reduzido com 150 unidades: Desempenho e movimento reduzido nunca custam mais que Equilibrado.
const {open,quantiles,suite,run}=require('./perf-kit.cjs');
const S=suite('frame-breakdown');

const measure=async(page,[n,graphics])=>page.evaluate(([n,graphics])=>{
 for(const d of document.querySelectorAll('dialog[open]'))d.close();settings.graphics=graphics;newOperation('river','normal',12,'rts');game.aiEnabled=false;paused=true;
 cam.zoom=.6;centerCamera(64,48);const v=viewCells(),kinds=['infantry','tank','antitank','recon','helicopter','artillery','antiAirVehicle','machinegun'];let placed=0;
 for(let y=v.y0+2;y<v.y1-2&&placed<n;y++)for(let x=v.x0+2;x<v.x1-2&&placed<n;x+=1){try{if(game.add(placed%2?'red':'blue',kinds[placed%kinds.length],x,y))placed++;}catch{}}
 game.visible.blue.fill(true);game.sky.blue.fill(true);setSelection(game.units.filter(u=>u.owner==='blue').slice(0,20).map(u=>u.id));renderer.consume();
 return placed;},[n,graphics]).then(async placed=>{
 await page.evaluate(()=>renderer.groundReady);
 return page.evaluate(placed=>{
  for(let i=0;i<10;i++)renderer.draw(1/30);
  const parts={ground:[renderer,'drawGround'],entities:[renderer,'entity'],fxGround:[renderer.fx,'ground'],fx:[renderer.fx,'draw'],environment:[renderer,'environment'],vision:[renderer,'visionMasks'],rulers:[renderer,'drawRulers'],radar:[renderer,'drawRadar'],mini:[renderer,'drawMini'],ui:[window,'updateUI']};
  const w=Object.fromEntries(Object.entries(parts).map(([k,[o,name]])=>[k,__wrap(o,name)])),total=[],N=60;
  for(let i=0;i<N;i++){game.time+=1/30;const t=performance.now();renderer.draw(1/30);total.push(performance.now()-t);if(i%4===0){renderer.drawMini();updateUI();}}
  const per=k=>Math.round(w[k].ms/N*100)/100,out={units:placed};for(const k of Object.keys(parts))out[k+'Ms']=per(k);for(const s of Object.values(w))s.restore();
  total.sort((a,b)=>a-b);out.drawP50=Math.round(total[N>>1]*100)/100;out.drawP95=Math.round(total[Math.floor(N*.95)]*100)/100;
  // "outros" = desenho total menos as camadas embrulhadas que ocorrem dentro de draw (névoa, seleção, projéteis, partículas, textos).
  out.othersMs=Math.round((total.reduce((a,b)=>a+b,0)/N-['ground','entities','fxGround','fx','environment','vision','rulers','radar'].reduce((a,k)=>a+w[k].ms/N,0))*100)/100;
  return out;},placed);});

run(async browser=>{
 const g=await open(browser,{viewport:{width:1280,height:800}}),{page}=g;await g.throttle();const by={};
 for(const n of [0,50,150,300]){const r=await measure(page,[n,'balanced']);by[n]=r;S.budget(n+' unidades, equilibrado',r);}
 S.expect(by[300].units>=280,`só ${by[300].units} unidades visíveis`);
 const ratio=Math.round((by[300].drawP50-by[0].drawP50)/Math.max(.1,by[50].drawP50-by[0].drawP50)*10)/10;S.budget('curva de entidades',{ratio300to50:ratio});
 S.expect(ratio<=7,`o custo das entidades cresce mais que linear: 300 unidades = ${ratio}× o custo de 50`);
 const profiles={};for(const profile of ['cinematic','performance']){profiles[profile]=await measure(page,[150,profile]);S.budget('150 unidades, '+profile,profiles[profile]);}
 S.expect(profiles.performance.drawP50<=by[150].drawP50*1.1+1,`Desempenho (${profiles.performance.drawP50} ms) mais caro que Equilibrado (${by[150].drawP50} ms)`);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>reducedMotion);
 const reduced=await measure(page,[150,'balanced']);S.budget('150 unidades, movimento reduzido',reduced);
 S.expect(reduced.drawP50<=by[150].drawP50*1.1+1,`movimento reduzido (${reduced.drawP50} ms) mais caro que o normal (${by[150].drawP50} ms)`);
 S.expect(g.errors.length===0,'erros JS: '+g.errors[0]);await g.close();
 S.finish('custo por camada com a câmera parada, de 0 a 300 unidades, e perfis gráficos.');
});
