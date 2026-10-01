// npm run test:browser — controles no Google Chrome instalado, offline. PLAYWRIGHT_MODULE pode apontar para outra instalação de Playwright.
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.context().setOffline(true);await page.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);
  assert.equal(await page.title(),'War Grid — Fronteiras RTS');assert.equal(await page.locator('#setup').evaluate(e=>e.open),true);
  await page.locator('#seed').fill('17');await page.getByRole('button',{name:'Iniciar operação'}).click();
  assert.equal(await page.locator('#speed').textContent(),'0,5×');
  await page.evaluate(()=>{paused=true;updateUI();});
  const slowTime=await page.evaluate(()=>game.time);await page.locator('#pause').click();await page.waitForTimeout(600);
  const slowElapsed=await page.evaluate(t=>game.time-t,slowTime);assert.ok(slowElapsed>=.2&&slowElapsed<.45,'0,5× avança cerca de metade do tempo real');
  for(const label of ['1×','2×','0,25×','0,5×']){await page.locator('#speed').click();assert.equal(await page.locator('#speed').textContent(),label);}
  await page.locator('#speed').click(); // Verificações existentes em ritmo 1×.
  await page.evaluate(()=>{game.aiEnabled=false;game.terrain.fill('plain');game.mines=[];renderer.rebuild();});
  async function point(x,y){const r=await page.locator('#battlefield').boundingBox();return{x:r.x+(x+.5)*r.width/18,y:r.y+(y+.5)*r.height/14};}
  async function click(x,y,button='left'){const p=await point(x,y);await page.mouse.click(p.x,p.y,{button});}
  const a=await point(.4,9.4),b=await point(4.5,12.5);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();
  assert.equal(await page.evaluate(()=>selection.size),7);await page.keyboard.press('Control+1');assert.equal(await page.evaluate(()=>groups[0].length),7);
  await click(9,12);assert.equal(await page.evaluate(()=>selection.size),0);await page.keyboard.press('1');assert.equal(await page.evaluate(()=>selection.size),7);
  const before=await page.evaluate(()=>selectedUnits().map(u=>({id:u.id,x:u.x,y:u.y})));
  await click(7,11,'right');assert.ok(await page.evaluate(()=>selectedUnits().every(u=>u.order.type==='move')));
  await page.waitForTimeout(450);assert.ok(await page.evaluate(before=>before.some(p=>{const u=game.get(p.id);return u.x!==p.x||u.y!==p.y;}),before));
  await page.keyboard.press('s');const stopped=await page.evaluate(()=>selectedUnits().map(u=>[u.x,u.y]));await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>selectedUnits().map(u=>[u.x,u.y])),stopped);
  await page.keyboard.press('a');await click(8,10);assert.ok(await page.evaluate(()=>selectedUnits().every(u=>u.order.type==='attackMove')));await page.keyboard.press('s');
  console.log('OK clique, arrasto, Ctrl+1/1, botão direito, A e S');
  await page.locator('[data-recruit="infantry"]').click();assert.equal(await page.evaluate(()=>game.hq('blue').queue.length),1);
  await page.waitForFunction(()=>game.hq('blue').queue.length===0,{},{timeout:10000});assert.equal(await page.evaluate(()=>game.units.filter(u=>u.owner==='blue').length),8);
  await page.locator('#pause').click();const frozen=await page.evaluate(()=>game.time);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>game.time),frozen);
  await page.locator('#pause').click();await page.locator('#help').click();const menuTime=await page.evaluate(()=>game.time);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>game.time),menuTime);await page.locator('#closeHelp').click();assert.equal(await page.evaluate(()=>paused),false);
  console.log('OK produção com tempo real, pausa e manual');
  await page.evaluate(()=>{
   newOperation('desert','normal',19);game.aiEnabled=false;game.terrain.fill('plain');game.units=[];game.mines=[];
   game.add('blue','artillery',4,7);game.add('red','hq',6,7);game.add('red','infantry',17,1);game.rng=()=>.2;game.updateVision();renderer.rebuild();setSelection([game.units[0].id]);
  });
  await page.waitForFunction(()=>game.projectiles.some(p=>p.type==='artillery'),{},{timeout:5000});
  assert.equal(await page.evaluate(()=>game.structureAt(6,7).hp),300);await page.waitForFunction(()=>game.structureAt(6,7)?.hp<300);
  await page.evaluate(()=>{newOperation('river','normal',21);game.aiEnabled=false;});await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>game.projectiles.length),0);assert.ok(await page.evaluate(()=>game.all().every(u=>u.hp===u.maxHp)));
  console.log('OK artilharia com armação, impacto atrasado e reinício seguro');
  await page.evaluate(()=>{
   newOperation('desert','normal',19);game.aiEnabled=false;game.terrain.fill('plain');game.units=[];game.structures=[];game.mines=[];
   game.add('blue','hq',0,13);game.add('red','hq',17,0);game.add('red','infantry',17,1);
   const infantry=game.add('blue','infantry',4,7);game.add('red','post',5,7);game.updateVision();renderer.rebuild();setSelection([infantry.id]);
  });
  await click(5,7,'right');assert.equal(await page.evaluate(()=>selectedUnits()[0].order.type),'capture');
  await page.waitForFunction(()=>game.structureAt(5,7)?.owner==='blue',{},{timeout:6000});
  console.log('OK botão direito captura posto inimigo com infantaria');
  await page.evaluate(()=>{
   newOperation('desert','normal',19);game.terrain.fill('plain');game.units=[];game.structures=[];game.mines=[];game.credits.blue=500;
   game.add('blue','hq',0,13);game.add('red','hq',17,0);game.add('red','infantry',17,1);
   game.add('blue','infantry',4,7);game.add('blue','engineer',6,7);game.add('blue','tank',7,7).hp=100;
   game.add('blue','infantry',10,10);game.add('neutral','post',4,5);game.updateVision();renderer.rebuild();
  });
  await page.keyboard.press('p');assert.equal(await page.evaluate(()=>paused),true);
  const tacticalTime=await page.evaluate(()=>game.time),aiDecisions=await page.evaluate(()=>game.aiDecisions);
  await click(4,7);await click(4,5,'right');assert.equal(await page.evaluate(()=>selectedUnits()[0].order.type),'capture');
  await page.keyboard.press('s');assert.equal(await page.evaluate(()=>selectedUnits()[0].order.type),'stop');
  await page.keyboard.press('a');await click(8,7);assert.equal(await page.evaluate(()=>selectedUnits()[0].order.type),'attackMove');
  await click(6,7);await page.locator('#repair').click();await click(7,7);assert.equal(await page.evaluate(()=>selectedUnits()[0].order.type),'repair');
  await click(10,10);await page.locator('#build').click();assert.equal(await page.evaluate(()=>selectedUnits()[0].order.type),'build');
  await page.locator('[data-recruit="infantry"]').click();assert.equal(await page.evaluate(()=>game.hq('blue').queue.length),1);
  const snapshot=await page.evaluate(()=>({troops:game.units.map(u=>[u.id,u.x,u.y,u.hp,u.work,u.cooldown]),queue:game.hq('blue').queue[0].progress,credits:{...game.credits}}));
  await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>game.time),tacticalTime);assert.equal(await page.evaluate(()=>game.aiDecisions),aiDecisions);
  assert.deepEqual(await page.evaluate(()=>({troops:game.units.map(u=>[u.id,u.x,u.y,u.hp,u.work,u.cooldown]),queue:game.hq('blue').queue[0].progress,credits:{...game.credits}})),snapshot);
  await page.locator('#help').click();await page.locator('#closeHelp').click();assert.equal(await page.evaluate(()=>paused),true);
  await page.keyboard.press('p');await page.waitForFunction(()=>game.hq('blue').queue[0]?.progress>.1&&game.units.find(u=>u.type==='tank'&&u.owner==='blue').hp>100);
  assert.ok(await page.evaluate(t=>game.time>t,tacticalTime));console.log('OK 0,5×, velocidades, ordens e produção em pausa tática, retomada e IA congelada');
  await page.locator('#newGame').click();await page.locator('#mapSelect').selectOption('random');await page.locator('#difficulty').selectOption('hard');await page.locator('#seed').fill('138');await page.getByRole('button',{name:'Iniciar operação'}).click();assert.equal(await page.evaluate(()=>game.seed),138);assert.equal(await page.evaluate(()=>game.income('red')),18);
  await page.locator('#pause').click();await page.locator('#sound').click();assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'false');assert.ok(await page.evaluate(()=>audio.ctx?.state==='running'));
  for(const width of [1440,1024,768,390,320]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Largura '+width);const map=await page.locator('#battlefield').boundingBox(),dock=await page.locator('.dock').boundingBox();assert.ok(map.width>190);assert.ok(map.y+map.height<=dock.y+1,'Painel não cobre o mapa em '+width);}
  await page.setViewportSize({width:320,height:700});const footer=await page.locator('.under-map').boundingBox(),smallDock=await page.locator('.dock').boundingBox();assert.ok(footer.y+footer.height<=smallDock.y+1,'Painel não cobre a legenda em tela curta');
  if(process.env.SCREENSHOT_DIR){await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'rts-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'rts-mobile.png'),fullPage:true});}
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('OK cinco larguras, áudio inicializado, menus e jogo offline sem erros');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
