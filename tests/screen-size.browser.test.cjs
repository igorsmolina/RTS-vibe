'use strict';
// Telas grandes e DPR alto, CPU 4×: arrasto de câmera a 3000 px/s em 1280×720, 1920×1080 e 2560×1440 com DPR 1, 1,5 e 2.
// Mede o ritmo, casas repintadas por quadro contra a faixa exposta e a memória das camadas de canvas do campo.
const {open,frameStats,suite,run}=require('./perf-kit.cjs');
const S=suite('screen-size');

run(async browser=>{
 for(const [w,h] of [[1280,720],[1920,1080],[2560,1440]])for(const dpr of [1,1.5,2]){
  const name=`${w}×${h} DPR ${dpr}`,g=await open(browser,{viewport:{width:w,height:h},dpr}),{page}=g;
  await page.evaluate(()=>{__army({blue:40,red:40,planes:4,attack:false});cam.zoom=1;centerCamera(40,40);});await page.evaluate(()=>renderer.groundReady);
  await page.evaluate(()=>{for(let i=0;i<40;i++){cam.x+=60;clampCamera();renderer.draw(0);}for(let i=0;i<40;i++){cam.x-=60;clampCamera();renderer.draw(0);}});await g.throttle();
  const r=await page.evaluate(async()=>{
   const cells=__wrap(window,'drawTerrainCell'),per=[];let last=0,dir=1,lastNow=performance.now();
   const m=await __measure(2500,(i,now)=>{per.push(cells.calls-last);last=cells.calls;const step=3000*Math.min(.1,(now-lastNow)/1000)/cam.zoom;lastNow=now;const before=cam.x;cam.x+=dir*step;clampCamera();if(cam.x===before)dir=-dir;renderer.dirty=true;});
   cells.restore();const v=viewCells(),full=(v.x1-v.x0)*(v.y1-v.y0),layers=[renderer.canvas,renderer.terrainView,renderer.terrainBack].filter(Boolean).reduce((a,c)=>a+c.width*c.height*4,0);
   return{m,full,cellsPerFrame:per.length?per.reduce((a,b)=>a+b,0)/per.length:0,layerMB:layers/1048576};
  });
  const s={...frameStats(r.m),cellsPerFrame:Math.round(r.cellsPerFrame),fullCells:r.full,layerMB:Math.round(r.layerMB*10)/10};S.budget(name,s);
  S.expect(r.cellsPerFrame<=r.full*.35,`${name}: ${Math.round(r.cellsPerFrame)} casas por quadro de ${r.full} (repintura quase completa)`);
  S.expect(r.layerMB<=3*w*h*dpr*dpr*4/1048576+1,`${name}: ${r.layerMB.toFixed(1)} MB em camadas, mais de três telas`);
  S.expect(g.errors.length===0,`${name}: erros JS ${g.errors[0]}`);await g.close();
 }
 S.finish('arrasto em telas de 720p a 1440p com DPR 1 a 2, sem repintura completa.');
});
