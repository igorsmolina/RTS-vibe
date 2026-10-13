'use strict';
// Fluxo real da interface com condições de combate controladas; não mede balanceamento.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const battleMode of ['rts','turns']){
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.context().setOffline(true);await page.goto(pathToFileURL(path.resolve('public/index.html')).href);
  await page.evaluate(mode=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();campaign=newCampaign(77,'normal',mode,'story');campaign.story.opened=true;$('campaignMode').value=mode;openCampaign();},battleMode);
  for(let chapter=1;chapter<=5;chapter++){
   await page.evaluate(chapter=>{while(campaign.story.seen.length<Story.chapters[chapter].threshold){const target=campaign.world.regions.find(r=>canAttack(campaign,r.id)&&!campaign.story.seen.includes(r.id));if(!target)throw Error('Sem região acessível.');applyResult(campaign,target.id,true);}const marker=Story.marker(campaign);if(chapter===5&&!marker){const home=campaign.world.regions[campaign.world.homes.red],neighbor=home.neighbors.find(id=>id!==campaign.world.homes.blue);campaign.owners[neighbor]='blue';}renderCampaignStats();showRegion(Story.marker(campaign).region);},chapter);
   await page.locator('#startStoryMission').click();await page.locator('#storySkip').click();
   if(chapter===1)await page.locator('#storyChoices button').nth(1).click();if(chapter===4)await page.locator('#storyChoices button').nth(0).click();
   await page.waitForFunction(chapter=>game.mission?.chapter===chapter,chapter);await page.evaluate(()=>{paused=true;game.paused=false;game.aiEnabled=false;game.units=game.units.filter(u=>u.owner==='blue');});
   const prepare=async key=>page.evaluate(key=>{const target=game.get(game.mission.ids[key]),foot=game.units.find(u=>u.owner==='blue'&&u.type==='infantry'&&!u.missionRole),engineer=game.get(game.mission.ids.engineer);foot.x=target.x-1;foot.y=target.y;foot.actionLeft=true;engineer.x=target.x;engineer.y=target.y-1;game.updateVision();if(!game.order(foot,'capture',{targetId:target.id}))throw Error('Captura rejeitada: '+key);for(let i=0;i<300&&target.owner!=='blue';i++)game.update(1/30);if(target.owner!=='blue')throw Error('Captura não concluiu.');},key);
   if(chapter===1){await prepare('station');await page.evaluate(()=>{game.get(game.mission.ids.records).owner='blue';});}
   if(chapter===3){await prepare('archive');await page.evaluate(()=>{game.get(game.mission.ids.power).owner='blue';});}
   if(chapter===5)await prepare('archive');
   if(chapter===2){await page.evaluate(()=>{const truck=game.get(game.mission.ids.truck),ivo=game.get(game.mission.ids.ivo);truck.x=ivo.x-1;truck.y=ivo.y;game.updateVision();if(!game.order(truck,'embark',{targetId:ivo.id}))throw Error('Embarque de Ivo rejeitado.');});
    const data=await page.evaluate(()=>exportBattleData());await page.locator('#loadBattle').setInputFiles({name:'missao-ivo.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.waitForFunction(()=>game.get(game.mission.ids.truck)?.cargo.length===1);
    await page.evaluate(()=>{paused=true;game.paused=false;game.aiEnabled=false;const truck=game.get(game.mission.ids.truck);Object.assign(truck,game.mission.extraction);game.checkVictory();});
   }else await page.evaluate(()=>{game.checkVictory();if(game.mode==='turns')game.beginTurn('blue');const target=game.mission.chapter===4?181:61;if(game.mode==='rts')for(let i=0;i<target*30&&!game.winner;i++){game.units=game.units.filter(u=>u.owner==='blue');game.update(1/30);}else for(let i=0;i<(game.mission.chapter===4?6:2)&&!game.winner;i++){game.units=game.units.filter(u=>u.owner==='blue');game.beginTurn('red');game.beginTurn('blue');}if(game.mission.chapter===5){const truck=game.get(game.mission.ids.truck),archive=game.get(game.mission.ids.archive);truck.x=archive.x-1;truck.y=archive.y;game.checkVictory();Object.assign(truck,game.mission.extraction);game.checkVictory();}updateUI();});
   await page.evaluate(()=>updateUI());assert.equal(await page.evaluate(()=>game.winner),'blue','vitória capítulo '+chapter+' '+battleMode);
   const distinct=await page.evaluate(()=>campaign.story.seen.length);await page.locator('#backToWorld').click();
   if(chapter===2||chapter===3){await page.locator('#storySkip').click();await page.locator('#storyChoices button').nth(0).click();}else{await page.locator('#storySkip').click();if(chapter===5)await page.locator('#storySkip').click();}
   if(chapter===2||chapter===4)assert.equal(await page.evaluate(()=>campaign.story.seen.length),distinct,'missão aliada não conquista');
   if(chapter===3)assert.equal(await page.evaluate(()=>game.credits.blue>=0),true);
  }
  assert.equal(await page.evaluate(()=>campaign.story.ending),'exposed');assert.equal(await page.evaluate(()=>campaign.story.completed.length),5);
  await page.locator('#storyJournal').click();assert.match(await page.locator('#storyDiaryContent').textContent(),/Autorização conjunta/);await page.screenshot({path:'test-output/story/campaign-'+battleMode+'.png'});assert.deepEqual(errors,[]);await page.close();console.log('OK percurso dos cinco capítulos, decisões, save de Ivo e final: '+battleMode);
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
