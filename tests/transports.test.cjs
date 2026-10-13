'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync('public/js/engine.js','utf8')+'\nthis.api={Game,TYPES,KEY,AIR};',ctx);
const {Game,TYPES,KEY,AIR}=ctx.api;
function field(mode='rts'){const g=new Game('river','normal',17,mode);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.aiEnabled=false;g.add('blue','hq',1,88);g.add('red','hq',120,1);g.credits.blue=5000;g.updateVision();return g;}
function advance(g,s){for(let t=0;t<s;t+=1/30)g.update(1/30);}
function until(g,cond,s=120){for(let t=0;t<s&&!cond();t+=1/30)g.update(1/30);assert.ok(cond(),'condição não atingida');}
let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
check('Carga preserva identidade e remove ocupação, visão, aura e ordens',()=>{
 const g=field(),truck=g.add('blue','transportTruck',10,10),foot=g.add('blue','commander',11,10);foot.hp=67;g.updateVision();
 assert.equal(TYPES.transportTruck.capacity,4);assert.equal(g.order(truck,'embark',{targetId:foot.id}),true);
 assert.equal(g.get(foot.id),undefined);assert.equal(g.occupied(11,10,null,false),undefined);assert.equal(truck.cargo[0],foot);
 assert.equal(g.hasAura(truck),false);assert.equal(g.order(foot,'move',{x:12,y:10}),false);
 assert.equal(g.order(truck,'disembark'),true);assert.equal(g.get(foot.id),foot);assert.equal(foot.hp,67);assert.equal(truck.cargo.length,0);
});
check('Capacidade, proprietário, distância, terreno e altitude validam antes de alterar',()=>{
 const g=field(),truck=g.add('blue','transportTruck',10,10),heli=g.add('blue','transportHelicopter',20,20);
 const enemy=g.add('red','infantry',11,10),tank=g.add('blue','lightTank',10,11),far=g.add('blue','infantry',15,10);
 for(const u of [enemy,tank,far])assert.equal(g.order(truck,'embark',{targetId:u.id}),false);
 for(let i=0;i<4;i++){const u=g.add('blue','infantry',11,10);assert.ok(g.order(truck,'embark',{targetId:u.id}));}
 const extra=g.add('blue','infantry',11,10);assert.equal(g.order(truck,'embark',{targetId:extra.id}),false);
 const u=g.add('blue','engineer',21,20);heli.altitude='high';assert.equal(g.order(heli,'embark',{targetId:u.id}),false);
 heli.altitude='low';g.terrain[KEY(20,20)]='river';assert.equal(g.order(heli,'embark',{targetId:u.id}),false);
 g.terrain[KEY(20,20)]='plain';assert.ok(g.order(heli,'embark',{targetId:u.id}));
});
check('Desembarque bloqueado mantém a carga; morte conta cada passageiro uma vez',()=>{
 const g=field(),truck=g.add('blue','transportTruck',10,10),u=g.add('blue','infantry',11,10);assert.ok(g.order(truck,'embark',{targetId:u.id}));
 for(const [x,y]of [[9,10],[11,10],[10,9],[10,11]])g.add('blue','heavyTank',x,y);
 assert.equal(g.order(truck,'disembark'),false);assert.equal(truck.cargo.length,1);
 g.hurt(truck,999,g.add('red','tank',15,10));g.hurt(truck,999);assert.equal(g.stats.blue.losses.infantry,1);assert.equal(g.stats.blue.losses.transportTruck,1);
});
check('Turnos: ação do transporte e tropas indisponíveis até o próximo turno',()=>{
 const g=field('turns'),truck=g.add('blue','transportTruck',10,10),u=g.add('blue','infantry',11,10);
 assert.ok(g.order(truck,'embark',{targetId:u.id}));assert.equal(truck.actionLeft,false);assert.equal(g.order(truck,'disembark'),false);
 g.beginTurn('blue');assert.ok(g.order(truck,'disembark'));assert.equal(u.actionLeft,false);assert.equal(u.moveLeft,0);g.beginTurn('blue');assert.equal(u.actionLeft,true);
});
check('Reforço: compra válida, rejeições sem cobrança, missão única e descida em linha',()=>{
 const g=field(),base=g.add('blue','airportDirt',20,20),scout=g.add('blue','recon',30,30);g.updateVision();const before=g.credits.blue;
 for(const cargo of [{commander:1},{heavyTank:1},{infantry:13},{infantry:-1},{infantry:1.5}])assert.equal(g.requestAirdrop('blue',base.id,cargo,{x:30,y:30}),false);
 assert.equal(g.requestAirdrop('blue',base.id,{infantry:1},{x:90,y:50}),false);assert.equal(g.credits.blue,before);
 assert.ok(g.requestAirdrop('blue',base.id,{infantry:2,lightTank:1},{x:30,y:30}));assert.equal(g.credits.blue,before-350);
 assert.equal(g.requestAirdrop('blue',base.id,{infantry:1},{x:30,y:30}),false);
 until(g,()=>g.drops.length===3&&g.units.filter(u=>u.type==='infantry').length===0);
 advance(g,3);assert.equal(g.units.filter(u=>u.type==='infantry').length,2);assert.equal(g.units.filter(u=>u.type==='lightTank').length,1);assert.equal(g.drops.length,0);
 const plane=g.airdropPlane('blue');until(g,()=>plane.airdrop.phase==='parked');assert.equal(plane.cargo.length,0);assert.equal(AIR(plane),false);
});
check('Abate perde carga a bordo mas não interrompe paraquedas; sem área de pouso a carga volta a bordo',()=>{
 const g=field(),base=g.add('blue','airportDirt',20,20);g.add('blue','recon',30,30);g.updateVision();g.requestAirdrop('blue',base.id,{infantry:2},{x:30,y:30});
 const plane=g.units.find(u=>TYPES[u.type].airdropPlane);g.hurt(plane,999);advance(g,40);assert.equal(g.units.some(u=>u.type==='infantry'),false);assert.equal(g.stats.blue.losses.infantry,2);
 const h=field(),b=h.add('blue','airportDirt',20,20);h.add('blue','recon',30,30);h.updateVision();h.requestAirdrop('blue',b.id,{infantry:1},{x:30,y:30});
 const p=h.units.find(u=>TYPES[u.type].airdropPlane);until(h,()=>h.drops.length===1);h.hurt(p,999);advance(h,3);assert.equal(h.units.filter(u=>u.type==='infantry').length,1);
 const j=field(),a=j.add('blue','airportDirt',20,20);j.add('blue','recon',30,30);j.updateVision();j.requestAirdrop('blue',a.id,{lightTank:1},{x:30,y:30});const q=j.units.find(u=>TYPES[u.type].airdropPlane);
 for(let y=27;y<=33;y++)for(let x=27;x<=33;x++)j.terrain[KEY(x,y)]='river';
 until(j,()=>q.airdrop.phase==='return');assert.equal(j.drops.length,0);assert.equal(q.cargo.length,1);until(j,()=>q.airdrop.phase==='parked');assert.equal(q.cargo.length,1);assert.ok(j.credits.blue>=4750&&j.credits.blue<4900);
});
check('Save restaura passageiros, missão, paraquedas e RNG; save antigo aceita carga ausente e missão antiga',()=>{
 const g=field(),truck=g.add('blue','transportTruck',10,10),u=g.add('blue','engineer',11,10);g.order(truck,'embark',{targetId:u.id});
 const base=g.add('blue','airportDirt',20,20);g.add('blue','recon',30,30);g.updateVision();g.requestAirdrop('blue',base.id,{infantry:2},{x:30,y:30});
 const saved=g.snapshot(),restored=Game.fromSnapshot(saved);assert.equal(restored.get(truck.id).cargo[0].id,u.id);assert.equal(restored.get(u.id),undefined);assert.equal(restored.rng(),g.rng());
 advance(restored,70);assert.equal(restored.units.filter(u=>u.type==='infantry').length,2);assert.ok(restored.order(restored.get(truck.id),'disembark'));
 const old=field().snapshot();delete old.state.drops;assert.equal(Game.fromSnapshot(old).drops.length,0);
 const invalid=g.snapshot();invalid.state.units[0].type='bad';assert.throws(()=>Game.fromSnapshot(invalid));
 const duplicate=g.snapshot();duplicate.state.units.push(duplicate.state.units[0]);assert.throws(()=>Game.fromSnapshot(duplicate));
 const legacy=g.snapshot(),lp=legacy.state.units.find(v=>v.type==='transportPlane');lp.x=28;lp.y=30;lp.flightState='approach';lp.airdrop={destination:{x:30,y:30},exit:{x:127,y:30},phase:'approach',cargo:lp.cargo,refund:0};delete lp.cargo;
 const old2=Game.fromSnapshot(legacy);advance(old2,40);assert.equal(old2.units.filter(v=>v.type==='infantry').length,2);
});
check('Carga sem pouso continua a bordo e conta como perda se o avião cair no retorno',()=>{
 const g=field(),base=g.add('blue','airportDirt',20,20);g.add('blue','recon',30,30);g.updateVision();g.requestAirdrop('blue',base.id,{lightTank:1},{x:30,y:30});const plane=g.units.find(u=>u.type==='transportPlane');
 for(let y=27;y<=33;y++)for(let x=27;x<=33;x++)g.terrain[KEY(x,y)]='river';until(g,()=>plane.airdrop.phase==='return');assert.equal(plane.cargo.length,1);g.hurt(plane,999);assert.equal(g.stats.blue.losses.lightTank,1);assert.ok(g.credits.blue>=4750&&g.credits.blue<4900);
});
check('Pausa congela voo e descida; voo por turnos termina e aguarda turno seguinte',()=>{
 const g=field('turns'),base=g.add('blue','airportDirt',20,20);g.add('blue','recon',30,30);g.updateVision();assert.ok(g.requestAirdrop('blue',base.id,{infantry:1},{x:30,y:30}));
 const plane=g.units.find(u=>TYPES[u.type].airdropPlane),start=plane.x;g.paused=true;advance(g,3);assert.equal(plane.x,start);g.paused=false;advance(g,90);assert.equal(g.busy,false);assert.equal(plane.airdrop.phase,'parked');
 const foot=g.units.find(u=>u.type==='infantry');assert.equal(foot.actionLeft,false);assert.equal(foot.moveLeft,0);g.beginTurn('blue');assert.equal(foot.actionLeft,true);
 const h=field(),p=h.add('blue','transportTruck',10,10),enemy=h.add('red','infantry',11,10);h.updateVision();assert.equal(h.canFire(p,enemy),false);
});
check('Avião desarmado é detectado e atingido pela defesa antiaérea existente',()=>{
 const g=field(),base=g.add('blue','airportDirt',20,20);g.add('blue','recon',30,30);g.updateVision();g.requestAirdrop('blue',base.id,{infantry:1},{x:30,y:30});const plane=g.units.find(u=>u.type==='transportPlane'),aa=g.add('red','antiAirVehicle',32,30);plane.x=30;plane.y=30;g.updateVision();
 assert.equal(g.canFire(plane,aa),false);assert.equal(g.canFire(aa,plane),true);g.rng=()=>0;g.shoot(aa,plane,'antiAirVehicle');advance(g,5);assert.ok(plane.hp<240);assert.ok(g.stats.blue.losses.transportPlane===1||plane.hp>0);
});
check('IA embarca tropas, entrega antes do combate e escolhe transporte aéreo sem rota terrestre',()=>{
 const g=field(),truck=g.add('red','transportTruck',60,60),foot=g.add('red','infantry',61,60);g.plan.objective={x:70,y:60};g.aiTransport(truck);assert.equal(truck.cargo[0],foot);
 truck.x=68;g.aiTransport(truck);assert.equal(truck.cargo.length,0);assert.equal(g.get(foot.id),foot);
 const h=field();h.credits.red=1000;h.plan.objective={x:80,y:60};for(let i=0;i<4;i++)h.add('red','infantry',100+i,60);for(let y=0;y<96;y++)h.terrain[KEY(90,y)]='river';assert.ok(h.aiBuyTransport());assert.equal(h.commandBase('red').queue[0].type,'transportHelicopter');
});
check('Lançamento misto reserva primeiro o terreno necessário ao veículo',()=>{
 const g=field(),base=g.add('blue','airportDirt',20,20);g.add('blue','recon',30,30);for(let y=27;y<=33;y++)for(let x=27;x<=33;x++)g.terrain[KEY(x,y)]='mountain';g.terrain[KEY(30,29)]='plain';g.updateVision();
 assert.ok(g.requestAirdrop('blue',base.id,{infantry:1,lightTank:1},{x:30,y:30}));until(g,()=>g.drops.length===2);const tank=g.drops.find(d=>d.passenger.type==='lightTank');assert.deepEqual([tank.x,tank.y],[30,29]);
});
check('Helicóptero leva 6 tropas e 1 veículo pendurado por equipe; avião aceita 12 vagas e tanque médio',()=>{
 const g=field(),heli=g.add('blue','transportHelicopter',20,20);heli.altitude='low';
 for(let i=0;i<6;i++){const u=g.add('blue','infantry',21,20);assert.ok(g.order(heli,'embark',{targetId:u.id}));}
 const seventh=g.add('blue','infantry',21,20),medium=g.add('blue','tank',20,21),light=g.add('blue','lightTank',19,20),light2=g.add('blue','lightTank',20,19),rocket=g.add('blue','rocketArtillery',21,21);
 assert.equal(g.order(heli,'embark',{targetId:seventh.id}),false);assert.equal(g.order(heli,'embark',{targetId:medium.id}),false);assert.equal(g.order(heli,'embark',{targetId:rocket.id}),false);
 assert.ok(g.order(heli,'embark',{targetId:light.id}));assert.equal(g.order(heli,'embark',{targetId:light2.id}),false);
 assert.equal(heli.cargo.length,7);assert.equal(g.get(light.id),undefined);
 g.units=g.units.filter(u=>![seventh,medium,light2,rocket].includes(u));heli.cargo.splice(0,6);assert.ok(g.order(heli,'disembark'));assert.ok(g.get(light.id));assert.equal(heli.cargo.length,0);
 const red=field(),rh=red.add('red','transportHelicopter',60,60);rh.altitude='low';const rl=red.add('red','lightTank',61,60),rr=red.add('red','rocketArtillery',59,60);
 assert.equal(red.order(rh,'embark',{targetId:rl.id}),false);assert.equal(red.order(rh,'embark',{targetId:rr.id}),false);assert.equal(rh.cargo.length,0);
 const h=field(),base=h.add('blue','airportDirt',20,20);h.add('blue','recon',30,30);h.updateVision();
 for(const cargo of [{infantry:13},{tank:2,infantry:1},{tank:3},{tank:1,lightTank:1,infantry:3}])assert.equal(h.requestAirdrop('blue',base.id,cargo,{x:30,y:30}),false);
 assert.equal(h.airdropQuote({infantry:12}).slots,12);assert.equal(h.airdropQuote({tank:2}).slots,12);assert.equal(h.airdropQuote({tank:1,lightTank:1,infantry:2}).slots,12);
 const before=h.credits.blue;assert.ok(h.requestAirdrop('blue',base.id,{tank:2},{x:30,y:30}));assert.equal(h.credits.blue,before-450);
 until(h,()=>h.units.filter(u=>u.type==='tank').length===2||h.drops.length===2);advance(h,3);assert.equal(h.units.filter(u=>u.type==='tank').length,2);
});
check('Avião pousa na pista, embarca tropas próximas e lança em linha, depois volta a pousar',()=>{
 const g=field(),base=g.add('blue','airportDirt',20,20);g.add('blue','recon',30,29);g.updateVision();
 assert.ok(g.requestAirdrop('blue',base.id,{infantry:1}));const plane=g.airdropPlane('blue');
 assert.equal(g.requestAirdrop('blue',base.id,{infantry:1}),false);
 until(g,()=>plane.airdrop.phase==='parked');assert.equal(plane.airportId,base.id);assert.equal(AIR(plane),false);assert.ok(g.docked(base).includes(plane));assert.equal(plane.cargo.length,1);
 const near=g.add('blue','infantry',20,23),far=g.add('blue','infantry',20,30);g.updateVision();
 assert.equal(g.order(plane,'embark',{targetId:far.id}),false);assert.ok(g.order(plane,'embark',{targetId:near.id}));assert.equal(plane.cargo.length,2);assert.equal(g.get(near.id),undefined);
 assert.equal(g.order(plane,'airdropLaunch',{start:{x:30,y:30},end:{x:31,y:30}}),false);assert.equal(plane.airdrop.phase,'parked');
 assert.ok(g.requestAirdrop('blue',base.id,{infantry:2}));assert.equal(plane.cargo.length,4);assert.ok(g.credits.blue<4700);
 assert.ok(g.order(plane,'disembark'));assert.equal(plane.cargo.length,0);assert.equal(g.units.filter(u=>u.type==='infantry').length,5);
 for(const u of g.units.filter(u=>u.type==='infantry'&&u!==far))assert.ok(g.order(plane,'embark',{targetId:u.id}));assert.equal(plane.cargo.length,4);
 assert.equal(g.order(plane,'airdropLaunch',{start:{x:27,y:30},end:{x:33,y:30}}),true);assert.equal(AIR(plane),false);assert.equal(g.requestAirdrop('blue',base.id,{infantry:1}),false);
 until(g,()=>g.drops.length===4);const xs=g.drops.map(d=>d.x).sort((a,b)=>a-b);assert.ok(xs[3]-xs[0]>=4);
 until(g,()=>plane.airdrop.phase==='parked'&&g.drops.length===0);assert.equal(plane.cargo.length,0);assert.equal(g.units.filter(u=>u.type==='infantry').length,5);
 g.credits.blue=1000;assert.ok(g.requestAirdrop('blue',base.id,{infantry:3}));assert.equal(plane.cargo.length,3);
 g.hurt(base,9999,null);assert.equal(g.units.includes(plane),false);
});
check('Compra rápida no avião parado: sem taxa de voo, +20% no preço, já a bordo',()=>{
 const g=field(),base=g.add('blue','airportDirt',20,20),other=g.add('blue','airportDirt',40,20);g.add('blue','recon',30,29);g.updateVision();
 assert.equal(g.boardPrice('infantry'),60);assert.equal(g.canBoardPurchase('blue',base.id,'infantry'),false);assert.equal(g.boardPurchase('blue',base.id,'infantry'),false);
 assert.ok(g.requestAirdrop('blue',base.id,{infantry:1}));const plane=g.airdropPlane('blue');assert.equal(g.canBoardPurchase('blue',base.id,'infantry'),false);
 until(g,()=>plane.airdrop.phase==='parked');const before=g.credits.blue;
 assert.equal(g.canBoardPurchase('blue',other.id,'infantry'),false);assert.equal(g.canBoardPurchase('blue',base.id,'commander'),false);assert.equal(g.canBoardPurchase('red',base.id,'infantry'),false);
 assert.ok(g.boardPurchase('blue',base.id,'infantry'));assert.equal(g.credits.blue,before-60);assert.equal(plane.cargo.length,2);assert.equal(g.units.filter(u=>u.type==='infantry').length,0);
 assert.ok(g.boardPurchase('blue',base.id,'tank'));assert.equal(g.credits.blue,before-60-180);assert.equal(g.cargoSlots(plane),8);
 assert.equal(g.canBoardPurchase('blue',base.id,'tank'),false);g.credits.blue=1000;for(let i=0;i<4;i++)assert.ok(g.boardPurchase('blue',base.id,'infantry'));assert.equal(g.cargoSlots(plane),12);assert.equal(g.canBoardPurchase('blue',base.id,'infantry'),false);
 g.credits.blue=1;plane.cargo.pop();assert.equal(g.canBoardPurchase('blue',base.id,'infantry'),false);
});
console.log(checks+' verificações de transportes concluídas.');
