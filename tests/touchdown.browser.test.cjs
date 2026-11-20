'use strict';
// Toque da roda no pouso: o evento touchdown solta fumaça de pneu nas duas rodas; sem fumaça com movimento reduzido.
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.context().setOffline(true);
 await page.goto(pathToFileURL(path.join(__dirname,'..','public','index.html')).href);await page.evaluate(()=>terrainReady);
 const r=await page.evaluate(async()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();newOperation('river','normal',123,'rts',{posts:2});paused=true;game.aiEnabled=false;game.units=[];game.structures=[];await renderer.groundReady;
  const a=game.add('blue','airportAsphalt',20,60),p=game.add('blue','fighterBlue',22,61);p.flightState='landingRoll';game.updateVision();centerCamera(22,61);
  const touch=()=>{renderer.particles.length=0;game.events.push({kind:'touchdown',id:p.id,x:p.x,y:p.y,facing:Math.PI/2,visible:true,air:false});renderer.consume();return renderer.particles.filter(q=>q.color==='#d9dcd6').length;};
  reducedMotion=false;const normal=touch();reducedMotion=true;const reduced=touch();reducedMotion=false;return {normal,reduced};});
 assert.ok(r.normal>=6,'fumaça de pneu no toque: '+r.normal);assert.equal(r.reduced,0,'sem fumaça com movimento reduzido');assert.deepEqual(errors,[]);console.log('OK fumaça de pneu no toque da roda');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
