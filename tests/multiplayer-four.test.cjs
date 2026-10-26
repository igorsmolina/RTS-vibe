'use strict';
// Multiplayer com quatro jogadores: quarto lado (gold) no motor, núcleo do multiplayer e transporte sem fila.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const engineNames='Game,TYPES,ROWS,COLS,DIST,TILE,KEY,STANDARD_FACTIONS,ROXO,FRANCE,MAPS,NATION_DOCTRINES,PROCEDURAL,STARTING_DEFAULT,STARTING_BUDGET,UNIT_CAP,startingCatalog,armyCost,cleanStartingArmy,cleanFactions,STEP,SIZE,AIR,MISSILE';
const engine=new Function(fs.readFileSync(path.join(__dirname,'..','public','js','engine.js'),'utf8')+';return {'+engineNames+'};')();
const {Game,ROWS,COLS,DIST,cleanFactions}=engine,cases=[],test=(name,fn)=>cases.push([name,fn]);
const MAPS4=['river','desert','mountain','random'],SEEDS=[1,7,123],FOUR={blue:'blue',red:'red',green:'franca',gold:'roxo'};
const make=(map,seed,factions)=>new Game(map,'normal',seed,'rts',{posts:2},{},{},null,factions);

test('quatro lados: QG, comandante e exército em cada canto',()=>{
 for(const map of MAPS4)for(const seed of SEEDS){
  const g=make(map,seed,FOUR);assert.deepEqual(g.sides,['blue','red','green','gold']);
  for(const side of g.sides){
   const hqs=g.structures.filter(s=>s.owner===side&&s.type==='hq');assert.equal(hqs.length,1,side+' tem 1 QG');
   for(const u of g.units.filter(u=>u.owner===side))assert.ok(DIST(u,hqs[0])<=12,map+seed+' '+side+' '+u.type+' longe do QG');
  }
  const gold=g.structures.find(s=>s.owner==='gold'&&s.type==='hq');assert.ok(gold.x<COLS/2&&gold.y<ROWS/2,'o QG gold fica no canto superior esquerdo');
  const mine=g.units.filter(u=>u.owner==='gold');assert.ok(mine.length>0&&mine.every(u=>u.faction==='roxo'),'unidades gold são roxas');
 }
});
test('quatro lados: cada QG chega ao centro por terra',()=>{
 for(const map of MAPS4)for(const seed of SEEDS){
  const g=make(map,seed,FOUR),mid={x:COLS/2,y:ROWS/2};
  for(const side of g.sides){
   const start=g.units.find(u=>u.owner===side&&u.type==='commander'),seen=new Set([start.y*COLS+start.x]),queue=[[start.x,start.y]];let reached=false;
   while(queue.length&&!reached){const [x,y]=queue.shift();if(DIST({x,y},mid)<=3){reached=true;break;}for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=ny*COLS+nx;if(nx<0||ny<0||nx>=COLS||ny>=ROWS||seen.has(k)||!Number.isFinite(g.cost({type:'infantry'},nx,ny)))continue;seen.add(k);queue.push([nx,ny]);}}
   assert.ok(reached,map+seed+' '+side+' sem caminho por terra até o centro');
  }
 }
});
const REF={"river12":"479047d1d4fdec8e","river13":"8eaa52192c55711e","river72":"dd4da5e37a783e42","river73":"79f341dea224099c","river1232":"126af79a4fc2c301","river1233":"c48ce2c42a397a06","desert12":"0cb54bea00325b35","desert13":"bf4a4eb271fc8c93","desert72":"f38ad4ffa29cbde9","desert73":"314636e515f98f08","desert1232":"94d1d26553b29d34","desert1233":"50816526b17be9cd","mountain12":"f30a2a3ea2494db5","mountain13":"ca5d2a9ab36165d0","mountain72":"5e5831ddded932bc","mountain73":"47f22a829563718c","mountain1232":"614be955946ccaa4","mountain1233":"1ab5dc96715172fb","random12":"c9c05b2bcdf49e2b","random13":"4226cc0ad3fd4b8e","random72":"f76ecb1cdbb4a3f1","random73":"610f80512c175f5c","random1232":"1f2514f8b5b16bb9","random1233":"a4845d3cb64e882e"};
test('dois e três lados não mudam (terreno, estruturas e unidades iguais ao motor anterior)',()=>{
 for(const map of MAPS4)for(const seed of SEEDS)for(const [k,f] of [['2',{blue:'blue',red:'red'}],['3',{blue:'blue',red:'red',green:'franca'}]]){
  const g=make(map,seed,f),h=crypto.createHash('sha256').update(JSON.stringify([g.terrain,g.structures.map(s=>[s.type,s.owner,s.x,s.y]),g.units.map(u=>[u.type,u.owner,u.x,u.y])])).digest('hex').slice(0,16);
  assert.equal(h,REF[map+seed+k],map+seed+' com '+k+' lados mudou');
 }
});
test('facção inválida no lado amarelo vira roxa, e sem verde o amarelo não existe',()=>{
 assert.equal(cleanFactions({blue:'blue',red:'red',green:'franca',gold:'x'}).gold,'roxo');
 assert.equal(cleanFactions({blue:'blue',red:'red',gold:'franca'}).gold,undefined);
});

// ---- núcleo do multiplayer ----
const {createCore}=require('../public/js/multiplayer-core.js');
function rig(){
 let time=1000;const core=createCore(engine,{now:()=>time});
 const socket=()=>{const s={inbox:[],bufferedAmount:0,closed:null,send(t){this.inbox.push(JSON.parse(t));},close(code,reason){this.closed={code,reason};}};core.attach(s);return s;};
 const say=(s,m)=>core.receive(s,JSON.stringify(m)),last=(s,type)=>s.inbox.filter(m=>m.type===type).at(-1);
 const created=core.createRoom('Anfitrião',{map:'river',mode:'rts',seed:5}),room=core.rooms.get(created.code),host=socket();say(host,{type:'auth',version:1,code:created.code,token:created.token});
 const players=[host],add=n=>{const s=socket();say(s,{type:'join',version:1,code:created.code,nickname:'J'+n});const joined=last(s,'joined');say(s,{type:'auth',version:1,code:created.code,token:joined.token});players.push(s);return s;};
 return {core,room,host,players,add,say,last,socket,created,tick:(n=1)=>{for(let i=0;i<n;i++){core.tick();time+=1000/30;}}};
}
const startAll=r=>{for(const s of r.players)r.say(s,{type:'ready',ready:true});r.say(r.host,{type:'start'});assert.equal(r.room.status,'playing');};
test('sala de quatro: entram 4, o 5º recebe sala cheia, a partida tem 4 lados e facções padrão',()=>{
 const r=rig();for(let i=1;i<4;i++)r.add(i);
 assert.deepEqual(r.room.players.map(p=>p.side),['blue','red','green','gold']);
 const fifth=r.socket();r.say(fifth,{type:'join',version:1,code:r.created.code,nickname:'Quinto'});assert.equal(r.last(fifth,'error').code,'room_full');assert.ok(fifth.closed);
 startAll(r);assert.deepEqual({...r.room.game.factions},FOUR);
 for(const s of r.players){const st=r.last(s,'state').state;assert.equal(st.playerSide,r.room.players[r.players.indexOf(s)].side);assert.ok(st.units.every(u=>u.owner===st.playerSide||u.hp>0));}
});
test('eliminação com quatro: a partida segue até sobrar um',()=>{
 const r=rig();for(let i=1;i<4;i++)r.add(i);startAll(r);
 r.say(r.players[3],{type:'surrender'});assert.equal(r.room.status,'playing');assert.ok(r.room.game.out.includes('gold'));
 r.say(r.players[2],{type:'surrender'});assert.equal(r.room.status,'playing');
 r.say(r.players[1],{type:'surrender'});assert.equal(r.room.status,'finished');assert.equal(r.room.result.winner,'blue');
});
test('revanche gira os quatro lados',()=>{
 const r=rig();for(let i=1;i<4;i++)r.add(i);startAll(r);
 r.say(r.players[3],{type:'surrender'});r.say(r.players[2],{type:'surrender'});r.say(r.players[1],{type:'surrender'});assert.equal(r.room.status,'finished');
 for(const s of r.players)r.say(s,{type:'rematch'});
 assert.equal(r.room.status,'waiting');assert.deepEqual(r.room.players.map(p=>p.side),['red','green','gold','blue']);
});
test('estado pulado com a fila cheia; mensagens que não são estado seguem; volta quando esvazia',()=>{
 const r=rig();for(let i=1;i<4;i++)r.add(i);startAll(r);
 const slow=r.players[1],counts=()=>r.players.map(s=>s.inbox.filter(m=>m.type==='state').length);
 slow.bufferedAmount=2*1024*1024;const before=counts();r.tick(9);const after=counts();
 assert.equal(after[1],before[1],'jogador lento não recebe estado');assert.ok(after[0]>before[0]&&after[2]>before[2]&&after[3]>before[3],'os outros recebem');
 r.say(slow,{type:'surrender'});assert.ok(r.last(slow,'room'),'sala/resultado continuam chegando ao lento');
 slow.bufferedAmount=0;const again=counts()[1];r.tick(9);assert.ok(counts()[1]>again,'volta a receber');
});
test('desempenho com quatro jogadores (50 unidades cada, combate RTS)',()=>{
 const r=rig();for(let i=1;i<4;i++)r.add(i);startAll(r);const g=r.room.game,KINDS=['infantry','tank','lightTank','antitank','machinegun','recon','helicopter','artillery'];
 for(const side of g.sides){const hq=g.structures.find(s=>s.owner===side&&s.type==='hq');let placed=0,i=0;while(placed<50&&i<5000){const x=Math.max(1,Math.min(126,Math.round(hq.x)+((i%10)-5)*2)),y=Math.max(1,Math.min(94,Math.round(hq.y)+(Math.floor(i/10)-5)*2*(hq.y>48?-1:1)));try{if(g.add(side,KINDS[placed%KINDS.length],x,y))placed++;}catch{}i++;}}
 g.updateVision();for(const u of g.units)g.order(u,'attackMove',{x:64,y:48},true);
 for(const s of r.players)s.inbox.length=0;let bytes=0;const orig=r.players[0].send;r.players[0].send=function(t){bytes+=t.length;return orig.call(this,t);};
 const ticks=[];for(let i=0;i<600;i++){const t=performance.now();r.tick();ticks.push(performance.now()-t);}ticks.sort((a,b)=>a-b);
 const p95=ticks[Math.floor(.95*(ticks.length-1))],max=ticks.at(-1),size=JSON.stringify(r.core.viewState(r.room,'blue')).length/1024,kbs=bytes/1024/20;
 console.log('   4 jogadores: tick p95 '+p95.toFixed(1)+' ms, máx. '+max.toFixed(1)+' ms, estado '+size.toFixed(1)+' KB, '+kbs.toFixed(0)+' KB/s por jogador, unidades '+g.units.length);
 assert.ok(p95<=10,'tick p95 '+p95);assert.ok(max<=60,'tick máx. '+max);assert.ok(size<=45,'estado '+size+' KB');assert.ok(kbs<=450,kbs+' KB/s');
});
//@@MAIS-TESTES@@
if(require.main===module){for(const [name,fn] of cases){fn();console.log('OK '+name);}console.log(cases.length+' verificações de multiplayer com quatro jogadores passaram.');}
