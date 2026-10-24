'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright-core');
const { createMultiplayerServer } = require('../scripts/multiplayer-server.cjs');

// Sala com quatro clientes independentes: o quinto é recusado, a partida roda com quatro lados (cantos do mapa),
// cada um só enxerga o que é seu, quem desiste é eliminado e o último que sobra vence.
(async () => {
  const service = createMultiplayerServer();
  await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${service.server.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const contexts = await Promise.all([0, 1, 2, 3, 4].map(() => browser.newContext({ viewport: { width: 1440, height: 900 } })));
    const pages = await Promise.all(contexts.map(context => context.newPage()));
    const errors = [];
    for (const page of pages) {
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && message.text().startsWith('Multiplayer:')) errors.push(message.text()); });
    }
    const [blue, red, green, gold, fifth] = pages, four = pages.slice(0, 4);
    const open = async (page, nickname) => { await page.goto(origin); await page.locator('#titleMultiplayer').click(); await page.locator('#mpNickname').fill(nickname); };
    const joined = page => page.waitForFunction(() => Multiplayer.session && Multiplayer.connected && Multiplayer.room);
    const images = path.join(__dirname, '../test-output/multiplayer');
    fs.mkdirSync(images, { recursive: true });

    await open(blue, 'Anfitrião');
    await blue.locator('#mpCreate').click();
    await joined(blue);
    const code = await blue.evaluate(() => Multiplayer.session.code);
    for (const [page, nickname] of [[red, 'Segundo'], [green, 'Terceiro'], [gold, 'Quarto']]) {
      await open(page, nickname);
      await page.locator('#mpCode').fill(code);
      await page.locator('#mpJoin').click();
      await joined(page);
    }
    await Promise.all(four.map(page => page.waitForFunction(() => Multiplayer.room.players.length === 4)));
    assert.deepEqual(await Promise.all(four.map(page => page.evaluate(() => Multiplayer.session.side))), ['blue', 'red', 'green', 'gold']);
    assert.equal(await gold.locator('#mpPlayers li').count(), 4);
    assert.match(await gold.locator('#mpOwnSide').textContent(), /amarel/i);
    assert.equal(await gold.locator('#mpPlayers li[data-side=gold]').count(), 1);

    // o quinto jogador não entra
    await open(fifth, 'Quinto');
    await fifth.locator('#mpCode').fill(code);
    await fifth.locator('#mpJoin').click();
    await fifth.waitForFunction(() => /cheia|iniciada/i.test(document.getElementById('mpStatus').textContent));
    assert.equal(await fifth.evaluate(() => !!Multiplayer.session), false);

    // o amarelo começa com as roxas; o verde, com os franceses
    await gold.waitForFunction(() => Multiplayer.room.players.find(p => p.side === 'gold').faction === 'roxo' || Multiplayer.room.players.find(p => p.side === 'gold').faction === null);
    await blue.screenshot({ path: path.join(images, 'sala-quatro-jogadores.png') });
    for (const page of four) await page.locator('#mpReady').click();
    await blue.waitForFunction(() => !document.getElementById('mpStart').disabled);
    await blue.locator('#mpStart').click();
    await Promise.all(four.map(page => page.waitForFunction(() => started && game.multiplayer && game.networkClient)));

    const room = service.rooms.get(code), g = room.game;
    assert.deepEqual(g.sides, ['blue', 'red', 'green', 'gold']);
    assert.deepEqual({ ...g.factions }, { blue: 'blue', red: 'red', green: 'franca', gold: 'roxo' });
    const names = { blue: 'Azul', red: 'Vermelho', green: 'Verde', gold: 'Amarelo' };
    for (const [page, side] of [[blue, 'blue'], [red, 'red'], [green, 'green'], [gold, 'gold']]) {
      assert.equal(await page.evaluate(() => localPlayerSide()), side);
      assert.equal(await page.evaluate(() => game.sides.join()), 'blue,red,green,gold');
      assert.equal(await page.evaluate(s => game.units.some(u => u.owner === s) && !!game.hq(s), side), true);
      assert.match(await page.locator('#nationHeaderName').textContent(), new RegExp(names[side]));
      // cada jogador só enxerga a própria base no começo
      assert.equal(await page.evaluate(s => game.units.some(u => u.owner !== s && !u.contactOnly), side), false);
    }
    await gold.screenshot({ path: path.join(images, 'partida-quatro-jogadores-amarelo.png') });

    // o amarelo compra uma tropa e o dinheiro dos outros não aparece
    const credits = g.credits.gold;
    await gold.evaluate(() => setSelection([game.hq('gold').id]));
    await gold.locator('[data-recruit=infantry]').click();
    await gold.waitForFunction(() => game.hq('gold').queue.length === 1);
    assert.equal(g.credits.gold, credits - 50);
    assert.equal(await gold.evaluate(() => game.credits.blue), 0);

    // desistências: amarelo, verde e vermelho saem em sequência e o azul vence
    for (const [page, side] of [[gold, 'gold'], [green, 'green']]) {
      await page.evaluate(() => Multiplayer.surrender());
      await page.waitForFunction(() => game.winner === 'eliminated' && document.getElementById('result').open);
      assert.equal(room.status, 'playing');
      assert.equal(g.isOut(side), true);
    }
    await Promise.all([blue, red].map(page => page.waitForFunction(() => game.out.includes('green') && game.out.includes('gold') && !game.winner)));
    await red.evaluate(() => Multiplayer.surrender());
    await blue.waitForFunction(() => game.winner === 'blue' && document.getElementById('result').open);
    assert.equal(room.status, 'finished');
    assert.deepEqual({ ...room.result }, { winner: 'blue', reason: 'surrender' });

    // revanche com os quatro: os lados giram
    await Promise.all(four.map(page => page.evaluate(() => { if (document.getElementById('result').open) document.getElementById('result').close(); })));
    for (const page of four) await page.evaluate(() => Multiplayer.rematch());
    await blue.waitForFunction(() => Multiplayer.room.status === 'waiting' && Multiplayer.room.players.length === 4);
    assert.deepEqual(await Promise.all(four.map(page => page.evaluate(() => Multiplayer.session.side))), ['red', 'green', 'gold', 'blue']);

    assert.deepEqual(errors, []);
    console.log('OK multiplayer com quatro jogadores: sala, quinto recusado, partida, compra, eliminações, vitória e revanche');
  } finally {
    await browser.close();
    await service.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
