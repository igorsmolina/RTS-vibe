'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright-core');
const { createMultiplayerServer } = require('../scripts/multiplayer-server.cjs');

// Sala com três clientes independentes: cada um escolhe o seu time, a partida roda com três lados,
// quem desiste é eliminado sem encerrar a partida e o último que sobra vence.
(async () => {
  const service = createMultiplayerServer();
  await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${service.server.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const contexts = await Promise.all([0, 1, 2, 3].map(() => browser.newContext({ viewport: { width: 1280, height: 800 } })));
    const pages = await Promise.all(contexts.map(context => context.newPage()));
    const errors = [];
    for (const page of pages) {
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && message.text().startsWith('Multiplayer:')) errors.push(message.text()); });
    }
    const [blue, red, green, fourth] = pages;
    const open = async (page, nickname) => {
      await page.goto(origin);
      await page.locator('#titleMultiplayer').click();
      await page.locator('#mpNickname').fill(nickname);
    };
    const joined = page => page.waitForFunction(() => Multiplayer.session && Multiplayer.connected && Multiplayer.room);
    const images = path.join(__dirname, '../test-output/multiplayer');
    fs.mkdirSync(images, { recursive: true });

    await open(blue, 'Anfitrião');
    await blue.locator('#mpCreate').click();
    await joined(blue);
    const code = await blue.evaluate(() => Multiplayer.session.code);
    for (const [page, nickname] of [[red, 'Segundo'], [green, 'Terceiro']]) {
      await open(page, nickname);
      await page.locator('#mpCode').fill(code);
      await page.locator('#mpJoin').click();
      await joined(page);
    }
    await Promise.all(pages.slice(0, 3).map(page => page.waitForFunction(() => Multiplayer.room.players.length === 3)));
    assert.deepEqual(await Promise.all(pages.slice(0, 3).map(page => page.evaluate(() => Multiplayer.session.side))), ['blue', 'red', 'green']);
    assert.equal(await green.locator('#mpPlayers li').count(), 3);
    assert.match(await green.locator('#mpOwnSide').textContent(), /verde/i);

    // o quarto jogador não entra
    await open(fourth, 'Quarto');
    await fourth.locator('#mpCode').fill(code);
    await fourth.locator('#mpJoin').click();
    await fourth.waitForFunction(() => /cheia|iniciada/i.test(document.getElementById('mpStatus').textContent));
    assert.equal(await fourth.evaluate(() => !!Multiplayer.session), false);

    // cada um escolhe o time: o verde começa com os franceses, o azul com as verdes e o vermelho com as vermelhas
    await green.waitForFunction(() => Multiplayer.room.players.find(p => p.side === 'green').faction === 'franca' || Multiplayer.room.players.find(p => p.side === 'green').faction === null);
    await red.locator('#mpFaction').selectOption('blue');
    await green.locator('#mpFaction').selectOption('red');
    await blue.waitForFunction(() => Multiplayer.room.players.find(p => p.side === 'red').faction === 'blue' && Multiplayer.room.players.find(p => p.side === 'green').faction === 'red');
    await blue.screenshot({ path: path.join(images, 'sala-tres-jogadores.png') });
    for (const page of pages.slice(0, 3)) await page.locator('#mpReady').click();
    await blue.waitForFunction(() => !document.getElementById('mpStart').disabled);
    await blue.locator('#mpStart').click();
    await Promise.all(pages.slice(0, 3).map(page => page.waitForFunction(() => started && game.multiplayer && game.networkClient)));

    const room = service.rooms.get(code), g = room.game;
    assert.deepEqual(g.sides, ['blue', 'red', 'green']);
    assert.deepEqual({ ...g.factions }, { blue: 'blue', red: 'blue', green: 'red' });
    for (const [page, side] of [[blue, 'blue'], [red, 'red'], [green, 'green']]) {
      assert.equal(await page.evaluate(() => localPlayerSide()), side);
      assert.equal(await page.evaluate(() => game.sides.join()), 'blue,red,green');
      assert.equal(await page.evaluate(s => game.units.filter(u => u.owner === s).length > 0 && !!game.hq(s), side), true);
      assert.match(await page.locator('#nationHeaderName').textContent(), new RegExp({ blue: 'Azul', red: 'Vermelho', green: 'Verde' }[side]));
    }
    // o verde só enxerga a própria base no começo
    assert.equal(await green.evaluate(() => game.units.some(u => u.owner === 'blue' && !u.contactOnly)), false);
    await green.screenshot({ path: path.join(images, 'partida-tres-jogadores-verde.png') });

    // o verde compra uma tropa e o dinheiro dos outros não aparece
    const credits = g.credits.green;
    await green.evaluate(() => setSelection([game.hq('green').id]));
    await green.locator('[data-recruit=infantry]').click();
    await green.waitForFunction(() => game.hq('green').queue.length === 1);
    assert.equal(g.credits.green, credits - 50);
    assert.equal(await green.evaluate(() => game.credits.blue), 0);

    // desistência com três vivos: só o verde sai e a partida continua
    await green.evaluate(() => Multiplayer.surrender());
    await green.waitForFunction(() => game.winner === 'eliminated' && document.getElementById('result').open);
    assert.match(await green.locator('#resultStamp').textContent(), /Derrota/);
    assert.equal(room.status, 'playing');
    assert.equal(g.isOut('green'), true);
    await Promise.all([blue, red].map(page => page.waitForFunction(() => game.out.includes('green') && !game.winner)));
    assert.equal(await blue.locator('#result').evaluate(e => e.open), false);
    // o eliminado assiste ao mapa inteiro
    await green.locator('#review').click();
    await green.waitForFunction(() => game.units.some(u => u.owner === 'blue') && game.units.some(u => u.owner === 'red'));
    await green.screenshot({ path: path.join(images, 'eliminado-assistindo.png') });

    // o vermelho desiste: o azul vence
    await red.evaluate(() => Multiplayer.surrender());
    await blue.waitForFunction(() => game.winner === 'blue' && document.getElementById('result').open);
    assert.match(await blue.locator('#resultStamp').textContent(), /Vitória/);
    assert.equal(room.status, 'finished');
    assert.deepEqual({ ...room.result }, { winner: 'blue', reason: 'surrender' });

    // revanche com os três: os lados giram e o jogo volta à sala
    await Promise.all(pages.slice(0, 3).map(page => page.evaluate(() => { if (document.getElementById('result').open) document.getElementById('result').close(); })));
    for (const page of pages.slice(0, 3)) await page.evaluate(() => Multiplayer.rematch());
    await blue.waitForFunction(() => Multiplayer.room.status === 'waiting' && Multiplayer.room.players.length === 3);
    assert.deepEqual(await Promise.all(pages.slice(0, 3).map(page => page.evaluate(() => Multiplayer.session.side))), ['red', 'green', 'blue']);

    assert.deepEqual(errors, []);
    console.log('OK multiplayer com três jogadores: sala, times, partida, eliminação, vitória e revanche');
  } finally {
    await browser.close();
    await service.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
