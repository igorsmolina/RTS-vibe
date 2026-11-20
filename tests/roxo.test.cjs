'use strict';
// Time Roxo (transporte pesado): ficha, facção, snapshot e multiplayer.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const names='Game,TYPES,PURPLE_TYPES,SPEC,UT,ROXO,FRANCE,FACTION_IDS,STANDARD_FACTIONS,PLANE_MODELS,startingCatalog,cleanStartingArmy,armyCost'.split(',');
const engine=new Function(fs.readFileSync(path.join(__dirname,'..','public','js','engine.js'),'utf8')+'\nreturn {'+names.join(',')+',MAPS,NATION_DOCTRINES,PROCEDURAL,STARTING_DEFAULT,STARTING_BUDGET,UNIT_CAP,STEP,SIZE,KEY,TILE,AIR,MISSILE};')();
const {Game,TYPES,SPEC,UT,ROXO,FRANCE,FACTION_IDS,STANDARD_FACTIONS,PURPLE_TYPES,startingCatalog,cleanStartingArmy}=engine;
const cases=[],test=(name,fn)=>cases.push([name,fn]);
function field(factions,mode='rts'){
 const g=new Game('river','normal',123,mode,{posts:2},{},{},null,factions);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.actions=[];g.animation=null;g.projectiles=[];g.memory.blue.clear();g.memory.red.clear();g.intel.clear();g.aiEnabled=false;
 g.add('blue','hq',1,90);g.add('red','hq',120,2);g.rng=()=>.5;g.updateVision();return g;
}

test('o id da facção e a lista de facções aceitas',()=>{
 assert.equal(ROXO,'roxo');assert.ok(FACTION_IDS.includes('roxo')&&FACTION_IDS.includes('franca')&&FACTION_IDS.includes('blue')&&FACTION_IDS.includes('red'));
});
test('facção roxa é aceita (também contra ela mesma) e valores inválidos voltam ao padrão',()=>{
 assert.deepEqual({...field({blue:'roxo',red:'red'}).factions},{blue:'roxo',red:'red'});
 assert.deepEqual({...field({blue:'roxo',red:'roxo'}).factions},{blue:'roxo',red:'roxo'});
 assert.deepEqual({...field({blue:'x',red:'y'}).factions},{...STANDARD_FACTIONS});
});
test('unidades do lado roxo nascem com a facção roxa e usam a ficha roxa',()=>{
 const g=field({blue:'roxo',red:'red'}),t=g.add('blue','tank',50,50),i=g.add('blue','infantry',51,50);
 assert.equal(t.faction,'roxo');assert.equal(UT(t),PURPLE_TYPES.tank);assert.equal(UT(i),TYPES.infantry);
});
test('ficha roxa (valores do balanceamento da Tarefa 7): só diferenças da ficha base verde',()=>{
 assert.equal(SPEC('tank','roxo').vision,7);assert.equal(SPEC('tank','roxo').hp,195);assert.equal(SPEC('tank','roxo').cost,150);
 assert.equal(SPEC('lightTank','roxo').vision,7);assert.equal(SPEC('lightTank','roxo').hp,140);
 assert.equal(SPEC('heavyTank','roxo').trophy,4);assert.equal(SPEC('heavyTank','roxo').hp,265);assert.equal(SPEC('heavyTank','roxo').vision,7);
 assert.equal(SPEC('antiAirVehicle','roxo').vision,7);assert.equal(SPEC('antiAirVehicle','roxo').hp,65);
 assert.equal(SPEC('recon','roxo').vision,8);assert.equal(SPEC('recon','roxo').hp,65);
 assert.equal(SPEC('infantry','roxo'),TYPES.infantry);
 for(const t of ['lightTank','tank','heavyTank','antiAirVehicle','recon'])assert.notEqual(SPEC(t,'roxo').role,TYPES[t].role,t+' tem role próprio');
});
test('snapshot mantém a facção roxa',()=>{
 const g=field({blue:'roxo',red:'red'}),back=Game.fromSnapshot(g.snapshot());assert.equal(back.factions.blue,'roxo');
});
test('catálogo e exército inicial do Roxo',()=>{
 const cat=startingCatalog('roxo');assert.ok(cat.includes('infantry'));
 for(const type of cat)if(TYPES[type].plane)assert.equal(TYPES[type].team,'roxo',type);
 assert.deepEqual(cleanStartingArmy({infantry:2,tank:1},'roxo'),{infantry:2,tank:1});
});
test('multiplayer aceita a facção roxa e recusa nome inválido',()=>{
 const {createCore}=require('../public/js/multiplayer-core.js');
 let time=1000;const core=createCore(engine,{now:()=>time});
 const socket=()=>{const s={inbox:[],send(text){this.inbox.push(JSON.parse(text));},close(){}};core.attach(s);return s;},say=(s,m)=>core.receive(s,JSON.stringify(m)),last=(s,type)=>s.inbox.filter(m=>m.type===type).at(-1);
 const host=socket(),guest=socket(),created=core.createRoom('Anfitrião',{map:'river',mode:'rts',seed:5});
 say(host,{type:'auth',version:1,code:created.code,token:created.token});
 say(guest,{type:'join',version:1,code:created.code,nickname:'Convidado'});const joined=last(guest,'joined');say(guest,{type:'auth',version:1,code:created.code,token:joined.token});
 const room=core.rooms.get(created.code);
 say(guest,{type:'prepare',faction:'roxo'});assert.equal(room.players[1].faction,'roxo');
 say(guest,{type:'prepare',faction:'verde'});assert.equal(last(guest,'error').message,'Unidades inválidas.');
});

const TILE=engine.TILE;
function plain(factions,mode){const g=field(factions,mode);g.credits.blue=50000;return g;}
test('convertiplano roxo: 10 vagas, 1 batedor ocupa 5, sem armas',()=>{
 const t=SPEC('transportHelicopter','roxo');
 assert.equal(t.capacity,10);assert.equal(t.seats.recon,5);assert.equal(t.speed,4);assert.equal(t.move,12);assert.equal(t.cost,280);assert.equal(t.unarmed,true);
 const g=plain({blue:'roxo',red:'red'}),h=g.add('blue','transportHelicopter',50,50);h.altitude='low';
 const scout=g.add('blue','recon',51,50);assert.ok(g.order(h,'embark',{targetId:scout.id}));
 for(let i=0;i<5;i++){const p=g.add('blue','infantry',51,50);assert.ok(g.order(h,'embark',{targetId:p.id}),'tropa '+i);}
 assert.equal(g.order(h,'embark',{targetId:g.add('blue','infantry',51,50).id}),false,'a 11ª vaga é recusada');
 assert.equal(engine.TYPES.transportHelicopter.capacity,6,'o verde continua com 6');
});
test('convertiplano desembarca as 10 tropas em raio 2; com só 3 casas livres, as outras 7 continuam a bordo',()=>{
 const g=plain({blue:'roxo',red:'red'}),h=g.add('blue','transportHelicopter',50,50);h.altitude='low';
 for(let i=0;i<10;i++)assert.ok(g.order(h,'embark',{targetId:g.add('blue','infantry',51,50).id}));
 assert.equal(h.cargo.length,10);assert.ok(g.order(h,'disembark'));assert.equal(h.cargo.length,0);
 const h2=g.add('blue','transportHelicopter',80,50);h2.altitude='low';
 for(let i=0;i<10;i++)assert.ok(g.order(h2,'embark',{targetId:g.add('blue','infantry',81,50).id}));
 const cells=g.landingCells('infantry',TILE(h2),2);for(const c of cells.slice(3))g.add('blue','heavyTank',c.x,c.y);
 assert.ok(g.order(h2,'disembark'));assert.equal(h2.cargo.length,7,'7 ficam a bordo, nenhuma some');
 assert.equal(g.units.filter(u=>u.owner==='blue'&&u.type==='infantry'&&u.hp>0).length,13);
});
test('cargueiro a jato roxo: 16 vagas, 5,5 de velocidade, pista normal, taxa 220',()=>{
 const t=SPEC('transportPlane','roxo');
 assert.equal(t.capacity,16);assert.equal(t.speed,5.5);assert.ok(!t.shortRunway);assert.equal(t.airdropFee,220);assert.equal(t.airdropPlane,true);
 assert.equal(plain({blue:'roxo',red:'red'}).airCap('blue'),16);assert.equal(plain().airCap('blue'),12);assert.equal(plain({blue:FRANCE,red:'red'}).airCap('blue'),10);
});
test('lançamento aéreo: o jato roxo aceita 16 tropas por 220 de taxa, o verde recusa 13',()=>{
 const roxo=plain({blue:'roxo',red:'red'}),q=roxo.airdropQuote({infantry:16},undefined,'blue');
 assert.ok(q);assert.equal(q.slots,16);assert.equal(q.cost,220+16*50);assert.equal(roxo.airdropFee('blue'),220);
 assert.equal(roxo.airdropQuote({infantry:17},undefined,'blue'),null);
 const verde=plain();assert.equal(verde.airdropQuote({infantry:13},undefined,'blue'),null);assert.equal(verde.airdropFee('blue'),150);
 assert.equal(verde.airdropQuote({infantry:12},undefined,'blue').cost,150+12*50);
 assert.equal(plain({blue:FRANCE,red:'red'}).airdropFee('blue'),150);
});

const advance=(g,s)=>{for(let t=0;t<s;t+=1/30)g.update(1/30);};
function loaded(factions,mode,carrier='transportTruck'){
 const g=plain(factions,mode),c=g.add('blue',carrier,50,50),at=g.add('blue','antitank',51,50);if(c.type==='transportHelicopter')c.altitude='low';
 at.atMissiles=0;assert.ok(g.order(c,'embark',{targetId:at.id}));return {g,c,at};
}
test('remuniciar a bordo (RTS): +1 míssil a cada 3 s no transporte roxo; no verde não muda',()=>{
 const r=loaded({blue:'roxo',red:'red'});advance(r.g,3.1);assert.equal(r.at.atMissiles,1);
 advance(r.g,3*5);assert.equal(r.at.atMissiles,4,'enche até o máximo e para');
 const v=loaded({blue:'blue',red:'red'});advance(v.g,12);assert.equal(v.at.atMissiles,0);
});
test('remuniciar a bordo (turnos): +2 por turno, limitado ao máximo',()=>{
 const r=loaded({blue:'roxo',red:'red'},'turns');r.g.beginTurn('blue');assert.equal(r.at.atMissiles,2);r.g.beginTurn('blue');assert.equal(r.at.atMissiles,4);r.g.beginTurn('blue');assert.equal(r.at.atMissiles,4);
 const v=loaded({blue:'blue',red:'red'},'turns');v.g.beginTurn('blue');assert.equal(v.at.atMissiles,0);
});
test('desembarque rápido: o convertiplano roxo desembarca em altitude alta, o verde não',()=>{
 for(const [faction,expected] of [['roxo',true],['blue',false]]){
  const {g,c}=loaded({blue:faction,red:'red'},'rts','transportHelicopter');c.altitude='high';
  assert.equal(g.order(c,'disembark'),expected,faction);assert.equal(c.cargo.length,expected?0:1,faction);
 }
});
test('desembarque rápido (turnos): o transporte roxo mantém a ação, o verde a gasta',()=>{
 for(const [faction,left] of [['roxo',true],['blue',false]]){
  const g=plain({blue:faction,red:'red'},'turns'),t=g.add('blue','transportTruck',10,10),u=g.add('blue','infantry',11,10);
  assert.ok(g.order(t,'embark',{targetId:u.id}));g.beginTurn('blue');assert.ok(g.order(t,'disembark'));assert.equal(t.actionLeft,left,faction);
 }
});
test('sem evacuação blindada: transporte roxo destruído leva a tropa junto, sem reaparecer',()=>{
 const g=plain({blue:'roxo',red:'red'}),h=g.add('blue','transportHelicopter',50,50);h.altitude='low';
 for(let i=0;i<5;i++)assert.ok(g.order(h,'embark',{targetId:g.add('blue','infantry',51,50).id}));
 g.hurt(h,999,g.add('red','tank',58,50));g.hurt(h,999);
 assert.equal(g.units.filter(u=>u.owner==='blue'&&u.type==='infantry'&&u.hp>0).length,0);assert.equal(g.stats.blue.losses.infantry,5);
});

const ROLES=[['fighterBlue','fighterRoxo',615],['multiroleBlue','multiroleRoxo',800],['stealthFighterBlue','stealthFighterRoxo',990],['bomberBlue','bomberRoxo',1276]];
test('aviões roxos: custo dentro de ±10% do equivalente Verde e catálogo só com modelos roxos',()=>{
 for(const [verde,roxo,cost] of ROLES){
  assert.equal(TYPES[roxo].team,'roxo',roxo);assert.equal(TYPES[roxo].cost,cost,roxo+' custo');
  assert.ok(Math.abs(TYPES[roxo].cost/TYPES[verde].cost-1)<=.10,roxo+' dentro de ±10% de '+verde);
 }
 const g=field({blue:'roxo',red:'red'});assert.deepEqual([...g.planeCatalog('blue')].sort(),ROLES.map(r=>r[1]).sort());
 assert.ok(!g.planeCatalog('red').some(t=>/Roxo$/.test(t)));
});
test('a IA compra aviões roxos quando joga de Roxo',()=>{
 const g=field({blue:'blue',red:'roxo'});g.aiEnabled=true;g.turn='red';g.credits.red=20000;const airport=g.add('red','airportAsphalt',100,60);g.add('red','infantry',100,50);g.add('blue','infantry',90,50);g.updateVision();
 for(let i=0;i<6;i++){g.aiBuy();g.production('red',200);}
 const bought=g.units.filter(u=>u.owner==='red'&&TYPES[u.type].plane).map(u=>u.type).concat(airport.queue.map(q=>q.type));
 assert.ok(bought.length>0,'a IA comprou algum avião');for(const type of bought)assert.equal(TYPES[type].team,'roxo',type);
});

const zlib=require('node:zlib'),vm=require('node:vm');
function pngInfo(dataUri){const buf=Buffer.from(dataUri.slice('data:image/png;base64,'.length),'base64'),w=buf.readUInt32BE(16),h=buf.readUInt32BE(20);
 const idat=[];for(let p=8;p<buf.length;){const len=buf.readUInt32BE(p),t=buf.toString('latin1',p+4,p+8);if(t==='IDAT')idat.push(buf.subarray(p+8,p+8+len));p+=12+len;}
 const raw=zlib.inflateSync(Buffer.concat(idat));assert.equal(buf[25],6,'RGBA');const alpha=(x,y)=>{assert.equal(raw[y*(w*4+1)],0,'filtro 0');return raw[y*(w*4+1)+1+x*4+3];};
 return {w,h,corners:[alpha(0,0),alpha(w-1,0),alpha(0,h-1),alpha(w-1,h-1)],opaque:raw.length>0};}
test('arte roxa: 15 sprites 128×128, 4 aviões 256×256, 2 quadros do lançador, cantos transparentes, placeholder declarado',()=>{
 const js=fs.readFileSync(path.join(__dirname,'..','public','js','assets.js'),'utf8'),begin=js.indexOf('// ROXO_ASSETS_BEGIN'),end=js.indexOf('// ROXO_ASSETS_END'),block=[js.slice(begin,end)];assert.ok(begin>=0&&end>begin,'bloco ROXO_ASSETS');
 assert.ok(block[0].includes('placeholder: stealthDrone')||fs.existsSync(path.join(__dirname,'..','assets','NovosTimes','roxo','sources','stealthDrone.png')),'placeholder declarado (ou arte real do drone presente)');
 const ctx=vm.createContext({planeSpriteData:{}});vm.runInContext(block[0]+';this.out={roxoSpriteData,roxoLaunchData};',ctx);const {roxoSpriteData,roxoLaunchData}=ctx.out;
 const sizes='lightTank,tank,heavyTank,artillery,recon,antiAirVehicle,rocketArtillery,transportTruck,transportHelicopter,transportPlane,helicopter,helicopterGround,helicopterAir,reconDrone,stealthDrone'.split(',');
 assert.deepEqual(Object.keys(roxoSpriteData).sort(),sizes.slice().sort());assert.equal(roxoLaunchData.length,2);
 for(const [name,uri] of [...Object.entries(roxoSpriteData),...roxoLaunchData.map((u,i)=>['launch'+i,u]),...Object.entries(ctx.planeSpriteData).filter(([k])=>/Roxo$/.test(k))]){
  const info=pngInfo(uri),size=/Roxo$/.test(name)?256:128;assert.equal(info.w,size,name);assert.equal(info.h,size,name);assert.deepEqual(info.corners,[0,0,0,0],name+' cantos transparentes');}
 assert.deepEqual(Object.keys(ctx.planeSpriteData).sort(),ROLES.map(r=>r[1]).sort());
});
test('render e UI conhecem a arte 3 e os aviões roxos (nenhuma unidade roxa fica sem sprite ou sem categoria)',()=>{
 const render=fs.readFileSync(path.join(__dirname,'..','public','js','render.js'),'utf8'),ui=fs.readFileSync(path.join(__dirname,'..','public','js','ui.js'),'utf8');
 assert.ok(render.includes('[ROXO]:3'),'ART tem o índice 3');assert.ok(render.includes('3:{images:roxoImages'),'TEAM_ART liga a arte 3 às imagens roxas');
 for(const [,roxo] of ROLES){assert.ok(new RegExp(roxo+":'aereo'").test(ui),roxo+' em UNIT_CATEGORY');assert.ok(ui.includes("'"+roxo+"'"),roxo+' em PRODUCTION_CATEGORY');}
});

if(require.main===module){for(const [name,fn] of cases){fn();console.log('OK '+name);}console.log(cases.length+' verificações do Roxo passaram.');}
