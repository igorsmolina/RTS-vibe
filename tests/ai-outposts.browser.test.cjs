'use strict';
// Partida real no navegador (motor e UI de produção): pontes bloqueadas por tanques azuis, azul construindo postos.
// Verifica que a IA vermelha expande (constrói e captura), gasta o orçamento, reconhece postos e não derrama infantaria
// na travessia bloqueada; e que o botão "Ver mapa inteiro" do fim de partida revela o inimigo.
const path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),page=await (await browser.newContext()).newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href);await page.evaluate(()=>terrainReady);
  const r=await page.evaluate(({MAP,SEED})=>{
   for(const d of document.querySelectorAll('dialog[open]'))d.close();
   newOperation(MAP,'normal',SEED,'rts');paused=true;
   const g=game,B=[];for(let y=0;y<g.terrain.length/128;y++)for(let x=0;x<128;x++)if(g.terrain[y*128+x]==='bridge')B.push({x,y});
   const hqB=g.hq('blue'),hqR=g.hq('red'),groups=[];
   for(const b of B){const q=groups.find(G=>G.some(c=>Math.abs(c.x-b.x)+Math.abs(c.y-b.y)<=2));if(q)q.push(b);else groups.push([b]);}
   for(const G of groups.filter(G=>G.some(c=>Math.abs(c.x-64)<=14))){const c=G.reduce((a,b)=>Math.abs(b.x-hqB.x)+Math.abs(b.y-hqB.y)<Math.abs(a.x-hqB.x)+Math.abs(a.y-hqB.y)?b:a);for(let i=0;i<3;i++)g.add('blue','heavyTank',c.x-(hqB.x<hqR.x?1+i:-1-i),c.y);}
   const posts=o=>g.structures.filter(s=>s.owner===o&&s.type==='post'&&s.hp>0).length;
   const seen=new Map(),lost=[];let idle=0,run=0,longest=0,blueBuilt=0,minutes=6;
   for(let i=0;i<30*60*minutes&&!g.winner;i++){
    g.update(1/30);
    if(i%150===0){ // jogador azul scriptado: constrói postos, produz e manda infantaria ociosa para perto do QG
     const b=g.units.filter(u=>u.owner==='blue'&&u.hp>0),inf=b.find(u=>u.type==='infantry'&&!u.pending&&g.canBuild(u));
     if(inf&&g.credits.blue>=60&&g.order(inf,'build'))blueBuilt++;
     const hq=g.hq('blue');if(hq&&g.credits.blue>=300&&hq.queue.length<2)g.enqueue('blue',i%300?'heavyTank':'infantry',hq);
     for(const u of b.filter(u=>u.type==='infantry'&&!u.pending&&!g.canBuild(u)))g.order(u,'move',{x:Math.round(hq.x+6+(u.id%5)*3),y:Math.round(hq.y-6-(u.id%4)*3)});
    }
    if(i%30===0){
     if(g.credits.red>=250){idle++;run++;longest=Math.max(longest,run);}else run=0;
     const alive=new Set(g.aiArmy().map(u=>u.id));
     for(const [id,v] of seen)if(!alive.has(id)){seen.delete(id);if(v.type==='infantry'&&!g.structures.some(s=>s.owner==='red'&&s.type==='post'&&Math.abs(s.x-v.x)+Math.abs(s.y-v.y)<=3))lost.push({t:Math.round(g.time),x:v.x,y:v.y});}
     for(const u of g.units)if(u.owner==='red')seen.set(u.id,{type:u.type,x:Math.round(u.x),y:Math.round(u.y)});
    }
   }
   const intel=g.plan.postIntel||{},recorded=Object.keys(intel).length,withThreat=Object.values(intel).filter(v=>v.threat>0).length;
   // fim de partida: o botão revela o mapa inteiro com as posições do inimigo
   g.winner='blue';updateUI();
   const button=document.getElementById('revealMap'),before=g.units.filter(u=>u.owner==='red'&&!g.isVisible('blue',u)).length;
   const shown=!!button&&!button.hidden;if(button)button.click();
   const after=g.units.filter(u=>u.owner==='red'&&!g.isVisible('blue',u)).length;
   return{time:Math.round(g.time),redPosts:posts('red'),bluePosts:posts('blue'),blueBuilt,idle,longest,lost,recorded,withThreat,credits:Math.round(g.credits.red),
    reveal:{shown,before,after,explored:g.explored.blue.every(Boolean),dialogOpen:document.getElementById('result').open}};
  },{MAP:process.env.MAP||'river',SEED:Number(process.env.SEED||3)});
  console.log(JSON.stringify(r));
  assert.deepEqual(errors,[]);
  assert.ok(r.time>=340,'simulou ~6 min de partida');
  assert.ok(r.redPosts>=6,'IA expande: postos vermelhos '+r.redPosts);
  assert.ok(r.redPosts>=r.bluePosts-2,'IA acompanha a expansão azul');
  assert.ok(r.lost.length<=5,'infantaria perdida fora de construção: '+JSON.stringify(r.lost));
  assert.ok(r.idle<=r.time*.2,'caixa parado ≥250: '+r.idle+' s');
  assert.ok(r.longest<=50,'maior trecho de caixa parado: '+r.longest+' s');
  assert.ok(r.recorded>=4,'postos reconhecidos: '+r.recorded);
  assert.equal(r.reveal.shown,true);assert.ok(r.reveal.before>0);assert.equal(r.reveal.after,0);assert.equal(r.reveal.explored,true);assert.equal(r.reveal.dialogOpen,false);
  console.log('OK IA no navegador: expansão, orçamento, reconhecimento e revelação do mapa no fim da partida.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
