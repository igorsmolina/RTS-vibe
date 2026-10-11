'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');
const { createMultiplayerServer } = require('../scripts/multiplayer-server.cjs');

// Integração de dois clientes independentes com o servidor e motor reais.
// Casos funcionais; nenhum benchmark, estresse ou medição de desempenho.
(async () => {
  const service = createMultiplayerServer();
  await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${service.server.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map(context => context.newPage()));
    const errors = [];
    for (const page of pages) {
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && message.text().startsWith('Multiplayer:')) errors.push(message.text()); });
    }
    await Promise.all(pages.map(page => page.goto(origin)));
    const [blue, red] = pages;
    const advance = (g, ticks) => { for (let i = 0; i < ticks; i++) g.update(1 / 30); };
    const open = async (page, nickname) => {
      await page.goto(origin);
      await page.locator('#titleMultiplayer').click();
      await page.locator('#mpNickname').fill(nickname);
    };
    const gameReady = page => page.waitForFunction(() => started && game.multiplayer && game.networkClient);
    const checks = [];
    const images = path.join(__dirname, '../test-output/multiplayer');
    fs.mkdirSync(images, { recursive: true });
    for (const map of ['river', 'desert', 'mountain', 'random']) for (const mode of ['rts', 'turns']) {
      await open(blue, 'Anfitrião');
      await blue.locator('#mpCreate').click();
      await blue.waitForFunction(() => Multiplayer.session && Multiplayer.connected && Multiplayer.room);
      const code = await blue.evaluate(() => Multiplayer.session.code);
      await open(red, 'Convidado');
      await red.locator('#mpCode').fill(code);
      await red.locator('#mpJoin').click();
      await red.waitForFunction(() => Multiplayer.session && Multiplayer.connected && Multiplayer.room);
      await blue.locator('#mpMap').selectOption(map);
      await blue.locator('#mpMode').selectOption(mode);
      await blue.waitForFunction(({ map, mode }) => Multiplayer.room.config.map === map && Multiplayer.room.config.mode === mode, { map, mode });
      await red.waitForFunction(({ map, mode }) => Multiplayer.room.config.map === map && Multiplayer.room.config.mode === mode, { map, mode });
      assert.equal(await red.locator('#mpMap').isDisabled(), true);
      await red.locator('#mpArmy').click();
      assert.equal(await red.locator('#armyUnits [data-army=fighterRed]').count(), 1);
      assert.equal(await red.locator('#armyUnits [data-army=bomberRed]').count(), 1);
      assert.equal(await red.locator('#armyUnits [data-army=stealthFighterRed]').count(), 1);
      assert.equal(await red.locator('#armyUnits [data-army=stealthFighterBlue]').count(), 0);
      assert.equal(await red.locator('#armyUnits [data-army=fighterBlue]').count(), 0);
      await red.locator('#cancelArmy').click();
      if (map === 'river' && mode === 'rts') await blue.screenshot({ path: path.join(images, 'sala-desktop.png') });
      await blue.locator('#mpReady').click();
      await red.locator('#mpReady').click();
      await blue.waitForFunction(() => !document.getElementById('mpStart').disabled);
      await blue.locator('#mpStart').click();
      await Promise.all(pages.map(gameReady));
      assert.equal(await blue.evaluate(() => localPlayerSide()), 'blue');
      assert.equal(await red.evaluate(() => localPlayerSide()), 'red');
      const room = service.rooms.get(code), g = room.game;
      assert.ok(g && g.multiplayer && !g.aiEnabled);
      assert.equal(g.map, map); assert.equal(g.mode, mode);
      const cells = new Set();
      for (const s of g.structures) for (let y = s.y; y < s.y + s.height; y++) for (let x = s.x; x < s.x + s.width; x++) {
        const cell = y * 128 + x;
        assert.ok(x >= 0 && y >= 0 && x < 128 && y < 96 && !cells.has(cell));
        assert.ok(!['river', 'mountain'].includes(g.terrain[cell])); cells.add(cell);
      }
      await blue.evaluate(() => setSelection([game.hq('blue').id]));
      const before = g.credits.blue, count = g.units.filter(u => u.owner === 'blue' && u.type === 'infantry').length;
      await blue.locator('[data-recruit=infantry]').click();
      await blue.waitForFunction(() => game.hq('blue').queue.length === 1);
      assert.equal(g.credits.blue, before - 50);
      await red.evaluate(() => setSelection([game.hq('red').id]));
      assert.equal(await red.evaluate(() => selectedProducer().owner), 'red');
      if (mode === 'turns') {
        assert.equal(await red.evaluate(() => canCommand()), false);
        await blue.locator('#endTurn').click();
        await red.waitForFunction(() => game.turn === 'red' && !game.busy);
        advance(g, 30); service.broadcast(room);
        assert.equal(g.turn, 'red', 'O humano vermelho conserva seu turno');
        await red.locator('[data-recruit=infantry]').click();
        await red.waitForFunction(() => game.hq('red').queue.length === 1);
        await red.locator('#endTurn').click();
        await blue.waitForFunction(() => game.turn === 'blue' && game.round === 2 && !game.busy);
      } else {
        await red.locator('[data-recruit=infantry]').click();
        await red.waitForFunction(() => game.hq('red').queue.length === 1);
        await blue.keyboard.press('p');
        assert.equal(await blue.evaluate(() => paused), false);
        assert.equal(await blue.locator('#speed').isDisabled(), true);
        await blue.evaluate(() => openMenu('settings'));
        assert.equal(await blue.evaluate(() => paused), false);
        await blue.evaluate(() => closeMenu('settings'));
        advance(g, 301); service.broadcast(room);
      }
      await blue.waitForFunction(count => game.units.filter(u => u.owner === 'blue' && u.type === 'infantry').length > count, count);
      const own = g.units.filter(u => u.owner === 'blue' && u.type === 'infantry');
      const movable = own.map(u => ({ u, goal: [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: u.x + dx, y: u.y + dy })).find(p => p.x >= 0 && p.y >= 0 && p.x < 128 && p.y < 96 && !g.structureAt(p.x, p.y) && !g.occupied(p.x, p.y, u) && Number.isFinite(g.cost(u, p.x, p.y))) })).find(v => v.goal);
      assert.ok(movable);
      await blue.evaluate(({ id, goal }) => { setSelection([id]); game.command([id], 'move', goal); }, { id: movable.u.id, goal: movable.goal });
      await blue.waitForFunction(id => game.get(id).order.type === 'move' || game.get(id).pending, movable.u.id);
      advance(g, 180); service.broadcast(room);
      await blue.waitForFunction(({ id, goal }) => Math.abs(game.get(id).x - goal.x) < .01 && Math.abs(game.get(id).y - goal.y) < .01, { id: movable.u.id, goal: movable.goal });
      assert.equal(movable.u.x, movable.goal.x); assert.equal(movable.u.y, movable.goal.y);
      const invisible = g.units.find(u => u.owner === 'red' && !g.isVisible('blue', u) && !g.radarContact('blue', u));
      if (invisible) assert.equal(await blue.evaluate(id => !!game.get(id), invisible.id), false, 'Inimigo oculto ausente no cliente');
      for(const [page,side] of [[blue,'blue'],[red,'red']])for(const type of ['helicopter','helicopterGround','helicopterAir']){
        const base=g.hq(side),heli=g.add(side,type,Math.min(127,base.x+4),Math.min(95,base.y+4));g.updateVision();service.broadcast(room);
        await page.waitForFunction(id=>!!game.get(id),heli.id);await page.evaluate(id=>{setSelection([id]);updateUI();},heli.id);
        const info=await page.locator('#unitInfo').textContent();assert.ok(info.includes(type==='helicopter'?'Minigun':'Canhão'));assert.ok(info.includes(type==='helicopter'?'0,2 s':'1 s'));
        if(type!=='helicopter'){
          assert.equal(await page.locator('#weaponGun').textContent(),'Canhão');
          if(mode==='rts'||g.turn===side&&!g.busy){await page.locator('#weaponGun').click();await page.waitForFunction(id=>game.get(id).weaponMode==='gun',heli.id);assert.equal(heli.weaponMode,'gun');}
        }
      }
      if (map === 'river' && mode === 'rts') {
        for (let y = 54; y < 69; y++) for (let x = 74; x < 94; x++) g.terrain[y * 128 + x] = 'plain';
        const airport = g.add('red', 'airportAsphalt', 80, 60);
        g.credits.red = 5000; g.updateVision(); service.broadcast(room);
        await red.waitForFunction(id => !!game.get(id), airport.id);
        await red.evaluate(id => setSelection([id]), airport.id);
        assert.equal(await red.locator('[data-recruit=fighterRed]').isVisible(), true);
        assert.equal(await red.locator('[data-recruit=fighterBlue]').isVisible(), false);
        const price = g.recruitCost('fighterRed', airport), credits = g.credits.red;
        await red.locator('[data-recruit=fighterRed]').click();
        await red.waitForFunction(id => game.get(id).queue.length === 1, airport.id);
        assert.equal(g.credits.red, credits - price, 'Compra do avião vermelho pelo preço de concreto');
        advance(g, Math.ceil(g.trainDuration('fighterRed') * 30) + 3); service.broadcast(room);
        const plane = g.units.find(u => u.owner === 'red' && u.type === 'fighterRed');
        assert.ok(plane && plane.flightState === 'grounded');
        await red.waitForFunction(id => !!game.get(id), plane.id);
        await red.evaluate(id => setSelection([id]), plane.id);
        assert.doesNotMatch(await red.locator('#unitName').textContent(), /inimigo/i, 'A aeronave própria tem nome de aliada');
        assert.match(await red.locator('#nationHeaderName').textContent(), /Vermelho/i, 'Cabeçalho identifica a equipe local');
        await red.locator('#planeTakeoff').click();
        await red.waitForFunction(id => !!game.get(id).runway, plane.id);
        advance(g, 200); service.broadcast(room);
        await red.waitForFunction(id => AIR(game.get(id)) && !game.get(id).runway, plane.id);
        assert.equal(await red.evaluate(id => game.get(id).owner, plane.id), 'red');
        await red.evaluate(id => { settings.graphics = 'cinematic'; centerCamera(game.get(id).x, game.get(id).y); }, plane.id);
        await red.screenshot({ path: path.join(images, 'aviao-vermelho-desktop.png') });
        await red.setViewportSize({ width: 390, height: 844 });
        await red.screenshot({ path: path.join(images, 'aviao-vermelho-mobile.png') });
        await red.setViewportSize({ width: 1280, height: 720 });
        await red.locator('#planeReturn').click();
        await red.waitForFunction(id => game.get(id).flightJob?.type === 'return' || !!game.get(id).runway, plane.id);
        for (let i = 0; i < 900 && plane.flightState !== 'grounded'; i++) g.update(1 / 30);
        service.broadcast(room);
        await red.waitForFunction(id => game.get(id).flightState === 'grounded' && !game.get(id).runway, plane.id);
      }
      if(map==='river'&&mode==='rts'){
        for(const [page,side,x]of [[blue,'blue',40],[red,'red',80]]){
          for(let y=56;y<68;y++)for(let xx=x-2;xx<x+12;xx++)g.terrain[y*128+xx]='plain';
          const base=g.structures.find(s=>s.owner===side&&s.type==='airportAsphalt'&&s.x===x)||g.add(side,'airportAsphalt',x,60);g.credits[side]=5000;g.updateVision();service.broadcast(room);await page.waitForFunction(id=>!!game.get(id),base.id);await page.evaluate(id=>setSelection([id]),base.id);
          const fighter=side==='blue'?'stealthFighterBlue':'stealthFighterRed',bomber=side==='blue'?'bomberBlue':'bomberRed';
          for(const type of [fighter,bomber]){const price=g.recruitCost(type,base),before=g.credits[side],button=page.locator('[data-recruit='+type+']');assert.equal(await button.isVisible(),true);assert.match(await button.locator('strong').textContent(),new RegExp(String(price)));await button.click();await page.waitForFunction(({id,type})=>game.get(id).queue.some(q=>q.type===type),{id:base.id,type});assert.equal(g.credits[side],before-price);}
          g.production(side,50);g.production(side,80);g.updateVision();service.broadcast(room);const stealth=g.units.find(u=>u.type===fighter),heavy=g.units.find(u=>u.type===bomber);assert.ok(stealth&&heavy);await page.waitForFunction(id=>!!game.get(id),heavy.id);
          await page.evaluate(id=>{setSelection([id]);updateUI();},stealth.id);assert.match(await page.locator('#unitRole').textContent(),/Furtivo ao radar/);assert.match(await page.locator('#planeWeapons').textContent(),/Ar-ar 6\/6/);assert.match(await page.locator('#planeWeapons').textContent(),/Metralhadora 80\/80/);
          await page.evaluate(id=>{setSelection([id]);updateUI();},heavy.id);assert.equal(await page.locator('#bomberPanel').count(),0);const count=side==='red'?48:6;assert.equal(await page.locator('#planeBombCount option[value="48"]').evaluate(e=>e.disabled),side==='blue',JSON.stringify(await page.evaluate(()=>({side:localPlayerSide(),units:selectedUnits().map(u=>u.type),html:$('planeBombCount').outerHTML}))));await page.locator('#planeBombCount').selectOption(String(count));await page.locator('#planeTakeoff').click();await page.waitForFunction(id=>!!game.get(id).runway,heavy.id);advance(g,450);service.broadcast(room);await page.waitForFunction(id=>AIR(game.get(id))&&!game.get(id).runway,heavy.id);
          await page.locator('#planeBomb').click();await page.locator('#bombCoordinates summary').click();await page.locator('#lineX1').fill(String(x+11));await page.locator('#lineY1').fill('38');await page.locator('#lineX2').fill(String(x+19));await page.locator('#lineY2').fill('38');await page.locator('#confirmBombLine').click();await page.waitForFunction(id=>game.get(id).flightJob?.type==='bombRun',heavy.id);assert.equal(heavy.flightJob.bombs.length,count);assert.ok(heavy.flightJob.bombs.slice(0,3).join(',')==='bombCommon,bombFragment,bombIncendiary');g.order(heavy,'stop');g.updateVision();service.broadcast(room);
        }
        checks.push('novos modelos e salvas nos dois clientes');
      }
      if (map === 'random' && mode === 'rts') {
        await red.evaluate(() => Multiplayer.socket.close());
        await blue.waitForFunction(() => game.paused);
        const frozen = g.time;
        service.tick(); service.tick();
        assert.equal(g.time, frozen, 'Desconexão congela a simulação');
        await Promise.all(pages.map(page => page.waitForFunction(() => Multiplayer.connected && !game.paused)));
        assert.equal(await red.evaluate(() => Multiplayer.session.side), 'red');
      }
      const career = await blue.evaluate(() => profile.stats.matches);
      for (const s of [...g.structures]) if (s.owner === 'red') g.hurt(s, s.hp, null);
      advance(g, 1); service.broadcast(room);
      await Promise.all(pages.map(page => page.waitForFunction(() => game.winner === 'blue')));
      assert.equal(await blue.evaluate(() => profile.stats.matches), career, 'PvP não grava campanha solo');
      assert.equal(await blue.locator('#result').getAttribute('data-result'), 'win');
      assert.equal(await red.locator('#result').getAttribute('data-result'), 'loss');
      if (map === 'random' && mode === 'turns') {
        await blue.locator('#playAgain').click();
        await red.locator('#playAgain').click();
        await blue.waitForFunction(() => Multiplayer.room.status === 'waiting' && Multiplayer.session.side === 'red');
        await red.waitForFunction(() => Multiplayer.room.status === 'waiting' && Multiplayer.session.side === 'blue');
        assert.equal(await blue.locator('#mpStart').isVisible(), true, 'Anfitrião conserva o controle após trocar de lado');
        await blue.locator('#mpArmy').click();
        assert.equal(await blue.locator('#armyUnits [data-army=fighterRed]').count(), 1);
        await blue.locator('#cancelArmy').click();
      }
      await blue.evaluate(() => Multiplayer.leave());
      await red.evaluate(() => Multiplayer.leave());
      if (map === 'river' && mode === 'rts') {
        await blue.locator('#titleMultiplayer').click();
        assert.equal(await blue.locator('#mpCreate').isDisabled(), false, 'Sair permite criar outra sala sem recarregar');
        assert.equal(await blue.locator('#mpJoin').isDisabled(), false);
        await blue.locator('#mpBack').click();
      }
      await Promise.all(contexts.map(context => context.clearCookies()));
      await Promise.all(pages.map(page => page.evaluate(() => sessionStorage.clear())));
      checks.push(`${map}/${mode}`);
      console.log('OK integração multiplayer', `${map}/${mode}`);
    }
    // Reinício real do serviço: o cliente tenta retomar e recebe sala inexistente.
    await open(blue, 'Anfitrião'); await blue.locator('#mpCreate').click();
    await blue.waitForFunction(() => Multiplayer.session && Multiplayer.connected && Multiplayer.room);
    const expiredCode = await blue.evaluate(() => Multiplayer.session.code);
    await open(red, 'Convidado'); await red.locator('#mpCode').fill(expiredCode); await red.locator('#mpJoin').click();
    await red.waitForFunction(() => Multiplayer.session && Multiplayer.connected && Multiplayer.room);
    await blue.locator('#mpReady').click(); await red.locator('#mpReady').click();
    await blue.waitForFunction(() => !document.getElementById('mpStart').disabled);
    await blue.locator('#mpStart').click(); await Promise.all(pages.map(gameReady));
    const port = service.server.address().port;
    await service.close();
    const restarted = createMultiplayerServer();
    await new Promise(resolve => restarted.server.listen(port, '127.0.0.1', resolve));
    try {
      await Promise.all(pages.map(page => page.waitForFunction(() => !Multiplayer.session && document.getElementById('mpStatus').textContent.includes('reiniciado'))));
      assert.equal(restarted.rooms.size, 0);
      assert.equal(await blue.locator('#mpCreate').isDisabled(), false);
      assert.equal(await blue.evaluate(() => game.multiplayer), false);
      assert.ok(expiredCode);
    } finally { await restarted.close(); }
    const offline = await browser.newContext();
    try {
      await offline.setOffline(true); const page = await offline.newPage();
      const remote = []; page.on('request', request => { if (/^https?:/.test(request.url())) remote.push(request.url()); });
      await page.goto(pathToFileURL(path.join(__dirname, '../public/index.html')).href);
      await page.locator('#titleMultiplayer').click();
      assert.match(await page.locator('#mpStatus').textContent(), /versão online/);
      assert.equal(await page.locator('#mpCreate').isDisabled(), true);
      assert.deepEqual(remote, [], 'Fallback offline não tenta uma conexão inexistente');
    } finally { await offline.close(); }
    assert.deepEqual(errors, []);
    console.log('OK dois navegadores, sala, catálogo vermelho, preparação, geração, compra, turno, movimento, privacidade, resultado e modo solo:', checks.join(', '));
  } finally {
    await browser.close();
    await service.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
