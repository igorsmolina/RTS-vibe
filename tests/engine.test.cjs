// npm test — testa o motor real incorporado ao index.html, sem navegador.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const context=vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1]+'\nthis.Game=Game;this.TYPES=TYPES;',context);
const {Game,TYPES}=context;
assert.equal(typeof Game.prototype.update,'function','O motor deve avançar em tempo real');
function field(){const g=new Game('river','normal',17);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.aiEnabled=false;g.add('blue','hq',0,13);g.add('red','hq',17,0);g.add('blue','infantry',0,12);g.add('red','infantry',17,1);return g;}
function advance(g,seconds){for(let t=0;t<seconds-1e-8;t+=1/30)g.update(Math.min(1/30,seconds-t));}
let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
check('A* contorna água, usa pontes e respeita montanhas',()=>{
 const g=field(),u=g.add('blue','tank',3,5);for(let y=0;y<14;y++)g.terrain[y*18+4]='river';assert.equal(g.findPath(u,{x:5,y:5}),null);
 g.terrain[7*18+4]='bridge';const path=g.findPath(u,{x:5,y:5});assert.ok(path.some(p=>p.x===4&&p.y===7));assert.ok(path.every(p=>g.terrain[p.y*18+p.x]!=='river'));
 g.terrain[5*18+5]='mountain';assert.equal(g.findPath(u,{x:5,y:5}),null);assert.ok(g.findPath({...u,type:'infantry'},{x:5,y:5}));
});
check('Movimento suave, Stop e independência da frequência de renderização',()=>{
 const a=field(),b=field(),u=a.add('blue','recon',3,5),v=b.add('blue','recon',3,5);a.order(u,'move',{x:8,y:5});b.order(v,'move',{x:8,y:5});
 advance(a,.2);assert.ok(u.x>3&&u.x<4);advance(a,.8);for(let i=0;i<60;i++)b.update(1/60);assert.ok(Math.abs(u.x-v.x)<1e-6);
 a.order(u,'stop');const x=u.x;advance(a,1);assert.equal(u.x,x);
});
check('Grupos recebem destinos distintos e não sobrepõem reservas',()=>{
 const g=field(),u=g.add('blue','infantry',3,4),v=g.add('blue','infantry',3,5);g.command([u.id,v.id],'move',{x:8,y:6});assert.notDeepEqual(u.order.goal,v.order.goal);
 for(let i=0;i<300;i++){g.update(1/30);assert.ok(Math.hypot(u.x-v.x,u.y-v.y)>.45);}assert.ok(u.x>5&&v.x>5);
});
check('Renda simultânea a cada três segundos',()=>{
 const g=field();g.add('blue','post',5,8);g.difficulty='hard';advance(g,2.9);assert.equal(g.credits.blue,150);advance(g,.1);assert.equal(g.credits.blue,173);assert.equal(g.credits.red,168);advance(g,3);assert.equal(g.credits.blue,196);
});
check('Fila serial cobra uma vez e aguarda saída livre',()=>{
 const g=field();assert.equal(g.enqueue('blue','infantry'),true);assert.equal(g.credits.blue,100);g.enqueue('blue','recon');const q=g.hq('blue').queue;
 advance(g,3.9);assert.equal(q.length,2);advance(g,.1);assert.equal(q.length,1);assert.equal(g.units.filter(u=>u.owner==='blue').length,2);assert.equal(q[0].progress,0);
 const blocked=field();blocked.enqueue('blue','infantry');for(const p of blocked.spawnCells('blue','infantry'))if(!blocked.occupied(p.x,p.y))blocked.add('blue','tank',p.x,p.y);
 advance(blocked,4.2);assert.equal(blocked.hq('blue').queue.length,1);assert.equal(blocked.hq('blue').queue[0].progress,4);
 const remove=blocked.units.find(u=>u.type==='tank');blocked.units=blocked.units.filter(u=>u!==remove);advance(blocked,.1);assert.equal(blocked.hq('blue').queue.length,0);
});
check('Ataque automático aplica dano no impacto e respeita cadência',()=>{
 const g=field(),a=g.add('blue','infantry',5,5),b=g.add('red','hq',6,5);g.rng=()=>.2;g.updateVision();advance(g,1/30);assert.equal(g.projectiles.length,1);assert.equal(b.hp,300);
 advance(g,.3);assert.equal(b.hp,265);advance(g,.4);assert.equal(g.shotsFired,1);advance(g,.2);assert.equal(g.shotsFired,2);
});
check('Artilharia arma/desarma por 1,5s; área atinge diagonais e aliados',()=>{
 const g=field(),a=g.add('blue','artillery',4,6),b=g.add('red','hq',6,6),ally=g.add('blue','hq',7,7),outside=g.add('red','hq',8,8);g.rng=()=>.2;g.updateVision();
 advance(g,1.4);assert.equal(g.shotsFired,0);advance(g,.2);assert.equal(g.shotsFired,1);assert.equal(b.hp,300);advance(g,1);assert.equal(b.hp,230);assert.ok(ally.hp<300);assert.equal(outside.hp,300);
 g.order(a,'move',{x:3,y:6});const x=a.x;advance(g,1.4);assert.equal(a.x,x);advance(g,.4);assert.ok(a.x<x);
});
check('Reparo contínuo restaura 8 HP/s e respeita vida máxima',()=>{
 const g=field(),e=g.add('blue','engineer',5,5),t=g.add('blue','tank',6,5);t.hp=100;g.order(e,'repair',{targetId:t.id});advance(g,2);assert.ok(Math.abs(t.hp-116)<.01);t.hp=169;advance(g,1);assert.equal(t.hp,170);
});
check('Construção exige cinco segundos; cancelar devolve custo reservado',()=>{
 const g=field(),u=g.add('blue','infantry',6,8);assert.equal(g.order(u,'build'),true);assert.equal(g.credits.blue,90);advance(g,2);g.order(u,'stop');assert.equal(g.credits.blue,150);assert.equal(g.structureAt(6,8),undefined);
 g.order(u,'build');advance(g,4.9);assert.equal(g.structureAt(6,8),undefined);advance(g,.1);assert.equal(g.structureAt(6,8).type,'post');assert.ok(!g.units.includes(u));
});
check('Captura canalizada é reiniciada pelo dano',()=>{
 const g=field(),u=g.add('blue','infantry',6,8),p=g.add('neutral','post',6,8);g.updateVision();g.order(u,'capture',{targetId:p.id});advance(g,2);assert.equal(p.owner,'neutral');g.hurt(u,1,null);assert.equal(u.work,0);advance(g,2.9);assert.equal(p.owner,'neutral');advance(g,.1);assert.equal(p.owner,'blue');
});
check('Fog dinâmica não revela coordenadas ocultas ao perseguidor',()=>{
 const g=field(),u=g.add('blue','recon',2,5),e=g.add('red','tank',5,5);g.updateVision();g.order(u,'attack',{targetId:e.id});e.x=16;e.y=11;g.updateVision();advance(g,.1);
 assert.equal(g.isVisible('blue',e),false);assert.notEqual(u.order.targetId,e.id);assert.equal(g.explored.blue[5*18+5],true);
});
check('Aura, veterania e perda do comandante',()=>{
 const g=field(),u=g.add('blue','infantry',4,4),c=g.add('blue','commander',3,4),e=g.add('red','commander',5,4);assert.equal(g.attackPower(u),42);g.credits.red=101;g.hurt(e,999,u);assert.equal(g.credits.red,50);assert.equal(u.level,2);assert.equal(u.maxHp,110);c.x=10;assert.ok(Math.abs(g.attackPower(u)-38.5)<.01);
});
check('IA decide a cada 1,5s; defende base e retira feridos',()=>{
 const g=field();g.aiEnabled=true;const tank=g.add('red','tank',14,2),e=g.add('blue','infantry',15,2);g.updateVision();advance(g,1.4);assert.equal(g.aiDecisions,0);advance(g,.1);assert.equal(g.aiDecisions,1);assert.equal(g.aiState,'defend');
 tank.hp=20;g.hurt(e,999,null);advance(g,1.5);assert.equal(tank.order.type,'move');
});
check('Mapas conectados e saídas iniciais em 600 sementes',()=>{
 for(const map of ['river','desert','mountain','random'])for(let seed=1;seed<=150;seed++){
  const g=new Game(map,'normal',seed),army=g.units;g.units=[];
  for(const u of army)assert.ok(g.findPath(u,u.owner==='blue'?{x:2,y:9}:{x:15,y:4}),`${map}/${seed}/${u.type}`);
  assert.ok(g.findPath({type:'tank',owner:'blue',x:1,y:12},{x:15,y:1}));
 }
});
check('A* escolhe a estrada mais barata e bloqueio não debita produção',()=>{
 const g=field(),u=g.add('blue','tank',3,3);g.terrain[3*18+4]='forest';for(const [x,y]of [[3,2],[4,2],[5,2],[5,3]])g.terrain[y*18+x]='road';
 const p=g.findPath(u,{x:5,y:3});assert.equal(p.length,4);assert.equal(p[0].y,2);const credits=g.credits.blue;assert.equal(g.enqueue('blue','commander'),false);assert.equal(g.credits.blue,credits);
});
check('Atacar-mover enfrenta contatos; mover direto prioriza deslocamento',()=>{
 const g=field(),a=g.add('blue','infantry',4,5),target=g.add('red','hq',5,5);g.updateVision();g.order(a,'move',{x:4,y:8});advance(g,.5);assert.equal(g.shotsFired,0);assert.ok(a.y>5);
 g.order(a,'attackMove',{x:4,y:5});advance(g,2);assert.ok(g.shotsFired>0);assert.ok(target.hp<300);
});
check('Batedor permite fogo indireto e recuar restaura névoa',()=>{
 const g=field(),a=g.add('blue','artillery',4,6),target=g.add('red','hq',9,6);g.updateVision();assert.equal(g.canFire(a,target),false);
 const scout=g.add('blue','recon',7,8);g.updateVision();assert.equal(g.canFire(a,target),true);scout.x=1;scout.y=12;g.updateVision();assert.equal(g.canFire(a,target),false);assert.equal(g.explored.blue[6*18+9],true);
});
check('Mina explode ao entrar na célula e engenheiro desarma por canalização',()=>{
 const g=field(),u=g.add('blue','tank',4,6);g.mines.push({x:5,y:6,known:{blue:false,red:false}});g.order(u,'move',{x:6,y:6});advance(g,1);assert.equal(u.hp,130);assert.equal(g.mines.length,0);
 const e=g.add('blue','engineer',8,8);g.mines.push({x:9,y:8,known:{blue:false,red:false}});g.updateVision();assert.equal(g.mines[0].known.blue,true);g.order(e,'demine',{x:9,y:8});advance(g,1.9);assert.equal(g.mines.length,1);advance(g,.1);assert.equal(g.mines.length,0);
});
check('Partidas de dois minutos mantêm integridade, colisões e desempenho',()=>{
 for(const map of ['river','desert','mountain','random']){
  const g=new Game(map,'hard',138);g.command(g.units.filter(u=>u.owner==='blue').map(u=>u.id),'attackMove',{x:15,y:3});
  let furthest=0;for(let i=0;i<3600&&!g.winner;i++){
   if(i%450===0)g.enqueue('blue','tank');g.update(1/30);g.events=[];
   for(const u of g.units){assert.ok(Number.isFinite(u.x)&&Number.isFinite(u.y));assert.ok(u.hp>0&&u.hp<=u.maxHp+.001);const p={x:Math.round(u.x),y:Math.round(u.y)};assert.ok(Number.isFinite(g.cost(u,p.x,p.y)));}
   if(i%30===0)for(let a=0;a<g.units.length;a++)for(let b=a+1;b<g.units.length;b++)assert.ok(Math.hypot(g.units[a].x-g.units[b].x,g.units[a].y-g.units[b].y)>.35,`${map}: sobreposição ${g.units[a].id}/${g.units[b].id}`);
   furthest=Math.max(furthest,...g.units.filter(u=>u.owner==='red').map(u=>17-u.x));
  }
  assert.ok(g.aiDecisions>5);assert.ok(g.shotsFired>0,map+' deve ter combate');assert.ok(furthest>6,map+' IA deve avançar');assert.ok(g.credits.blue>=0&&g.credits.red>=0);
 }
});
console.log(`${checks} verificações RTS passaram.`);
