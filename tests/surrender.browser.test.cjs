'use strict';
// Desistir: botão no menu "Mais" em batalha solo (RTS e por turnos). Pede confirmação e termina como derrota.
const path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
 for(const mode of ['rts','turns']){
  const page=await (await browser.newContext({viewport:{width:1280,height:800}})).newPage();let asked=0,accept=false;
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{asked++;accept?d.accept():d.dismiss();});
  await page.goto(pathToFileURL(path.join(__dirname,'..','public','index.html')).href);await page.evaluate(()=>terrainReady);
  await page.evaluate(m=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();newOperation('river','normal',44,m);},mode);
  await page.locator('#moreButton').click();assert.equal(await page.locator('#surrender').isVisible(),true,'botão visível em partida');
  // recusar a confirmação não muda nada
  await page.locator('#surrender').click();assert.equal(asked,1);assert.equal(await page.evaluate(()=>game.winner),null);
  accept=true;await page.locator('#moreButton').click().catch(()=>{});await page.evaluate(()=>document.getElementById('surrender').click());
  await page.waitForFunction(()=>document.getElementById('result').open);
  assert.equal(await page.locator('#result').getAttribute('data-result'),'loss');assert.equal(await page.evaluate(()=>game.winner),'red');
  assert.equal(await page.locator('#resultStamp').textContent(),'Derrota');
  assert.equal(await page.evaluate(()=>document.getElementById('surrender').hidden),true,'sem botão depois do fim');
  console.log('OK desistir no modo '+mode);
 }
 await browser.close();assert.deepEqual(errors,[],'erros JS: '+errors.join(' | '));console.log('OK desistir em todos os modos solo');
})().catch(e=>{console.error(e);process.exitCode=1;});
