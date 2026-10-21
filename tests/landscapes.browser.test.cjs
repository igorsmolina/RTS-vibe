'use strict';
// Seletor "Paisagem" no menu de partida e na sala multiplayer: opções, efeito no mapa gerado e capturas do mapa inteiro.
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
const out=path.join(__dirname,'../test-output/landscapes');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.context().setOffline(true);
 await page.goto(pathToFileURL(path.join(__dirname,'..','public','index.html')).href);await page.evaluate(()=>terrainReady);
 const options=await page.evaluate(()=>({menu:[...document.querySelectorAll('#genLandscape option')].map(o=>o.textContent),room:[...document.querySelectorAll('#mpLandscape option')].map(o=>o.textContent),first:document.querySelector('#genLandscape').value}));
 assert.deepEqual(options.menu,['Aleatória','Continente','Lagos','Ilhas','Serras']);assert.deepEqual(options.room,options.menu);assert.equal(options.first,'auto');
 for(const [value,expected] of [['lakes','lakes'],['islands','islands'],['highlands','highlands'],['continent','continent']]){
  const got=await page.evaluate(async({value})=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();$('mapSelect').value='random';$('genLandscape').value=value;$('seed').value=7;const options=setupOptions();newOperation('random','normal',7,'rts',options);paused=true;game.aiEnabled=false;game.explored.blue.fill(true);game.visible.blue.fill(true);await renderer.groundReady;cam.zoom=.01;clampCamera();renderer.draw(0);return {landscape:game.landscape,options:setupOptions().landscape};},{value});
  assert.equal(got.landscape,expected);assert.equal(got.options,value);await page.screenshot({path:path.join(out,expected+'.png')});
 }
 // Os controles de Água e Relevo mudam o mapa com qualquer paisagem, inclusive Aleatória (era o bug: só valiam no Continente).
 for(const landscape of ['auto','continent','lakes','islands','highlands']){const diff=await page.evaluate(({landscape})=>{$('mapSelect').value='random';$('genLandscape').value=landscape;$('seed').value=21;const make=(w,r)=>{$('genWater').value=w;$('genRelief').value=r;return new Game('random','normal',21,'turns',setupOptions()).terrain.join(',');};const share=(t,k)=>t.split(',').filter(v=>k.includes(v)).length;const dry=make(5,35),wet=make(95,35),flat=make(35,5),rough=make(35,95);return {water:share(wet,['river','bridge'])-share(dry,['river','bridge']),relief:share(rough,['hill','mountain'])-share(flat,['hill','mountain'])};},{landscape});
  assert.ok(diff.water>300,landscape+': mais Água precisa dar mais rio/lago ('+diff.water+')');assert.ok(diff.relief>1000,landscape+': mais Relevo precisa dar mais colina/serra ('+diff.relief+')');}
 const auto=await page.evaluate(()=>{$('genLandscape').value='auto';newOperation('random','normal',11,'rts',setupOptions());return game.landscape;});assert.ok(['continent','lakes','islands','highlands'].includes(auto));
 assert.deepEqual(errors,[]);console.log('OK seletor de paisagem no menu e na sala; auto →',auto);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
