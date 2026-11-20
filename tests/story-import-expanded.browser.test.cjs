'use strict';
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await b.newPage();await p.goto(pathToFileURL(path.resolve('public/index.html')).href);
 const raw=await p.evaluate(()=>{const c=newCampaign(2024,'hard','turns','story');c.story.version=1;c.story.completed=[1,2];return JSON.stringify({kind:'rtsvibe-battle',campaign:serializeCampaign(c),battle:{version:1,mission:{version:1,chapter:3}},campaignBattle:{region:1}});});
 await p.locator('#loadBattle').setInputFiles({name:'legacy-battle.json',mimeType:'application/json',buffer:Buffer.from(raw)});
 await p.waitForFunction(()=>campaign?.story?.version===2&&campaign.story.completed.length===0);
 assert.equal(await p.evaluate(()=>campaign.mode),'turns');
 assert.equal(await p.evaluate(()=>campaign.seed),2024);
 assert.equal(await p.evaluate(()=>campaignBattle),null);
 assert.equal(await p.evaluate(()=>localStorage.getItem(LEGACY_CAMPAIGN_BACKUP_KEY)),raw);
 const result=await p.evaluate(()=>{const c=newCampaign(11,'normal','rts','story');c.story.version=1;const original=serializeCampaign(c);const incoming={...bundle(),campaign:original};applyBundle(incoming);return {original,backup:localStorage.getItem(LEGACY_CAMPAIGN_BACKUP_KEY),stored:JSON.parse(localStorage.getItem(CAMPAIGN_KEY))};});
 assert.equal(result.backup,result.original);assert.equal(result.stored.story.version,2);
 console.log('OK legacy battle and profile imports: backup before reset, first chapter, obsolete battle discarded');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
