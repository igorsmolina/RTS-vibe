'use strict';
// Time azul (França): facção 'franca' com fichas próprias por unidade e mecânicas novas (GALIX, atira e foge, salva do Tigre…).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const names='AUTO_CRUISE,Game,TYPES,FR_TYPES,SPEC,UT,KIT,FRANCE,STANDARD_FACTIONS,startingCatalog,cleanStartingArmy,armyCost,STARTING_BUDGET,UNIT_CAP,BARRAGE,AIR,PLANE,FOOT,trophyMax,seatsUsed,salvoSize,GALIX_CHARGES,GALIX_SMOKE,SCOOT_TIME,SHORT_RUNWAY,AIRDROP_SLOTS,PLANE_MODELS'.split(',');
const E=new Function(fs.readFileSync(path.join(__dirname,'..','public','js','engine.js'),'utf8')+'\nreturn {'+names.join(',')+'};')();
const {AUTO_CRUISE,Game,TYPES,FR_TYPES,SPEC,UT,FRANCE,STANDARD_FACTIONS,startingCatalog,cleanStartingArmy,armyCost,STARTING_BUDGET,BARRAGE,AIR,PLANE,trophyMax,seatsUsed,salvoSize,GALIX_CHARGES,GALIX_SMOKE,SCOOT_TIME,SHORT_RUNWAY}=E;
const FR_SIDE={blue:FRANCE,red:'red'},cases=[],test=(name,fn)=>cases.push([name,fn]);
function field(factions=FR_SIDE,mode='rts'){
 const g=new Game('river','normal',123,mode,{posts:2},{},{},null,factions);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.actions=[];g.animation=null;g.projectiles=[];g.memory.blue.clear();g.memory.red.clear();g.intel.clear();g.aiEnabled=false;
 g.add('blue','hq',1,90);g.add('red','hq',120,2);g.rng=()=>.5;g.updateVision();return g;
}
const settle=(g,max=600)=>{for(let i=0;i<max&&(g.projectiles.length||g.animation||g.actions.length);i++){g.update(1/30);g.events=[];}};
const run=(g,seconds)=>{for(let i=0;i<seconds*30;i++){g.update(1/30);g.events=[];}};

test('fichas da França: cada unidade mantém o tipo e troca só o que o plano define',()=>{
 for(const [type,spec] of Object.entries(FR_TYPES)){assert.ok(TYPES[type],type);assert.equal(spec.name===undefined||typeof spec.name==='string',true);}
 const g=field();const u=name=>g.add('blue',name,10,80);
 assert.equal(UT(u('lightTank')).speed,2.3);assert.equal(u('lightTank').hp,95);assert.equal(u('tank').hp,155);assert.equal(u('heavyTank').hp,300);
 assert.equal(u('artillery').hp,80);assert.equal(u('recon').hp,65);assert.equal(u('antiAirVehicle').hp,85);assert.equal(u('rocketArtillery').hp,115);
 assert.equal(u('transportTruck').hp,100);assert.equal(u('helicopter').hp,100);assert.equal(u('helicopterAir').hp,140);assert.equal(u('reconDrone').hp,70);
 const red=g.add('red','lightTank',100,10);assert.equal(red.hp,110,'o vermelho continua com a ficha base');assert.equal(UT(red).speed,2);
 assert.equal(TYPES.lightTank.hp,110,'a tabela base não é alterada');
});
test('catálogo, custo e orçamento seguem a facção',()=>{
 assert.equal(SPEC('tank',FRANCE).cost,155);assert.equal(SPEC('tank','blue').cost,150);assert.equal(SPEC('antiAirVehicle',FRANCE).cost,145);
 const cat=startingCatalog(FRANCE);for(const t of ['fighterFr','multiroleFr','stealthFighterFr','bomberFr'])assert.ok(cat.includes(t),t);
 for(const t of ['fighterBlue','fighterRed','bomberRed'])assert.ok(!cat.includes(t),t);
 assert.equal(armyCost({tank:2},FRANCE),310);assert.equal(armyCost({tank:2},'blue'),300);
 assert.ok(armyCost({tank:3,infantry:2},FRANCE)<=STARTING_BUDGET);
 assert.deepEqual({...cleanStartingArmy({tank:2,infantry:2},FRANCE)},{tank:2,infantry:2});
 assert.notDeepEqual({...cleanStartingArmy({fighterBlue:1},FRANCE)},{fighterBlue:1},'aviões de outra facção são recusados');
 const g=field();g.credits.blue=1000;const hq=g.structures.find(s=>s.owner==='blue'&&s.type==='hq');
 assert.equal(g.recruitCost('tank',hq),155);assert.equal(g.recruitCost('tank',g.structures.find(s=>s.owner==='red')),150);
 g.add('blue','airportAsphalt',10,70);const air=g.structures.find(s=>s.type==='airportAsphalt');
 assert.equal(g.canRecruit('blue','multiroleFr',air),true);assert.equal(g.canRecruit('blue','multiroleBlue',air),false);
});
test('aviões da França: custo dentro de ±10% do aliado e munição declarada',()=>{
 const pair=[['fighterFr','fighterBlue'],['multiroleFr','multiroleBlue'],['stealthFighterFr','stealthFighterBlue'],['bomberFr','bomberBlue']];
 for(const [fr,base] of pair){const r=TYPES[fr].cost/TYPES[base].cost;assert.ok(r>=.9&&r<=1.1,fr+' custo '+TYPES[fr].cost+' vs '+TYPES[base].cost);assert.equal(TYPES[fr].team,FRANCE);}
 assert.equal(TYPES.multiroleFr.ammo.cruiseMissile,1);assert.equal(TYPES.multiroleFr.range,67);assert.ok(TYPES.multiroleFr.ammo.jetGun>0,'o Rafale mantém a metralhadora');
 assert.equal(TYPES.fighterFr.ammo.jetGun,100);assert.equal(TYPES.fighterFr.ammo.antiRadiation,1);assert.equal(TYPES.stealthFighterFr.ammo.jetAam,4);
 assert.equal(TYPES.bomberFr.radarStealth,undefined,'o bombardeiro francês é detectável');assert.equal(TYPES.bomberFr.speed,5);
 assert.equal(TYPES.bomberFr.ammo.bombIncendiary,0);assert.equal(TYPES.fighterBlue.ammo.jetGun,80,'padrão intacto');assert.equal(TYPES.bomberRed.ammo.jetGun,undefined);
});
test('silhueta pequena do VBL e queda de precisão do Leclerc',()=>{
 const g=field(),shooter=g.add('red','lightTank',50,40),vbl=g.add('blue','recon',50,36),base=g.add('blue','lightTank',52,36);
 g.updateVision();
 const a=g.accuracy(shooter,vbl),b=g.accuracy(shooter,base);assert.ok(Math.abs(a-b*.9)<1e-9,'VBL: −10% de precisão contra ele '+a+' '+b);
 const tank=g.add('blue','tank',60,40),far=g.add('red','infantry',60,45),mid=g.add('red','infantry',60,44);
 const red=field({blue:'blue',red:'red'}),rt=red.add('blue','tank',60,40),rf=red.add('red','infantry',60,44);
 assert.ok(g.accuracy(tank,mid)>red.accuracy(rt,rf),'o Leclerc azul mantém a precisão por mais uma casa');
 assert.ok(g.accuracy(tank,far)<g.accuracy(tank,mid));
});
test('GALIX: fumaça ao ser atingido, −40% de precisão contra ele, sem Trophy',()=>{
 const g=field(),tank=g.add('blue','heavyTank',50,40),foe=g.add('red','lightTank',50,36),shot=g.add('red','antitank',50,34);
 assert.equal(UT(tank).galix,true);assert.equal(tank.trophy,GALIX_CHARGES);assert.equal(trophyMax(tank),2);
 const before=g.accuracy(foe,tank);g.hurt(tank,10,foe);
 assert.equal(tank.trophy,1,'gasta uma carga');assert.equal(tank.smokeTime,GALIX_SMOKE);
 assert.ok(Math.abs(g.accuracy(foe,tank)-Math.max(.1,before*.6))<1e-9,'−40% de precisão durante a fumaça');
 g.hurt(tank,10,foe);assert.equal(tank.trophy,1,'sem nova carga enquanto a fumaça dura');
 run(g,GALIX_SMOKE+.2);assert.equal(tank.smokeTime,0);g.hurt(tank,10,foe);assert.equal(tank.trophy,0);
 const tr=g.add('blue','heavyTank',60,40);tr.trophy=2;const at=g.add('red','antitank',60,30);at.atMissiles=4;
 g.shoot(at,tr,'atMissile');assert.equal(tr.trophy,2,'o Trophy do verde não intercepta aqui: GALIX não é Trophy');
 const gv=field({blue:'blue',red:'red'}),vt=gv.add('blue','heavyTank',60,40),vat=gv.add('red','antitank',60,30);gv.shoot(vat,vt,'atMissile');assert.equal(vt.trophy,2,'Trophy do verde gasta uma carga');
});
test('atira e foge do CAESAR: +1 Mov por turnos e +30% de velocidade no RTS',()=>{
 const t=field(FR_SIDE,'turns'),a=t.add('blue','artillery',40,60),foe=t.add('red','infantry',40,50);t.updateVision();
 t.turn='blue';a.moveLeft=0;a.actionLeft=true;t.shoot(a,foe);assert.equal(a.moveLeft,1);
 const v=field({blue:'blue',red:'red'},'turns'),b=v.add('blue','artillery',40,60),f2=v.add('red','infantry',40,50);b.actionLeft=true;v.shoot(b,f2);assert.equal(b.moveLeft,0,'no verde continua sem andar depois de atirar');
 const r=field(FR_SIDE,'rts'),c=r.add('blue','artillery',40,60),f3=r.add('red','infantry',40,50);r.updateVision();r.shoot(c,f3);assert.equal(c.scoot,SCOOT_TIME);
 const x0=c.x,y0=c.y;r.order(c,'move',{x:40,y:66});run(r,2);const fast=Math.hypot(c.x-x0,c.y-y0);
 const d=field(FR_SIDE,'rts'),n=d.add('blue','artillery',40,60);d.order(n,'move',{x:40,y:66});run(d,2);assert.ok(fast>Math.hypot(n.x-40,n.y-60)+.05,'move mais rápido depois de atirar '+fast);
});
test('LRU: salva de 6 foguetes ×14, alcance 24; verde segue com 4 × 20',()=>{
 const g=field(),l=g.add('blue','rocketArtillery',40,60),v=field({blue:'blue',red:'red'}),w=v.add('blue','rocketArtillery',40,60);
 assert.equal(salvoSize(l),6);assert.equal(salvoSize(w),4);assert.equal(UT(l).range,24);assert.equal(g.attackPower(l,'rocket'),14);assert.equal(v.attackPower(w,'rocket'),20);
 assert.equal(g.canBombard(l,{x:40,y:40}),true);assert.equal(g.canBombard(l,{x:40,y:30}),false,'além de 24 casas');assert.equal(v.canBombard(w,{x:40,y:35}),true);
 g.credits.blue=0;const target=g.add('red','infantry',40,40);g.updateVision();g.rng=()=>0;assert.equal(g.order(l,'bombard',{x:40,y:40}),true);
 run(g,4);assert.ok(target.hp<target.maxHp||!g.units.includes(target),'a salva atingiu a casa');
 assert.ok(l.cooldown>8,'recarga 11 s depois da salva: '+l.cooldown);
});
test('Tigre: foguetes 3×3 (2 salvas, alcance 4), míssil alcance 6 e dano 22',()=>{
 const g=field(),h=g.add('blue','helicopterGround',50,60);
 assert.equal(BARRAGE(h),true);assert.equal(h.salvos,2);assert.equal(g.weaponStats(h,'agm').range,6);assert.equal(g.weaponStats(h,'agm').damage,60);assert.equal(g.weaponStats(h,'gun').damage,22);
 const foot=g.add('red','infantry',50,57),car=g.add('red','lightTank',52,57);g.updateVision();
 assert.equal(g.canBombard(h,{x:50,y:57}),true);assert.equal(g.canBombard(h,{x:50,y:50}),false);
 g.rng=()=>0;g.order(h,'bombard',{x:51,y:57});run(g,5);
 const lostFoot=foot.maxHp-foot.hp,lostCar=car.maxHp-car.hp;assert.ok(lostFoot>0&&lostCar>0,'atingiu os dois');assert.ok(lostFoot>lostCar,'×1.5 contra infantaria e ×0.5 contra veículos '+lostFoot+' '+lostCar);
 assert.equal(h.salvos,1);
 const base=field({blue:'blue',red:'red'}),hb=base.add('blue','helicopterGround',50,60);assert.equal(BARRAGE(hb),false);assert.equal(hb.salvos,undefined);
});
test('Panther sem canhão: não ataca alvos no solo; míssil ar-ar 60 e recarga 2,2',()=>{
 const g=field(),h=g.add('blue','helicopterAir',50,60),foot=g.add('red','infantry',50,59),jet=g.add('red','fighterRed',50,58);g.updateVision();
 assert.deepEqual([...UT(h).weapons],['aam']);assert.equal(UT(h).gun,undefined);
 assert.equal(g.weapon(h,foot),null,'sem arma contra o solo');assert.equal(g.canFire(h,foot),false);
 assert.equal(g.weapon(h,jet),'aam','contra aeronaves usa o míssil ar-ar');assert.equal(g.weaponStats(h,'aam').damage,60);assert.equal(g.weaponStats(h,'aam').cooldown,2.2);
 const base=field({blue:'blue',red:'red'}),hb=base.add('blue','helicopterAir',50,60),f=base.add('red','infantry',50,59);base.updateVision();assert.equal(base.canFire(hb,f),true,'o Panther padrão ainda ataca o solo com o canhão');
});
test('Gazelle, nEUROn e Patroller usam as armas e o status da França',()=>{
 const g=field(),h=g.add('blue','helicopter',50,60);const gun=g.weaponStats(h,'gun');
 assert.equal(gun.damage,6);assert.equal(gun.shots,4);assert.equal(gun.cooldown,.25);assert.equal(gun.infantryMultiplier,2.5);assert.equal(gun.vehicleMultiplier,.4);
 assert.equal(h.hp,100);assert.equal(g.sight(h),7);
 const d=g.add('blue','stealthDrone',50,50);assert.equal(g.weaponStats(d,'stealthMissile').damage,50);assert.equal(g.weaponRange(d,'stealthMissile'),5);assert.equal(g.weaponStats(d,'stealthMissile').structureMultiplier,1.5);
 assert.equal(g.sight(g.add('blue','reconDrone',60,50)),14);
 const hit=faction=>{const f=field({blue:faction,red:'red'});f.rng=()=>.99;const dr=f.add('blue','stealthDrone',50,52),post=f.add('red','post',50,48);f.updateVision();f.rng=()=>0;f.shoot(dr,post);settle(f,200);return post.maxHp-post.hp;};
 assert.ok(hit(FRANCE)>hit('blue')*1.5,'bomba guiada: dano maior e ×1.5 contra estruturas');
});
test('NH90: 8 vagas, ou 1 batedor + 3 tropas, sem altitude alta e sem armas',()=>{
 const g=field(),h=g.add('blue','transportHelicopter',50,60);h.altitude='low';h.cargo=[];
 assert.equal(UT(h).capacity,8);assert.equal(h.hp,160);
 const foot=Array.from({length:9},(_,i)=>g.add('blue','infantry',50+(i%3)-1,61+Math.floor(i/3)));
 for(let i=0;i<8;i++)assert.equal(g.fitsCargo(h,foot[i]),true,'tropa '+i),h.cargo.push({...foot[i]});
 assert.equal(h.cargo.length,8);assert.equal(g.fitsCargo(h,foot[8]),false,'cheio com 8');
 h.cargo=[];const recon=g.add('blue','recon',50,61);assert.equal(g.fitsCargo(h,recon),true);h.cargo=[recon];
 assert.equal(seatsUsed(h),5);for(let i=0;i<3;i++){assert.equal(g.fitsCargo(h,foot[i]),true);h.cargo.push(foot[i]);}
 assert.equal(seatsUsed(h),8);assert.equal(g.fitsCargo(h,foot[3]),false);
 h.cargo=[];assert.equal(g.fitsCargo(h,g.add('blue','lightTank',49,61)),false,'sem tanque pendurado');
 assert.equal(g.order(h,'altitude',{altitude:'high'}),false);
 const v=field({blue:'blue',red:'red'}),vh=v.add('blue','transportHelicopter',50,60);vh.altitude='low';assert.equal(UT(vh).capacity,6);assert.equal(v.fitsCargo(vh,v.add('blue','lightTank',49,61)),true);
});
test('caminhão TRM: 5 vagas; A400M: 10 vagas, pista curta',()=>{
 const g=field();assert.equal(UT(g.add('blue','transportTruck',10,80)).capacity,5);
 assert.equal(g.airCap('blue'),10);assert.equal(g.airCap('red'),12);
 const p=g.add('blue','transportPlane',20,80);assert.equal(p.hp,230);assert.equal(UT(p).speed,4.8);
 p.runway={type:'land',phase:'approach',baseId:0,elapsed:0,level:1};g.runwayPhase(p,'landing',{x:1,y:1},1.5,0);
 assert.ok(Math.abs(p.runway.duration-1.5*SHORT_RUNWAY)<1e-9);
 const q=g.add('red','transportPlane',20,20);q.runway={type:'land',phase:'approach',baseId:0,elapsed:0,level:1};g.runwayPhase(q,'landing',{x:1,y:1},1.5,0);assert.equal(q.runway.duration,1.5);
 g.airdropQuote({tank:1},undefined,'blue');assert.equal(g.airdropQuote({tank:1},undefined,'blue').cost,150+155);assert.equal(g.airdropQuote({tank:1},undefined,'red').cost,150+150);
 assert.equal(g.airdropQuote({infantry:11},undefined,'blue'),null,'11 vagas não cabem nas 10 do A400M');assert.notEqual(g.airdropQuote({infantry:11},undefined,'red'),null);
});
test('rede de sensores do FCAS revela furtivos inimigos a 8 casas',()=>{
 const g=field(),fcas=g.add('blue','stealthFighterFr',60,50),drone=g.add('red','stealthDrone',60,44),far=g.add('red','stealthDrone',60,20);
 fcas.flightState='patrol';g.updateVision();g.updateRadarContacts();
 assert.equal(g.radarContact('blue',drone),true,'drone a 6 casas');assert.equal(g.radarContact('blue',far),false,'drone a 30 casas');
 assert.equal(g.isVisible('blue',drone),true);
 const none=field({blue:'blue',red:'red'}),f2=none.add('blue','stealthFighterBlue',60,50),d2=none.add('red','stealthDrone',60,44);none.updateVision();none.updateRadarContacts();assert.equal(none.radarContact('blue',d2),false,'o caça furtivo verde não tem a rede');
});
test('a IA joga com a França: compra aviões Fr e usa fichas francesas',()=>{
 const g=field({blue:'blue',red:FRANCE});g.aiEnabled=true;g.turn='red';g.credits.red=20000;const airport=g.add('red','airportAsphalt',100,60);g.add('red','infantry',100,50);g.add('blue','infantry',90,50);g.updateVision();
 for(let i=0;i<6;i++){g.aiBuy();g.production('red',200);}
 const bought=g.units.filter(u=>u.owner==='red'&&PLANE(u)).map(u=>u.type).concat(airport.queue.map(q=>q.type));
 assert.ok(bought.length>0);for(const t of bought)assert.equal(TYPES[t].team,FRANCE,t);
 for(const u of g.units.filter(u=>u.owner==='red'&&!TYPES[u.type].structure&&!PLANE(u)))assert.equal(u.faction,FRANCE);
 const a=new Game('river','normal',9,'rts',{posts:2},{},{},null,{blue:'blue',red:FRANCE});
 for(const type of Object.keys(a.initialArmies.red))assert.ok(startingCatalog(FRANCE).includes(type),type);
});
test('saves e multiplayer aceitam a facção França',()=>{
 const g=field();g.add('blue','heavyTank',30,60);const copy=Game.fromSnapshot(g.snapshot());
 assert.deepEqual({...copy.factions},FR_SIDE);const t=copy.units.find(u=>u.type==='heavyTank');assert.equal(t.faction,FRANCE);assert.equal(t.maxHp,300);assert.equal(UT(t).galix,true);
 const legacy=g.snapshot();delete legacy.state.factions;for(const u of legacy.state.units)delete u.faction;assert.equal(Game.fromSnapshot(legacy).factionOf('blue'),'blue');
 const g2=new Game('river','normal',1,'rts',{posts:2},{},{},null,{blue:'franca',red:'franca'});assert.deepEqual({...g2.factions},{blue:FRANCE,red:FRANCE});
 assert.deepEqual({...new Game('river','normal',1,'rts',{posts:2},{},{},null,{blue:'x',red:'y'}).factions},STANDARD_FACTIONS);
});
test('Rafale: Automática usa mísseis comuns; cruzeiro só pelo botão. Bombardeiro mantém Auto = cruzeiro',()=>{
const g=field(),r=g.add('blue','multiroleFr',40,40),b=g.add('blue','bomberFr',40,44);
assert.equal(AUTO_CRUISE(r),false);assert.equal(AUTO_CRUISE(b),true);
g.order(r,'strikeCell',{x:50,y:40,weapon:'auto'});assert.notEqual(r.flightJob?.weapon,'cruiseMissile');
assert.equal(g.order(r,'strikeCell',{x:50,y:40,weapon:'cruiseMissile'}),true);assert.equal(r.flightJob.weapon,'cruiseMissile');
});
for(const [name,fn] of cases){fn();console.log('OK '+name);}
console.log(cases.length+' verificações do time azul passaram.');
