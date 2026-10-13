'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
const phase=process.argv[2]||'after',before=phase==='before',out=path.resolve('test-output/cinematic',phase);fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.setOffline(true);const page=await context.newPage(),errors=[],network=[],results=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.goto(pathToFileURL(path.resolve('public/index.html')).href);await page.evaluate(()=>Promise.all([terrainReady,battlefieldReady]));
 if(before)await page.evaluate(code=>{eval(code+'\nrenderer.fx=new BattlefieldFX(renderer);');},fs.readFileSync('test-output/cinematic/battlefield-fx-before.js','utf8'));
 const setup=async(map,mode,graphics)=>{await page.evaluate(({map,mode,graphics})=>{
  for(const d of document.querySelectorAll('dialog[open]'))d.close();settings.graphics=graphics;newOperation(map,'normal',44,mode,{posts:2});paused=true;game.aiEnabled=false;game.units=[];game.structures=[];game.mines=[];game.actions=[];game.animation=null;game.projectiles=[];game.events=[];game.memory.blue.clear();game.memory.red.clear();
  for(let y=44;y<66;y++)for(let x=42;x<68;x++)game.terrain[KEY(x,y)]=y===53?'road':'plain';
  game.add('blue','hq',43,63);game.add('red','hq',66,63);
  const tank=game.add('blue','heavyTank',47,49),truck=game.add('blue','recon',47,53),foot=game.add('blue','infantry',47,57),enemy=game.add('red','heavyTank',58,49),damaged=game.add('blue','rocketArtillery',60,57);
  damaged.hp=damaged.maxHp*.3;enemy.cooldown=1000;enemy.hp=enemy.maxHp=2000;game.updateVision();game.visible.blue.fill(true);game.sky.blue.fill(true);game.explored.blue.fill(true);setSelection([]);cam.zoom=1.75;centerCamera(54,53);renderer.rebuild();renderer.fx.reset();renderer.draw(1/30);
  window.cinematicIds=[tank.id,truck.id,foot.id];if(mode==='rts')for(const u of [tank,truck,foot])game.order(u,'move',{x:54,y:u.y});
 },{map,mode,graphics});await page.evaluate(()=>renderer.groundReady);await page.evaluate(()=>{cam.zoom=1.2;cam.x=54.5*CELL-renderer.canvas.clientWidth/cam.zoom/2;cam.y=45*CELL;clampCamera();renderer.draw(0);});};
 for(const map of ['desert','river','mountain','random'])for(const mode of ['rts','turns'])for(const graphics of ['performance','balanced','cinematic']){
  await setup(map,mode,graphics);
  const move=await page.evaluate(()=>{let unit=0;for(let i=0;i<600;i++){if(game.mode==='turns'&&!game.busy&&unit<cinematicIds.length){const u=game.get(cinematicIds[unit++]);game.order(u,'move',{x:54,y:u.y});}game.update(1/30);renderer.consume();renderer.draw(1/30);}return {kinds:[...new Set(renderer.fx.marks.map(m=>m.kind||'legacy'))],marks:renderer.fx.marks.length,cap:renderer.fx.profile().marks,smoke:renderer.fx.particles.filter(p=>p.kind==='smoke').length};});
  assert.ok(move.marks<=move.cap);if(!before&&graphics==='cinematic'){assert.ok(['tread','tyre','foot'].every(k=>move.kinds.includes(k)),map+'/'+mode+' rastros '+JSON.stringify(move));assert.ok(move.smoke>0,'Veículo danificado emite fumaça');}
  if(map==='desert'&&mode==='rts'&&graphics==='cinematic')await page.screenshot({path:path.join(out,'rastros.png')});
  const shot=await page.evaluate(()=>{const tank=game.units.find(u=>u.owner==='blue'&&u.type==='heavyTank'),target=game.units.find(u=>u.owner==='red'&&u.type==='heavyTank');game.updateVision();game.visible.blue.fill(true);const shots=game.shotsFired;game.shoot(tank,target);renderer.consume();renderer.draw(1/30);return {fired:game.shotsFired>shots,pressure:renderer.fx.particles.filter(p=>p.kind==='pressure').length,particles:renderer.fx.particles.length,cap:renderer.fx.profile().particles,recoil:renderer.fx.recoil(tank)};});
  assert.ok(shot.fired);assert.ok(shot.particles<=shot.cap);if(!before&&graphics==='cinematic')assert.ok(shot.pressure>0);
  if(map==='desert'&&mode==='rts'&&graphics==='cinematic'){await page.evaluate(()=>{for(let i=0;i<6;i++){game.update(1/30);renderer.consume();renderer.draw(1/30);}});await page.screenshot({path:path.join(out,'disparo.png')});}
  const impact=await page.evaluate(()=>{for(let i=0;i<30;i++){game.update(1/30);renderer.consume();renderer.draw(1/30);}return {scorches:renderer.fx.marks.filter(m=>m.kind==='scorch').length,positions:game.units.map(u=>({type:u.type,x:u.x,y:u.y,hp:u.hp}))};});
  if(!before&&graphics==='cinematic')assert.ok(impact.scorches>0,'Impacto real deixa marca no solo');
  results.push({map,mode,graphics,move,shot,impact});
 }
 // Fog, redução de movimento, pausa e troca de perfil: observar o desenho efetivo.
 await setup('desert','rts','cinematic');await page.evaluate(()=>{for(let i=0;i<120;i++){game.update(1/30);renderer.consume();renderer.draw(1/30);}});
 const fog=await page.evaluate(()=>{game.visible.blue.fill(false);game.sky.blue.fill(false);const fx=renderer.fx,c=document.createElement('canvas').getContext('2d');let images=0;c.drawImage=()=>images++;fx.ground(c);const hiddenImages=images;const t=game.units.find(u=>u.type==='heavyTank'&&u.owner==='red');t.x=53;t.y=51;game.units=game.units.filter(u=>u.owner==='red');fx.reset();fx.advance(.1);t.x+=.5;fx.advance(.1);return {hiddenImages,marks:fx.marks.length,particles:fx.particles.length};});assert.deepEqual(fog,{hiddenImages:0,marks:0,particles:0});
 await setup('desert','rts','cinematic');await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>reducedMotion);
 const reduced=await page.evaluate(()=>{for(let i=0;i<120;i++){game.update(1/30);renderer.consume();renderer.draw(1/30);}return {marks:renderer.fx.marks.length,continuous:renderer.fx.particles.filter(p=>p.continuous||p.kind==='pressure').length};});assert.deepEqual(reduced,{marks:0,continuous:0});
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>!reducedMotion);await setup('desert','rts','cinematic');await page.evaluate(()=>{for(let i=0;i<90;i++){game.update(1/30);renderer.consume();renderer.draw(1/30);}});
 const frozen=await page.evaluate(()=>{renderer.draw(0);return renderer.canvas.toDataURL();});await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>renderer.canvas.toDataURL()),frozen,'Pausa não anima marcas/fumaça');
 await page.evaluate(()=>{settings.graphics='performance';renderer.draw(0);});assert.equal(await page.evaluate(()=>renderer.fx.marks.length),0);
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);const source=before?'test-output/cinematic/battlefield-fx-before.js':'public/js/battlefield-fx.js';fs.writeFileSync(path.join(out,'cenarios.json'),JSON.stringify({source,sourceHash:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),offline:true,results,fog,reduced,errors,network},null,2));console.log('OK '+results.length+' cenários reais, file:// offline, pausa, neblina e movimento reduzido.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
