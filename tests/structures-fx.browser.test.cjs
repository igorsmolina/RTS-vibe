'use strict';
// Efeitos das estruturas no Canvas real: bandeira e antena animadas, dano progressivo, destroços temporários, poses fixas
// (pausa, Desempenho, movimento reduzido, estrutura lembrada) e orçamento de custo e memória.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
const root=process.env.RTS_PUBLIC?path.resolve(process.env.RTS_PUBLIC):path.join(__dirname,'..','public'),artifacts=path.join(__dirname,'artifacts');
fs.mkdirSync(artifacts,{recursive:true});

const scene=()=>{
 for(const d of document.querySelectorAll('dialog[open]'))d.close();
 newOperation('desert','normal',123,'rts',{posts:2});paused=true;game.aiEnabled=false;game.units=[];game.structures=[];game.mines=[];game.projectiles=[];game.terrain.fill('plain');
 game.add('blue','hq',4,4);game.add('red','hq',110,80);game.updateVision();game.visible.blue.fill(true);game.explored.blue.fill(true);setSelection([]);
 // Funções de apoio, ficam na página.
 window.__region=(s,pad=6,trim=0)=>{const z=cam.zoom*(devicePixelRatio||1),w=(s.width||1)*CELL*z,h=(s.height||1)*CELL*z-trim*z,x=Math.max(0,Math.round((s.x*CELL-cam.x)*z-pad)),y=Math.max(0,Math.round((s.y*CELL-cam.y)*z-pad));
  const d=renderer.ctx.getImageData(x,y,Math.round(w+pad*2),Math.round(h+pad*2)).data,u=new Uint32Array(d.buffer);let hash=2166136261;for(let i=0;i<u.length;i++){hash^=u[i];hash=Math.imul(hash,16777619);}return hash>>>0;};
 window.__shot=(s,time,trim)=>{if(time!==undefined)renderer.fx.time=time;renderer.draw(0);return __region(s,6,trim);};
};

(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const report={};try{
 const page=await browser.newPage({viewport:{width:1300,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.context().setOffline(true);
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.evaluate(()=>terrainReady);await page.evaluate(()=>battlefieldReady);
 await page.evaluate(scene);await page.evaluate(()=>renderer.groundReady);

 // 1. Bandeira e antena: mudam com o relógio visual, congelam na pausa e ficam fixas em Desempenho e com movimento reduzido.
 for(const profile of ['balanced','cinematic','performance']){
  const r=await page.evaluate(profile=>{
   settings.graphics=profile;game.structures=game.structures.filter(s=>s.type==='hq'&&s.owner==='red');const hq=game.add('blue','hq',12,10),post=game.add('blue','post',20,10);game.updateVision();renderer.rebuild();cam.zoom=1.5;centerCamera(17,11.5);
   const out={};for(const s of [hq,post]){const t0=__shot(s,2),again=__shot(s,2);renderer.fx.advance(0);const paused=__shot(s,2),later=__shot(s,2.37);out[s.type]={repeat:t0===again,paused:t0===paused,animated:t0!==later};}
   return out;},profile);
  for(const [type,v] of Object.entries(r)){
   assert.ok(v.repeat&&v.paused,`${profile} ${type}: mesmo relógio, mesmos pixels (pausa congela)`);
   if(profile==='performance')assert.equal(v.animated,false,`${profile} ${type}: pose fixa em Desempenho`);else assert.equal(v.animated,true,`${profile} ${type}: anima com o relógio visual`);
  }
  report['animacao-'+profile]=r;
 }
 // Movimento reduzido: pose fixa mesmo em Cinematográfico.
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>reducedMotion);
 const reduced=await page.evaluate(()=>{settings.graphics='cinematic';const s=game.structures.find(s=>s.type==='post'&&s.owner==='blue');return __shot(s,2)===__shot(s,2.37);});
 assert.equal(reduced,true,'movimento reduzido: bandeira e antena fixas');await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>!reducedMotion);

 // 2. Estrutura lembrada na névoa fica estática.
 const remembered=await page.evaluate(()=>{
  settings.graphics='cinematic';const enemy=game.add('red','post',20,10);game.updateVision();game.memory.blue.set(KEY(enemy.x,enemy.y),{id:enemy.id,x:enemy.x,y:enemy.y,type:'post',owner:'red',width:2,height:2});
  const savedVisible=game.visible.blue.slice(),savedSky=game.sky.blue.slice();game.visible.blue.fill(false);game.sky.blue.fill(false);centerCamera(20.5,11);
  const a=__shot(enemy,3),b=__shot(enemy,3.37);for(let k=0;k<savedVisible.length;k++){game.visible.blue[k]=savedVisible[k];game.sky.blue[k]=savedSky[k];}game.structures=game.structures.filter(s=>s!==enemy);game.memory.blue.clear();return a===b;});
 assert.equal(remembered,true,'estrutura lembrada na névoa em pose fixa');

 // 3. Dano progressivo e reparo (Desempenho: pose fixa, comparação exata).
 const damage=await page.evaluate(()=>{
  settings.graphics='performance';const post=game.add('blue','post',30,10);game.updateVision();centerCamera(30.5,11);cam.zoom=1.5;
  const shots={};for(const [name,ratio] of [['inteiro',1],['70',.7],['40',.4],['15',.15]]){post.hp=Math.round(post.maxHp*ratio);shots[name]=__shot(post,5,22);}
  post.hp=post.maxHp;shots.reparado=__shot(post,5,22);return shots;});
 assert.notEqual(damage.inteiro,damage['70'],'estágio 1 aparece');assert.notEqual(damage['70'],damage['40'],'estágio 2 aparece');assert.notEqual(damage['40'],damage['15'],'estágio 3 aparece');
 assert.equal(damage.reparado,damage.inteiro,'o reparo remove o dano visual');report.dano=damage;

 // 4. Destroços: aparecem ao destruir, somem após 30 s visuais e não existem se o evento não era visível.
 const wreck=await page.evaluate(()=>{
  settings.graphics='performance';const post=game.add('blue','post',40,10);game.updateVision();centerCamera(40.5,11);cam.zoom=1.5;
  const placed=__shot(post,10,22);game.structures=game.structures.filter(s=>s!==post);renderer.fx.wrecks.length=0;const empty=__shot(post,10,22);game.structures.push(post);
  game.hurt(post,9999,null);renderer.consume();const rubble=__shot(post,10,22);const count=renderer.fx.wrecks.length;
  renderer.fx.advance(31);renderer.texts.length=0;renderer.particles.length=0;const gone=__shot(post,10,22);return{placed,empty,rubble,gone,count,stillThere:renderer.fx.wrecks.length};});
 assert.equal(wreck.count,1,'a destruição deixa um destroço');assert.notEqual(wreck.rubble,wreck.empty,'o entulho é desenhado');
 assert.equal(wreck.stillThere,0,'o destroço expira');
 assert.equal(wreck.gone,wreck.empty,'depois de expirar, a região volta a ser só terreno');
 const hidden=await page.evaluate(()=>{renderer.fx.reset();const before=renderer.fx.wrecks.length;renderer.fx.consume({kind:'blast',x:42,y:7,visible:false,wreck:{type:'post',x:41,y:6,width:2,height:2}});return renderer.fx.wrecks.length-before;});
 assert.equal(hidden,0,'evento invisível não cria destroço');

 // 5. Orçamento: 24 estruturas danificadas e 16 destroços, custo de desenho e heap estável.
 const session=await page.context().newCDPSession(page);await session.send('Performance.enable');
 const budget=await page.evaluate(async()=>{
  settings.graphics='cinematic';game.structures=game.structures.filter(s=>s.type==='hq');game.add('red','hq',110,80);
  renderer.fx.reset();cam.zoom=.7;centerCamera(20,12);
  const grid=[];for(let r=0;r<5;r++)for(let c=0;c<8;c++)grid.push({x:3+c*4,y:4+r*4});
  const posts=grid.map(p=>game.add('blue','post',p.x,p.y));game.updateVision();renderer.rebuild();await renderer.groundReady;
  const median=()=>{const t=[];for(let i=0;i<40;i++){const s=performance.now();renderer.draw(1/30);t.push(performance.now()-s);}t.sort((a,b)=>a-b);return t[20];};
  for(let i=0;i<10;i++)renderer.draw(1/30);const baseline=median();
  posts.slice(0,24).forEach((p,i)=>{p.hp=Math.max(1,Math.round(p.maxHp*[.7,.45,.2][i%3]));});
  for(const p of posts.slice(24)){game.hurt(p,9999,null);}renderer.consume();
  for(let i=0;i<10;i++)renderer.draw(1/30);const damaged=median();
  return{baseline,damaged,wrecks:renderer.fx.wrecks.length,damageSprites:Object.keys(renderer.fx.art).filter(k=>k.startsWith('damage:')).length,wreckSprites:Object.keys(renderer.fx.art).filter(k=>k.startsWith('wreck:')).length,particles:renderer.fx.particles.length,cap:renderer.fx.profile().particles,fxImages:Object.keys(renderer.fx.cache).length};});
 report.orcamento=budget;
 assert.equal(budget.wrecks,16);assert.ok(budget.damageSprites<=12&&budget.wreckSprites<=8,'caches procedurais limitados');
 assert.ok(budget.particles<=budget.cap,'fumaça respeita o limite de partículas');
 assert.ok(budget.damaged<=budget.baseline+1.5,`custo de desenho: ${budget.damaged.toFixed(2)} ms contra ${budget.baseline.toFixed(2)} ms sem dano`);
 const heap=[];
 for(let wave=0;wave<8;wave++){
  await page.evaluate(()=>{renderer.fx.advance(31);const posts=game.structures.filter(s=>s.type==='post'&&s.owner==='blue');for(const p of posts.slice(0,16))game.hurt(p,9999,null);for(let i=0;i<16;i++)game.add('blue','post',3+(i%8)*4,4+Math.floor(i/8)*4);renderer.consume();for(let i=0;i<120;i++)renderer.draw(1/30);});
  await session.send('HeapProfiler.collectGarbage');const m=await session.send('Performance.getMetrics');heap.push(m.metrics.find(x=>x.name==='JSHeapUsedSize').value);
 }
 report.heap=heap;assert.ok(heap.at(-1)<=heap[1]+1.5*1024*1024,`heap estável após aquecer (${(heap[1]/1048576).toFixed(2)} → ${(heap.at(-1)/1048576).toFixed(2)} MB)`);
 const after=await page.evaluate(()=>({damage:Object.keys(renderer.fx.art).filter(k=>k.startsWith('damage:')).length,wreck:Object.keys(renderer.fx.art).filter(k=>k.startsWith('wreck:')).length,fxImages:Object.keys(renderer.fx.cache).length}));
 assert.ok(after.damage<=12&&after.wreck<=8);assert.equal(after.fxImages,budget.fxImages,'cache fixo de efeitos inalterado');
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(artifacts,'structures-fx.json'),JSON.stringify(report,null,2));
 console.log('Medições reais: '+JSON.stringify({baselineMs:+budget.baseline.toFixed(2),damagedMs:+budget.damaged.toFixed(2),heapMB:heap.map(h=>+(h/1048576).toFixed(2))}));
 console.log('OK estruturas: bandeira/antena animadas e fixas, dano progressivo e reparo, destroços de 30 s, névoa, custo e heap dentro do orçamento.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
