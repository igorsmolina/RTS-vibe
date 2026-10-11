'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:1000}}),errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.context().setOffline(true);await page.goto(pathToFileURL(path.join(__dirname,'../public/index.html')).href);await page.evaluate(()=>terrainReady);
  await page.locator('#titleHelp').click();assert.equal(await page.locator('#manualSearch').count(),1,'Manual precisa de busca');
  assert.equal(await page.locator('#manualSearch').evaluate(e=>e===document.activeElement),true);
  await page.locator('#manualSearch').fill('helicoptero');
  const topics=await page.locator('.topic:not([hidden])').allTextContents();assert.ok(topics.length>0);
  assert.ok(topics.every(t=>t.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().includes('helicoptero')));
  await page.locator('#manualSearch').fill('zzzz');assert.equal(await page.locator('#manualEmpty').isVisible(),true);assert.equal(await page.locator('.topic:not([hidden])').count(),0);
  await page.locator('#manualSearch').fill('');assert.equal(await page.locator('.topic[hidden],.topic[open]').count(),0);
  assert.equal(await page.locator('.tank-stats').count(),2);assert.equal(await page.locator('#unitSheets .unit-sheet').count(),await page.evaluate(()=>RECRUIT_TYPES.length));
  const grid=await page.evaluate(()=>settings.grid);await page.locator('#manualSearch').press('g');assert.equal(await page.evaluate(()=>settings.grid),grid);
  assert.equal(await page.locator('#manual').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  await page.locator('#closeHelp').click();await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();newOperation('river','normal',19,'turns');});await page.locator('#help').click();
  assert.equal(await page.locator('#manualSearch').inputValue(),'');assert.equal(await page.locator('#manualSearch').evaluate(e=>e===document.activeElement),true);
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);await page.close();
 }
 console.log('OK manual: busca sem acentos, categorias, fichas, foco, teclado e file:// em desktop/celular.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
