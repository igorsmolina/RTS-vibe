'use strict';
// GPU reiniciada: o navegador devolve os canvas em branco; o jogo precisa refazer os desenhos guardados.
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve('public/index.html')).href);await page.waitForFunction(()=>$('titleBg').dataset.ready==='true');
 await page.evaluate(()=>{$('titleScreen').close();newOperation('river','normal',7,'turns');});await page.waitForTimeout(500);
 const before=await page.evaluate(()=>{window.oldView=renderer.terrainView;window.oldGlow=renderer.glow;return renderer.groundChunks.size;});
 assert.ok(before>0,'chunks de terreno não foram preparados');
 await page.evaluate(()=>$('battlefield').dispatchEvent(new Event('contextrestored')));await page.waitForTimeout(400);
 const after=await page.evaluate(()=>({view:renderer.terrainView!==oldView,glow:renderer.glow!==oldGlow,title:$('titleBg').dataset.ready}));
 assert.deepEqual(after,{view:true,glow:true,title:'true'});assert.deepEqual(errors,[]);
 console.log('OK canvas refeitos após contextrestored');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
