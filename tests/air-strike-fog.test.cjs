'use strict';
// Avião fora da visão: antiaérea que acabou de disparar fica visível dentro do alcance das armas do avião (Parte A) e ataque por aposta numa casa na névoa (Parte B).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/js/engine.js'),'utf8')+'\nObject.assign(this,{Game,TYPES,COLS,ROWS,KEY,DIST,AIR,PLANE});',ctx);
const {Game,TYPES,COLS,ROWS,KEY,DIST,AIR,PLANE}=ctx;
const cases=[];const test=(name,fn)=>cases.push([name,fn]);
function field(mode='rts'){const g=new Game('river','normal',123,mode,{posts:2});g.terrain.fill('plain');g.units=[];g.structures=[];g.projectiles=[];g.mines=[];g.actions=[];g.animation=null;g.aiEnabled=false;g.add('blue','hq',1,94);g.add('red','hq',126,1);g.rng=()=>.01;g.updateVision();return g;}
function advance(g,seconds){for(let t=0;t<seconds-1e-8;t+=1/30)g.update(1/30);}
function settle(g){let n=0;while(g.busy&&n++<20000&&!g.winner)g.update(1/30);assert.ok(n<20000,'a ação deve terminar');}

// ---- Parte A
test('antiaérea que atirou fica visível para avião em voo dentro do alcance das armas',()=>{
 const g=field(),p=g.add('blue','fighterBlue',20,75),a=g.add('red','antiAirVehicle',46,75);
 g.updateVision();assert.equal(g.isVisible('blue',a),false,'fora da visão de 12');
 assert.ok(g.strikeReach(p)>=30,'antirradiação alcança 40: '+g.strikeReach(p));
 a.revealed=2;g.updateVision();assert.equal(g.isVisible('blue',a),true);
 a.revealed=0;g.updateVision();assert.equal(g.isVisible('blue',a),false);
});
test('o alcance maior vale só para antiaéreas reveladas',()=>{
 const g=field(),p=g.add('blue','fighterBlue',20,75),t=g.add('red','tank',33,75);t.revealed=2;g.updateVision();
 assert.equal(g.isVisible('blue',t),false);
});
test('tropa de terra não ganha alcance',()=>{
 const g=field(),own=g.add('blue','tank',20,75),a=g.add('red','antiAirVehicle',46,75);a.revealed=2;g.updateVision();
 assert.equal(g.isVisible('blue',a),false);
});
test('avião pousado não ganha alcance',()=>{
 const g=field(),p=g.add('blue','fighterBlue',20,75),a=g.add('red','antiAirVehicle',46,75);a.revealed=2;p.flightState='grounded';p.altitude='low';p.runway={type:'stop',phase:'wait',level:0};g.updateVision();
 assert.equal(g.strikeReach(p),0);
});
test('regressão: contato de radar aéreo continua sendo alvo',()=>{
 const g=field(),p=g.add('blue','fighterBlue',30,70),h=g.add('red','helicopter',47,70);h.altitude='low';g.updateVision();
 assert.equal(g.radarContact('blue',h),true);assert.ok(g.canIdentify(p,h));
 h.x=120;h.y=10;g.updateVision();assert.equal(g.canIdentify(p,h),false);
});

// ---- Parte B (Task 2)
const strike=(g,p,x,y,weapon='jetAgm',salvo=1)=>g.command([p.id],'strikeCell',{x,y,weapon,salvo});
// Aposta: alvo em floresta, fora da visão do avião mesmo de perto (a floresta só aparece a 1 casa de um avião alto).
function bet(mode='rts'){const g=field(mode),p=g.add('blue','multiroleBlue',20,75);p.facing=Math.PI/2;g.terrain[KEY(45,75)]='forest';g.terrain[KEY(47,75)]='forest';g.updateVision();return{g,p};}
test('aposta que acerta atinge a tropa da casa e a revela',()=>{
 const {g,p}=bet(),e=g.add('red','tank',45,75);g.updateVision();assert.equal(g.isVisible('blue',e),false);
 assert.equal(strike(g,p,45,75),1);
 for(let i=0;i<600&&p.ammo.jetAgm===4;i++){g.update(1/30);}
 assert.equal(p.ammo.jetAgm,3);assert.ok(e.revealed>0,'o alvo atingido fica revelado');
 advance(g,10);assert.ok(!g.units.includes(e)||e.hp<e.maxHp,'a tropa foi atingida');
});
test('automática escolhe a arma que serve ao que há na casa',()=>{
 const {g,p}=bet(),e=g.add('red','infantry',45,75);g.updateVision();assert.equal(strike(g,p,45,75,'auto'),1);
 advance(g,30);assert.equal(p.ammo.jetAgm,4,'míssil antiblindado não serve contra infantaria');assert.ok(p.ammo.jetGun<80,'metralhadora disparou');assert.ok(!g.units.includes(e)||e.hp<e.maxHp);
});
test('aposta vazia gasta a munição e deixa um impacto',()=>{
 const {g,p}=bet();assert.equal(strike(g,p,45,75,'jetAgm',2),1);advance(g,25);
 assert.equal(p.ammo.jetAgm,2);assert.ok(g.events.some(e=>e.kind==='blast'&&e.dud),'impacto no chão');
});
test('casa visível é recusada, assim como arma ar-ar e sem munição de solo',()=>{
 const {g,p}=bet();assert.equal(strike(g,p,24,75),0,'casa visível');
 assert.equal(strike(g,p,45,75,'jetAam'),0,'ar-ar');assert.equal(strike(g,p,45,75,'antiRadiation'),0);
 p.ammo.jetAgm=0;p.ammo.jetGun=0;assert.equal(strike(g,p,45,75,'auto'),0,'sem munição de solo');
});
test('coordenadas inválidas são recusadas',()=>{
 const {g,p}=bet();for(const [x,y] of [[-1,5],[3.5,5],[COLS,5],[5,ROWS]])assert.equal(strike(g,p,x,y),0);
});
test('uma aposta por investida',()=>{
 const {g,p}=bet();g.add('red','tank',45,75);g.updateVision();assert.equal(strike(g,p,45,75,'jetAgm',1),1);advance(g,40);
 assert.notEqual(p.flightJob?.type,'cellStrike');assert.notEqual(p.order.type,'cellStrike');assert.equal(p.ammo.jetAgm,3);
});
test('escolha do alvo: menor id primeiro, estrutura quando não há tropa',()=>{
 const {g,p}=bet(),a=g.add('red','tank',47,75),b=g.add('red','tank',47,75);g.updateVision();
 assert.ok(a.id<b.id);assert.equal(g.cellTarget(p,{x:47,y:75},'jetAgm'),a);
 const post=g.add('red','post',60,60);assert.equal(g.cellTarget(p,{x:60,y:61},'jetAgm'),post);assert.equal(g.cellTarget(p,{x:60,y:61},'jetGun'),null);
});
test('por turnos a aposta consome a ação e termina o turno',()=>{
 const {g,p}=bet('turns'),e=g.add('red','tank',45,75);g.updateVision();assert.equal(strike(g,p,45,75),1);assert.equal(p.actionLeft,false);settle(g);
 assert.equal(p.ammo.jetAgm,3);assert.ok(!g.units.includes(e)||e.hp<e.maxHp);
});

test('o job não carrega a unidade inimiga (vai ao cliente no multiplayer)',()=>{
 const {g,p}=bet(),e=g.add('red','tank',45,75);g.updateVision();assert.equal(strike(g,p,45,75),1);
 const shoot=g.shoot;let idAtShot=null;g.shoot=function(...a){idAtShot=p.flightJob.targetId;return shoot.apply(this,a);};
 for(let i=0;i<600&&p.flightJob?.type==='cellStrike';i++){g.update(1/30);const j=p.flightJob;if(j?.type==='cellStrike'){assert.ok(!('target' in j));assert.ok(!JSON.stringify(j).includes('"hp"'));}}
 assert.equal(idAtShot,e.id);
});
test('dois aviões com salva 2 gastam a munição de cada um; as casas vizinhas continuam na névoa',()=>{
 const g=field(),a=g.add('blue','multiroleBlue',20,75),b=g.add('blue','multiroleBlue',20,77);a.facing=b.facing=Math.PI/2;g.terrain[KEY(45,75)]='forest';g.updateVision();
 assert.equal(g.command([a.id,b.id],'strikeCell',{x:45,y:75,weapon:'jetAgm',salvo:2}),2);advance(g,40);
 assert.equal(a.ammo.jetAgm,2);assert.equal(b.ammo.jetAgm,2);
 g.updateVision();assert.equal(g.visible.blue[KEY(60,75)],false,'a névoa longe da aposta continua');
});
test('aposta recusa alvo que mudou de dono antes do disparo',()=>{
 const {g,p}=bet(),post=g.add('red','post',46,74);g.terrain[KEY(46,74)]='forest';g.updateVision();assert.equal(strike(g,p,46,74),1);
 for(let i=0;i<600&&DIST(p,{x:46,y:74})>16;i++)g.update(1/30);
 post.owner='blue';advance(g,10);assert.equal(post.hp,post.maxHp,'estrutura que virou aliada não é atingida');
});
let failed=0;for(const [name,fn] of cases){try{fn();console.log('ok  '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message);}}
if(failed){console.log(failed+' falharam');process.exit(1);}
console.log('OK avião fora da visão: '+cases.length+' casos.');
