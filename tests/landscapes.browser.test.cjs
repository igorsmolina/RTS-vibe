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
 const auto=await page.evaluate(()=>{$('genLandscape').value='auto';newOperation('random','normal',11,'rts',setupOptions());return game.landscape;});assert.ok(['continent','lakes','islands','highlands'].includes(auto));
 assert.deepEqual(errors,[]);console.log('OK seletor de paisagem no menu e na sala; auto →',auto);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
