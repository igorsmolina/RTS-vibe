'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});await page.context().setOffline(true);
 await page.goto(pathToFileURL(path.join(__dirname,'../public/index.html')).href);await page.evaluate(()=>terrainReady);
 assert.equal(await page.locator('#titleTutorial').count(),1,'Menu precisa de treinamento');assert.ok(await page.locator('#titleTutorial').evaluate(e=>e.classList.contains('new')));
 await page.locator('#titleTutorial').click();assert.equal(await page.locator('#titleScreen').evaluate(e=>e.open),false);
 assert.equal(await page.evaluate(()=>game.seed===TUTORIAL_SEED&&game.mode==='turns'),true);assert.equal(await page.locator('#tutorialStep').textContent(),'Passo 1 de 8');
 assert.ok(await page.evaluate(()=>game.structures.some(p=>p.type==='post'&&p.owner==='neutral'&&DIST(game.hq('blue'),p)<=8)));
 const destination=await page.evaluate(()=>{const u=game.units.find(u=>u.owner==='blue'&&u.type==='infantry');setSelection([u.id]);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const p={x:u.x+dx,y:u.y+dy},route=INSIDE(p.x,p.y)&&game.findPath(u,p,true);if(route?.length&&!game.structureAt(p.x,p.y))return p;}throw Error('Sem destino próximo');});
 assert.equal(await page.locator('#tutorialStep').textContent(),'Passo 2 de 8');await page.evaluate(p=>issueAt(p,'move'),destination);assert.equal(await page.locator('#tutorialStep').textContent(),'Passo 3 de 8');
 await page.evaluate(()=>tutorialEvent('endTurn'));assert.equal(await page.locator('#tutorialStep').textContent(),'Passo 3 de 8');await page.locator('#tutorialSkip').click();assert.equal(await page.locator('#tutorialStep').textContent(),'Passo 4 de 8');
 const pause=await page.evaluate(()=>paused);await page.locator('#battlefield').focus();await page.keyboard.press('p');assert.equal(await page.evaluate(()=>paused),!pause);
 // Clique real fora do cartão, com câmera centrada numa tropa e seleção limpa.
 const point=await page.evaluate(()=>{const u=game.units.find(u=>u.owner==='blue'&&u.type==='engineer');centerCamera(u.x,u.y);selection.clear();renderer.draw(0);const r=$('battlefield').getBoundingClientRect();return{x:r.left+((u.x+.5)*CELL-cam.x)*cam.zoom,y:r.top+((u.y+.5)*CELL-cam.y)*cam.zoom};});
 await page.mouse.click(point.x,point.y);assert.ok(await page.evaluate(()=>selection.size>0));
 await page.locator('#tutorialExit').click();assert.equal(await page.locator('#tutorial').isVisible(),false);assert.equal(await page.evaluate(()=>localStorage.getItem(TUTORIAL_KEY)),'done');
 await page.reload();await page.evaluate(()=>terrainReady);assert.equal(await page.locator('#titleTutorial').evaluate(e=>e.classList.contains('new')),false);
 await page.locator('#titleTutorial').click();await page.evaluate(()=>openSetup());await page.locator('#setupForm button[type=submit]').click();assert.equal(await page.locator('#tutorial').isVisible(),false);
 // Eventos reais de câmera, recrutamento e grupos avançam só o passo correspondente.
 await page.evaluate(()=>{startTutorial();tutorialEvent('select');tutorialEvent('move');});await page.locator('#battlefield').hover();await page.mouse.wheel(0,-60);assert.equal(await page.locator('#tutorialStep').textContent(),'Passo 4 de 8');
 await page.evaluate(()=>tutorialEvent('capture'));await page.locator('#hqButton').click();await page.locator('[data-recruit=infantry]').click();assert.equal(await page.locator('#tutorialStep').textContent(),'Passo 6 de 8');
 await page.evaluate(()=>{setSelection([game.units.find(u=>u.owner==='blue').id]);groupAction(0,true);});assert.equal(await page.locator('#tutorialStep').textContent(),'Passo 7 de 8');
 await page.locator('#tutorialSkip').click();await page.locator('#tutorialSkip').click();assert.equal(await page.locator('#tutorialTitle').textContent(),'Treinamento concluído');await page.locator('#tutorialExit').click();
 // Em paisagem baixa, o cartão e os controles deixam a tropa inicial acessível.
 await page.setViewportSize({width:568,height:320});await page.evaluate(()=>startTutorial());
 const initial=await page.evaluate(()=>{const u=game.units.find(u=>u.owner==='blue'&&u.type==='infantry'),r=$('battlefield').getBoundingClientRect();return{id:u.id,x:r.left+((u.x+.5)*CELL-cam.x)*cam.zoom,y:r.top+((u.y+.5)*CELL-cam.y)*cam.zoom};});
 assert.equal(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id,initial),'battlefield','Tropa inicial livre do cartão');await page.mouse.click(initial.x,initial.y);assert.ok(await page.evaluate(id=>selection.has(id),initial.id));await page.locator('#closeSelection').click();assert.equal(await page.evaluate(()=>selection.size),0);await page.locator('#tutorialExit').click();
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);console.log('OK treinamento: ordens, sequência, câmera, produção, grupos, pausa, clique e persistência offline.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
