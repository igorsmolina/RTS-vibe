'use strict';
function polygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
// Arte fornecida pelo jogador, preparada com transparência e incorporada para uso offline.
const troopAtlas=new Image(),troopFrames={
 commander:[0,80,274,402,273],infantry:[1,74,289,400,279],engineer:[2,77,272,400,270],recon:[3,66,295,387,295],
 tank:[4,33,323,356,324],artillery:[5,62,298,383,295],antitank:[6,74,285,394,282],machinegun:[7,77,287,400,287]
};
const tankAtlas=new Image(),tankFrames={lightTank:0,tank:1,heavyTank:2},tankSizes={lightTank:48,tank:54,heavyTank:60};
// Helicópteros: atlas 3 × 2 (padrão, ar-terra, ar-ar; aliados, inimigos), quadros de 128 px apontados para o norte, rotor estático.
const heliAtlas=new Image(),heliFrames={helicopter:0,helicopterGround:1,helicopterAir:2};
const antiAirAtlas=new Image(),highCloud=new Image(),antiAirFrames={antiAirVehicle:0,missileInfantry:1};
const ambientClouds=Array.from({length:3},()=>new Image()),cloudShadows=[];
const GRAPHICS={performance:{clouds:0,particles:0,interval:1,alpha:0},balanced:{clouds:12,particles:80,interval:.18,alpha:.13},cinematic:{clouds:24,particles:160,interval:.1,alpha:.2}};
function flightPose(u){const level=AIR(u)?flightLevel(u):0;return{x:u.x,y:u.y-18*level/CELL,scale:1+.12*level,level};}
function radarView(){
 if(!started)return null;const active=game.units.filter(u=>u.owner==='blue'&&u.type==='antiAirVehicle'&&u.hp>0&&u.radarOn).sort((a,b)=>a.id-b.id);if(!active.length)return null;
 const selected=selectedUnits().filter(u=>u.type==='antiAirVehicle'&&u.hp>0).sort((a,b)=>a.id-b.id);
 return{source:selected[0]||active[0],contacts:game.units.filter(u=>u.owner==='red'&&u.hp>0&&AIR(u)&&game.isVisible('blue',u))};
}
function unitIcon(ctx,type,x,y,color,scale=1,facing=0,stride=0,firing=false){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineWidth=1.6;ctx.lineCap='round';ctx.lineJoin='round';
 const dark='#10282e',steel='#a7b6ac',gold='#efd094';
 const box=(x,y,w,h,fill,stroke)=>{ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);if(stroke){ctx.strokeStyle=stroke;ctx.strokeRect(x,y,w,h);}};
 const oval=(x,y,rx,ry,fill,stroke)=>{ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}};
 const line=(points,color,width=2)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.stroke();ctx.lineWidth=1.6;};
 if(!TYPES[type].air)oval(2,7,TYPES[type].vehicle?22:17,TYPES[type].vehicle?19:13,'#081b2270');
 if(type==='hq'||type==='post'){
  box(-20,-4,40,23,'#354744');box(-17,-7,34,22,color,dark);box(-5,3,10,12,'#223e45');box(-13,-1,5,5,steel);box(8,-1,5,5,steel);
  polygon(ctx,[[-23,-7],[0,-20],[23,-7]],'#c6c6a7',dark);line([[0,-14],[0,-32]],'#f0e9ca');polygon(ctx,[[1,-32],[15,-27],[1,-22]],color);
  if(type==='post'){box(-20,8,12,9,dark);box(8,8,12,9,dark);}ctx.restore();return;
 }
 ctx.rotate(facing);
 if(type in antiAirFrames){
  const size=type==='antiAirVehicle'?54:47;
  if(antiAirAtlas.complete&&antiAirAtlas.naturalWidth){const cell=antiAirAtlas.naturalWidth/2;ctx.translate(0,stride*.6+(firing?1:0));ctx.drawImage(antiAirAtlas,antiAirFrames[type]*cell,color===TEAM.red?cell:0,cell,cell,-size/2,-size/2,size,size);}
  else if(type==='antiAirVehicle'){
   for(const xx of [-18,12])for(const yy of [-16,10])box(xx,yy,6,11,dark);
   box(-12,-15,24,37,color,dark);box(-9,10,18,8,'#243d43',steel);
   for(const xx of [-9,5]){box(xx-2,-24,8,25,'#43534e',dark);polygon(ctx,[[xx,-25],[xx+2,-30],[xx+4,-25],[xx+4,-4],[xx,-4]],steel,dark);}
  }else{
   box(-9,9,7,13,dark);box(3,9,7,13,dark);oval(0,0,12,15,color,dark);oval(-2,-13,8,7,color,dark);box(8,-24,7,31,steel,dark);polygon(ctx,[[8,-24],[11.5,-31],[15,-24]],gold,dark);
  }
  if(firing)polygon(ctx,[[-3,-size/2],[-7,-size/2+6],[0,-size/2-8],[7,-size/2+6],[3,-size/2]],'#f8cc76');ctx.restore();return;
 }
 if(TYPES[type].air){
  const size=62;
  if(heliAtlas.complete&&heliAtlas.naturalWidth){const cell=heliAtlas.naturalWidth/3;ctx.drawImage(heliAtlas,heliFrames[type]*cell,color===TEAM.red?cell:0,cell,cell,-size/2,-size/2,size,size);}
  else{
   // Alternativa sem atlas: fuselagem na cor da equipe; ar-terra com casulos de foguetes, ar-ar com mísseis longos.
   if(type==='helicopterGround')for(const s of [-1,1]){box(s<0?-19:12,-7,7,12,'#4f5444',dark);for(let i=0;i<3;i++)oval(s<0?-15.5:15.5,-5+i*4,1.6,1.6,'#d8c48a');}
   if(type==='helicopterAir')for(const s of [-1,1])for(const o of [0,5]){const x0=s*(14+o)-1;box(x0,-16,2.5,22,'#e4e6d8',dark);polygon(ctx,[[x0-2,6],[x0+1.2,1],[x0+4.5,6]],'#e4e6d8');}
   if(type!=='helicopter')box(-14,-2,28,3,dark);
   box(-2,5,4,22,color,dark);box(-8,24,16,4,color,dark);oval(0,-2,9,16,color,dark);oval(0,-10,5,6,'#24444b',dark);
   line([[-27,-25],[27,21]],'#1c2c2f',3);line([[27,-25],[-27,21]],'#1c2c2f',3);oval(0,-2,3,3,steel,dark);
  }
  if(firing)polygon(ctx,[[-2,-size/2+3],[-5,-size/2-2],[0,-size/2-9],[5,-size/2-2],[2,-size/2+3]],'#f8cc76');
  ctx.restore();return;
 }
 if(TYPES[type].tank&&tankAtlas.complete&&tankAtlas.naturalWidth){
  const size=tankSizes[type],cell=tankAtlas.naturalWidth/3;
  ctx.translate(0,stride*.6+(firing?1.5:0));ctx.drawImage(tankAtlas,tankFrames[type]*cell,color===TEAM.red?cell:0,cell,cell,-size/2,-size/2,size,size);
  if(firing)polygon(ctx,[[-2,-size/2+2],[-5,-size/2-3],[0,-size/2-10],[5,-size/2-3],[2,-size/2+2]],'#f8cc76');
  ctx.restore();return;
 }
 if(!TYPES[type].tank&&troopFrames[type]&&troopAtlas.complete&&troopAtlas.naturalWidth){
  const frame=troopFrames[type],enemy=color===TEAM.red,w=troopAtlas.naturalWidth/8,sy=frame[enemy?3:1],h=frame[enemy?4:2],fit=60/Math.max(w,h),dw=w*fit,dh=h*fit;
  ctx.translate(0,stride*.6+(firing?1.5:0));ctx.drawImage(troopAtlas,frame[0]*w,sy,w,h,-dw/2,-dh/2,dw,dh);
  if(firing){const mx=['infantry','commander','antitank'].includes(type)?10:0,my=-dh/2;polygon(ctx,[[mx-2,my+2],[mx-5,my-3],[mx,my-10],[mx+5,my-3],[mx+2,my+2]],'#f8cc76');}
  ctx.restore();return;
 }
 let muzzle={x:10,y:-25};
 if(TYPES[type].tank){
  const fit=tankSizes[type]/54;ctx.scale(fit,fit);
  // Chassi largo, duas lagartas e torre: leitura imediata mesmo em escala pequena.
  for(const side of [-1,1]){box(side<0?-21:13,-20,8,42,'#152d33',dark);for(let yy=-16;yy<21;yy+=7)box(side<0?-20:14,yy,6,3,'#65766e');}
  polygon(ctx,[[-13,-21],[13,-21],[16,-10],[15,21],[-15,21],[-16,-10]],color,dark);
  polygon(ctx,[[-11,-18],[10,-18],[12,-9],[-12,-9]],'#ffffff30');box(-10,12,20,6,'#345a5e');for(let xx=-8;xx<10;xx+=4)box(xx,12,2,6,dark);
  polygon(ctx,[[-10,-9],[8,-12],[13,-4],[10,9],[-9,11],[-13,3]],'#294b51',dark);
  polygon(ctx,[[-8,-10],[8,-10],[10,-1],[7,7],[-8,7],[-10,-2]],color,steel);
  box(-3,-29+(firing?2:0),6,23,steel,dark);box(-4,-30+(firing?2:0),8,5,'#354f53',dark);oval(-3,3,4,3,'#304c4e',dark);
  line([[8,10],[11,21]],steel,1.3);box(-13,-14,3,5,gold);box(10,-14,3,5,gold);muzzle={x:0,y:-33};
 }else if(type==='recon'){
  for(const xx of [-18,12])for(const yy of [-13,9])box(xx,yy,6,12,'#102830',dark);
  polygon(ctx,[[-10,-23],[10,-23],[14,-9],[12,22],[-12,22],[-14,-9]],color,dark);
  polygon(ctx,[[-9,-12],[9,-12],[10,-3],[-10,-3]],'#193943',steel);line([[-7,-11],[5,-11]],'#c6e1da',1.4);
  box(-9,8,18,11,'#32575b',dark);oval(0,10,5,5,'#143139',steel);line([[0,8],[0,-25]],steel,3);
  box(-9,-21,4,3,gold);box(5,-21,4,3,gold);line([[10,14],[21,26]],steel,1.3);oval(21,26,1.5,1.5,gold);muzzle={x:0,y:-28};
 }else if(type==='artillery'){
  // Rodas e apoios abertos distinguem a peça de artilharia do tanque.
  line([[-9,5],[-20,22]],steel,5);line([[9,5],[20,22]],steel,5);box(-24,20,10,4,dark);box(14,20,10,4,dark);
  box(-22,-6,8,23,'#142b31',dark);box(14,-6,8,23,'#142b31',dark);line([[-20,-3],[-20,13]],'#849086',2);line([[18,-3],[18,13]],'#849086',2);
  polygon(ctx,[[-16,-12],[16,-12],[13,8],[-13,8]],color,dark);line([[-13,-10],[13,-10]],'#e0e8ce',1.5);
  box(-5,-11,10,24,'#25474c',dark);oval(0,3,7,6,steel,dark);
  box(-4,-31+(firing?3:0),8,31,steel,dark);box(-6,-33+(firing?3:0),12,6,'#35565b',dark);box(-2,-26,3,20,'#edf0dd');
  box(-14,-7,5,9,'#ffffff35');muzzle={x:0,y:-36};
 }else{
  const gunner=type==='machinegun',engineer=type==='engineer',commander=type==='commander',rocket=type==='antitank';
  box(-9,8+stride,7,12,'#18363c',dark);box(3,8-stride,7,12,'#18363c',dark);box(-10,16+stride,8,5,dark);box(3,16-stride,8,5,dark);
  box(-11,1,22,13,engineer?'#9f8e5e':'#304c48',dark);line([[-7,4],[7,4]],'#b6c5a5',1);
  polygon(ctx,[[-12,-10],[-8,-15],[8,-15],[12,-10],[11,11],[-11,11]],color,dark);
  polygon(ctx,[[-6,-8],[6,-8],[8,7],[-8,7]],'#31524d',dark);box(-6,-6,4,6,'#b7c39b');box(2,-6,4,6,'#b7c39b');box(-7,3,14,3,'#162e33');
  line([[-11,-8],[-14,1],[-8,3]],color,6);line([[11,-8],[15,-1],[11,4]],color,6);
  oval(0,-14,8,7,commander?'#c8a760':color,dark);oval(-2,-16,4,2,'#ffffff3c');line([[-6,-18],[5,-18]],commander?'#f3d591':'#d8e2ca',1.4);
  box(-5,-12,10,3,'#172d33');box(-4,-12,7,1,'#a1c8c8');
  if(engineer){
   box(-18,2,10,11,gold,dark);line([[-15,2],[-15,-1],[-10,-1],[-10,2]],steel,1.7);
   line([[13,9],[13,-7]],steel,3);line([[10,-12],[9,-7],[13,-4],[17,-7],[16,-12]],steel,2.5);box(-3,6,6,3,gold);
  }else if(commander){
   polygon(ctx,[[-10,-18],[-3,-23],[8,-20],[9,-16],[-9,-16]],gold,dark);oval(4,-19,2,2,'#fff6d0');
   line([[-13,9],[-19,-13]],steel,1.5);oval(-19,-13,1.5,1.5,gold);box(-3,0,6,5,gold,dark);
   box(10,-14,4,20,dark);box(11,-17,2,8,steel);muzzle={x:12,y:-20};
  }else if(rocket){
   box(8,-19,9,29,'#314f49',dark);box(8,-16,9,3,gold);box(7,7,11,6,steel,dark);
   polygon(ctx,[[8,-19],[10,-26],[15,-26],[17,-19]],steel,dark);box(10,-26,5,3,'#efbc79');box(5,-8,6,4,dark);box(11,-6,3,9,'#b8c4a2');
   muzzle={x:12,y:-29};
  }else if(gunner){
   line([[-2,-14],[-9,-24]],steel,2);line([[3,-14],[10,-24]],steel,2);
   box(-4,-21+(firing?1:0),9,20,dark);box(-2,-28+(firing?1:0),5,15,steel,dark);box(-4,-31+(firing?1:0),9,5,dark);
   box(-15,-6,10,9,gold,dark);line([[-6,-4],[0,-2]],gold,4);for(let i=0;i<4;i++)box(-7+i*2,-6,1,4,'#6f654d');
   box(-3,-15,7,7,'#536b65');muzzle={x:0,y:-34};
  }else{
   box(9,-18+(firing?1:0),5,27,dark);box(10,-23+(firing?1:0),3,12,steel);box(7,-4,6,5,'#775d3c');box(12,-19,4,3,dark);muzzle={x:11,y:-26};
  }
 }
 if(firing){const {x:mx,y:my}=muzzle;polygon(ctx,[[mx-2,my+2],[mx-6,my-4],[mx-2,my-4],[mx,my-12],[mx+2,my-4],[mx+6,my-4],[mx+2,my+2]],'#f8cc76');oval(mx,my-3,2.5,4,'#fff6d1');}
 ctx.restore();
}

// Cache de sprites por equipe, disparo e três poses de caminhada; rotação aplicada ao desenhar.
const sprites=new Map();
function sprite(type,color,scale,stride=0,firing=false){
 const key=type+color+scale+':'+stride+':'+firing;let s=sprites.get(key);
 if(!s){const ox=Math.ceil(38*scale),oy=Math.ceil(50*scale);s=document.createElement('canvas');s.width=ox*2;s.height=Math.ceil(82*scale);unitIcon(s.getContext('2d'),type,ox,oy,color,scale,0,stride,firing);s.ox=ox;s.oy=oy;sprites.set(key,s);}
 return s;
}
function glow(radius){const s=document.createElement('canvas'),c=s.getContext('2d');s.width=s.height=Math.ceil(radius+14)*2;c.fillStyle='#fff0b1';c.shadowColor='#ffe499';c.shadowBlur=8;c.beginPath();c.arc(s.width/2,s.height/2,radius,0,7);c.fill();return s;}

// Composição de terreno. Nenhuma função abaixo usa o RNG ou altera o motor.
const terrainImages={},terrainTiles=new Map(),roadOverlays=new Map(),terrainMasks=new Map(),materialTiles=new Map();
let fogTerrainCache=new WeakMap();
const terrainDirs=[[0,-1],[1,0],[0,1],[-1,0]],terrainNeighbors=[...terrainDirs,[1,-1],[1,1],[-1,1],[-1,-1]];
function terrainMinimapColor(type,map){return map==='desert'?({plain:'#c4b18a',forest:'#74764c',mountain:'#a89678',hill:'#b9a37c',field:'#9da45e',hedge:'#6f7146'}[type]||TERRAIN[type].color):({plain:'#83936f',forest:'#48604b',mountain:'#92958a',river:'#4e8390',bridge:'#ad9875',road:'#b8a27b',hill:'#9aa27a',field:'#a9a46b',hedge:'#4f6a45'}[type]||TERRAIN[type].color);}
/* Lotes de cultivo: cada campo contínuo recebe cor e direção das fileiras próprias (trigo, verde, terra arada…). */
const CROPS={temperate:['#cdb768','#7f9b4f','#8d7552','#a3b46b'],desert:['#94a35a','#b8aa66']};
let fieldPatches=new WeakMap();
// Sob a névoa (conceal), o lote considera só casas exploradas: a cor não revela campos vizinhos desconhecidos.
function fieldStyle(g,x,y,conceal=false){
 let root;
 if(conceal){root=KEY(x,y);const seen=new Set([root]),stack=[root];while(stack.length){const c=stack.pop(),cx=c%COLS,cy=(c-cx)/COLS;for(const [dx,dy]of terrainDirs){const nx=cx+dx,ny=cy+dy,n=KEY(nx,ny);if(INSIDE(nx,ny)&&!seen.has(n)&&g.terrain[n]==='field'&&g.explored.blue[n]){seen.add(n);stack.push(n);if(n<root)root=n;}}}}
 else{let ids=fieldPatches.get(g);
 if(!ids){ids=new Int32Array(SIZE).fill(-1);for(let k=0;k<SIZE;k++){if(g.terrain[k]!=='field'||ids[k]>=0)continue;const stack=[k];ids[k]=k;while(stack.length){const c=stack.pop(),cx=c%COLS,cy=(c-cx)/COLS;for(const [dx,dy]of terrainDirs){const nx=cx+dx,ny=cy+dy,n=KEY(nx,ny);if(INSIDE(nx,ny)&&ids[n]<0&&g.terrain[n]==='field'){ids[n]=k;stack.push(n);}}}}fieldPatches.set(g,ids);}
 root=ids[KEY(x,y)];}
 const h=terrainVisualHash(g.seed,root%COLS,(root-root%COLS)/COLS),palette=CROPS[g.map==='desert'?'desert':'temperate'];
 return{color:palette[h%palette.length],vertical:!!((h>>>4)&1)};
}
function terrainVisualHash(seed,x,y){let n=(seed^Math.imul(x+1,0x9e3779b1)^Math.imul(y+1,0x85ebca6b))>>>0;n=Math.imul(n^(n>>>16),0x7feb352d);return(n^(n>>>15))>>>0;}
function terrainTopology(g,x,y,concealNeighbors=false){
 const type=g.terrain[KEY(x,y)],water=t=>t==='river'||t==='bridge',road=t=>t==='road'||t==='bridge';let roadMask=0,waterMask=0,sameMask=0;
 terrainNeighbors.forEach(([dx,dy],d)=>{if(!INSIDE(x+dx,y+dy)){sameMask|=1<<d;return;}const t=g.terrain[KEY(x+dx,y+dy)];if(d<4){if(road(t))roadMask|=1<<d;if(water(t))waterMask|=1<<d;}if(water(type)?water(t):road(type)?road(t):t===type)sameMask|=1<<d;});
 if(concealNeighbors){roadMask=0;terrainDirs.forEach(([dx,dy],d)=>{const nx=x+dx,ny=y+dy;if(INSIDE(nx,ny)&&g.explored.blue[KEY(nx,ny)]&&['road','bridge'].includes(g.terrain[KEY(nx,ny)]))roadMask|=1<<d;});if(!roadMask)roadMask=10;else if((roadMask&(roadMask-1))===0)roadMask|=((roadMask<<2)|(roadMask>>2))&15;waterMask=15;sameMask=255;}
 const horizontal=Number(!!(roadMask&2))+Number(!!(roadMask&8)),vertical=Number(!!(roadMask&1))+Number(!!(roadMask&4));return{roadMask,waterMask,sameMask,vertical:vertical>horizontal};
}
function terrainImageReady(name){const i=terrainImages[name];return !!(i?.complete&&i.naturalWidth);}
function clearTerrainCaches(){terrainTiles.clear();roadOverlays.clear();terrainMasks.clear();materialTiles.clear();fogTerrainCache=new WeakMap();fieldPatches=new WeakMap();}
// Fileiras de cultivo alinhadas ao mundo (continuam de uma casa para a outra) e margem escura onde o lote termina.
function drawCrops(c,style,mask){c.fillStyle=style.color+'a6';c.fillRect(0,0,CELL,CELL);c.fillStyle='#2a24161f';for(let i=2;i<CELL;i+=7)style.vertical?c.fillRect(i,0,2,CELL):c.fillRect(0,i,CELL,2);
 c.fillStyle='#3b331f40';if(!(mask&1))c.fillRect(0,0,CELL,2);if(!(mask&2))c.fillRect(CELL-2,0,2,CELL);if(!(mask&4))c.fillRect(0,CELL-2,CELL,2);if(!(mask&8))c.fillRect(0,0,2,CELL);}
// Sebe: faixa de arbustos ligando as sebes vizinhas (mesmo traçado das estradas), com sombra.
function drawHedge(c,mask,fill){const path=roadPath(mask);c.lineCap=c.lineJoin='round';c.save();c.translate(2,3);c.lineWidth=22;c.strokeStyle='#14251a66';c.stroke(path);c.restore();c.lineWidth=20;c.strokeStyle=fill;c.stroke(path);c.lineWidth=20;c.strokeStyle='#1f3d2638';c.stroke(path);c.save();c.translate(-1.5,-2);c.lineWidth=7;c.strokeStyle='#b8d39a24';c.stroke(path);c.restore();}
// Colina: luz do noroeste e curva de nível no contorno, ambas pela máscara orgânica que funde colinas vizinhas.
function drawHill(c,mask,variant,desert){
 // Tom uniforme no alto; encosta clara nas bordas abertas ao noroeste e sombreada ao sudeste (sem degradê por casa, que formava uma colcha).
 const layer=document.createElement('canvas');layer.width=layer.height=CELL;const q=layer.getContext('2d');q.fillStyle=desert?'#f6e2b246':'#ece9b33f';q.fillRect(0,0,CELL,CELL);
 [[0,'light'],[1,'shade'],[2,'shade'],[3,'light']].forEach(([side,tone])=>{if(mask&(1<<side))return;const g=side===0?q.createLinearGradient(0,0,0,16):side===1?q.createLinearGradient(CELL,0,CELL-16,0):side===2?q.createLinearGradient(0,CELL,0,CELL-16):q.createLinearGradient(0,0,16,0);
  g.addColorStop(0,tone==='light'?(desert?'#fff8dc66':'#fbf6d25c'):(desert?'#5c41245c':'#26321d5c'));g.addColorStop(1,'#00000000');q.fillStyle=g;q.fillRect(0,0,CELL,CELL);});
 q.globalCompositeOperation='destination-in';q.drawImage(terrainMask(mask,'mountain',variant),0,0);c.drawImage(layer,0,0);
 const ring=document.createElement('canvas');ring.width=ring.height=CELL;const r=ring.getContext('2d');r.fillStyle=desert?'#6b532f80':'#39412a80';r.fillRect(0,0,CELL,CELL);
 r.globalCompositeOperation='destination-in';r.drawImage(terrainMask(mask,'forest',variant),0,0);r.globalCompositeOperation='destination-out';r.drawImage(terrainMask(mask,'mountain',variant),0,0);c.drawImage(ring,0,0);
}
function materialTile(name,x,y,seed){
 const phase=terrainVisualHash(seed,0,0),px=(x+(phase&1))&1,py=(y+((phase>>>1)&1))&1,key=name+':'+px+py;
 if(materialTiles.has(key))return materialTiles.get(key);
 const tile=document.createElement('canvas');tile.width=tile.height=CELL;const c=tile.getContext('2d'),period=CELL*2;
 for(let yy=-py*CELL;yy<CELL;yy+=period)for(let xx=-px*CELL;xx<CELL;xx+=period)c.drawImage(terrainImages[name],xx,yy,period,period);
 materialTiles.set(key,tile);return tile;
}
let terrainCornerFields;
function terrainMask(mask,kind,variant){
 const key=mask+':'+kind+':'+variant;if(terrainMasks.has(key))return terrainMasks.get(key);
 const tile=document.createElement('canvas');tile.width=tile.height=CELL;const c=tile.getContext('2d'),p=c.createImageData(CELL,CELL),inset=kind==='shore'?2:kind==='water'?6:kind==='mountain'?7:5;
 const has=d=>!!(mask&(1<<d)),waves=Float32Array.from({length:CELL},(_,t)=>Math.sin(t/11+variant)*1.5+Math.sin(t/5+variant*.7)*.7),smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 if(mask===255){c.fillStyle='#fff';c.fillRect(0,0,CELL,CELL);terrainMasks.set(key,tile);return tile;}
 if(!terrainCornerFields)terrainCornerFields=Array.from({length:4},(_,corner)=>{const concave=new Float32Array(CELL*CELL),convex=new Float32Array(CELL*CELL),cx=corner<2?CELL-1:0,cy=corner===0||corner===3?0:CELL-1;for(let y=0;y<CELL;y++)for(let x=0;x<CELL;x++){const dx=Math.abs(x-cx),dy=Math.abs(y-cy),k=y*CELL+x;concave[k]=Math.hypot(dx,dy)-6;convex[k]=dx<14&&dy<14?14-Math.hypot(14-dx,14-dy):CELL;}return{concave,convex};});
 const cuts=[];for(let corner=0;corner<4;corner++){const a=corner,b=(corner+1)%4;if(has(a)&&has(b)&&!has(4+corner))cuts.push(terrainCornerFields[corner].concave);else if(!has(a)&&!has(b))cuts.push(terrainCornerFields[corner].convex);}
 const open=[0,1,2,3].filter(side=>!has(side));
 for(let y=0;y<CELL;y++)for(let x=0;x<CELL;x++){
  let d=CELL;
  for(const side of open){const a=side===0?y:side===1?CELL-1-x:side===2?CELL-1-y:x;d=Math.min(d,a-waves[side%2?y:x]);}
  for(const cut of cuts)d=Math.min(d,cut[y*CELL+x]);
  const k=(y*CELL+x)*4;p.data[k]=p.data[k+1]=p.data[k+2]=255;p.data[k+3]=Math.round(255*smooth((d-inset+(kind==='forest'?3:2))/(kind==='forest'?11:kind==='mountain'?7:4)));
 }
 c.putImageData(p,0,0);terrainMasks.set(key,tile);return tile;
}
function maskedMaterial(c,name,x,y,g,mask,kind,variant,tint){
 const layer=document.createElement('canvas');layer.width=layer.height=CELL;const q=layer.getContext('2d');q.drawImage(materialTile(name,x,y,g.seed),0,0);
 if(tint){q.fillStyle=tint;q.fillRect(0,0,CELL,CELL);}q.globalCompositeOperation='destination-in';q.drawImage(terrainMask(mask,kind,variant),0,0);c.drawImage(layer,0,0);
}
function roadPath(mask){
 const path=new Path2D(),ends=terrainDirs.filter((_,d)=>mask&(1<<d)).map(([dx,dy])=>[CELL/2+CELL/2*dx,CELL/2+CELL/2*dy]);
 if(ends.length===2&&mask!==5&&mask!==10){path.moveTo(...ends[0]);path.bezierCurveTo(28,28,28,28,...ends[1]);}
 else if(ends.length){for(const end of ends){path.moveTo(28,28);path.lineTo(...end);}}
 else{path.moveTo(28,28);path.lineTo(28.01,28);}return path;
}
function roadOverlay(mask){
 if(!terrainImageReady('road'))return null;if(roadOverlays.has(mask))return roadOverlays.get(mask);
 const tile=document.createElement('canvas');tile.width=tile.height=CELL;const c=tile.getContext('2d'),path=roadPath(mask);c.lineCap=c.lineJoin='round';
 c.lineWidth=24;c.strokeStyle='#a995724d';c.stroke(path);c.lineWidth=20;c.strokeStyle='#b9a27b';c.stroke(path);c.lineWidth=18;c.strokeStyle=c.createPattern(materialTile('road',0,0,0),'repeat');c.stroke(path);roadOverlays.set(mask,tile);return tile;
}
function terrainTile(g,x,y,concealNeighbors=false){
 const type=g.terrain[KEY(x,y)],desert=g.map==='desert',soil=desert?'sand':'plain',vegetation=type+(desert?'-desert':''),bank=desert?'bank-desert':'bank',water=type==='river'||type==='bridge';
 const t=terrainTopology(g,x,y,concealNeighbors);
 const bush=desert?'forest-desert':'forest',required=[soil,...(['forest','mountain'].includes(type)?[vegetation]:[]),...(type==='hedge'?[bush]:[]),...(water?['water',bank]:[]),...(type==='road'?['road']:[]),...(type==='bridge'?['bridge']:[])];if(!required.every(terrainImageReady))return null;
 const crop=type==='field'?fieldStyle(g,x,y,concealNeighbors):null,phase=terrainVisualHash(g.seed,0,0),variant=terrainVisualHash(g.seed,x,y)%4,organic=['forest','mountain','river','bridge','hill','hedge','field'].includes(type),key=[type,desert,organic?t.sameMask:0,type==='road'?t.roadMask:0,type==='bridge'?t.vertical:0,(x+(phase&1))&1,(y+((phase>>>1)&1))&1,organic?variant:0,crop?crop.color+crop.vertical:''].join(':');
 if(terrainTiles.has(key))return terrainTiles.get(key);
 const tile=document.createElement('canvas');tile.width=tile.height=CELL;const c=tile.getContext('2d');c.drawImage(materialTile(soil,x,y,g.seed),0,0);
 if(type==='forest'||type==='mountain'){
  maskedMaterial(c,soil,x,y,g,t.sameMask,type,variant,type==='forest'?'#304b383d':'#7b77663b');
  maskedMaterial(c,vegetation,x,y,g,t.sameMask,type,variant);
 }else if(water){
  maskedMaterial(c,bank,x,y,g,t.sameMask,'shore',variant);maskedMaterial(c,'water',x,y,g,t.sameMask,'water',variant);
  if(type==='bridge'){c.save();c.translate(28,28);if(!t.vertical)c.rotate(Math.PI/2);c.drawImage(terrainImages.bridge,-28,-28,CELL,CELL);c.restore();}
 }else if(type==='road'){c.drawImage(roadOverlay(t.roadMask),0,0);if(desert){c.lineCap=c.lineJoin='round';c.lineWidth=18;c.strokeStyle='#5b46304d';c.stroke(roadPath(t.roadMask));}}
 else if(type==='field')drawCrops(c,crop,t.sameMask);
 else if(type==='hedge')drawHedge(c,t.sameMask&15,c.createPattern(materialTile(bush,x,y,g.seed),'repeat'));
 else if(type==='hill')drawHill(c,t.sameMask,variant,desert);
 if(terrainTiles.size>=1024)terrainTiles.delete(terrainTiles.keys().next().value);terrainTiles.set(key,tile);return tile;
}
function terrainFallback(c,g,x,y,concealNeighbors=false){
 const type=g.terrain[KEY(x,y)],t=terrainTopology(g,x,y,concealNeighbors);c.fillStyle=terrainMinimapColor(type==='road'?'plain':type,g.map);c.fillRect(0,0,CELL,CELL);
 if(type==='forest')for(const [px,py,r]of [[16,17,11],[39,22,10],[25,39,12]]){c.fillStyle='#233f3650';c.beginPath();c.ellipse(px+2,py+3,r,r*.8,0,0,7);c.fill();c.fillStyle=g.map==='desert'?'#667148':'#4a6b4a';c.beginPath();c.arc(px,py,r,0,7);c.fill();}
 if(type==='mountain'){polygon(c,[[6,43],[17,12],[34,6],[48,38],[30,48]],g.map==='desert'?'#a79779':'#9b9d92');polygon(c,[[17,12],[34,6],[30,48]],'#c5c6b2');}
 if(type==='road'){c.lineCap=c.lineJoin='round';c.strokeStyle='#b9a27b';c.lineWidth=20;c.stroke(roadPath(t.roadMask));}
 if(type==='field')drawCrops(c,fieldStyle(g,x,y,concealNeighbors),t.sameMask);
 if(type==='hedge'){c.fillStyle=terrainMinimapColor('plain',g.map);c.fillRect(0,0,CELL,CELL);drawHedge(c,t.sameMask&15,g.map==='desert'?'#6f7146':'#3f5e3c');}
 if(type==='hill')drawHill(c,t.sameMask,terrainVisualHash(g.seed,x,y)%4,g.map==='desert');
 if(type==='river'||type==='bridge'){c.strokeStyle='#b1ced05c';c.beginPath();c.moveTo(5,20);c.bezierCurveTo(16,14,35,26,51,20);c.stroke();if(type==='bridge'){c.save();c.translate(28,28);if(!t.vertical)c.rotate(Math.PI/2);c.fillStyle='#b4a080';c.fillRect(-10,-28,20,56);c.strokeStyle='#574d3b';for(let yy=-26;yy<28;yy+=7){c.beginPath();c.moveTo(-10,yy);c.lineTo(10,yy);c.stroke();}c.restore();}}
}
function drawTerrainCell(c,g,x,y){c.save();c.translate(x*CELL,y*CELL);const tile=terrainTile(g,x,y);if(tile)c.drawImage(tile,0,0);else terrainFallback(c,g,x,y);c.restore();}
function renderTerrain(c,g){for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)drawTerrainCell(c,g,x,y);}
function drawUnexploredTerrainEdges(c,g){
 let cached=fogTerrainCache.get(g),changed=!cached;if(cached)for(let k=0;k<SIZE;k++)if(cached.known[k]!==Number(g.explored.blue[k])){changed=true;break;}
 if(changed){
  cached={known:Uint8Array.from(g.explored.blue,Number),items:[]};
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(g.explored.blue[KEY(x,y)]){
   const clip=new Path2D();let capped=false;
   terrainNeighbors.forEach(([dx,dy],d)=>{if(!INSIDE(x+dx,y+dy)||g.explored.blue[KEY(x+dx,y+dy)])return;capped=true;
    if(d<4)clip.rect(x*CELL+(d===1?CELL-20:0),y*CELL+(d===2?CELL-20:0),d%2?20:CELL,d%2?CELL:20);
    else clip.rect(x*CELL+(dx>0?CELL-20:0),y*CELL+(dy>0?CELL-20:0),20,20);
   });
   if(capped)cached.items.push({x,y,clip,whole:['road','bridge','hedge','field'].includes(g.terrain[KEY(x,y)])});
  }fogTerrainCache.set(g,cached);
 }
 for(const {x,y,clip,whole}of cached.items){const tile=terrainTile(g,x,y,true);c.save();if(!whole)c.clip(clip);c.translate(x*CELL,y*CELL);if(tile)c.drawImage(tile,0,0);else terrainFallback(c,g,x,y,true);c.restore();}
}
function drawTerrainGrid(c,g,z){
 const path=new Path2D();for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(g.explored.blue[KEY(x,y)])path.rect(x*CELL,y*CELL,CELL,CELL);
 c.save();c.strokeStyle='#162d304d';c.lineWidth=1/z;c.stroke(path);c.restore();
}

/* Câmera em pixels do mundo (CELL por casa); zoom 1 = 56 px por casa na tela. */
const cam={x:0,y:0,zoom:1};
// Folga em pixels de tela abaixo do mapa: a última fileira pode subir acima da faixa de baixo (grupos, barra de comando, minimapa).
const cameraFoot=()=>Math.max(110,(document.querySelector('.hud-row')?.offsetHeight||0)+16);
function clampCamera(){const v=renderer.canvas,z=cam.zoom=Math.max(.35,Math.min(1.5,cam.zoom));for(const [axis,size,world]of [['x',v.clientWidth,COLS*CELL],['y',v.clientHeight,ROWS*CELL]]){const max=world-(size-(axis==='y'?cameraFoot():0))/z;cam[axis]=max<0?max/2:Math.max(0,Math.min(max,cam[axis]));}renderer.dirty=true;}
function centerCamera(x,y){const v=renderer.canvas;cam.x=(x+.5)*CELL-v.clientWidth/cam.zoom/2;cam.y=(y+.5)*CELL-v.clientHeight/cam.zoom/2;clampCamera();}
function drawPreview(canvas,g){const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.save();c.scale(canvas.width/(COLS*CELL),canvas.height/(ROWS*CELL));renderTerrain(c,g);for(const u of g.structures){c.fillStyle=TEAM[u.owner];const n=u.type==='hq'?CELL*1.6:CELL;c.fillRect((u.x+.5)*CELL-n/2,(u.y+.5)*CELL-n/2,n,n);}c.restore();}

class Renderer{
 constructor(){this.canvas=$('battlefield');this.ctx=this.canvas.getContext('2d',{alpha:false});this.mini=$('minimap').getContext('2d');this.ground=document.createElement('canvas');this.ground.width=COLS*CELL;this.ground.height=ROWS*CELL;this.glow={small:glow(2.8),large:glow(4)};this.particles=[];this.texts=[];this.shake=0;this.dirty=true;this.rebuild();}
 paintGround(){const c=this.ground.getContext('2d');c.clearRect(0,0,this.ground.width,this.ground.height);fieldPatches.delete(game);renderTerrain(c,game);fogTerrainCache.delete(game);this.dirty=true;}
 rebuild(){this.paintGround();this.particles=[];this.texts=[];this.shake=0;this.ambientParticles=[];this.ambientTick=-1;this.graphics=null;}
 terrain(ctx,x,y,type,time,g=game){drawTerrainCell(ctx,g,x,y);}
 environment(dt){
  const c=this.ctx,profile=GRAPHICS[settings.graphics]||GRAPHICS.balanced;
  if(this.graphics!==settings.graphics){this.ambientParticles=[];this.ambientTick=-1;this.graphics=settings.graphics;}
  if(!profile.clouds)return;
  const w=this.canvas.clientWidth/cam.zoom,h=this.canvas.clientHeight/cam.zoom,x0=Math.max(0,Math.floor(cam.x/CELL)),y0=Math.max(0,Math.floor(cam.y/CELL)),x1=Math.min(COLS,Math.ceil((cam.x+w)/CELL)),y1=Math.min(ROWS,Math.ceil((cam.y+h)/CELL)),clip=new Path2D(),time=reducedMotion?0:game.time;
  const visible=(x,y)=>INSIDE(Math.floor(x/CELL),Math.floor(y/CELL))&&game.visible.blue[KEY(Math.floor(x/CELL),Math.floor(y/CELL))],onScreen=(x,y,pad=60)=>x>=cam.x-pad&&x<=cam.x+w+pad&&y>=cam.y-pad&&y<=cam.y+h+pad;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(game.visible.blue[KEY(x,y)])clip.rect(x*CELL,y*CELL,CELL,CELL);
  c.save();c.clip(clip);
  // Reflexos ficam restritos à água; fases são derivadas da semente visual, sem RNG do combate.
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(game.visible.blue[KEY(x,y)]&&game.terrain[KEY(x,y)]==='river'){
   const hash=terrainVisualHash(game.seed,x,y),phase=time*.65+(hash%100)/16;c.strokeStyle='#c6e9ed';c.globalAlpha=.09+.04*Math.sin(phase);c.lineWidth=1.2;c.beginPath();
   for(let i=0;i<3;i++){const px=x*CELL+10+((hash>>>(i*3))%18),py=y*CELL+12+i*14+Math.sin(phase+i)*2;c.moveTo(px,py);c.lineTo(px+11,py-1);}c.stroke();
  }
  // Bancos de nuvens espaçados pelo mapa; recorte na visão e descarte fora da câmera.
  for(let i=0;i<profile.clouds;i++){
   const slot=profile.clouds===12?i*2:i,hash=terrainVisualHash(game.seed,slot,47),cw=190+(hash%150),ch=cw*.5,span=COLS*CELL+cw;
   const x=((slot%6+.5)*COLS*CELL/6+time*(2+(hash%4))+hash%80)%span-cw/2,y=(Math.floor(slot/6)+.5)*ROWS*CELL/4+(hash%70)-35;
   if(!onScreen(x+cw/2,y,ch+cw/2))continue;const image=ambientClouds[slot%3];
   if(image.complete&&image.naturalWidth){c.globalAlpha=.07;const shadow=cloudShadows[slot%3];if(shadow)c.drawImage(shadow,x+22,y+26,cw,ch);c.globalAlpha=profile.alpha;c.drawImage(image,x,y,cw,ch);}
   else{c.globalAlpha=profile.alpha*.7;c.fillStyle='#dce9ed';c.beginPath();for(let n=0;n<4;n++)c.ellipse(x+cw*(.2+n*.2),y+ch*.5,cw*.17,ch*.18,0,0,7);c.fill();}
  }
  c.globalAlpha=1;
  const tick=Math.floor(game.time/profile.interval);
  if(dt>0&&!reducedMotion&&tick!==this.ambientTick){
   this.ambientTick=tick;const push=p=>{if(this.ambientParticles.length<profile.particles)this.ambientParticles.push({...p,t:0});};
   for(const u of game.units){const x=(u.x+.5)*CELL,y=(u.y+.5)*CELL;if(!visible(x,y)||!onScreen(x,y))continue;const terrain=game.terrainAt(u),hash=terrainVisualHash(game.seed,u.id,tick);
    if(u.segment&&!AIR(u)&&(terrain==='road'||game.map==='desert'&&['plain','hill','field'].includes(terrain)))push({x:x-Math.sin(u.facing)*14,y:y+Math.cos(u.facing)*14,vx:8,vy:-3,life:1,size:3+(hash%3),color:game.map==='desert'?'#d8c29a':'#bba986'});
    if(AIR(u)&&flightLevel(u)<.3&&terrain!=='river')push({x:x+(hash%34)-17,y:y+((hash>>>6)%30)-15,vx:(hash%20)-10,vy:5,life:.65,size:2,color:'#c2bb99'});
   }
   const hash=terrainVisualHash(game.seed,tick,93),x=x0+hash%Math.max(1,x1-x0),y=y0+(hash>>>8)%Math.max(1,y1-y0),terrain=game.terrain[KEY(x,y)];
   if(visible(x*CELL,y*CELL)&&['plain','field','forest','hedge'].includes(terrain)&&game.map!=='desert')push({x:x*CELL+(hash%CELL),y:y*CELL+((hash>>>12)%CELL),vx:12,vy:-2,life:2.2,size:1.5,color:terrain==='forest'||terrain==='hedge'?'#b5ba7e':'#d6cba0'});
  }
  if(reducedMotion)this.ambientParticles=[];
  let n=0;for(const p of this.ambientParticles){p.t+=dt;if(p.t>=p.life)continue;p.x+=p.vx*dt;p.y+=p.vy*dt;this.ambientParticles[n++]=p;if(!onScreen(p.x,p.y)||!visible(p.x,p.y))continue;c.globalAlpha=.25*(1-p.t/p.life);c.fillStyle=p.color;c.beginPath();c.ellipse(p.x,p.y,p.size*(1+p.t),p.size,0,0,7);c.fill();}this.ambientParticles.length=n;
  // Turbulência dos rotores baixos: somente decorativa, sem modificar o terreno.
  for(const u of game.units)if(AIR(u)&&flightLevel(u)<1){const x=(u.x+.5)*CELL,y=(u.y+.5)*CELL;if(!visible(x,y)||!onScreen(x,y))continue;c.globalAlpha=.13*(1-flightLevel(u));c.strokeStyle=game.terrainAt(u)==='river'?'#c6e9ed':'#d0c59f';c.lineWidth=1;const radius=23+(reducedMotion?0:Math.sin(time*4+u.id)*3);c.beginPath();c.ellipse(x,y+9,radius,radius*.45,0,0,7);c.stroke();}
  c.restore();
 }

 blast(x,y,level=0,contactId,sourceId){
  for(let i=0;i<(reducedMotion?3:16);i++){const angle=Math.random()*Math.PI*2,v=15+Math.random()*95;this.particles.push({x:(x+.5)*CELL,y:(y+.5)*CELL-18*level,lift:18*level,air:!!contactId||!!sourceId,contactId,sourceId,vx:Math.cos(angle)*v,vy:Math.sin(angle)*v,t:0,life:.4+Math.random()*.7,size:2+Math.random()*5,color:i%3?'#e8be76':'#8c9992'});}
  if(this.particles.length>320)this.particles.splice(0,this.particles.length-320);
 }
 consume(){
  for(const e of game.events.splice(0))if(e.visible){
   if(e.kind==='smoke'){this.particles.push({x:(e.x+.5)*CELL,y:(e.y+.5)*CELL-18*e.flightLevel,lift:18*e.flightLevel,contactId:e.contactId,sourceId:e.sourceId,vx:2,vy:-3,t:0,life:1.2,size:3,color:'#b5bdbe',smoke:true,air:e.air});}
   else if(e.kind==='flare'){
    for(let i=0;i<5;i++){const dx=(e.decoy.x-e.x)*CELL,dy=(e.decoy.y-e.y)*CELL;this.particles.push({x:(e.x+.5)*CELL,y:(e.y+.5)*CELL-18*e.flightLevel,lift:18*e.flightLevel,contactId:e.contactId,vx:dx*(.8+i*.08)+(i-2)*13,vy:dy*(.8+i*.08)-(i-2)*9,t:0,life:1.2,size:2.5,color:'#ffe6ad',flare:true,air:true});}
    if(selection.has(e.id)||game.units.some(u=>selection.has(u.id)&&AIR(u)&&Math.hypot(u.x-e.x,u.y-e.y)<.1))say('Salva de flares lançada. Um míssil protegido; recarga defensiva iniciada.');
   }
   else if(e.kind==='blast'){this.blast(e.x,e.y,e.flightLevel,e.air?e.contactId:undefined,e.air?e.sourceId:undefined);if(e.heavy){audio.play('artillery');this.shake=reducedMotion?0:7;}}
   else if(e.kind==='shot'){audio.play(TYPES[e.weapon].tank||['artillery','antitank'].includes(e.weapon)?'tank':'infantry');if(TYPES[e.weapon].tank)this.shake=reducedMotion?0:4;}
   else if(e.kind==='ready')audio.play('purchase');
   else this.texts.push({...e,t:0});
  }if(this.texts.length>60)this.texts.splice(0,this.texts.length-60);if(this.particles.length>640)this.particles.splice(0,this.particles.length-640);
 }
 outline(x,y,color,width=2){const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.strokeRect(x*CELL+2,y*CELL+2,CELL-4,CELL-4);}
 area(x,y,alpha=.2){const c=this.ctx;c.save();for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++)if(INSIDE(xx,yy)){c.fillStyle=`rgba(242,174,94,${alpha})`;c.fillRect(xx*CELL+1,yy*CELL+1,CELL-2,CELL-2);this.outline(xx,yy,'#ffdc92',1.6);}c.restore();}
 bar(x,y,width,ratio,color){const c=this.ctx;c.fillStyle='#0b2028';c.fillRect(x-width/2-1,y-1,width+2,6);c.fillStyle=color;c.fillRect(x-width/2,y,width*Math.max(0,Math.min(1,ratio)),4);}
 entity(u,memory=false){
  const c=this.ctx,x=(u.x+.5)*CELL,groundY=(u.y+.5)*CELL,pose=flightPose(u),y=(pose.y+.5)*CELL,chosen=selection.has(u.id);c.save();
  if(memory)c.globalAlpha=.55;
  if(!memory&&AIR(u)){
   c.save();c.translate(x+7+pose.level*12,groundY+15+pose.level*12);c.scale(1,.55);const shadow=c.createRadialGradient(0,0,5,0,0,26+pose.level*5);shadow.addColorStop(0,pose.level>.5?'#071c2c32':'#071c2c60');shadow.addColorStop(1,'#071c2c00');c.fillStyle=shadow;c.beginPath();c.arc(0,0,26+pose.level*5,0,7);c.fill();c.restore();
   if(pose.level>0){c.save();c.globalAlpha=.22*pose.level;if(highCloud.complete&&highCloud.naturalWidth)c.drawImage(highCloud,x-38,groundY-31,76,76);else{c.fillStyle='#e7edf1';for(const [dx,dy]of [[-25,12],[25,-5],[-16,-22]]){c.beginPath();c.ellipse(x+dx,groundY+dy,14,7,0,0,7);c.fill();}}c.restore();}
   c.strokeStyle=TEAM[u.owner]+'aa';c.lineWidth=1.6;c.setLineDash([3,4]);c.beginPath();c.ellipse(x,groundY+2,pose.level>0?18:25,pose.level>0?12:25,0,0,7);c.stroke();c.setLineDash([]);
   if(chosen&&pose.level>0){c.strokeStyle='#c6eff6aa';c.lineWidth=1;c.beginPath();c.moveTo(x,groundY);c.lineTo(x,y);c.stroke();}
  }
  if(chosen){c.strokeStyle=u.owner==='blue'?'#c6eff6':TEAM[u.owner];c.lineWidth=2.5;c.beginPath();c.ellipse(x,y+8,24*pose.scale,20*pose.scale,0,0,Math.PI*2);c.stroke();}
  const stride=u.segment&&!reducedMotion?Math.sign(Math.sin(game.time*13+u.id))*2:0,firing=!memory&&u.cooldown>(u.reload??TYPES[u.type].cooldown)-.12;
  const s=sprite(u.type,TEAM[u.owner],TYPES[u.type].structure?.83:.86,stride,firing);c.save();c.translate(x,y+2);c.scale(pose.scale,pose.scale);if(!TYPES[u.type].structure)c.rotate(u.facing||0);c.drawImage(s,-s.ox,-s.oy);c.restore();
  if(!memory&&game.radarContact('blue',u)){const r=32*pose.scale;c.strokeStyle='#102a1c';c.lineWidth=4;c.strokeRect(x-r,y-r,r*2,r*2);c.strokeStyle='#68ef8d';c.lineWidth=1.8;c.strokeRect(x-r,y-r,r*2,r*2);}
  if(!memory&&(chosen||u.hp<u.maxHp))this.bar(x,y+24,36,u.hp/u.maxHp,u.hp/u.maxHp>.45?'#b8dba5':'#f69d87');
  if(!memory&&!TYPES[u.type].structure){
   if(AIR(u)&&(u.altitude==='high'||u.order.type==='altitude')){const transition=u.order.type==='altitude',label=transition?(u.order.altitude==='high'?'SUBINDO':'DESCENDO'):'ALTA',width=transition?66:32;c.font='bold 9px Segoe UI';c.textAlign='center';c.fillStyle='#132a35';c.fillRect(x-width/2,y-46,width,14);c.fillStyle='#e4f1f5';c.fillText(label,x,y-36);if(transition)this.bar(x,y-30,width,Math.min(1,(u.altitudeTransition?.returning?0:u.altitudeTransition?.elapsed||0)/ALTITUDE_TIME),'#92dae4');}
   if(u.level>1||chosen){c.fillStyle='#ffde96';c.font='10px Segoe UI';c.textAlign='center';c.fillText('★'.repeat(u.level),x,y-22);}
   if(u.suppressed>0){c.strokeStyle='#f6a08c';c.lineWidth=2;c.beginPath();for(const dx of [-7,1]){c.moveTo(x+dx,y-36);c.lineTo(x+dx+3,y-31);c.lineTo(x+dx+6,y-36);}c.stroke();}
   if(u.entrenched){c.strokeStyle='#c9e5e2';c.lineWidth=2;c.beginPath();c.arc(x,y+3,24,.1,Math.PI-.1);c.stroke();}
   if(chosen){c.fillStyle=(game.mode==='rts'?u.cooldown<=0:u.actionLeft)?'#b8e5bd':'#78858a';c.beginPath();c.arc(x+23,y-16,3,0,Math.PI*2);c.fill();}
  }
  if(!memory&&u.type==='hq'&&u.queue.length)this.bar(x,y+31,44,u.queue[0].progress/game.trainDuration(u.queue[0].type),'#edd098');
  c.restore();
 }
 draw(dt){
  this.drawRadar();
  const c=this.ctx,z=cam.zoom*(devicePixelRatio||1);c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.fillStyle='#20333d';c.fillRect(0,0,this.canvas.width,this.canvas.height);c.save();c.setTransform(z,0,0,z,-cam.x*z,-cam.y*z);
  if(this.shake>0&&dt>0&&!reducedMotion){c.translate((Math.random()-.5)*this.shake,(Math.random()-.5)*this.shake);this.shake=Math.max(0,this.shake-dt*25);}
  c.drawImage(this.ground,0,0);drawUnexploredTerrainEdges(c,game);
  for(const [k,s]of game.memory.blue)if(!game.visible.blue[k])this.entity(s,true);
  // Névoa em quatro preenchimentos (um por cor) em vez de um por casa.
  const fog=[new Path2D(),new Path2D(),new Path2D(),new Path2D()];
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
   const k=KEY(x,y);if(!game.explored.blue[k]){fog[(x+y)%2].rect(x*CELL-1/z,y*CELL-1/z,CELL+2/z,CELL+2/z);fog[2].rect(x*CELL+26,y*CELL+26,3,3);}
   else if(!game.visible.blue[k])fog[3].rect(x*CELL,y*CELL,CELL,CELL);
  }
  ['#21333d','#21333d','#62768140','#10252daf'].forEach((color,i)=>{c.fillStyle=color;c.fill(fog[i]);});
  this.environment(dt);
  for(const s of game.structures)if(game.isVisible('blue',s))this.entity(s);
  if(showGrid)drawTerrainGrid(c,game,z);
  for(const id of selection){const u=game.get(id);if(!u||u.owner!=='blue'||TYPES[u.type].structure)continue;
   c.strokeStyle='#a6e1e477';c.lineWidth=1.3;c.setLineDash([5,5]);c.beginPath();c.moveTo((u.x+.5)*CELL,(u.y+.5)*CELL);if(u.segment)c.lineTo((u.segment.to.x+.5)*CELL,(u.segment.to.y+.5)*CELL);for(const p of u.path)c.lineTo((p.x+.5)*CELL,(p.y+.5)*CELL);c.stroke();c.setLineDash([]);
   if(game.turn==='blue'){const target=game.get(u.order.targetId),goal=u.order.goal||(target&&game.isVisible('blue',target)?TILE(target):u.order.last);if(goal)this.outline(goal.x,goal.y,['attack','attackMove'].includes(u.order.type)?'#f9b09a':'#b8e5e6',2);}
   if(u.type==='commander'){c.strokeStyle='#e9cf8944';c.lineWidth=2;polygon(c,[[u.x*CELL+28,(u.y-1.5)*CELL],[(u.x+2.5)*CELL,u.y*CELL+28],[u.x*CELL+28,(u.y+2.5)*CELL],[(u.x-1.5)*CELL,u.y*CELL+28]],'#edd0980d','#edd09855');}
  }
  for(const m of game.mines)if(m.known.blue&&game.explored.blue[KEY(m.x,m.y)]){polygon(c,[[(m.x+.5)*CELL,m.y*CELL+18],[m.x*CELL+42,m.y*CELL+42],[m.x*CELL+14,m.y*CELL+42]],'#d8bc77','#4d513d');c.fillStyle='#39403b';c.font='bold 17px sans-serif';c.textAlign='center';c.fillText('!',(m.x+.5)*CELL,m.y*CELL+37);}
  if(hover&&INSIDE(Math.round(hover.x),Math.round(hover.y))&&game.explored.blue[KEY(Math.round(hover.x),Math.round(hover.y))])this.outline(Math.round(hover.x),Math.round(hover.y),'#e9eac56b',1.2);
  if(hover){const target=entityAt(hover),art=selectedUnits().find(u=>u.type==='artillery');if(art&&target&&game.canFire(art,target)){const p=TILE(target);this.area(p.x,p.y,.12);}}
  for(const p of game.projectiles)if(p.type==='artillery'&&(p.owner==='blue'||game.isVisible('blue',{x:p.tx,y:p.ty})))this.area(p.tx,p.ty,.1+.12*p.elapsed/p.duration);
  // Aeronaves por cima das tropas terrestres.
  for(const air of [false,true])for(const u of game.units)if(AIR(u)===air&&(u.owner==='blue'||game.isVisible('blue',u)))this.entity(u);
  for(const p of game.projectiles){
   const t=Math.min(1,p.elapsed/p.duration),target=p.type==='artillery'?null:game.get(p.targetId),tx=target?.x??p.tx,ty=target?.y??p.ty;
   const missile=MISSILE(p.weapon),gx=missile?p.x:p.sx+(tx-p.sx)*t,gy=missile?p.y:p.sy+(ty-p.sy)*t;if(missile?!game.effectVisible(gx,gy,p.air,p.targetId,p.attackerId):p.owner!=='blue'&&!game.isVisible('blue',{x:gx,y:gy}))continue;
   const level=p.visualLevel??p.sourceLevel??0,x=(gx+.5)*CELL,y=(gy+.5)*CELL-18*level-(p.type==='artillery'?Math.sin(Math.PI*t)*85:0),g=p.type==='artillery'?this.glow.large:this.glow.small;c.drawImage(g,x-g.width/2,y-g.height/2);
   if(missile){const previous=p.trail.at(-1),heading=previous?Math.atan2((gy-previous.y)*CELL-18*(level-(previous.level||0)),(gx-previous.x)*CELL):p.heading;c.save();c.translate(x,y);c.rotate(heading);polygon(c,[[-9,-2.5],[6,-2.5],[12,0],[6,2.5],[-9,2.5]],'#e8ece6','#24353b');polygon(c,[[-8,-2],[-12,-5],[-10,0],[-12,5],[-8,2]],'#adb8b8');polygon(c,[[-10,-2],[-19,0],[-10,2]],'#ffac58');polygon(c,[[-10,-1],[-15,0],[-10,1]],'#fff3ba');c.restore();continue;}
   const look=p.weapon==='gun'?'machinegun':p.weapon==='agm'||p.weapon==='aam'?'antitank':p.type;
   if(look==='antitank'||look==='machinegun'){c.save();c.translate(x,y);c.rotate(Math.atan2((ty-p.sy)*CELL-18*((p.targetLevel||0)-(p.sourceLevel||0)),(tx-p.sx)*CELL));if(look==='antitank'){c.strokeStyle='#edb87388';c.lineWidth=3;c.beginPath();c.moveTo(-19,0);c.lineTo(-5,0);c.stroke();polygon(c,[[-5,-2],[4,-2],[8,0],[4,2],[-5,2]],'#e9ebe0');}else{c.fillStyle='#fff0b1';c.fillRect(-9,-1,12,2);}c.restore();}
  }
  let n=0;for(const p of this.particles){p.t+=dt;if(p.t>=p.life)continue;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy-=dt*12;this.particles[n++]=p;if((p.smoke||p.flare||p.contactId||p.sourceId)&&!game.effectVisible(p.x/CELL-.5,(p.y+(p.lift||0))/CELL-.5,p.air,p.contactId,p.sourceId))continue;c.globalAlpha=(1-p.t/p.life)*(p.smoke?.45:1);c.fillStyle=p.color;c.beginPath();c.arc(p.x,p.y,p.size*(1+p.t),0,7);c.fill();}this.particles.length=n;
  c.font='bold 17px Segoe UI';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#14262c';
  n=0;for(const f of this.texts){f.t+=dt;if(f.t>=1.1)continue;this.texts[n++]=f;if((f.contactId||f.sourceId)&&!game.effectVisible(f.x,f.y,f.air,f.contactId,f.sourceId))continue;c.globalAlpha=1-f.t/1.1;const x=(f.x+.5)*CELL,y=(f.y+.2)*CELL-f.t*25-18*(f.flightLevel||0);c.strokeText(f.text,x,y);c.fillStyle=f.color;c.fillText(f.text,x,y);}this.texts.length=n;c.globalAlpha=1;
  if(marker){marker.t+=dt;if(marker.t>.9)marker=null;else{c.strokeStyle=marker.color;c.lineWidth=2;c.beginPath();c.arc((marker.x+.5)*CELL,(marker.y+.5)*CELL,10+marker.t*12,0,7);c.stroke();}}
  if(drag?.active){const x=Math.min(drag.start.x,drag.end.x),y=Math.min(drag.start.y,drag.end.y),w=Math.abs(drag.end.x-drag.start.x),h=Math.abs(drag.end.y-drag.start.y);c.fillStyle='#99dfea22';c.strokeStyle='#c0f0ec';c.lineWidth=1.5;c.fillRect((x+.5)*CELL,(y+.5)*CELL,w*CELL,h*CELL);c.strokeRect((x+.5)*CELL,(y+.5)*CELL,w*CELL,h*CELL);}
  c.restore();
 }
 drawRadar(){
  const view=radarView();setProp('radarPanel','hidden',!view);if(!view)return;
  const row=$('radarPanel').parentElement,space=Math.max(0,this.canvas.clientHeight-12)+'px';if(row.style.getPropertyValue('--radar-field-height')!==space)row.style.setProperty('--radar-field-height',space);
  if(radarCollapsed===null)radarCollapsed=this.canvas.clientHeight<360;
  $('radarPanel').classList.toggle('collapsed',radarCollapsed);setProp('radarBody','hidden',radarCollapsed);setAttr('radarCollapse','aria-expanded',String(!radarCollapsed));setProp('radarCollapse','title',radarCollapsed?'Expandir radar aéreo':'Recolher radar aéreo');setText('radarCollapse',`Radar · ${view.contacts.length} contatos`);setText('radarReference',`Referência: AA #${view.source.id}`);
  const commands=$('commandBar'),details=$('details'),stacked=getComputedStyle(commands).order==='-1';
  const floor=stacked?Math.max(...[$('radarPanel'),...row.querySelectorAll('.hud')].map(el=>el.offsetHeight))+parseFloat(getComputedStyle(row).rowGap):0,available=Math.max(0,this.canvas.clientHeight-12-floor);
  const detailSpace=!details.hidden&&getComputedStyle(details).position==='absolute'?details.offsetHeight+6:0,limit=available+'px';
  if(row.style.getPropertyValue('--radar-command-height')!==limit)row.style.setProperty('--radar-command-height',limit);
  row.classList.toggle('radar-tight',!commands.hidden&&commands.scrollHeight+detailSpace+2>available);
  setAttr('radarDisplay','aria-label',`Radar aéreo, referência antiaérea ${view.source.id}, ${view.contacts.length} aeronaves inimigas visíveis. Norte para cima, escala do mapa inteiro.`);if(radarCollapsed)return;
  const canvas=$('radarDisplay'),size=canvas.clientWidth,dpr=window.devicePixelRatio||1;if(!size)return;
  if(canvas.width!==Math.round(size*dpr)||canvas.height!==Math.round(size*dpr)){canvas.width=Math.round(size*dpr);canvas.height=Math.round(size*dpr);}
  const c=canvas.getContext('2d'),mid=size/2,r=mid-2,scale=(r-4)/Math.hypot(COLS-1,ROWS-1),phase=reducedMotion?0:(game.time%4)/4*Math.PI*2,angle=phase-Math.PI/2;
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,size,size);c.lineWidth=1;c.beginPath();c.arc(mid,mid,r,0,Math.PI*2);c.fillStyle='#0b2019b8';c.fill();
  // Varredura decorativa: o relógio e os contatos vêm do jogo; nenhum sorteio ou atraso de detecção.
  c.save();c.beginPath();c.arc(mid,mid,r,0,Math.PI*2);c.clip();
  for(let i=0;i<12;i++){const a=angle-.42+i*.035;c.beginPath();c.moveTo(mid,mid);c.arc(mid,mid,r,a,a+.036);c.closePath();c.fillStyle=`rgba(66,232,107,${.02+i*.009})`;c.fill();}
  c.strokeStyle='#33bb5b65';for(let i=1;i<=4;i++){c.beginPath();c.arc(mid,mid,r*i/4,0,Math.PI*2);c.stroke();}
  for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.moveTo(mid,mid);c.lineTo(mid+Math.cos(a)*r,mid+Math.sin(a)*r);c.stroke();}
  c.strokeStyle='#55f487';c.lineWidth=1.5;c.beginPath();c.moveTo(mid,mid);c.lineTo(mid+Math.cos(angle)*r,mid+Math.sin(angle)*r);c.stroke();
  c.strokeStyle='#68ef8d';c.lineWidth=1.5;for(const u of view.contacts){const x=mid+(u.x-view.source.x)*scale,y=mid+(u.y-view.source.y)*scale;c.strokeRect(x-2.5,y-2.5,5,5);}
  c.fillStyle='#92ffab';c.fillRect(mid-1,mid-1,2,2);c.restore();c.strokeStyle='#42df72';c.lineWidth=1.5;c.beginPath();c.arc(mid,mid,r,0,Math.PI*2);c.stroke();
  c.fillStyle='#6df68e';c.font=`${size<150?8:10}px Segoe UI`;c.textBaseline='middle';c.textAlign='center';c.fillText('0°',mid,10);c.fillText('180°',mid,size-10);c.textAlign='right';c.fillText('90°',size-6,mid);c.textAlign='left';c.fillText('270°',6,mid);
 }
 drawMini(){
  const c=this.mini,s=Math.min(c.canvas.width/COLS,c.canvas.height/ROWS);for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const k=KEY(x,y);c.fillStyle=game.explored.blue[k]?terrainMinimapColor(game.terrain[k],game.map):'#20333d';c.fillRect(x*s,y*s,s,s);if(game.explored.blue[k]&&!game.visible.blue[k]){c.fillStyle='#11232f99';c.fillRect(x*s,y*s,s,s);}}
  for(const u of game.all())if(u.owner==='blue'||game.isVisible('blue',u)){c.fillStyle=TEAM[u.owner];const n=u.type==='hq'?9:5;c.fillRect((u.x+.5)*s-n/2,(u.y+.5)*s-n/2,n,n);if(selection.has(u.id)){c.strokeStyle='#fff1bf';c.strokeRect((u.x+.5)*s-5,(u.y+.5)*s-5,10,10);}if(game.radarContact('blue',u)){c.strokeStyle='#68ef8d';c.lineWidth=1.5;c.strokeRect((u.x+.5)*s-4,(u.y+.5)*s-4,8,8);}}
  const k=s/CELL;c.strokeStyle='#fff1bfcc';c.lineWidth=1.5;c.strokeRect(cam.x*k,cam.y*k,this.canvas.clientWidth/cam.zoom*k,this.canvas.clientHeight/cam.zoom*k);
 }
}
