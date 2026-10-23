'use strict';
// Menus táticos (desktop): tema escuro fixo, cartões que espelham <select>, miniaturas de teatro offline e efeitos desligáveis.
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.context().setOffline(true);await page.goto(pathToFileURL(path.join(__dirname,'../public/index.html')).href);await page.evaluate(()=>terrainReady);

 // Tema único escuro, tokens táticos e nenhum seletor de tema.
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.menuTheme),'dark');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--amber').trim()),'#f2b33d');
 assert.equal(await page.locator('#titleTheme, #setTheme').count(),0,'sem seletor de tema');

 // cardPicker: o <select> continua no DOM e vale como fonte do valor. A tela inicial é fechada para o teste clicar nos cartões.
 await page.evaluate(()=>{
  document.getElementById('titleScreen').close();
  document.body.insertAdjacentHTML('beforeend','<div id="lab" style="position:fixed;inset:80px;z-index:9"><label for="pick">Escolha</label><select id="pick"><option value="a" data-caption="primeira">Alfa</option><option value="b">Bravo — segunda</option><option value="c">Charlie</option></select></div>');
  window.changes=[];document.getElementById('pick').addEventListener('change',e=>window.changes.push(e.target.value));
  window.picker=MenuKit.cardPicker(document.getElementById('pick'),{kind:'icon',art:o=>MenuKit.iconNode(o.value==='a'?'water':'relief')});
 });
 assert.equal(await page.locator('#lab .pick-card').count(),3);
 assert.equal(await page.locator('#lab [role=radiogroup]').count(),1);
 assert.equal(await page.locator('#lab .pick-card[aria-checked=true]').getAttribute('data-value'),'a');
 assert.equal(await page.locator('#lab .pick-card[data-value=b] .pick-sub').textContent(),'segunda');
 await page.locator('#lab .pick-card[data-value=b]').click();
 assert.equal(await page.locator('#pick').inputValue(),'b');assert.deepEqual(await page.evaluate(()=>window.changes),['b']);
 await page.selectOption('#pick','c'); // testes escolhem pelo <select> oculto
 assert.equal(await page.locator('#lab .pick-card[aria-checked=true]').getAttribute('data-value'),'c');
 await page.locator('#lab .pick-card[data-value=c]').focus();await page.keyboard.press('ArrowRight');
 assert.equal(await page.locator('#pick').inputValue(),'a','setas contornam as pontas');
 await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#pick').inputValue(),'c');
 assert.equal(await page.locator('#lab .pick-card[tabindex="0"]').count(),1,'um único cartão na ordem de tabulação');
 // O ícone novo existe e desenha.
 assert.ok(await page.locator('#lab .pick-art [data-icon=water]').evaluate(e=>getComputedStyle(e,'::before').maskImage.includes('svg')||getComputedStyle(e,'::before').webkitMaskImage.includes('svg')));

 // Miniatura de teatro: gerada offline, guardada em cache e com conteúdo.
 const thumb=await page.evaluate(async()=>{
  const t0=performance.now(),canvas=await TitleMap.thumb('river',3,{},240,180),first=performance.now()-t0,again=TitleMap.thumb('river',3,{},240,180);
  const data=canvas.getContext('2d').getImageData(0,0,240,180).data;let colors=new Set();for(let i=0;i<data.length;i+=4*97)colors.add(data[i]+','+data[i+1]+','+data[i+2]);
  const t1=performance.now();for(const m of ['desert','mountain'])await TitleMap.thumb(m,3,{},240,180);await TitleMap.thumb('random',3,{landscape:'lakes'},240,180);
  return {w:canvas.width,h:canvas.height,colors:colors.size,first,cached:await again===canvas,three:performance.now()-t1};
 });
 assert.deepEqual([thumb.w,thumb.h],[240,180]);assert.ok(thumb.colors>20,'miniatura tem terreno desenhado');assert.equal(thumb.cached,true);
 assert.ok(thumb.first<1500&&thumb.three<4000,'miniaturas rápidas: '+JSON.stringify(thumb));

 // Efeitos: reduzir movimento e perfil gráfico "desempenho" desligam as animações.
 const animation=()=>page.locator('#lab .pick-card').first().evaluate(e=>getComputedStyle(e).animationName);
 assert.equal(await animation(),'cardIn');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await animation(),'none');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>{document.documentElement.dataset.fx='performance';});assert.equal(await animation(),'none');
 await page.evaluate(()=>{document.documentElement.dataset.fx='balanced';});assert.equal(await animation(),'cardIn');

 // Sons de interface existem e não quebram com o áudio desligado.
 await page.evaluate(()=>{for(const k of ['ui-hover','ui-select','ui-confirm','ui-open'])audio.play(k);MenuKit.ui('ui-select');});

 assert.deepEqual(errors,[]);assert.deepEqual(network,[],'nenhuma requisição de rede');
 console.log('OK menus táticos: tema escuro, cartões espelhando select, miniaturas offline e efeitos desligáveis.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
