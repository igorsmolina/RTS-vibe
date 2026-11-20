'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await page.context().setOffline(true);await page.goto(pathToFileURL(path.resolve('public/index.html')).href);await page.locator('#titleCampaign').click();
 await page.waitForFunction(()=>$('storyBackdrop').complete&&$('storyBackdrop').naturalWidth>0);
 assert.equal(await page.locator('#storyScene').getAttribute('class'),'story-scene illustrated');
 await page.locator('#storyNext').click();await page.locator('#storySuspend').click();await page.reload();await page.locator('#titleCampaign').click();assert.equal(await page.evaluate(()=>campaign.story.scene.index),1,'retoma fala');
 await page.locator('#storySkip').click();
 await page.evaluate(()=>{newOperation('river','normal',1,'rts');game.aiEnabled=false;openStoryScene('before2');});const time=await page.evaluate(()=>game.time);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>game.time),time);
 for(const id of ['opening','before2','after2','before3','before6'])for(const viewport of [{width:1280,height:720},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.evaluate(id=>openStoryScene(id),id);
  await page.waitForFunction(()=>$('storyBackdrop').complete&&$('storyBackdrop').naturalWidth>0);
  assert.ok(await page.evaluate(()=>{const d=$('storyScene'),b=$('storyNext').getBoundingClientRect();return d.scrollWidth<=d.clientWidth+1&&b.bottom<=innerHeight&&b.right<=innerWidth;}),id+' '+JSON.stringify(viewport));
  if(id==='after2'){await page.locator('#storySkip').click();assert.equal(await page.locator('#storyChoices button').count(),2);assert.ok(await page.locator('#storySkip').isDisabled());await page.locator('#storyChoices button').last().scrollIntoViewIfNeeded();assert.ok(await page.locator('#storyChoices button').last().isVisible());}
 }
 await page.setViewportSize({width:1280,height:720});await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>openStoryScene('after2'));assert.equal(await page.locator('#storyBackdrop').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
 // Real HTML proof, repeated examination is idempotent, modal preserves pause and scene position.
 await page.evaluate(()=>{campaign.story.evidence=['records'];openStoryScene('after1');const data=Story.scene(campaign,'after1');const i=data.shots.findIndex(s=>s.document==='records');if(i<0)throw Error('Prova ausente da cena');campaign.story.scene.index=i;renderStoryScene();});
 const initial=await page.evaluate(()=>({index:campaign.story.scene.index,paused:game.paused}));await page.locator('#storyInspect').click();assert.ok(await page.locator('#proofBody').textContent());await page.locator('#proofDetails button').first().click();await page.locator('#proofDetails button').first().click();assert.equal(await page.evaluate(()=>campaign.story.discoveries.length),1);assert.equal(await page.locator('#proofDetails .examined').count(),1);await page.keyboard.press('Escape');assert.deepEqual(await page.evaluate(()=>({index:campaign.story.scene.index,paused:game.paused})),initial);
 await page.locator('#storyHistory').click();await page.getByRole('button',{name:'Examinar prova',exact:true}).last().click();assert.equal(await page.locator('#proofDetails .examined').count(),1);await page.locator('#proofClose').click();await page.locator('#storyDiaryClose').click();
 fs.mkdirSync('test-output/story',{recursive:true});await page.screenshot({path:'test-output/story/cutscene-proof.png'});
 for(const ivo of ['protect','hand'])for(const id of ['opening',...Array.from({length:8},(_,i)=>['before'+(i+1),'after'+(i+1)]).flat(),'choice-secondary','choice-channel','exposed','covered','defeat','retreat']){
  await page.evaluate(({ivo,id})=>{campaign=newCampaign(23,'normal','rts','story');campaign.story.choices={secondary:'records',ivo,contracts:'publish',channel:ivo==='protect'?'civil':'military'};campaign.story.evidence=['records','contracts','manifest','stationCopy','authorization',...(ivo==='protect'?['civil','testimony']:[])];openStoryScene(id);},{ivo,id});
  await page.waitForFunction(()=>$('storyBackdrop').complete&&$('storyBackdrop').naturalWidth>0&&$('storyBackdrop').style.visibility==='visible');
  const count=await page.evaluate(()=>Story.scene(campaign,campaign.story.scene.id).lines.length);
  for(let index=0;index<count;index++){await page.evaluate(index=>{campaign.story.scene.index=index;renderStoryScene();},index);assert.ok(await page.locator('#storyText').textContent(),id+' fala vazia');assert.ok(await page.locator('#storyBackdrop').isVisible());assert.ok(await page.locator('.story-character:visible').count()<=2);}
 }
 await page.evaluate(()=>{openStoryScene('before3');$('storyBackdrop').src='assets/story/unavailable.webp';});await page.waitForFunction(()=>$('storyBackdrop').getAttribute('src').endsWith('.svg')&&$('storyBackdrop').complete&&$('storyBackdrop').naturalWidth>0);
 await page.evaluate(()=>{$('storyBackdrop').src='assets/story/missing.svg';});await page.waitForFunction(()=>$('storyBackdrop').style.visibility==='hidden');assert.ok(await page.locator('#storyNext').isVisible());assert.ok(await page.locator('#storyText').textContent());
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('OK cutscenes offline: oito capítulos, pausa, retomada, prova, diário, três layouts, movimento reduzido e fallback');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
