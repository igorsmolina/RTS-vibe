'use strict';
// Barra e cronômetro na tela para processos com duração (só do jogador local, só RTS, sem texto no zoom muito afastado).
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.context().setOffline(true);
 await page.goto(pathToFileURL(path.join(__dirname,'..','public','index.html')).href);await page.evaluate(()=>terrainReady);
 const r=await page.evaluate(async()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();newOperation('river','normal',123,'rts',{posts:2});paused=true;game.aiEnabled=false;game.units=[];game.structures=[];game.explored.blue.fill(true);game.visible.blue.fill(true);await renderer.groundReady;
  const post=game.add('neutral','post',30,60),mine=game.add('blue','infantry',29,60),foe=game.add('red','infantry',32,62);game.updateVision();
  game.order(mine,'capture',{targetId:post.id,position:post});for(let i=0;i<15;i++)game.update(1/30);game.events=[];
  const texts=[],ft=renderer.ctx.fillText.bind(renderer.ctx);renderer.ctx.fillText=(t,...a)=>{texts.push(String(t));return ft(t,...a);};
  const draw=zoom=>{texts.length=0;cam.zoom=zoom;centerCamera(30,60);renderer.draw(0);return texts.filter(t=>/Capturando|Manutenção|Treinando|Obra/.test(t));};
  const near=draw(1);foe.job={type:'capture',targetId:post.id};foe.work=1;const withFoe=draw(1);
  const stripped=JSON.parse(JSON.stringify({id:77,type:'infantry',owner:'red',x:33,y:60,hp:100,maxHp:100,facing:0}));game.units.push(Object.assign(game.add('red','infantry',34,60),{job:undefined,work:undefined}));let crashed=false;try{draw(1);}catch(e){crashed=e.message;}
  const far=draw(.2);return {near,withFoe,far,crashed};});
 assert.equal(r.near.length,1);assert.match(r.near[0],/^Capturando \d,\d s$/);assert.equal(r.withFoe.length,1,'inimigo não mostra cronômetro');assert.equal(r.crashed,false);assert.equal(r.far.length,0,'sem texto no zoom afastado');assert.deepEqual(errors,[]);console.log('OK cronômetro na tela: '+r.near[0]);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
