'use strict';
// Minimapa sob carga, CPU 4×: 300 unidades em combate e arrasto real contínuo no minimapa (botão esquerdo).
// drawMini deve custar pouco e rodar no máximo uma vez por quadro.
const {open,frameStats,suite,run}=require('./perf-kit.cjs');
const S=suite('minimap-load');

run(async browser=>{
 const g=await open(browser,{viewport:{width:1280,height:800}}),{page}=g;
 await page.evaluate(()=>{__army();cam.zoom=1;});await page.evaluate(()=>renderer.groundReady);await g.throttle();
 const box=await page.evaluate(()=>{const r=$('minimap').getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height};});
 S.expect(box.w>0&&box.h>0,'minimapa visível');
 await page.evaluate(()=>{window.__mini=__wrap(renderer,'drawMini');speed=1;paused=false;});
 const pending=page.evaluate(()=>__measure(5000));await page.mouse.move(box.x+box.w*.2,box.y+box.h*.3);await page.mouse.down();
 for(let i=0;i<60;i++){const t=i/60;await page.mouse.move(box.x+box.w*(.2+.6*t),box.y+box.h*(.3+.4*Math.sin(t*6)));}
 await page.mouse.up();const m=await pending;
 const r=await page.evaluate(()=>{paused=true;__mini.restore();return{calls:__mini.calls,ms:__mini.ms};});
 const s={...frameStats(m),miniPerFrame:Math.round(r.calls/Math.max(1,m.frames.length+3)*10)/10,miniMs:Math.round(r.ms/Math.max(1,r.calls)*100)/100};S.budget('arrasto no minimapa com 300 unidades',s);
 S.expect(s.miniMs<=2*4,`drawMini custa ${s.miniMs} ms por chamada (CPU 4×)`);
 S.expect(g.errors.length===0,'erros JS: '+g.errors[0]);await g.close();
 S.finish('minimapa sob carga medido.');
});
