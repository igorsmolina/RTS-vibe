'use strict';
// Barra de comandos em blocos por função, motivo do botão cinza, modo de ordem visível (cursor, faixa, Esc em dois passos)
// e sprites dos times inteiros dentro dos cartões de unidades.
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.context().setOffline(true);await page.goto(pathToFileURL(path.join(__dirname,'../public/index.html')).href);await page.evaluate(()=>terrainReady);

 // Sprites dos times: cada canvas de cartão cabe inteiro na caixa de arte, em Forças, campanha e multiplayer.
 await page.locator('#titlePlay').click();await page.locator('#tab-forces').click();await page.waitForTimeout(300);
 // Mede os pixels opacos do desenho (a margem transparente do canvas pode passar da caixa sem cortar nada).
 const fits=async sel=>page.evaluate(sel=>{const out=[];for(const c of document.querySelectorAll(sel+'+.pick-grid .pick-art canvas.sprite')){
  const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=-1,y1=-1;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]>16){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  const r=c.getBoundingClientRect(),box=c.parentElement.getBoundingClientRect(),k=r.width/c.width,left=r.left+x0*k,right=r.left+(x1+1)*k,top=r.top+y0*(r.height/c.height),bottom=r.top+(y1+1)*(r.height/c.height);
  out.push(x1>=0&&(y1-y0)>c.height*.5&&top>=box.top-1&&bottom<=box.bottom+1&&left>=box.left-1&&right<=box.right+1);}return out;},sel);
 for(const sel of ['#playerArmy','#enemyArmy']){const r=await fits(sel);assert.ok(r.length>=4,sel+' tem sprites ('+r.length+')');assert.ok(r.every(Boolean),sel+': sprite fora da caixa '+JSON.stringify(r));}
 await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();});

 // Partida RTS em pausa, com 3 infantarias selecionadas.
 await page.evaluate(()=>{newOperation('river','normal',123,'rts',{posts:2});paused=true;game.aiEnabled=false;game.credits.blue=150;
  const t=game.units.filter(u=>u.owner==='blue'&&u.type==='infantry').slice(0,3);setSelection(t.map(u=>u.id));updateUI();});
 await page.waitForTimeout(300);
 const titles=await page.locator('#ordersPanel .cmd-group:not([hidden]) .cmd-title').allTextContents();
 assert.deepEqual(titles,['Movimento','Combate','Apoio'],'blocos visíveis com infantaria');
 assert.equal(await page.locator('#cmdTransportT').evaluate(e=>e.closest('.cmd-group').hidden),true,'sem transporte o bloco some');
 assert.equal(await page.locator('#move').evaluate(e=>!!e.closest('.cmd-group')&&e.closest('.cmd-group').querySelector('.cmd-title').textContent==='Movimento'),true);

 // Botão cinza explica o motivo.
 await page.evaluate(()=>{game.credits.blue=10;updateUI();});
 assert.equal(await page.locator('#build').isDisabled(),true);
 assert.match(await page.locator('#build').getAttribute('title'),/Posto: .*créditos/);
 assert.match(await page.locator('#orderReason').textContent(),/Indisponível · Posto: faltam \d+ créditos/);
 assert.equal(await page.locator('#orderReason').isVisible(),true);
 await page.evaluate(()=>{game.credits.blue=500;updateUI();});
 assert.doesNotMatch(await page.locator('#build').getAttribute('title')||'',/créditos/);
 const rest=await page.locator('#build').isDisabled();
 if(!rest)assert.equal(await page.locator('#orderReason').isHidden(),true,'sem botão cinza a linha some');

 // Modo de ordem: cursor, faixa e Esc em dois passos.
 await page.locator('#move').click();
 assert.equal(await page.locator('#battlefield').getAttribute('data-mode'),'move');
 assert.equal(await page.locator('#battlefield').evaluate(e=>getComputedStyle(e).cursor),'cell');
 assert.equal(await page.locator('#modeBanner').isVisible(),true);
 assert.match(await page.locator('#modeBanner').textContent(),/Escolha o destino · Esc cancela/);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#modeBanner').isHidden(),true,'o 1º Esc cancela só a ordem');
 assert.equal(await page.locator('#commandBar').isVisible(),true,'a seleção continua');
 assert.match(await page.locator('#hint').textContent(),/Ordem cancelada/);
 assert.equal(await page.locator('#battlefield').evaluate(e=>getComputedStyle(e).cursor),'default');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#commandBar').isHidden(),true,'o 2º Esc limpa a seleção');

 // Bombardeiro: o painel do avião também vem em blocos, e o "Parar" geral fica num bloco "Geral".
 await page.evaluate(()=>{const p=game.add('blue','bomberBlue',10,80);game.updateVision();setSelection([p.id]);updateUI();});
 await page.waitForTimeout(300);
 assert.equal(await page.locator('#cmdMoveT').textContent(),'Geral');
 const planeTitles=await page.locator('#planeActions .cmd-group:not([hidden]) .cmd-title').allTextContents();
 assert.ok(planeTitles.includes('Movimento')&&planeTitles.includes('Combate'),'blocos do painel do avião: '+planeTitles);
 assert.equal(await page.locator('#planeBomb').evaluate(e=>e.closest('.cmd-group').querySelector('.cmd-title').textContent),'Combate');
 await page.locator('#planeBomb').click();
 assert.match(await page.locator('#modeBanner').textContent(),/início e o fim da passagem/);
 await page.evaluate(()=>{bombLineStart={x:20,y:60};updateUI();});
 assert.match(await page.locator('#modeBanner').textContent(),/Agora escolha o fim da passagem/);
 await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>bombLineStart),null);

 // Transporte: o bloco aparece com ícones quando há transportador selecionado.
 await page.evaluate(()=>{const t=game.add('blue','transportTruck',12,86);game.updateVision();setSelection([t.id]);updateUI();});
 await page.waitForTimeout(300);
 assert.equal(await page.locator('#cmdTransportT').evaluate(e=>e.closest('.cmd-group').hidden),false);
 assert.equal(await page.locator('#embark').getAttribute('data-icon'),'log-in');

 assert.deepEqual(errors,[]);
 console.log('OK barra de comandos: blocos, motivos, modo de ordem, Esc em dois passos e sprites inteiros');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
