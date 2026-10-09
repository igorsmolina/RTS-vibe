'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.context().setOffline(true);
 await page.goto(pathToFileURL(path.join(__dirname,'..','public','index.html')).href);await page.evaluate(()=>terrainReady);
 const movement=await page.evaluate(()=>{
  newOperation('random','normal',83,'rts',{posts:2});paused=true;game.aiEnabled=false;
  game.units=[];game.structures=[];game.mines=[];game.terrain.fill('field');
  game.add('blue','hq',1,94);game.add('red','hq',126,1);game.add('red','infantry',126,2);const scout=game.add('blue','recon',30,48);
  game.updateVision();renderer.rebuild();centerCamera(scout.x,scout.y);const before=game.visible.blue[KEY(45,48)];
  const accepted=game.order(scout,'move',{x:38,y:48}),drawTimes=[];
  for(let i=0;i<180;i++){game.update(STEP);renderer.consume();const t=performance.now();renderer.draw(STEP);drawTimes.push(performance.now()-t);}
  drawTimes.sort((a,b)=>a-b);return{accepted,x:scout.x,more:!before&&game.visible.blue[KEY(45,48)]&&game.explored.blue.every(Boolean),medianMs:drawTimes[90],maxMs:drawTimes.at(-1)};
 });
 assert.ok(movement.accepted&&movement.more,JSON.stringify(movement));assert.equal(movement.x,38);console.log('Batedor em movimento: '+JSON.stringify(movement));
 const frozen=await page.evaluate(()=>JSON.stringify(game.units));await page.waitForTimeout(280);assert.equal(await page.evaluate(()=>JSON.stringify(game.units)),frozen,'Pausa tatica preserva unidades');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{centerCamera(38,48);renderer.draw(0);});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('OK exploracao RTS offline: trabalho limitado, nevoa, movimento, pausa e tela pequena');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
