'use strict';
function polygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
// Arte fornecida pelo jogador, preparada com transparência e incorporada para uso offline (npm run prepare:troops).
// Quadros: [coluna, y e altura aliados, y e altura inimigos] em pixels do original de 2172 px; escalados pela largura embutida.
const troopAtlas=new Image(),troopFrames={
 commander:[0,80,274,402,273],infantry:[1,74,289,400,279],engineer:[2,77,272,400,270],recon:[3,66,295,387,295],
 artillery:[5,62,298,383,295],antitank:[6,74,285,394,282],machinegun:[7,77,287,400,287]
};
const planeImages=Object.fromEntries(Object.keys(PLANE_MODELS).map(type=>[type,new Image()]));
function planeDrawSize(type,battle=true){return type.startsWith('bomber')?(battle?120:84):68;}
// Desenhos guardados ficam na memória comum: no Firefox, depois de um reset da GPU, canvas acelerados guardados voltavam pretos ou com lixo de outras janelas.
const CACHED={alpha:false,willReadFrequently:true};
let planeShadows=new WeakMap();
function planeShadow(image){if(!image?.complete||!image.naturalWidth)return null;let shadow=planeShadows.get(image);if(!shadow){shadow=document.createElement('canvas');shadow.width=shadow.height=256;const c=shadow.getContext('2d');c.drawImage(image,0,0,256,256);c.globalCompositeOperation='source-in';c.fillStyle='#10231e70';c.fillRect(0,0,256,256);const soft=document.createElement('canvas');soft.width=soft.height=256;const s=soft.getContext('2d');s.filter='blur(3px)';s.drawImage(shadow,0,0);shadow=soft;planeShadows.set(image,shadow);}return shadow;}
const airportImages={airportDirt:new Image(),airportAsphalt:new Image()};
const tankAtlas=new Image(),tankFrames={lightTank:0,tank:1,heavyTank:2},tankSizes={lightTank:48,tank:54,heavyTank:60};
// Helicópteros: atlas 3 × 2 (padrão, ar-terra, ar-ar; aliados, inimigos), quadros de 128 px apontados para o norte, rotor estático.
const heliAtlas=new Image(),heliFrames={helicopter:0,helicopterGround:1,helicopterAir:2};
const transportImages=Object.fromEntries(['transportTruck','transportHelicopter','transportPlane'].map(type=>[type,[new Image(),new Image()]]));
const transportSizes={transportTruck:56,transportHelicopter:76,transportPlane:96};
const antiAirAtlas=new Image(),highCloud=new Image(),antiAirFrames={antiAirVehicle:0,missileInfantry:1};
// Artilharia de mísseis e drone: um PNG 128 × 128 por equipe [aliado, inimigo], frente para cima.
const newTroopImages={rocketArtillery:[new Image(),new Image()],reconDrone:[new Image(),new Image()],stealthDrone:[new Image(),new Image()]},newTroopSizes={rocketArtillery:56,reconDrone:66,stealthDrone:60};
const rocketLauncherImages=Array.from({length:2},()=>[new Image(),new Image()]);
// França (azul): um PNG 128 × 128 por tipo, frente para cima; lançador do LRU: [transição, elevado]. Sem imagem cai na arte verde.
const franceImages=Object.fromEntries(Object.keys(franceSpriteData).map(type=>[type,new Image()])),franceLaunchImages=[new Image(),new Image()];
const FRANCE_SIZES={lightTank:48,tank:54,heavyTank:60,artillery:60,recon:52,antiAirVehicle:54,rocketArtillery:56,transportTruck:56,transportHelicopter:76,transportPlane:96,helicopter:62,helicopterGround:62,helicopterAir:62,reconDrone:66,stealthDrone:60};
const missileImages=Object.fromEntries(Object.keys(missileSpriteData).map(name=>[name,new Image()]));
const missileArt={antiAirVehicle:['anti-air',32],missileInfantry:['anti-air',24],atMissile:['air-ground',22],jetAgm:['air-ground',28],antiRadiation:['air-air',30],agm:['air-ground',28],aam:['air-air',28],jetAam:['air-air',28],rocket:['artillery-rocket',30],stealthMissile:['drone-missile',22],cruiseMissile:['cruise',42]};
const ambientClouds=Array.from({length:3},()=>new Image()),cloudShadows=[];
const battlefieldImages={hq:new Image(),post:new Image()},battlefieldClouds=Array.from({length:3},()=>new Image()),battlefieldCloudShadows=[],battlefieldTerrainImages={};
const GRAPHICS={performance:{clouds:0,visibleClouds:0,particles:80,interval:.3,alpha:0,light:.045},balanced:{clouds:32,visibleClouds:6,particles:200,interval:.18,alpha:.15,light:.075},cinematic:{clouds:64,visibleClouds:12,particles:400,interval:.1,alpha:.23,light:.11}};
function softLight(color,size=96){const s=document.createElement('canvas');s.width=s.height=size;const c=s.getContext('2d'),g=c.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);g.addColorStop(0,color);g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(0,0,size,size);return s;}
function localPlayerSide(g=game){return g.playerSide||'blue';}
function visualUnit(u){return u._renderPose?{...u,...u._renderPose}:u;}
function flightPose(u){const v=visualUnit(u),level=v._flightLevel??(AIR(v)?flightLevel(v):0);return{x:v.x,y:v.y-18*level/CELL,scale:1+.12*level,level};}
function radarView(){
 if(!started)return null;const active=game.units.filter(u=>u.owner===localPlayerSide()&&(u.type==='antiAirVehicle'&&u.radarOn||PLANE(u)&&UT(u).radar&&AIR(u))&&u.hp>0).sort((a,b)=>a.id-b.id);if(!active.length)return null;
 const selected=selectedUnits().filter(u=>u.type==='antiAirVehicle'&&u.hp>0).sort((a,b)=>a.id-b.id);
 return{source:selected[0]||active[0],contacts:game.units.filter(u=>u.owner!==localPlayerSide()&&u.hp>0&&AIR(u)&&game.isVisible(localPlayerSide(),u))};
}
// art: 0 = arte azul, 1 = arte vermelha (a facção da unidade); sem ele vale a cor do dono, como antes.
function unitIcon(ctx,type,x,y,color,scale=1,facing=0,stride=0,firing=false,launcherFrame=0,battle=false,art){
 const red=art===undefined?color===TEAM.red:art===1;
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineWidth=1.6;ctx.lineCap='round';ctx.lineJoin='round';
 const dark='#10282e',steel='#a7b6ac',gold='#efd094';
 const box=(x,y,w,h,fill,stroke)=>{ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);if(stroke){ctx.strokeStyle=stroke;ctx.strokeRect(x,y,w,h);}};
 const oval=(x,y,rx,ry,fill,stroke)=>{ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}};
 const line=(points,color,width=2)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.stroke();ctx.lineWidth=1.6;};
 if(!TYPES[type].air&&!battle)oval(2,7,TYPES[type].vehicle?22:17,TYPES[type].vehicle?19:13,'#081b2270');
 if(TYPES[type].airport||type==='airportSite'){const im=airportImages[type],h=48*TYPES[type].height/TYPES[type].width;if(im?.complete&&im.naturalWidth)ctx.drawImage(im,-24,-h/2,48,h);else{box(-24,-13,48,26,'#a69470',dark);box(-22,-6,44,12,'#6d604b');}box(18,-h/2,5,4,color,dark);ctx.restore();return;}
 if(type==='hq'||type==='post'){
  box(-20,-4,40,23,'#354744');box(-17,-7,34,22,color,dark);box(-5,3,10,12,'#223e45');box(-13,-1,5,5,steel);box(8,-1,5,5,steel);
  polygon(ctx,[[-23,-7],[0,-20],[23,-7]],'#c6c6a7',dark);line([[0,-14],[0,-32]],'#f0e9ca');polygon(ctx,[[1,-32],[15,-27],[1,-22]],color);
  if(type==='post'){box(-20,8,12,9,dark);box(8,8,12,9,dark);}ctx.restore();return;
 }
 ctx.rotate(facing);
 if(art===2&&type in franceImages){
  const image=type==='rocketArtillery'&&launcherFrame?franceLaunchImages[launcherFrame-1]:franceImages[type],size=type==='transportPlane'&&!battle?64:FRANCE_SIZES[type]||60,air=TYPES[type].air;
  if(image?.complete&&image.naturalWidth){
   if(!air)ctx.translate(0,stride*.6+(firing?1.5:0));
   ctx.drawImage(image,-size/2,-size/2,size,size);
   if(firing&&!air)polygon(ctx,[[-2,-size/2+2],[-5,-size/2-3],[0,-size/2-10],[5,-size/2-3],[2,-size/2+2]],'#f8cc76');
   ctx.restore();return;
  }
 }
 if(type in transportImages){const size=type==='transportPlane'&&!battle?64:transportSizes[type],im=transportImages[type][red?1:0];if(im.complete&&im.naturalWidth)ctx.drawImage(im,-size/2,-size/2,size,size);else if(type==='transportTruck'){for(const xx of [-17,12])for(const yy of [-18,-3,12])box(xx,yy,5,9,dark);box(-12,-23,24,45,color,dark);box(-10,-17,20,7,steel);box(-10,-3,20,23,'#53614c',dark);}else if(type==='transportHelicopter'){oval(0,0,12,28,color,dark);line([[-32,-14],[32,-14]],steel,3);line([[-32,14],[32,14]],steel,3);}else{polygon(ctx,[[0,-40],[8,-15],[44,-4],[44,5],[8,3],[5,28],[20,32],[20,37],[-20,37],[-20,32],[-5,28],[-8,3],[-44,5],[-44,-4],[-8,-15]],color,dark);}ctx.restore();return;}
 if(TYPES[type].plane){const im=planeImages[type],size=planeDrawSize(type,battle);if(im.complete&&im.naturalWidth)ctx.drawImage(im,-size/2,-size/2,size,size);else{if(battle)ctx.scale(size/68,size/68);polygon(ctx,[[0,-28],[25,16],[0,8],[-25,16]],color,dark);}ctx.restore();return;}
 if(type in newTroopImages){
  const size=newTroopSizes[type],team=red?1:0;let image=newTroopImages[type][team];
  if(type==='rocketArtillery'&&launcherFrame){const pose=rocketLauncherImages[team][launcherFrame-1];if(pose?.complete&&pose.naturalWidth)image=pose;}
  if(type==='rocketArtillery')ctx.translate(0,stride*.6+(firing?1:0));
  if(image.complete&&image.naturalWidth)ctx.drawImage(image,-size/2,-size/2,size,size);
  else if(type==='rocketArtillery'){for(const xx of [-17,12])for(const yy of [-18,-3,12])box(xx,yy,5,9,dark);box(-12,-22,24,40,color,dark);box(-10,-4,20,20,'#43534e',dark);for(let i=0;i<3;i++)for(let j=0;j<2;j++)oval(-6+i*6,2+j*7,2.2,2.2,steel);}
  else if(type==='stealthDrone')polygon(ctx,[[0,-26],[29,17],[0,7],[-29,17]],'#50575c',dark);
  else{line([[-30,2],[30,2]],color,5);line([[-9,20],[9,20]],color,3);box(-3,-18,6,40,color,dark);oval(0,-14,4,6,'#24444b',dark);}
  if(firing&&type==='rocketArtillery')for(const x of [-7,7])polygon(ctx,[[x-2,2],[x-4,-2],[x,-7],[x+4,-2],[x+2,2]],'#f8cc76');
  ctx.restore();return;
 }
 if(type in antiAirFrames){
  const size=type==='antiAirVehicle'?54:47;
  if(antiAirAtlas.complete&&antiAirAtlas.naturalWidth){const cell=antiAirAtlas.naturalWidth/2;ctx.translate(0,stride*.6+(firing?1:0));ctx.drawImage(antiAirAtlas,antiAirFrames[type]*cell,red?cell:0,cell,cell,-size/2,-size/2,size,size);}
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
  if(heliAtlas.complete&&heliAtlas.naturalWidth){const cell=heliAtlas.naturalWidth/3;ctx.drawImage(heliAtlas,heliFrames[type]*cell,red?cell:0,cell,cell,-size/2,-size/2,size,size);}
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
  ctx.translate(0,stride*.6+(firing?1.5:0));ctx.drawImage(tankAtlas,tankFrames[type]*cell,red?cell:0,cell,cell,-size/2,-size/2,size,size);
  if(firing)polygon(ctx,[[-2,-size/2+2],[-5,-size/2-3],[0,-size/2-10],[5,-size/2-3],[2,-size/2+2]],'#f8cc76');
  ctx.restore();return;
 }
 if(!TYPES[type].tank&&troopFrames[type]&&troopAtlas.complete&&troopAtlas.naturalWidth){
  const frame=troopFrames[type],enemy=red,k=troopAtlas.naturalWidth/2172,w=troopAtlas.naturalWidth/8,sy=frame[enemy?3:1]*k,h=frame[enemy?4:2]*k,fit=60/Math.max(w,h),dw=w*fit,dh=h*fit;
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
// Arte da facção: 0 = verde (padrão), 1 = vermelha, 2 = França (azul).
const ART={red:1,[FRANCE]:2},unitArt=u=>ART[KIT(u)]||0,sideArt=side=>ART[game.factions?.[side]||side]||0;
function sprite(type,color,scale,stride=0,firing=false,launcherFrame=0,battle=false,art){
 const key=type+color+scale+':'+stride+':'+firing+':'+launcherFrame+':'+battle+':'+art;let s=sprites.get(key);
 if(!s){const plane=TYPES[type].plane&&battle,extent=plane?planeDrawSize(type)/2+8:0,ox=Math.ceil((plane?extent:TYPES[type].plane?52:38)*scale),oy=Math.ceil((plane?extent:50)*scale);s=document.createElement('canvas');s.width=ox*2;s.height=plane?oy*2:Math.ceil(82*scale);unitIcon(s.getContext('2d'),type,ox,oy,color,scale,0,stride,firing,launcherFrame,battle,art);s.ox=ox;s.oy=oy;if(sprites.size>=512)sprites.delete(sprites.keys().next().value);sprites.set(key,s);}
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
function fieldPatchIds(g,known){
 const ids=new Int32Array(SIZE).fill(-1);
 for(let k=0;k<SIZE;k++){
  if(ids[k]>=0||known&&!known[k]||g.terrain[k]!=='field')continue;
  const stack=[k];ids[k]=k;
  while(stack.length){const c=stack.pop(),cx=c%COLS,cy=(c-cx)/COLS;for(const [dx,dy]of terrainDirs){const nx=cx+dx,ny=cy+dy,n=KEY(nx,ny);if(INSIDE(nx,ny)&&ids[n]<0&&(!known||known[n])&&g.terrain[n]==='field'){ids[n]=k;stack.push(n);}}}
 }
 return ids;
}
function fieldStyle(g,x,y,conceal=false,patches){
 let ids=patches;
 if(!ids){
  if(conceal)ids=fieldPatchIds(g,g.explored[localPlayerSide(g)]);
  else{ids=fieldPatches.get(g);if(!ids){ids=fieldPatchIds(g);fieldPatches.set(g,ids);}}
 }
 const k=KEY(x,y),root=ids[k]<0?k:ids[k],h=terrainVisualHash(g.seed,root%COLS,(root-root%COLS)/COLS),palette=CROPS[g.map==='desert'?'desert':'temperate'];
 return{color:palette[h%palette.length],vertical:!!((h>>>4)&1)};
}
function terrainVisualHash(seed,x,y){let n=(seed^Math.imul(x+1,0x9e3779b1)^Math.imul(y+1,0x85ebca6b))>>>0;n=Math.imul(n^(n>>>16),0x7feb352d);return(n^(n>>>15))>>>0;}
function terrainTopology(g,x,y,concealNeighbors=false){
 const type=g.terrain[KEY(x,y)],water=t=>t==='river'||t==='bridge',road=t=>t==='road'||t==='bridge';let roadMask=0,waterMask=0,sameMask=0;
 terrainNeighbors.forEach(([dx,dy],d)=>{if(!INSIDE(x+dx,y+dy)){sameMask|=1<<d;return;}const t=g.terrain[KEY(x+dx,y+dy)];if(d<4){if(road(t))roadMask|=1<<d;if(water(t))waterMask|=1<<d;}if(water(type)?water(t):road(type)?road(t):t===type)sameMask|=1<<d;});
 if(concealNeighbors){roadMask=0;terrainDirs.forEach(([dx,dy],d)=>{const nx=x+dx,ny=y+dy;if(INSIDE(nx,ny)&&g.explored[localPlayerSide(g)][KEY(nx,ny)]&&['road','bridge'].includes(g.terrain[KEY(nx,ny)]))roadMask|=1<<d;});if(!roadMask)roadMask=10;else if((roadMask&(roadMask-1))===0)roadMask|=((roadMask<<2)|(roadMask>>2))&15;waterMask=15;sameMask=255;}
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
function materialTile(name,x,y,seed,battle=false){
 const phase=terrainVisualHash(seed,0,0),px=(x+(phase&1))&1,py=(y+((phase>>>1)&1))&1,variant=battle?terrainVisualHash(seed,(x+(phase&1))>>1,(y+((phase>>>1)&1))>>1)%4:0,key=(battle?'battle:':'')+name+':'+px+py+':'+variant;
 if(materialTiles.has(key))return materialTiles.get(key);
 const tile=document.createElement('canvas');tile.width=tile.height=CELL;const c=tile.getContext('2d'),period=CELL*2;
 const enhanced=battlefieldTerrainImages[name],image=battle&&enhanced?.complete&&enhanced.naturalWidth?enhanced:terrainImages[name];
 for(let yy=-py*CELL;yy<CELL;yy+=period)for(let xx=-px*CELL;xx<CELL;xx+=period)c.drawImage(image,xx,yy,period,period);
 if(battle&&variant){c.globalCompositeOperation='source-atop';c.fillStyle=name.startsWith('forest')?['','#66813b14','#324f4220','#b1a57012'][variant]:['','#c6bdad12','#4a59651a','#6c594914'][variant];c.fillRect(0,0,CELL,CELL);}
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
function maskedMaterial(c,name,x,y,g,mask,kind,variant,tint,battle=false){
 const layer=document.createElement('canvas');layer.width=layer.height=CELL;const q=layer.getContext('2d');q.drawImage(materialTile(name,x,y,g.seed,battle),0,0);
 if(tint){q.fillStyle=tint;q.fillRect(0,0,CELL,CELL);}q.globalCompositeOperation='destination-in';q.drawImage(terrainMask(mask,kind,variant),0,0);c.drawImage(layer,0,0);
}
function roadPath(mask){
 const path=new Path2D(),ends=terrainDirs.filter((_,d)=>mask&(1<<d)).map(([dx,dy])=>[CELL/2+CELL/2*dx,CELL/2+CELL/2*dy]);
 if(ends.length===2&&mask!==5&&mask!==10){path.moveTo(...ends[0]);path.bezierCurveTo(28,28,28,28,...ends[1]);}
 else if(ends.length){for(const end of ends){path.moveTo(28,28);path.lineTo(...end);}}
 else{path.moveTo(28,28);path.lineTo(28.01,28);}return path;
}
function roadOverlay(mask,battle=false){
 const key=(battle?'battle:':'')+mask;if(!terrainImageReady('road'))return null;if(roadOverlays.has(key))return roadOverlays.get(key);
 const tile=document.createElement('canvas');tile.width=tile.height=CELL;const c=tile.getContext('2d'),path=roadPath(mask);c.lineCap=c.lineJoin='round';
 c.lineWidth=24;c.strokeStyle='#a995724d';c.stroke(path);c.lineWidth=20;c.strokeStyle='#b9a27b';c.stroke(path);c.lineWidth=18;c.strokeStyle=c.createPattern(materialTile('road',0,0,0),'repeat');c.stroke(path);
 if(battle){c.lineWidth=12;c.strokeStyle='#4c392c20';c.stroke(path);c.lineWidth=9;c.strokeStyle='#e5d2ae20';c.stroke(path);c.setLineDash([3,5]);c.lineWidth=1;c.strokeStyle='#41352a25';c.stroke(path);}
 roadOverlays.set(key,tile);return tile;
}
function terrainTile(g,x,y,concealNeighbors=false,patches,battle=false){
 const type=g.terrain[KEY(x,y)],desert=g.map==='desert',soil=desert?'sand':'plain',vegetation=type+(desert?'-desert':''),bank=desert?'bank-desert':'bank',water=type==='river'||type==='bridge';
 const t=terrainTopology(g,x,y,concealNeighbors);
 const bush=desert?'forest-desert':'forest',required=[soil,...(['forest','mountain'].includes(type)?[vegetation]:[]),...(type==='hedge'?[bush]:[]),...(water?['water',bank]:[]),...(type==='road'?['road']:[]),...(type==='bridge'?['bridge']:[])];if(!required.every(terrainImageReady))return null;
 // A chave só distingue o que muda os pixels: campo e sebe usam só as quatro bordas (drawCrops/drawHedge) e a variante do material só importa em floresta, montanha e sebe. Um mapa inteiro cabe em ~3,5 mil tiles em vez de ~7 mil.
 const crop=type==='field'?fieldStyle(g,x,y,concealNeighbors,patches):null,phase=terrainVisualHash(g.seed,0,0),variant=terrainVisualHash(g.seed,x,y)%4,organic=['forest','mountain','river','bridge','hill','hedge','field'].includes(type),materialVariant=battle?terrainVisualHash(g.seed,(x+(phase&1))>>1,(y+((phase>>>1)&1))>>1)%4:0,key=[battle,type,desert,organic?(type==='field'||type==='hedge'?t.sameMask&15:t.sameMask):0,type==='road'?t.roadMask:0,type==='bridge'?t.vertical:0,(x+(phase&1))&1,(y+((phase>>>1)&1))&1,organic||battle?variant:0,['forest','mountain','hedge'].includes(type)?materialVariant:0,crop?crop.color+crop.vertical:''].join(':');
 if(terrainTiles.has(key)){const cached=terrainTiles.get(key);terrainTiles.delete(key);terrainTiles.set(key,cached);return cached;}
 const tile=document.createElement('canvas');tile.width=tile.height=CELL;const c=tile.getContext('2d');c.drawImage(materialTile(soil,x,y,g.seed),0,0);
 if(type==='forest'||type==='mountain'){
  maskedMaterial(c,soil,x,y,g,t.sameMask,type,variant,type==='forest'?(battle?'#253a2b2b':'#304b383d'):'#7b77663b');
  maskedMaterial(c,vegetation,x,y,g,t.sameMask,type,variant,undefined,battle);
 }else if(water){
  maskedMaterial(c,bank,x,y,g,t.sameMask,'shore',variant);maskedMaterial(c,'water',x,y,g,t.sameMask,'water',variant);
  if(type==='bridge'){c.save();c.translate(28,28);if(!t.vertical)c.rotate(Math.PI/2);c.drawImage(terrainImages.bridge,-28,-28,CELL,CELL);c.restore();}
 }else if(type==='road'){c.drawImage(roadOverlay(t.roadMask,battle),0,0);if(desert){c.lineCap=c.lineJoin='round';c.lineWidth=18;c.strokeStyle='#5b46304d';c.stroke(roadPath(t.roadMask));}}
 else if(type==='field')drawCrops(c,crop,t.sameMask);
 else if(type==='hedge')drawHedge(c,t.sameMask&15,c.createPattern(materialTile(bush,x,y,g.seed,battle),'repeat'));
 else if(type==='hill')drawHill(c,t.sameMask,variant,desert);
 if(battle){c.save();c.globalAlpha=.035+(variant*.008);c.fillStyle=desert?'#6a5030':'#203724';for(let i=0;i<7;i++){const h=terrainVisualHash(variant+17,i,39);if(!['river','bridge','forest','mountain'].includes(type))c.fillRect(h%CELL,(h>>>8)%CELL,1+(h%3),1);}c.restore();if(type==='field'){c.fillStyle='#f6edb514';for(let i=3;i<CELL;i+=7)crop.vertical?c.fillRect(i,0,1,CELL):c.fillRect(0,i,CELL,1);}}
 // 4096 tiles keep the visible terrain at minimum zoom cached (~49 MiB maximum). O uso recente move o tile para o fim do Map, então sai o menos usado.
 if(terrainTiles.size>=4096)terrainTiles.delete(terrainTiles.keys().next().value);terrainTiles.set(key,tile);return tile;
}
function terrainFallback(c,g,x,y,concealNeighbors=false,patches){
 const type=g.terrain[KEY(x,y)],t=terrainTopology(g,x,y,concealNeighbors);c.fillStyle=terrainMinimapColor(type==='road'?'plain':type,g.map);c.fillRect(0,0,CELL,CELL);
 if(type==='forest')for(const [px,py,r]of [[16,17,11],[39,22,10],[25,39,12]]){c.fillStyle='#233f3650';c.beginPath();c.ellipse(px+2,py+3,r,r*.8,0,0,7);c.fill();c.fillStyle=g.map==='desert'?'#667148':'#4a6b4a';c.beginPath();c.arc(px,py,r,0,7);c.fill();}
 if(type==='mountain'){polygon(c,[[6,43],[17,12],[34,6],[48,38],[30,48]],g.map==='desert'?'#a79779':'#9b9d92');polygon(c,[[17,12],[34,6],[30,48]],'#c5c6b2');}
 if(type==='road'){c.lineCap=c.lineJoin='round';c.strokeStyle='#b9a27b';c.lineWidth=20;c.stroke(roadPath(t.roadMask));}
 if(type==='field')drawCrops(c,fieldStyle(g,x,y,concealNeighbors,patches),t.sameMask);
 if(type==='hedge'){c.fillStyle=terrainMinimapColor('plain',g.map);c.fillRect(0,0,CELL,CELL);drawHedge(c,t.sameMask&15,g.map==='desert'?'#6f7146':'#3f5e3c');}
 if(type==='hill')drawHill(c,t.sameMask,terrainVisualHash(g.seed,x,y)%4,g.map==='desert');
 if(type==='river'||type==='bridge'){c.strokeStyle='#b1ced05c';c.beginPath();c.moveTo(5,20);c.bezierCurveTo(16,14,35,26,51,20);c.stroke();if(type==='bridge'){c.save();c.translate(28,28);if(!t.vertical)c.rotate(Math.PI/2);c.fillStyle='#b4a080';c.fillRect(-10,-28,20,56);c.strokeStyle='#574d3b';for(let yy=-26;yy<28;yy+=7){c.beginPath();c.moveTo(-10,yy);c.lineTo(10,yy);c.stroke();}c.restore();}}
}
function drawTerrainCell(c,g,x,y,battle=false){const tile=terrainTile(g,x,y,false,undefined,battle);if(tile){c.drawImage(tile,x*CELL,y*CELL);return;}c.save();c.translate(x*CELL,y*CELL);terrainFallback(c,g,x,y);c.restore();}
function renderTerrain(c,g){for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)drawTerrainCell(c,g,x,y);}
function drawUnexploredTerrainEdges(c,g){
 let cached=fogTerrainCache.get(g),changed=!cached;if(cached)for(let k=0;k<SIZE;k++)if(cached.known[k]!==Number(g.explored[localPlayerSide(g)][k])){changed=true;break;}
 if(changed){
  cached={known:Uint8Array.from(g.explored[localPlayerSide(g)],Number),items:[]};
  // Reuse explored crop components until the fog changes, instead of traversing each border cell every frame.
  cached.fields=fieldPatchIds(g,cached.known);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(g.explored[localPlayerSide(g)][KEY(x,y)]){
   const clip=new Path2D();let capped=false;
   terrainNeighbors.forEach(([dx,dy],d)=>{if(!INSIDE(x+dx,y+dy)||g.explored[localPlayerSide(g)][KEY(x+dx,y+dy)])return;capped=true;
    if(d<4)clip.rect(x*CELL+(d===1?CELL-20:0),y*CELL+(d===2?CELL-20:0),d%2?20:CELL,d%2?CELL:20);
    else clip.rect(x*CELL+(dx>0?CELL-20:0),y*CELL+(dy>0?CELL-20:0),20,20);
   });
   if(capped)cached.items.push({x,y,clip,whole:['road','bridge','hedge','field'].includes(g.terrain[KEY(x,y)])});
  }fogTerrainCache.set(g,cached);
 }
 const bounds=viewCells();for(const {x,y,clip,whole}of cached.items){if(x<bounds.x0||x>=bounds.x1||y<bounds.y0||y>=bounds.y1)continue;const tile=terrainTile(g,x,y,true,cached.fields,true);c.save();if(!whole)c.clip(clip);c.translate(x*CELL,y*CELL);if(tile)c.drawImage(tile,0,0);else terrainFallback(c,g,x,y,true,cached.fields);c.restore();}
}
function viewCells(){return{x0:Math.max(0,Math.floor(cam.x/CELL)-1),y0:Math.max(0,Math.floor(cam.y/CELL)-1),x1:Math.min(COLS,Math.ceil((cam.x+renderer.canvas.clientWidth/cam.zoom)/CELL)+1),y1:Math.min(ROWS,Math.ceil((cam.y+renderer.canvas.clientHeight/cam.zoom)/CELL)+1)};}
function miniTransform(canvas){const s=Math.min(canvas.width/COLS,canvas.height/ROWS);return{s,ox:(canvas.width-COLS*s)/2,oy:(canvas.height-ROWS*s)/2};}
function drawTerrainGrid(c,g,z){
 const {x0,y0,x1,y1}=viewCells(),path=new Path2D();for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(g.explored[localPlayerSide(g)][KEY(x,y)])path.rect(x*CELL,y*CELL,CELL,CELL);
 c.save();c.strokeStyle='#162d304d';c.lineWidth=1/z;c.stroke(path);c.restore();
}

/* Câmera em pixels do mundo (CELL por casa); zoom 1 = 56 px por casa na tela. */
const cam={x:0,y:0,zoom:1};
// Folga em pixels de tela abaixo do mapa: a última fileira pode subir acima da faixa de baixo (grupos, barra de comando, minimapa).
const cameraFoot=()=>Math.max(110,(document.querySelector('.hud-row')?.offsetHeight||0)+16);
function cameraViewport(){const v=renderer.canvas;return {width:v.clientWidth,height:Math.max(1,v.clientHeight-cameraFoot())};}
// Zoom mínimo: o que enquadra o mapa inteiro na área útil do campo (nunca acima do máximo; o piso evita zoom zero com o canvas oculto).
const MAX_ZOOM=1.5,minZoom=()=>{const v=cameraViewport();return Math.min(MAX_ZOOM,Math.max(.05,Math.min(v.width/(COLS*CELL),v.height/(ROWS*CELL))));};
function clampCamera(){const v=cameraViewport(),z=cam.zoom=Math.max(minZoom(),Math.min(MAX_ZOOM,cam.zoom));for(const [axis,size,cells]of [['x',v.width,COLS],['y',v.height,ROWS]]){const map=cells*CELL,span=size/z;
 // Se o mapa cabe inteiro neste eixo, ele fica centralizado; senão a câmera pode ir até meia casa além da borda, como antes.
 cam[axis]=span>=map?(map-span)/2:Math.max(CELL/2-span/2,Math.min((cells-.5)*CELL-span/2,cam[axis]));}renderer.dirty=true;}
function centerCamera(x,y){const v=cameraViewport();cam.x=(x+.5)*CELL-v.width/cam.zoom/2;cam.y=(y+.5)*CELL-v.height/cam.zoom/2;clampCamera();}
function drawPreview(canvas,g){const c=canvas.getContext('2d'),{s,ox,oy}=miniTransform(canvas);c.fillStyle='#20333d';c.fillRect(0,0,canvas.width,canvas.height);c.save();c.translate(ox,oy);for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){c.fillStyle=terrainMinimapColor(g.terrain[KEY(x,y)],g.map);c.fillRect(x*s,y*s,s+.2,s+.2);}for(const u of g.structures){c.fillStyle=TEAM[u.owner];c.fillRect(u.x*s,u.y*s,Math.max(3,(u.width||1)*s),Math.max(3,(u.height||1)*s));}c.restore();}

class Renderer{
 constructor(){this.canvas=$('battlefield');this.ctx=this.canvas.getContext('2d',{alpha:false});this.mini=$('minimap').getContext('2d');this.glow={small:glow(2.8),large:glow(4)};this.contactShadow=softLight('#07130e70');this.airShadow=softLight('#071c2c54');this.lighting=new Map();this.fx=new BattlefieldFX(this);this.particles=[];this.texts=[];this.shake=0;this.dirty=true;this.rebuild();}
 paintGround(){
  fieldPatches.delete(game);fogTerrainCache.delete(game);this.terrainViewKey=null;this.groundOverview=null;this.miniTerrain=null;this.groundChunks=new Map();this.dirty=true;
  clearTimeout(this.groundTimer);if(this.groundJob)this.groundJob.resolve(false);
  const job={game,indices:Array.from({length:Math.ceil(COLS/16)*Math.ceil(ROWS/16)},(_,i)=>i),index:0,cell:0};this.groundJob=job;this.groundReady=new Promise(resolve=>job.resolve=resolve);
  this.groundTimer=setTimeout(()=>this.prepareGround(job),0);
 }
 invalidateGround(cells){
  const indices=new Set(),columns=Math.ceil(COLS/16);for(const p of cells)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(INSIDE(p.x+dx,p.y+dy))indices.add(Math.floor((p.y+dy)/16)*columns+Math.floor((p.x+dx)/16));
  for(const i of indices)this.groundChunks.delete(i);this.terrainViewKey=null;this.dirty=true;
  for(const [image,mini]of [[this.groundOverview,false],[this.miniTerrain,true]])if(image){const c=image.getContext('2d'),t=mini?miniTransform(image):{s:1,ox:0,oy:0};c.save();c.setTransform(1,0,0,1,0,0);for(const p of cells){c.fillStyle=terrainMinimapColor(game.terrain[KEY(p.x,p.y)],game.map);c.fillRect(t.ox+p.x*t.s,t.oy+p.y*t.s,t.s,t.s);}c.restore();}
  clearTimeout(this.groundTimer);if(this.groundJob){for(const i of this.groundJob.indices.slice(this.groundJob.index))indices.add(i);this.groundJob.resolve(false);}
  const job={game,indices:[...indices],index:0,cell:0};this.groundJob=job;this.groundReady=new Promise(resolve=>job.resolve=resolve);this.groundTimer=setTimeout(()=>this.prepareGround(job),0);
 }
 prepareGround(job){
  if(this.groundJob!==job||job.game!==game)return;
  const columns=Math.ceil(COLS/16),total=job.indices.length,deadline=performance.now()+3;
  // ponytail: 28 px/cell caps all 128x96 blocks at 37 MiB; add eviction if maps grow.
  while(job.index<total&&performance.now()<deadline){
   const chunk=job.indices[job.index],bx=chunk%columns,by=Math.floor(chunk/columns),x0=bx*16,y0=by*16,w=Math.min(16,COLS-x0),h=Math.min(16,ROWS-y0);
   if(!job.cell){job.image=document.createElement('canvas');job.image.width=w*28;job.image.height=h*28;job.ctx=job.image.getContext('2d',CACHED);job.ctx.setTransform(.5,0,0,.5,-x0*28,-y0*28);}
   drawTerrainCell(job.ctx,job.game,x0+job.cell%w,y0+Math.floor(job.cell/w),true);job.cell++;
   if(job.cell===w*h){this.groundChunks.set(chunk,job.image);job.index++;job.cell=0;this.terrainViewKey=null;this.dirty=true;}
  }
  if(job.index<total)this.groundTimer=setTimeout(()=>this.prepareGround(job),8);
  else{this.groundJob=null;job.resolve(true);}
 }
 groundOverviewImage(){
  if(!this.groundOverview){const image=this.groundOverview=document.createElement('canvas');image.width=COLS;image.height=ROWS;const c=image.getContext('2d',CACHED);for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){c.fillStyle=terrainMinimapColor(game.terrain[KEY(x,y)],game.map);c.fillRect(x,y,1,1);}}
  return this.groundOverview;
 }
 rebuild(){this.paintGround();this.particles=[];this.texts=[];this.shake=0;this.ambientParticles=[];this.ambientTick=-1;this.graphics=null;this.environmentClip=null;this.fx.reset();}
 terrain(ctx,x,y,type,time,g=game){drawTerrainCell(ctx,g,x,y);}
 cloudPose(slot,time){
  const base=GRAPHICS[settings.graphics]||GRAPHICS.balanced,hash=terrainVisualHash(game.seed,slot,47),high=settings.graphics==='cinematic'&&slot%2===0,width=340+(hash%270)+(high?140:0),height=width*.5;
  const wrap=(position,span,pad)=>((position+pad)%span+span)%span-pad;
  return {x:wrap((slot%8+.5)*COLS*CELL/8+(hash%140)-width/2+time*(high?20:12),COLS*CELL+width*2,width),y:wrap((Math.floor(slot/8)+.5)*ROWS*CELL/(base.clouds/8)+(hash%130)-65+time*(high?3:2),ROWS*CELL+height*2,height),width,height,high};
 }
 environment(dt){
  const c=this.ctx,profile=this.fx.profile(),base=GRAPHICS[settings.graphics]||GRAPHICS.balanced,time=reducedMotion?0:this.fx.time;
  this.ambientParticles=settings.graphics==='performance'||reducedMotion?[]:this.fx.particles;this.graphics=settings.graphics;
  const w=this.canvas.clientWidth/cam.zoom,h=this.canvas.clientHeight/cam.zoom,{x0,y0,x1,y1}=viewCells(),vision=this.frameVision||this.visionMasks(),key=[cam.x,cam.y,cam.zoom,w,h,vision.revision].join(':');
  if(this.environmentClip?.key!==key){const clip=new Path2D();for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(game.visible[localPlayerSide()][KEY(x,y)])clip.rect(x*CELL,y*CELL,CELL,CELL);this.environmentClip={key,clip};}
  const visible=(x,y)=>INSIDE(Math.floor(x/CELL),Math.floor(y/CELL))&&game.visible[localPlayerSide()][KEY(Math.floor(x/CELL),Math.floor(y/CELL))],onScreen=(x,y,pad=60)=>x>=cam.x-pad&&x<=cam.x+w+pad&&y>=cam.y-pad&&y<=cam.y+h+pad;
  c.save();c.clip(this.environmentClip.clip);
  c.globalAlpha=base.light;c.drawImage(this.lightLayer(false),cam.x,cam.y,w,h);
  if(settings.graphics==='cinematic'){c.globalAlpha=.17*profile.factor;c.drawImage(this.lightLayer(true),cam.x-(reducedMotion?0:Math.sin(time*.07)*w*.035),cam.y,w*1.08,h);}
  // Reflexos ficam restritos à água; fases são derivadas da semente visual, sem RNG do combate.
  if(base.clouds)for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(game.visible[localPlayerSide()][KEY(x,y)]&&game.terrain[KEY(x,y)]==='river'){
   const hash=terrainVisualHash(game.seed,x,y),phase=time*.65+(hash%100)/16;c.strokeStyle='#d4eef0';c.globalAlpha=.12+.035*Math.sin(phase);c.lineWidth=1.2;c.beginPath();
   for(let i=0;i<3;i++){const px=x*CELL+10+((hash>>>(i*3))%18),py=y*CELL+12+i*14+Math.sin(phase+i)*2;c.moveTo(px,py);c.lineTo(px+11,py-1);}c.stroke();
  }
  // Bancos de nuvens espaçados pelo mapa; recorte na visão e descarte fora da câmera.
  let clouds=0;for(let slot=0;slot<base.clouds&&clouds<profile.clouds;slot++){
   const {x,y,width:cw,height:ch,high}=this.cloudPose(slot,time);
   if(!onScreen(x+cw/2,y+ch/2,cw/2))continue;clouds++;const enhanced=battlefieldClouds[slot%3],image=enhanced.complete&&enhanced.naturalWidth?enhanced:ambientClouds[slot%3],shadow=battlefieldCloudShadows[slot%3]||cloudShadows[slot%3];
   if(image.complete&&image.naturalWidth){if(shadow){c.globalAlpha=high?.085:.06;c.drawImage(shadow,x+40,y+48,cw*1.06,ch*1.08);}c.globalAlpha=base.alpha*(high?.8:1);c.drawImage(image,x,y,cw,ch);}
   else{c.globalAlpha=profile.alpha*.7;c.fillStyle='#dce9ed';c.beginPath();for(let n=0;n<4;n++)c.ellipse(x+cw*(.2+n*.2),y+ch*.5,cw*.17,ch*.18,0,0,7);c.fill();}
  }
  this.visibleClouds=clouds;c.globalAlpha=1;
  // Turbulência dos rotores baixos: somente decorativa, sem modificar o terreno.
  if(base.clouds)for(const u of game.units)if(AIR(u)&&!PLANE(u)&&flightLevel(u)<1){const x=(u.x+.5)*CELL,y=(u.y+.5)*CELL;if(!visible(x,y)||!onScreen(x,y))continue;c.globalAlpha=.13*(1-flightLevel(u));c.strokeStyle=game.terrainAt(u)==='river'?'#c6e9ed':'#d0c59f';c.lineWidth=1;const radius=23+(reducedMotion?0:Math.sin(time*4+u.id)*3);c.beginPath();c.ellipse(x,y+9,radius,radius*.45,0,0,7);c.stroke();}
  c.restore();
 }
 lightLayer(rays){
  const key=game.map+':'+rays;if(this.lighting.has(key))return this.lighting.get(key);
  const s=document.createElement('canvas');s.width=s.height=512;const c=s.getContext('2d');
  if(rays){for(let i=0;i<5;i++){const x=-180+i*125,g=c.createLinearGradient(x,0,x+280,512);g.addColorStop(0,'#fff2cd00');g.addColorStop(.35,'#fff1c3aa');g.addColorStop(1,'#fff4d800');c.fillStyle=g;c.beginPath();c.moveTo(x,0);c.lineTo(x+35,0);c.lineTo(x+440,512);c.lineTo(x+280,512);c.fill();}}
  else{const g=c.createLinearGradient(0,0,512,512);g.addColorStop(0,game.map==='desert'?'#ffe4a7':game.map==='mountain'?'#c9deed':'#e8e9c8');g.addColorStop(.5,'#ffffff15');g.addColorStop(1,game.map==='desert'?'#463a28':game.map==='mountain'?'#273d50':'#263d32');c.fillStyle=g;c.fillRect(0,0,512,512);}
  this.lighting.set(key,s);return s;
 }

 consume(){
  for(const e of game.events.splice(0))if(e.visible){
   this.fx.consume(e);
   if(e.kind==='terrainChanged')this.invalidateGround(e.cells);
   else if(e.kind==='defenseSmoke'){for(let i=0;i<12;i++)this.particles.push({x:(e.x+.5)*CELL,y:(e.y+.5)*CELL,vx:(i%4-1.5)*12,vy:Math.floor(i/4)*-8,t:0,life:3,size:12,color:'#c7c8bc',smoke:true,air:false});}
   else if(e.kind==='touchdown'){if(!reducedMotion)for(const side of [-1,1])for(let i=0;i<3;i++){const f=e.facing||0,px=Math.cos(f)*side*10,py=Math.sin(f)*side*10;this.particles.push({x:(e.x+.5)*CELL+px,y:(e.y+.5)*CELL+py,vx:-Math.sin(f)*(8+i*4),vy:-Math.cos(f)*(8+i*4)-4-i*2,t:0,life:.9,size:4+i,color:'#d9dcd6',smoke:true,air:false,sourceId:e.id});}}
   else if(e.kind==='smoke'){this.particles.push({x:(e.x+.5)*CELL,y:(e.y+.5)*CELL-18*e.flightLevel,lift:18*e.flightLevel,contactId:e.contactId,sourceId:e.sourceId,publicMissile:!!e.publicMissile,vx:2,vy:-3,t:0,life:1.2,size:3,color:'#b5bdbe',smoke:true,air:e.air});}
   else if(e.kind==='flare'){
    const n=e.count||5;for(let i=0;i<n;i++){const k=i-(n-1)/2,dx=(e.decoy.x-e.x)*CELL,dy=(e.decoy.y-e.y)*CELL;this.particles.push({x:(e.x+.5)*CELL,y:(e.y+.5)*CELL-18*e.flightLevel,lift:18*e.flightLevel,contactId:e.contactId,vx:dx*(.8+i*.08*5/n)+k*13*(n>5?2:1),vy:dy*(.8+i*.08*5/n)-k*9*(n>5?2:1),t:0,life:n>5?1.2+i%5*.2:1.2,size:n>5?3:2.5,color:'#ffe6ad',flare:true,air:true});}
    if(selection.has(e.id)||game.units.some(u=>selection.has(u.id)&&AIR(u)&&Math.hypot(u.x-e.x,u.y-e.y)<.1))say('Salva de flares lançada. Um míssil protegido; recarga defensiva iniciada.');
   }
   else if(e.kind==='blast'){if(e.heavy){audio.play('artillery');this.shake=reducedMotion?0:7;}}
   else if(e.kind==='shot'){audio.play(TYPES[e.weapon].tank||['artillery','antitank'].includes(e.weapon)?'tank':'infantry');if(TYPES[e.weapon].tank)this.shake=reducedMotion?0:4;}
   else if(e.kind==='ready')audio.play('purchase');
   else this.texts.push({...e,t:0});
  }if(this.texts.length>60)this.texts.splice(0,this.texts.length-60);if(this.particles.length>640)this.particles.splice(0,this.particles.length-640);
 }
 outline(x,y,color,width=2){const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.strokeRect(x*CELL+2,y*CELL+2,CELL-4,CELL-4);}
 area(x,y,alpha=.2){const c=this.ctx;c.save();for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++)if(INSIDE(xx,yy)){c.fillStyle=`rgba(242,174,94,${alpha})`;c.fillRect(xx*CELL+1,yy*CELL+1,CELL-2,CELL-2);this.outline(xx,yy,'#ffdc92',1.6);}c.restore();}
 // Contador de mísseis da unidade (só as suas): cor muda com pouca munição e sem munição, como os avisos flutuantes.
 ammoBadge(x,y,u){if(u.owner!==localPlayerSide())return;const l=game.missileLoad(u);if(!l)return;const c=this.ctx,text=l.have+'/'+l.max,color=l.have===0?'#f26d5b':l.have<=Math.max(1,Math.floor(l.max/4))?'#ffdc92':'#dde6cf';c.save();c.font='bold 11px Segoe UI';c.textAlign='left';const w=c.measureText(text).width+18,x0=x-w/2;c.fillStyle='#0b2028cc';c.fillRect(x0,y+32,w,14);c.fillStyle=color;c.fillRect(x0+4,y+35,2.5,7);c.beginPath();c.moveTo(x0+3,y+35);c.lineTo(x0+5.25,y+31.5);c.lineTo(x0+7.5,y+35);c.fill();c.fillText(text,x0+11,y+43);c.restore();}
 bar(x,y,width,ratio,color){const c=this.ctx;c.fillStyle='#0b2028';c.fillRect(x-width/2-1,y-1,width+2,6);c.fillStyle=color;c.fillRect(x-width/2,y,width*Math.max(0,Math.min(1,ratio)),4);}
 transportAnimation(c,u,x,y,scale){
  if(u.type!=='transportHelicopter'&&u.type!=='transportPlane'||KIT(u)===FRANCE)return;c.save();c.translate(x,y+2);c.rotate(u.facing||0);c.scale(scale*.86,scale*.86);c.strokeStyle='#b4c0b6';c.lineWidth=1.8;
  const angle=reducedMotion?0:game.time*18,rotors=u.type==='transportHelicopter'?(KIT(u)==='blue'?[[0,-15,29],[0,15,29]]:[[0,-2,31]]):[[-29,-6,7],[-15,-6,7],[15,-6,7],[29,-6,7]];
  c.globalAlpha=reducedMotion?.55:.4;for(const [dx,dy,r]of rotors){c.save();c.translate(dx,dy);c.rotate(angle);for(let i=0;i<3;i++){c.rotate(Math.PI*2/3);c.beginPath();c.moveTo(0,0);c.lineTo(r,0);c.stroke();}c.restore();}c.restore();
 }
 drawDrops(c){
  for(const d of game.drops||[]){if(d.owner!==localPlayerSide()&&!game.visible[localPlayerSide()][KEY(d.x,d.y)])continue;const height=(1-Math.min(1,d.elapsed/2))*48,x=(d.x+.5)*CELL,y=(d.y+.5)*CELL-height;
   c.save();c.translate(x,y);const vehicle=TYPES[d.passenger.type].vehicle;if(vehicle){c.fillStyle='#6a5943';c.strokeStyle='#c6bda2';c.fillRect(-23,3,46,31);c.strokeRect(-23,3,46,31);}unitIcon(c,d.passenger.type,0,12,TEAM[d.owner],vehicle?.7:.6,0,0,false,0,false,unitArt(d.passenger.faction?d.passenger:d));
   c.strokeStyle='#e1d8bb';c.lineWidth=1;for(const dx of [-22,-11,11,22]){c.beginPath();c.moveTo(dx,-24);c.lineTo(0,12);c.stroke();}c.fillStyle=d.owner==='blue'?'#d5dcc6':'#dcb5ab';c.strokeStyle='#394a40';c.lineWidth=1.5;c.beginPath();c.arc(0,-24,24,Math.PI,Math.PI*2);c.closePath();c.fill();c.stroke();for(const dx of [-12,0,12]){c.beginPath();c.moveTo(dx,-24);c.quadraticCurveTo(dx*.7,-46,0,-48);c.stroke();}c.restore();
  }
 }
 entity(u,memory=false){
  if(!memory)u=visualUnit(u);
  const c=this.ctx,x=(u.x+.5)*CELL,groundY=(u.y+.5)*CELL,pose=flightPose(u),y=(pose.y+.5)*CELL,chosen=selection.has(u.id);c.save();
  if(memory)c.globalAlpha=.55;
  if(u.width){
   const w=u.width*CELL,h=u.height*CELL,px=u.x*CELL,py=u.y*CELL,airport=AIRPORT(u)||u.type==='airportSite',im=airport?airportImages[u.type]:battlefieldImages[u.type],barWidth=Math.min(120,w-24);
   if(!airport){c.save();c.globalAlpha*=.65;c.drawImage(this.contactShadow,px+4,py+h*.25+8,w,h*.85);c.restore();}
   if(im?.complete&&im.naturalWidth)c.drawImage(im,px,py,w,h);
   else if(!airport){const s=sprite(u.type,TEAM[u.owner],1,0,false,0,true,unitArt(u));c.drawImage(s,px,py,w,h);}
   else{c.fillStyle=u.type==='airportSite'?'#ab906155':'#aa9572';c.fillRect(px+2,py+2,w-4,h-4);c.strokeStyle='#e6dfc2';c.setLineDash([14,10]);c.beginPath();c.moveTo(px+22,py+h/2);c.lineTo(px+w-22,py+h/2);c.stroke();c.setLineDash([]);}
   // Dano, antena e bandeira seguem o relógio visual; estruturas lembradas na névoa, movimento reduzido e Desempenho ficam em pose fixa.
   const still=memory||reducedMotion||settings.graphics==='performance',art=im?.complete&&im.naturalWidth;
   if(!memory&&art)this.fx.drawDamage(c,u,still,im);
   if(!airport&&art)this.fx.antenna(c,u,still);
   if(airport){c.fillStyle=TEAM[u.owner];c.fillRect(px+w-48,py+6,40,8);}else this.fx.flag(c,px+w/2-14,py+6,TEAM[u.owner],u.id,still);
   if(chosen||u.type==='airportSite'){c.strokeStyle=chosen?TEAM[u.owner]:'#d5bd8b';c.lineWidth=chosen?3:1;c.strokeRect(px+2,py+2,w-4,h-4);}
   if(!memory&&(chosen||u.hp<u.maxHp))this.bar(px+w/2,py+h-9,barWidth,u.hp/u.maxHp,'#b8dba5');
   if(u.type==='airportSite')this.bar(px+w/2,py+h-20,barWidth,(u.work||0)/game.airportDuration(u),'#efd094');
   if(!memory&&u.queue?.length)this.bar(px+w/2,py+(airport?16:18),barWidth,u.queue[0].progress/game.trainDuration(u.queue[0].type),'#edd098');c.restore();return;
  }
  if(!memory&&(AIR(u)||PLANE(u))){
   c.save();c.globalAlpha=1-pose.level*.4;const shadow=PLANE(u)&&planeShadow(planeImages[u.type]);if(shadow){const size=planeDrawSize(u.type)*.86*(1-pose.level*.15);c.translate(x+pose.level*12,groundY+2+pose.level*12);c.rotate(u.facing||0);c.drawImage(shadow,-size/2,-size/2,size,size);}else c.drawImage(this.airShadow,x-22+pose.level*12,groundY+pose.level*12,58+pose.level*12,32);c.restore();
   if(pose.level>0&&settings.graphics!=='performance'){c.save();c.globalAlpha=.12*pose.level;if(highCloud.complete&&highCloud.naturalWidth)c.drawImage(highCloud,x-38,groundY-31,76,76);else{c.fillStyle='#e7edf1';for(const [dx,dy]of [[-25,12],[25,-5],[-16,-22]]){c.beginPath();c.ellipse(x+dx,groundY+dy,14,7,0,0,7);c.fill();}}c.restore();}
   c.strokeStyle=TEAM[u.owner]+'aa';c.lineWidth=1.6;c.setLineDash([3,4]);c.beginPath();c.ellipse(x,groundY+2,pose.level>0?18:25,pose.level>0?12:25,0,0,7);c.stroke();c.setLineDash([]);
   if(chosen&&pose.level>0){c.strokeStyle='#c6eff6aa';c.lineWidth=1;c.beginPath();c.moveTo(x,groundY);c.lineTo(x,y);c.stroke();}
  }
  else if(!memory){const size=UT(u).structure?62:UT(u).vehicle?50:33;c.drawImage(this.contactShadow,x-size/2+4,groundY-size*.23+8,size,size*.55);}
  if(chosen){c.strokeStyle=TEAM[u.owner];c.lineWidth=2.5;c.beginPath();c.ellipse(x,y+8,24*pose.scale,20*pose.scale,0,0,Math.PI*2);c.stroke();}
  if(!memory&&!reducedMotion&&u.runway&&['takeoffRoll','landingRoll'].includes(u.flightState)&&game.get(u.runway.baseId)?.type==='airportDirt'){c.save();c.fillStyle='#bba278';c.globalAlpha=.17;for(let i=1;i<=3;i++){c.beginPath();c.ellipse(x-i*12,groundY+4+Math.sin(game.time*6+i)*4,7+i*3,4+i,0,0,Math.PI*2);c.fill();}c.restore();}
  const stride=u.segment&&!reducedMotion?Math.sign(Math.sin(game.time*13+u.id))*2:0,firing=!memory&&u.cooldown>(u.reload??UT(u).cooldown)-.12;
  const launcherFrame=!memory&&u.type==='rocketArtillery'?(reducedMotion?((u.launcherLevel||0)>0?2:0):Math.round((u.launcherLevel||0)*2)):0;
  if(!memory&&PLANE(u)&&!UT(u).airdropPlane)this.fx.exhaust(c,u);
  const image=battlefieldImages[u.type],recoil=this.fx.recoil(u);c.save();c.translate(x+recoil.x,y+2+recoil.y);c.scale(pose.scale,pose.scale);
  if(image?.complete&&image.naturalWidth){const size=u.type==='hq'?56:48;c.drawImage(image,-size/2,-size/2,size,size);c.fillStyle=TEAM[u.owner];c.fillRect(-size/2+2,-size/2+1,13,4);c.fillStyle='#152720';c.fillRect(-size/2+1,-size/2,1,10);}
  else{const s=sprite(u.type,TEAM[u.owner],UT(u).structure?.83:.86,stride,firing,launcherFrame,true,unitArt(u));if(!UT(u).structure)c.rotate(u.facing||0);c.drawImage(s,-s.ox,-s.oy);}c.restore();
  if(!memory)this.transportAnimation(c,u,x,y,pose.scale);
  if(u.type==='transportHelicopter'&&!UT(u).seats&&(u.cargo||[]).some(p=>!FOOT(p))){
   const sway=reducedMotion?0:Math.sin(game.time*2.2+u.id)*1.5,hx=x+sway,hy=y+42*pose.scale,s=sprite((u.cargo||[]).find(p=>!FOOT(p)).type,TEAM[u.owner],.85*pose.scale,0,false,0,true,unitArt(u));
   c.save();c.strokeStyle='#2a3430';c.lineWidth=1.4;for(const dx of [-9,9]){c.beginPath();c.moveTo(x+dx*.6*pose.scale,y+6);c.lineTo(hx+dx*.8*pose.scale,hy-8);c.stroke();}
   c.translate(hx,hy);c.rotate(u.facing||0);c.drawImage(s,-s.ox,-s.oy);c.restore();
  }
  if(!memory&&game.radarContact(localPlayerSide(),u)){const r=32*pose.scale;c.strokeStyle='#102a1c';c.lineWidth=4;c.strokeRect(x-r,y-r,r*2,r*2);c.strokeStyle='#68ef8d';c.lineWidth=1.8;c.strokeRect(x-r,y-r,r*2,r*2);}
  if(!memory&&(chosen||u.hp<u.maxHp))this.bar(x,y+24,36,u.hp/u.maxHp,u.hp/u.maxHp>.45?'#b8dba5':'#f69d87');
  if(!memory)this.ammoBadge(x,y,u);
  if(!memory&&!UT(u).structure){
   if(AIR(u)&&(u.altitude==='high'||u.order.type==='altitude')){const transition=u.order.type==='altitude',label=transition?(u.order.altitude==='high'?'SUBINDO':'DESCENDO'):'ALTA',width=transition?66:32;c.font='bold 9px Segoe UI';c.textAlign='center';c.fillStyle='#132a35';c.fillRect(x-width/2,y-46,width,14);c.fillStyle='#e4f1f5';c.fillText(label,x,y-36);if(transition)this.bar(x,y-30,width,Math.min(1,(u.altitudeTransition?.returning?0:u.altitudeTransition?.elapsed||0)/ALTITUDE_TIME),'#92dae4');}
   if(u.level>1||chosen){c.fillStyle='#ffde96';c.font='10px Segoe UI';c.textAlign='center';c.fillText('★'.repeat(u.level),x,y-22);}
   if(u.suppressed>0){c.strokeStyle='#f6a08c';c.lineWidth=2;c.beginPath();for(const dx of [-7,1]){c.moveTo(x+dx,y-36);c.lineTo(x+dx+3,y-31);c.lineTo(x+dx+6,y-36);}c.stroke();}
   if(u.entrenched){c.strokeStyle='#c9e5e2';c.lineWidth=2;c.beginPath();c.arc(x,y+3,24,.1,Math.PI-.1);c.stroke();}
   if(chosen){c.fillStyle=(game.mode==='rts'?u.cooldown<=0:u.actionLeft)?'#b8e5bd':'#78858a';c.beginPath();c.arc(x+23,y-16,3,0,Math.PI*2);c.fill();}
  }
  if(!memory&&UT(u).structure&&u.queue?.length)this.bar(x,y+31,44,u.queue[0].progress/game.trainDuration(u.queue[0].type),'#edd098');
  c.restore();
 }
 // O terreno visível fica em cache do tamanho da tela. Ao mover a câmera, a camada anterior é deslocada em pixels inteiros e só as faixas expostas são repintadas.
 paintGroundCells(q,z,ox,oy,rects){
  // A suavização das bordas de uma casa vaza no máximo 2 px para a vizinha: 3 px de folga bastam, em vez de uma casa inteira.
  const size=CELL*z,pad=3,spans=rects.map(([sx,sy,sw,sh])=>[Math.max(0,Math.floor((sx+ox-pad)/size)),Math.min(COLS,Math.ceil((sx+sw+ox+pad)/size)),Math.max(0,Math.floor((sy+oy-pad)/size)),Math.min(ROWS,Math.ceil((sy+sh+oy+pad)/size))]).sort((a,b)=>a[0]-b[0]);
  q.setTransform(z,0,0,z,-ox,-oy);
  if(cam.zoom<=.65){
   q.imageSmoothingEnabled=false;q.drawImage(this.groundOverviewImage(),0,0,COLS*CELL,ROWS*CELL);q.imageSmoothingEnabled=true;
   const columns=Math.ceil(COLS/16),blocks=new Set();
   for(const [xa,xb,ya,yb] of spans)for(let by=Math.floor(ya/16);by<Math.ceil(yb/16);by++)for(let bx=Math.floor(xa/16);bx<Math.ceil(xb/16);bx++)blocks.add(by*columns+bx);
   for(const index of [...blocks].sort((a,b)=>a-b)){const image=this.groundChunks.get(index);if(image)q.drawImage(image,index%columns*16*CELL,Math.floor(index/columns)*16*CELL,image.width*2,image.height*2);}
   return;
  }
  // Linha a linha, na mesma ordem de uma repintura completa, para que as bordas suavizadas sejam compostas igual.
  const top=Math.min(...spans.map(s=>s[2])),bottom=Math.max(...spans.map(s=>s[3]));
  for(let y=top;y<bottom;y++){let done=0;for(const [xa,xb,ya,yb] of spans){if(y<ya||y>=yb)continue;for(let x=Math.max(xa,done);x<xb;x++)drawTerrainCell(q,game,x,y,true);done=Math.max(done,xb);}}
 }
 drawGround(c,z){
  const W=this.canvas.width,H=this.canvas.height,ox=Math.round(cam.x*z),oy=Math.round(cam.y*z),key=this.terrainViewKey,same=!!key&&key[0]===game&&key[1]===z&&key[2]===W&&key[3]===H;
  if(!same||key[4]!==ox||key[5]!==oy){
   const dx=same?ox-key[4]:0,dy=same?oy-key[5]:0,layer=this.terrainView||(this.terrainView=document.createElement('canvas'));
   if(!this.terrainBack)this.terrainBack=document.createElement('canvas');
   if(same&&Math.min(W,Math.abs(dx))*H+Math.min(H,Math.abs(dy))*W-Math.min(W,Math.abs(dx))*Math.min(H,Math.abs(dy))<W*H*.6){
    // Faixas expostas pintadas sem recorte na camada de trás; a camada anterior, opaca e deslocada, cobre o restante.
    const back=this.terrainBack;if(back.width!==W)back.width=W;if(back.height!==H)back.height=H;
    const q=back.getContext('2d',{alpha:false}),strips=[];
    if(dx)strips.push(dx>0?[W-dx,0,dx,H]:[0,0,-dx,H]);if(dy)strips.push(dy>0?[0,H-dy,W,dy]:[0,0,W,-dy]);
    q.setTransform(1,0,0,1,0,0);q.fillStyle='#20333d';for(const r of strips)q.fillRect(r[0],r[1],r[2],r[3]);
    this.paintGroundCells(q,z,ox,oy,strips);
    q.setTransform(1,0,0,1,0,0);q.drawImage(layer,-dx,-dy);
    this.terrainView=back;this.terrainBack=layer;
   }else{
    if(layer.width!==W)layer.width=W;if(layer.height!==H)layer.height=H;
    const q=layer.getContext('2d',{alpha:false});q.setTransform(1,0,0,1,0,0);q.fillStyle='#20333d';q.fillRect(0,0,W,H);
    this.paintGroundCells(q,z,ox,oy,[[0,0,W,H]]);
   }
   this.terrainViewKey=[game,z,W,H,ox,oy];
  }
  // Cache only the screen-sized terrain; fog and moving entities stay in the live draw. A origem inteira mantém terreno e unidades no mesmo pixel.
  const t=c.getTransform();c.save();c.setTransform(1,0,0,1,t.e+ox,t.f+oy);c.drawImage(this.terrainView,0,0);c.restore();
 }
 visionMasks(){
  let state=this.visionMask;if(!state||state.game!==game){state=this.visionMask={game,bits:new Uint8Array(SIZE).fill(2),revision:0};for(const [name,color]of [['field',[16,37,45,175]],['mini',[17,35,47,153]]]){const canvas=state[name]=document.createElement('canvas');canvas.width=COLS;canvas.height=ROWS;const ctx=canvas.getContext('2d'),data=ctx.createImageData(COLS,ROWS);for(let k=0;k<SIZE;k++)data.data.set(color,k*4);state[name+'Data']=data;}}
  let changed=false;for(let k=0;k<SIZE;k++){const visible=game.visible[localPlayerSide()][k]?1:0;if(state.bits[k]!==visible){state.bits[k]=visible;state.fieldData.data[k*4+3]=visible?0:175;state.miniData.data[k*4+3]=visible?0:153;changed=true;}}
  if(changed){state.revision++;state.field.getContext('2d').putImageData(state.fieldData,0,0);state.mini.getContext('2d').putImageData(state.miniData,0,0);}return state;
 }
 draw(dt){
  const began=performance.now();
  this.drawRadar();
  dt=game.mode==='rts'||game.busy||game.projectiles.length?dt:0;this.fx.advance(dt);this.frameVision=this.visionMasks();
  const c=this.ctx,z=cam.zoom*(devicePixelRatio||1);c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.fillStyle='#20333d';c.fillRect(0,0,this.canvas.width,this.canvas.height);c.save();c.setTransform(z,0,0,z,-Math.round(cam.x*z),-Math.round(cam.y*z));
  if(this.shake>0&&dt>0&&!reducedMotion){c.translate((Math.random()-.5)*this.shake,(Math.random()-.5)*this.shake);this.shake=Math.max(0,this.shake-dt*25);}
  const {x0,y0,x1,y1}=viewCells();this.drawGround(c,z);
  this.fx.ground(c);
  for(const s of game.memory[localPlayerSide()].values())if(!game.isVisible(localPlayerSide(),s))this.entity(s,true);
  this.environment(dt);for(const f of game.fires)if(game.visible[localPlayerSide()][KEY(f.x,f.y)]){c.fillStyle='#ec813d88';c.beginPath();c.ellipse((f.x+.5)*CELL,(f.y+.5)*CELL,15,9,0,0,7);c.fill();}
  c.save();c.imageSmoothingEnabled=false;c.drawImage(this.frameVision.field,0,0,COLS*CELL,ROWS*CELL);c.restore();
  this.fx.draw(c);this.drawDrops(c);
  for(const s of game.structures)if(game.isVisible(localPlayerSide(),s))this.entity(s);
  if(game.mission)Missions.draw(c,game);
  if(showGrid)drawTerrainGrid(c,game,z);
  for(const id of selection){const u=game.get(id);if(!u||u.owner!==localPlayerSide()||UT(u).structure)continue;
   c.strokeStyle='#a6e1e477';c.lineWidth=1.3;c.setLineDash([5,5]);c.beginPath();c.moveTo((u.x+.5)*CELL,(u.y+.5)*CELL);if(u.segment)c.lineTo((u.segment.to.x+.5)*CELL,(u.segment.to.y+.5)*CELL);for(const p of u.path)c.lineTo((p.x+.5)*CELL,(p.y+.5)*CELL);c.stroke();c.setLineDash([]);
   if(game.turn===localPlayerSide()){const target=game.get(u.order.targetId),goal=u.order.goal||(target&&game.isVisible(localPlayerSide(),target)?TILE(target):u.order.last);if(goal)this.outline(goal.x,goal.y,['attack','attackMove'].includes(u.order.type)?'#f9b09a':'#b8e5e6',2);}
   if(u.order.type==='bombard'&&u.order.cell)this.area(u.order.cell.x,u.order.cell.y,.08);
   if(u.flightJob?.weapon==='cruiseMissile'&&u.flightJob.cell)this.area(u.flightJob.cell.x,u.flightJob.cell.y,.08);
   if(u.type==='commander'){c.strokeStyle='#e9cf8944';c.lineWidth=2;{const r=(UT(u).aura??2)*CELL,cx=(u.x+.5)*CELL,cy=(u.y+.5)*CELL;polygon(c,[[cx,cy-r],[cx+r,cy],[cx,cy+r],[cx-r,cy]],'#edd0980d','#edd09855');}}
  }
  for(const m of game.mines)if(m.known[localPlayerSide()]&&game.explored[localPlayerSide()][KEY(m.x,m.y)]){polygon(c,[[(m.x+.5)*CELL,m.y*CELL+18],[m.x*CELL+42,m.y*CELL+42],[m.x*CELL+14,m.y*CELL+42]],'#d8bc77','#4d513d');c.fillStyle='#39403b';c.font='bold 17px sans-serif';c.textAlign='center';c.fillText('!',(m.x+.5)*CELL,m.y*CELL+37);}
  if(hover&&INSIDE(Math.round(hover.x),Math.round(hover.y))&&game.explored[localPlayerSide()][KEY(Math.round(hover.x),Math.round(hover.y))])this.outline(Math.round(hover.x),Math.round(hover.y),'#e9eac56b',1.2);
  if(hover){const target=entityAt(hover),art=selectedUnits().find(u=>u.type==='artillery');if(art&&target&&game.canFire(art,target)){const p=TILE(target);this.area(p.x,p.y,.12);}}
  // Bombardear área: prévia 3×3 em qualquer casa, inclusive sob névoa; contorno vermelho fora do alcance 3–30 de todas as selecionadas.
  if(hover&&mode==='buildAirport'){const p=TILE(hover),info=game.airportBuildInfo(p);c.save();c.strokeStyle=info.valid?'#a8e4b7':'#f26d5b';c.lineWidth=3;c.strokeRect(p.x*CELL,p.y*CELL,6*CELL,2*CELL);c.setLineDash([6,5]);c.strokeRect((p.x-2)*CELL,p.y*CELL,2*CELL,2*CELL);c.strokeRect((p.x+6)*CELL,p.y*CELL,2*CELL,2*CELL);c.font='bold 14px Segoe UI';c.fillStyle=c.strokeStyle;c.textAlign='left';c.fillText('Construção: '+(game.mode==='rts'?info.duration+' s':info.duration/10+' turnos'),p.x*CELL,p.y*CELL-8);c.restore();}
  if(hover&&mode==='airdropLine'&&bombLineStart){const end=TILE(hover),len=DIST(bombLineStart,end),valid=game.bombLine(localPlayerSide(),bombLineStart,end);c.save();c.strokeStyle=valid?'#9fe0a5':'#f26d5b';c.lineWidth=3;c.setLineDash([10,8]);c.beginPath();c.moveTo((bombLineStart.x+.5)*CELL,(bombLineStart.y+.5)*CELL);c.lineTo((end.x+.5)*CELL,(end.y+.5)*CELL);c.stroke();c.setLineDash([]);for(let i=0;i<=Math.min(128,len);i++){const t=i/Math.max(1,len);this.outline(Math.round(bombLineStart.x+(end.x-bombLineStart.x)*t),Math.round(bombLineStart.y+(end.y-bombLineStart.y)*t),valid?'#9fe0a5':'#f26d5b',1.6);}c.restore();}
  for(const plane of game.units)if(UT(plane).airdropPlane&&plane.owner===localPlayerSide()&&plane.airdrop?.phase==='run'&&plane.airdrop.line){const L=plane.airdrop.line;c.save();c.strokeStyle='#9fe0a5aa';c.lineWidth=2.5;c.setLineDash([8,8]);c.beginPath();c.moveTo((L.start.x+.5)*CELL,(L.start.y+.5)*CELL);c.lineTo((L.end.x+.5)*CELL,(L.end.y+.5)*CELL);c.stroke();c.restore();}
  if(hover&&mode==='planeBomb'&&bombLineStart){const end=TILE(hover),len=DIST(bombLineStart,end),valid=game.bombLine(localPlayerSide(),bombLineStart,end);c.strokeStyle=valid?'#ffdc92':'#f26d5b';c.lineWidth=3;c.beginPath();c.moveTo((bombLineStart.x+.5)*CELL,(bombLineStart.y+.5)*CELL);c.lineTo((end.x+.5)*CELL,(end.y+.5)*CELL);c.stroke();for(let i=0;i<=Math.min(128,len);i++){const t=i/Math.max(1,len);this.area(Math.round(bombLineStart.x+(end.x-bombLineStart.x)*t),Math.round(bombLineStart.y+(end.y-bombLineStart.y)*t),.08);}}
  // Marca de aposta: Investida sobre uma casa na névoa (âmbar com munição de solo, vermelha sem ela).
  this.betMark=null;if(hover&&mode==='attack'){const p=TILE(hover);if(INSIDE(p.x,p.y)&&!game.visible[localPlayerSide()][KEY(p.x,p.y)]){const planes=selectedUnits().filter(u=>supportsOrder(u,'strikeCell'));if(planes.length){this.betMark={x:p.x,y:p.y};this.outline(p.x,p.y,planes.some(u=>u.ammo.jetAgm>0||u.ammo.jetGun>0)?'#ffdc92':'#f26d5b',3);}}}
  if(hover&&mode==='bombard'){const p=TILE(hover);if(INSIDE(p.x,p.y)){this.area(p.x,p.y,.16);if(!selectedUnits().some(u=>game.canBombard(u,p)))this.outline(p.x,p.y,'#f26d5b',3);}}
  if(hover&&mode==='attack'&&cruiseUnits().length){const p=TILE(hover);if(INSIDE(p.x,p.y)){const units=cruiseUnits(),inRange=units.some(u=>AIR(u)&&u.ammo.cruiseMissile>0&&DIST(u,p)<=game.weaponRange(u,'cruiseMissile'));this.area(p.x,p.y,.18);this.outline(p.x,p.y,inRange?'#a8e4b7':'#ffdc92',3);c.fillStyle='#ffdc92';c.font='bold 14px Segoe UI';c.textAlign='left';const label='Cruzeiro 3×3 · alcance '+Math.max(...units.map(u=>game.weaponRange(u,'cruiseMissile')))+' · munição '+units.reduce((n,u)=>n+(u.ammo.cruiseMissile||0),0)+(inRange?'':' · aproximar para lançar');c.fillText(label,Math.max(cam.x+8,Math.min(p.x*CELL,cam.x+this.canvas.clientWidth/cam.zoom-c.measureText(label).width-8)),Math.max(cam.y+24,(p.y-1)*CELL-8));}}
  for(const p of game.projectiles)if(['artillery','rocketArtillery'].includes(p.type)&&(p.owner===localPlayerSide()||game.isVisible(localPlayerSide(),{x:p.tx,y:p.ty})))this.area(p.tx,p.ty,.1+.12*p.elapsed/p.duration);
  for(const p of game.projectiles)if(p.weapon==='cruiseMissile'&&p.owner===localPlayerSide()&&(!p.networkVisual||p.area)){const cell=p.area||{x:p.tx,y:p.ty};this.area(cell.x,cell.y,.1+.12*p.elapsed/p.duration);}
  // Aeronaves por cima das tropas terrestres.
  for(const air of [false,true])for(const u of game.units)if(AIR(u)===air&&(u.owner===localPlayerSide()||game.isVisible(localPlayerSide(),u)))this.entity(u);
  for(const contact of game.emitterContacts(localPlayerSide()))this.emitterSymbol(c,(contact.x+.5)*CELL,(contact.y+.5)*CELL,1/cam.zoom,contact.id===this.emitterHighlight);
  for(const p of game.projectiles){
   const t=Math.min(1,p.elapsed/p.duration),target=p.type==='artillery'?null:game.get(p.targetId),tx=target?.x??p.tx,ty=target?.y??p.ty;
   const missile=MISSILE(p.weapon),gx=missile||p.networkVisual?p.x:p.sx+(tx-p.sx)*t,gy=missile||p.networkVisual?p.y:p.sy+(ty-p.sy)*t;if(!missile&&p.owner!==localPlayerSide()&&!game.isVisible(localPlayerSide(),{x:gx,y:gy}))continue;
   const level=p.visualLevel??p.sourceLevel??0,x=(gx+.5)*CELL,y=(gy+.5)*CELL-18*level-(p.type==='artillery'?Math.sin(Math.PI*t)*85:0),g=p.type==='artillery'?this.glow.large:this.glow.small;c.drawImage(g,x-g.width/2,y-g.height/2);
   if(missile){const previous=p.trail.at(-1),heading=previous?Math.atan2((gy-previous.y)*CELL-18*(level-(previous.level||0)),(gx-previous.x)*CELL):p.heading,art=missileArt[p.weapon],img=art&&missileImages[art[0]],ready=img?.complete&&img.naturalWidth>0;c.save();c.translate(x,y);c.rotate(heading);if(ready){c.save();c.rotate(Math.PI/2);c.drawImage(img,-art[1]/2,-art[1]/2,art[1],art[1]);c.restore();}else{polygon(c,[[-9,-2.5],[6,-2.5],[12,0],[6,2.5],[-9,2.5]],'#e8ece6','#24353b');polygon(c,[[-8,-2],[-12,-5],[-10,0],[-12,5],[-8,2]],'#adb8b8');}const tail=ready?-art[1]*.45:-10;polygon(c,[[tail,-2],[tail-9,0],[tail,2]],'#ffac58');polygon(c,[[tail,-1],[tail-5,0],[tail,1]],'#fff3ba');c.restore();continue;}
   const look=p.weapon==='gun'||p.weapon==='transportTruck'?'machinegun':p.weapon==='agm'||p.weapon==='aam'||p.weapon==='atMissile'?'antitank':p.weapon==='rifle'?'infantry':p.type;
   if(look==='antitank'||look==='machinegun'){c.save();c.translate(x,y);c.rotate(Math.atan2((ty-p.sy)*CELL-18*((p.targetLevel||0)-(p.sourceLevel||0)),(tx-p.sx)*CELL));if(look==='antitank'){c.strokeStyle='#edb87388';c.lineWidth=3;c.beginPath();c.moveTo(-19,0);c.lineTo(-5,0);c.stroke();polygon(c,[[-5,-2],[4,-2],[8,0],[4,2],[-5,2]],'#e9ebe0');}else{const mini=p.weapon==='gun'&&p.type==='helicopter',cannon=p.weapon==='gun'&&!mini;c.fillStyle=cannon?'#ffe2a0':'#fff0b1';c.fillRect(mini?-5:-9,cannon?-1.5:-1,mini?7:cannon?15:12,cannon?3:2);}c.restore();}
  }
  let n=0;for(const p of this.particles){p.t+=dt;if(p.t>=p.life)continue;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy-=dt*12;this.particles[n++]=p;if(!p.publicMissile&&(p.smoke||p.flare||p.contactId||p.sourceId)&&!game.effectVisible(p.x/CELL-.5,(p.y+(p.lift||0))/CELL-.5,p.air,p.contactId,p.sourceId))continue;c.globalAlpha=(1-p.t/p.life)*(p.smoke?.45:1);c.fillStyle=p.color;c.beginPath();c.arc(p.x,p.y,p.size*(1+p.t),0,7);c.fill();}this.particles.length=n;
  c.font='bold 17px Segoe UI';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#14262c';
  n=0;for(const f of this.texts){f.t+=dt;if(f.t>=1.1)continue;this.texts[n++]=f;if((f.contactId||f.sourceId)&&!game.effectVisible(f.x,f.y,f.air,f.contactId,f.sourceId))continue;c.globalAlpha=1-f.t/1.1;const x=(f.x+.5)*CELL,y=(f.y+.2)*CELL-f.t*25-18*(f.flightLevel||0);c.strokeText(f.text,x,y);c.fillStyle=f.color;c.fillText(f.text,x,y);}this.texts.length=n;c.globalAlpha=1;
  if(marker){marker.t+=dt;if(marker.t>.9)marker=null;else{c.strokeStyle=marker.color;c.lineWidth=2;c.beginPath();c.arc((marker.x+.5)*CELL,(marker.y+.5)*CELL,10+marker.t*12,0,7);c.stroke();}}
  if(drag?.active){const x=Math.min(drag.start.x,drag.end.x),y=Math.min(drag.start.y,drag.end.y),w=Math.abs(drag.end.x-drag.start.x),h=Math.abs(drag.end.y-drag.start.y);c.fillStyle='#99dfea22';c.strokeStyle='#c0f0ec';c.lineWidth=1.5;c.fillRect((x+.5)*CELL,(y+.5)*CELL,w*CELL,h*CELL);c.strokeRect((x+.5)*CELL,(y+.5)*CELL,w*CELL,h*CELL);}
  c.restore();this.drawRulers();this.lastDrawMs=performance.now()-began;
 }
 drawRulers(){
  const c=this.ctx,dpr=devicePixelRatio||1,w=this.canvas.clientWidth,h=this.canvas.clientHeight,cell=CELL*cam.zoom;
  c.save();c.setTransform(dpr,0,0,dpr,0,0);c.globalAlpha=1;c.fillStyle='rgba(23,34,28,.72)';c.fillRect(0,0,w,18);c.fillRect(0,0,18,h);c.fillStyle=c.strokeStyle='#E9EDE3';c.font="600 11px 'Bahnschrift SemiCondensed', Bahnschrift, 'DIN Alternate', 'Arial Narrow', sans-serif";c.lineWidth=1;c.textBaseline='middle';
  const step=[1,2,5,10,20].find(n=>n*cell>=36)||20;
  for(let x=Math.max(0,Math.floor(cam.x/CELL));x<COLS;x++){const px=(x*CELL-cam.x)*cam.zoom;if(px>w)break;const label=(x+1)%step===0;if(cell>=6||label){c.beginPath();c.moveTo(px,18);c.lineTo(px,label?10:14);c.stroke();}if(label&&px>=20){c.textAlign='left';c.fillText(x+1,px+3,7);}}
  for(let y=Math.max(0,Math.floor(cam.y/CELL));y<ROWS;y++){const py=(y*CELL-cam.y)*cam.zoom;if(py>h)break;const label=(ROWS-y)%step===0;if(cell>=6||label){c.beginPath();c.moveTo(18,py);c.lineTo(label?10:14,py);c.stroke();}if(label&&py>=24){c.save();c.translate(7,py+4);c.rotate(-Math.PI/2);c.textAlign='right';c.fillText(ROWS-y,0,0);c.restore();}}
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
 emitterSymbol(c,x,y,scale=1,selected=false){c.save();c.translate(x,y);c.scale(scale,scale);c.lineWidth=2;c.strokeStyle=selected?'#fff2b1':'#f6c27c';c.fillStyle='#17232fec';c.beginPath();c.moveTo(0,-9);c.lineTo(9,0);c.lineTo(0,9);c.lineTo(-9,0);c.closePath();c.fill();c.stroke();c.beginPath();c.moveTo(0,5);c.lineTo(0,-1);c.stroke();for(const r of [3,6]){c.beginPath();c.arc(0,-1,r,Math.PI*1.15,Math.PI*1.85);c.stroke();}if(selected){c.beginPath();c.arc(0,0,13,0,Math.PI*2);c.stroke();}c.restore();}
 drawMini(){
  const c=this.mini,{s,ox,oy}=miniTransform(c.canvas);
  if(!this.miniTerrain||this.miniTerrain.width!==c.canvas.width||this.miniTerrain.height!==c.canvas.height){const image=this.miniTerrain=document.createElement('canvas');image.width=c.canvas.width;image.height=c.canvas.height;const q=image.getContext('2d',CACHED);q.fillStyle='#20333d';q.fillRect(0,0,image.width,image.height);q.translate(ox,oy);for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){q.fillStyle=terrainMinimapColor(game.terrain[KEY(x,y)],game.map);q.fillRect(x*s,y*s,s,s);}}
  c.drawImage(this.miniTerrain,0,0);c.save();c.translate(ox,oy);
  for(const u of game.memory[localPlayerSide()].values())if(!game.isVisible(localPlayerSide(),u)){c.fillStyle=TEAM[u.owner];const n=u.type==='hq'?9:5;if(u.width)c.fillRect(u.x*s,u.y*s,u.width*s,u.height*s);else c.fillRect((u.x+.5)*s-n/2,(u.y+.5)*s-n/2,n,n);}
  c.save();c.imageSmoothingEnabled=false;c.drawImage(this.visionMasks().mini,0,0,COLS*s,ROWS*s);c.restore();
  for(const u of game.all())if(u.owner===localPlayerSide()||game.isVisible(localPlayerSide(),u)){c.fillStyle=TEAM[u.owner];const n=u.type==='hq'?9:5;if(u.width)c.fillRect(u.x*s,u.y*s,u.width*s,u.height*s);else c.fillRect((u.x+.5)*s-n/2,(u.y+.5)*s-n/2,n,n);if(selection.has(u.id)){c.strokeStyle='#fff1bf';if(u.width)c.strokeRect(u.x*s,u.y*s,u.width*s,u.height*s);else c.strokeRect((u.x+.5)*s-5,(u.y+.5)*s-5,10,10);}if(game.radarContact(localPlayerSide(),u)){c.strokeStyle='#68ef8d';c.lineWidth=1.5;c.strokeRect((u.x+.5)*s-4,(u.y+.5)*s-4,8,8);}}
  for(const contact of game.emitterContacts(localPlayerSide()))this.emitterSymbol(c,(contact.x+.5)*s,(contact.y+.5)*s,.55,contact.id===this.emitterHighlight);
  const k=s/CELL,v=cameraViewport();c.beginPath();c.rect(0,0,COLS*s,ROWS*s);c.clip();c.strokeStyle='#fff1bfcc';c.lineWidth=1.5;c.strokeRect(cam.x*k,cam.y*k,v.width/cam.zoom*k,v.height/cam.zoom*k);c.restore();
 }
}
