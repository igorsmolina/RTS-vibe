'use strict';
// Revisão reproduzível: usa o motor atual; não altera regras do produto.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const code=fs.readFileSync('public/js/engine.js','utf8'),ctx=vm.createContext({console});
vm.runInContext(code+'\nthis.api={Game,TYPES,KEY,DIST,AIR,PLAN,seeded};',ctx);
const {Game,TYPES,KEY,DIST,AIR,PLAN,seeded}=ctx.api;
const output={sourceHash:crypto.createHash('sha256').update(code).digest('hex'),checks:[],natural:[]};
function field(mode='rts'){
 const g=new Game('river','normal',17,mode);g.aiEnabled=false;g.units=[];g.structures=[];g.mines=[];g.terrain.fill('plain');g.memory.red.clear();g.intel.clear();g.turn='red';
 g.doctrines={blue:'balanced',red:'balanced'};g.add('blue','hq',1,88);g.add('red','hq',120,1);g.credits.red=1000;g.updateVision();return g;
}
function check(name,fn){try{const details=fn();output.checks.push({name,ok:true,details});console.log('OK '+name);}catch(e){output.checks.push({name,ok:false,error:e.stack});console.error('FAIL '+name+': '+e.message);process.exitCode=1;}}
function advance(g,seconds){for(let i=0;i<seconds*30&&!g.winner;i++){g.update(1/30);if(i%30===0)g.events=[];}}
if(process.argv.includes('--balance')){
 output.weaponSamples=[];output.duels=[];
 for(const [type,targetType]of [['infantry','infantry'],['machinegun','infantry'],['antitank','tank'],['lightTank','heavyTank'],['tank','heavyTank'],['heavyTank','tank'],['helicopter','infantry'],['antiAirVehicle','helicopter']]){
  const g=field(),u=g.add('blue',type,60,60),v=g.add('red',targetType,62,60);v.flares=0;v.hp=v.maxHp=10000;g.updateVision();g.rng=()=>.5;const w=g.weapon(u,v);
  if(!w){output.weaponSamples.push({type,targetType,compatible:false});continue;}
  g.shoot(u,v,w);const p=g.projectiles.pop();p.hit=true;p.critical=false;g.impact(p);const damage=10000-v.hp,shots=type==='machinegun'?3:w==='gun'?TYPES[type].gun.shots:1;
  output.weaponSamples.push({type,targetType,weapon:w,damagePerHit:damage,accuracy:p.accuracy,cooldown:u.cooldown,rtsExpectedDpsNoCrit:damage*p.accuracy/u.cooldown,turnExpectedDamageNoCrit:damage*p.accuracy*shots});
 }
 for(const seed of [1,2,3,4,5,9,17,44])for(const [blue,red]of [[['infantry','infantry'],['machinegun']],[['antitank','antitank'],['heavyTank']],[['tank'],['helicopter']],[['infantry','infantry','infantry'],['helicopter']]]){
  const g=field();g.rng=seeded(seed);blue.forEach((t,i)=>g.add('blue',t,60,60+i));red.forEach((t,i)=>g.add('red',t,62,60+i));g.updateVision();advance(g,20);
  output.duels.push({seed,blue,red,blueCost:blue.reduce((n,t)=>n+TYPES[t].cost,0),redCost:red.reduce((n,t)=>n+TYPES[t].cost,0),survivors:g.units.filter(u=>!TYPES[u.type].structure).map(u=>({type:u.type,owner:u.owner,hp:u.hp})),losses:g.stats});
 }
 console.log(JSON.stringify(output.weaponSamples));
}else if(!process.argv.includes('--natural')){
 for(const mode of ['rts','turns']){
  check(mode+': memória terrestre expira e não passa para partida nova',()=>{
   const g=field(mode),goal={x:70,y:60};g.aiFailure(goal,'losses');assert.equal(g.aiAvoid(goal),true);
   const saved=Game.fromSnapshot(g.snapshot());assert.equal(saved.aiAvoid(goal),true);
   if(mode==='rts')g.time=90;else g.round+=6;assert.equal(g.aiAvoid(goal),false);
   assert.equal(field(mode).aiAvoid(goal),false);return {duration:mode==='rts'?'90 segundos':'6 rodadas',preservedInSave:true,newMatchMemory:false};
  });
  check(mode+': perda aérea repetida aumenta cautela até três vezes',()=>{
   const g=field(mode),goal={x:70,y:60},cooldowns=[];
   for(let i=0;i<4;i++){const u=g.add('red','multiroleRed',72,60);u.aiAirMission={...goal,cost:TYPES.multiroleRed.cost,since:g.aiNow()};g.hurt(u,u.hp);const f=g.plan.airFailures[0];cooldowns.push(f.until-g.aiNow());}
   assert.deepEqual(cooldowns,mode==='rts'?[120,240,360,360]:[6,12,18,18]);assert.equal(g.aiAirAvoid(goal),true);
   assert.equal(Game.fromSnapshot(g.snapshot()).aiAirAvoid(goal),true);assert.equal(field(mode).aiAirAvoid(goal),false);
   return {cooldowns,lostCost:g.plan.airFailures[0].lostCost};
  });
  check(mode+': embarque da onda é confundido com perda de combate',()=>{
   const g=field(mode),truck=g.add('red','transportTruck',60,60),foot=[];
   for(let i=0;i<6;i++)foot.push(g.add('red','infantry',61,60));
   g.plan={phase:'attack',since:0,rally:{x:60,y:60},objective:{x:80,y:60},wave:foot.map(u=>u.id),waveStart:foot.reduce((n,u)=>n+g.power(u),0)};
   for(const u of foot.slice(0,4)){truck.actionLeft=true;assert.ok(g.order(truck,'embark',{targetId:u.id}));}
   g.aiEnabled=true;g.planAI();assert.equal(g.plan.failures[0].reason,'losses');assert.equal(g.stats.red.losses.infantry||0,0);
   return {finding:true,cargo:truck.cargo.length,actualLosses:0,recordedFailure:g.plan.failures[0].reason,phase:g.plan.phase};
  });
  check(mode+': helicóptero vermelho não usa salvas pelo fluxo da IA',()=>{
   const g=field(mode),u=g.add('red','transportHelicopter',60,60),target=g.add('blue','post',65,60);g.plan.objective=target;g.updateVision();
   assert.ok(g.canBombard(u,{x:65,y:60}));g.aiAct(u);
   assert.notEqual(u.order.type,'bombard');assert.equal(u.salvos,2);assert.equal(g.projectiles.length,0);
   return {finding:true,canBombard:true,order:u.order.type,unusedSalvos:u.salvos};
  });
  check(mode+': compra terrestre/aérea e transporte efetivo pelo aiAct',()=>{
   const results=[];
   for(const barrier of [false,true]){const g=field(mode);g.plan.objective={x:80,y:60};for(let i=0;i<4;i++)g.add('red','infantry',100+i,60);
    if(barrier)for(let y=0;y<96;y++)g.terrain[KEY(90,y)]='river';assert.ok(g.aiBuyTransport());results.push(g.commandBase('red').queue[0].type);
   }assert.deepEqual(results,['transportTruck','transportHelicopter']);
   const g=field(mode),u=g.add('red','transportTruck',60,60),p=g.add('red','infantry',61,60);g.plan.objective={x:80,y:60};g.aiAct(u);assert.equal(u.cargo[0].id,p.id);
   u.x=78;u.actionLeft=true;g.aiAct(u);assert.equal(u.cargo.length,0);assert.equal(g.get(p.id),p);
   return {purchases:results,embarkAndDelivery:true};
  });
  check(mode+': compra e entrega automática de paraquedistas pela IA',()=>{
   const g=field(mode);g.add('red','airportDirt',100,60);g.add('red','reconDrone',80,60);g.plan.objective={x:80,y:60};g.updateVision();
   const before=g.credits.red;assert.ok(g.aiBuyTransport());const plane=g.airdropPlane('red');assert.ok(plane);assert.equal(plane.cargo.length,5);assert.equal(before-g.credits.red,425);
   advance(g,150);assert.equal(plane.cargo.length,0);assert.equal(g.units.filter(u=>u.owner==='red'&&u.type==='infantry').length,4);
   return {charged:425,deliveredInfantry:4,deliveredRecon:g.units.filter(u=>u.owner==='red'&&u.type==='recon').length,phase:plane.airdrop.phase};
  });
 }
 check('turnos: parte após uma tropa, mesmo com quatro vagas e passageiros adjacentes',()=>{
  const g=field('turns'),u=g.add('red','transportTruck',60,60);for(let i=0;i<4;i++)g.add('red','infantry',61,60);g.plan.objective={x:80,y:60};g.aiAct(u);
  assert.equal(u.cargo.length,1);g.beginTurn('red');g.aiAct(u);assert.equal(u.cargo.length,1);assert.equal(u.order.type,'move');
  return {finding:true,capacity:4,used:1,order:u.order.type};
 });
 check('perda de transporte e carga não alimenta memória específica de logística',()=>{
  const g=field(),u=g.add('red','transportHelicopter',60,60),p=g.add('red','infantry',61,60);g.plan.objective={x:80,y:60};g.aiAct(u);g.hurt(u,u.hp);
  assert.equal(g.stats.red.losses.infantry,1);assert.equal(g.plan.airFailures?.length||0,0);assert.equal(g.plan.failures?.length||0,0);
  return {finding:true,countedLosses:g.stats.red.losses,airFailures:0,groundFailures:0};
 });
 check('poupança de avião bloqueia transporte acessível no mesmo ciclo de compra',()=>{
  const g=field(),airport=g.add('red','airportDirt',100,60);g.credits.red=320;g.plan.objective={x:80,y:60};for(let i=0;i<4;i++)g.add('red','infantry',100+i,65);g.aiEnabled=true;g.updateVision();g.aiBuy();
  assert.equal(g.commandBase('red').queue.length,0);assert.equal(airport.queue.length,0);assert.equal(g.credits.red,320);assert.ok(g.aiBuyTransport());assert.equal(g.commandBase('red').queue[0].type,'transportTruck');
  return {finding:true,creditsAvailable:320,aiBuySavedForAircraft:true,transportAffordable:true};
 });
 output.balance={units:Object.fromEntries(Object.entries(TYPES).filter(([,t])=>!t.structure).map(([type,t])=>[type,{cost:t.cost,hp:t.hp,range:t.range,speed:t.speed,move:t.move,capacity:t.capacity,damage:t.damage,cooldown:t.cooldown,train:t.train}])),difficulty:PLAN};
}else{
 for(const map of ['river','desert','mountain','random'])for(const mode of ['rts','turns']){
  const g=new Game(map,'normal',44,mode),stats={embarks:0,disembarked:0,airdropPurchases:0,airdropSpawns:0,purchasedCarriers:0,groundFailures:0,airFailures:0},initialTransports=g.units.filter(u=>u.owner==='red'&&TYPES[u.type].capacity).map(u=>u.type);
  const order=g.order,request=g.requestAirdrop,enqueue=g.enqueue,add=g.add,failure=g.aiFailure,airFailure=g.aiAirFailure;
  g.order=function(u,type,args,...rest){const n=u.cargo?.length||0,ok=order.call(this,u,type,args,...rest);if(ok&&u.owner==='red'){if(type==='embark')stats.embarks++;if(type==='disembark')stats.disembarked+=n-(u.cargo?.length||0);}return ok;};
  g.requestAirdrop=function(owner,...args){const ok=request.call(this,owner,...args);if(ok&&owner==='red')stats.airdropPurchases++;return ok;};
  g.enqueue=function(owner,type,...args){const ok=enqueue.call(this,owner,type,...args);if(ok&&owner==='red'&&TYPES[type].capacity)stats.purchasedCarriers++;return ok;};
  g.add=function(owner,type,...args){const u=add.call(this,owner,type,...args);if(owner==='red'&&type==='transportPlane')stats.airdropSpawns++;return u;};
  g.aiFailure=function(...args){stats.groundFailures++;return failure.apply(this,args);};g.aiAirFailure=function(...args){const n=this.plan.airFailures?.reduce((a,f)=>a+f.count,0)||0,r=airFailure.apply(this,args);if((this.plan.airFailures?.reduce((a,f)=>a+f.count,0)||0)>n)stats.airFailures++;return r;};
  if(mode==='rts')advance(g,300);else for(let r=0;r<48&&!g.winner;r++){assert.equal(g.turn,'blue');assert.ok(g.endTurn('blue'));let ticks=0;while((g.turn!=='blue'||g.busy)&&!g.winner&&ticks++<18000){g.update(1/30);if(ticks%30===0)g.events=[];}assert.ok(ticks<18000);}
  const row={map,mode,seed:44,blue:'sem ordens',duration:mode==='rts'?g.time:g.round,initialTransports,...stats,finalTransports:g.units.filter(u=>u.owner==='red'&&TYPES[u.type].capacity).map(u=>({type:u.type,cargo:u.cargo?.length||0,phase:u.airdrop?.phase})),losses:g.stats.red.losses,redPosts:g.structures.filter(s=>s.type==='post'&&s.owner==='red').length,credits:g.credits.red,winner:g.winner};
  output.natural.push(row);console.log(JSON.stringify(row));fs.writeFileSync(__dirname+'/natural.json',JSON.stringify(output,null,2));
 }
}
fs.writeFileSync(__dirname+(process.argv.includes('--natural')?'/natural.json':process.argv.includes('--balance')?'/balanceamento.json':'/cenarios.json'),JSON.stringify(output,null,2));
