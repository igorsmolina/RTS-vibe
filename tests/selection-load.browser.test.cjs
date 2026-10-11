'use strict';
// Seleção sob carga, CPU 4×: caixa de seleção real sobre 300 unidades, hover sobre as tropas e seleção/desseleção repetidas.
// O quadro durante o arrasto da caixa não pode ser muito mais lento que o quadro parado.
const {open,frameStats,suite,run}=require('./perf-kit.cjs');
const S=suite('selection-load');

run(async browser=>{
 const g=await open(browser,{viewport:{width:1280,height:800}}),{page}=g;
 await page.evaluate(()=>{__army({blue:150,red:150,planes:0,attack:false});cam.zoom=.5;centerCamera(46,46);});await page.evaluate(()=>renderer.groundReady);await g.throttle();
 const area=await page.evaluate(()=>{const r=renderer.canvas.getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height};});
 const still=frameStats(await page.evaluate(()=>__measure(2500,()=>{renderer.dirty=true;})));S.budget('parado',still);
 const pending=page.evaluate(()=>__measure(5000,()=>{renderer.dirty=true;}));
 for(let k=0;k<3;k++){await page.mouse.move(area.x+30,area.y+40);await page.mouse.down();for(let i=0;i<25;i++)await page.mouse.move(area.x+30+(area.w-80)*i/24,area.y+40+(area.h-120)*i/24);await page.mouse.up();await page.keyboard.press('Escape');}
 const drag=frameStats(await pending),selected=await page.evaluate(()=>selection.size);S.budget('caixa de seleção',drag);
 const hover=page.evaluate(()=>__measure(3000,()=>{renderer.dirty=true;}));for(let i=0;i<60;i++)await page.mouse.move(area.x+area.w*(.2+.6*Math.random()),area.y+area.h*(.2+.6*Math.random()));
 const h=frameStats(await hover);S.budget('hover sobre as tropas',h);
 const toggle=frameStats(await page.evaluate(()=>{const ids=game.units.filter(u=>u.owner==='blue').map(u=>u.id);return __measure(3000,i=>setSelection(i%2?ids:ids.slice(0,1)));}));S.budget('selecionar 150 / 1 alternando',toggle);
 S.expect(drag.p95<=still.p95+10*4,`caixa de seleção: p95 ${drag.p95} ms contra ${still.p95} ms parado`);
 S.expect(selected===0||selected>=1,'seleção concluída');
 S.expect(g.errors.length===0,'erros JS: '+g.errors[0]);await g.close();
 S.finish('seleção, caixa e hover com 300 unidades.');
});
