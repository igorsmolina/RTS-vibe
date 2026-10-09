'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.context().setOffline(true);
 await page.goto(pathToFileURL(path.join(__dirname,'..','public','index.html')).href);await page.evaluate(()=>terrainReady);
 for(const [map,seed]of [['random',71],['mountain',83],['river',19],['desert',97]]){
  const measurements=await page.evaluate(async({map,seed})=>{
   for(const d of document.querySelectorAll('dialog[open]'))d.close();newOperation(map,'normal',seed,'rts');paused=true;game.aiEnabled=false;game.explored.blue.fill(true);game.visible.blue.fill(true);await renderer.groundReady;
   const create=document.createElement.bind(document),results=[];let canvases=0,reads=0;const terrain=game.terrain,observed=new Proxy(terrain,{get(a,k){if(typeof k==='string'&&/^\d+$/.test(k))reads++;return a[k];}});game.terrain=observed;
   document.createElement=function(...args){if(args[0]==='canvas')canvases++;return create(...args);};
   try{for(const zoom of [1,.5,.35]){
    cam.zoom=zoom;centerCamera(64,48);renderer.draw(0);canvases=0;reads=0;renderer.draw(0);const terrainReads=reads;game.terrain=terrain;const samples=[];
    for(let i=0;i<5;i++){const t=performance.now();renderer.draw(0);samples.push(performance.now()-t);}
    samples.sort((a,b)=>a-b);results.push({zoom,medianMs:samples[2],createdCanvases:canvases,cachedTiles:terrainTiles.size,terrainReads,cells:(viewCells().x1-viewCells().x0)*(viewCells().y1-viewCells().y0)});
   game.terrain=observed;}
    const count=canvases;reads=0;cam.x+=1;renderer.drawGround(renderer.ctx,cam.zoom*(devicePixelRatio||1));cam.x-=1;renderer.drawGround(renderer.ctx,cam.zoom*(devicePixelRatio||1));results.at(-1).pannedCanvases=canvases-count;results.at(-1).panGroundReads=reads;
   }finally{document.createElement=create;game.terrain=terrain;}return results;
  },{map,seed});
  console.log(map+': '+JSON.stringify(measurements));
  assert.ok(measurements.every(m=>m.terrainReads<m.cells*4),'Camera parada nao deve redesenhar todo o terreno em cada quadro: '+map);
  assert.equal(measurements.at(-1).panGroundReads,0,'Pan no zoom distante deve reutilizar blocos sem consultar terreno por casa: '+map);
  assert.equal(measurements.at(-1).pannedCanvases,0,'Mover a camera em area ja preparada nao deve recriar texturas: '+map);
  assert.ok(measurements.every(m=>m.createdCanvases===0),'Camera parada nao deve recriar texturas continuamente ao afastar o zoom: '+map);
 }
 const view=await page.evaluate(()=>{
  cam.zoom=1;centerCamera(64,48);const normal=renderer.drawGround;renderer.draw(0);const cached=renderer.canvas.toDataURL();
  renderer.drawGround=function(c){const {x0,y0,x1,y1}=viewCells();for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)drawTerrainCell(c,game,x,y);};
  let identical;try{renderer.draw(0);identical=cached===renderer.canvas.toDataURL();}finally{renderer.drawGround=normal;}
  const before=renderer.canvas.toDataURL();cam.x+=CELL;clampCamera();renderer.draw(0);const panned=before!==renderer.canvas.toDataURL();
  const tile=KEY(Math.floor(cam.x/CELL)+4,Math.floor(cam.y/CELL)+4);game.terrain[tile]=game.terrain[tile]==='river'?'plain':'river';renderer.paintGround();renderer.draw(0);
  const refreshed=renderer.canvas.toDataURL();renderer.terrainViewKey=null;renderer.draw(0);
  return{identical,panned,updated:refreshed===renderer.canvas.toDataURL(),width:renderer.terrainView.width,height:renderer.terrainView.height,screenWidth:renderer.canvas.width,screenHeight:renderer.canvas.height};
 });
 assert.ok(view.identical,'Cache deve manter os pixels do desenho direto');assert.ok(view.panned&&view.updated,'Mover camera e invalidar terreno devem atualizar a imagem');assert.equal(view.width,view.screenWidth);assert.equal(view.height,view.screenHeight);
 const blocks=await page.evaluate(async()=>{newOperation('river','normal',19,'turns');const abandoned=renderer.groundReady;newOperation('random','normal',83,'rts');paused=true;game.aiEnabled=false;const cancelled=await abandoned,ready=await renderer.groundReady;let bytes=0;for(const image of renderer.groundChunks.values())bytes+=image.width*image.height*4;const saved=JSON.stringify([game.terrain,game.units,game.mines]);const expected=new Game('random','normal',83,'rts',{},game.doctrines);const stable=saved===JSON.stringify([expected.terrain,expected.units,expected.mines])&&game.rng()===expected.rng();let pixels=true;for(const index of [0,9,47]){const image=renderer.groundChunks.get(index),reference=document.createElement('canvas');reference.width=image.width;reference.height=image.height;const c=reference.getContext('2d',{alpha:false}),x0=index%8*16,y0=Math.floor(index/8)*16;c.setTransform(.5,0,0,.5,-x0*28,-y0*28);for(let y=y0;y<y0+16;y++)for(let x=x0;x<x0+16;x++)drawTerrainCell(c,game,x,y);pixels&&=image.toDataURL()===reference.toDataURL();}return{cancelled,ready,bytes,count:renderer.groundChunks.size,stable,pixels};});
 assert.equal(blocks.cancelled,false);assert.equal(blocks.ready,true);assert.equal(blocks.count,48);assert.ok(blocks.bytes<=40*1024*1024);assert.ok(blocks.pixels,'Blocos devem manter os pixels da composicao equivalente');assert.ok(blocks.stable,'Preparacao visual nao deve modificar motor ou RNG');
 for(const viewport of [{width:1920,height:1080},{width:2560,height:1440},{width:390,height:844}]){await page.setViewportSize(viewport);const pan=await page.evaluate(async()=>{await renderer.groundReady;cam.zoom=.35;centerCamera(64,48);renderer.draw(0);renderer.drawMini();const terrain=game.terrain;let reads=0;game.terrain=new Proxy(terrain,{get(a,k){if(typeof k==='string'&&/^\d+$/.test(k))reads++;return a[k];}});try{for(let i=0;i<6;i++){cam.x+=1;const z=cam.zoom*(devicePixelRatio||1);renderer.ctx.save();renderer.ctx.setTransform(z,0,0,z,-cam.x*z,-cam.y*z);renderer.drawGround(renderer.ctx,z);renderer.ctx.restore();renderer.drawMini();}return{reads,overflow:document.documentElement.scrollWidth>innerWidth};}finally{game.terrain=terrain;}});assert.equal(pan.reads,0,'Pan e minimapa devem reutilizar terreno preparado');assert.equal(pan.overflow,false);}
 assert.deepEqual(errors,[]);console.log('OK zoom afastado nos quatro mapas sem recriacao continua de texturas, file:// offline');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
