'use strict';
// Manutenção do helicóptero pela interface: o botão Manutenção aceita o QG e o aeroporto (posto não atende helicóptero).
const path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
 const page=await (await browser.newContext({viewport:{width:1280,height:800}})).newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(__dirname,'..','public','index.html')).href);await page.evaluate(()=>terrainReady);
 await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();newOperation('river','normal',44,'rts');game.aiEnabled=false;game.terrain.fill('plain');game.units=game.units.filter(u=>u.type==='commander'||u.owner==='red');paused=false;game.credits.blue=500;});
 // casos: instalação onde o helicóptero deve ser atendido (true) ou recusado (false)
 for(const [type,site,expected] of [['airportDirt','airportDirt',true],['hq','hq',true],['post','post',false]]){
  const result=await page.evaluate(({type,site})=>{
   game.structures=game.structures.filter(s=>s.owner!=='blue'||s.type==='hq');if(site!=='hq')game.add('blue',type,40,60); // o QG fica: sem ele a partida acaba
   const base=game.structures.find(s=>s.owner==='blue'&&s.type===site),h=game.add('blue','helicopterGround',base.x+(base.width||1),base.y);h.hp=40;h.flares=1;game.updateVision();
   setSelection([h.id]);updateUI();setMode('service');issueAt({x:base.x,y:base.y},'service');paused=false;
   return {id:h.id,order:h.order.type};
  },{type,site});
  if(expected){
   assert.equal(result.order,'service',site+': a ordem de manutenção é aceita');
   await page.waitForFunction(id=>game.get(id).hp>40,result.id,{timeout:10000});
  }else assert.notEqual(result.order,'service',site+': posto não atende helicóptero');
  console.log('OK manutenção do helicóptero em '+site+(expected?' (curou)':' (recusada)'));
 }
 await browser.close();assert.deepEqual(errors,[],'erros JS: '+errors.join(' | '));console.log('OK manutenção do helicóptero');
})().catch(e=>{console.error(e);process.exitCode=1;});
