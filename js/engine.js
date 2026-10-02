'use strict';
/* Motor compartilhado: turnos alternados ou RTS com ordens simultâneas. */
const COLS=36,ROWS=28,SIZE=COLS*ROWS,STEP=1/30;
const KEY=(x,y)=>y*COLS+x,INSIDE=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<COLS&&y<ROWS;
const TILE=u=>({x:Math.round(u.x),y:Math.round(u.y)}),DIST=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]],SIDE={blue:'Azul',red:'Vermelha',neutral:'Neutra'};
const TERRAIN={plain:{name:'Planície',cover:0,color:'#77816a'},forest:{name:'Floresta',cover:.3,color:'#4b6654'},mountain:{name:'Montanha',cover:.5,color:'#868879'},river:{name:'Rio',cover:0,color:'#477986'},bridge:{name:'Ponte',cover:0,color:'#a69977'},road:{name:'Estrada',cover:0,color:'#b0a487'}};
const PROCEDURAL={water:.35,forest:.4,mountain:.3,posts:8};
const MAPS={river:'Vale dos Rios',desert:'Deserto Aberto',mountain:'Passe de Montanha',random:'Fronteira procedural'};
const TYPES={
 infantry:{move:3,name:'Infantaria',hp:100,speed:1.35,range:1.15,min:0,damage:35,accuracy:.9,vision:4,cooldown:.8,train:1,cost:50,reward:20,role:'Captura e construção'},
 lightTank:{move:5,vehicle:true,tank:true,name:'Tanque leve',hp:110,speed:2,range:2,min:0,damage:35,accuracy:.75,vision:5,cooldown:2,train:2,cost:100,reward:35,role:'Mobilidade e baixo custo'},
 tank:{move:4,vehicle:true,tank:true,name:'Tanque médio',hp:170,speed:1.55,range:3,min:0,damage:60,accuracy:.7,vision:4,cooldown:2.5,train:3,cost:150,reward:50,role:'Equilíbrio entre mobilidade e canhão'},
 heavyTank:{move:3,vehicle:true,tank:true,name:'Tanque pesado',hp:280,speed:1.05,range:3,min:0,damage:80,accuracy:.7,vision:4,cooldown:3.5,train:4,cost:240,reward:80,role:'Resistência e dano por disparo'},
 artillery:{move:2,vehicle:true,name:'Artilharia',hp:80,speed:.85,range:6,min:2,damage:70,accuracy:.85,vision:3,cooldown:5,train:3,cost:100,reward:40,role:'Área 3×3 · fogo amigo'},
 recon:{move:5,vehicle:true,name:'Batedor',hp:75,speed:2.25,range:2,min:0,damage:32,accuracy:.9,vision:7,cooldown:1.1,train:1,cost:75,reward:25,role:'Reconhecimento rápido'},
 engineer:{move:3,name:'Engenheiro',hp:85,speed:1.25,range:1.15,min:0,damage:20,accuracy:.9,vision:4,cooldown:1.2,train:2,cost:65,reward:25,role:'Reparo +24 HP por ação'},
 antitank:{move:3,name:'Antitanque',hp:90,speed:1.05,range:3,min:0,damage:40,accuracy:.85,vision:4,cooldown:3,train:2,cost:110,reward:35,role:'Foguetes contra veículos'},
 machinegun:{move:2,name:'Metralhador',hp:110,speed:1.05,range:2.5,min:0,damage:18,accuracy:.88,vision:4,cooldown:.4,train:2,cost:90,reward:30,role:'Fogo rápido contra tropas a pé'},
 commander:{move:3,name:'Comandante',hp:140,speed:1.35,range:2,min:0,damage:40,accuracy:.9,vision:5,cooldown:1.5,reward:70,role:'Aura de comando · raio 2'},
 hq:{name:'Quartel-general',hp:300,speed:0,range:0,damage:0,vision:5,structure:true,reward:100},
 post:{name:'Posto avançado',hp:80,speed:0,range:0,damage:0,vision:3,structure:true,reward:30}
};
function seeded(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
﻿class Game{
 constructor(map='river',difficulty='normal',seed=1,mode='turns',options={}){
  this.mode=mode==='rts'?'rts':'turns';this.economyClock=0;this.aiClock=0;this.visionClock=0;this.claims=new Set();
  this.map=MAPS[map]?map:'river';this.difficulty=['easy','normal','hard'].includes(difficulty)?difficulty:'normal';this.seed=seed>>>0;this.rng=seeded(seed);
  const o={...PROCEDURAL,...options},unit=v=>Math.max(0,Math.min(1,Number(v)||0));this.options={water:unit(o.water),forest:unit(o.forest),mountain:unit(o.mountain),posts:Math.max(2,Math.min(12,Math.round(Number(o.posts)/2)*2||8))};
  this.terrain=Array(SIZE).fill('plain');this.units=[];this.structures=[];this.mines=[];this.projectiles=[];this.events=[];this.logs=[];this.nextId=1;
  this.time=0;this.round=1;this.turn='blue';this.actions=[];this.animation=null;this.aiQueue=[];this.aiWait=0;this.aiEnabled=true;this.aiDecisions=0;this.aiState='rally';this.shotsFired=0;
  this.credits={blue:150,red:150};this.winner=null;this.visible={blue:Array(SIZE).fill(false),red:Array(SIZE).fill(false)};this.explored={blue:Array(SIZE).fill(false),red:Array(SIZE).fill(false)};this.memory={blue:new Map(),red:new Map()};
  this.generate();this.updateVision();this.log(this.mode==='rts'?'Operação RTS. P pausa o combate para dar ordens; P novamente retoma.':'Seu turno. Mova as tropas, execute ações e encerre quando estiver pronto.');
 }
 get busy(){return this.mode==='rts'?this.units.some(u=>u.pending||u.segment)||this.projectiles.length>0:!!this.animation||this.actions.length>0||this.projectiles.length>0;}
 all(){return [...this.units,...this.structures];}
 get(id){return this.units.find(u=>u.id===id)||this.structures.find(u=>u.id===id);}
 hq(owner){return this.structures.find(u=>u.owner===owner&&u.type==='hq');}
 add(owner,type,x,y){
  const t=TYPES[type];if(!t||!INSIDE(x,y)||!['blue','red','neutral'].includes(owner))return null;
  const u={id:this.nextId++,owner,type,x,y,facing:owner==='blue'?0:Math.PI,hp:t.hp,maxHp:t.hp,level:1,xp:0,cooldown:0,setup:0,packing:0,idle:0,entrenched:false,work:0,reserved:0,order:{type:'stop'},path:[],segment:null,navGoal:null,healText:0,moveLeft:t.move||0,actionLeft:!t.structure,moved:false,pending:false};
  if(t.structure)u.queue=[];(t.structure?this.structures:this.units).push(u);return u;
 }
  generate(){
  const {water,forest,mountain,posts}=this.options,rng=this.rng;
  // Ruído de valor: grade grossa sorteada e interpolada, para manchas e rios contínuos.
  const noise=scale=>{const w=Math.ceil(COLS/scale)+2,h=Math.ceil(ROWS/scale)+2,g=Array.from({length:w*h},rng),s=t=>t*t*(3-2*t);return(x,y)=>{const fx=x/scale,fy=y/scale,ix=Math.floor(fx),iy=Math.floor(fy),tx=s(fx-ix),ty=s(fy-iy),v=(a,b)=>g[(iy+b)*w+ix+a];return(v(0,0)*(1-tx)+v(1,0)*tx)*(1-ty)+(v(0,1)*(1-tx)+v(1,1)*tx)*ty;};};
  const height=noise(7),moisture=noise(5),flow=noise(9),mid=COLS/2;
  // Limiar por quantil: cada parâmetro vira a fração aproximada da metade do mapa coberta pelo terreno.
  const cut=(f,frac)=>{const v=[];for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(KEY(x,y)<=KEY(COLS-1-x,ROWS-1-y))v.push(f(x,y));v.sort((p,q)=>p-q);return v[v.length-1-Math.floor(frac*v.length)];};
  const peak=cut(height,.18*mountain),lake=cut(flow,.04*water),wet=cut(moisture,.4*forest);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
   const k=KEY(x,y),mirror=KEY(COLS-1-x,ROWS-1-y);if(k>mirror)continue;const r=rng();let t=r<.21?'forest':r<.27?'mountain':'plain';
   if(this.map==='desert')t=r<.07?'forest':r<.14?'mountain':'plain';
   if(this.map==='mountain')t=x>=mid-2&&x<=mid+1?'mountain':r<.2?'forest':'plain';
   if(this.map==='river'&&(x===mid-1||x===mid))t='river';
   if(this.map==='random')t=height(x,y)>peak?'mountain':flow(x,y)>lake?'river':moisture(x,y)>wet?'forest':'plain';
   this.terrain[k]=this.terrain[mirror]=t;
  }
  // Rios procedurais: caminhada de borda a borda, contínua em 4 direções; o espelho cria o segundo rio.
  if(this.map==='random')for(let i=0;i<Math.round(water*2);i++){let x=5+Math.floor(rng()*(COLS-12));const paint=(cx,y)=>{for(const wx of water>.6?[cx,cx+1]:[cx])this.terrain[KEY(wx,y)]=this.terrain[KEY(COLS-1-wx,ROWS-1-y)]='river';};
   for(let y=0;y<ROWS;y++){paint(x,y);const r=rng();x=Math.max(5,Math.min(COLS-7,x+(r<.3?-1:r>.7?1:0)));paint(x,y);}}
  const lane=Math.round(ROWS*.3);
  for(const y of [lane,ROWS-1-lane])for(let x=0;x<COLS;x++)this.terrain[KEY(x,y)]=this.terrain[KEY(x,y)]==='river'?'bridge':'road';
  for(const x of [2,COLS-3])for(let y=1;y<ROWS-1;y++)this.terrain[KEY(x,y)]=this.terrain[KEY(x,y)]==='river'?'bridge':'road';
  for(const [x,y]of [[3,ROWS-2],[COLS-4,1]])this.terrain[KEY(x,y)]='road';
  const start=[['hq',1,12],['commander',2,12],['infantry',3,11],['infantry',1,10],['tank',4,12],['artillery',1,11],['recon',3,10],['engineer',2,11]];
  for(const [type,x,y0]of start){const y=y0-14+ROWS;this.terrain[KEY(x,y)]=this.terrain[KEY(COLS-1-x,ROWS-1-y)]='plain';this.add('blue',type,x,y);this.add('red',type,COLS-1-x,ROWS-1-y);}
  // Postos espaçados nas estradas horizontais; o espelho cai na outra estrada. Pontes ficam livres.
  for(let i=1;i<=posts/2;i++){let x=Math.round(i*COLS/(posts/2+1));while(this.terrain[KEY(x,lane)]==='bridge')x++;for(const [px,py]of [[x,lane],[COLS-1-x,ROWS-1-lane]])this.add('neutral','post',px,py);}
  for(let placed=0,tries=0;placed<4&&tries<200;tries++){const x=mid-6+Math.floor(rng()*12),y=Math.floor(ROWS/2)-5+Math.floor(rng()*10),cells=[[x,y],[COLS-1-x,ROWS-1-y]];
   if(cells.some(([cx,cy])=>['river','mountain','bridge'].includes(this.terrain[KEY(cx,cy)])||this.structureAt(cx,cy)||this.mines.some(m=>m.x===cx&&m.y===cy))||x===COLS-1-x&&y===ROWS-1-y)continue;
   for(const [cx,cy]of cells)this.mines.push({x:cx,y:cy,known:{blue:false,red:false}});placed++;}
 }

 log(text){this.logs.unshift({time:this.mode==='rts'?this.time:this.round,text});if(this.logs.length>70)this.logs.pop();}
 report(text,...units){if(units.some(u=>u.owner==='blue'||this.isVisible('blue',u)))this.log(text);}
 event(kind,u,extra={}){this.events.push({kind,x:u.x,y:u.y,visible:u.owner==='blue'||this.isVisible('blue',u),...extra});if(this.events.length>250)this.events.shift();}
  structureAt(x,y){return this.structures.find(s=>s.x===x&&s.y===y&&s.hp>0);}
 terrainAt(u){const p=TILE(u);return this.terrain[KEY(p.x,p.y)];}
 cost(u,x,y){if(!INSIDE(x,y))return Infinity;const t=this.terrain[KEY(x,y)];if(t==='river'||t==='mountain'&&u.type!=='infantry')return Infinity;if(t==='road')return .5;return t==='forest'&&TYPES[u.type].vehicle?2:1;}
 occupied(x,y,except){return this.units.find(u=>u!==except&&u.hp>0&&(DIST(TILE(u),{x,y})===0||u.segment&&(DIST(u.segment.from,{x,y})===0||DIST(u.segment.to,{x,y})===0)));}
 /* Grades por casa: guardam a primeira unidade/estrutura de cada casa, igual às buscas lineares, numa só varredura. */
 unitGrid(except){
  const grid=Array(SIZE).fill(null),mark=(x,y,v)=>{if(INSIDE(x,y)&&!grid[KEY(x,y)])grid[KEY(x,y)]=v;};
  for(const v of this.units)if(v!==except&&v.hp>0){mark(Math.round(v.x),Math.round(v.y),v);if(v.segment){mark(v.segment.from.x,v.segment.from.y,v);mark(v.segment.to.x,v.segment.to.y,v);}}
  return grid;
 }
 structureGrid(){const grid=Array(SIZE).fill(null);for(const s of this.structures)if(s.hp>0&&INSIDE(s.x,s.y)&&!grid[KEY(s.x,s.y)])grid[KEY(s.x,s.y)]=s;return grid;}
 passable(u,x,y,avoidUnits,units,structures){
  const k=KEY(x,y);if(structures[k]?.type==='hq')return false;
  const blocker=units[k],known=blocker&&(blocker.owner===u.owner||this.isVisible(u.owner,blocker));return !(known&&(avoidUnits||blocker.owner!==u.owner));
 }
 /* Casas que findPath(u, casa) alcança: o A* é completo, então equivale a uma inundação com as mesmas regras. */
 reachable(u,units=this.unitGrid(u),structures=this.structureGrid()){
  const start=TILE(u),seen=new Uint8Array(SIZE),queue=new Int16Array(SIZE);let head=0,tail=0;seen[queue[tail++]=KEY(start.x,start.y)]=1;
  while(head<tail){const k=queue[head++],px=k%COLS,py=(k-px)/COLS;for(const [dx,dy]of DIRS){
   const x=px+dx,y=py+dy;if(x<0||y<0||x>=COLS||y>=ROWS)continue;const key=KEY(x,y);
   if(seen[key]||!this.passable(u,x,y,false,units,structures)||!Number.isFinite(this.cost(u,x,y)))continue;seen[key]=1;queue[tail++]=key;
  }}return seen;
 }
 /* A* ponderado: heurística admissível (menor custo = 0,5), vizinhos ortogonais. Heap ordenado por (f, g, inserção) = mesma ordem da antiga lista ordenada estável. */
 findPath(u,goal,avoidUnits=false,units=this.unitGrid(u),structures=this.structureGrid()){
  const start=TILE(u);if(!INSIDE(goal.x,goal.y)||!Number.isFinite(this.cost(u,goal.x,goal.y)))return null;
  const root=KEY(start.x,start.y),end=KEY(goal.x,goal.y),costs=new Float64Array(SIZE).fill(Infinity),parents=new Int16Array(SIZE),heap=[];let seq=0;costs[root]=0;
  const before=(a,b)=>a.f<b.f||a.f===b.f&&(a.g<b.g||a.g===b.g&&a.s<b.s);
  const push=n=>{heap.push(n);let i=heap.length-1;while(i){const up=(i-1)>>1;if(!before(heap[i],heap[up]))break;[heap[i],heap[up]]=[heap[up],heap[i]];i=up;}};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<heap.length&&before(heap[l],heap[m]))m=l;if(r<heap.length&&before(heap[r],heap[m]))m=r;if(m===i)break;[heap[i],heap[m]]=[heap[m],heap[i]];i=m;}}return top;};
  push({x:start.x,y:start.y,f:DIST(start,goal)*.5,g:0,s:seq++});
  while(heap.length){
   const p=pop(),k=KEY(p.x,p.y);if(p.g!==costs[k])continue;
   if(k===end){const path=[];let key=k;while(key!==root){path.unshift({x:key%COLS,y:Math.floor(key/COLS)});key=parents[key];}return path;}
   for(const [dx,dy]of DIRS){
    const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=COLS||y>=ROWS||!this.passable(u,x,y,avoidUnits,units,structures))continue;
    const g=p.g+this.cost(u,x,y),key=KEY(x,y);if(!Number.isFinite(g)||g>=costs[key])continue;
    costs[key]=g;parents[key]=k;push({x,y,g,f:g+(Math.abs(x-goal.x)+Math.abs(y-goal.y))*.5,s:seq++});
   }
  }return null;
 }
 isVisible(owner,u){if(!u||!this.visible[owner])return false;const p=TILE(u);return !!this.visible[owner][KEY(p.x,p.y)];}
 range(u){return TYPES[u.type].range+(this.terrainAt(u)==='mountain'?2:0);}
 sight(u){return TYPES[u.type].vision+(this.terrainAt(u)==='mountain'?2:0);}
 updateVision(){
  for(const owner of ['blue','red']){
   const visible=this.visible[owner],explored=this.explored[owner];visible.fill(false);
   for(const list of [this.units,this.structures])for(const u of list){
    if(u.owner!==owner||u.hp<=0)continue;const r=this.sight(u),limit=r+.05,x0=Math.max(0,Math.floor(u.x-r)),x1=Math.min(COLS-1,Math.ceil(u.x+r));
    for(let y=Math.max(0,Math.floor(u.y-r));y<=Math.min(ROWS-1,Math.ceil(u.y+r));y++){const dy=Math.abs(u.y-y);for(let x=x0;x<=x1;x++)if(Math.abs(u.x-x)+dy<=limit){const k=KEY(x,y);visible[k]=true;explored[k]=true;}}
   }
   for(const [key]of this.memory[owner])if(this.visible[owner][key])this.memory[owner].delete(key);
   for(const s of this.structures)if(this.isVisible(owner,s))this.memory[owner].set(KEY(s.x,s.y),{id:s.id,x:s.x,y:s.y,type:s.type,owner:s.owner});
   for(const m of this.mines)if(this.units.some(u=>u.type==='engineer'&&u.owner===owner&&DIST(u,m)<=2))m.known[owner]=true;
  }
 }
 hasAura(u){return this.units.some(c=>c.owner===u.owner&&c.type==='commander'&&c.hp>0&&DIST(u,c)<=2);}
 cover(u){return Math.min(.75,TERRAIN[this.terrainAt(u)].cover+(u.entrenched?.25:0));}
 attackPower(u){return TYPES[u.type].damage*(1+(u.level-1)*.1)*(this.hasAura(u)?1.2:1);}
 accuracy(a,b){return Math.max(.1,Math.min(.99,TYPES[a.type].accuracy+(a.level-1)*.05+(this.hasAura(a)?.15:0)-(b.level-1)*.05));}
 canFire(a,b){return !!b&&b.hp>0&&b.owner!==a.owner&&b.owner!=='neutral'&&this.isVisible(a.owner,b)&&DIST(a,b)<=this.range(a)+.05&&DIST(a,b)>=TYPES[a.type].min;}

  acquire(u){
  let best,bestD=Infinity,bestPriority=-1;
  for(const list of [this.units,this.structures])for(const e of list){
   if(!this.canFire(u,e))continue;const d=DIST(u,e),t=TYPES[e.type],priority=u.type==='antitank'?Number(!!t.vehicle):u.type==='machinegun'?Number(!t.vehicle&&!t.structure):0;
   if(priority>bestPriority||priority===bestPriority&&(d<bestD||d===bestD&&e.hp<best.hp)){best=e;bestD=d;bestPriority=priority;}
  }return best;
 }

 cancelWork(u){if(u.reserved){this.credits[u.owner]+=u.reserved;u.reserved=0;}u.work=0;}
 buildSite(u){return u?.type==='infantry'&&u.hp>0&&!u.segment&&!this.structures.some(s=>DIST(s,u)<3)&&['plain','road','forest'].includes(this.terrainAt(u));}
 canBuild(u){return !!u&&(this.mode==='rts'||u.owner===this.turn)&&u.actionLeft&&!u.pending&&this.credits[u.owner]>=60&&this.buildSite(u);}
 pathCost(u,path){return path.reduce((sum,p)=>sum+this.cost(u,p.x,p.y),0);}
 trimPath(u,path){if(this.mode==='rts')return path;let left=u.moveLeft;const route=[];for(const p of path){const cost=this.cost(u,p.x,p.y);if(cost>left+1e-8)break;left-=cost;route.push(p);}return route;}
 pathToRange(u,target,near,min=0,budget=Infinity){
  const start=this.mode==='rts'&&u.segment?{...u,...u.segment.to}:u;
  if(DIST(start,target)<=near&&DIST(start,target)>=min)return [];
  const cells=[];for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const d=DIST({x,y},target);if(d<=near&&d>=min&&!this.occupied(x,y,u)&&this.structureAt(x,y)?.type!=='hq'&&Number.isFinite(this.cost(u,x,y)))cells.push({x,y});}
  cells.sort((a,b)=>DIST(a,start)-DIST(b,start));let best=null,bestCost=Infinity;
  for(const cell of cells){const route=this.findPath(start,cell,true,this.unitGrid(u));if(!route)continue;const cost=this.pathCost(u,route);if(cost<=budget+1e-8&&cost<bestCost){best=route;bestCost=cost;}}
  return best;
 }
 order(u,type,args={},batch=false){
  const rts=this.mode==='rts';
  if(this.winner||!u||!this.units.includes(u)||u.hp<=0||!['blue','red'].includes(u.owner)||!rts&&(u.owner!==this.turn||u.pending||this.busy&&!batch))return false;
  if(type==='stop'){if(rts)this.finishRTS(u);else{u.moveLeft=0;u.actionLeft=false;u.entrenched=true;u.order={type:'stop'};}return true;}
  let route=[],target=this.get(args.targetId),job={id:u.id,type,targetId:target?.id};
  if(type==='move'){
   const goal={x:Math.round(args.x),y:Math.round(args.y)};if(!INSIDE(goal.x,goal.y)||!rts&&(u.moveLeft<=0||u.type==='artillery'&&!u.actionLeft&&!u.moved))return false;
   const start=rts&&u.segment?{...u,...u.segment.to}:u,path=this.findPath(start,goal,true,this.unitGrid(u));if(!path)return false;route=this.trimPath(u,path);if(!route.length&&!(rts&&u.segment))return false;job.goal=goal;
  }else{
   if(!rts&&!u.actionLeft)return false;
   if(type==='attack'){
    if(!target||target.owner===u.owner||target.owner==='neutral'||!this.isVisible(u.owner,target))return false;
    if(!rts&&u.type==='artillery'&&(u.moved||!this.canFire(u,target)))return false;
    route=this.pathToRange(u,target,this.range(u),TYPES[u.type].min,rts?Infinity:u.moveLeft);if(route===null)return false;
   }else if(type==='repair'){
    if(u.type!=='engineer'||!target||target===u||target.owner!==u.owner||target.hp>=target.maxHp)return false;
    route=this.pathToRange(u,target,1,0,rts?Infinity:u.moveLeft);if(route===null)return false;
   }else if(type==='capture'){
    if(u.type!=='infantry'||target?.type!=='post'||target.owner===u.owner||!this.isVisible(u.owner,target))return false;
    route=this.pathToRange(u,target,1,0,rts?Infinity:u.moveLeft);if(route===null)return false;
   }else if(type==='demine'){
    const m=this.mines.find(m=>m.x===args.x&&m.y===args.y&&m.known[u.owner]);if(u.type!=='engineer'||!m)return false;
    job.goal={x:m.x,y:m.y};route=this.pathToRange(u,m,1,0,rts?Infinity:u.moveLeft);if(route===null)return false;
   }else if(type==='build'){
    if(!this.canBuild(u))return false;this.credits[u.owner]-=60;u.reserved=60;
   }else return false;
   if(!rts)u.actionLeft=false;
  }
  if(rts){if(type!=='build')this.cancelWork(u);u.work=0;u.idle=0;u.navWait=0;u.job=job;}
  u.entrenched=false;u.pending=true;u.path=route.slice();job.route=route;u.order={type,targetId:job.targetId,goal:route.length?route[route.length-1]:job.goal};if(!rts)this.actions.push(job);return true;
 }
 command(ids,type,args={}){
  if(this.winner||this.mode!=='rts'&&(this.turn!=='blue'||this.busy))return 0;let count=0;const assigned=new Set(),army=[...new Set(ids)].map(id=>this.get(id)).filter(u=>u?.owner==='blue'&&!TYPES[u.type].structure);
  for(const u of army){
   if(type==='move'&&army.length>1){
    const candidates=[];for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(DIST({x,y},args)<=4&&!this.occupied(x,y,u)&&this.structureAt(x,y)?.type!=='hq'&&Number.isFinite(this.cost(u,x,y)))candidates.push({x,y});
    candidates.sort((a,b)=>DIST(a,args)-DIST(b,args)||DIST(a,u)-DIST(b,u));
    for(const goal of candidates){const start=this.mode==='rts'&&u.segment?{...u,...u.segment.to}:u,path=this.findPath(start,goal,true,this.unitGrid(u));if(!path)continue;const route=this.trimPath(u,path),last=route[route.length-1];if(!last||assigned.has(KEY(last.x,last.y)))continue;if(this.order(u,type,goal,true)){assigned.add(KEY(last.x,last.y));count++;break;}}
   }else if(this.order(u,type,args,true))count++;
  }return count;
 }
 enterCell(u){const m=this.mines.find(m=>m.x===u.x&&m.y===u.y);if(!m)return;this.mines=this.mines.filter(v=>v!==m);this.hurt(u,40,null);this.event('blast',u);this.report(`${TYPES[u.type].name} atingido por mina: −40.`,u);}
 shoot(u,target){
  if(u.type==='artillery'&&this.mode!=='rts')u.moveLeft=0;
  u.facing=Math.atan2(target.x-u.x,u.y-target.y);u.cooldown=TYPES[u.type].cooldown;const artillery=u.type==='artillery',aim=artillery?TILE(target):{x:target.x,y:target.y};
  this.projectiles.push({attackerId:u.id,owner:u.owner,type:u.type,targetId:target.id,sx:u.x,sy:u.y,tx:aim.x,ty:aim.y,elapsed:0,duration:artillery?.7:u.type==='antitank'?.3:.18,power:this.attackPower(u),distance:DIST(u,target),range:this.range(u),hit:this.rng()<this.accuracy(u,target),critical:this.rng()<.1});
  this.shotsFired++;this.event('shot',u,{weapon:u.type});
 }
  impact(p){
  const attacker=this.get(p.attackerId),target=this.get(p.targetId),center={x:p.tx,y:p.ty,owner:p.owner};
  if(!p.hit){this.event('text',center,{text:'ERROU!',color:'#efd291'});return;}
  this.event('blast',center,{heavy:p.type==='artillery'});
  const targets=p.type==='artillery'?this.all().filter(u=>Math.abs(u.x-p.tx)<=1.5&&Math.abs(u.y-p.ty)<=1.5):target?[target]:[];
  for(const t of targets){
   let power=p.power;if(p.type==='artillery')power*=Math.max(.4,1-.6*(DIST({x:p.sx,y:p.sy},t)-2)/Math.max(1,p.range-2))*(t.id===p.targetId?1:.5);
   if(p.type==='recon')power*=TYPES[t.type].tank?.4:!TYPES[t.type].vehicle&&!TYPES[t.type].structure?1.5:1;
   if(p.type==='antitank')power*=TYPES[t.type].vehicle?2.25:TYPES[t.type].structure?1:.5;
   if(p.type==='machinegun')power*=TYPES[t.type].vehicle?.25:TYPES[t.type].structure?.5:1.3;
   const n=Math.max(1,Math.round(power*(1-this.cover(t))*(p.critical?1.35:1)));this.hurt(t,n,attacker);
   if(p.critical)this.event('text',t,{text:'CRÍTICO!',color:'#efd291'});
   this.report(`${p.owner===t.owner?'Fogo amigo':TYPES[p.type].name}: ${TYPES[t.type].name} −${n}.`,t);
  }
 }
 hurt(u,n,attacker){
  if(!u||u.hp<=0)return;u.hp=Math.max(0,u.hp-n);u.work=0;u.idle=0;u.entrenched=false;this.event('text',u,{text:`−${Math.round(n)}`,color:'#ffab96'});
  if(u.hp>0)return;this.cancelWork(u);this.event('blast',u);this.report(`${TYPES[u.type].name} da Nação ${SIDE[u.owner]} destruído.`,u);
  if(u.type==='commander'){this.credits[u.owner]=Math.floor(this.credits[u.owner]/2);this.report('Comandante perdido. Metade dos créditos foi perdida.',u);}
  if(attacker&&attacker.hp>0&&attacker.owner!==u.owner&&u.owner!=='neutral'){
   this.credits[attacker.owner]+=TYPES[u.type].reward||0;attacker.xp++;const level=attacker.xp>=3?3:2;
   if(level>attacker.level){attacker.level=level;const gain=Math.round(TYPES[attacker.type].hp*.1);attacker.maxHp=Math.round(TYPES[attacker.type].hp*(1+(level-1)*.1));attacker.hp=Math.min(attacker.maxHp,attacker.hp+gain);this.report(`${TYPES[attacker.type].name} promovido a ${level===3?'Elite':'Veterano'}.`,attacker);}
  }
  this.units=this.units.filter(v=>v.hp>0);this.structures=this.structures.filter(v=>v.hp>0);
 }

 finishAction(u){if(u){if(this.mode==='rts')this.finishRTS(u);else{u.pending=false;u.path=[];u.segment=null;u.order={type:'stop'};}}this.animation=null;this.updateVision();}
 resolveAction(job,u){
  const target=this.get(job.targetId);let valid=false;
  if(job.type==='move'){this.finishAction(u);if(this.turn==='red'&&u.actionLeft){const enemy=this.acquire(u);if(enemy)this.order(u,'attack',{targetId:enemy.id});}return;}
  if(job.type==='attack'){
   if(this.canFire(u,target)){this.animation={...job,route:[],shots:u.type==='machinegun'?3:1,shotClock:0,fired:0};return;}
  }else if(job.type==='repair'&&target?.owner===u.owner&&DIST(u,target)<=1){const heal=Math.min(24,target.maxHp-target.hp);target.hp+=heal;this.event('text',target,{text:'+'+Math.round(heal),color:'#a4e7bb'});valid=true;
  }else if(job.type==='capture'&&target?.type==='post'&&target.owner!==u.owner&&DIST(u,target)<=1){target.owner=u.owner;this.report(`Posto capturado pela Nação ${SIDE[u.owner]}.`,u);valid=true;
  }else if(job.type==='demine'&&DIST(u,job.goal)<=1){const mine=this.mines.find(m=>m.x===job.goal.x&&m.y===job.goal.y);if(mine){this.mines=this.mines.filter(m=>m!==mine);this.report('Mina removida.',u);valid=true;}
  }else if(job.type==='build'&&this.buildSite(u)){u.reserved=0;this.add(u.owner,'post',u.x,u.y);this.units=this.units.filter(v=>v!==u);this.report('Posto construído. Infantaria convertida em guarnição.',u);valid=true;}
  if(!valid){u.actionLeft=true;this.cancelWork(u);}this.finishAction(u);
 }
 animate(dt){
  const a=this.animation,u=this.get(a.id);if(!u){this.animation=null;return;}
  if(a.shots!==undefined){
   a.shotClock-=dt;if(a.shotClock<=0){const target=this.get(a.targetId);if(a.shots>0&&this.canFire(u,target)){this.shoot(u,target);a.shots--;a.fired++;a.shotClock=.12;}else{if(!a.fired)u.actionLeft=true;this.finishAction(u);}}return;
  }
  if(!u.segment){
   if(!a.route.length){this.resolveAction(a,u);return;}
   const next=a.route.shift(),cost=this.cost(u,next.x,next.y);
   if(this.occupied(next.x,next.y,u)||cost>u.moveLeft+1e-8){a.route=[];u.path=[];this.resolveAction(a,u);return;}
   u.segment={from:TILE(u),to:next,cost};u.path=a.route.slice();
  }
  const seg=u.segment,dx=seg.to.x-u.x,dy=seg.to.y-u.y,d=Math.hypot(dx,dy),step=5*dt;if(d>0)u.facing=Math.atan2(dx,-dy);
  if(d<=step){u.x=seg.to.x;u.y=seg.to.y;u.moveLeft=Math.max(0,u.moveLeft-seg.cost);u.moved=true;if(u.type==='artillery')u.actionLeft=false;u.segment=null;this.enterCell(u);this.updateVision();}
  else{u.x+=dx/d*step;u.y+=dy/d*step;}
 }
 income(owner){return Math.round(this.structures.filter(s=>s.owner===owner).reduce((n,s)=>n+(s.type==='hq'?15:8),0)*(owner==='red'?(this.difficulty==='hard'?1.2:this.difficulty==='easy'?.8:1):1));}
  spawnCells(owner,type){const hq=this.hq(owner),cells=[];if(!hq)return cells;for(let r=1;r<=2;r++)for(let y=hq.y-r;y<=hq.y+r;y++)for(let x=hq.x-r;x<=hq.x+r;x++)if(INSIDE(x,y)&&DIST(hq,{x,y})===r&&Number.isFinite(this.cost({type},x,y))&&!this.structureAt(x,y)&&!this.mines.some(m=>m.x===x&&m.y===y))cells.push({x,y});return cells;}

 trainDuration(type){return TYPES[type].train*(this.mode==='rts'?10:1);}
 enqueue(owner,type){const hq=this.hq(owner),t=TYPES[type];if(this.winner||this.mode!=='rts'&&(owner!==this.turn||this.busy)||!hq||!t?.cost||hq.queue.length>=5||this.credits[owner]<t.cost)return false;this.credits[owner]-=t.cost;hq.queue.push({type,progress:0});this.report(`${t.name} em treinamento (${this.trainDuration(type)} ${this.mode==='rts'?'s':'turno(s)'}).`,hq);return true;}
 production(owner,elapsed=1){
  const hq=this.hq(owner),job=hq?.queue[0];if(!job)return;const t=TYPES[job.type],duration=this.trainDuration(job.type);job.progress=Math.min(duration,job.progress+elapsed);if(job.progress+1e-8<duration)return;
  const cell=this.spawnCells(owner,job.type).find(p=>!this.occupied(p.x,p.y));if(!cell)return;this.add(owner,job.type,cell.x,cell.y);hq.queue.shift();this.report(`${t.name} pronto para receber ordens.`,hq);this.event('ready',hq);
 }
 beginTurn(owner){
  this.turn=owner;if(owner==='blue')this.round++;
  for(const u of this.units)if(u.owner===owner){u.moveLeft=TYPES[u.type].move;u.actionLeft=true;u.moved=false;u.pending=false;u.path=[];u.segment=null;u.order={type:'stop'};}
  if(this.round>1){this.credits[owner]+=this.income(owner);this.production(owner);}this.updateVision();
  this.log(owner==='blue'?`Rodada ${this.round}: seu turno.`:`Rodada ${this.round}: turno da IA.`);
  if(owner==='red'){this.aiQueue=this.aiEnabled?this.units.filter(u=>u.owner==='red').map(u=>u.id):[];this.claims=new Set();this.aiWait=.3;this.aiBuy();}
 }
 endTurn(){if(this.mode==='rts'||this.winner||this.turn!=='blue'||this.busy)return false;for(const u of this.units)if(u.owner==='blue'&&!u.moved&&u.actionLeft)u.entrenched=true;this.beginTurn('red');return true;}
 aiBuy(){
  if(!this.aiEnabled)return;const hq=this.hq('red');if(!hq||hq.queue.length>=2)return;const army=this.units.filter(u=>u.owner==='red');if(army.length+hq.queue.length>=16)return;
  const pending=type=>army.filter(u=>u.type===type).length+hq.queue.filter(q=>q.type===type).length;
  const tankChoice=['lightTank','tank','heavyTank'].sort((a,b)=>pending(a)/(a==='tank'?2:1)-pending(b)/(b==='tank'?2:1))[0];
  const priority=pending('infantry')<2?['infantry']:!pending('engineer')?['engineer']:!pending('recon')?['recon']:!pending('machinegun')?['machinegun','infantry']:!pending('antitank')?['antitank','infantry']:pending('artillery')<2?['artillery','tank','infantry']:[tankChoice];priority.some(type=>this.enqueue('red',type));
 }
 moveToward(u,target){const route=this.pathToRange(u,target,1);if(!route?.length)return false;const part=this.trimPath(u,route);return part.length?this.order(u,'move',part[part.length-1]):false;}
 aiAct(u){
  this.aiDecisions++;const hq=this.hq('red');if(!hq)return;
  const army=this.units.filter(v=>v.owner==='red'),foes=this.all().filter(e=>e.owner==='blue'&&this.isVisible('red',e)),threats=foes.filter(e=>!TYPES[e.type].structure&&DIST(e,hq)<=6);this.aiState=threats.length?'defend':'attack';
  if(u.hp/u.maxHp<.35){const medic=army.filter(e=>e.type==='engineer'&&e!==u).sort((a,b)=>DIST(a,u)-DIST(b,u))[0]||hq;if(this.moveToward(u,medic))return;}
  if(u.type==='engineer'){
   const allies=this.all().filter(e=>e.owner==='red'&&e!==u&&e.hp<e.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp);for(const ally of allies)if(this.order(u,'repair',{targetId:ally.id}))return;
   const mine=this.mines.find(m=>m.known.red&&DIST(m,u)<=u.moveLeft+1);if(mine&&this.order(u,'demine',mine))return;
  }
  const firing=this.acquire(u);if(firing&&this.order(u,'attack',{targetId:firing.id}))return;
  if(u.type==='infantry'&&!threats.length){
   const posts=[...this.memory.red.values()].filter(p=>p.type==='post'&&p.owner!=='red'&&!this.claims.has(p.id)).sort((a,b)=>DIST(a,u)-DIST(b,u));
   for(const p of posts){const live=this.get(p.id);if(live&&this.isVisible('red',live)&&this.order(u,'capture',{targetId:p.id})||this.moveToward(u,p)){this.claims.add(p.id);return;}}
  }
  const enemies=(threats.length?threats:foes).slice().sort((a,b)=>DIST(a,u)-DIST(b,u));for(const e of enemies)if(this.order(u,'attack',{targetId:e.id}))return;
  const target=enemies[0]||[...this.memory.red.values()].find(s=>s.type==='hq'&&s.owner==='blue')||{x:1,y:ROWS-2};if(!this.moveToward(u,target))this.order(u,'stop');
 }
 finishRTS(u){
  this.cancelWork(u);u.job=null;u.path=[];u.pending=!!u.segment;u.idle=0;u.order={type:'stop'};
 }
 routeRTS(u){
  const job=u.job,target=this.get(job.targetId);let route;
  if(job.type==='move')route=this.findPath(u,job.goal,true);
  else if(job.type==='build')route=[];
  else route=this.pathToRange(u,target||job.goal,job.type==='attack'?this.range(u):1,job.type==='attack'?TYPES[u.type].min:0);
  job.route=route||[];u.path=job.route.slice();u.navWait=.4;
 }
 stepRTS(u,dt){
  if(dt<=1e-8||u.hp<=0)return;
  u.navWait=Math.max(0,(u.navWait||0)-dt);
  // A nova ordem começa na próxima casa; o segmento em curso continua reservado.
  if(u.segment){
   const seg=u.segment,dx=seg.to.x-u.x,dy=seg.to.y-u.y,d=Math.hypot(dx,dy),speed=TYPES[u.type].speed/seg.cost,step=speed*dt;
   if(d>0)u.facing=Math.atan2(dx,-dy);
   if(d<=step){u.x=seg.to.x;u.y=seg.to.y;u.segment=null;u.moved=true;u.pending=!!u.job;this.enterCell(u);this.updateVision();this.stepRTS(u,dt-d/speed);}
   else{u.x+=dx/d*step;u.y+=dy/d*step;}return;
  }
  const job=u.job;
  if(!job){
   const enemy=u.cooldown<=0?this.acquire(u):null;
   if(enemy){u.idle=0;u.entrenched=false;this.shoot(u,enemy);}
   else{u.idle+=dt;if(u.idle>=3)u.entrenched=true;}return;
  }
  const target=this.get(job.targetId);
  if(['attack','capture','repair'].includes(job.type)){
   const valid=target&&target.hp>0&&(job.type==='repair'?target.owner===u.owner&&target.hp<target.maxHp:target.owner!==u.owner&&this.isVisible(u.owner,target));
   if(!valid){this.finishRTS(u);return;}
  }
  if(job.type==='demine'&&!this.mines.some(m=>m.x===job.goal.x&&m.y===job.goal.y)){this.finishRTS(u);return;}
  const inRange=job.type==='attack'?this.canFire(u,target):job.type==='build'||job.type!=='move'&&DIST(u,target||job.goal)<=1;
  if(inRange){
   job.route=[];u.path=[];
   if(job.type==='attack'){if(u.cooldown<=0)this.shoot(u,target);return;}
   u.work+=dt;const duration=job.type==='build'?3:job.type==='capture'?2:1;
   if(u.work+1e-8<duration)return;u.work=0;
   if(job.type==='repair'){
    const heal=Math.min(24,target.maxHp-target.hp);target.hp+=heal;this.event('text',target,{text:'+'+heal,color:'#a4e7bb'});if(target.hp>=target.maxHp)this.finishRTS(u);
   }else this.resolveAction(job,u);return;
  }
  if(job.type==='move'&&DIST(u,job.goal)===0){this.finishRTS(u);return;}
  if(!job.route.length&&u.navWait<=0)this.routeRTS(u);
  const next=job.route[0];if(!next)return;
  if(this.occupied(next.x,next.y,u)){
   if(u.navWait<=0)this.routeRTS(u);return;
  }
  const cost=this.cost(u,next.x,next.y);if(!Number.isFinite(cost)){this.finishRTS(u);return;}
  job.route.shift();u.path=job.route.slice();u.segment={from:TILE(u),to:next,cost};u.work=0;u.idle=0;u.entrenched=false;this.stepRTS(u,dt);
 }
 updateRTS(dt){
  this.visionClock-=dt;if(this.visionClock<=0){this.updateVision();this.visionClock=.1;}
  this.economyClock+=dt;
  if(this.economyClock+1e-8>=10){this.economyClock=Math.max(0,this.economyClock-10);for(const owner of ['blue','red'])this.credits[owner]+=this.income(owner);}
  for(const owner of ['blue','red'])this.production(owner,dt);
  this.aiClock-=dt;
  if(this.aiEnabled&&this.aiClock<=0){
   this.aiClock=.6;this.claims=new Set(this.units.filter(u=>u.owner==='red'&&u.order.type==='capture').map(u=>u.order.targetId));this.aiBuy();
   for(const u of this.units.filter(u=>u.owner==='red'))if(!u.pending&&!u.segment)this.aiAct(u);
  }
  for(const u of [...this.units])if(u.hp>0)this.stepRTS(u,dt);
 }
  checkVictory(){
  const alive=owner=>!!this.hq(owner)&&(this.units.some(u=>u.owner===owner)||this.hq(owner).queue.length>0),blue=alive('blue'),red=alive('red');
  if(!blue||!red){this.winner=!blue&&!red?'draw':blue?'blue':'red';this.log(this.winner==='draw'?'As duas forças foram neutralizadas.':`Vitória da Nação ${SIDE[this.winner]}.`);}
 }

 update(dt){
  if(this.winner||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);this.time+=dt;for(const u of this.units)u.cooldown=Math.max(0,u.cooldown-dt);
  const hits=[];for(const p of this.projectiles){p.elapsed+=dt;if(p.elapsed>=p.duration)hits.push(p);}this.projectiles=this.projectiles.filter(p=>p.elapsed<p.duration);for(const p of hits)this.impact(p);
  if(this.mode==='rts'){this.updateRTS(dt);this.checkVictory();return;}
  if(this.animation)this.animate(dt);else if(!this.projectiles.length&&this.actions.length){this.animation=this.actions.shift();this.animate(dt);}
  if(this.turn==='red'&&!this.busy){this.aiWait-=dt;if(this.aiWait<=0){const u=this.get(this.aiQueue.shift());if(u){this.aiAct(u);this.aiWait=.15;}else if(!this.aiQueue.length)this.beginTurn('blue');}}
  this.checkVictory();
 }
}
