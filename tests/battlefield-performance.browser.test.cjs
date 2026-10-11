'use strict';
// Mede motor, desenho e quadros reais separadamente; executar sem outras suítes concorrentes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),phase=process.argv[2]||'after',out=path.join(__dirname,'artifacts','graphics-'+phase);fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.context().setOffline(true);await page.goto(pathToFileURL(path.join(root,'public/index.html')).href);await page.evaluate(()=>terrainReady);await page.evaluate(()=>typeof battlefieldReady==='undefined'?null:battlefieldReady);const results=[];
 for(const scenario of ['takeoff14','stress'])for(const graphics of ['performance','balanced','cinematic']){
  const setup=await page.evaluate(({scenario,graphics})=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();settings.graphics=graphics;newOperation('river','normal',scenario==='stress'?44:123,'rts',{posts:2});paused=true;
   if(scenario==='takeoff14'){game.units=[];game.structures=[];game.terrain.fill('plain');game.credits.red=0;for(let y=0;y<96;y++)game.terrain[KEY(64,y)]='river';game.add('blue','hq',1,94);game.add('red','hq',26,20);const base=game.add('blue','airportDirt',20,20),plane=game.add('blue','fighterBlue',21,21);plane.flightState='grounded';plane.airportId=base.id;plane.ammo={};game.add('red','antiAirVehicle',110,10);for(let i=0;i<12;i++)game.add('blue','infantry',i+1,90);game.updateVision();game.order(plane,'takeoff');for(let i=0;i<125;i++)game.update(1/30);centerCamera(23,21);}
   else{const kinds=['infantry','infantry','engineer','antitank','machinegun','lightTank','tank','heavyTank','artillery','recon','missileInfantry','antiAirVehicle','helicopter','rocketArtillery','reconDrone','stealthDrone'];let placed=0;for(const owner of ['blue','red']){let i=0;while(placed<(owner==='blue'?150:300)&&i<5000){const x=owner==='blue'?34+i%12*2:78+i%12*2,y=(6+Math.floor(i/12)*3)%92;i++;try{if(game.add(owner,kinds[placed%kinds.length],x,y))placed++;}catch(e){}}}for(let i=0;i<12;i++){const blue=i<6;game.add(blue?'blue':'red',blue?(i%2?'fighterBlue':'multiroleBlue'):(i%2?'fighterRed':'multiroleRed'),blue?30+i*3:98-(i-6)*3,50);}game.updateVision();const blue=game.units.filter(u=>u.owner==='blue');for(const u of blue)game.order(u,'attackMove',{x:100,y:48},true);setSelection(blue.slice(0,40).map(u=>u.id));centerCamera(60,30);}
   renderer.rebuild();updateUI();return{units:game.units.length};},{scenario,graphics});await page.evaluate(()=>renderer.groundReady);
  const result=await page.evaluate(async()=>{
   const updates=[],draws=[],frames=[],update=game.update,draw=renderer.draw,peaks={decorative:0,clouds:0,trailPoints:0,marks:0,terrainTiles:0,groundChunks:0};
   game.update=function(...args){const start=performance.now(),r=update.apply(this,args);updates.push(performance.now()-start);return r;};
   renderer.draw=function(...args){const start=performance.now(),r=draw.apply(this,args);draws.push(performance.now()-start);const fx=this.fx;if(fx){peaks.decorative=Math.max(peaks.decorative,fx.particles.length);peaks.clouds=Math.max(peaks.clouds,this.visibleClouds||0);peaks.marks=Math.max(peaks.marks,fx.marks.length);for(const points of fx.trails.values())peaks.trailPoints=Math.max(peaks.trailPoints,points.length);peaks.terrainTiles=Math.max(peaks.terrainTiles,terrainTiles.size);peaks.groundChunks=Math.max(peaks.groundChunks,this.groundChunks.size);}return r;};
   const start=performance.now();let last=start;paused=false;speed=1;
   await new Promise(done=>{const tick=now=>{frames.push(now-last);last=now;if(now-start<4000)requestAnimationFrame(tick);else done();};requestAnimationFrame(tick);});
   paused=true;game.update=update;renderer.draw=draw;
   const stats=a=>{a.sort((x,y)=>x-y);const n=a.length;return{count:n,mean:+(a.reduce((s,x)=>s+x,0)/n).toFixed(2),median:+a[n>>1]?.toFixed(2),p95:+a[Math.floor(n*.95)]?.toFixed(2),max:+a.at(-1)?.toFixed(2)};};
   return{update:stats(updates),draw:stats(draws),frames:stats(frames),longFrames:frames.filter(t=>t>50).length,updateSpikes:updates.filter(t=>t>30).length,endUnits:game.units.length,particles:renderer.particles.length,ambient:renderer.ambientParticles.length,peaks,quality:renderer.fx?.profile().factor??null};
  });
  const i=['performance','balanced','cinematic'].indexOf(graphics);assert.ok(result.peaks.decorative<=[80,200,400][i]);assert.ok(result.peaks.clouds<=[0,6,12][i]);assert.ok(result.peaks.trailPoints<=[0,10,18][i]);assert.ok(result.peaks.terrainTiles<=4096&&result.peaks.groundChunks<=48);
  results.push({scenario,graphics,...setup,...result});fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify(results.at(-1)));
 }
 // O motor fica congelado neste trecho: só efeitos repetidos e caches do desenho.
 const session=await page.context().newCDPSession(page),memory=[];
 await session.send('Performance.enable');
 await page.evaluate(()=>{paused=true;game.visible.blue.fill(true);game.sky.blue.fill(true);settings.graphics='cinematic';renderer.fx.reset();renderer.draw(0);});await page.evaluate(()=>renderer.groundReady);
 for(let wave=0;wave<8;wave++){
  const footprint=await page.evaluate(()=>{const tank=game.units.find(u=>TYPES[u.type].tank&&u.owner==='blue'),p=game.units.find(u=>PLANE(u)&&u.owner==='blue'),h=game.hq('blue');centerCamera(tank?.x??h.x,tank?.y??h.y);for(let i=0;i<300;i++){if(tank&&i%10===0)renderer.fx.consume({kind:'shot',visible:true,id:tank.id,x:tank.x,y:tank.y,sourceType:tank.type,facing:tank.facing});if(i%12===0)renderer.fx.consume({kind:'blast',visible:true,x:tank?.x??h.x,y:tank?.y??h.y});if(p){p.flightState='patrol';p.x=(tank?.x??h.x)+3+Math.sin(renderer.fx.time)*2;p.y=(tank?.y??h.y)+Math.cos(renderer.fx.time)*2;p.facing=renderer.fx.time;}renderer.draw(1/30);}return{particles:renderer.fx.particles.length,marks:renderer.fx.marks.length,trailPoints:Math.max(0,...[...renderer.fx.trails.values()].map(t=>t.length)),tiles:terrainTiles.size,sprites:sprites.size,lights:renderer.lighting.size,fxImages:Object.keys(renderer.fx.cache).length};});
  await session.send('HeapProfiler.collectGarbage');const metrics=await session.send('Performance.getMetrics');
  memory.push({wave,simulatedSeconds:(wave+1)*10,...footprint,heapBytes:metrics.metrics.find(m=>m.name==='JSHeapUsedSize')?.value??null});
  assert.ok(Number.isFinite(memory.at(-1).heapBytes)&&memory.at(-1).heapBytes>0,'Chrome deve fornecer medida real do heap');
  assert.ok(footprint.particles<=400&&footprint.trailPoints<=18&&footprint.marks<=128&&footprint.tiles<=4096&&footprint.sprites<=512&&footprint.lights<=8&&footprint.fxImages===7);
 }
 assert.ok(memory.at(-1).heapBytes<=memory[0].heapBytes+1024*1024,'Efeitos repetidos não devem acumular heap após aquecer caches');fs.writeFileSync(path.join(out,'memory.json'),JSON.stringify(memory,null,2));console.log('GRAPHICS_MEMORY_COMPLETE '+JSON.stringify(memory));
 assert.deepEqual(errors,[]);console.log('GRAPHICS_PERFORMANCE_COMPLETE '+JSON.stringify({errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
