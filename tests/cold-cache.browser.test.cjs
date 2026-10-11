'use strict';
// Cache frio com CPU 4×: logo após iniciar a partida (sem aquecer tiles nem blocos), varre o mapa inteiro em zigue-zague
// a 3000 px de tela por segundo nos zooms 0,5, 0,7 e 1. Mede a criação de tiles e canvases por quadro e os piores quadros.
const {open,frameStats,suite,run}=require('./perf-kit.cjs');
const S=suite('cold-cache');

run(async browser=>{
 for(const [zoom,map] of [[1,'river'],[.7,'mountain'],[.5,'desert']]){
  const g=await open(browser),{page}=g,name=`zoom ${zoom}, ${map}`;await g.throttle();
  const r=await page.evaluate(async([zoom,map])=>{
   for(const d of document.querySelectorAll('dialog[open]'))d.close();clearTerrainCaches();newOperation(map,'normal',7,'rts');game.aiEnabled=false;paused=true;cam.zoom=zoom;centerCamera(0,0);
   const v=cameraViewport(),perTiles=[],perCanvas=[];let dir=1,lastTiles=terrainTiles.size,lastCanvas=__canvases,lastNow=performance.now(),rows=0;
   const done=()=>cam.y+v.height/cam.zoom>=ROWS*CELL-CELL&&(dir>0?cam.x+v.width/cam.zoom>=COLS*CELL-CELL:cam.x<=0);
   const m=await __measure(60000,(i,now)=>{
    perTiles.push(terrainTiles.size-lastTiles);lastTiles=terrainTiles.size;perCanvas.push(__canvases-lastCanvas);lastCanvas=__canvases;
    const step=3000*Math.min(.1,(now-lastNow)/1000)/cam.zoom;lastNow=now;const before=cam.x;cam.x+=dir*step;clampCamera();
    if(cam.x===before){dir=-dir;cam.y+=v.height/cam.zoom*.8;rows++;clampCamera();}renderer.dirty=true;renderer.drawMini();
   },{warmup:0,until:done});
   return{m,rows,tiles:terrainTiles.size,tileMax:Math.max(...perTiles),canvasMax:Math.max(...perCanvas),covered:done()};
  },[zoom,map]);
  const s={...frameStats(r.m),rows:r.rows,tilesTotal:r.tiles,tilesPerFrameMax:r.tileMax,canvasPerFrameMax:r.canvasMax};S.budget(name,s);
  S.expect(r.tiles<=4096,`${name}: ${r.tiles} tiles, acima do teto do cache`);
  S.expect(r.covered,`${name}: a varredura não chegou ao fim do mapa (${r.rows} linhas)`);
  S.expect(g.errors.length===0,`${name}: erros JS ${g.errors[0]}`);await g.close();
 }
 S.finish('cache frio: varredura completa do mapa logo após iniciar, com CPU 4×.');
});
