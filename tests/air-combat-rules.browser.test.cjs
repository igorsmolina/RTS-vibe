'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(__dirname,'../public/index.html')).href);
  await page.waitForFunction(()=>typeof renderer!=='undefined'&&newTroopImages.stealthDrone.every(i=>i.complete&&i.naturalWidth));
  const result=await page.evaluate(()=>{
   game=new Game('river','normal',17,'rts',{posts:2});game.aiEnabled=false;game.units=[];game.structures=[];game.terrain.fill('plain');paused=true;
   const d=game.add('blue','stealthDrone',20,20),enemy=game.add('red','stealthDrone',23,20);game.updateVision();
   const image=sprite(d.type,TEAM[d.owner],.86,0,false,0,true),alphas=[],ctx=renderer.ctx,original=ctx.drawImage;
   ctx.drawImage=function(...args){if(args[0]===image)alphas.push(this.globalAlpha);return original.apply(this,args);};
   try{renderer.entity(d);}finally{ctx.drawImage=original;}
   const visible=game.isVisible('blue',enemy);d.x=60;game.updateVision();
   return{alphas,visible,hidden:!game.isVisible('blue',enemy)};
  });
  assert.deepEqual(result.alphas,[1]);assert.ok(result.visible&&result.hidden);assert.deepEqual(errors,[]);
  console.log('OK drone opacity and current recognition in Chrome');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
