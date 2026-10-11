// Painel próprio do avião no Chrome real, offline: botões por estado, armas com munição, sem duplicação com a barra geral,
// motivo escrito nas ações indisponíveis, ataque por aposta pelo clique e lista de alvos com contato aéreo de radar.
'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.context().setOffline(true);await page.goto(pathToFileURL(path.join(root,'public','index.html')).href);await page.evaluate(()=>terrainReady);
 const visible=async ids=>Object.fromEntries(await Promise.all(ids.map(async id=>[id,await page.locator('#'+id).isVisible()])));
 const fresh=()=>page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();newOperation('river','normal',123,'rts',{posts:2});paused=true;game.aiEnabled=false;game.terrain.fill('plain');
  game.credits.blue=10000;const a=game.add('blue','airportDirt',8,84),grounded=game.add('blue','fighterBlue',9,84);grounded.flightState='grounded';grounded.airportId=a.id;grounded.altitude='low';
  const multi=game.add('blue','multiroleBlue',30,70);multi.facing=Math.PI/2;game.terrain[70*128+60]='forest';game.updateVision();centerCamera(30,70);updateUI();return{grounded:grounded.id,multi:multi.id,airport:a.id};});
 const ids=await fresh();
 // 1. No solo: só Decolar e Manutenção, sem Patrulhar/Investida/Retornar.
 await page.evaluate(id=>{setSelection([id]);},ids.grounded);
 let v=await visible(['planeTakeoff','planeService','planePatrol','planeStrike','planeReturn']);
 assert.deepEqual(v,{planeTakeoff:true,planeService:true,planePatrol:false,planeStrike:false,planeReturn:false},'no solo');
 // 2. Em voo: Patrulhar, Investida, Retornar; Decolar e Manutenção somem; sem Mover/Atacar duplicados na barra geral.
 await page.evaluate(id=>{setSelection([id]);},ids.multi);
 v=await visible(['planeTakeoff','planeService','planePatrol','planeStrike','planeReturn','planeBomb','move','attackMove']);
 assert.deepEqual(v,{planeTakeoff:false,planeService:false,planePatrol:true,planeStrike:true,planeReturn:true,planeBomb:false,move:false,attackMove:false},'em voo');
 // O painel não pode vazar o cache interno como texto (data-key é o atalho exibido pelo CSS).
 assert.equal(await page.locator('#planeWeapons').getAttribute('data-key'),null);assert.doesNotMatch(await page.locator('#planeControls').innerText(),/\{"w"/);
 // 3. Armas em botões com munição; arma sem munição riscada e desabilitada; clicar muda o seletor escondido.
 const weapons=await page.locator('#planeWeapons button').evaluateAll(bs=>bs.map(b=>({w:b.dataset.weapon,text:b.textContent,pressed:b.getAttribute('aria-pressed'),disabled:b.disabled})));
 assert.deepEqual(weapons.map(b=>b.w),['auto','jetAam','antiRadiation','jetAgm','jetGun']);assert.match(weapons.find(b=>b.w==='jetAgm').text,/4\/4/);assert.match(weapons.find(b=>b.w==='jetGun').text,/80\/80/);
 await page.locator('#planeWeapons [data-weapon="jetAgm"]').click();assert.equal(await page.locator('#planeWeapon').inputValue(),'jetAgm');
 assert.equal(await page.locator('#planeWeapons [data-weapon="jetAgm"]').getAttribute('aria-pressed'),'true');
 await page.evaluate(id=>{game.get(id).ammo.jetAam=0;updateUI();},ids.multi);
 assert.equal(await page.locator('#planeWeapons [data-weapon="jetAam"]').isDisabled(),true);assert.match(await page.locator('#planeWeapons [data-weapon="jetAam"]').getAttribute('class'),/empty/);
 // 4. Salva em botões, visível para mísseis.
 assert.equal(await page.locator('#planeSalvoButtons').isVisible(),true);await page.locator('#planeSalvoButtons [data-salvo="2"]').click();assert.equal(await page.locator('#planeSalvo').inputValue(),'2');
 // 5. Motivo escrito: sem aeroporto aliado, Retornar fica desabilitado e o painel diz por quê.
 await page.evaluate(()=>{game.structures=game.structures.filter(s=>!/airport/.test(s.type));game.updateVision();updateUI();});
 assert.equal(await page.locator('#planeReturn').isDisabled(),true);assert.match(await page.locator('#planeReasons').textContent(),/sem aeroporto aliado/);
 // 6. Aposta pelo clique: Investida numa casa na névoa (fora da visão) vira strikeCell; casa visível com inimigo continua ataque normal.
 const bet=await page.evaluate(id=>{const p=game.get(id);p.ammo.jetAgm=4;game.add('red','tank',60,70);game.updateVision();setSelection([id]);mode='attack';hover={x:60,y:70};
  const foggy=!game.visible.blue[KEY(60,70)];issueAt({x:60,y:70});return{foggy,job:p.flightJob?.type,order:p.order.type};},ids.multi);
 assert.equal(bet.foggy,true);assert.equal(bet.job,'cellStrike');
 // 7. Marca de aposta no mapa só sobre a névoa e com Investida ativa.
 const marks=await page.evaluate(()=>{setSelection([ids0()]);function ids0(){return game.units.find(u=>u.type==='multiroleBlue').id;}mode='attack';hover={x:80,y:50};renderer.draw(0);const fog=renderer.betMark;hover={x:31,y:70};renderer.draw(0);const seen=renderer.betMark;mode=null;renderer.draw(0);return{fog,seen,off:renderer.betMark};});
 assert.deepEqual(marks.fog,{x:80,y:50});assert.equal(marks.seen,null);assert.equal(marks.off,null);
 // 8. Alvos conhecidos: contato aéreo de radar aparece na lista e o botão Atacar depende do alcance.
 await page.evaluate(()=>{const p=game.add('blue','fighterBlue',30,50),h=game.add('red','helicopter',43,50);p.facing=Math.PI/2;h.altitude='low';game.updateVision();setSelection([p.id]);updateUI();window.__contact=game.radarContact('blue',h);});
 assert.equal(await page.evaluate(()=>window.__contact),true,'o caça tem contato de radar com o helicóptero');
 await page.locator('#emitterPanel').evaluate(e=>e.open=true);
 const rows=page.locator('#emitterList .emitter-row');assert.equal(await rows.count(),1);assert.match(await rows.nth(0).textContent(),/Contato aéreo/);
 assert.equal(await rows.nth(0).locator('[data-emitter-attack]').isDisabled(),false);
 assert.deepEqual(errors,[]);
 console.log('OK painel do avião: estados, armas com munição, salva, motivos, aposta pelo clique, marca no mapa e alvos aéreos.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
