'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.context().setOffline(true);await page.goto(pathToFileURL(path.resolve('public/index.html')).href);
 const result=await page.evaluate(()=>{
  newOperation('river','normal',123,'rts',{posts:2});paused=true;game.units=[];game.structures=[];game.terrain.fill('plain');game.credits.red=0;
  for(let y=0;y<96;y++)game.terrain[KEY(64,y)]='river';game.add('blue','hq',1,94);game.add('red','hq',26,20);
  const base=game.add('blue','airportDirt',20,20),plane=game.add('blue','fighterBlue',21,21);plane.flightState='grounded';plane.airportId=base.id;plane.ammo={};
  game.add('red','antiAirVehicle',110,10);for(let i=0;i<12;i++)game.add('blue','infantry',i+1,90);
  game.updateVision();renderer.rebuild();centerCamera(23,21);renderer.draw(0);
  let calls=0,maxSearches=0,rangeCalls=0;const find=game.findPath,range=game.pathToRange;
  game.findPath=function(...args){calls++;return find.apply(this,args);};
  game.pathToRange=function(...args){const before=calls,result=range.apply(this,args);maxSearches=Math.max(maxSearches,calls-before);rangeCalls++;return result;};
  game.order(plane,'takeoff');const phases=[],spikes=[];let maxUpdate=0;
  for(let i=0;i<600;i++){const start=performance.now();game.update(1/30);const elapsed=performance.now()-start;if(i>120){maxUpdate=Math.max(maxUpdate,elapsed);if(elapsed>30)spikes.push({tick:i,ms:elapsed});}if(phases.at(-1)!==plane.flightState)phases.push(plane.flightState);renderer.consume();renderer.draw(1/30);}
  return {units:game.units.length,phases,maxSearches,rangeCalls,maxUpdate,spikes};
 });assert.equal(result.units,14);assert.ok(result.phases.includes('climb')&&result.phases.includes('patrol'));assert.ok(result.rangeCalls>10);assert.equal(result.maxSearches,1);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.resolve('tests/artifacts/flight-path-browser.json'),JSON.stringify(result,null,2));console.log('OK decolagem offline, 14 unidades e reação da IA: '+JSON.stringify(result));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
