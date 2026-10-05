'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.join(__dirname,'..'),out=path.join(root,'test-output','rocket-animation');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},offline:true}),page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await page.goto(pathToFileURL(path.join(root,'public','index.html')).href);await page.evaluate(()=>terrainReady);
 await page.waitForFunction(()=>rocketLauncherImages.flat().every(i=>i.complete&&i.naturalWidth===128));
 await page.locator('#titlePlay').click();await page.getByRole('button',{name:'Iniciar operação'}).click();
 const prepare=async(mode='rts',map='river',flat=true)=>page.evaluate(({mode,map,flat})=>{
  newOperation(map,'normal',17,mode);paused=true;game.aiEnabled=false;if(flat)game.terrain.fill('plain');game.units=[];game.mines=[];game.projectiles=[];
  const x=flat?5:2,y=flat?20:24,a=game.add('blue','rocketArtillery',x,y),b=game.add('blue','rocketArtillery',x,y+2),red=game.add('red','rocketArtillery',x+2,y+1);
  game.updateVision();renderer.paintGround();centerCamera(x,y+1);setSelection([a.id,b.id]);renderer.draw(0);return[a.id,b.id,red.id];
 },{mode,map,flat});
 const advance=async(seconds)=>page.evaluate(seconds=>{for(let t=0;t<seconds-1e-8;t+=STEP)game.update(Math.min(STEP,seconds-t));renderer.consume();renderer.draw(0);updateUI();},seconds);
 const poses=await page.evaluate(()=>['blue','red'].map(owner=>[0,1,2].map(frame=>sprite('rocketArtillery',TEAM[owner],.86,0,false,frame).toDataURL())));
 assert.equal(new Set(poses.flat()).size,6,'Seis poses/equipes distintas');
 await page.evaluate(()=>{for(let i=0;i<1000;i++)sprite('rocketArtillery',TEAM.blue,.86,0,false,i%3);});
 assert.ok(await page.evaluate(()=>sprites.size<100),'Cache limitado às poses discretas');
 for(const mode of ['turns','rts']){
  const ids=await prepare(mode);assert.equal(await page.evaluate(ids=>game.command(ids.slice(0,2),'bombard',{x:14,y:20}),ids),2,'Ordens em grupo');
  await advance(.2);const mid=await page.evaluate(()=>({time:game.time,level:game.units[0].launcherLevel,shots:game.shotsFired}));
  assert.ok(mid.level>0&&mid.level<1);assert.equal(mid.shots,0);
  await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>({time:game.time,level:game.units[0].launcherLevel,shots:game.shotsFired})),mid,'Pausa congela progresso e disparos');
  await page.screenshot({path:path.join(out,mode+'-transition.png')});
  await advance(.25);assert.equal(await page.evaluate(()=>game.units[0].launcherLevel),1);await page.screenshot({path:path.join(out,mode+'-ready.png')});
  await advance(5);assert.equal(await page.evaluate(()=>game.shotsFired),8);assert.ok(await page.evaluate(()=>game.units.filter(u=>u.owner==='blue').every(u=>u.launcherLevel===0&&!u.pending)));
 }
 // Cancelamento por controles existentes e ordem de movimento preparada na pausa.
 const ids=await prepare();await page.evaluate(id=>game.order(game.get(id),'bombard',{x:14,y:20}),ids[0]);await advance(.2);
 await page.locator('#stop').click();assert.equal(await page.evaluate(()=>game.shotsFired),0);await advance(.4);assert.equal(await page.evaluate(()=>game.units[0].launcherLevel),0);
 await page.evaluate(id=>{setSelection([id]);game.order(game.get(id),'move',{x:7,y:20});},ids[0]);await advance(.5);assert.ok(await page.evaluate(()=>game.units[0].x>5));
 // O loop real usa a velocidade da operação para o mesmo preparo de 0,35 s.
 const durations=[];
 for(const value of [1,2]){const [id]=await prepare();await page.evaluate(({id,value})=>{speed=value;game.order(game.get(id),'bombard',{x:14,y:20});paused=false;lastFrame=performance.now();}, {id,value});const start=Date.now();await page.waitForFunction(()=>game.shotsFired>0,{},{polling:10});durations.push(Date.now()-start);await page.evaluate(()=>{paused=true;});}
 assert.ok(durations[0]>durations[1]*1.2,JSON.stringify(durations));
 // Movimento reduzido mantém estado estático; seleção usa as mesmas coordenadas durante o preparo.
 await page.emulateMedia({reducedMotion:'reduce'});const [id]=await prepare();await page.evaluate(id=>game.order(game.get(id),'bombard',{x:14,y:20}),id);await advance(.2);
 assert.equal(await page.evaluate(()=>reducedMotion),true);assert.equal(await page.evaluate(()=>entityAt({x:5,y:20}).id),id);await page.emulateMedia({reducedMotion:'no-preference'});
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}])for(const map of ['river','desert','mountain','random']){
  await page.setViewportSize(viewport);await prepare('rts',map,false);await page.evaluate(()=>{game.units[0].launcherLevel=.5;game.units[1].launcherLevel=1;game.units[2].launcherLevel=1;renderer.draw(0);});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sem corte lateral');await page.screenshot({path:path.join(out,map+'-'+viewport.width+'.png')});
 }
 // Erro de imagem invalida cache e retorna à arte de transporte; erro total usa o desenho alternativo.
 await page.evaluate(()=>{rocketLauncherImages[0][1].src='data:image/png;base64,AA==';});await page.waitForFunction(()=>rocketLauncherImages[0][1].complete&&!rocketLauncherImages[0][1].naturalWidth);
 assert.equal(await page.evaluate(()=>sprite('rocketArtillery',TEAM.blue,.86,0,false,2).toDataURL()===sprite('rocketArtillery',TEAM.blue,.86).toDataURL()),true);
 await page.evaluate(()=>{newTroopImages.rocketArtillery[0].src='data:image/png;base64,AA==';});await page.waitForFunction(()=>newTroopImages.rocketArtillery[0].complete&&!newTroopImages.rocketArtillery[0].naturalWidth);
 assert.notEqual(await page.evaluate(()=>sprite('rocketArtillery',TEAM.blue,.86,0,false,2).toDataURL()),poses[0][0]);
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 console.log('OK animação: seis sprites, grupos/turnos/RTS, pausa, cancelamento, velocidade, movimento reduzido, quatro mapas, desktop/celular e falhas offline.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
