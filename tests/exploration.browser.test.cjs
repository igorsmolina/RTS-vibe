'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.context().setOffline(true);
 await page.goto(pathToFileURL(path.join(__dirname,'..','public','index.html')).href);await page.evaluate(()=>terrainReady);
 const result=await page.evaluate(()=>{
  for(const d of document.querySelectorAll('dialog[open]'))d.close();
  newOperation('random','normal',71,'rts',{water:0,forest:0,relief:0,farmland:100,posts:2});paused=true;game.aiEnabled=false;
  game.units=[];game.structures=[];game.terrain.fill('field');game.mines=[];game.memory.blue.clear();setSelection([]);
  cam.zoom=.35;renderer.rebuild();const timings=[];let reads=0;
  const terrain=game.terrain;game.terrain=new Proxy(terrain,{get(a,k){if(typeof k==='string'&&/^\d+$/.test(k))reads++;return a[k];}});
  for(const known of [12,30,60,100]){
   game.explored.blue.fill(false);game.visible.blue.fill(false);
   for(let y=0;y<ROWS;y++)for(let x=0;x<known;x++)game.explored.blue[KEY(x,y)]=true;
   centerCamera(known-1,48);renderer.draw(0);reads=0;renderer.draw(0);const terrainReads=reads;
   const observed=game.terrain;game.terrain=terrain;const start=performance.now();
   for(let i=0;i<5;i++)renderer.draw(0);
   timings.push({knownColumns:known,ms:(performance.now()-start)/5,terrainReads});game.terrain=observed;
  }
  game.terrain=terrain;
  // Newly explored cells must update the crop root; hidden terrain must not affect it.
  game.terrain.fill('plain');game.explored.blue.fill(false);game.visible.blue.fill(false);
  for(let x=19;x<=21;x++)game.terrain[KEY(x,20)]='field';
  game.explored.blue[KEY(21,20)]=true;centerCamera(21,20);renderer.paintGround();renderer.draw(0);
  const before=renderer.canvas.toDataURL();game.terrain[KEY(22,20)]='field';renderer.paintGround();renderer.draw(0);
  const hiddenSafe=before===renderer.canvas.toDataURL();
  game.explored.blue[KEY(19,20)]=game.explored.blue[KEY(20,20)]=true;renderer.draw(0);
  const fresh=renderer.canvas.toDataURL();renderer.paintGround();renderer.draw(0);
  return{timings,hiddenSafe,updated:fresh===renderer.canvas.toDataURL(),limit:SIZE*8};
 });
 console.log(JSON.stringify(result,null,2));
 assert.ok(result.timings.every(t=>t.terrainReads<result.limit),'Desenho repetido nao deve percorrer cada lote inteiro para cada casa na borda da nevoa');
 assert.ok(result.hiddenSafe,'Campos desconhecidos nao alteram pixels explorados');assert.ok(result.updated,'Exploracao atualiza o cache sem precisar reconstruir o renderer');
 const movement=await page.evaluate(()=>{
  newOperation('random','normal',83,'rts',{posts:2});paused=true;game.aiEnabled=false;
  game.units=[];game.structures=[];game.mines=[];game.terrain.fill('field');game.explored.blue.fill(false);
  game.add('blue','hq',1,94);game.add('red','hq',126,1);game.add('red','infantry',126,2);const scout=game.add('blue','recon',30,48);
  game.updateVision();renderer.rebuild();centerCamera(scout.x,scout.y);const before=game.explored.blue.filter(Boolean).length;
  const accepted=game.order(scout,'move',{x:38,y:48}),drawTimes=[];
  for(let i=0;i<180;i++){game.update(STEP);renderer.consume();const t=performance.now();renderer.draw(STEP);drawTimes.push(performance.now()-t);}
  drawTimes.sort((a,b)=>a-b);return{accepted,x:scout.x,more:game.explored.blue.filter(Boolean).length>before,medianMs:drawTimes[90],maxMs:drawTimes.at(-1)};
 });
 assert.ok(movement.accepted&&movement.more,JSON.stringify(movement));assert.equal(movement.x,38);console.log('Batedor em movimento: '+JSON.stringify(movement));
 const frozen=await page.evaluate(()=>JSON.stringify(game.units));await page.waitForTimeout(280);assert.equal(await page.evaluate(()=>JSON.stringify(game.units)),frozen,'Pausa tatica preserva unidades');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{centerCamera(38,48);renderer.draw(0);});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('OK exploracao RTS offline: trabalho limitado, nevoa, movimento, pausa e tela pequena');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
