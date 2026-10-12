'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext();await context.setOffline(true);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const results=[];
 try{await page.goto(pathToFileURL(path.resolve('public/index.html')).href);await page.evaluate(()=>terrainReady);for(const map of ['river','desert','mountain','random'])for(const mode of ['rts','turns']){
  const r=await page.evaluate(({map,mode})=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();newOperation(map,'normal',44,mode);paused=true;if(mode==='turns')game.endTurn('blue');for(let i=0;i<180;i++)game.update(1/30);updateUI();renderer.draw();return {map,mode,aiDecisions:game.aiDecisions,credits:game.credits.red,phase:game.plan.phase,strategy:game.plan.strategy,units:game.units.length};},{map,mode});assert.ok(r.aiDecisions>0);assert.ok(r.credits>=0);results.push(r);console.log(r);
 }assert.deepEqual(errors,[]);fs.writeFileSync('reports/ia-2026-10-11/offline-browser.json',JSON.stringify({offline:true,url:page.url(),errors,results},null,2));}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
