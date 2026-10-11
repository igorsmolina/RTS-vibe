'use strict';
// Estresse: 300 tropas + 12 jatos em RTS, marcha e combate; mede o motor e os quadros reais no navegador.
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.context().setOffline(true);
 await page.goto(pathToFileURL(path.join(__dirname,'../public/index.html')).href);await page.evaluate(()=>terrainReady);
 const setup=()=>page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();newOperation('river','normal',44,'rts');
  const kinds=['infantry','infantry','engineer','antitank','machinegun','lightTank','tank','heavyTank','artillery','recon','missileInfantry','antiAirVehicle','helicopter','rocketArtillery','reconDrone','stealthDrone'];
  let placed=0;for(const owner of ['blue','red']){let i=0;while(placed<(owner==='blue'?150:300)&&i<5000){const x=owner==='blue'?34+i%12*2:78+i%12*2,y=(6+Math.floor(i/12)*3)%92;i++;try{if(game.add(owner,kinds[placed%kinds.length],x,y))placed++;}catch(e){}}}
  for(let i=0;i<12;i++){const blue=i<6;game.add(blue?'blue':'red',blue?(i%2?'fighterBlue':'multiroleBlue'):(i%2?'fighterRed':'multiroleRed'),blue?30+i*3:98-(i-6)*3,50);}
  game.updateVision();const blue=game.units.filter(u=>u.owner==='blue');for(const u of blue)game.order(u,'attackMove',{x:100,y:48},true);
  setSelection(blue.slice(0,40).map(u=>u.id));centerCamera(60,30);paused=true;updateUI();return game.units.length;});
 const units=await setup();assert.ok(units>=300,'pelo menos 300 tropas no mapa: '+units);
 const engine=await page.evaluate(()=>{const original=game.updateVision;let calls=0;game.updateVision=function(){calls++;return original.call(this);};
  const times=[];let visionMax=0;for(let i=0;i<600;i++){const before=calls,t=performance.now();game.update(1/30);times.push(performance.now()-t);visionMax=Math.max(visionMax,calls-before);}
  delete game.updateVision;const sorted=[...times].sort((a,b)=>a-b),round=n=>Math.round(n*10)/10;
  return{mean:round(times.reduce((a,b)=>a+b,0)/times.length),p95:round(sorted[Math.floor(sorted.length*.95)]),max:round(sorted.at(-1)),visionPerUpdate:round(calls/times.length),visionMax,alive:game.units.filter(u=>u.owner!=='neutral').length,time:round(game.time)};});
 const frames={};for(const rate of [1,2]){await setup();frames[rate+'x']=await page.evaluate(async rate=>{speed=rate;paused=false;const out=[];let last=performance.now();const start=last;
  await new Promise(done=>{const tick=now=>{out.push(now-last);last=now;if(now-start<4000)requestAnimationFrame(tick);else done();};requestAnimationFrame(tick);});paused=true;speed=1;out.sort((a,b)=>a-b);
  return{frames:out.length,median:Math.round(out[out.length>>1]*10)/10,p95:Math.round(out[Math.floor(out.length*.95)]*10)/10,max:Math.round(out.at(-1))};},rate);}
 console.log('Medições reais (ms): '+JSON.stringify({units,engine,frames}));
 assert.ok(engine.visionPerUpdate<=3,'visão agrupada: '+engine.visionPerUpdate+' chamadas por update');
 assert.ok(engine.p95<=40,'p95 do update: '+engine.p95+' ms');assert.ok(engine.max<=300,'pior update: '+engine.max+' ms');
 assert.deepEqual(errors,[]);console.log('OK estresse: 300 tropas + 12 jatos, marcha e combate RTS, visão agrupada, IA espalhada e quadros a 1× e 2× offline.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
