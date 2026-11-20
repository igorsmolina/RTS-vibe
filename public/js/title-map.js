'use strict';
/* Carta da tela inicial: teatros de verdade, saídos do gerador do jogo com três bases, desenhados como mapa de campanha.
   Comboios andam pelas estradas e aeronaves cruzam a carta; a cada SWAP_MS outro teatro é traçado por cima do anterior. */
const TitleMap=(()=>{
 const W=1024,H=768,PX=W/COLS,SWAP_MS=16000,WIPE_MS=1500,CONVOYS=9;
 const SIDES=['blue','red','green'],FACTION={blue:'blue',red:'red',green:FRANCE};
 const ROTATION=['river','desert','mountain','random'];
 const VEHICLES=['lightTank','tank','tank','heavyTank','artillery','recon','antiAirVehicle','rocketArtillery','transportTruck'];
 const SLOW=new Set(['heavyTank','artillery','rocketArtillery','transportTruck']);
 const HELIS=['helicopter','helicopterGround','transportHelicopter'];
 const planes=Object.fromEntries(SIDES.map(side=>[side,startingCatalog(FACTION[side]).filter(t=>TYPES[t].plane&&!TYPES[t].airdropPlane)]));
 const hash=(a,b)=>{let n=(Math.imul(a+7,0x9e3779b1)^Math.imul(b+3,0x85ebca6b))>>>0;n=Math.imul(n^(n>>>15),0x2c1b3c6d)>>>0;return((n^(n>>>13))>>>0)/4294967296;};
 const pick=list=>list[Math.floor(Math.random()*list.length)];
 const rgba=(hex,a)=>`rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`;
 const turn=d=>Math.atan2(Math.sin(d),Math.cos(d)),ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
 const idle=fn=>'requestIdleCallback' in window?requestIdleCallback(fn,{timeout:1500}):setTimeout(fn,40);
 let canvas=null,ctx=null,caption=null,cur=null,next=null,wipe=null,raf=0,last=0,since=0,index=Math.floor(Math.random()*ROTATION.length),building=false;

 // Terreno: um quadrado por casa com textura leve, estradas com contorno, bases e postos como no campo de batalha.
 function paint(game,map){
  const base=document.createElement('canvas');base.width=W;base.height=H;const c=base.getContext('2d'),T=game.terrain;
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
   const t=T[KEY(x,y)],h=hash(x,y),px=x*PX,py=y*PX;
   c.fillStyle=terrainMinimapColor(t,map);c.fillRect(px,py,PX+.5,PX+.5);
   c.fillStyle=h<.5?`rgba(255,255,255,${(.5-h)*.1})`:`rgba(0,0,0,${(h-.5)*.1})`;c.fillRect(px,py,PX+.5,PX+.5);
  }
  c.lineCap='round';c.lineJoin='round';
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
   const t=T[KEY(x,y)],h=hash(x+31,y+17),px=x*PX,py=y*PX;
   if(t==='forest'){c.fillStyle='rgba(18,38,24,.38)';for(const [dx,dy,r]of [[2+h*3,2.6,1.7],[5.4,5.2-h*2,1.9]]){c.beginPath();c.arc(px+dx,py+dy,r,0,7);c.fill();}}
   else if(t==='hill'){c.strokeStyle='rgba(60,72,40,.4)';c.lineWidth=1.2;c.beginPath();c.arc(px+4,py+6.2,3.2,Math.PI,0);c.stroke();}
   else if(t==='mountain'){c.fillStyle='rgba(40,44,40,.4)';c.beginPath();c.moveTo(px+4,py+1);c.lineTo(px+7.4,py+7);c.lineTo(px+.6,py+7);c.fill();c.fillStyle='rgba(255,255,255,.22)';c.beginPath();c.moveTo(px+4,py+1);c.lineTo(px+5.6,py+4);c.lineTo(px+4,py+4.4);c.fill();}
   else if(t==='river'){c.strokeStyle='rgba(255,255,255,.2)';c.lineWidth=1;c.beginPath();c.moveTo(px+1,py+3+h*2);c.lineTo(px+4,py+2+h*2);c.lineTo(px+7,py+3+h*2);c.stroke();}
   else if(t==='field'&&(x+y)%2===0){c.fillStyle='rgba(255,255,255,.1)';c.fillRect(px,py+2,PX,1.4);c.fillRect(px,py+5.4,PX,1.4);}
   else if(t==='hedge'){c.fillStyle='rgba(15,35,18,.28)';c.fillRect(px+1,py+3.2,PX-2,1.8);}
  }
  return base;
 }
 function overlay(game,base){
  const c=base.getContext('2d'),T=game.terrain,hqs=game.structures.filter(s=>s.type==='hq');
  for(const hq of hqs){const cx=(hq.x+1.5)*PX,cy=(hq.y+1.5)*PX,g=c.createRadialGradient(cx,cy,12,cx,cy,190);g.addColorStop(0,rgba(TEAM[hq.owner],.22));g.addColorStop(1,rgba(TEAM[hq.owner],0));c.fillStyle=g;c.fillRect(0,0,W,H);}
  const road=k=>T[k]==='road'||T[k]==='bridge';
  for(const [width,casing]of [[7,true],[4.4,false]])for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
   const k=KEY(x,y);if(!road(k))continue;
   c.strokeStyle=casing?'rgba(48,40,28,.6)':T[k]==='bridge'?'#e2d2a2':'#c9b585';c.lineWidth=width;c.beginPath();
   const cx=(x+.5)*PX,cy=(y+.5)*PX;c.moveTo(cx,cy);c.lineTo(cx+.01,cy);
   if(x+1<COLS&&road(k+1)){c.moveTo(cx,cy);c.lineTo(cx+PX,cy);}
   if(y+1<ROWS&&road(k+COLS)){c.moveTo(cx,cy);c.lineTo(cx,cy+PX);}
   c.stroke();
  }
  // Colunas A–G e fileiras 1–4 da moldura.
  c.strokeStyle='rgba(20,32,26,.24)';c.lineWidth=1;c.beginPath();
  for(let i=1;i<7;i++){const x=Math.round(W/7*i)+.5;c.moveTo(x,0);c.lineTo(x,H);}
  for(let j=1;j<4;j++){const y=Math.round(H/4*j)+.5;c.moveTo(0,y);c.lineTo(W,y);}
  c.stroke();
  for(const s of game.structures){
   const cx=(s.x+(s.width||1)/2)*PX,cy=(s.y+(s.height||1)/2)*PX;let owner=s.owner;
   if(s.type==='post'&&hash(s.x,s.y)>=.4)owner=hqs.map(h=>[h.owner,Math.hypot(h.x-s.x,h.y-s.y)]).sort((a,b)=>a[1]-b[1])[0][0];
   unitIcon(c,s.type,cx,cy+(s.type==='hq'?6:5),TEAM[owner],s.type==='hq'?.72:.5,0,0,false,0,false);
  }
  return base;
 }

 // Rede de estradas: para cada base, o caminho mais curto até cada estrada alcançável (busca em largura).
 function network(scene,game){
  const T=game.terrain,road=k=>T[k]==='road'||T[k]==='bridge';
  for(const side of SIDES){
   const hq=game.hq(side),cx=hq.x+1,cy=hq.y+1;let start=-1,best=1e9;
   for(let k=0;k<SIZE;k++)if(road(k)){const d=Math.hypot(k%COLS-cx,Math.floor(k/COLS)-cy);if(d<best){best=d;start=k;}}
   if(start<0)continue;
   const dist=new Int16Array(SIZE).fill(-1),parent=new Int32Array(SIZE).fill(-1),queue=[start],cells=[];dist[start]=0;
   for(let i=0;i<queue.length;i++){const k=queue[i],x=k%COLS;if(dist[k]>=30)cells.push(k);
    for(const n of [x>0?k-1:-1,x<COLS-1?k+1:-1,k>=COLS?k-COLS:-1,k<SIZE-COLS?k+COLS:-1])if(n>=0&&dist[n]<0&&road(n)){dist[n]=dist[k]+1;parent[n]=k;queue.push(n);}}
   if(!cells.length)cells.push(...queue.slice(-20));
   scene.routes[side]={start,parent,cells};
  }
 }

 function build(){
  const map=ROTATION[index++%ROTATION.length],seed=1+Math.floor(Math.random()*4294967294);
  const options=map==='random'?{water:.2+Math.random()*.35,forest:.25+Math.random()*.4,relief:.25+Math.random()*.4,farmland:.3+Math.random()*.5,posts:24}:{};
  const game=new Game(map,'normal',seed,'turns',options,{},{},null,{blue:'blue',red:'red',green:FRANCE});
  return {map,seed,game};
 }
 // Em duas etapas ociosas (gerar, depois desenhar) para não passar de ~50 ms de uma vez; só começa com o início aberto.
 function buildAsync(done){
  building=true;
  idle(()=>{
   if(!document.getElementById('titleScreen').open){building=false;return;}
   let first;try{first=build();}catch(error){console.error('Carta do início:',error);building=false;done(null);return;}
   idle(()=>{
    try{
     const {map,seed,game}=first,base=paint(game,map);
     idle(()=>{
      try{
       overlay(game,base);
       const scene={map,seed,name:MAPS[map]+' · semente '+seed,base,convoys:[],flyers:[],puffs:[],routes:{},timer:0,flyTimer:2+Math.random()*3};
       network(scene,game);for(let i=0;i<CONVOYS;i++)spawn(scene,true);step(scene,0);building=false;done(scene);
      }catch(error){console.error('Carta do início:',error);building=false;done(null);}
     });
    }catch(error){console.error('Carta do início:',error);building=false;done(null);}
   });
  });
 }

 // Comboio: 1 a 3 veículos de um lado, saindo da base ou voltando a ela, com a cor e a arte do time.
 function spawn(scene,initial=false){
  const side=pick(SIDES),route=scene.routes[side];if(!route)return;
  const cells=[];for(let k=pick(route.cells);k!==-1;k=route.parent[k])cells.push(k);
  if(Math.random()<.5)cells.reverse();
  const path=cells.map(k=>({x:k%COLS+.5,y:Math.floor(k/COLS)+.5}));if(path.length<8)return;
  const kind=pick(VEHICLES),units=[];
  for(let i=0,n=1+Math.floor(Math.random()*3);i<n;i++)units.push({type:Math.random()<.65?kind:pick(VEHICLES),off:i*1.9,facing:null,puff:0,x:0,y:0,alpha:0});
  const speed=(2.6+Math.random()*1.4)*(SLOW.has(kind)?.75:kind==='recon'?1.5:1);
  scene.convoys.push({side,path,speed,units,s:initial?Math.random()*path.length*.85:-1});
 }
 function flyer(scene){
  const side=pick(SIDES),plane=Math.random()<.65,type=plane?pick(planes[side]):pick(HELIS),left=Math.random()<.5;
  const a={x:left?-8:COLS+8,y:8+Math.random()*80},b={x:left?COLS+8:-8,y:8+Math.random()*80};
  scene.flyers.push({side,type,a,b,plane,t:0,speed:(plane?15:6.5)/Math.hypot(b.x-a.x,b.y-a.y),sway:plane?0:4,phase:Math.random()*6,x:0,y:0,facing:0});
 }
 function where(f,t){const dx=f.b.x-f.a.x,dy=f.b.y-f.a.y,len=Math.hypot(dx,dy),s=Math.sin(t*Math.PI*2+f.phase)*f.sway;return{x:f.a.x+dx*t-dy/len*s,y:f.a.y+dy*t+dx/len*s};}
 function at(path,d){const L=path.length-1;d=Math.max(0,Math.min(L,d));const i=Math.min(L-1,Math.floor(d)),t=d-i,a=path[i],b=path[i+1];return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}

 function step(scene,dt){
  for(const c of scene.convoys){
   c.s+=c.speed*dt;const L=c.path.length-1;
   for(const u of c.units){
    const d=c.s-u.off,p=at(c.path,d),q1=at(c.path,d-.45),q2=at(c.path,d+.45);
    u.x=(q1.x+q2.x)/2;u.y=(q1.y+q2.y)/2;
    const aim=Math.hypot(q2.x-q1.x,q2.y-q1.y)>1e-3?Math.atan2(q2.x-q1.x,-(q2.y-q1.y)):u.facing??0;
    u.facing=u.facing===null?aim:u.facing+turn(aim-u.facing)*Math.min(1,dt*9);
    u.alpha=Math.max(0,Math.min(1,(d+.5)/3,(L-d+.5)/3));
    if(dt&&u.alpha>.3&&(u.puff-=dt)<=0){u.puff=.14;scene.puffs.push({x:p.x,y:p.y,age:0});}
   }
  }
  scene.convoys=scene.convoys.filter(c=>c.s-c.units.at(-1).off<c.path.length+1);
  for(const f of scene.flyers){f.t+=f.speed*dt;const p=where(f,f.t),q=where(f,f.t+.004);f.x=p.x;f.y=p.y;f.facing=Math.atan2(q.x-p.x,-(q.y-p.y));}
  scene.flyers=scene.flyers.filter(f=>f.t<1);
  for(const p of scene.puffs)p.age+=dt;
  if(scene.puffs.length>90||scene.puffs[0]?.age>1)scene.puffs=scene.puffs.filter(p=>p.age<1).slice(-90);
  if(!dt)return;
  if((scene.timer-=dt)<=0&&scene.convoys.length<CONVOYS){spawn(scene);scene.timer=.5+Math.random()*1.1;}
  if((scene.flyTimer-=dt)<=0&&!scene.flyers.length){flyer(scene);scene.flyTimer=6+Math.random()*7;}
 }

 function drawScene(scene,x0,x1){
  ctx.save();
  if(x0>0||x1<W){ctx.beginPath();ctx.rect(x0,0,x1-x0,H);ctx.clip();}
  ctx.drawImage(scene.base,0,0);
  for(const p of scene.puffs){ctx.fillStyle=`rgba(236,226,200,${.3*(1-p.age)})`;ctx.beginPath();ctx.arc(p.x*PX,p.y*PX,2+p.age*4,0,7);ctx.fill();}
  const units=scene.convoys.flatMap(c=>c.units.map(u=>[c,u])).filter(([,u])=>u.alpha>0).sort((a,b)=>a[1].y-b[1].y);
  for(const [c,u] of units){ctx.globalAlpha=u.alpha;unitIcon(ctx,u.type,u.x*PX,u.y*PX,TEAM[c.side],.52,u.facing||0,0,false,0,false,ART[FACTION[c.side]]||0);}
  ctx.globalAlpha=1;
  for(const f of scene.flyers){
   const x=f.x*PX,y=f.y*PX;ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(x+22,y+34,f.plane?18:14,f.plane?7:5,0,0,7);ctx.fill();
   unitIcon(ctx,f.type,x,y,TEAM[f.side],f.plane?.8:.66,f.facing,0,false,0,false,ART[FACTION[f.side]]||0);
  }
  ctx.restore();
 }
 function draw(){
  if(!cur)return;
  ctx.clearRect(0,0,W,H);ctx.imageSmoothingQuality='high';
  if(!wipe){drawScene(cur,0,W);return;}
  const x=ease(wipe.t)*W;
  drawScene(next,0,x);drawScene(cur,x,W);
  const g=ctx.createLinearGradient(x-70,0,x,0);g.addColorStop(0,'rgba(242,194,48,0)');g.addColorStop(1,'rgba(242,194,48,.3)');
  ctx.fillStyle=g;ctx.fillRect(x-70,0,70,H);ctx.fillStyle='#f2c230';ctx.fillRect(x-1,0,2,H);
  for(let y=16;y<H;y+=32)ctx.fillRect(x+1,y,6,1.5);
 }

 function frame(now){
  raf=requestAnimationFrame(frame);
  const dt=Math.min(.1,(now-last)/1000);last=now;
  step(cur,dt);if(next&&wipe)step(next,dt);
  if(wipe){wipe.t+=dt*1000/WIPE_MS;if(wipe.t>=1){cur=next;next=null;wipe=null;since=0;}}
  else{
   since+=dt*1000;
   if(since>SWAP_MS-3500&&!next&&!building){buildAsync(scene=>{next=scene;});}
   if(since>=SWAP_MS&&next){wipe={t:0};setCaption(next.name);}
  }
  draw();
 }
 function setCaption(text){
  if(!caption)return;caption.classList.remove('swap');void caption.offsetWidth;caption.classList.add('swap');
  setTimeout(()=>{caption.textContent=text;},450);
 }

 function start(){
  if(raf||!cur||!document.getElementById('titleScreen').open)return;
  draw();if(reducedMotion)return; // sem movimento: uma carta parada
  last=performance.now();raf=requestAnimationFrame(frame);
 }
 function stop(){cancelAnimationFrame(raf);raf=0;}
 function paint_(){
  canvas=document.getElementById('titleBg');ctx=canvas.getContext('2d');caption=document.getElementById('titleMapName');
  if(cur){canvas.dataset.ready='true';start();return;}
  if(building)return;
  buildAsync(scene=>{cur=scene;if(caption&&cur)caption.textContent=cur.name;canvas.dataset.ready='true';draw();start();});
 }
 document.getElementById('titleScreen').addEventListener('close',stop);
 // Miniatura de um teatro para cartões de menu (240×180): gerada em tempo ocioso, uma por vez, e guardada em cache.
 const thumbs=new Map();let thumbQueue=Promise.resolve();
 function thumb(map,seed,options={},w=240,h=180){
  const key=map+'|'+seed+'|'+JSON.stringify(options)+'|'+w+'x'+h;if(thumbs.has(key))return thumbs.get(key);
  const job=thumbQueue.then(()=>new Promise(resolve=>idle(()=>{
   try{
    const game=new Game(map,'normal',seed,'turns',options,{},{},null,{blue:'blue',red:'red'}),out=document.createElement('canvas');
    out.width=w;out.height=h;out.getContext('2d').drawImage(overlay(game,paint(game,map)),0,0,w,h);resolve(out);
   }catch(error){console.error('Miniatura do teatro:',error);resolve(null);}
  })));
  thumbQueue=job;thumbs.set(key,job);if(thumbs.size>48)thumbs.delete(thumbs.keys().next().value);return job;
 }
 // Desenha o teatro estilizado de um jogo já gerado em um canvas qualquer (prévia da Nova operação).
 function render(canvas,game,map){const c=canvas.getContext('2d');c.imageSmoothingQuality='high';c.drawImage(overlay(game,paint(game,map)),0,0,canvas.width,canvas.height);}
 return{paint:paint_,start,stop,thumb,render};
})();
