'use strict';
// Interface (DOM) sob carga, CPU 4×: updateUI com 1, 50 e 300 unidades selecionadas, com a base selecionada (painel de produção)
// e trocando a seleção a cada chamada. Mede tempo de script, layouts e recálculos de estilo por chamada (CDP) e nós DOM estáveis.
const {open,metrics,quantiles,suite,run}=require('./perf-kit.cjs');
const S=suite('ui-dom');

run(async browser=>{
 const g=await open(browser,{viewport:{width:1280,height:800}}),{page}=g;
 await page.evaluate(()=>{__army({blue:300,red:60,planes:0,attack:false});});await page.evaluate(()=>renderer.groundReady);await g.throttle();
 const base0=await metrics(g.cdp);
 for(const [name,pick] of [['1 selecionada','1'],['50 selecionadas','50'],['300 selecionadas','300'],['base com produção','hq'],['seleção trocando','toggle']]){
  const before=await metrics(g.cdp,false);
  const t=await page.evaluate(pick=>{const own=game.units.filter(u=>u.owner==='blue').map(u=>u.id),hq=game.hq('blue').id,sets={'1':own.slice(0,1),'50':own.slice(0,50),'300':own.slice(0,300),hq:[hq]};
   if(pick!=='toggle')setSelection(sets[pick]);const times=[];
   for(let i=0;i<60;i++){if(pick==='toggle')setSelection(i%2?sets['300']:sets['1']);const s=performance.now();updateUI();void document.body.offsetHeight;times.push(performance.now()-s);}return times;},pick);
  const after=await metrics(g.cdp,false),q=quantiles(t);
  const s={uiP50:q.p50,uiP95:q.p95,uiMax:q.max,layoutsPerCall:Math.round((after.layouts-before.layouts)/60*10)/10,stylesPerCall:Math.round((after.styles-before.styles)/60*10)/10,layoutMsPerCall:Math.round((after.layoutMs-before.layoutMs)/60*10)/10,nodes:after.nodes};
  S.budget(name,s);S.expect(s.layoutsPerCall<=2,`${name}: ${s.layoutsPerCall} layouts por updateUI`);
 }
 await page.evaluate(()=>setSelection([]));const end=await metrics(g.cdp);
 S.budget('nós DOM',{nodesGrowth:end.nodes-base0.nodes,listenersGrowth:end.listeners-base0.listeners});
 S.expect(end.nodes-base0.nodes<=100,`nós DOM cresceram ${end.nodes-base0.nodes}`);S.expect(end.listeners-base0.listeners<=10,`listeners cresceram ${end.listeners-base0.listeners}`);
 S.expect(g.errors.length===0,'erros JS: '+g.errors[0]);await g.close();
 S.finish('updateUI com seleções grandes, painel de produção e DOM estável.');
});
