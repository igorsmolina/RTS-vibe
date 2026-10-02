'use strict';
function polygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
// Arte fornecida pelo jogador, preparada com transparência e incorporada para uso offline.
const troopAtlas=new Image(),troopFrames={
 commander:[0,80,274,402,273],infantry:[1,74,289,400,279],engineer:[2,77,272,400,270],recon:[3,66,295,387,295],
 tank:[4,33,323,356,324],artillery:[5,62,298,383,295],antitank:[6,74,285,394,282],machinegun:[7,77,287,400,287]
};
const tankAtlas=new Image(),tankFrames={lightTank:0,tank:1,heavyTank:2},tankSizes={lightTank:48,tank:54,heavyTank:60};
function unitIcon(ctx,type,x,y,color,scale=1,facing=0,stride=0,firing=false){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineWidth=1.6;ctx.lineCap='round';ctx.lineJoin='round';
 const dark='#10282e',steel='#a7b6ac',gold='#efd094';
 const box=(x,y,w,h,fill,stroke)=>{ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);if(stroke){ctx.strokeStyle=stroke;ctx.strokeRect(x,y,w,h);}};
 const oval=(x,y,rx,ry,fill,stroke)=>{ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}};
 const line=(points,color,width=2)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.stroke();ctx.lineWidth=1.6;};
 oval(2,7,TYPES[type].vehicle?22:17,TYPES[type].vehicle?19:13,'#081b2270');
 if(type==='hq'||type==='post'){
  box(-20,-4,40,23,'#354744');box(-17,-7,34,22,color,dark);box(-5,3,10,12,'#223e45');box(-13,-1,5,5,steel);box(8,-1,5,5,steel);
  polygon(ctx,[[-23,-7],[0,-20],[23,-7]],'#c6c6a7',dark);line([[0,-14],[0,-32]],'#f0e9ca');polygon(ctx,[[1,-32],[15,-27],[1,-22]],color);
  if(type==='post'){box(-20,8,12,9,dark);box(8,8,12,9,dark);}ctx.restore();return;
 }
 ctx.rotate(facing);
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
function terrainMinimapColor(type,map){return map==='desert'?({plain:'#c4b18a',forest:'#74764c',mountain:'#a89678'}[type]||TERRAIN[type].color):({plain:'#83936f',forest:'#48604b',mountain:'#92958a',river:'#4e8390',bridge:'#ad9875',road:'#b8a27b'}[type]||TERRAIN[type].color);}
function terrainVisualHash(seed,x,y){let n=(seed^Math.imul(x+1,0x9e3779b1)^Math.imul(y+1,0x85ebca6b))>>>0;n=Math.imul(n^(n>>>16),0x7feb352d);return(n^(n>>>15))>>>0;}
function terrainTopology(g,x,y,concealNeighbors=false){
 const type=g.terrain[KEY(x,y)],water=t=>t==='river'||t==='bridge',road=t=>t==='road'||t==='bridge';let roadMask=0,waterMask=0,sameMask=0;
 terrainNeighbors.forEach(([dx,dy],d)=>{if(!INSIDE(x+dx,y+dy)){sameMask|=1<<d;return;}const t=g.terrain[KEY(x+dx,y+dy)];if(d<4){if(road(t))roadMask|=1<<d;if(water(t))waterMask|=1<<d;}if(water(type)?water(t):road(type)?road(t):t===type)sameMask|=1<<d;});
 if(concealNeighbors){roadMask=0;terrainDirs.forEach(([dx,dy],d)=>{const nx=x+dx,ny=y+dy;if(INSIDE(nx,ny)&&g.explored.blue[KEY(nx,ny)]&&['road','bridge'].includes(g.terrain[KEY(nx,ny)]))roadMask|=1<<d;});if(!roadMask)roadMask=10;else if((roadMask&(roadMask-1))===0)roadMask|=((roadMask<<2)|(roadMask>>2))&15;waterMask=15;sameMask=255;}
 const horizontal=Number(!!(roadMask&2))+Number(!!(roadMask&8)),vertical=Number(!!(roadMask&1))+Number(!!(roadMask&4));return{roadMask,waterMask,sameMask,vertical:vertical>horizontal};
}
function terrainImageReady(name){const i=terrainImages[name];return !!(i?.complete&&i.naturalWidth);}
function clearTerrainCaches(){terrainTiles.clear();roadOverlays.clear();terrainMasks.clear();materialTiles.clear();fogTerrainCache=new WeakMap();}
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
 const required=[soil,...(['forest','mountain'].includes(type)?[vegetation]:[]),...(water?['water',bank]:[]),...(type==='road'?['road']:[]),...(type==='bridge'?['bridge']:[])];if(!required.every(terrainImageReady))return null;
 const phase=terrainVisualHash(g.seed,0,0),variant=terrainVisualHash(g.seed,x,y)%4,organic=['forest','mountain','river','bridge'].includes(type),key=[type,desert,organic?t.sameMask:0,type==='road'?t.roadMask:0,type==='bridge'?t.vertical:0,(x+(phase&1))&1,(y+((phase>>>1)&1))&1,organic?variant:0].join(':');
 if(terrainTiles.has(key))return terrainTiles.get(key);
 const tile=document.createElement('canvas');tile.width=tile.height=CELL;const c=tile.getContext('2d');c.drawImage(materialTile(soil,x,y,g.seed),0,0);
 if(type==='forest'||type==='mountain'){
  maskedMaterial(c,soil,x,y,g,t.sameMask,type,variant,type==='forest'?'#304b383d':'#7b77663b');
  maskedMaterial(c,vegetation,x,y,g,t.sameMask,type,variant);
 }else if(water){
  maskedMaterial(c,bank,x,y,g,t.sameMask,'shore',variant);maskedMaterial(c,'water',x,y,g,t.sameMask,'water',variant);
  if(type==='bridge'){c.save();c.translate(28,28);if(!t.vertical)c.rotate(Math.PI/2);c.drawImage(terrainImages.bridge,-28,-28,CELL,CELL);c.restore();}
 }else if(type==='road')c.drawImage(roadOverlay(t.roadMask),0,0);
 if(terrainTiles.size>=1024)terrainTiles.delete(terrainTiles.keys().next().value);terrainTiles.set(key,tile);return tile;
}
function terrainFallback(c,g,x,y,concealNeighbors=false){
 const type=g.terrain[KEY(x,y)],t=terrainTopology(g,x,y,concealNeighbors);c.fillStyle=terrainMinimapColor(type==='road'?'plain':type,g.map);c.fillRect(0,0,CELL,CELL);
 if(type==='forest')for(const [px,py,r]of [[16,17,11],[39,22,10],[25,39,12]]){c.fillStyle='#233f3650';c.beginPath();c.ellipse(px+2,py+3,r,r*.8,0,0,7);c.fill();c.fillStyle=g.map==='desert'?'#667148':'#4a6b4a';c.beginPath();c.arc(px,py,r,0,7);c.fill();}
 if(type==='mountain'){polygon(c,[[6,43],[17,12],[34,6],[48,38],[30,48]],g.map==='desert'?'#a79779':'#9b9d92');polygon(c,[[17,12],[34,6],[30,48]],'#c5c6b2');}
 if(type==='road'){c.lineCap=c.lineJoin='round';c.strokeStyle='#b9a27b';c.lineWidth=20;c.stroke(roadPath(t.roadMask));}
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
   if(capped)cached.items.push({x,y,clip,whole:['road','bridge'].includes(g.terrain[KEY(x,y)])});
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
function clampCamera(){const v=renderer.canvas,z=cam.zoom=Math.max(.35,Math.min(1.5,cam.zoom));for(const [axis,size,world]of [['x',v.clientWidth,COLS*CELL],['y',v.clientHeight,ROWS*CELL]]){const max=world-size/z;cam[axis]=max<0?max/2:Math.max(0,Math.min(max,cam[axis]));}renderer.dirty=true;}
function centerCamera(x,y){const v=renderer.canvas;cam.x=(x+.5)*CELL-v.clientWidth/cam.zoom/2;cam.y=(y+.5)*CELL-v.clientHeight/cam.zoom/2;clampCamera();}
function drawPreview(canvas,g){const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.save();c.scale(canvas.width/(COLS*CELL),canvas.height/(ROWS*CELL));renderTerrain(c,g);for(const u of g.structures){c.fillStyle=TEAM[u.owner];const n=u.type==='hq'?CELL*1.6:CELL;c.fillRect((u.x+.5)*CELL-n/2,(u.y+.5)*CELL-n/2,n,n);}c.restore();}

class Renderer{
 constructor(){this.canvas=$('battlefield');this.ctx=this.canvas.getContext('2d',{alpha:false});this.mini=$('minimap').getContext('2d');this.ground=document.createElement('canvas');this.ground.width=COLS*CELL;this.ground.height=ROWS*CELL;this.glow={small:glow(2.8),large:glow(4)};this.particles=[];this.texts=[];this.shake=0;this.dirty=true;this.rebuild();}
 paintGround(){const c=this.ground.getContext('2d');c.clearRect(0,0,this.ground.width,this.ground.height);renderTerrain(c,game);fogTerrainCache.delete(game);this.dirty=true;}
 rebuild(){this.paintGround();this.particles=[];this.texts=[];this.shake=0;}
 terrain(ctx,x,y,type,time,g=game){drawTerrainCell(ctx,g,x,y);}

 blast(x,y){
  for(let i=0;i<(reducedMotion?3:16);i++){const angle=Math.random()*Math.PI*2,v=15+Math.random()*95;this.particles.push({x:(x+.5)*CELL,y:(y+.5)*CELL,vx:Math.cos(angle)*v,vy:Math.sin(angle)*v,t:0,life:.4+Math.random()*.7,size:2+Math.random()*5,color:i%3?'#e8be76':'#8c9992'});}
  if(this.particles.length>320)this.particles.splice(0,this.particles.length-320);
 }
 consume(){
  for(const e of game.events.splice(0))if(e.visible){
   if(e.kind==='blast'){this.blast(e.x,e.y);if(e.heavy){audio.play('artillery');this.shake=reducedMotion?0:7;}}
   else if(e.kind==='shot'){audio.play(TYPES[e.weapon].tank||['artillery','antitank'].includes(e.weapon)?'tank':'infantry');if(TYPES[e.weapon].tank)this.shake=reducedMotion?0:4;}
   else if(e.kind==='ready')audio.play('purchase');
   else this.texts.push({...e,t:0});
  }if(this.texts.length>60)this.texts.splice(0,this.texts.length-60);
 }
 outline(x,y,color,width=2){const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.strokeRect(x*CELL+2,y*CELL+2,CELL-4,CELL-4);}
 area(x,y,alpha=.2){const c=this.ctx;c.save();for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++)if(INSIDE(xx,yy)){c.fillStyle=`rgba(242,174,94,${alpha})`;c.fillRect(xx*CELL+1,yy*CELL+1,CELL-2,CELL-2);this.outline(xx,yy,'#ffdc92',1.6);}c.restore();}
 bar(x,y,width,ratio,color){const c=this.ctx;c.fillStyle='#0b2028';c.fillRect(x-width/2-1,y-1,width+2,6);c.fillStyle=color;c.fillRect(x-width/2,y,width*Math.max(0,Math.min(1,ratio)),4);}
 entity(u,memory=false){
  const c=this.ctx,x=(u.x+.5)*CELL,y=(u.y+.5)*CELL,chosen=selection.has(u.id);c.save();
  if(memory)c.globalAlpha=.55;
  if(chosen){c.strokeStyle=u.owner==='blue'?'#c6eff6':TEAM[u.owner];c.lineWidth=2.5;c.beginPath();c.ellipse(x,y+8,24,20,0,0,Math.PI*2);c.stroke();}
  const stride=u.segment&&!reducedMotion?Math.sign(Math.sin(game.time*13+u.id))*2:0,firing=!memory&&u.cooldown>TYPES[u.type].cooldown-.12;
  const s=sprite(u.type,TEAM[u.owner],TYPES[u.type].structure?.83:.86,stride,firing);c.save();c.translate(x,y+2);if(!TYPES[u.type].structure)c.rotate(u.facing||0);c.drawImage(s,-s.ox,-s.oy);c.restore();
  if(!memory&&(chosen||u.hp<u.maxHp))this.bar(x,y+24,36,u.hp/u.maxHp,u.hp/u.maxHp>.45?'#b8dba5':'#f69d87');
  if(!memory&&!TYPES[u.type].structure){
   if(u.level>1||chosen){c.fillStyle='#ffde96';c.font='10px Segoe UI';c.textAlign='center';c.fillText('★'.repeat(u.level),x,y-22);}
   if(u.entrenched){c.strokeStyle='#c9e5e2';c.lineWidth=2;c.beginPath();c.arc(x,y+3,24,.1,Math.PI-.1);c.stroke();}
   if(chosen){c.fillStyle=(game.mode==='rts'?u.cooldown<=0:u.actionLeft)?'#b8e5bd':'#78858a';c.beginPath();c.arc(x+23,y-16,3,0,Math.PI*2);c.fill();}
  }
  if(!memory&&u.type==='hq'&&u.queue.length)this.bar(x,y+31,44,u.queue[0].progress/game.trainDuration(u.queue[0].type),'#edd098');
  c.restore();
 }
 draw(dt){
  const c=this.ctx,z=cam.zoom*(devicePixelRatio||1);c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.fillStyle='#20333d';c.fillRect(0,0,this.canvas.width,this.canvas.height);c.save();c.setTransform(z,0,0,z,-cam.x*z,-cam.y*z);
  if(this.shake>0&&dt>0&&!reducedMotion){c.translate((Math.random()-.5)*this.shake,(Math.random()-.5)*this.shake);this.shake=Math.max(0,this.shake-dt*25);}
  c.drawImage(this.ground,0,0);drawUnexploredTerrainEdges(c,game);
  for(const s of game.structures)if(game.isVisible('blue',s))this.entity(s);
  for(const [k,s]of game.memory.blue)if(!game.visible.blue[k])this.entity(s,true);
  // Névoa em quatro preenchimentos (um por cor) em vez de um por casa.
  const fog=[new Path2D(),new Path2D(),new Path2D(),new Path2D()];
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
   const k=KEY(x,y);if(!game.explored.blue[k]){fog[(x+y)%2].rect(x*CELL-1/z,y*CELL-1/z,CELL+2/z,CELL+2/z);fog[2].rect(x*CELL+26,y*CELL+26,3,3);}
   else if(!game.visible.blue[k])fog[3].rect(x*CELL,y*CELL,CELL,CELL);
  }
  ['#21333d','#21333d','#62768140','#10252daf'].forEach((color,i)=>{c.fillStyle=color;c.fill(fog[i]);});
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
  for(const u of game.units)if(u.owner==='blue'||game.isVisible('blue',u))this.entity(u);
  for(const p of game.projectiles){
   const t=Math.min(1,p.elapsed/p.duration),target=p.type==='artillery'?null:game.get(p.targetId),tx=target?.x??p.tx,ty=target?.y??p.ty;
   const gx=p.sx+(tx-p.sx)*t,gy=p.sy+(ty-p.sy)*t;if(p.owner!=='blue'&&!game.isVisible('blue',{x:gx,y:gy}))continue;
   const x=(gx+.5)*CELL,y=(gy+.5)*CELL-(p.type==='artillery'?Math.sin(Math.PI*t)*85:0),g=p.type==='artillery'?this.glow.large:this.glow.small;c.drawImage(g,x-g.width/2,y-g.height/2);
   if(p.type==='antitank'||p.type==='machinegun'){c.save();c.translate(x,y);c.rotate(Math.atan2(ty-p.sy,tx-p.sx));if(p.type==='antitank'){c.strokeStyle='#edb87388';c.lineWidth=3;c.beginPath();c.moveTo(-19,0);c.lineTo(-5,0);c.stroke();polygon(c,[[-5,-2],[4,-2],[8,0],[4,2],[-5,2]],'#e9ebe0');}else{c.fillStyle='#fff0b1';c.fillRect(-9,-1,12,2);}c.restore();}
  }
  let n=0;for(const p of this.particles){p.t+=dt;if(p.t>=p.life)continue;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy-=dt*12;c.globalAlpha=1-p.t/p.life;c.fillStyle=p.color;c.beginPath();c.arc(p.x,p.y,p.size*(1+p.t),0,7);c.fill();this.particles[n++]=p;}this.particles.length=n;
  c.font='bold 17px Segoe UI';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#14262c';
  n=0;for(const f of this.texts){f.t+=dt;if(f.t>=1.1)continue;c.globalAlpha=1-f.t/1.1;const x=(f.x+.5)*CELL,y=(f.y+.2)*CELL-f.t*25;c.strokeText(f.text,x,y);c.fillStyle=f.color;c.fillText(f.text,x,y);this.texts[n++]=f;}this.texts.length=n;c.globalAlpha=1;
  if(marker){marker.t+=dt;if(marker.t>.9)marker=null;else{c.strokeStyle=marker.color;c.lineWidth=2;c.beginPath();c.arc((marker.x+.5)*CELL,(marker.y+.5)*CELL,10+marker.t*12,0,7);c.stroke();}}
  if(drag?.active){const x=Math.min(drag.start.x,drag.end.x),y=Math.min(drag.start.y,drag.end.y),w=Math.abs(drag.end.x-drag.start.x),h=Math.abs(drag.end.y-drag.start.y);c.fillStyle='#99dfea22';c.strokeStyle='#c0f0ec';c.lineWidth=1.5;c.fillRect((x+.5)*CELL,(y+.5)*CELL,w*CELL,h*CELL);c.strokeRect((x+.5)*CELL,(y+.5)*CELL,w*CELL,h*CELL);}
  c.restore();
 }
 drawMini(){
  const c=this.mini,s=Math.min(c.canvas.width/COLS,c.canvas.height/ROWS);for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const k=KEY(x,y);c.fillStyle=game.explored.blue[k]?terrainMinimapColor(game.terrain[k],game.map):'#20333d';c.fillRect(x*s,y*s,s,s);if(game.explored.blue[k]&&!game.visible.blue[k]){c.fillStyle='#11232f99';c.fillRect(x*s,y*s,s,s);}}
  for(const u of game.all())if(u.owner==='blue'||game.isVisible('blue',u)){c.fillStyle=TEAM[u.owner];const n=u.type==='hq'?9:5;c.fillRect((u.x+.5)*s-n/2,(u.y+.5)*s-n/2,n,n);if(selection.has(u.id)){c.strokeStyle='#fff1bf';c.strokeRect((u.x+.5)*s-5,(u.y+.5)*s-5,10,10);}}
  const k=s/CELL;c.strokeStyle='#fff1bfcc';c.lineWidth=1.5;c.strokeRect(cam.x*k,cam.y*k,this.canvas.clientWidth/cam.zoom*k,this.canvas.clientHeight/cam.zoom*k);
 }
}
