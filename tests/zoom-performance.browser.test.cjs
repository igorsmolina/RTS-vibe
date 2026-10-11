'use strict';
// Zoom contínuo com CPU 4×: rolagem de roda de 1 e 3 eventos por quadro (mouse e trackpad), cursor no centro e na borda,
// e ctrl+roda por entrada real (pinça). Cada quadro com mudança de zoom repinta o terreno no máximo uma vez.
const {open,frameStats,suite,run}=require('./perf-kit.cjs');
const S=suite('zoom-performance');

run(async browser=>{
 const g=await open(browser),{page}=g;
 await page.evaluate(()=>{__army({blue:60,red:60,planes:6,attack:false});cam.zoom=1;centerCamera(60,40);});await page.evaluate(()=>renderer.groundReady);
 // Aquece os tiles em todos os níveis de zoom do percurso.
 await page.evaluate(()=>{for(let i=0;i<12;i++){cam.zoom=Math.max(.35,1.5/1.15**i);centerCamera(60,40);renderer.draw(0);}cam.zoom=1;centerCamera(60,40);renderer.draw(0);});
 await g.throttle();
 for(const [name,perFrame,where] of [['roda 1/quadro, centro',1,'center'],['roda 3/quadro, centro',3,'center'],['roda 3/quadro, borda',3,'edge']]){
  const r=await page.evaluate(async([perFrame,where])=>{
   cam.zoom=1;centerCamera(60,40);renderer.draw(0);const canvas=renderer.canvas,rect=canvas.getBoundingClientRect(),x=rect.left+(where==='edge'?30:rect.width/2),y=rect.top+(where==='edge'?40:rect.height/2);
   const paint=renderer.paintGroundCells;let full=0;renderer.paintGroundCells=function(q,z,ox,oy,rects){if(rects.length===1&&rects[0][2]===canvas.width&&rects[0][3]===canvas.height)full++;return paint.apply(this,arguments);};
   const mini=__wrap(renderer,'drawMini');let zooms=0,lastZoom=cam.zoom;
   const m=await __measure(2000,i=>{if(cam.zoom!==lastZoom)zooms++;lastZoom=cam.zoom;
    const dir=Math.floor(i/6)%2?1:-1;for(let k=0;k<perFrame;k++)canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:dir*100,clientX:x,clientY:y,bubbles:true,cancelable:true}));});
   delete renderer.paintGroundCells;mini.restore();
   return{m,zooms,fullRepaints:full,miniPerFrame:Math.round(mini.calls/Math.max(1,m.frames.length)*10)/10};
  },[perFrame,where]);
  const s={...frameStats(r.m),zoomFrames:r.zooms,fullRepaints:r.fullRepaints,miniPerFrame:r.miniPerFrame};S.budget(name,s);
  S.expect(r.fullRepaints<=r.zooms+2,`${name}: ${r.fullRepaints} repinturas completas para ${r.zooms} quadros com zoom novo`);
  S.expect(s.canvasesCreated<=2,`${name}: ${s.canvasesCreated} canvases criados com cache quente`);
 }
 // Pinça de trackpad: ctrl+roda real.
 const v=await page.evaluate(()=>{cam.zoom=1;centerCamera(60,40);renderer.draw(0);const r=renderer.canvas.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};});
 await page.mouse.move(v.x,v.y);await page.keyboard.down('Control');
 const pending=page.evaluate(()=>__measure(2000));for(let i=0;i<24;i++)await page.mouse.wheel(0,(Math.floor(i/6)%2?1:-1)*40);
 const pinch=frameStats(await pending);await page.keyboard.up('Control');S.budget('ctrl+roda real (pinça)',pinch);
 S.expect(await page.evaluate(()=>cam.zoom>=.35&&cam.zoom<=1.5),'zoom dentro dos limites');
 S.expect(g.errors.length===0,'erros JS: '+g.errors[0]);await g.close();
 S.finish('zoom contínuo: no máximo uma repintura por quadro, sem canvases novos, com CPU 4×.');
});
