'use strict';
// Engine outlets in the current aircraft sprites, after their existing 0.86 scale.
const BATTLEFIELD_ENGINES={fighterBlue:[[0,27]],fighterRed:[[-3,25],[3,25]],multiroleBlue:[[-4,25],[4,25]],multiroleRed:[[-4,21],[4,21]],bomberBlue:[[-7,15],[7,15]],bomberRed:[[-8,13],[-5,13],[5,13],[8,13]],stealthFighterRed:[[-4,20],[4,20]],stealthFighterBlue:[[-4,21],[4,21]]};
// Pivôs das antenas giratórias (fração da estrutura e comprimento relativo à largura), lidos da arte de 512 px.
const STRUCTURE_ANTENNAS={hq:[.209,.047,.075],post:[.777,.174,.075]},WRECK_SECONDS=30;
class BattlefieldFX{
 constructor(renderer){
  this.renderer=renderer;this.particles=[];this.trails=new Map();this.marks=[];this.positions=new Map();this.shots=new Map();this.cache={};this.wrecks=[];this.structureState=new Map();this.art={};
  for(const [name,colors]of Object.entries({glow:['#fff8daff','#ffc36ca6','#df6b2700'],smoke:['#869088a0','#98a09760','#86908800'],dust:['#b7a180c0','#c5b19260','#c5b19200'],splash:['#dceff0dd','#a3cbd17d','#a3cbd100'],spark:['#fff6ccff','#f4b461a0','#e4772700']})){
   const s=this.cache[name]=document.createElement('canvas');s.width=s.height=64;const c=s.getContext('2d'),g=c.createRadialGradient(32,32,1,32,32,32);g.addColorStop(0,colors[0]);g.addColorStop(.45,colors[1]);g.addColorStop(1,colors[2]);c.fillStyle=g;c.fillRect(0,0,64,64);
  }
  const debris=this.cache.debris=document.createElement('canvas');debris.width=debris.height=12;const d=debris.getContext('2d');d.fillStyle='#5d5948';d.fillRect(2,3,7,5);d.fillStyle='#b9a784';d.fillRect(2,3,6,1);
  const ring=this.cache.ring=document.createElement('canvas');ring.width=ring.height=64;const r=ring.getContext('2d');r.strokeStyle='#d9eff0aa';r.lineWidth=2;r.beginPath();r.arc(32,32,28,0,Math.PI*2);r.stroke();r.strokeStyle='#8ab8c466';r.lineWidth=3;r.beginPath();r.arc(32,32,25,0,Math.PI*2);r.stroke();
  const flame=this.cache.flame=document.createElement('canvas');flame.width=32;flame.height=96;const c=flame.getContext('2d'),g=c.createLinearGradient(0,0,0,96);g.addColorStop(0,'#effcffff');g.addColorStop(.15,'#7ed1ffff');g.addColorStop(.42,'#689feece');g.addColorStop(.7,'#faad6660');g.addColorStop(1,'#faad6600');c.fillStyle=g;c.beginPath();c.moveTo(12,0);c.lineTo(20,0);c.lineTo(25,17);c.lineTo(17,74);c.lineTo(16,96);c.lineTo(15,74);c.lineTo(7,17);c.fill();
  for(const kind of ['tread','tyre','foot','scorch','pressure'])this.groundArt(kind);
  this.reset();
 }
 reset(){this.particles.length=0;this.trails.clear();this.marks.length=0;this.positions.clear();this.shots.clear();this.wrecks.length=0;this.structureState.clear();this.time=0;this.sequence=0;this.tier=0;this.slow=0;this.stable=0;this.graphics=settings.graphics;this.motion=!!reducedMotion;this.currentProfile=null;}
 profile(){
  const graphics=Object.hasOwn(GRAPHICS,settings.graphics)?settings.graphics:'balanced',key=graphics+':'+this.tier;
  if(this.currentProfile?.key===key)return this.currentProfile;
  const i=graphics==='performance'?0:graphics==='cinematic'?2:1,base=GRAPHICS[graphics],factor=[1,.7,.45][this.tier];
  return this.currentProfile={key,graphics,tier:this.tier,factor,particles:Math.floor([80,200,400][i]*factor),clouds:Math.ceil([0,6,12][i]*factor),interval:base.interval||[.22,.14,.09][i],alpha:base.alpha||0,trailPoints:Math.floor([0,10,18][i]*factor),trailLife:[0,.45,.75][i],marks:Math.floor([0,96,512][i]*factor),markLife:[0,12,35][i]};
 }
 hash(n){let h=Math.imul((game.seed>>>0)^n,0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return(h^(h>>>16))>>>0;}
 screen(x,y,pad=80){return x>=cam.x-pad&&y>=cam.y-pad&&x<=cam.x+this.renderer.canvas.clientWidth/cam.zoom+pad&&y<=cam.y+this.renderer.canvas.clientHeight/cam.zoom+pad;}
 visible(p){return !!p.publicMissile||game.effectVisible(p.x/CELL-.5,(p.y+(p.lift||0))/CELL-.5,!!p.air,p.contactId,p.sourceId);}
 unitVisible(u){return u?.hp>0&&(u.owner===localPlayerSide()||game.isVisible(localPlayerSide(),u));}
 powered(u){return PLANE(u)&&(u.flightState==='takeoffRoll'||AIR(u));}
 trim(){const p=this.profile();while(this.particles.length>p.particles)this.particles.splice(Math.max(0,this.particles.findIndex(q=>!q.signal)),1);if(this.marks.length>p.marks)this.marks.splice(0,this.marks.length-p.marks);for(const points of this.trails.values())if(points.length>p.trailPoints)points.splice(0,points.length-p.trailPoints);}
 push(p){if(this.particles.length>=this.profile().particles){if(!p.signal)return;this.particles.splice(Math.max(0,this.particles.findIndex(q=>!q.signal)),1);}this.particles.push({t:0,lift:0,...p});}
 advance(dt){
  if(this.graphics!==settings.graphics){this.reset();}
  const profile=this.profile();
  if(reducedMotion){let n=0;for(const p of this.particles)if(!p.continuous){p.vx=p.vy=p.gravity=0;this.particles[n++]=p;}this.particles.length=n;this.trails.clear();this.positions.clear();this.shots.clear();}this.motion=!!reducedMotion;
  for(const [id,points]of this.trails){const u=game.get(id);if(!profile.trailPoints||!this.unitVisible(u)||!AIR(u)){this.trails.delete(id);continue;}let n=0;for(const p of points)if(this.visible(p))points[n++]=p;points.length=n;if(!n)this.trails.delete(id);}
  this.trim();if(!Number.isFinite(dt)||dt<=0||game.mode==='turns'&&!game.busy)return;
  this.time+=dt;
  let n=0;for(const p of this.particles){p.t+=dt;if(p.t>=p.life||p.continuous&&p.air&&!this.unitVisible(game.get(p.contactId)))continue;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.gravity||0)*dt;if(!this.visible(p))continue;this.particles[n++]=p;}this.particles.length=n;
  n=0;for(const m of this.marks)if(this.time-m.time<m.life)this.marks[n++]=m;this.marks.length=n;
  n=0;for(const w of this.wrecks)if(this.time-w.time<WRECK_SECONDS)this.wrecks[n++]=w;this.wrecks.length=n;
  for(const [id,s]of this.shots)if(this.time-s.time>=.24)this.shots.delete(id);
  for(const [id,points]of this.trails){let n=0;for(const p of points)if(this.time-p.time<=profile.trailLife)points[n++]=p;points.length=n;if(!n)this.trails.delete(id);}
  if(reducedMotion)return;
  for(const u of game.units){
   const t=TYPES[u.type],plane=PLANE(u),vehicle=!!t.vehicle;
   if(t.structure||!plane&&(AIR(u)||!vehicle&&profile.graphics==='performance')||!this.unitVisible(u))continue;const pose=flightPose(u),x=(pose.x+.5)*CELL,y=(pose.y+.5)*CELL,lift=18*pose.level,air=AIR(u),at={x,y,lift,air,contactId:air?u.id:undefined};if(!this.screen(x,y)||!this.visible(at))continue;
   let state=this.positions.get(u.id);if(!state){state={x:pose.x,y:pose.y,trail:-1,dust:-1,damage:-1,markX:x,markY:y,step:0};this.positions.set(u.id,state);}const moved=Math.hypot(pose.x-state.x,pose.y-state.y)>.001;state.x=pose.x;state.y=pose.y;state.seen=this.time;
   const facing=u.facing||0,sin=Math.sin(facing),cos=Math.cos(facing);
   if(PLANE(u)){
    if(!this.powered(u))continue;
    const engineScale=u.type.startsWith('bomber')?planeDrawSize(u.type)/84:1,outlets=BATTLEFIELD_ENGINES[u.type]||[[0,25]],rear=outlets[0][1]*pose.scale*engineScale,tail={x:x-sin*rear,y:y+cos*rear,lift,air,contactId:u.id};
    if(profile.trailPoints&&air&&moved&&this.time-state.trail>=profile.trailLife/profile.trailPoints){let points=this.trails.get(u.id);if(!points)this.trails.set(u.id,points=[]);points.push({...tail,time:this.time});if(points.length>profile.trailPoints)points.shift();state.trail=this.time;}
    if(profile.graphics!=='performance'&&moved&&this.time-state.dust>=profile.interval){state.dust=this.time;for(const [ox,oy]of outlets){const px=(ox*cos-oy*sin)*pose.scale*engineScale,py=(ox*sin+oy*cos)*pose.scale*engineScale;this.push({kind:'smoke',x:x+px,y:y+py,lift,air,contactId:u.id,continuous:true,vx:-sin*6+2,vy:cos*6-3,life:u.type.startsWith('bomber')?.8:.55,size:u.type.startsWith('bomber')?4:2.8,growth:1.5,alpha:.14});}}
    continue;
   }
   const terrain=game.terrainAt(u),dry=['plain','hill','field','road'].includes(terrain),dusty=dry&&(vehicle||terrain==='road'||game.map==='desert'),interval=vehicle?profile.interval:Math.max(.3,profile.interval*2),rear=vehicle?17:11;
   if(moved&&dusty&&this.time-state.dust>=interval){state.dust=this.time;const h=this.hash(u.id+Math.floor(this.time/interval)*257);this.push({kind:'dust',x:x-sin*rear,y:y+cos*rear,contactId:u.id,continuous:true,vx:-sin*(vehicle?9:4)+(h%9)-4,vy:cos*(vehicle?9:4)-4,life:vehicle?(profile.graphics==='performance'?.35:.85):1.1,size:vehicle?(profile.graphics==='performance'?5:9+(h%4)):3,alpha:vehicle?(game.map==='desert'?.24:.15):.07});}
   if(profile.marks&&(vehicle||profile.graphics==='cinematic')&&moved&&terrain!=='river'&&terrain!=='bridge'){
    const dx=x-state.markX,dy=y-state.markY,distance=Math.hypot(dx,dy),spacing=vehicle?7:15,kind=t.tank?'tread':vehicle?'tyre':'foot',angle=Math.atan2(dx,-dy);
    // ponytail: amostra apenas o trecho visto; saltos de rede/teleporte não desenham uma trilha atravessando o mapa.
    if(distance>2*CELL){state.markX=x;state.markY=y;}
    else for(let n=0;n<8&&Math.hypot(x-state.markX,y-state.markY)>=spacing;n++){
     state.markX+=dx/distance*spacing;state.markY+=dy/distance*spacing;const side=kind==='foot'?(++state.step%2?1:-1):0;
     this.addMark({kind,x:state.markX+Math.cos(angle)*side*4,y:state.markY+Math.sin(angle)*side*4,facing:angle,side,road:terrain==='road',scale:kind==='tyre'?.9:1});
    }
   }else if(!moved||terrain==='river'||terrain==='bridge'){state.markX=x;state.markY=y;}
   if(vehicle&&profile.graphics!=='performance'&&u.hp/u.maxHp<.45&&this.time-state.damage>=profile.interval*4){state.damage=this.time;this.push({kind:'smoke',x:x-sin*12,y:y+cos*12-4,air:false,continuous:true,vx:3,vy:-9,life:1.6,size:5,growth:2.4,alpha:.3});}
  }
  for(const [id,state]of this.positions)if(state.seen!==this.time)this.positions.delete(id);
  this.emitStructureSmoke(profile);
 }
 recoil(u){const s=this.shots.get(u.id),age=s?this.time-s.time:.24;if(reducedMotion||!s||age>=.24)return{x:0,y:0};const amount=s.amount*(1-age/.24)**2;return{x:-Math.sin(s.facing)*amount,y:Math.cos(s.facing)*amount};}
 consume(e){
  if(!e?.visible||!['shot','blast'].includes(e.kind))return;if(e.kind==='blast'&&e.wreck)this.addWreck(e.wreck);const profile=this.profile(),intensity=profile.graphics==='performance'?0:profile.graphics==='cinematic'?2:1,level=Number(e.flightLevel)||0,lift=18*level,x=(e.x+.5)*CELL,y=(e.y+.5)*CELL-lift,at={x,y,lift,air:!!e.air,contactId:e.contactId,sourceId:e.sourceId,publicMissile:e.publicMissile===true};if(!Number.isFinite(x)||!Number.isFinite(y)||!this.screen(x,y)||!this.visible(at))return;
  const count=this.sequence++,type=e.sourceType||game.get(e.id)?.type||e.weapon,water=level<.05&&game.terrainAt({x:e.x,y:e.y})==='river';
  if(reducedMotion){const shot=e.kind==='shot',facing=Number.isFinite(e.facing)?e.facing:game.get(e.id)?.facing||0,distance=shot?24:0;this.push({...at,kind:water&&!shot?'splash':'smoke',signal:true,x:x+Math.sin(facing)*distance,y:y-Math.cos(facing)*distance,vx:0,vy:0,size:shot?6:10,life:shot?.25:.45,alpha:.5});return;}
  const radial=(kind,n,speed,size,life,alpha=.6)=>{for(let i=0;i<n;i++){const h=this.hash(count*271+i*17),angle=(h%6283)/1000,v=speed*(.55+((h>>>12)%100)/100);this.push({...at,kind,x,y,vx:Math.cos(angle)*v,vy:Math.sin(angle)*v*(kind==='dust'?.55:1),gravity:kind==='splash'?80:kind==='debris'?55:kind==='spark'?16:0,life:life*(.75+((h>>>20)%60)/100),size:size*(.7+((h>>>8)%70)/100),growth:kind==='smoke'?2.4:kind==='dust'?2:0,aspect:kind==='dust'?.6:1,alpha});}};
  if(e.kind==='shot'){
   const heliGun=!!TYPES[type]?.gun&&e.weapon==='machinegun',minigun=heliGun&&type==='helicopter';if(TYPES[type]?.plane||e.air&&!heliGun)return;const heavy=TYPES[type]?.tank||type==='artillery',rocket=type==='rocketArtillery',facing=Number.isFinite(e.facing)?e.facing:game.get(e.id)?.facing||0,sin=Math.sin(facing),cos=Math.cos(facing),distance=heliGun?19:heavy?(type==='artillery'?31:27):rocket?14:22,mx=x+sin*distance,my=y-cos*distance;
   this.push({...at,kind:'glow',signal:true,x:mx,y:my,vx:0,vy:0,size:heliGun?(minigun?5:11):heavy?16:9,aspect:heavy?1.35:1.15,rotation:facing,life:heliGun?(minigun?.05:.1):heavy?.11:.08,alpha:.88});
   if(!heavy&&!rocket)return;if(e.id!==undefined)this.shots.set(e.id,{time:this.time,facing,amount:intensity===2?(type==='heavyTank'?5.5:heavy?4:2.8):type==='artillery'?4:2.8});
   for(let i=0;i<1+intensity*2;i++){const h=this.hash(count*61+i),v=18+h%16,side=(h%11)-5;this.push({...at,kind:'smoke',x:mx,y:my,vx:sin*v+cos*side+2,vy:-cos*v+sin*side-3,life:.8+intensity*.18,size:5+i,growth:2.5,alpha:.28});}
   if(!water)radial('dust',2+intensity*4,25,7,.65,.2);
   if(intensity===2&&TYPES[type]?.tank&&!water){
    const hard=['road','bridge'].includes(game.terrainAt(e)),alpha=hard?.24:game.map==='desert'?.8:.55;
    this.push({...at,kind:'pressure',vx:0,vy:0,size:22,growth:2.4,aspect:.72,life:.42,alpha:hard?.35:.7});
    for(let i=0;i<12;i++){const angle=i*Math.PI/6+(this.hash(count*97+i)%100)/500,v=40+this.hash(count*43+i)%24,px=x+Math.cos(angle)*27,py=y+Math.sin(angle)*20;this.push({...at,kind:'dust',x:px,y:py,vx:Math.cos(angle)*v+3,vy:Math.sin(angle)*v*.72-3,size:11+i%3,growth:3.2,aspect:.72,life:1.35,alpha});if(!hard&&i%2===0)this.push({...at,kind:'debris',x:px,y:py,vx:Math.cos(angle)*v,vy:Math.sin(angle)*v*.6-14,gravity:60,size:1.8,rotation:angle,life:.55,alpha:.65});}
   }return;
  }
  if(e.weapon==='gun'){this.push({...at,kind:'glow',signal:true,vx:0,vy:0,size:6,life:.06,alpha:.5});radial(water?'splash':'spark',1+intensity,water?30:45,water?3:1.5,.2,.5);return;}
  if(intensity===2&&level<.05&&!water&&!e.dud&&!e.lostGuidance)this.addMark({kind:'scorch',x,y,facing:(this.hash(count)%628)/100,scale:e.heavy?1.25:.8,alpha:.6});
  const heavy=e.heavy?1.35:1,dud=e.dud||e.lostGuidance?.5:1;
  this.push({...at,kind:'glow',signal:true,vx:0,vy:0,size:(24+intensity*8)*heavy*dud,life:.17,alpha:.65});
  if(!water){radial('spark',2+intensity*3,90*heavy,2.4,.4,.8);radial('debris',2+intensity*3,55*heavy,4,.6,.7);}
  if(intensity)radial('smoke',2+intensity*2,10,13*heavy,1.15,.3);
  if(level<.05){radial(water?'splash':'dust',water?4+intensity*3:2+intensity*4,water?65:30,water?6:10,.75,water?.45:.22);if(water)for(let i=0;i<1+Number(intensity>0);i++)this.push({...at,kind:'ring',x,y,vx:0,vy:0,size:8+i*5,growth:3,aspect:.6,life:.7+i*.25,alpha:.5-i*.15});}
 }
 ground(c){
  this.drawWrecks(c);
  c.save();for(const m of this.marks){if(!this.screen(m.x,m.y)||!this.visible(m))continue;const art=this.art['ground:'+m.kind],age=(this.time-m.time)/m.life;c.save();c.translate(m.x,m.y);c.rotate(m.facing);c.globalAlpha=(m.alpha??(m.kind==='foot'?.38:m.road?.28:.4))*Math.min(1,(1-age)*3);const scale=m.scale||1;c.drawImage(art,-art.width/2*scale,-art.height/2*scale,art.width*scale,art.height*scale);c.restore();}c.restore();
 }
 addMark(m){const profile=this.profile();if(!profile.marks||!this.screen(m.x,m.y)||!this.visible(m))return;this.marks.push({air:false,time:this.time,life:profile.markLife,...m});if(this.marks.length>profile.marks)this.marks.shift();}
 groundArt(kind){return this.structureArt('ground:'+kind,()=>{
  const s=document.createElement('canvas');s.width=kind==='foot'?16:64;s.height=kind==='foot'?24:64;const c=s.getContext('2d'),x=s.width/2,y=s.height/2;c.translate(x,y);c.fillStyle='#3c392b';
  if(kind==='tread'){for(const px of [-18,12]){c.fillRect(px,-12,6,24);c.fillStyle='#bca67c';for(let py=-11;py<12;py+=4)c.fillRect(px+.5,py,5,1);c.fillStyle='#3c392b';}}
  else if(kind==='tyre'){for(const px of [-14,11]){c.fillRect(px,-12,3,24);c.fillStyle='#ac9b77';for(let py=-10;py<12;py+=4)c.fillRect(px+1,py,1,2);c.fillStyle='#3c392b';}}
  else if(kind==='foot'){c.beginPath();c.ellipse(0,-3,3.3,6.5,0,0,Math.PI*2);c.fill();c.fillRect(-2.7,5,5.4,4);c.fillStyle='#a99470';for(let py=-6;py<2;py+=3)c.fillRect(-2,py,4,1);}
  else if(kind==='pressure'){for(let n=0;n<3;n++){c.strokeStyle=['#d0b18a55','#e1c59e88','#9d825c33'][n];c.lineWidth=5-n;c.beginPath();c.arc(0,0,24+n*2,0,Math.PI*2);c.stroke();}}
  else{const g=c.createRadialGradient(0,0,3,0,0,30);g.addColorStop(0,'#211d17d9');g.addColorStop(.45,'#403326a0');g.addColorStop(1,'#473a2800');c.fillStyle=g;c.fillRect(-32,-32,64,64);c.strokeStyle='#29251f88';c.lineWidth=1.3;for(let i=0;i<7;i++){const a=i*.9;c.beginPath();c.moveTo(Math.cos(a)*5,Math.sin(a)*5);c.lineTo(Math.cos(a)*16,Math.sin(a)*13);c.lineTo(Math.cos(a+.12)*23,Math.sin(a+.12)*21);c.stroke();}}
  return s;
 });}
 drawTrails(c){
  c.save();c.lineCap='round';
  for(const [id,points]of this.trails){if(!this.unitVisible(game.get(id)))continue;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(!this.screen(b.x,b.y)||!this.visible(a)||!this.visible(b))continue;const fade=Math.max(0,1-(this.time-a.time)/this.profile().trailLife);c.strokeStyle='#cbd9de';c.globalAlpha=.07*fade;c.lineWidth=3+2*fade;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.globalAlpha=.18*fade;c.lineWidth=.8+fade;c.stroke();}}
  c.restore();
 }
 exhaust(c,u){
  u=visualUnit(u);
  if(!this.powered(u)||!this.unitVisible(u))return;const pose=flightPose(u),x=(pose.x+.5)*CELL,y=(pose.y+.5)*CELL,at={x,y,lift:18*pose.level,air:AIR(u),contactId:u.id};if(!this.screen(x,y)||!this.visible(at))return;
  const bomber=u.type.startsWith('bomber'),strong=['takeoffRoll','climb'].includes(u.flightState),landing=['approach','landing'].includes(u.flightState),profile=this.profile(),pulse=reducedMotion?1:1+.045*Math.sin(this.time*18+u.id),length=(bomber?8:strong?38:landing?7:12)*(profile.graphics==='performance'?.72:1)*pulse,width=bomber?7:strong?7:4;
  c.save();c.translate(x,y+2);c.rotate(u.facing||0);const engineScale=bomber?planeDrawSize(u.type)/84:1;c.scale(pose.scale*engineScale,pose.scale*engineScale);
  for(const [ox,oy]of BATTLEFIELD_ENGINES[u.type]||[[0,25]]){c.globalAlpha=bomber?.17:strong?.88:landing?.24:.4;c.drawImage(bomber?this.cache.smoke:this.cache.flame,ox-width/2,oy,width,length);if(!bomber&&profile.graphics==='cinematic'){c.globalAlpha=strong?.22:.07;c.drawImage(this.cache.glow,ox-7,oy-3,14,14);}}
  c.restore();
 }
 draw(c){
  this.drawTrails(c);
  c.save();for(const p of this.particles){const age=p.t/p.life,fade=1-age,growth=p.growth??(p.kind==='smoke'||p.kind==='dust'?p.life*1.3:0),size=p.size*(reducedMotion?1:1+growth*age),height=size*(p.aspect||1);if(!this.screen(p.x,p.y,Math.max(size,height))||!this.visible(p))continue;c.globalAlpha=(p.alpha??.5)*fade;c.globalCompositeOperation=p.kind==='glow'||p.kind==='spark'?'lighter':'source-over';const art=this.cache[p.kind]||this.art['ground:'+p.kind]||this.cache.dust;if(p.rotation!==undefined){c.save();c.translate(p.x,p.y);c.rotate(p.rotation);c.drawImage(art,-size,-height,size*2,height*2);c.restore();}else c.drawImage(art,p.x-size,p.y-height,size*2,height*2);}c.restore();
 }
 // ---- Estruturas: bandeira, antena giratória, dano progressivo e destroços. Só visual: usa o relógio dos efeitos, nunca o RNG do jogo.
 damageStage(s){const r=s.hp/s.maxHp;return r<.25?3:r<.5?2:r<.75?1:0;}
 // Sprites procedurais ficam fora de this.cache (sete imagens fixas) e só são criados quando a estrutura é desenhada.
 structureArt(key,make){return this.art[key]||(this.art[key]=make());}
 // Pano em seis faixas presas ao mastro; o vento sopra na mesma direção da deriva das nuvens. Parado: pose fixa por estrutura.
 flag(c,x,y,color,id,still){
  const phase=(this.hash(id)%628)/100,t=still?0:this.time*5,amp=still?.8:2.6;
  c.save();c.fillStyle='#152720';c.fillRect(x-1.5,y-3,2,18);c.beginPath();
  for(let i=0;i<=6;i++){const px=x+.5+i*5,py=y+Math.sin(t+phase+i*.9)*amp*i/6;if(i)c.lineTo(px,py);else c.moveTo(px,py);}
  for(let i=6;i>=0;i--)c.lineTo(x+.5+i*5,y+9+Math.sin(t+phase+i*.9)*amp*i/6);
  c.closePath();c.fillStyle=color;c.fill();c.lineWidth=1.2;c.strokeStyle='#152720';c.stroke();c.restore();
 }
 antenna(c,s,still){
  const a=STRUCTURE_ANTENNAS[s.type];if(!a)return;
  const w=s.width*CELL,h=s.height*CELL,len=w*a[2],angle=(this.hash(s.id)%628)/100+(still?0:this.time*2.2);
  const paddle=this.structureArt('paddle',()=>{const k=document.createElement('canvas');k.width=28;k.height=8;const q=k.getContext('2d');q.fillStyle='#2b3330';q.fillRect(0,2,28,4);q.fillStyle='#dfe6e2';q.fillRect(1,2,26,2.5);q.fillStyle='#8c9791';q.fillRect(1,4.5,26,1.5);q.fillStyle='#d94b3c';q.fillRect(0,2,3,4);return k;});
  c.save();c.translate(s.x*CELL+w*a[0],s.y*CELL+h*a[1]);c.scale(1,.55);c.rotate(angle);c.drawImage(paddle,-len/2,-len*.14,len,len*.28);c.restore();
 }
 // Queimaduras e rachaduras em cache por (tipo, estágio), recortadas pela arte; o espelhamento por estrutura varia o aspecto sem novos canvases.
 drawDamage(c,s,still,image){
  const stage=this.damageStage(s);if(!stage||s.type==='airportSite'||!image?.complete||!image.naturalWidth)return;
  const w=s.width*CELL,h=s.height*CELL,overlay=this.structureArt('damage:'+s.type+':'+stage,()=>{
   const k=document.createElement('canvas');k.width=w;k.height=h;const q=k.getContext('2d');let seed=(s.type.length*977+stage*131+w)>>>0;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   for(let i=0;i<stage*3+1;i++){const x=rnd()*w,y=rnd()*h,r=(.06+.07*rnd())*Math.min(w,h)*(1+stage*.15),g=q.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(12,10,8,.62)');g.addColorStop(.6,'rgba(24,18,12,.3)');g.addColorStop(1,'rgba(24,18,12,0)');q.fillStyle=g;q.fillRect(x-r,y-r,r*2,r*2);}
   q.strokeStyle='rgba(18,16,13,.7)';q.lineWidth=1.2;for(let i=0;i<stage*2+1;i++){q.beginPath();let x=rnd()*w,y=rnd()*h;q.moveTo(x,y);for(let j=0;j<4;j++){x+=(rnd()-.5)*w*.18;y+=(rnd()-.35)*h*.18;q.lineTo(x,y);}q.stroke();}
   q.globalCompositeOperation='destination-in';q.drawImage(image,0,0,w,h);return k;});
  const px=s.x*CELL,py=s.y*CELL,mirror=this.hash(s.id)&1;
  c.save();if(mirror){c.translate(px+w,py);c.scale(-1,1);}else c.translate(px,py);c.drawImage(overlay,0,0);c.restore();
  if(stage===3&&!still){const flicker=.26+.12*Math.sin(this.time*9+s.id);c.save();c.globalCompositeOperation='lighter';c.globalAlpha=flicker;for(const [fx,fy]of [[.3,.35],[.68,.6]])c.drawImage(this.cache.glow,px+w*fx-14,py+h*fy-14,28,28);c.restore();}
 }
 // Destroços temporários: registrados pelo evento de destruição (só metadados do motor) e desenhados sob névoa e unidades.
 addWreck(w){
  if(!w||!Number.isFinite(w.x)||!Number.isFinite(w.y))return;
  this.wrecks.push({type:w.type,x:w.x,y:w.y,width:w.width||1,height:w.height||1,time:this.time,variant:this.hash(w.x*131+w.y)%2});
  if(this.wrecks.length>16)this.wrecks.shift();
 }
 rubble(w){
  return this.structureArt('wreck:'+w.width+'x'+w.height+':'+w.variant,()=>{
   const pw=w.width*CELL,ph=w.height*CELL,k=document.createElement('canvas');k.width=pw;k.height=ph;const q=k.getContext('2d');let seed=(pw*31+ph*17+w.variant*101)>>>0;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   const g=q.createRadialGradient(pw/2,ph/2,0,pw/2,ph/2,Math.max(pw,ph)*.55);g.addColorStop(0,'rgba(18,14,10,.7)');g.addColorStop(.7,'rgba(26,20,14,.4)');g.addColorStop(1,'rgba(26,20,14,0)');q.fillStyle=g;q.fillRect(0,0,pw,ph);
   const colors=['#5d5948','#8f8a76','#3a3a36','#b9a784','#6b5d49'];
   for(let i=0;i<Math.round(w.width*w.height*4+8);i++){const x=pw*.1+rnd()*pw*.8,y=ph*.1+rnd()*ph*.8,sw=5+rnd()*13,sh=3+rnd()*8;q.save();q.translate(x,y);q.rotate(rnd()*Math.PI);q.fillStyle=colors[Math.floor(rnd()*colors.length)];q.fillRect(-sw/2,-sh/2,sw,sh);q.fillStyle='rgba(255,240,210,.18)';q.fillRect(-sw/2,-sh/2,sw,1);q.restore();}
   q.strokeStyle='rgba(20,18,15,.8)';q.lineWidth=2;for(let i=0;i<5;i++){q.beginPath();const x=rnd()*pw,y=rnd()*ph;q.moveTo(x,y);q.lineTo(x+(rnd()-.5)*40,y+(rnd()-.5)*28);q.stroke();}
   return k;});
 }
 drawWrecks(c){
  for(const w of this.wrecks){
   const pw=w.width*CELL,ph=w.height*CELL,px=w.x*CELL,py=w.y*CELL;if(!this.screen(px+pw/2,py+ph/2,Math.max(pw,ph)))continue;
   const age=this.time-w.time,fade=age>WRECK_SECONDS-6?Math.max(0,(WRECK_SECONDS-age)/6):1;c.save();c.globalAlpha=.92*fade;c.drawImage(this.rubble(w),px,py);c.restore();
  }
 }
 // Fumaça de estruturas muito danificadas e de destroços recentes, pelo mesmo pool limitado das demais partículas.
 emitStructureSmoke(profile){
  if(profile.graphics==='performance')return;
  const burn=(id,x,y,w,h,every)=>{
   let st=this.structureState.get(id);if(!st)this.structureState.set(id,st={smoke:-1});
   if(this.time-st.smoke<every)return;st.smoke=this.time;
   const hs=this.hash(Math.abs(id)*17+Math.floor(this.time/every));
   this.push({kind:'smoke',x:x+(.2+(hs%60)/100)*w,y:y+(.2+((hs>>>8)%50)/100)*h,vx:2+hs%5,vy:-9,life:1.5,size:6,growth:2,alpha:.2,continuous:true,air:false});
  };
  const live=new Set();
  for(const s of game.structures){
   if(!(s.hp>0)||s.type==='airportSite'||this.damageStage(s)<2||s.owner!==localPlayerSide()&&!game.isVisible(localPlayerSide(),s))continue;
   const w=s.width*CELL,h=s.height*CELL;if(!this.screen(s.x*CELL+w/2,s.y*CELL+h/2,Math.max(w,h)))continue;
   live.add(s.id);burn(s.id,s.x*CELL,s.y*CELL,w,h,profile.interval*3);
  }
  for(const w of this.wrecks){
   if(this.time-w.time>=4)continue;const pw=w.width*CELL,ph=w.height*CELL;if(!this.screen(w.x*CELL+pw/2,w.y*CELL+ph/2,Math.max(pw,ph)))continue;
   const id=-(w.x*200+w.y+1);live.add(id);burn(id,w.x*CELL,w.y*CELL,pw,ph,profile.interval*2);
  }
  for(const id of [...this.structureState.keys()])if(!live.has(id))this.structureState.delete(id);
 }
 observe(renderMs,frameSeconds){
  if(!Number.isFinite(renderMs)||renderMs<0||!Number.isFinite(frameSeconds)||frameSeconds<=0||frameSeconds>1)return;
  const seconds=frameSeconds,slow=renderMs>10&&frameSeconds>.025,stable=renderMs<6&&frameSeconds<.018;
  if(slow){this.slow+=seconds;this.stable=0;if(this.slow+1e-8>=2){if(this.tier<2){this.tier++;this.trim();}this.slow=0;}}
  else{this.slow=0;this.stable=stable?this.stable+seconds:0;if(this.stable+1e-8>=8){if(this.tier>0)this.tier--;this.stable=0;}}
 }
}
