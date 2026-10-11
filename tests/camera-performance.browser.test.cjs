'use strict';
// Câmera: contadores determinísticos de casas repintadas, equivalência de pixels contra uma repintura completa,
// entrada real (botão do meio, borda, roda) e ritmo de quadros com CPU 4× mais lenta.
// RTS_PUBLIC=<pasta public> permite medir outra cópia do jogo (por exemplo, a anterior à correção) com o mesmo teste.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
const root=process.env.RTS_PUBLIC?path.resolve(process.env.RTS_PUBLIC):path.join(__dirname,'..','public'),artifacts=path.join(__dirname,'artifacts');
fs.mkdirSync(artifacts,{recursive:true});
// RTS_REPORT_ONLY=1 registra as falhas em vez de interromper, para comparar medições de outra cópia.
const soft=!!process.env.RTS_REPORT_ONLY,failures=[],report={root,dpr:{},failures};
const expect=(ok,message)=>{if(ok)return;if(soft)failures.push(message);else assert.fail(message);};

async function open(browser,dpr,width=1100,height=700){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await context.setOffline(true);
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.evaluate(()=>terrainReady);await page.evaluate(()=>typeof battlefieldReady==='undefined'?null:battlefieldReady);
 await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();newOperation('river','normal',19,'rts');paused=true;game.aiEnabled=false;game.explored.blue.fill(true);game.visible.blue.fill(true);updateUI();});
 await page.evaluate(()=>renderer.groundReady);
 return{context,page,errors};
}

// Quantas casas cada quadro repinta e quantos canvases cria. Contagem exata, sem relógio.
const counters=()=>{
 const dtc=window.drawTerrainCell,create=document.createElement.bind(document);let cells=0,canvases=0;
 window.drawTerrainCell=function(...a){cells++;return dtc.apply(this,a);};document.createElement=function(...a){if(a[0]==='canvas')canvases++;return create(...a);};
 const frame=()=>{const c0=cells;renderer.draw(0);return cells-c0;};
 // Casas de uma repintura completa na câmera atual: medida de verdade, forçando a repintura.
 const fullCount=()=>{const c0=cells;renderer.terrainViewKey=null;renderer.draw(0);return cells-c0;};
 const scenario=(zoom,step,frames)=>{cam.zoom=zoom;centerCamera(64,48);renderer.draw(0);canvases=0;const per=[];for(let i=0;i<frames;i++){step(i);per.push(frame());}const canvasesDuring=canvases,full=fullCount();return{zoom,full,perFrame:per,max:Math.max(...per),canvases:canvasesDuring};};
 const out=[];
 try{
  for(const zoom of [1.5,1,.7]){
   out.push({kind:'static',dx:0,dy:0,...scenario(zoom,()=>{},6)});
   out.push({kind:'drag-x',dx:40,dy:0,...scenario(zoom,()=>{cam.x+=40/cam.zoom;},20)});
   out.push({kind:'drag-y',dx:0,dy:40,...scenario(zoom,()=>{cam.y+=40/cam.zoom;},12)});
   out.push({kind:'diagonal',dx:40,dy:30,...scenario(zoom,()=>{cam.x+=40/cam.zoom;cam.y+=30/cam.zoom;},12)});
   out.push({kind:'drag-x-back',dx:-40,dy:0,...scenario(zoom,()=>{cam.x-=40/cam.zoom;},20)});
   // Salto (minimapa, botão QG): uma repintura completa; depois, câmera parada.
   cam.zoom=zoom;centerCamera(20,20);renderer.draw(0);let c0=cells;centerCamera(100,70);renderer.draw(0);const jump=cells-c0;c0=cells;renderer.draw(0);
   const afterJump=cells-c0;out.push({kind:'jump',zoom,full:fullCount(),perFrame:[jump,afterJump],max:jump,canvases:0});
   // Passo de zoom: uma repintura completa e nada depois.
   cam.zoom=zoom;centerCamera(64,48);renderer.draw(0);c0=cells;cam.zoom=zoom>1.4?zoom/1.15:zoom*1.15;clampCamera();renderer.draw(0);const stepCells=cells-c0;c0=cells;renderer.draw(0);
   const afterStep=cells-c0;out.push({kind:'zoom-step',zoom,full:fullCount(),perFrame:[stepCells,afterStep],max:stepCells,canvases:0});
  }
 }finally{window.drawTerrainCell=dtc;document.createElement=create;}
 return out;
};

// Soma de verificação e diferença máxima entre o terreno incremental e uma repintura completa na mesma câmera.
const equivalence=({dpr})=>{
 const px=cv=>cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let seed=7;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};const out=[];
 for(const zoom of [1.5,1,.7,.5]){
  cam.zoom=zoom;centerCamera(64,48);renderer.terrainViewKey=null;renderer.draw(0);let frames=0,mismatched=0,maxDelta=0,worstFraction=0;
  for(let i=0;i<24;i++){
   cam.x+=(rnd()-.5)*(i%6===0?600:150);cam.y+=(rnd()-.5)*(i%5===0?450:110);clampCamera();renderer.draw(0);
   const inc=Uint8ClampedArray.from(px(renderer.terrainView));renderer.terrainViewKey=null;renderer.draw(0);const full=px(renderer.terrainView);
   let diff=0;for(let k=0;k<inc.length;k+=4){const d=Math.max(Math.abs(inc[k]-full[k]),Math.abs(inc[k+1]-full[k+1]),Math.abs(inc[k+2]-full[k+2]));if(d){diff++;if(d>maxDelta)maxDelta=d;}}
   frames++;if(diff){mismatched++;worstFraction=Math.max(worstFraction,diff/(inc.length/4));}
  }
  out.push({zoom,exactScale:Number.isInteger(CELL*zoom*dpr),frames,mismatched,maxDelta,worstFraction});
 }
 return out;
};

(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const dpr of [1,2]){
  const {context,page,errors}=await open(browser,dpr);
  // 1. Contadores
  const counted=await page.evaluate(counters);report.dpr[dpr]={counters:counted.map(({perFrame,...rest})=>({...rest,mean:+(perFrame.reduce((a,b)=>a+b,0)/perFrame.length).toFixed(1)}))};
  for(const r of counted){
   const cs=56*r.zoom,label=`dpr ${dpr} zoom ${r.zoom} ${r.kind}`;
   expect(r.canvases===0,label+': nenhum canvas novo ao mover em área já vista');
   if(r.kind==='static')expect(r.max===0,label+': câmera parada não repinta casas');
   else if(r.kind==='jump'||r.kind==='zoom-step'){expect(r.perFrame[0]>=r.full*.8&&r.perFrame[0]<=r.full*1.15,label+': uma repintura completa ('+r.perFrame[0]+' de '+r.full+')');expect(r.perFrame[1]===0,label+': quadro seguinte sem repintura');}
   else{
    const rows=Math.ceil(700/cs)+2,cols=Math.ceil(1100/cs)+2,bound=(r.dx?(Math.ceil((Math.abs(r.dx)+6)/cs)+1)*rows:0)+(r.dy?(Math.ceil((Math.abs(r.dy)+6)/cs)+1)*cols:0);
    expect(r.max<=bound,`${label}: casas repintadas por quadro ${r.max} > faixa exposta + margem (${bound})`);
    expect(r.max<r.full*.6,`${label}: ${r.max} casas de ${r.full} da repintura completa`);
   }
  }
  // 2. Equivalência de pixels
  const eq=await page.evaluate(equivalence,{dpr});report.dpr[dpr].equivalence=eq;
  for(const r of eq){
   const label=`dpr ${dpr} zoom ${r.zoom}`;
   if(r.exactScale)expect(r.maxDelta===0,label+': escala inteira deve ser idêntica à repintura completa');
   // Em escala fracionária o deslocamento de um raster difere em poucos pixels isolados (arredondamento da GPU), sem acumular.
   else{expect(r.maxDelta<=12,label+': diferença máxima '+r.maxDelta);expect(r.worstFraction<=.001,label+': fração de pixels diferentes '+r.worstFraction);}
  }
  // 3. Entrada real: botão do meio, borda e roda, contando as casas por quadro desenhado
  const rect=await page.evaluate(()=>{const r=renderer.canvas.getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height};}),cx=rect.x+rect.w/2,cy=rect.y+rect.h/2;
  const instrument=()=>page.evaluate(()=>{window.__c={frames:0,cells:0,max:0,start:0};const dtc=window.drawTerrainCell,draw=renderer.draw;window.__restore=()=>{window.drawTerrainCell=dtc;renderer.draw=draw;};
   window.drawTerrainCell=function(...a){__c.cells++;return dtc.apply(this,a);};renderer.draw=function(...a){const c0=__c.cells;const r=draw.apply(this,a);__c.frames++;__c.max=Math.max(__c.max,__c.cells-c0);return r;};});
  const finish=()=>page.evaluate(()=>{__restore();const v=viewCells();return{...__c,full:(v.x1-v.x0)*(v.y1-v.y0)};});
  const frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>r())));
  await page.evaluate(()=>{cam.zoom=1;centerCamera(20,48);renderer.draw(0);});
  await instrument();await page.mouse.move(cx+200,cy);await page.mouse.down({button:'middle'});
  for(let i=0;i<30;i++){await page.mouse.move(cx+200-i*18,cy+Math.sin(i/4)*20);await frame();}
  await page.mouse.up({button:'middle'});const middle=await finish();
  expect(middle.frames>=20,'frames desenhados no arrasto: '+middle.frames);
  expect(middle.cells/middle.frames<middle.full*.45,`dpr ${dpr} botão do meio: ${(middle.cells/middle.frames).toFixed(0)} casas por quadro de ${middle.full}`);
  await page.evaluate(()=>{cam.zoom=1;centerCamera(8,48);renderer.draw(0);});await instrument();await page.mouse.move(rect.x+rect.w-4,cy);await page.waitForTimeout(700);
  const edge=await finish();await page.mouse.move(cx,cy);
  expect(edge.frames>=10,'quadros na rolagem pela borda: '+edge.frames);expect(await page.evaluate(()=>cam.x)>8*56-1,'a câmera deve rolar pela borda');
  expect(edge.cells/edge.frames<edge.full*.45,`dpr ${dpr} borda: ${(edge.cells/edge.frames).toFixed(0)} casas por quadro de ${edge.full}`);
  await page.evaluate(()=>{cam.zoom=1;centerCamera(64,48);renderer.draw(0);});await instrument();await page.mouse.move(cx,cy);await page.mouse.wheel(0,-120);await frame();await frame();await frame();
  const wheel=await finish();expect(await page.evaluate(()=>cam.zoom>1),'a roda deve aproximar');expect(wheel.cells<=wheel.full*1.15,`dpr ${dpr} roda: no máximo uma repintura completa (${wheel.cells} de ${wheel.full})`);
  report.dpr[dpr].input={middle:{...middle,perFrame:+(middle.cells/middle.frames).toFixed(1)},edge:{...edge,perFrame:+(edge.cells/edge.frames).toFixed(1)},wheel};
  // 4. Ritmo com CPU 4×: arrasto contra câmera parada
  if(dpr===1){
   const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});report.dpr[dpr].timing={};
   for(const zoom of [1,.7]){
    const measure=async(drag)=>{
     await page.evaluate(zoom=>{cam.zoom=zoom;centerCamera(10,48);renderer.draw(0);window.__t={ground:[],frames:[],last:performance.now()};const g=renderer.drawGround;if(!g.__w){const w=function(...a){const t=performance.now();try{return g.apply(this,a);}finally{__t.ground.push(performance.now()-t);}};w.__w=1;w.__orig=g;renderer.drawGround=w;}},zoom);
     await page.evaluate(()=>{window.__run=true;const tick=now=>{__t.frames.push(now-__t.last);__t.last=now;if(__run)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
     // Parado: movimentos de 1 px forçam o mesmo redesenho por quadro do arrasto, sem deslocar a câmera.
     await page.mouse.move(cx+250,cy);if(drag)await page.mouse.down({button:'middle'});
     for(let i=0;i<70;i++){await page.mouse.move(drag?cx+250-(i<35?i:70-i)*14:cx+250+(i%2),cy);await frame();}
     if(drag)await page.mouse.up({button:'middle'});
     return page.evaluate(()=>{__run=false;const f=[...__t.frames.slice(2)].sort((a,b)=>a-b),g=[...__t.ground].sort((a,b)=>a-b),q=(a,p)=>a[Math.min(a.length-1,Math.floor(a.length*p))];return{frames:f.length,frameP50:+q(f,.5).toFixed(1),frameP95:+q(f,.95).toFixed(1),groundMean:+(g.reduce((a,b)=>a+b,0)/Math.max(1,g.length)).toFixed(2),groundP95:+q(g,.95).toFixed(2)};});
    };
    const still=await measure(false),drag=await measure(true);report.dpr[dpr].timing[zoom]={still,drag};
    expect(drag.groundMean<=10,`zoom ${zoom} com CPU 4×: terreno ${drag.groundMean} ms por quadro no arrasto`);
    expect(drag.frameP95<=still.frameP95*1.6+15,`zoom ${zoom} com CPU 4×: p95 do arrasto ${drag.frameP95} ms contra ${still.frameP95} ms parado`);
   }
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 fs.writeFileSync(path.join(artifacts,'camera-performance.json'),JSON.stringify(report,null,2));
 console.log('Medições reais: '+JSON.stringify(report.dpr[1].timing));
 report.failures=failures;fs.writeFileSync(path.join(artifacts,'camera-performance.json'),JSON.stringify(report,null,2));
 if(soft){console.log('RELATÓRIO: '+failures.length+' verificações falhariam');for(const m of failures.slice(0,12))console.log(' - '+m);return;}
 console.log('OK câmera: casas por quadro, pixels equivalentes, botão do meio, borda e roda, e ritmo com CPU 4× em DPR 1 e 2.');
}finally{await browser.close();}})().catch(e=>{try{fs.writeFileSync(path.join(artifacts,'camera-performance.json'),JSON.stringify(report,null,2));}catch(_){}console.error(e);process.exitCode=1;});
