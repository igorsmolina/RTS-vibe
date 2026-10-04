// Motor real de js/engine.js, sem navegador: turnos, RTS, tanques e gerador. node tests/engine.test.cjs
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','engine.js'),'utf8')+'\nthis.Game=Game;this.TYPES=TYPES;this.COLS=COLS;this.ROWS=ROWS;this.KEY=KEY;this.DIST=DIST;this.TERRAIN=TERRAIN;this.MAPS=MAPS;',ctx);const {Game,TYPES,COLS,ROWS,KEY,DIST,TERRAIN,MAPS}=ctx;
// --- engine ---
{
function field(){const g=new Game('river','normal',17);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.aiEnabled=false;g.add('blue','hq',0,13);g.add('red','hq',17,0);g.add('blue','infantry',0,12);g.add('red','infantry',17,1);g.rng=()=>.2;g.updateVision();return g;}
function advance(g,seconds){for(let t=0;t<seconds-1e-8;t+=1/30)g.update(1/30);}
function settle(g){let ticks=0;while((g.busy||g.turn==='red')&&!g.winner&&ticks++<20000)g.update(1/30);assert.ok(ticks<20000,'Ordem/turno deve terminar');}
function cycle(g){assert.equal(g.endTurn(),true);settle(g);assert.equal(g.turn,'blue');}
function snapshot(g){return JSON.stringify({units:g.units.map(u=>[u.id,u.x,u.y,u.hp,u.moveLeft,u.actionLeft]),credits:g.credits,queues:g.structures.map(s=>s.queue),round:g.round,decisions:g.aiDecisions,shots:g.shotsFired});}
let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
check('Planejamento sem limite: IA, combate, recursos e produção imóveis',()=>{const g=field(),u=g.add('blue','infantry',5,5);g.add('red','tank',6,5);g.updateVision();g.aiEnabled=true;g.enqueue('blue','infantry');const before=snapshot(g);advance(g,120);assert.equal(snapshot(g),before);});
check('A* contorna água, usa pontes e respeita montanhas',()=>{const g=field(),u=g.add('blue','tank',3,5);for(let y=0;y<ROWS;y++)g.terrain[y*COLS+4]='river';assert.equal(g.findPath(u,{x:5,y:5}),null);g.terrain[7*COLS+4]='bridge';const route=g.findPath(u,{x:5,y:5});assert.ok(route.some(p=>p.x===4&&p.y===7));assert.ok(route.every(p=>g.terrain[p.y*COLS+p.x]!=='river'));g.terrain[5*COLS+5]='mountain';assert.equal(g.findPath(u,{x:5,y:5}),null);assert.ok(g.findPath({...u,type:'infantry'},{x:5,y:5}));});
check('Movimento suave limitado, fracionável e sem gastar ação',()=>{const g=field(),u=g.add('blue','infantry',3,5);assert.ok(g.order(u,'move',{x:4,y:5}));advance(g,.1);assert.ok(u.x>3&&u.x<4);assert.equal(g.endTurn(),false);settle(g);assert.equal(u.moveLeft,2);assert.equal(u.actionLeft,true);assert.ok(g.order(u,'move',{x:10,y:5}));settle(g);assert.equal(u.x,6);assert.equal(u.moveLeft,0);assert.equal(g.order(u,'move',{x:7,y:5}),false);});
check('Estrada custa meio ponto; veículo gasta dois em floresta',()=>{const g=field(),u=g.add('blue','tank',3,5);for(let x=4;x<=10;x++)g.terrain[5*COLS+x]='road';g.order(u,'move',{x:10,y:5});settle(g);assert.equal(u.x,10);assert.equal(u.moveLeft,.5);g.terrain[6*COLS+10]='forest';assert.equal(g.order(u,'move',{x:10,y:6}),false);const v=g.add('blue','tank',8,7);g.terrain[8*COLS+8]='forest';g.order(v,'move',{x:8,y:8});settle(g);assert.equal(v.moveLeft,2);});
check('Seleção em grupo não sobrepõe unidades nem ultrapassa orçamento',()=>{const g=field(),a=g.add('blue','infantry',3,4),b=g.add('blue','infantry',3,5);assert.equal(g.command([a.id,a.id,b.id],'move',{x:8,y:5}),2);settle(g);assert.notEqual(a.x+','+a.y,b.x+','+b.y);assert.ok(Math.abs(a.x-3)+Math.abs(a.y-4)<=3);assert.ok(Math.abs(b.x-3)+Math.abs(b.y-5)<=3);});
check('Ataque usa uma ação, dano somente no impacto, sem reação automática',()=>{const g=field(),a=g.add('blue','infantry',5,5),b=g.add('red','tank',6,5);g.updateVision();assert.ok(g.order(a,'attack',{targetId:b.id}));advance(g,.1);assert.equal(b.hp,170);assert.equal(a.actionLeft,false);settle(g);assert.equal(b.hp,135);assert.equal(g.shotsFired,1);assert.equal(a.hp,100);assert.equal(g.order(a,'attack',{targetId:b.id}),false);advance(g,30);assert.equal(b.hp,135);});
check('Ataque aproxima usando movimento e permite recuar com o restante',()=>{const g=field(),a=g.add('blue','infantry',3,5),b=g.add('red','tank',6,5);g.updateVision();assert.ok(g.order(a,'attack',{targetId:b.id}));settle(g);assert.equal(a.x,5);assert.equal(a.moveLeft,1);assert.equal(a.actionLeft,false);g.order(a,'move',{x:4,y:5});settle(g);assert.equal(a.x,4);assert.equal(a.moveLeft,0);});
check('Aguardar consome movimento/ação e entrincheira; novo turno restaura pontos',()=>{const g=field(),a=g.add('blue','infantry',5,5);assert.ok(g.order(a,'stop'));assert.equal(a.moveLeft,0);assert.equal(a.actionLeft,false);assert.equal(a.entrenched,true);assert.equal(g.order(a,'move',{x:6,y:5}),false);cycle(g);assert.equal(a.moveLeft,3);assert.equal(a.actionLeft,true);});
check('Artilharia não move e atira no mesmo turno em nenhuma ordem',()=>{for(const first of ['move','attack']){const g=field(),a=g.add('blue','artillery',4,6),target=g.add('red','hq',6,6);g.updateVision();assert.ok(g.order(a,first,first==='move'?{x:3,y:6}:{targetId:target.id}));settle(g);assert.equal(g.order(a,first==='move'?'attack':'move',first==='move'?{targetId:target.id}:{x:3,y:6}),false);}});
check('Artilharia mantém área 3x3 incluindo diagonais e fogo amigo',()=>{const g=field(),a=g.add('blue','artillery',4,6),b=g.add('red','hq',6,6),ally=g.add('blue','hq',7,7),outside=g.add('red','hq',8,8);g.updateVision();g.order(a,'attack',{targetId:b.id});advance(g,.3);assert.equal(b.hp,300);assert.ok(g.projectiles.length);settle(g);assert.equal(b.hp,230);assert.equal(a.moveLeft,0);assert.ok(ally.hp<300);assert.equal(outside.hp,300);});
check('Metralhador dispara rajada de três tiros por uma ação',()=>{const g=field(),a=g.add('blue','machinegun',5,5),b=g.add('red','infantry',6,5);g.updateVision();g.order(a,'attack',{targetId:b.id});settle(g);assert.equal(g.shotsFired,3);assert.equal(b.hp,31);assert.equal(a.actionLeft,false);assert.equal(g.order(a,'attack',{targetId:b.id}),false);});
check('Antitanque preserva especialidade e dano contra veículos',()=>{const g=field(),a=g.add('blue','antitank',5,5),foot=g.add('red','infantry',6,5),tank=g.add('red','tank',7,5);g.updateVision();assert.equal(g.acquire(a),tank);assert.equal(g.acquire({...a,type:'machinegun'}),foot);g.order(a,'attack',{targetId:tank.id});settle(g);assert.equal(tank.hp,80);});
check('Reparo aplica 24 HP por ação e não continua sozinho',()=>{const g=field(),a=g.add('blue','engineer',5,5),b=g.add('blue','tank',6,5);b.hp=100;g.order(a,'repair',{targetId:b.id});settle(g);assert.equal(b.hp,124);advance(g,30);assert.equal(b.hp,124);assert.equal(g.order(a,'repair',{targetId:b.id}),false);cycle(g);b.hp=169;g.order(a,'repair',{targetId:b.id});settle(g);assert.equal(b.hp,170);});
check('Captura usa uma ação; construção cobra 60 uma vez e converte a infantaria',()=>{const g=field(),a=g.add('blue','infantry',5,5),p=g.add('neutral','post',7,5);g.updateVision();g.order(a,'capture',{targetId:p.id});settle(g);assert.equal(p.owner,'blue');assert.equal(a.x,6);assert.equal(a.actionLeft,false);assert.equal(a.moveLeft,2);const b=g.add('blue','infantry',10,10),credits=g.credits.blue;assert.ok(g.order(b,'build'));assert.equal(g.order(b,'build'),false);settle(g);assert.equal(g.credits.blue,credits-60);assert.equal(g.structureAt(10,10).type,'post');assert.equal(g.get(b.id),undefined);});
check('Mina explode em movimento; engenheiro desarma com uma ação',()=>{const g=field(),a=g.add('blue','tank',4,6);g.mines.push({x:5,y:6,known:{blue:false,red:false}});g.order(a,'move',{x:6,y:6});settle(g);assert.equal(a.hp,130);assert.equal(g.mines.length,0);const e=g.add('blue','engineer',8,8);g.mines.push({x:9,y:8,known:{blue:false,red:false}});g.updateVision();g.order(e,'demine',{x:9,y:8});settle(g);assert.equal(g.mines.length,0);assert.equal(e.actionLeft,false);});
check('Renda uma vez por início do turno, sem renda dupla na rodada inicial',()=>{const g=field();g.add('blue','post',5,8);g.difficulty='hard';assert.equal(g.endTurn(),true);assert.equal(g.credits.red,150);assert.equal(g.endTurn(),false);settle(g);assert.equal(g.credits.blue,173);assert.equal(g.round,2);advance(g,60);assert.equal(g.credits.blue,173);assert.ok(g.endTurn());assert.equal(g.credits.red,168);settle(g);assert.equal(g.credits.blue,196);});
check('Dificuldade ajusta renda inimiga: fácil 12, normal 15, difícil 18',()=>{const g=field();for(const [level,value]of [['easy',12],['normal',15],['hard',18]]){g.difficulty=level;assert.equal(g.income('red'),value);assert.equal(g.income('blue'),15);}});
check('Fila serial produz em 1/2/3 turnos e cobra uma vez',()=>{for(const [type,turns] of [['infantry',1],['antitank',2],['machinegun',2],['tank',3],['artillery',3]]){const g=field();g.credits.blue=500;assert.ok(g.enqueue('blue',type));assert.equal(g.credits.blue,500-TYPES[type].cost);g.enqueue('blue','recon');for(let i=0;i<turns-1;i++){cycle(g);assert.equal(g.hq('blue').queue.length,2);}cycle(g);assert.equal(g.hq('blue').queue.length,1);assert.equal(g.hq('blue').queue[0].progress,0);const u=g.units.find(u=>u.owner==='blue'&&u.type===type&&u.y!==12);assert.ok(u);assert.equal(u.moveLeft,TYPES[type].move);assert.equal(u.actionLeft,true);}});
check('Produção pronta espera próximo turno com saída livre, sem duplicar custo',()=>{const g=field();g.enqueue('blue','infantry');for(const p of g.spawnCells('blue','infantry'))if(!g.occupied(p.x,p.y))g.add('blue','tank',p.x,p.y);cycle(g);assert.equal(g.hq('blue').queue[0].progress,1);const u=g.units.find(u=>u.type==='tank');g.units=g.units.filter(v=>v!==u);advance(g,30);assert.equal(g.hq('blue').queue.length,1);cycle(g);assert.equal(g.hq('blue').queue.length,0);assert.equal(g.credits.blue,130);});
check('Névoa oculta inimigos mesmo em terreno explorado; ataque exige visão',()=>{const g=field(),a=g.add('blue','recon',2,5),enemy=g.add('red','tank',5,5);g.updateVision();assert.equal(g.isVisible('blue',enemy),true);a.x=0;a.y=13;g.updateVision();assert.equal(g.isVisible('blue',enemy),false);assert.equal(g.explored.blue[5*COLS+5],true);assert.equal(g.order(a,'attack',{targetId:enemy.id}),false);});
check('Reconhecimento aliado permite artilharia além de sua visão própria',()=>{const g=field(),a=g.add('blue','artillery',4,6),target=g.add('red','hq',9,6);g.updateVision();assert.equal(g.canFire(a,target),false);const scout=g.add('blue','recon',7,8);g.updateVision();assert.equal(g.canFire(a,target),true);scout.x=1;scout.y=12;g.updateVision();assert.equal(g.canFire(a,target),false);});
check('Aura, veterania e perda do comandante preservadas',()=>{const g=field(),a=g.add('blue','infantry',4,4),c=g.add('blue','commander',3,4),e=g.add('red','commander',5,4);assert.equal(g.attackPower(a),42);g.credits.red=101;g.hurt(e,999,a);assert.equal(g.credits.red,50);assert.equal(a.level,2);assert.equal(a.maxHp,110);c.x=10;assert.ok(Math.abs(g.attackPower(a)-38.5)<.01);});
check('IA só joga após Enter, impede ordens do jogador e devolve controle',()=>{const g=field();g.aiEnabled=true;const a=g.add('red','tank',14,2);g.add('blue','infantry',15,2);g.updateVision();advance(g,10);assert.equal(g.aiDecisions,0);assert.equal(g.order(a,'move',{x:13,y:2}),false);g.endTurn();assert.equal(g.command([g.units[0].id],'stop'),0);assert.equal(g.enqueue('blue','infantry'),false);assert.equal(g.endTurn(),false);settle(g);assert.ok(g.aiDecisions>0);assert.equal(g.turn,'blue');assert.equal(g.round,2);assert.equal(g.aiState,'defend');});
check('IA repara aliados feridos e retira veículos gravemente danificados',()=>{const g=field(),e=g.add('red','engineer',14,3),tank=g.add('red','tank',13,3);tank.hp=90;g.beginTurn('red');assert.ok(g.order(e,'repair',{targetId:tank.id}));settle(g);assert.equal(tank.hp,114);g.beginTurn('red');tank.hp=20;g.aiAct(tank);assert.equal(tank.order.type,'move');});
check('Mapas conectados e simétricos em 200 sementes',()=>{for(const map of ['river','desert','mountain','random'])for(let seed=1;seed<=50;seed++){const g=new Game(map,'normal',seed);g.units=[];const tank={type:'tank',owner:'blue',x:4,y:ROWS-2};assert.ok(g.findPath(tank,{x:COLS-5,y:1}),map+'/'+seed);for(const p of g.structures.filter(s=>s.type==='post'))assert.ok([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>g.findPath(tank,{x:p.x+dx,y:p.y+dy})),'Posto acessível '+map+'/'+seed);for(let k=0;k<COLS*ROWS;k++)assert.equal(g.terrain[k],g.terrain[COLS*ROWS-1-k]);}});
check('Gerador procedural respeita água, floresta, montanha e postos',()=>{const count=(g,t)=>g.terrain.filter(v=>v===t).length;for(let seed=1;seed<=20;seed++){const dry=new Game('random','normal',seed,'turns',{water:0,forest:0,mountain:0,posts:4});assert.equal(count(dry,'river')+count(dry,'bridge')+count(dry,'mountain')+count(dry,'forest'),0);assert.equal(dry.structures.filter(s=>s.type==='post').length,4);const wild=new Game('random','normal',seed,'turns',{water:1,forest:1,mountain:1,posts:12});assert.ok(count(wild,'river')>0&&count(wild,'forest')>count(dry,'forest')&&count(wild,'mountain')>0,'seed '+seed);assert.equal(wild.structures.filter(s=>s.type==='post').length,12);assert.deepEqual(new Game('random','normal',seed,'turns',{water:1,forest:1,mountain:1,posts:12}).terrain,wild.terrain);}});
check('Partidas em quatro mapas: 12 rodadas sem travar, sobreposição ou terreno inválido',()=>{for(const map of ['river','desert','mountain','random']){const g=new Game(map,'normal',71);for(let round=0;round<12&&!g.winner;round++){g.endTurn();settle(g);const positions=new Set();for(const u of g.units){assert.ok(Number.isFinite(g.cost(u,u.x,u.y)),map+'/'+u.type);assert.ok(u.hp>0&&u.hp<=u.maxHp);assert.ok(u.moveLeft>=0);const key=u.x+','+u.y;assert.ok(!positions.has(key),'Sobreposição '+map+'/'+key);positions.add(key);}}assert.ok(g.aiDecisions>0);assert.ok(g.round>2||g.winner);}});
check('Supressão: tropa atingida perde 25 pontos de precisão até o fim do próximo turno dela',()=>{const g=field(),a=g.add('blue','infantry',5,5),b=g.add('red','infantry',6,5),hq=g.structures[0];g.updateVision();const base=g.accuracy(b,a);g.hurt(b,10,a);assert.ok(Math.abs(g.accuracy(b,a)-(base-.25))<1e-9);g.hurt(b,10,a);assert.equal(b.suppressed,2,'Não acumula');g.beginTurn('red');assert.ok(Math.abs(g.accuracy(b,a)-(base-.25))<1e-9,'Vale no turno da vítima');g.beginTurn('blue');assert.ok(Math.abs(g.accuracy(b,a)-base)<1e-9);g.hurt(hq,10,b);assert.equal(hq.suppressed,0,'Estruturas não ficam suprimidas');});
check('Floresta esconde tropas além de 2 casas; batedor vê a 3; disparo revela até o próximo turno',()=>{const g=field(),eye=g.add('blue','infantry',5,5),hidden=g.add('red','infantry',9,5);g.terrain[KEY(9,5)]=g.terrain[KEY(7,5)]='forest';g.updateVision();assert.equal(g.isVisible('blue',hidden),false);assert.equal(g.explored.blue[KEY(9,5)],true,'Casa explorada continua no mapa');
 const tank=g.add('blue','tank',6,5);g.updateVision();assert.equal(g.canFire(tank,hidden),false,'Sem visão não há tiro direto');tank.hp=0;g.units=g.units.filter(u=>u.hp>0);
 hidden.x=7;g.updateVision();assert.equal(g.isVisible('blue',hidden),true,'A 2 casas a floresta não esconde');hidden.x=9;const recon=g.add('blue','recon',6,5);g.updateVision();assert.equal(g.isVisible('blue',hidden),true,'Batedor detecta a 3 casas');g.units=g.units.filter(u=>u!==recon);g.updateVision();assert.equal(g.isVisible('blue',hidden),false);
 g.shoot(hidden,eye);g.updateVision();assert.equal(g.isVisible('blue',hidden),true,'Disparo revela');g.beginTurn('blue');g.beginTurn('red');g.updateVision();assert.equal(g.isVisible('blue',hidden),false,'Volta a se esconder');});
check('Batedor segue a menor distância; outros veículos preferem a rota mais rápida',()=>{const g=field();for(let x=3;x<=9;x++)g.terrain[KEY(x,3)]='road';g.terrain[KEY(3,4)]=g.terrain[KEY(9,4)]='road';const tank=g.add('blue','tank',3,5),recon=g.add('blue','recon',3,6);
 assert.equal(g.findPath(tank,{x:9,y:5}).length,10,'Tanque desvia pela estrada (custo 5,5 < 6)');const direct=g.findPath({...recon,y:5},{x:9,y:5});assert.equal(direct.length,6,'Batedor vai em linha reta');
 g.terrain[KEY(6,5)]='forest';assert.equal(g.findPath({...recon,y:5},{x:9,y:5}).length,6,'Floresta no caminho não faz o batedor desviar');g.terrain[KEY(6,5)]='plain';g.terrain[KEY(4,5)]=g.terrain[KEY(5,5)]=g.terrain[KEY(5,6)]='road';
 const tie=g.findPath({...recon,y:5},{x:5,y:7});assert.equal(tie.length,4);assert.equal(JSON.stringify(tie.slice(0,3)),JSON.stringify([{x:4,y:5},{x:5,y:5},{x:5,y:6}]),'Empate de distância desempata pela estrada');});
console.log(checks+' verificações concluídas.');
}
// --- rts ---
{
function field(){const g=new Game('river','normal',17,'rts');g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.aiEnabled=false;g.add('blue','hq',0,13);g.add('red','hq',17,0);g.add('blue','infantry',0,12);g.add('red','infantry',17,1);g.rng=()=>.2;g.updateVision();return g;}
function advance(g,seconds){for(let t=0;t<seconds-1e-8;t+=1/30){g.update(Math.min(1/30,seconds-t));const occupied=new Set();for(const u of g.units){assert.ok(Number.isFinite(u.x)&&Number.isFinite(u.y));const key=u.x+','+u.y;assert.ok(!occupied.has(key),'Tropas não devem sobrepor');occupied.add(key);}}}
function snapshot(g){return JSON.stringify({time:g.time,units:g.units,structures:g.structures,credits:g.credits,projectiles:g.projectiles,decisions:g.aiDecisions,shots:g.shotsFired});}
let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
check('RTS é opcional e não encerra turnos',()=>{assert.equal(new Game().mode,'turns');const g=field();assert.equal(g.mode,'rts');assert.equal(g.endTurn(),false);assert.equal(g.round,1);});
check('Tropas movem simultaneamente além do orçamento por turno',()=>{const g=field(),a=g.add('blue','infantry',3,5),b=g.add('blue','infantry',3,7);assert.ok(g.order(a,'move',{x:10,y:5}));assert.ok(g.order(b,'move',{x:10,y:7}));advance(g,.2);assert.ok(a.x>3&&b.x>3,'Ambas devem avançar no mesmo intervalo');advance(g,6);assert.equal(a.x,10);assert.equal(b.x,10);assert.equal(a.y,5);assert.equal(b.y,7);});
check('Velocidade por classe e custo do terreno controlam deslocamento',()=>{const plain=field(),forest=field(),road=field();const a=plain.add('blue','tank',3,5),b=forest.add('blue','tank',3,5),c=road.add('blue','tank',3,5);forest.terrain[5*COLS+4]='forest';road.terrain[5*COLS+4]='road';for(const [g,u] of [[plain,a],[forest,b],[road,c]]){g.order(u,'move',{x:6,y:5});advance(g,.1);}assert.ok(b.x<a.x&&a.x<c.x,'Floresta deve frear e estrada acelerar');assert.ok(Math.abs((a.x-3)-TYPES.tank.speed*.1)<1e-6);});
check('Combate automático repete tiros respeitando a cadência',()=>{const g=field(),a=g.add('blue','tank',4,6),target=g.add('red','hq',6,6);g.updateVision();advance(g,1);assert.equal(g.shotsFired,1);assert.equal(target.hp,240);advance(g,1);assert.equal(g.shotsFired,1);advance(g,1);assert.equal(g.shotsFired,2);assert.equal(target.hp,180);assert.equal(a.hp,a.maxHp);});
check('Reordenar em movimento preserva posição; parar conclui só o segmento atual',()=>{const g=field(),u=g.add('blue','infantry',3,5);assert.ok(g.order(u,'move',{x:10,y:5}));advance(g,.2);const before=[u.x,u.y];assert.ok(g.order(u,'move',{x:4,y:9}));assert.deepEqual([u.x,u.y],before,'Reordenar não pode teletransportar');advance(g,5);assert.equal(u.x,4);assert.equal(u.y,9);assert.ok(g.order(u,'move',{x:10,y:9}));advance(g,.2);const endpoint={...u.segment.to},position=[u.x,u.y];assert.ok(g.order(u,'stop'));assert.deepEqual([u.x,u.y],position);advance(g,2);assert.deepEqual([u.x,u.y],[endpoint.x,endpoint.y]);const stopped=[u.x,u.y];advance(g,2);assert.deepEqual([u.x,u.y],stopped);});
check('Ordens aceitas durante pausa aguardam update; delta zero congela a simulação',()=>{const g=field(),u=g.add('blue','infantry',3,5),target=g.add('red','hq',6,6);g.add('blue','tank',4,6);g.updateVision();advance(g,.1);assert.ok(g.projectiles.length);assert.ok(g.order(u,'move',{x:8,y:5}));assert.equal(u.x,3);const before=snapshot(g);for(let i=0;i<100;i++)g.update(0);assert.equal(snapshot(g),before);advance(g,.2);assert.ok(u.x>3);assert.ok(target.hp<target.maxHp);});
check('Renda e produção usam segundos, mantêm fila serial e cobrança única',()=>{const g=field();g.credits.blue=500;assert.equal(g.trainDuration('infantry'),10);assert.equal(g.trainDuration('tank'),30);assert.ok(g.enqueue('blue','infantry'));assert.ok(g.enqueue('blue','recon'));assert.equal(g.credits.blue,375);const count=g.units.length;advance(g,9.9);assert.equal(g.units.length,count);assert.equal(g.credits.blue,375);advance(g,.2);assert.equal(g.units.length,count+1);assert.equal(g.hq('blue').queue.length,1);assert.equal(g.credits.blue,390);advance(g,10);assert.equal(g.units.length,count+2);assert.equal(g.hq('blue').queue.length,0);assert.equal(g.credits.blue,405);});
check('Produção pronta aguarda espaço e sai sem nova cobrança',()=>{const g=field();assert.ok(g.enqueue('blue','infantry'));for(const p of g.spawnCells('blue','infantry'))if(!g.occupied(p.x,p.y))g.add('blue','tank',p.x,p.y);const count=g.units.length;advance(g,10.1);assert.equal(g.units.length,count);assert.equal(g.hq('blue').queue.length,1);const blocker=g.units.find(u=>u.type==='tank');g.units=g.units.filter(u=>u!==blocker);advance(g,.2);assert.equal(g.units.length,count);assert.equal(g.hq('blue').queue.length,0);assert.equal(g.credits.blue,115);});
check('Construção leva três segundos e cancelamento devolve a reserva uma vez',()=>{const g=field(),u=g.add('blue','infantry',8,8);assert.ok(g.order(u,'build'));assert.equal(g.credits.blue,90);advance(g,1);assert.equal(g.structureAt(8,8),undefined);assert.ok(g.order(u,'move',{x:10,y:8}));assert.equal(g.credits.blue,150);assert.ok(g.order(u,'stop'));assert.equal(g.credits.blue,150);assert.ok(g.order(u,'build'));advance(g,2.9);assert.ok(g.get(u.id));assert.equal(g.structureAt(8,8),undefined);advance(g,.2);assert.equal(g.get(u.id),undefined);assert.equal(g.structureAt(8,8).type,'post');assert.equal(g.credits.blue,90);});
check('Captura e reparo avançam com tempo de simulação',()=>{const g=field(),u=g.add('blue','infantry',5,5),post=g.add('neutral','post',6,5),engineer=g.add('blue','engineer',8,8),tank=g.add('blue','tank',9,8);tank.hp=100;g.updateVision();assert.ok(g.order(u,'capture',{targetId:post.id}));assert.ok(g.order(engineer,'repair',{targetId:tank.id}));advance(g,1.1);assert.equal(post.owner,'neutral');assert.equal(tank.hp,124);advance(g,1.1);assert.equal(post.owner,'blue');assert.equal(tank.hp,148);advance(g,1.1);assert.equal(tank.hp,tank.maxHp);});
check('IA decide e movimenta tropas sem Encerrar turno',()=>{const g=field();g.aiEnabled=true;const before=g.units.filter(u=>u.owner==='red').map(u=>[u.id,u.x,u.y]);advance(g,5);assert.ok(g.aiDecisions>0);assert.notDeepEqual(g.units.filter(u=>u.owner==='red').map(u=>[u.id,u.x,u.y]),before);assert.equal(g.turn,'blue');});
check('Casas reservadas evitam colisão e ordem bloqueada retoma quando libera',()=>{const g=field(),a=g.add('blue','infantry',3,5),b=g.add('blue','infantry',5,5);assert.ok(g.order(a,'move',{x:4,y:5}));assert.ok(g.order(b,'move',{x:4,y:5}));advance(g,1);assert.equal(a.x,4);assert.equal(b.x,5);assert.ok(g.order(a,'move',{x:4,y:7}));advance(g,3);assert.deepEqual([a.x,a.y],[4,7]);assert.deepEqual([b.x,b.y],[4,5]);});
check('Desarme leva um segundo; minas ainda explodem durante deslocamento',()=>{const g=field(),e=g.add('blue','engineer',8,8);g.mines.push({x:9,y:8,known:{blue:true,red:false}});assert.ok(g.order(e,'demine',{x:9,y:8}));advance(g,.9);assert.equal(g.mines.length,1);advance(g,.2);assert.equal(g.mines.length,0);const tank=g.add('blue','tank',4,6);g.mines.push({x:5,y:6,known:{blue:false,red:false}});assert.ok(g.order(tank,'move',{x:6,y:6}));advance(g,2);assert.equal(tank.hp,130);assert.equal(g.mines.length,0);});
check('Quatro mapas RTS executam IA e grupos sem colisões ou terreno inválido',()=>{for(const map of ['river','desert','mountain','random']){const g=new Game(map,'normal',71,'rts');g.command(g.units.filter(u=>u.owner==='blue').map(u=>u.id),'move',{x:7,y:9});advance(g,60);assert.ok(g.aiDecisions>0,map);assert.ok(g.time>0);for(const u of g.units){assert.ok(u.hp>0&&u.hp<=u.maxHp);const p=u.segment?.to||{x:Math.round(u.x),y:Math.round(u.y)};assert.ok(Number.isFinite(g.cost(u,p.x,p.y)),map+'/'+u.type);}}});
check('Supressão RTS dura 3 s, renova sem acumular; disparo revela por 2 s na floresta',()=>{const g=field(),a=g.add('blue','infantry',5,5);g.hurt(a,5,null);assert.equal(a.suppressed,3);advance(g,1);g.hurt(a,5,null);assert.equal(a.suppressed,3);advance(g,3.1);assert.equal(a.suppressed,0);
 const eye=g.add('blue','infantry',5,8),hidden=g.add('red','infantry',9,8);g.terrain[KEY(9,8)]='forest';g.updateVision();assert.equal(g.isVisible('blue',hidden),false);g.shoot(hidden,eye);advance(g,.2);assert.equal(g.isVisible('blue',hidden),true);hidden.cooldown=99;advance(g,2.1);assert.equal(g.isVisible('blue',hidden),false);});
console.log(checks+' verificações RTS concluídas.');
}
// --- tanks ---
{
const tanks=['lightTank','tank','heavyTank'];
function field(mode){const g=new Game('desert','normal',17,mode);g.units=[];g.structures=[];g.mines=[];g.terrain.fill('plain');g.aiEnabled=false;g.add('blue','hq',0,13);g.add('red','hq',17,0);g.add('blue','infantry',0,12);g.add('red','infantry',17,1);g.rng=()=>.2;return g;}
function advance(g,seconds){for(let t=0;t<seconds-1e-8;t+=1/30)g.update(1/30);}
function settle(g){let ticks=0;while(g.busy&&ticks++<10000)g.update(1/30);assert.ok(ticks<10000);}
for(const mode of ['turns','rts'])for(const type of tanks){
 const g=field(mode),u=g.add('blue',type,4,6);assert.ok(u,'Classe '+type+' deve existir');
 assert.equal(TYPES[type].vehicle,true);assert.equal(g.cost(u,5,6),1);g.terrain[6*COLS+5]='forest';assert.equal(g.cost(u,5,6),2);g.terrain[6*COLS+5]='mountain';assert.equal(g.cost(u,5,6),Infinity);g.terrain[6*COLS+5]='river';assert.equal(g.cost(u,5,6),Infinity);g.terrain[6*COLS+5]='road';assert.equal(g.cost(u,5,6),.5);
 g.terrain.fill('plain');g.updateVision();assert.ok(g.order(u,'move',{x:12,y:6}));if(mode==='turns'){settle(g);assert.equal(u.x,4+TYPES[type].move);}else{advance(g,.1);assert.ok(Math.abs(u.x-4-TYPES[type].speed*.1)<1e-7);}
 const p=field(mode);p.credits.blue=1000;assert.ok(p.enqueue('blue',type));assert.equal(p.credits.blue,1000-TYPES[type].cost);const duration=p.trainDuration(type);p.production('blue',duration-.1);assert.equal(p.units.length,2);p.production('blue',.1);assert.equal(p.units[2].type,type);assert.equal(p.hq('blue').queue.length,0);
 const fight=field(mode),a=fight.add('blue','recon',4,6),b=fight.add('red',type,6,6);fight.updateVision();assert.ok(fight.order(a,'attack',{targetId:b.id}));if(mode==='turns')settle(fight);else advance(fight,.7);assert.ok(b.maxHp-b.hp===Math.round(32*.4),'Batedor reduz dano contra '+type);
 const at=field(mode),rocket=at.add('blue','antitank',4,6),target=at.add('red',type,6,6);at.updateVision();assert.ok(at.order(rocket,'attack',{targetId:target.id}));if(mode==='turns')settle(at);else advance(at,.7);assert.equal(target.maxHp-target.hp,90,'Antitanque preserva bônus contra '+type);
 const repair=field(mode),e=repair.add('blue','engineer',4,6),t=repair.add('blue',type,5,6);t.hp=t.maxHp-30;repair.updateVision();assert.ok(repair.order(e,'repair',{targetId:t.id}));if(mode==='turns')settle(repair);else advance(repair,1.1);assert.equal(t.hp,t.maxHp-6);
 console.log('OK '+mode+'/'+type+': terreno, movimento, produção, batedor, antitanque e reparo');
}
for(const mode of ['turns','rts']){
 const g=new Game('river','normal',71,mode);for(const owner of ['blue','red'])assert.deepEqual(Array.from(g.units.filter(u=>u.owner===owner&&TYPES[u.type].tank),u=>u.type),['tank']);
 const ai=field(mode);ai.aiEnabled=true;ai.turn='red';ai.credits.red=10000;for(const [i,type]of ['infantry','infantry','engineer','recon','machinegun','antitank','artillery','artillery','tank'].entries())ai.add('red',type,10+i%3,4+Math.floor(i/3));
 const bought=[];for(let i=0;i<6;i++){ai.aiBuy();bought.push(ai.hq('red').queue[0]?.type);ai.production('red',100);}
 for(const type of ['antiAirVehicle','helicopter','heavyTank'])assert.ok(bought.includes(type),'IA deve recrutar '+type+': '+bought);
 console.log('OK '+mode+': médio inicial e três classes recrutadas pela IA');
}
for(const [type,hp,damage,cost,train,interval,reward]of [['lightTank',110,35,100,2,2,35],['tank',170,60,150,3,2.5,50],['heavyTank',280,80,240,4,3.5,80]]){
 const g=field('rts'),u=g.add('blue',type,4,6),target=g.add('red','hq',6,6);g.updateVision();advance(g,.3);assert.equal(u.maxHp,hp);assert.equal(target.hp,300-damage);assert.equal(g.shotsFired,1);advance(g,interval-.4);assert.equal(g.shotsFired,1);advance(g,.3);assert.equal(g.shotsFired,2);
 for(const mode of ['turns','rts']){const p=field(mode);p.credits.blue=1000;p.enqueue('blue',type);assert.equal(p.credits.blue,1000-cost);assert.equal(p.trainDuration(type),train*(mode==='rts'?10:1));for(const cell of p.spawnCells('blue',type))if(!p.occupied(cell.x,cell.y))p.add('blue','infantry',cell.x,cell.y);p.production('blue',100);assert.equal(p.hq('blue').queue.length,1);const blocker=p.units[2];p.units=p.units.filter(v=>v!==blocker);p.production('blue',mode==='rts'?.1:1);assert.equal(p.hq('blue').queue.length,0);assert.equal(p.units.at(-1).type,type);assert.equal(p.credits.blue,1000-cost);}
 const kill=field('turns'),a=kill.add('blue',type,4,6),b=kill.add('red',type,6,6);kill.credits.blue=0;kill.hurt(b,999,a);assert.equal(kill.credits.blue,reward);assert.equal(a.level,2);assert.equal(a.maxHp,Math.round(hp*1.1));
 console.log('OK '+type+': atributos aprovados, cadência, produção bloqueada, recompensa e veterania');
}

}
// --- helicópteros ---
{
const air=['helicopter','helicopterGround','helicopterAir'];let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
function field(mode='turns'){const g=new Game('river','normal',17,mode);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.aiEnabled=false;g.add('blue','hq',0,ROWS-1);g.add('red','hq',COLS-1,0);g.add('blue','infantry',0,ROWS-2);g.add('red','infantry',COLS-1,1);g.rng=()=>.2;g.updateVision();return g;}
function layers(g){for(const layer of [true,false]){const seen=new Set();for(const u of g.units.filter(u=>!!TYPES[u.type].air===layer)){const k=u.x+','+u.y;assert.ok(!seen.has(k),'Sobreposição na camada '+(layer?'aérea':'terrestre')+' '+k);seen.add(k);}}}
function advance(g,s){for(let t=0;t<s-1e-8;t+=1/30){g.update(Math.min(1/30,s-t));layers(g);}}
function settle(g){let n=0;while((g.busy||g.turn==='red')&&!g.winner&&n++<20000){g.update(1/30);layers(g);}assert.ok(n<20000,'Ordem/turno deve terminar');}
function flush(g){let n=0;while(g.projectiles.length&&n++<200)g.update(1/30);}
function hit(g,a,b,w){if(w)assert.ok(g.setWeapon(a,w));const hp=b.hp;g.shoot(a,b);flush(g);return hp-b.hp;}

check('Helicópteros: atributos provisórios, produção e camada aérea explícita',()=>{
 for(const t of air){const s=TYPES[t];assert.equal(s.air,true);assert.equal(s.hp,120);assert.equal(s.move,6);assert.equal(s.speed,2.2);assert.equal(s.vision,6);assert.equal(s.reward,50);assert.equal(s.vehicle,undefined);}
 assert.equal(JSON.stringify(air.map(t=>[TYPES[t].cost,TYPES[t].train])),'[[150,3],[230,4],[240,4]]');assert.equal(new Game('river','normal',1,'rts').trainDuration('helicopterAir'),40);
 assert.equal(JSON.stringify(air.map(t=>TYPES[t].weapons)),'[["gun"],["gun","agm"],["gun","aam"]]');for(const t of Object.keys(TYPES).filter(t=>!air.includes(t)))assert.ok(!TYPES[t].air,t);
});
check('Voo sobre água e montanha com custo 1, sem bônus de estrada, floresta, cobertura ou montanha',()=>{
 const g=field(),h=g.add('blue','helicopter',3,5);for(const t of ['plain','road','forest','mountain','river','bridge']){g.terrain[KEY(4,5)]=t;assert.equal(g.cost(h,4,5),1,t);}
 for(let y=0;y<ROWS;y++){g.terrain[KEY(6,y)]='river';g.terrain[KEY(7,y)]='mountain';}g.terrain[KEY(4,5)]='plain';
 assert.equal(g.findPath(h,{x:9,y:5}).length,6);assert.equal(g.findPath({type:'tank',owner:'blue',x:3,y:5},{x:9,y:5}),null);
 assert.ok(g.order(h,'move',{x:9,y:5}));settle(g);assert.equal(h.x,9);assert.equal(h.y,5);assert.equal(h.moveLeft,0,'Seis casas gastam os seis pontos');
 g.terrain[KEY(9,5)]='mountain';assert.equal(g.sight(h),6);assert.equal(g.range(h),3);g.terrain[KEY(9,5)]='forest';h.entrenched=true;assert.equal(g.cover(h),0);
 const r=field('rts'),f=r.add('blue','helicopterAir',3,8);for(let y=0;y<ROWS;y++)r.terrain[KEY(5,y)]='river';assert.ok(r.order(f,'move',{x:8,y:8}));advance(r,5/2.2-.1);assert.ok(f.x<8);advance(r,.3);assert.equal(f.x,8,'2,2 casas/s em qualquer terreno');
});
check('Ocupação por camada: aeronave divide casa com tropa e estrutura; duas aeronaves não',()=>{
 const g=field(),tank=g.add('blue','tank',5,5),h=g.add('blue','helicopter',3,5),post=g.add('neutral','post',6,7);
 assert.equal(g.occupied(5,5,h),undefined);assert.ok(g.occupied(5,5,g.add('blue','infantry',9,9)));
 assert.ok(g.order(h,'move',{x:5,y:5}));settle(g);assert.equal(h.x+','+h.y,'5,5');assert.equal(tank.x+','+tank.y,'5,5');
 const h2=g.add('blue','helicopter',3,6);assert.ok(g.occupied(5,5,h2));assert.equal(g.order(h2,'move',{x:5,y:5}),false,'Casa aérea ocupada');
 assert.ok(g.order(h2,'move',{x:6,y:7}));settle(g);assert.equal(h2.x+','+h2.y,'6,7','Sobre estrutura');
 const h3=g.add('blue','helicopter',0,ROWS-3);assert.ok(g.order(h3,'move',{x:0,y:ROWS-1}));settle(g);assert.equal(h3.y,ROWS-1,'Sobrevoa o QG');
 const r=field('rts'),a=r.add('blue','helicopter',3,8),b=r.add('blue','helicopter',7,8),t=r.add('blue','tank',5,10),c=r.add('blue','helicopter',3,10);
 assert.ok(r.order(a,'move',{x:5,y:8}));assert.ok(r.order(b,'move',{x:5,y:8}));assert.ok(r.order(t,'move',{x:6,y:10}));assert.ok(r.order(c,'move',{x:6,y:10}));advance(r,4);
 assert.ok([a,b].some(u=>u.x===5&&u.y===8),'Uma aeronave chega');assert.equal(t.x+','+t.y,'6,10');assert.equal(c.x+','+c.y,'6,10','Solo e ar na mesma casa no RTS');
});
check('Grupos mistos distribuem destinos por camada',()=>{
 for(const mode of ['turns','rts']){const g=field(mode),army=[g.add('blue','tank',8,10),g.add('blue','helicopter',8,11),g.add('blue','helicopterAir',9,12),g.add('blue','infantry',9,11),g.add('blue','helicopterGround',7,10)];
  assert.equal(g.command(army.map(u=>u.id),'move',{x:10,y:10}),5);if(mode==='turns')settle(g);else advance(g,6);
  const at=army.filter(u=>u.x===10&&u.y===10);assert.equal(at.length,2,mode);assert.notEqual(!!TYPES[at[0].type].air,!!TYPES[at[1].type].air);}
});
check('Produção aérea: saída bloqueada só por aeronaves, sem cobrança dupla nem duplicação',()=>{
 const g=field('rts');g.economyClock=-1e9;const cells=g.spawnCells('blue','helicopter');assert.ok(cells.length>=4);for(const c of cells)g.add('blue','helicopter',c.x,c.y);
 g.credits.blue=1000;assert.ok(g.enqueue('blue','helicopter'));assert.equal(g.credits.blue,850);advance(g,31);const hq=g.hq('blue');assert.equal(hq.queue.length,1);assert.equal(hq.queue[0].progress,30);assert.equal(g.credits.blue,850);assert.equal(g.units.filter(u=>u.type==='helicopter').length,cells.length);
 g.units=g.units.filter(u=>u.type!=='helicopter');for(const c of cells)if(!g.occupied(c.x,c.y,null,false))g.add('blue','tank',c.x,c.y);advance(g,.1);
 assert.equal(hq.queue.length,0);assert.equal(g.units.filter(u=>u.type==='helicopter').length,1,'Tropas terrestres não bloqueiam a saída aérea');assert.equal(g.credits.blue,850);
 const s=field('rts');s.economyClock=-1e9;for(const c of s.spawnCells('blue','infantry'))s.add('blue','helicopterAir',c.x,c.y);s.credits.blue=100;assert.ok(s.enqueue('blue','infantry'));advance(s,10.1);assert.equal(s.hq('blue').queue.length,0,'Aeronaves não bloqueiam a saída terrestre');
 const t=field();for(const c of t.spawnCells('blue','helicopter'))t.add('blue','helicopter',c.x,c.y);t.credits.blue=150;assert.ok(t.enqueue('blue','helicopter'));for(let i=0;i<5;i++){t.beginTurn('red');t.beginTurn('blue');}assert.equal(t.hq('blue').queue.length,1,'Por turnos também espera');
});
check('Matriz de alvos: armas, camadas, aliados, neutros e visão',()=>{
 const g=field(),hb=g.add('blue','helicopter',5,5),gb=g.add('blue','helicopterGround',5,6),ab=g.add('blue','helicopterAir',5,7);
 const tank=g.add('red','tank',6,5),inf=g.add('red','infantry',6,6),heli=g.add('red','helicopter',6,7),post=g.add('red','post',7,6),neutral=g.add('neutral','post',7,4);g.updateVision();
 for(const e of [tank,inf,heli,post])assert.ok(g.canFire(hb,e),'Metralhadora padrão: '+e.type);
 assert.equal(JSON.stringify([tank,inf,heli,post].map(e=>g.weapon(gb,e))),'["agm","gun","gun","agm"]','Auto ar-terra');
 assert.equal(JSON.stringify([tank,inf,heli,post].map(e=>g.weapon(ab,e))),'["gun","gun","aam","gun"]','Auto ar-ar');
 assert.ok(g.setWeapon(gb,'agm'));assert.equal(g.weapon(gb,heli),null);assert.equal(g.canFire(gb,heli),false);assert.equal(g.order(gb,'attack',{targetId:heli.id}),false);assert.equal(gb.actionLeft,true,'Rejeição não gasta ação');
 assert.ok(g.setWeapon(ab,'aam'));assert.equal(g.weapon(ab,tank),null);assert.equal(g.weapon(ab,post),null);assert.equal(g.weapon(ab,heli),'aam');assert.ok(g.setWeapon(ab,'gun'));assert.equal(g.weapon(ab,heli),'gun');
 assert.equal(g.setWeapon(hb,'agm'),false);assert.equal(g.setWeapon(gb,'aam'),false);assert.equal(g.setWeapon(tank,'gun'),false);
 for(const [type,ok] of [['infantry',true],['machinegun',true],['tank',false],['lightTank',false],['heavyTank',false],['antitank',false],['artillery',false],['recon',false],['engineer',false],['commander',false]]){
  const v=g.add('blue',type,6,8);g.updateVision();assert.equal(!!g.weapon(v,heli),ok,type);if(ok)assert.ok(g.canFire(v,heli),type);else assert.equal(g.order(v,'attack',{targetId:heli.id}),false,type);g.units=g.units.filter(u=>u!==v);}
 assert.equal(g.canFire(hb,gb),false,'Aliado');assert.equal(g.canFire(hb,neutral),false,'Neutro');const dead=g.add('red','infantry',4,5);g.updateVision();dead.hp=0;assert.equal(g.canFire(hb,dead),false,'Morto');
 const far=g.add('red','helicopter',20,20);g.updateVision();assert.equal(g.canFire(ab,far),false);assert.equal(g.order(ab,'attack',{targetId:far.id}),false,'Fora da visão');assert.equal(ab.actionLeft,true);
});
check('Dano por arma no impacto: multiplicadores, cobertura, aura e veterania aplicados uma vez',()=>{
 const g=field(),hb=g.add('blue','helicopter',5,5),gb=g.add('blue','helicopterGround',5,6),ab=g.add('blue','helicopterAir',5,7),fresh=t=>g.add('red',t,6+g.units.length%3,5+g.units.length%4);
 assert.equal(hit(g,hb,fresh('tank')),7);assert.equal(hit(g,hb,fresh('infantry')),20);assert.equal(hit(g,hb,g.hq('red')),10);assert.equal(hit(g,hb,fresh('helicopter')),20);
 assert.equal(hit(g,gb,fresh('tank'),'auto'),98);assert.equal(hit(g,gb,fresh('infantry'),'agm'),33);assert.equal(hit(g,gb,g.add('red','post',8,9),'agm'),65);assert.equal(hit(g,gb,fresh('tank'),'gun'),7);
 assert.equal(hit(g,ab,fresh('helicopter'),'auto'),70);assert.equal(hit(g,ab,fresh('infantry'),'auto'),20);
 // Contra helicóptero: infantaria −75%, metralhador −35%, caindo até metade no alcance máximo; sem cobertura no ar.
 const over=g.add('red','helicopter',4,8);g.terrain[KEY(4,8)]='forest';assert.equal(hit(g,g.add('blue','infantry',4,9),over),5,'Infantaria a 1 casa: 35 × 0,25 × 0,57');assert.equal(hit(g,g.add('blue','machinegun',3,8),over),9,'Metralhador a 1 casa: 18 × 0,65 × 0,8');
 assert.equal(hit(g,g.add('blue','infantry',4,8),over),9,'Mesma casa: sem queda');assert.equal(hit(g,g.add('blue','machinegun',4,8),over),12);assert.equal(hit(g,g.add('blue','machinegun',2,8),over),7,'Metralhador a 2 casas: × 0,6');
 assert.equal(hit(g,g.add('blue','infantry',14,15),g.add('red','infantry',14,14)),35,'Solo inalterado');assert.equal(hit(g,g.add('blue','machinegun',16,15),g.add('red','infantry',16,14)),23);
 const hidden=g.add('red','infantry',8,5);g.terrain[KEY(8,5)]='forest';assert.equal(hit(g,hb,hidden),14,'Cobertura terrestre mantida');
 const vet=g.add('blue','helicopter',10,5);vet.level=2;assert.equal(hit(g,vet,g.add('red','infantry',11,5)),22);const led=g.add('blue','helicopter',12,8);g.add('blue','commander',12,9);assert.equal(hit(g,led,g.add('red','infantry',13,8)),24);
 assert.ok(Math.abs(g.accuracy(hb,fresh('infantry'))-.85)<1e-9);assert.ok(Math.abs(g.accuracy(ab,fresh('helicopter'))-.9)<1e-9);assert.ok(Math.abs(g.accuracy(led,fresh('infantry'))-.99)<1e-9,'Aura uma vez, limite 99%');
});
check('Por turnos: um disparo gasta a única ação; trocar arma não devolve; movimento restante preservado',()=>{
 const g=field(),gb=g.add('blue','helicopterGround',5,5),tank=g.add('red','tank',6,5);g.updateVision();
 assert.ok(g.order(gb,'attack',{targetId:tank.id}));assert.equal(gb.actionLeft,false);settle(g);assert.equal(tank.hp,72);assert.equal(g.shotsFired,1,'Sem rajada');
 assert.ok(g.setWeapon(gb,'gun'));assert.equal(gb.actionLeft,false);assert.equal(g.order(gb,'attack',{targetId:tank.id}),false);assert.equal(gb.moveLeft,6);assert.ok(g.order(gb,'move',{x:5,y:8}));settle(g);assert.equal(gb.y,8);
 const far=field(),h=far.add('blue','helicopterAir',3,5),e=far.add('red','helicopter',10,5);far.add('blue','recon',9,6);far.updateVision();assert.ok(far.setWeapon(h,'gun'));assert.ok(far.order(h,'attack',{targetId:e.id}));settle(far);assert.ok(DIST(h,e)<=3,'Aproxima no alcance da arma escolhida');
 const near=field(),h2=near.add('blue','helicopterAir',3,5),e2=near.add('red','helicopter',10,5);near.add('blue','recon',9,6);near.updateVision();assert.ok(near.order(h2,'attack',{targetId:e2.id}));settle(near);assert.equal(DIST(h2,e2),6,'Míssil ar-ar: para a 6 casas');
});
check('RTS: recarga comum entre armas; troca não zera nem permite disparo duplo',()=>{
 const g=field('rts'),gb=g.add('blue','helicopterGround',5,5),tank=g.add('red','tank',6,5);g.updateVision();assert.ok(g.setWeapon(gb,'agm'));advance(g,.05);
 assert.equal(g.shotsFired,1);assert.equal(g.projectiles[0].weapon,'agm');assert.ok(gb.cooldown>2.9);assert.ok(g.setWeapon(gb,'gun'));assert.ok(gb.cooldown>2.9,'Troca não zera');
 advance(g,2.8);assert.equal(g.shotsFired,1);advance(g,.25);assert.equal(g.shotsFired,2);assert.ok(gb.cooldown>.8&&gb.cooldown<=1,'Metralhadora: 1 s');
});
check('Projétil guarda arma, dano e alvo do disparo; alvo destruído antes não gera dano nem recompensa dupla',()=>{
 const g=field(),gb=g.add('blue','helicopterGround',5,5),tank=g.add('red','tank',6,5);g.updateVision();g.shoot(gb,tank);g.setWeapon(gb,'gun');gb.level=3;flush(g);assert.equal(tank.hp,72);
 const weak=g.add('red','infantry',6,6);weak.hp=10;const credits=g.credits.blue;g.shoot(gb,weak);g.shoot(gb,weak);assert.equal(g.projectiles.length,2);flush(g);assert.equal(g.credits.blue,credits+20);assert.equal(gb.xp,1);
});
check('Engenheiros recusam reparo aéreo nos dois modos; atendimento por manutenção',()=>{
 const g=field(),e=g.add('blue','engineer',5,5),h=g.add('blue','helicopter',5,5);h.hp=90;assert.equal(g.order(e,'repair',{targetId:h.id}),false);settle(g);assert.equal(h.hp,90);
 const r=field('rts'),f=r.add('blue','engineer',5,5),k=r.add('blue','helicopterAir',6,5);k.hp=60;assert.equal(r.order(f,'repair',{targetId:k.id}),false);advance(r,1.05);assert.equal(k.hp,60);
});
check('Minas, explosões de artilharia e queda de aeronave não atingem a outra camada',()=>{
 const g=field(),h=g.add('blue','helicopter',5,5);g.mines.push({x:6,y:5,known:{blue:false,red:false}});assert.ok(g.order(h,'move',{x:7,y:5}));settle(g);assert.equal(h.hp,120);assert.equal(g.mines.length,1);
 const art=g.add('blue','artillery',2,9),heli=g.add('red','helicopter',6,9),tank=g.add('red','tank',6,10);assert.equal(g.weapon(art,heli),null);g.shoot(art,tank);flush(g);assert.equal(heli.hp,120);assert.ok(tank.hp<170);
 const top=g.add('red','helicopter',9,9),below=g.add('red','infantry',9,9);top.hp=5;g.shoot(g.add('blue','helicopter',8,8),top);flush(g);assert.equal(g.units.includes(top),false);assert.equal(below.hp,100);
});
check('Névoa: aeronaves sobre floresta seguem o alcance de visão; fora dela ficam ocultas',()=>{
 const g=field(),eye=g.add('blue','infantry',5,5),h=g.add('red','helicopter',9,5),foot=g.add('red','infantry',8,6);g.terrain[KEY(9,5)]=g.terrain[KEY(8,6)]='forest';g.updateVision();
 assert.equal(g.isVisible('blue',h),true,'Floresta não esconde aeronave');assert.equal(g.isVisible('blue',foot),false);h.x=12;g.updateVision();assert.equal(g.isVisible('blue',h),false);
 const sky=g.add('blue','helicopter',3,3);g.updateVision();assert.equal(g.isVisible('blue',h),false,'Visão 6 a partir de 3,3 não alcança 12,5');sky.x=8;g.updateVision();assert.equal(g.isVisible('blue',h),true);
});
check('IA: compra conforme forças visíveis e ataca com a arma Auto',()=>{
 const g=field();g.aiEnabled=true;g.add('red','infantry',COLS-2,1);g.credits.red=1000;const spot=g.add('red','recon',20,10),seen=g.add('blue','helicopter',22,10),q=()=>g.hq('red').queue.map(j=>j.type);
 g.updateVision();g.turn='red';g.aiBuy();assert.equal(q()[0],'antiAirVehicle');
 const blind=field();blind.aiEnabled=true;blind.add('red','infantry',COLS-2,1);blind.credits.red=1000;blind.add('blue','helicopter',22,10);blind.updateVision();blind.turn='red';blind.aiBuy();assert.ok(!blind.hq('red').queue.some(j=>j.type==='helicopterAir'),'Não usa aeronaves ocultas');
 const armor=field();armor.aiEnabled=true;armor.add('red','infantry',COLS-2,1);armor.credits.red=1000;armor.add('red','recon',20,10);armor.add('blue','tank',22,10);armor.add('blue','lightTank',22,11);armor.updateVision();armor.turn='red';armor.aiBuy();assert.equal(armor.hq('red').queue[0].type,'helicopterGround');
 const fight=field(),red=fight.add('red','helicopterGround',6,5),target=fight.add('blue','tank',5,5);fight.aiEnabled=true;fight.units=fight.units.filter(u=>u.type!=='infantry'||u.owner==='blue');fight.endTurn();settle(fight);assert.equal(red.altitude,'high');assert.equal(target.hp,170,'Subir usa a ação do primeiro turno');fight.endTurn();settle(fight);assert.equal(target.hp,170-73,'IA usa o míssil ar-terra no Auto: 97,5 × 0,75 da trincheira de fim de turno');
});
console.log(checks+' verificações de helicópteros concluídas.');
}
// --- IA planejada ---
{
let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
function field(mode='turns'){const g=new Game('river','normal',17,mode);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.aiEnabled=false;g.add('blue','hq',0,ROWS-1);g.add('red','hq',COLS-1,0);g.add('blue','infantry',0,ROWS-2);g.add('red','infantry',COLS-1,1);g.rng=()=>.2;g.plan.rally=null;g.updateVision();return g;}
function layers(g){for(const layer of [true,false]){const seen=new Set();for(const u of g.units.filter(u=>!!TYPES[u.type].air===layer)){const k=u.x+','+u.y;assert.ok(!seen.has(k),'Sobreposição '+k);seen.add(k);}}}
function advance(g,s){for(let t=0;t<s-1e-8;t+=1/30){g.update(Math.min(1/30,s-t));layers(g);}}
function settle(g){let n=0;while((g.busy||g.turn==='red')&&!g.winner&&n++<40000){g.update(1/30);layers(g);}assert.ok(n<40000,'Turno deve terminar');}
const redHalf=(g,u)=>{const hq=g.hq('red'),far={x:COLS-1-hq.x,y:ROWS-1-hq.y};return DIST(u,hq)<=DIST(u,far);},away=(g,u)=>DIST(u,g.hq('blue'))>20;
function staged(mode='turns'){const g=field(mode);g.aiEnabled=true;const rally=g.rallyPoint(g.hq('red'));g.plan.rally=rally;const tanks=[[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1]].map(([dx,dy])=>g.add('red','tank',rally.x+dx,rally.y+dy));g.updateVision();return{g,rally,tanks};}

check('Sem investida inicial: quatro mapas, jogador parado — a IA se prepara longe da base azul',()=>{
 for(const map of ['river','desert','mountain','random']){
  const g=new Game(map,'normal',71);for(let i=0;i<3;i++){g.endTurn();settle(g);}
  assert.equal(g.plan.phase,'prepare',map+': prazo mínimo de 3 turnos');assert.ok(g.plan.rally&&redHalf(g,g.plan.rally),map+': ponto de encontro na metade vermelha');
  for(const u of g.units.filter(u=>u.owner==='red'&&u.type!=='recon'))assert.ok(away(g,u),map+'/'+u.type+' perto do QG azul em '+u.x+','+u.y);
  const r=new Game(map,'normal',71,'rts');advance(r,60);assert.equal(r.plan.phase,'prepare',map+' RTS');
  for(const u of r.units.filter(u=>u.owner==='red'&&u.type!=='recon'))assert.ok(away(r,u),map+' RTS/'+u.type+' perto do QG azul em '+u.x+','+u.y);
 }
});
check('Ponto de encontro: alcançável por tanque, a 30% do caminho até o QG azul presumido pela simetria',()=>{
 const {g,rally}=staged();assert.equal(rally.x+','+rally.y,'25,8');for(const map of ['river','desert','mountain','random'])for(const seed of [3,9]){const m=new Game(map,'normal',seed),p=m.rallyPoint(m.hq('red'));assert.ok(Number.isFinite(m.cost({type:'tank'},p.x,p.y)),map+'/'+seed);assert.ok(m.findPath({type:'tank',owner:'red',...m.spawnCells('red','tank')[0]},p),map+'/'+seed);}
 assert.ok(g.power(g.units.find(u=>u.type==='tank'))===150);const hurt=g.add('red','tank',2,2);hurt.hp=85;assert.equal(g.power(hurt),75);assert.equal(g.power(g.hq('red')),0);
 assert.equal(g.fighter(g.add('red','commander',3,3)),false);assert.equal(g.fighter(g.add('red','engineer',4,3)),false);assert.equal(g.fighter(g.add('red','recon',5,3)),false);assert.equal(g.fighter(hurt),true);
});
check('Ataca em grupo quando o exército reunido supera o que viu, e avança coeso até o objetivo',()=>{
 const {g,tanks}=staged();g.round=4;g.planAI();assert.equal(g.plan.phase,'attack');assert.equal(g.plan.wave.length,6);assert.equal(JSON.stringify(g.plan.objective),JSON.stringify({x:0,y:ROWS-1}),'QG presumido');
 const goal=g.plan.objective,mean=()=>tanks.reduce((a,t)=>a+DIST(t,goal),0)/tanks.length,start=mean();
 for(let i=0;i<3;i++){g.endTurn();settle(g);const d=tanks.map(t=>DIST(t,goal));assert.ok(Math.max(...d)-Math.min(...d)<=6,'Onda coesa: '+d);}
 assert.ok(mean()<start-8,'A onda avançou: '+start+' → '+mean());
});
check('Força inferior: com exército azul visto maior que onda × margem, continua se preparando',()=>{
 const {g,rally}=staged();g.round=6;for(let i=0;i<5;i++)g.add('blue','heavyTank',rally.x-2+i,rally.y+4);g.updateVision();assert.equal(g.intel.size,5);g.planAI();assert.equal(g.plan.phase,'prepare');
 g.units=g.units.filter(u=>u.type!=='heavyTank');g.updateVision();g.planAI();assert.equal(g.plan.phase,'attack','Sem a força vista, ataca');
});
check('Recua e reagrupa quando a onda perde metade da força',()=>{
 const {g,rally,tanks}=staged();g.round=4;g.planAI();assert.equal(g.plan.phase,'attack');
 for(const t of tanks.slice(0,4))t.hp=0;g.units=g.units.filter(u=>u.hp>0);const left=tanks[4];left.x=12;left.y=16;g.updateVision();
 g.beginTurn('red');assert.equal(g.plan.phase,'regroup');const before=DIST(left,rally);g.aiAct(left);assert.equal(left.order.type,'move');settle(g);assert.ok(DIST(left,rally)<before,'Volta ao ponto de encontro');
});
check('Defende QG e postos: ameaças tiram as tropas do ponto de encontro; sem ameaça, ninguém persegue o mapa',()=>{
 const {g,rally,tanks}=staged();const intruder=g.add('blue','infantry',COLS-3,2);g.updateVision();const t=tanks[0],before=DIST(t,intruder);g.endTurn();settle(g);
 assert.equal(g.aiState,'defend');assert.ok(DIST(t,intruder)<before,'Tanque vai defender o QG');
 const calm=staged().g,far=calm.add('blue','tank',6,20);calm.add('red','recon',10,18);calm.updateVision();assert.ok(calm.isVisible('red',far));const pos=calm.units.filter(u=>u.type==='tank'&&u.owner==='red').map(u=>u.x+','+u.y).join();
 calm.endTurn();settle(calm);assert.equal(calm.units.filter(u=>u.type==='tank'&&u.owner==='red').map(u=>u.x+','+u.y).join(),pos,'Prazo não venceu: tanques seguram o ponto de encontro');
 const post=staged(),p=post.g.add('red','post',post.rally.x-6,post.rally.y),raider=post.g.add('blue','infantry',p.x-2,p.y);post.g.updateVision();post.g.endTurn();settle(post.g);assert.ok(!post.g.units.includes(raider)||raider.hp<100,'Inimigo a 3 casas de posto vermelho é ameaça e é atacado');
});
check('Inteligência: grava o que viu, mantém fora de vista e apaga quando a casa conhecida fica visível vazia ou a tropa morre',()=>{
 const g=field(),eye=g.add('red','tank',10,10),foe=g.add('blue','infantry',12,10);g.updateVision();assert.equal(g.intel.get(foe.id).x,12);
 eye.x=2;eye.y=2;g.updateVision();assert.equal(g.intel.get(foe.id)?.x,12,'Fora de vista continua lembrado');
 foe.x=20;foe.y=20;eye.x=10;eye.y=10;g.updateVision();assert.equal(g.intel.has(foe.id),false,'Casa conhecida vazia');
 eye.x=19;eye.y=19;g.updateVision();assert.equal(g.intel.get(foe.id).y,20);foe.hp=0;g.units=g.units.filter(u=>u.hp>0);g.updateVision();assert.equal(g.intel.has(foe.id),false,'Morta');
 const h=g.add('blue','helicopter',23,19);g.terrain[KEY(23,19)]='forest';g.updateVision();assert.ok(g.intel.has(h.id),'Aeronave sobre floresta é vista pelo céu');
});
check('Dificuldade: fácil ataca no mínimo na rodada 6, normal na 4, difícil na 3; RTS 150/90/60 s',()=>{
 for(const [level,first,seconds] of [['easy',6,150],['normal',4,90],['hard',3,60]]){
  const {g}=staged();g.difficulty=level;let found=0;for(let r=2;r<=8&&!found;r++){g.round=r;g.planAI();if(g.plan.phase==='attack')found=r;}assert.equal(found,first,level);
  const s=staged('rts').g;s.difficulty=level;s.time=seconds-1;s.planAI();assert.equal(s.plan.phase,'prepare',level+' RTS antes');s.time=seconds+.1;s.planAI();assert.equal(s.plan.phase,'attack',level+' RTS depois');
 }
});
check('Partida simulada sem o jogador: a IA acaba atacando em grupo, sem perseguir unidades isoladas antes do prazo',()=>{
 for(const mode of ['turns','rts']){const g=new Game('river','normal',71,mode);let first=null;
  if(mode==='turns')for(let i=0;i<30&&!g.winner&&!first;i++){g.endTurn();settle(g);if(g.plan.phase==='attack')first={round:g.round,wave:g.plan.wave.length};}
  else for(let t=0;t<600&&!g.winner&&!first;t+=1){advance(g,1);if(g.plan.phase==='attack')first={time:Math.round(g.time),wave:g.plan.wave.length};}
  assert.ok(first,'IA deve lançar um ataque ('+mode+')');assert.ok(first.wave>=6);console.log('   '+mode+': primeiro ataque '+JSON.stringify(first));}
});
console.log(checks+' verificações de IA planejada concluídas.');
}
// --- terreno: colina, campo e sebe ---
{
let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
function field(){const g=new Game('river','normal',17);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.aiEnabled=false;g.add('blue','hq',0,ROWS-1);g.add('red','hq',COLS-1,0);g.rng=()=>.2;g.updateVision();return g;}
check('Colina, campo e sebe: custo, cobertura, visão, alcance e construção',()=>{
 const g=field(),inf=g.add('blue','infantry',5,5),tank=g.add('blue','tank',8,5),heli=g.add('blue','helicopter',11,5);
 for(const [t,ci,cv,cover] of [['hill',1,1.5,.2],['field',1,1,0],['hedge',1,1.5,.25]]){g.terrain[KEY(6,6)]=t;assert.equal(g.cost(inf,6,6),ci,t);assert.equal(g.cost(tank,6,6),cv,t);assert.equal(g.cost(heli,6,6),1,t);assert.equal(TERRAIN[t].cover,cover,t);}
 for(const x of [5,8,11])g.terrain[KEY(x,5)]='hill';
 assert.equal(g.sight(inf),TYPES.infantry.vision+2);assert.equal(g.range(tank),TYPES.tank.range+1);assert.equal(g.sight(heli),TYPES.helicopter.vision,'Aeronave ignora o relevo');assert.equal(g.cover(inf),.2);
 g.terrain[KEY(5,5)]='field';assert.ok(g.buildSite(inf));g.terrain[KEY(5,5)]='hill';assert.ok(g.buildSite(inf));g.terrain[KEY(5,5)]='hedge';assert.equal(g.buildSite(inf),false);
});
check('Sebe esconde como floresta: vista só a até 2 casas (batedor 3)',()=>{
 const g=field(),eye=g.add('red','infantry',5,5),hid=g.add('blue','infantry',9,5);g.terrain[KEY(9,5)]='hedge';g.updateVision();assert.equal(g.isVisible('red',hid),false);
 hid.x=7;g.terrain[KEY(7,5)]='hedge';g.updateVision();assert.equal(g.isVisible('red',hid),true);
});
console.log(checks+' verificações de terreno concluídas.');
}
// --- mapas no estilo Broken Arrow ---
{
let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
const count=(g,...t)=>g.terrain.filter(v=>t.includes(v)).length;
const parts=(g,type)=>{const seen=new Set();let n=0;for(let k=0;k<COLS*ROWS;k++){if(g.terrain[k]!==type||seen.has(k))continue;n++;const st=[k];seen.add(k);while(st.length){const c=st.pop(),x=c%COLS,y=(c-x)/COLS;for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,nk=ny*COLS+nx;if(nx<0||ny<0||nx>=COLS||ny>=ROWS||seen.has(nk)||g.terrain[nk]!==type)continue;seen.add(nk);st.push(nk);}}}return n;};
check('Quatro mapas × 12 sementes: simétricos, determinísticos, bases ligadas e todo posto sobre estrada ligada por tanque',()=>{
 for(const map of Object.keys(MAPS))for(let seed=1;seed<=12;seed++){const g=new Game(map,'normal',seed);g.units=[];const tank={type:'tank',owner:'blue',x:4,y:ROWS-2};
  for(let k=0;k<COLS*ROWS;k++)assert.equal(g.terrain[k],g.terrain[COLS*ROWS-1-k],map+'/'+seed);
  assert.ok(g.findPath(tank,{x:COLS-5,y:1}),map+'/'+seed+' bases');const posts=g.structures.filter(s=>s.type==='post');assert.equal(posts.length,8,map+'/'+seed);
  for(const p of posts){assert.equal(g.terrain[KEY(p.x,p.y)],'road');assert.ok([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>['road','bridge'].includes(g.terrain[KEY(p.x+dx,p.y+dy)])&&g.findPath(tank,{x:p.x+dx,y:p.y+dy})),map+'/'+seed+' posto '+p.x+','+p.y);}
  assert.equal(JSON.stringify(new Game(map,'normal',seed).terrain),JSON.stringify(g.terrain));}
});
check('Vale dos Rios: rio central de borda a borda, ≥ 3 pontes, campos, sebes e colinas',()=>{
 for(let seed=1;seed<=12;seed++){const g=new Game('river','normal',seed),mid=COLS/2;
  for(let y=0;y<ROWS;y++)assert.ok([...Array(13).keys()].some(i=>['river','bridge'].includes(g.terrain[KEY(mid-7+i,y)])),'Rio na linha '+y+' / '+seed);
  assert.ok(parts(g,'bridge')>=3,'pontes '+seed);assert.ok(count(g,'field')>120&&count(g,'hedge')>40&&count(g,'hill')>20,seed+': '+[count(g,'field'),count(g,'hedge'),count(g,'hill')]);}
});
check('Deserto Aberto: dunas (colinas), quase sem vegetação, sem sebes e estradas longas',()=>{
 for(let seed=1;seed<=12;seed++){const g=new Game('desert','normal',seed),n=COLS*ROWS;assert.ok(count(g,'hill')>n*.12,'dunas '+seed);assert.equal(count(g,'hedge'),0);assert.ok(count(g,'forest')<n*.05&&count(g,'field')<n*.08,'vegetação '+seed);assert.ok(count(g,'road','bridge')>40,'estradas '+seed);}
});
check('Passe de Montanha: serra central atravessada por ≥ 2 passagens',()=>{
 for(let seed=1;seed<=12;seed++){const g=new Game('mountain','normal',seed),mid=COLS/2;assert.ok(count(g,'mountain')>40,'serra '+seed);
  const open=[...Array(ROWS).keys()].filter(y=>[...Array(8).keys()].every(i=>g.terrain[KEY(mid-4+i,y)]!=='mountain'));assert.ok(open.length>=2,seed+': '+open);}
});
check('Fronteira procedural: água, floresta, relevo e campos seguem os controles',()=>{
 for(let seed=1;seed<=10;seed++){
  const flat=new Game('random','normal',seed,'turns',{water:0,forest:0,relief:0,farmland:0});assert.equal(count(flat,'river','bridge','forest','hill','mountain','field','hedge'),0,'liso '+seed);
  const farm=new Game('random','normal',seed,'turns',{water:0,forest:0,relief:0,farmland:1});assert.ok(count(farm,'field')>150&&count(farm,'hedge')>40,'campos '+seed);
  const rough=new Game('random','normal',seed,'turns',{water:0,forest:0,relief:1,farmland:0});assert.ok(count(rough,'hill')>100&&count(rough,'mountain')>0,'relevo '+seed);
  assert.equal(new Game('random','normal',seed,'turns',{mountain:0}).options.relief,0,'mountain continua aceito como relevo');}
});
console.log(checks+' verificações de mapas concluídas.');
}
// --- IA: doutrina, poupança, mira e níveis ---
{
let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
function field(){const g=new Game('river','normal',17);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.aiEnabled=false;g.add('blue','hq',0,ROWS-1);g.add('red','hq',COLS-1,0);g.rng=()=>.2;g.updateVision();return g;}
// Tira as unidades recém-treinadas da saída do QG (a IA as leva ao ponto de encontro): sem isso a saída lota.
const park=g=>{const hq=g.hq('red'),cells=[];for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(DIST({x,y},hq)>=6&&DIST({x,y},hq)<=12&&Number.isFinite(g.cost({type:'tank'},x,y))&&!g.structureAt(x,y)&&!g.occupied(x,y,null))cells.push({x,y});let i=0;for(const u of g.units)if(u.owner==='red'&&DIST(u,hq)<=2){const c=cells[i++%cells.length];u.x=c.x;u.y=c.y;}};
const buys=(g,n)=>{for(let i=0;i<n;i++){g.turn='red';g.aiBuy();g.production('red',100);park(g);}return g.units.filter(u=>u.owner==='red').map(u=>u.type);};
check('Doutrina: com crédito de sobra, a IA monta exército variado (helicópteros, antiaéreas e os três tanques)',()=>{
 const g=new Game('river','normal',17);g.aiEnabled=true;g.units=[];g.credits.red=100000;const types=new Set(buys(g,16));
 for(const t of ['lightTank','tank','heavyTank','helicopter','helicopterGround','helicopterAir','antiAirVehicle','infantry','machinegun','antitank'])assert.ok(types.has(t),'Falta '+t+': '+[...types].join());
});
check('Poupança: sem ameaça, a IA espera pelo tipo de maior déficit em vez de gastar com outro',()=>{
 const g=field();g.aiEnabled=true;g.turn='red';
 // Um de cada classe (menos o pesado) e duas infantarias: nada ausente ao alcance, e o pesado (240) é o topo.
 for(const t of ['lightTank','tank','engineer','recon','machinegun','antitank','artillery','helicopter','helicopterGround','helicopterAir','antiAirVehicle','missileInfantry'])g.add('red',t,COLS-3,ROWS-9+['lightTank','tank','engineer','recon','machinegun','antitank','artillery','helicopter','helicopterGround','helicopterAir','antiAirVehicle','missileInfantry'].indexOf(t));
 g.add('red','infantry',COLS-3,2);g.add('red','infantry',COLS-4,2);g.add('red','infantry',COLS-5,2);g.updateVision();
 g.credits.red=60;g.aiBuy();assert.equal(g.hq('red').queue.length,0,'Não compra com 60 o que quer caro');
 g.credits.red=240;g.aiBuy();assert.equal(g.hq('red').queue[0]?.type,'heavyTank','Com dinheiro, compra o de maior déficit');
});
check('Mira: antitanque prefere veículo a tropa a pé; metralhador prefere tropa a pé',()=>{
 const g=field();g.turn='red';const at=g.add('red','antitank',10,10),inf=g.add('blue','infantry',11,10),tank=g.add('blue','tank',10,13),mg=g.add('red','machinegun',20,20),foot=g.add('blue','infantry',21,20),vehicle=g.add('blue','lightTank',20,22);g.updateVision();
 assert.equal(g.acquire(at),tank);assert.equal(g.acquire(mg),foot);
});
check('Mira: artilharia evita o ponto com aliado no 3×3 e escolhe o de mais inimigos',()=>{
 const g=field();g.turn='red';const art=g.add('red','artillery',4,10);g.add('blue','infantry',9,10);g.add('red','infantry',9,11);const B=g.add('blue','tank',8,8);g.updateVision();
 assert.equal(g.acquire(art),B);
});
check('Recuo: unidade cara ferida (< 40%) sai da linha; a barata continua lutando',()=>{
 const g=field();g.turn='red';const heavy=g.add('red','heavyTank',10,10);heavy.hp=Math.floor(280*.35);g.add('blue','infantry',12,10);g.updateVision();g.aiAct(heavy);
 assert.equal(heavy.order.type,'move');const hq=g.hq('red');assert.ok(DIST(heavy.order.goal||heavy,hq)<DIST(heavy,hq)+1,'Recua na direção do QG');
});
check('Níveis: Veterano tem renda +35% e exército até 20; Normal até 16 e renda normal',()=>{
 const n=field();assert.equal(n.income('red'),15);
 const v=field();v.difficulty='veteran';assert.equal(v.income('red'),20);
 const nn=new Game('river','normal',17);nn.units=[];nn.credits.red=100000;const vv=new Game('river','veteran',17);vv.units=[];vv.credits.red=100000;
 const normal=buys(nn,40).length,veteran=buys(vv,40).length;assert.equal(normal,16);assert.equal(veteran,20);
 assert.equal(new Game('river','veteran',17).difficulty,'veteran');
});
console.log(checks+' verificações de IA concluídas.');
}
