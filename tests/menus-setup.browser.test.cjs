'use strict';
// Nova operação: abas Teatro/Regras/Forças, cartões espelhando os <select> e prévia grande do teatro (desktop).
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.context().setOffline(true);await page.goto(pathToFileURL(path.join(__dirname,'../public/index.html')).href);await page.evaluate(()=>terrainReady);
 await page.locator('#titlePlay').click();
 assert.equal(await page.locator('#setup[open]').count(),1);
 const tabs=await page.locator('#setupTabs [role=tab]').allTextContents();assert.deepEqual(tabs,['Teatro','Regras','Forças']);
 assert.equal(await page.locator('#tab-theater').getAttribute('aria-selected'),'true');
 assert.equal(await page.locator('#setupPaneTheater').isVisible(),true);assert.equal(await page.locator('#setupPaneRules').isVisible(),false);

 // Teatro: 4 cartões de mapa com miniatura, a prévia grande e a legenda acompanham a escolha.
 assert.equal(await page.locator('#setupPaneTheater .pick-card[data-value]').count()>=4,true);
 await page.waitForFunction(()=>document.querySelectorAll('#mapSelect+.pick-grid .pick-art canvas').length===4,null,{timeout:15000});
 await page.locator('#seed').fill('91');
 const caption=()=>page.locator('#previewCaption').textContent();
 await page.locator('#mapSelect+.pick-grid .pick-card[data-value=desert]').click();
 assert.equal(await page.locator('#mapSelect').inputValue(),'desert');assert.match(await caption(),/Deserto Aberto · semente 91/);
 const painted=()=>page.locator('#preview').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const s=new Set();for(let i=0;i<d.length;i+=4*211)s.add(d[i]+','+d[i+1]);return s.size;});
 assert.ok(await painted()>15,'prévia desenhada');
 assert.equal(await page.locator('#procedural').isVisible(),false);
 await page.selectOption('#mapSelect','random'); // o teste também escolhe pelo <select>
 assert.equal(await page.locator('#mapSelect+.pick-grid .pick-card[aria-checked=true]').getAttribute('data-value'),'random');
 assert.equal(await page.locator('#procedural').isVisible(),true);
 assert.equal(await page.locator('#genLandscape+.pick-grid .pick-card').count(),5);
 await page.locator('#genLandscape+.pick-grid .pick-card[data-value=lakes]').click();assert.match(await caption(),/Lagos/);
 await page.locator('#genWater').fill('80');assert.equal(await page.locator('#genWaterOut').textContent(),'80%');
 const lakes=await page.evaluate(()=>setupOptions());assert.deepEqual([lakes.landscape,lakes.water],['lakes',.8]);
 await page.locator('#genPosts+.pick-grid .pick-card[data-value="6"]').click();assert.equal((await page.evaluate(()=>setupOptions())).posts,6);

 // Regras: modo e dificuldade em cartões; a descrição acompanha o modo.
 await page.locator('#tab-rules').click();
 assert.equal(await page.locator('#setupPaneRules').isVisible(),true);assert.equal(await page.locator('#setupPaneTheater').isVisible(),false);
 await page.locator('#modeSelect+.pick-grid .pick-card[data-value=rts]').click();assert.match(await page.locator('#setupDescription').textContent(),/congelar/);
 await page.locator('#difficulty+.pick-grid .pick-card[data-value=hard]').click();assert.equal(await page.locator('#difficulty').inputValue(),'hard');
 assert.equal(await page.locator('#difficulty+.pick-grid .pick-card').count(),4);

 // Forças: doutrinas e times em cartões com sprite.
 await page.locator('#tab-forces').click();
 assert.equal(await page.locator('#playerDoctrine+.pick-grid .pick-card').count(),4);
 await page.locator('#playerDoctrine+.pick-grid .pick-card[data-value=offensive]').click();assert.equal(await page.locator('#playerDoctrine').inputValue(),'offensive');
 assert.equal(await page.locator('#playerArmy+.pick-grid .pick-card canvas').count(),3,'um sprite por time');
 await page.locator('#playerArmy+.pick-grid .pick-card[data-value=franca]').click();assert.equal(await page.evaluate(()=>settings.army),'franca');
 await page.locator('#enemyArmy+.pick-grid .pick-card[data-value=red]').click();assert.equal(await page.evaluate(()=>settings.enemyArmy),'red');
 await page.selectOption('#enemyArmy','auto');assert.equal(await page.locator('#enemyArmy+.pick-grid .pick-card[aria-checked=true]').getAttribute('data-value'),'auto');
 assert.equal(await page.locator('#setupArmy').isVisible(),true);
 // Navegação por teclado entre abas.
 await page.locator('#tab-forces').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#tab-theater').getAttribute('aria-selected'),'true');

 // Iniciar operação usa o que foi escolhido.
 await page.getByRole('button',{name:'Iniciar operação'}).click();
 const game=await page.evaluate(()=>({map:game.map,mode:game.mode,difficulty:game.difficulty,seed:game.seed,landscape:game.landscape,water:game.options.water}));
 assert.deepEqual([game.map,game.mode,game.difficulty,game.seed],['random','rts','hard',91]);assert.equal(game.landscape,'lakes');assert.equal(game.water,.8);
 // Reabrir volta para a aba Teatro.
 await page.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());openSetup();});
 assert.equal(await page.locator('#tab-theater').getAttribute('aria-selected'),'true');

 assert.deepEqual(errors,[]);assert.deepEqual(network,[],'nenhuma requisição de rede');
 console.log('OK Nova operação: abas, cartões espelhando select, prévia grande e início com as escolhas.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
