'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});await page.context().setOffline(true);
 await page.goto(pathToFileURL(path.resolve('public/index.html')).href);await page.waitForTimeout(300);
 assert.equal(await page.locator('#campaignKind').count(),1,'seletor de campanha narrativa ausente');
 await page.locator('#titleCampaign').click();assert.equal(await page.evaluate(()=>campaign.kind),'story');
 await page.locator('#storySkip').click();assert.equal(await page.locator('#storyScene').evaluate(e=>e.open),false);
 await page.evaluate(()=>{const r=campaign.world.regions.find(r=>canAttack(campaign,r.id));applyResult(campaign,r.id,true);saveCampaign();renderCampaignStats();showRegion(Story.marker(campaign).region);});
 await page.locator('#startStoryMission').click();await page.locator('#storySkip').click();
 assert.equal(await page.locator('#storyChoices button').count(),2);assert.ok(await page.locator('#storySkip').isDisabled());await page.evaluate(()=>document.querySelector('#storySkip').click());assert.equal(await page.locator('#storyChoices button').count(),2,'pular não escolhe');
 await page.locator('#storyChoices button').nth(1).click();
 await page.waitForFunction(()=>!!game.mission);assert.equal(await page.evaluate(()=>game.mission.chapter),1);
 await page.evaluate(()=>{game.aiEnabled=false;paused=true;game.paused=true;});const frozen=await page.evaluate(()=>game.time);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>game.time),frozen);
 const saved=await page.evaluate(()=>exportBattleData());assert.ok(saved.campaign);assert.equal(saved.battle.state.mission.chapter,1);
 const restored=await page.evaluate(data=>{const g=Game.fromSnapshot(data.battle),x=restoreBattleContext(data,g);return {kind:x.campaign.kind,id:x.link.attempt.id,scene:x.campaign.story.scene};},saved);assert.ok(restored.id);
 const badContexts=await page.evaluate(data=>{const cases=[d=>{delete d.battle.state.mission;},d=>{d.battle.state.mission.choices.secondary='convoy';},d=>{d.battle.state.mission.choices={};},d=>{d.battle.state.winner='red';d.battle.state.mission.outcome={won:true,reason:'x',records:true,convoy:false};}];return cases.map(change=>{const d=JSON.parse(JSON.stringify(data));change(d);try{restoreBattleContext(d,Game.fromSnapshot(d.battle));return false;}catch{return true;}});},saved);assert.ok(badContexts.every(Boolean),'saves contraditórios recusados');
 for(const viewport of [{width:1280,height:720},{width:1920,height:1080},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.evaluate(()=>openStoryScene('before3',null,true));await page.waitForTimeout(100);
  const layout=await page.evaluate(()=>{const d=document.querySelector('#storyScene'),b=document.querySelector('#storyNext').getBoundingClientRect();return{open:d.open,overflow:d.scrollWidth>d.clientWidth+1,button:b.bottom<=innerHeight&&b.right<=innerWidth};});assert.ok(layout.open&&!layout.overflow&&layout.button,JSON.stringify({viewport,layout}));
  await page.locator('#storySuspend').click();
 }
 await page.evaluate(()=>openStoryScene('before2',null,true));await page.keyboard.press('Escape');assert.equal(await page.locator('#storyScene').evaluate(e=>e.open),false);assert.ok(await page.evaluate(()=>campaign.story.scene));
 await page.evaluate(()=>resumeStoryScene());await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>campaign.story.scene.index),1);
 await page.screenshot({path:'test-output/story-dialog.png',fullPage:true});
 const counts=await page.evaluate(()=>{suspendStoryScene();game.paused=false;Missions.finish(game,true,'Teste de conclusão.');updateUI();const first=profile.stats.matches,data=exportBattleData(),restored=Game.fromSnapshot(data.battle),context=restoreBattleContext(data,restored);game=restored;campaign=context.campaign;campaignBattle=context.link;resultShown=false;$('result').close();updateUI();return[first,profile.stats.matches];});assert.equal(counts[0],counts[1],'recarregar resultado não repete estatísticas');
 const invalidBundle=await page.evaluate(()=>{const b=bundle();b.campaign='{"version":9}';const before=JSON.stringify(profile),invalid=validateBundle(b)===null;let rejected=false;try{applyBundle(b);}catch{rejected=true;}return invalid&&rejected&&JSON.stringify(profile)===before;});assert.ok(invalidBundle,'backup inválido não substitui o progresso');
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('OK navegador offline: cenas, escolhas, pausa, save e três layouts');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
