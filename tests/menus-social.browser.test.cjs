'use strict';
// Menus sociais táticos (desktop): campanha com dossiê, cartões espelhando selects, diário em linha do tempo e multiplayer com vagas.
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.context().setOffline(true);await page.goto(pathToFileURL(path.join(__dirname,'../public/index.html')).href);await page.evaluate(()=>terrainReady);
 await page.evaluate(()=>{document.getElementById('titleScreen').close();campaign=newCampaign(5,'normal','turns','free');openCampaign();});

 // Campanha: cartões espelham os selects, que continuam no DOM.
 const count=sel=>page.locator(sel+'+.pick-grid .pick-card').count();
 assert.equal(await count('#campaignDoctrine'),4);assert.equal(await count('#campaignUnits'),3);assert.equal(await count('#campaignEnemyArmy'),4);assert.equal(await count('#campaignMode'),2);assert.equal(await count('#campaignKind'),2);
 assert.equal(await page.locator('#campaignUnits+.pick-grid .pick-card[aria-checked=true]').getAttribute('data-value'),await page.locator('#campaignUnits').inputValue());
 await page.locator('#campaignUnits+.pick-grid .pick-card[data-value=franca]').click();
 assert.equal(await page.locator('#campaignUnits').inputValue(),'franca');assert.equal(await page.evaluate(()=>settings.army),'franca');
 await page.locator('#campaignUnits+.pick-grid .pick-card[data-value=own]').click();
 assert.ok(await page.locator('#campaignDoctrine+.pick-grid .pick-card').first().isDisabled(),'sem região atacável a doutrina fica travada');
 const id=await page.evaluate(()=>campaign.world.regions.find(r=>canAttack(campaign,r.id)).id);
 await page.locator('#regionSelect').selectOption(String(id));
 assert.equal(await page.locator('#campaignDoctrine+.pick-grid .pick-card').first().isDisabled(),false);
 await page.locator('#campaignDoctrine').selectOption('defensive');
 assert.equal(await page.locator('#campaignDoctrine+.pick-grid .pick-card[aria-checked=true]').getAttribute('data-value'),'defensive');

 // Dossiê: nome, bioma, posse e ameaça da região escolhida.
 const name=await page.evaluate(id=>campaign.world.regions[id].name,id);
 assert.equal(await page.locator('#regionName').textContent(),name);
 assert.ok((await page.locator('#regionBiome').textContent()).length>3);assert.equal(await page.locator('#regionOwner').getAttribute('data-owner'),'neutral');
 assert.equal(await page.locator('#regionThreatBar').evaluate(e=>e.style.getPropertyValue('--v')),'50%');
 assert.equal(await page.locator('#attackRegion').isEnabled(),true);
 assert.ok(await page.evaluate(()=>{const c=document.getElementById('regionPreview'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return d.some(v=>v>0);}),'prévia desenhada');
 assert.match(await page.locator('#campaignStats').textContent(),/^1 suas · 1 inimigas/);

 // Diário em linha do tempo e geometria.
 await page.evaluate(id=>{applyResult(campaign,id,true);saveCampaign();renderCampaignStats();},id);
 assert.ok(await page.locator('#campaignEvents li').count()>=1);assert.match(await page.locator('#campaignEvents').textContent(),/conquistada/);
 const world=await page.locator('#worldMap').boundingBox(),dossier=await page.locator('.region-panel').boundingBox(),diary=await page.locator('.campaign-diary').boundingBox();
 assert.ok(dossier.x>=world.x+world.width,'dossiê à direita do mapa');assert.ok(diary.y>=world.y+world.height&&diary.x<dossier.x,'diário abaixo do mapa');assert.ok(world.width>900,'mapa grande: '+world.width);
 assert.equal(await page.locator('#campaign').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);

 // História: cartão da missão com retrato.
 await page.evaluate(()=>{campaign=newCampaign(77,'normal','turns','story');campaign.story.opened=true;renderCampaignStats();const r=campaign.world.regions.find(r=>canAttack(campaign,r.id));applyResult(campaign,r.id,true);renderCampaignStats();showRegion(Story.marker(campaign).region);});
 await page.waitForFunction(()=>document.getElementById('storyMissionPortrait').naturalWidth>0);
 assert.equal(await page.locator('#storyMission').isVisible(),true);assert.match(await page.locator('#storyMissionPortrait').getAttribute('src'),/assets\/characters\/.+\.webp$/);

 // Efeitos desligados.
 const anim=()=>page.locator('#campaignUnits+.pick-grid .pick-card').first().evaluate(e=>getComputedStyle(e).animationName);
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await anim(),'none');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>closeCampaign());

 // Multiplayer: entrada com dois cartões, cartões de mapa e sala simulada com vagas.
 await page.evaluate(()=>Multiplayer.show());
 assert.equal(await page.locator('.mp-card').count(),2);assert.equal(await page.locator('#mpCreate').isVisible(),true);assert.equal(await page.locator('#mpJoin').isVisible(),true);
 assert.equal(await count('#mpMap'),4);await page.waitForFunction(()=>document.querySelectorAll('#mpMap+.pick-grid canvas').length===4,null,{timeout:20000});
 await page.locator('#mpMap').selectOption('random');assert.equal(await page.locator('#mpMap+.pick-grid .pick-card[aria-checked=true]').getAttribute('data-value'),'random');
 assert.equal(await page.locator('#mpTerrain').isVisible(),true);assert.equal(await count('#mpLandscape'),5);
 await page.locator('#mpWater').evaluate(e=>{e.value='80';e.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await page.locator('#mpWaterOut').textContent(),'80%');
 const room=players=>page.evaluate(players=>{Multiplayer.session={code:'ABCD2345',token:'t',side:'red',nickname:'Bia'};Multiplayer.connected=true;
  Multiplayer.room={code:'ABCD2345',status:'waiting',hostSide:'blue',config:{map:'river',mode:'rts',seed:1,options:{landscape:'auto',water:.35,forest:.4,relief:.35,farmland:.6,posts:24}},players};Multiplayer.renderRoom();},players);
 const P=(side,nickname,ready,extra={})=>({nickname,side,ready,connected:true,doctrine:'balanced',faction:null,army:{},out:false,...extra});
 await room([P('blue','Anfitrião',true),P('red','Bia',false),P('green','Caio',true,{faction:'franca',doctrine:'offensive'})]);
 assert.equal(await page.locator('#mpPlayers li').count(),3);assert.deepEqual(await page.locator('#mpPlayers li').evaluateAll(l=>l.map(e=>e.dataset.side+':'+e.dataset.state)),['blue:ready','red:preparing','green:ready']);
 assert.equal(await page.locator('#mpCodeLabel').textContent(),'ABCD2345');assert.match(await page.locator('#mpOwnSide').textContent(),/vermelha/i);
 assert.notEqual(await page.locator('.mp-slot[data-state=ready] .mp-lamp').first().evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.mp-slot[data-state=ready] .mp-lamp').first().evaluate(e=>getComputedStyle(e).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
 assert.equal(await page.locator('#mpFormation').isVisible(),true);assert.equal(await page.locator('#mpStart').isHidden(),true,'só o anfitrião inicia');
 assert.ok(await page.locator('#mpMap+.pick-grid .pick-card').first().isDisabled(),'convidado não configura');
 await page.locator('#mpFaction').selectOption('blue');assert.equal(await page.locator('#mpFaction+.pick-grid .pick-card[aria-checked=true]').getAttribute('data-value'),'blue');
 await room([P('blue','Anfitrião',false),P('red','Bia',false)]);
 assert.equal(await page.locator('#mpPlayers li').count(),2);assert.equal(await page.locator('.mp-slot.empty').count(),1);
 assert.equal(await page.locator('#multiplayer').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
 await page.evaluate(()=>{Multiplayer.session=null;Multiplayer.room=null;});

 assert.deepEqual(errors,[]);assert.deepEqual(network,[],'nenhuma requisição de rede');
 console.log('OK menus sociais: campanha (dossiê, cartões, diário, retrato) e multiplayer (entrada, vagas, configuração).');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
