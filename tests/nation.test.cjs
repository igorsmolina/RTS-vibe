'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync('public/js/engine.js','utf8')+'\nthis.api={Game,TYPES,PLAN,COLS};',ctx);
const {Game,TYPES,PLAN,COLS}=ctx.api;
function field(mode='turns',doctrines){const g=new Game('river','normal',17,mode,{},doctrines);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.aiEnabled=false;g.add('blue','hq',0,27);g.add('red','hq',35,0);g.add('blue','infantry',0,26);g.add('red','infantry',35,1);g.credits.blue=g.credits.red=5000;g.updateVision();return g;}
let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
check('Postos: três vagas contando a produção, QG com cinco, preço único e filas independentes',()=>{
 const g=field(),p=g.add('blue','post',10,10),q=g.add('blue','post',20,20),start=g.credits.blue;
 for(let i=0;i<3;i++)assert.ok(g.enqueue('blue','infantry',p));assert.equal(g.enqueue('blue','infantry',p),false);
 assert.ok(g.enqueue('blue','tank',q));for(let i=0;i<5;i++)assert.ok(g.enqueue('blue','infantry'));assert.equal(g.enqueue('blue','infantry'),false);
 assert.equal(p.queue.length,3);assert.equal(q.queue.length,1);assert.equal(g.hq('blue').queue.length,5);assert.equal(g.credits.blue,start-8*50-150);
 for(const base of [g.add('neutral','post',15,15),g.hq('red'),{...p},null]){const credits=g.credits.blue;assert.equal(g.enqueue('blue','infantry',base),false);assert.equal(g.credits.blue,credits);}
 p.hp=0;assert.equal(g.enqueue('blue','infantry',p),false);p.hp=80;
 g.credits.blue=49;assert.equal(g.enqueue('blue','infantry',q),false);assert.equal(g.credits.blue,49);
 const h=field('rts'),neutral=h.add('neutral','post',10,10);assert.equal(h.enqueue('neutral','infantry',neutral),false);assert.equal(h.credits.neutral,undefined);assert.equal(neutral.queue.length,0);
});
check('Produção serial por estrutura nos dois modos, nascimento local e bloqueio sem cobrar novamente',()=>{
 for(const mode of ['turns','rts']){const g=field(mode),p=g.add('blue','post',10,10);g.enqueue('blue','infantry',p);g.enqueue('blue','recon',p);g.enqueue('blue','infantry');
  const credits=g.credits.blue,seconds=g.trainDuration('infantry');for(const c of g.spawnCells('blue','infantry',p))g.add('blue','tank',c.x,c.y);
  g.production('blue',seconds);assert.equal(p.queue.length,2);assert.equal(p.queue[0].progress,seconds);assert.equal(g.hq('blue').queue.length,0);assert.equal(g.credits.blue,credits);
  g.units=g.units.filter(u=>!(u.x===10&&u.y===9));g.production('blue',mode==='rts'?1/30:1);assert.equal(p.queue.length,1);assert.equal(p.queue[0].progress,0);assert.ok(g.units.some(u=>u.type==='infantry'&&u.x===10&&u.y===9));
  const h=field(mode),s=h.add('blue','post',15,15);h.enqueue('blue','infantry',s);h.enqueue('blue','infantry');if(mode==='rts'){for(let n=0;n<301;n++)h.update(1/30);}else h.beginTurn('blue');assert.equal(s.queue.length,0);assert.equal(h.hq('blue').queue.length,0);
 }
});
check('Captura e destruição eliminam a fila sem reembolso; fila no posto evita derrota prematura',()=>{
 const g=field(),p=g.add('blue','post',10,10);g.enqueue('blue','tank',p);g.units=g.units.filter(u=>u.owner!=='blue');g.checkVictory();assert.equal(g.winner,null);
 const enemy=g.add('red','infantry',10,9),credits=g.credits.blue;g.turn='red';g.updateVision();g.resolveAction({type:'capture',targetId:p.id},enemy);assert.equal(p.owner,'red');assert.equal(p.queue.length,0);assert.equal(g.credits.blue,credits);
 g.turn='blue';const q=g.add('blue','post',20,20);g.enqueue('blue','tank',q);const before=g.credits.blue;g.hurt(q,999,null);assert.equal(q.queue.length,0);assert.equal(g.credits.blue,before);assert.ok(!g.structures.includes(q));
 const h=field(),s=h.add('blue','post',12,12);h.enqueue('blue','infantry',s);h.hurt(h.hq('blue'),999,null);h.checkVictory();assert.equal(h.winner,'red');
});
check('IA usa posto com menor espera, respeita saída livre, filas totais e limite de exército',()=>{
 for(const mode of ['turns','rts']){const g=field(mode),p=g.add('red','post',20,10),hq=g.hq('red');g.aiEnabled=true;g.turn='red';g.plan.rally=p;hq.queue.push({type:'heavyTank',progress:0});g.aiBuy();assert.equal(p.queue.length,1);assert.equal(hq.queue.length,1);
  while(hq.queue.length+p.queue.length<PLAN.normal.queue)hq.queue.push({type:"infantry",progress:0});const before=g.credits.red;g.aiBuy();assert.equal(g.credits.red,before,'Limite global de encomendas da dificuldade normal');
  g.units=[];for(let i=0;i<PLAN.normal.army-PLAN.normal.queue;i++)g.add('red','infantry',i,3);g.aiBuy();assert.equal(g.credits.red,before,'Exército mais encomendas não excede o limite');
  p.queue=[];hq.queue=[];g.units=[];for(const c of g.spawnCells('red','helicopter',p))g.add('red','helicopter',c.x,c.y);for(const c of g.spawnCells('red','infantry',p))g.add('red','infantry',c.x,c.y);g.units=g.units.slice(0,12);g.terrain.fill('river');g.terrain[hq.y*COLS+hq.x]='plain';g.terrain[(hq.y+1)*COLS+hq.x]='plain';g.aiBuy();assert.equal(p.queue.length,0);
 }
});
check('Doutrinas isoladas: renda, vida inicial/reforços, dano e estruturas; atributos globais preservados',()=>{
 const original=JSON.stringify(TYPES),g=field('turns',{blue:'economic',red:'defensive'});g.difficulty='hard';g.add('blue','post',10,10);g.add('red','post',20,20);
 assert.equal(g.income('blue'),Math.round(69*1.15));assert.equal(g.income('red'),Math.round(69*1.2*.9));assert.equal(g.attackPower(g.units[0]),35*.9);assert.equal(g.units[1].maxHp,115);assert.equal(g.hq('red').maxHp,300);
 const h=field('turns',{blue:'offensive'});assert.equal(h.units[0].maxHp,90);assert.equal(h.attackPower(h.units[0]),35*1.1);const p=h.add('blue','post',10,10);h.enqueue('blue','infantry',p);h.production('blue');assert.ok(h.units.some(u=>u.x===10&&u.y===9&&u.maxHp===90));
 const a=h.add('blue','rocketArtillery',5,5);assert.equal(h.attackPower(a),20*1.1);const heli=h.add('blue','helicopterGround',6,5);assert.equal(h.attackPower(heli,'agm'),65*1.1);
 const defaults=new Game();assert.equal(defaults.units.find(u=>u.type==='infantry').maxHp,100);assert.equal(JSON.stringify(TYPES),original);
});
check('Doutrina preservada na promoção e no reparo; minas não recebem bônus',()=>{
 const g=field('turns',{blue:'offensive'}),u=g.add('blue','infantry',5,5),foe=g.add('red','infantry',6,5);g.hurt(foe,999,u);assert.equal(u.maxHp,99);assert.equal(u.hp,99);
 u.hp=98;const eng=g.add('blue','engineer',4,5);g.resolveAction({type:'repair',targetId:u.id},eng);assert.equal(u.hp,99);
 g.mines.push({x:5,y:5,known:{blue:false,red:false}});g.enterCell(u);assert.equal(u.hp,59);
});
check('Captura real por ordem limpa fila em turnos e RTS; posto construído também recruta',()=>{
 for(const mode of ['turns','rts']){const g=field(mode),p=g.add('red','post',10,10),u=g.add('blue','infantry',10,9);g.turn='red';g.enqueue('red','tank',p);g.turn='blue';g.updateVision();const credits=g.credits.red;assert.ok(g.order(u,'capture',{targetId:p.id}));for(let n=0;n<150;n++)g.update(1/30);assert.equal(p.owner,'blue');assert.equal(p.queue.length,0);assert.equal(g.credits.red,credits);assert.ok(g.enqueue('blue','infantry',p));
  const h=field(mode),builder=h.add('blue','infantry',15,15);h.updateVision();assert.ok(h.order(builder,'build'));for(let n=0;n<150;n++)h.update(1/30);const post=h.structureAt(15,15);assert.equal(post.type,'post');assert.ok(h.enqueue('blue','infantry',post));assert.equal(post.queue.length,1);
 }
});
check('Sorteio inimigo é determinístico, cobre doutrinas e não consome RNG de mapa/combate',()=>{
 vm.runInContext('this.enemyDoctrine=enemyDoctrine;this.cleanNation=cleanNation;this.cleanDoctrine=cleanDoctrine;',ctx);const {enemyDoctrine,cleanNation,cleanDoctrine}=ctx;
 const ids=new Set();for(let seed=1;seed<=100;seed++){const before=new Game('river','normal',seed),after=new Game('river','normal',seed);const id=enemyDoctrine(seed);ids.add(id);assert.equal(enemyDoctrine(seed),id);assert.equal(before.rng(),after.rng());}assert.equal(ids.size,4);
 assert.equal(cleanNation({name:' '.repeat(10),primary:'red',emblem:'<img>'}).name,'Azul');assert.equal(cleanNation({name:'X'.repeat(60)}).name.length,32);assert.equal(cleanDoctrine('__proto__'),'balanced');assert.equal(cleanDoctrine({toString:null}),'balanced');
});
console.log(checks+' verificações de postos e doutrinas concluídas.');
