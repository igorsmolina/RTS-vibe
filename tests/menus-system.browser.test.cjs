'use strict';
// Menus de sistema (desktop): Configurações, Personalizar nação, Perfil, Exército inicial e Manual.
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.context().setOffline(true);await page.goto(pathToFileURL(path.join(__dirname,'../public/index.html')).href);await page.evaluate(()=>terrainReady);
 const closeAll=()=>page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();});
 const checked=sel=>page.locator(sel+'+.pick-grid .pick-card[aria-checked=true]').getAttribute('data-value');

 // Configurações: cartões espelham os <select> (que seguem no DOM) e aplicam na hora.
 await page.locator('#titleSettings').click();
 assert.equal(await page.locator('#setGraphics option').count(),3);
 assert.equal(await page.locator('#setGraphics+.pick-grid .pick-card').count(),3);
 await page.locator('#setGraphics+.pick-grid [data-value=performance]').click();
 assert.equal(await page.evaluate(()=>settings.graphics),'performance');assert.equal(await page.evaluate(()=>document.documentElement.dataset.fx),'performance');
 await page.locator('#setGraphics').selectOption('cinematic');assert.equal(await checked('#setGraphics'),'cinematic');
 await page.locator('#setGraphics').selectOption('balanced');
 for(const [id,n] of [['#setDifficulty',4],['#setSpeed',4],['#setMode',2]]){
  assert.equal(await page.locator(id+'+.pick-grid .pick-card').count(),n,id);
  const last=await page.locator(id+' option').last().getAttribute('value');await page.locator(id+'+.pick-grid [data-value="'+last+'"]').click();
  assert.equal(await page.locator(id).inputValue(),last);assert.equal(await checked(id),last);
 }
 assert.equal(await page.evaluate(()=>settings.mode),'rts');assert.equal(await page.evaluate(()=>settings.speed),2);
 await page.locator('#setGrid').check();assert.equal(await page.evaluate(()=>showGrid),true);
 for(const id of ['#setSound','#setFullscreen'])assert.equal(await page.locator(id).isVisible(),true);
 await page.locator('#settingsReset').click();assert.equal(await checked('#setMode'),'turns','restaurar padrões atualiza os cartões');
 assert.equal(await page.locator('#settingsNationFlag').evaluate(c=>c.getContext('2d').getImageData(3,3,1,1).data[3]),255);

 // Personalizar nação: amostras, padrões e emblemas espelham os <select>; a bandeira muda e ondula.
 await page.locator('#personalizeNation').click();
 for(const [id,n] of [['#nationPrimary',4],['#nationSecondary',3],['#nationPattern',3],['#nationEmblem',4]])assert.equal(await page.locator(id+'+.pick-grid .pick-card').count(),n,id);
 await page.locator('#nationPrimary+.pick-grid [data-value=violet]').click();
 assert.equal(await page.locator('#nationPrimary').inputValue(),'violet');
 const pixel=()=>page.locator('#nationPreviewFlag').evaluate(c=>Array.from(c.getContext('2d').getImageData(5,5,1,1).data.slice(0,3)));
 const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
 assert.deepEqual(await pixel(),hex(await page.evaluate(()=>NATION_COLORS.violet)));
 await page.locator('#nationSecondary').selectOption('cream');assert.equal(await checked('#nationSecondary'),'cream');
 await page.locator('#nationPattern+.pick-grid [data-value=horizontal]').click();await page.locator('#nationEmblem+.pick-grid [data-value=star]').click();
 const colors=await page.locator('#nationPreviewFlag').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,set=new Set();for(let i=0;i<d.length;i+=4*13)set.add(d.slice(i,i+3).join());return set.size;});
 assert.ok(colors>=3,'bandeira com padrão e emblema desenhada');
 assert.ok(await page.locator('#nationPattern+.pick-grid canvas').first().evaluate(c=>c.getContext('2d').getImageData(3,3,1,1).data[3]===255),'miniaturas desenhadas');
 const wave=()=>page.locator('#nationPreviewFlag').evaluate(e=>getComputedStyle(e).animationName);
 assert.equal(await wave(),'flagSway');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await wave(),'none');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>{document.documentElement.dataset.fx='performance';});assert.equal(await wave(),'none');await page.evaluate(()=>{document.documentElement.dataset.fx='balanced';});
 await page.locator('#cancelNation').click();await closeAll();

 // Editor de exército: o + soma, o medidor anda e o total estoura em vermelho.
 await page.evaluate(()=>{settings.fullscreen=false;openSetup();SetupMenu.show('forces');});await page.locator('#setupArmy').click();
 assert.equal(await page.locator('#armyUnits .army-unit').count(),await page.evaluate(()=>startingCatalog('blue').length));
 assert.ok(await page.locator('#armyUnits .army-unit canvas').first().evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some(v=>v)),'sprite desenhado');
 const width=()=>page.locator('#armyBar').evaluate(e=>parseFloat(e.style.width)||0);
 const w0=await width(),cost=await page.evaluate(()=>TYPES.infantry.cost),spent0=Number(await page.locator('#armySpent').textContent());
 await page.getByRole('button',{name:'Adicionar Infantaria',exact:true}).click();
 assert.equal(Number(await page.locator('#armySpent').textContent()),spent0+cost);assert.ok(await width()>w0);assert.equal(await page.locator('#army-infantry').inputValue(),'3');
 await page.getByRole('button',{name:'Remover Infantaria',exact:true}).click();assert.equal(Number(await page.locator('#armySpent').textContent()),spent0);
 await page.locator('#clearArmy').click();assert.equal(await width(),0);await page.getByRole('button',{name:'Remover Infantaria',exact:true}).click();assert.equal(await page.locator('#army-infantry').inputValue(),'0');
 await page.locator('[data-army=infantry]').fill('25');assert.ok(await page.locator('#saveArmy').isDisabled());assert.equal(await page.locator('.army-progress.over').count(),1);
 assert.equal(await page.locator('#armyUnits .army-unit[data-count="25"]').count(),1);
 await page.locator('#cancelArmy').click();await closeAll();

 // Manual: fichas em abas por time; o painel verde segue com uma ficha por tipo recrutável.
 await page.evaluate(()=>openMenu('manual'));
 assert.equal(await page.locator('#manualNav a:not([data-icon])').count(),0,'chips com ícone');
 await page.evaluate(()=>{document.getElementById('man-unidades').open=true;});
 const expected=await page.evaluate(()=>({verde:RECRUIT_TYPES.length,franca:Object.keys(FR_TYPES).length+4}));
 const panel=async(id)=>({sheets:await page.locator('#'+id+' .unit-sheet').count(),hidden:await page.locator('#'+id).evaluate(e=>e.hidden)});
 assert.deepEqual(await panel('unitSheets'),{sheets:expected.verde,hidden:false});
 await page.getByRole('tab',{name:'Vermelho'}).click();
 const red=await panel('unitSheetsRed');assert.ok(red.sheets>=expected.verde&&!red.hidden);assert.equal((await panel('unitSheets')).hidden,true);
 assert.equal((await panel('unitSheets')).sheets,expected.verde,'a lista principal mantém uma ficha por tipo');
 await page.getByRole('tab',{name:'Azul (França)'}).click();
 assert.deepEqual(await panel('unitSheetsFrance'),{sheets:expected.franca,hidden:false});assert.equal((await panel('unitSheetsRed')).hidden,true);
 assert.ok(await page.locator('#unitSheetsFrance .unit-sheet canvas').first().evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some(v=>v)),'sprite da ficha desenhado');
 assert.equal(await page.locator('#unitSheetsFrance .unit-sheet canvas').first().evaluate(c=>c.width),96);
 await page.getByRole('tab',{name:'Verde'}).click();assert.equal((await panel('unitSheets')).hidden,false);
 await page.locator('#manualSearch').fill('helicoptero');assert.ok(await page.locator('.topic:not([hidden])').count()>0);await page.locator('#manualSearch').fill('');
 assert.equal(await page.locator('.tank-stats').count(),2);assert.equal(await page.locator('.topic[open]').count(),0);
 await closeAll();

 // Perfil: quatro abas, medalhas com progresso, estatísticas em blocos, histórico em tabela.
 await page.evaluate(()=>{profile.stats.matches=10;profile.stats.wins=1;profile.achievements.firstWin=Date.now();profile.history=[{id:'x',date:Date.now(),map:'river',difficulty:'normal',mode:'turns',result:'win',time:0,round:9,kills:{infantry:3},lost:{}}];openProfile();});
 for(const name of ['Conquistas','Estatísticas','Histórico','Conta e save'])assert.equal(await page.getByRole('tab',{name,exact:true}).count(),1,name);
 assert.equal(await page.locator('#achievementList li').count(),15);
 assert.equal(await page.locator('#achievementList li.done b').first().textContent(),'Primeira vitória');
 assert.equal(await page.locator('#achievementList li:has(b:text-is("Veterano de guerra")) .progress-text').textContent(),'10/25');
 await page.getByRole('tab',{name:'Estatísticas'}).click();assert.equal(await page.locator('#tabStats').isVisible(),true);
 assert.ok(await page.locator('#statList .stat-tile').count()>=10);assert.match(await page.locator('#statList').textContent(),/Operações10/);
 await page.getByRole('tab',{name:'Histórico'}).click();assert.equal(await page.locator('#historyBody tr').count(),1);assert.match(await page.locator('#historyBody tr').textContent(),/Vitória.*3 \/ 0/);
 await page.getByRole('tab',{name:'Conta e save'}).click();assert.equal(await page.locator('.account-card').count(),3);assert.equal(await page.locator('#tabAccount').isVisible(),true);
 await page.getByRole('tab',{name:'Conquistas'}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('tab',{name:'Estatísticas'}).getAttribute('aria-selected'),'true');
 await closeAll();

 assert.deepEqual(errors,[]);assert.deepEqual(network,[],'nenhuma requisição de rede');
 console.log('OK menus de sistema: configurações, nação, exército, manual e perfil.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
