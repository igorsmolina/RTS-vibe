'use strict';
/* Motor compartilhado: turnos alternados ou RTS com ordens simultâneas. */
const COLS=128,ROWS=96,SIZE=COLS*ROWS,STEP=1/30;
const KEY=(x,y)=>y*COLS+x,INSIDE=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<COLS&&y<ROWS;
const TILE=u=>({x:Math.round(u.x),y:Math.round(u.y)}),DIST=(a,b)=>Math.max(0,a.x-b.x-(b.width||1)+1,b.x-a.x-(a.width||1)+1)+Math.max(0,a.y-b.y-(b.height||1)+1,b.y-a.y-(a.height||1)+1);
const CENTER=u=>({x:u.x+((u.width||1)-1)/2,y:u.y+((u.height||1)-1)/2});
const NEAREST=(u,p)=>({x:Math.max(u.x,Math.min(u.x+(u.width||1)-1,p.x)),y:Math.max(u.y,Math.min(u.y+(u.height||1)-1,p.y))});
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]],AIR_DIRS=[...DIRS,[1,1],[-1,1],[1,-1],[-1,-1]],SIDE={blue:'Azul',red:'Vermelha',green:'Verde',neutral:'Neutra'};
const NATION_COLORS={blue:'#77c8e2',green:'#8acb91',gold:'#e0c067',violet:'#b79ae8'},NATION_SECONDARY={white:'#ffffff',black:'#182128',cream:'#f3e8c9'};
const NATION_DEFAULTS=Object.freeze({name:'Azul',primary:'blue',secondary:'white',pattern:'plain',emblem:'none'});
const NATION_DOCTRINES={
 balanced:{name:'Equilibrada',text:'Sem modificadores',income:1,damage:1,hp:1},
 economic:{name:'Econômica',text:'Renda +15% · dano −10%',income:1.15,damage:.9,hp:1},
 offensive:{name:'Ofensiva',text:'Dano +10% · vida das tropas −10%',income:1,damage:1.1,hp:.9},
 defensive:{name:'Defensiva',text:'Vida das tropas +15% · renda −10%',income:.9,damage:1,hp:1.15}
};
function cleanDoctrine(id){return typeof id==='string'&&Object.hasOwn(NATION_DOCTRINES,id)?id:'balanced';}
function enemyDoctrine(seed){let n=Math.imul((seed>>>0)^0x9e3779b9,0x85ebca6b);n=Math.imul(n^(n>>>16),0xc2b2ae35);return Object.keys(NATION_DOCTRINES)[(n^(n>>>16))>>>0&3];}
function cleanNation(value){
 const n=value&&typeof value==='object'?value:{},out={...NATION_DEFAULTS};
 if(typeof n.name==='string'&&n.name.trim())out.name=n.name.trim().slice(0,32);
 for(const key of ['primary','secondary','pattern','emblem'])if((key==='primary'?Object.keys(NATION_COLORS):key==='secondary'?Object.keys(NATION_SECONDARY):key==='pattern'?['plain','horizontal','vertical']:['none','star','diamond','circle']).includes(n[key]))out[key]=n[key];
 return out;
}
const TERRAIN={plain:{name:'Planície',cover:0,color:'#77816a'},field:{name:'Campo',cover:0,color:'#9b9a63'},hedge:{name:'Sebe',cover:.25,color:'#4f6a45'},hill:{name:'Colina',cover:.2,color:'#8f9470'},forest:{name:'Floresta',cover:.3,color:'#4b6654'},mountain:{name:'Montanha',cover:.5,color:'#868879'},river:{name:'Rio',cover:0,color:'#477986'},bridge:{name:'Ponte',cover:0,color:'#a69977'},road:{name:'Estrada',cover:0,color:'#b0a487'}};
const PROCEDURAL={water:.35,forest:.35,relief:.35,farmland:.6,posts:24,landscape:'continent'};
// Paisagens do mapa procedural: 'auto' sorteia uma das quatro pela semente; sem a opção vale Continente (o gerador de sempre).
const LANDSCAPE_LIST=['continent','lakes','islands','highlands'],LANDSCAPE_NAMES={auto:'Aleatória',continent:'Continente',lakes:'Lagos',islands:'Ilhas',highlands:'Serras'};
function landscapeOf(seed,landscape){return landscape==='auto'?LANDSCAPE_LIST[(()=>{let n=Math.imul((seed>>>0)^0x2f6b1d37,0x9e3779b1)>>>0;n=Math.imul(n^(n>>>15),0x2c1b3c6d)>>>0;n=Math.imul(n^(n>>>13),0x297a2d39)>>>0;return(n^(n>>>16))>>>0;})()%LANDSCAPE_LIST.length]:LANDSCAPE_LIST.includes(landscape)?landscape:'continent';}
/* Perfis dos campos de batalha: relevo (colinas), serra (montanha intransitável), água, floresta, campos e sebes.
   A Fronteira procedural monta o perfil a partir dos controles da tela de nova operação. */
const MAP_PROFILES={
 river:{relief:.3,ridge:0,water:.45,centralRiver:true,forest:.3,farmland:.85,hedges:.9},
 desert:{relief:.6,ridge:.12,water:.15,forest:.06,farmland:.6,irrigated:true,hedges:0},
 mountain:{relief:.5,ridge:1,pass:true,water:.2,forest:.45,farmland:.45,hedges:.6}
};
// Vegetação que esconde quem está nela além de 2 casas (batedor: 3).
const CONCEAL=new Set(['forest','hedge']);
const MAPS={river:'Vale dos Rios',desert:'Deserto Aberto',mountain:'Passe de Montanha',random:'Fronteira procedural'};
const HELICOPTER_MINIGUN={name:'Minigun',damage:4,range:3,accuracy:.85,cooldown:.2,shots:5,infantryMultiplier:3,vehicleMultiplier:.25,structureMultiplier:.5},HELICOPTER_CANNON={name:'Canhão',damage:20,range:3,accuracy:.85,cooldown:1,shots:1,infantryMultiplier:.6,vehicleMultiplier:1.5,structureMultiplier:.5};
const TYPES={
 transportTruck:{move:7,vehicle:true,unarmed:true,weapons:[],capacity:4,name:'Caminhão de transporte',hp:90,speed:2.4,range:0,min:0,damage:0,accuracy:0,vision:4,cooldown:1,train:2,cost:100,reward:30,role:'Transporte de 4 tropas a pé · sem armas'},
 transportHelicopter:{move:10,air:true,unarmed:true,weapons:[],capacity:6,sling:{blue:'lightTank'},name:'Helicóptero de transporte',hp:150,speed:3.4,range:0,min:0,damage:0,accuracy:0,vision:6,cooldown:1,train:4,cost:220,reward:60,role:'Transporte de 6 tropas a pé · embarque em altitude baixa · aliado: 1 tanque leve pendurado · aliado em altitude alta: 50% mais rápido, enxerga através de floresta e colina, flares mais eficazes · inimigo: rajada de mísseis 3×3 (alcance 10 baixo / 30 alto, 2 salvas, parado ao lançar)'},
 transportPlane:{move:0,plane:true,air:true,vehicle:true,unarmed:true,airdropPlane:true,capacity:12,weapons:[],ammo:{},evasion:0,flares:300,name:'Avião de transporte',hp:240,speed:4.5,range:0,min:0,damage:0,accuracy:0,vision:12,cooldown:1,cost:0,reward:90,role:'Pousa na pista do aeroporto · embarca tropas próximas · lança em linha por paraquedas · até 12 vagas · reconhecimento: visão 12 através do terreno · 300 flares'},
 infantry:{move:3,name:'Infantaria',hp:100,speed:1.35,range:3,min:0,damage:35,accuracy:.9,vision:4,cooldown:.8,train:1,cost:50,reward:20,role:'Captura e construção · fuzil alcance 3'},
 lightTank:{move:6,vehicle:true,tank:true,name:'Tanque leve',hp:110,speed:2.2,range:4,min:0,damage:35,accuracy:.75,vision:6,cooldown:2,train:2,cost:100,reward:35,role:'Mais rápido dos tanques · velocidade 2.2 · visão 6 · alcance 4 · não perfura pesados'},
 tank:{move:5,vehicle:true,tank:true,name:'Tanque médio',hp:170,speed:2,range:5,min:0,damage:60,accuracy:.75,vision:6,cooldown:2.5,train:3,cost:150,reward:50,role:'Alcance 5 · precisão cai após 3 casas · velocidade 2 · visão 6'},
 heavyTank:{move:4,vehicle:true,tank:true,name:'Tanque pesado',hp:280,speed:1.7,range:7,min:0,damage:80,accuracy:.85,vision:6,trophy:6,cooldown:3.5,train:4,cost:240,reward:80,role:'Alcance 7 · maior dano e precisão dos tanques · Trophy: 6 cargas interceptam mísseis antitanque vindos de mais de 3 casas · velocidade 1.7 · visão 6 · requer reconhecimento distante'},
 artillery:{move:3,vehicle:true,name:'Artilharia',hp:100,speed:1.2,range:16,min:2,damage:85,accuracy:.85,vision:3,cooldown:5,train:4,cost:180,reward:40,role:'Cerco de longo alcance · área 3×3 · fogo amigo'},
 recon:{move:5,vehicle:true,name:'Batedor',hp:75,speed:2.25,range:2,min:0,damage:24,accuracy:.9,vision:7,cooldown:1.1,train:1,cost:75,reward:25,role:'Reconhecimento rápido'},
 engineer:{move:3,name:'Engenheiro',repair:24,hp:85,speed:1.25,range:1.15,min:0,damage:20,accuracy:.9,vision:4,cooldown:1.2,train:2,cost:65,reward:25,role:'Reparo +24 HP por ação'},
 antitank:{move:3,name:'Antitanque',atMissiles:4,hp:90,speed:1.05,range:7,min:0,damage:40,accuracy:.85,vision:4,cooldown:3,train:2,cost:110,reward:35,role:'Míssil antitanque alcance 7 contra veículos e estruturas · 4 mísseis · fuzil alcance 3 contra tropas'},
 machinegun:{move:2,name:'Metralhador',hp:110,speed:1.05,range:3,min:0,damage:18,accuracy:.75,vision:4,cooldown:.3,train:2,cost:90,reward:30,role:'Fogo rápido contra tropas a pé · alcance 3 · menos preciso que a infantaria'},
 antiAirVehicle:{move:5,vehicle:true,name:'Veículo antiaéreo',hp:70,speed:2.25,range:30,min:0,damage:80,accuracy:.8,vision:6,cooldown:3.5,train:3,cost:160,reward:45,role:'Mísseis · radar global · alcance 30 contra aeronaves · exige escolta'},
 missileInfantry:{move:3,name:'Soldado lançador',hp:80,speed:1.25,range:10,min:0,damage:55,accuracy:.7,vision:4,cooldown:3,train:2,cost:90,reward:30,role:'Mísseis só contra aeronaves · dano 55 · alcance 10 · fáceis de despistar'},
 helicopter:{...HELICOPTER_MINIGUN,gun:HELICOPTER_MINIGUN,air:true,weapons:['gun'],move:8,name:'Helicóptero',hp:120,speed:3.2,min:0,vision:6,train:3,cost:150,reward:50,role:'Minigun · alta cadência contra infantaria'},
 helicopterGround:{...HELICOPTER_CANNON,gun:HELICOPTER_CANNON,air:true,weapons:['gun','agm'],missiles:8,move:8,name:'Helicóptero ar-terra',hp:120,speed:3.2,min:0,vision:6,train:4,cost:230,reward:50,role:'Canhão perfurante e 8 mísseis ar-terra · dano 60, alcance 7 (20 em altitude alta), recarga 3 s'},
 helicopterAir:{...HELICOPTER_CANNON,gun:{...HELICOPTER_CANNON,vehicleMultiplier:1.25},air:true,weapons:['gun','aam'],move:8,name:'Helicóptero ar-ar',hp:120,speed:3.2,min:0,vision:6,train:4,cost:180,reward:50,role:'Canhão perfurante e mísseis ar-ar · dano 85, alcance 17'},
 // Equilíbrio provisório das duas classes abaixo (ainda não validado em partidas).
 rocketArtillery:{move:2,vehicle:true,name:'Artilharia de mísseis',hp:90,speed:.85,range:30,min:3,damage:20,accuracy:.8,vision:3,cooldown:10,train:4,cost:240,reward:60,role:'Bombardear área 3×3 · 4 mísseis · ×2 contra estruturas'},
 reconDrone:{air:true,drone:true,unarmed:true,weapons:[],move:7,name:'Drone de reconhecimento',hp:60,speed:2.4,range:0,min:0,damage:0,accuracy:0,vision:12,cooldown:1,train:2,cost:90,reward:30,role:'Reconhecimento · visão 12 através do terreno · sempre em altitude alta · sem armas'},
 // Drone furtivo: invisível ao radar; exige reconhecimento atual.
 stealthDrone:{air:true,drone:true,stealth:true,weapons:['stealthMissile'],missiles:2,move:6,name:'Drone furtivo',hp:50,speed:2.2,range:15,min:0,damage:80,accuracy:.85,vision:12,cooldown:3,train:3,cost:160,reward:45,role:'Furtivo ao radar · visão 12 através do terreno · 2 mísseis, dano 80, alcance 15, só por ordem · sempre em altitude alta'},
 commander:{move:3,aura:6,name:'Comandante',hp:140,speed:1.35,range:2,min:0,damage:40,accuracy:.9,vision:5,cooldown:1.5,reward:70,role:'Aura de comando · raio 6'},
 hq:{name:'Quartel-general',hp:300,speed:0,range:0,damage:0,vision:5,structure:true,width:3,height:3,reward:100},
 post:{name:'Posto avançado',hp:90,speed:0,range:0,damage:0,vision:8,structure:true,width:2,height:2,reward:30,role:'Reconhecimento · visão base 8 · recrutamento'}
};
// Armas dos helicópteros. Recarga em segundos (RTS); por turnos cada disparo gasta a ação.
const ARMORED=new Set(['tank','heavyTank']),BREAKERS=new Set(['antitank','lightTank','tank','heavyTank','artillery']);
const WEAPONS={gun:HELICOPTER_CANNON,agm:{name:'Míssil ar-terra',damage:65,range:5,accuracy:.85,cooldown:3},aam:{name:'Míssil ar-ar',damage:70,range:6,accuracy:.9,cooldown:3,speed:4,evasionBonus:.2},stealthMissile:{name:'Míssil furtivo',damage:35,range:8,accuracy:.85,cooldown:3},
 atMissile:{name:'Míssil antitanque',damage:40,range:7,accuracy:.85,cooldown:3},rifle:{name:'Fuzil',damage:35,range:3,accuracy:.9,cooldown:.8},missileInfantry:{name:'Míssil portátil',evasionBonus:.25},rocket:{name:'Salva de mísseis',damage:20,range:30,accuracy:.8,cooldown:10}};
const GROUND_WEAPONS=new Set(['atMissile','rifle']),HELI_SALVOS=2,HELI_REPAIR=8,HELI_REPAIR_COST=1,TROPHY_CHARGES=3,TROPHY_RANGE=3;
// Exército (facção) é separado do lado: u.faction diz qual arte e qual kit a unidade usa; sem o campo vale o dono.
const KIT=u=>u?.faction||u?.owner;
const BARRAGE=u=>u?.type==='rocketArtillery'||u?.type==='transportHelicopter'&&KIT(u)==='red'||!!UT(u)?.barrage;
const barrageRange=u=>u.type==='rocketArtillery'?UT(u).range:UT(u).barrage?UT(u).barrage.range:u.altitude==='high'?30:10;

const PLANE=u=>!!TYPES[u?.type]?.plane;
const DRONE=u=>!!TYPES[u?.type]?.drone,FLYER=u=>PLANE(u)||DRONE(u); // drones voam e orbitam como aviões, sem pista nem munição

const AIRPORT=u=>!!TYPES[u?.type]?.airport;
const POST_CAPTURERS=new Set(['infantry','missileInfantry','machinegun','antitank','commander']);
const BOMB_TYPES=['bombCommon','bombFragment','bombIncendiary'];
const AUTO_CRUISE=u=>UT(u).weapons.includes('cruiseMissile')&&'bombCommon' in UT(u).ammo; // só bombardeiro: Auto = cruzeiro; o Rafale usa os mísseis
const AMMO_PRICE={jetGun:1,jetAam:20,antiRadiation:25,jetAgm:25,cruiseMissile:60,bombCommon:12,bombFragment:14,bombIncendiary:18};
const PLANE_MODELS={
 fighterBlue:{name:'Caça aliado',team:'blue',hp:150,speed:6,evasion:.2,flares:60,hull:400,train:3,ammo:{jetAam:4,antiRadiation:4},arms:{jetAam:{damage:90}},radar:true,role:'Interceptação · radar 18 · investidas'},
 fighterRed:{name:'Caça inimigo',team:'red',hp:160,speed:5.4,evasion:.3,flares:60,hull:400,train:3,ammo:{jetAam:4,antiRadiation:2},radar:true,role:'Interceptação · manobrabilidade'},
 multiroleBlue:{name:'Multifunção aliado',team:'blue',hp:180,speed:5.6,evasion:.3,flares:60,hull:480,train:4,ammo:{jetAam:2,jetAgm:6,antiRadiation:4},arms:{jetAam:{damage:90},jetAgm:{damage:80}},role:'Ar/solo · rápido e manobrável'},
 multiroleRed:{name:'Multifunção inimigo',team:'red',hp:200,speed:4.8,evasion:.2,flares:80,hull:600,train:4,ammo:{jetAam:2,jetAgm:4,antiRadiation:3},role:'Ar/solo · mísseis superiores'},
 stealthFighterBlue:{name:'Caça furtivo aliado',team:'blue',hp:180,speed:6.2,evasion:.3,flares:60,hull:750,train:5,ammo:{jetAam:6,antiRadiation:2},arms:{jetAam:{damage:90}},radar:true,radarStealth:true,weaponModel:'fighterBlue',reward:140,role:'Furtivo ao radar · interceptação · radar 18'},
 stealthFighterRed:{name:'Caça furtivo inimigo',team:'red',hp:190,speed:5.8,evasion:.35,flares:60,hull:780,train:5,ammo:{jetAam:6,antiRadiation:2},radar:true,radarStealth:true,weaponModel:'fighterRed',reward:140,role:'Furtivo ao radar · interceptação · radar 18'},
 bomberBlue:{name:'Bombardeiro furtivo aliado',team:'blue',hp:240,speed:3.5,evasion:.1,flares:100,hull:1000,train:6,ammo:{bombCommon:4,bombFragment:4,bombIncendiary:4,cruiseMissile:2},radarStealth:true,role:'Furtivo ao radar · 12 bombas · 2 cruzeiros, alcance 67 · sem metralhadora'},
 bomberRed:{name:'Bombardeiro pesado inimigo',team:'red',hp:340,speed:3,evasion:.1,flares:120,hull:100,train:8,ammo:{bombCommon:16,bombFragment:16,bombIncendiary:16,cruiseMissile:6},arms:{cruiseMissile:{range:70}},reward:180,role:'48 bombas · 6 cruzeiros, alcance 70 · sem metralhadora · detectável por radar'},
 // Time azul (França): custo final dentro de ±10% do aliado; veja unidades.md.
 fighterFr:{name:'Caça azul',team:'franca',hp:140,speed:6.5,evasion:.25,flares:60,hull:400,train:3,ammo:{jetAam:4,antiRadiation:2,jetGun:100},radar:true,role:'Mirage 2000 · interceptador mais rápido, velocidade 6.5 · radar 18 · 2 antirradiação'},
 multiroleFr:{name:'Multifunção azul',team:'franca',hp:185,speed:6,evasion:.25,flares:70,hull:480,train:4,ammo:{jetAam:2,jetAgm:3,antiRadiation:2,cruiseMissile:1},role:'Rafale · velocidade 6 · 1 míssil de cruzeiro SCALP, alcance 67 · 2 antirradiação · menos antiblindado'},
 stealthFighterFr:{name:'Caça furtivo azul',team:'franca',hp:175,speed:5.7,evasion:.35,flares:60,hull:780,train:5,ammo:{jetAam:4,antiRadiation:2},radar:true,radarStealth:true,sensorNet:true,weaponModel:'fighterFr',reward:140,role:'FCAS · furtivo ao radar · rede de sensores: revela furtivos inimigos a 8 casas · radar 18'},
 bomberFr:{name:'Bombardeiro azul',team:'franca',hp:200,speed:5,evasion:.2,flares:80,hull:960,train:6,ammo:{bombCommon:6,bombFragment:6,bombIncendiary:0,cruiseMissile:4},arms:{cruiseMissile:{range:75}},reward:150,role:'Mirage IV · supersônico, detectável por radar · 12 bombas · 4 cruzeiros, alcance 75 · sem metralhadora'}
};
for(const [type,m]of Object.entries(PLANE_MODELS)){if(!m.ammo.bombCommon)m.ammo={...m.ammo,jetGun:m.ammo.jetGun??80};TYPES[type]={...m,plane:true,air:true,vehicle:true,vision:12,move:0,min:0,range:m.ammo.cruiseMissile?m.arms?.cruiseMissile?.range??67:m.ammo.jetAam?30:4,damage:80,accuracy:.8,cooldown:.6,reward:m.reward??120,weapons:Object.keys(m.ammo),cost:m.hull+Object.entries(m.ammo).reduce((n,[w,q])=>n+AMMO_PRICE[w]*q,0)};}
Object.assign(TYPES,{
 airportDirt:{name:'Aeroporto de terra',hp:350,structure:true,airport:true,width:6,height:2,vision:5,damage:0,range:0,reward:70},
 airportAsphalt:{name:'Aeroporto de concreto',hp:500,structure:true,airport:true,width:8,height:3,vision:5,damage:0,range:0,reward:90},
 airportSite:{name:'Canteiro de aeroporto',hp:150,structure:true,width:6,height:2,vision:2,damage:0,range:0,reward:25}
});
Object.assign(WEAPONS,{
 jetGun:{name:'Metralhadora do avi\u00e3o',damage:6,range:4,accuracy:.85,cooldown:.06,speed:40},
 jetAam:{name:'Míssil ar-ar',damage:70,range:30,accuracy:.9,cooldown:.6,speed:10},
 antiRadiation:{name:'Míssil antirradiação',damage:80,range:40,accuracy:.8,cooldown:.6,speed:14},
 jetAgm:{name:'Míssil antiblindados',damage:75,range:15,accuracy:.85,cooldown:.6,speed:10},
 cruiseMissile:{name:'Míssil de cruzeiro',damage:160,range:67,accuracy:1,cooldown:6,speed:8},
 bombCommon:{name:'Bomba comum',damage:120,range:0,accuracy:.8,cooldown:.1},
 bombFragment:{name:'Fragmentação',damage:70,range:0,accuracy:.8,cooldown:.1},
 bombIncendiary:{name:'Incendiária',damage:40,range:0,accuracy:.8,cooldown:.1}
});
// Armas por kit da ficha verde (precisam de WEAPONS, declarado acima).
Object.assign(TYPES.antitank,{arms:{atMissile:{...WEAPONS.atMissile,damage:50}}});
Object.assign(TYPES.helicopterGround,{arms:{agm:{...WEAPONS.agm,damage:60,range:7,highRange:20,cooldown:3}}});
Object.assign(TYPES.helicopterAir,{arms:{aam:{...WEAPONS.aam,damage:85,range:17}}});
Object.assign(TYPES.stealthDrone,{arms:{stealthMissile:{...WEAPONS.stealthMissile,damage:80,range:15}}});

/* Kit vermelho: RED guarda só o que difere da ficha verde (TYPES), no mesmo formato de FR. */
const RED={
 lightTank:{speed:1.9,vision:5,atMissiles:4,role:'Tanque leve vermelho · velocidade 1.9 · visão 5 · alcance 4 · 4 mísseis antitanque (dano 40, alcance 7) que perfuram pesados'},
 tank:{speed:1.8,vision:5,falloff:4,role:'Alcance 5 · precisão cai só após 4 casas · velocidade 1.8 · visão 5'},
 heavyTank:{speed:1.5,vision:5,trophy:3,atMissiles:4,arms:{atMissile:{...WEAPONS.atMissile,damage:50,range:12}},role:'Alcance 7 · maior dano e precisão dos tanques · 4 mísseis antitanque (dano 50, alcance 12) · Trophy: 3 cargas interceptam mísseis antitanque vindos de mais de 3 casas · velocidade 1.5 · visão 5'},
 engineer:{repair:30,role:'Reparo +30 HP por ação'},
 antitank:{atMissiles:6,arms:{atMissile:{...WEAPONS.atMissile,damage:40}},role:'Míssil antitanque alcance 7 contra veículos e estruturas · 6 mísseis · fuzil alcance 3 contra tropas'},
 missileInfantry:{damage:45,range:15,role:'Mísseis só contra aeronaves · dano 45 · alcance 15 · fáceis de despistar'},
 recon:{speed:2.5,role:'Reconhecimento rápido · velocidade 2.5'},
 transportTruck:{unarmed:false,damage:20,range:3,accuracy:.75,cooldown:1,role:'Transporte de 4 tropas a pé · metralhadora leve (dano 20, alcance 3), não fere tanques médios/pesados'},
 helicopter:{damage:7,gun:{...HELICOPTER_MINIGUN,damage:7},role:'Minigun dano 7 · alta cadência contra infantaria'},
 helicopterGround:{missiles:12,arms:{agm:{...WEAPONS.agm,damage:80,range:7,highRange:23,cooldown:2.5}},role:'Canhão perfurante e 12 mísseis ar-terra · dano 80, alcance 7 (23 em altitude alta), recarga 2.5 s'},
 helicopterAir:{arms:{aam:{...WEAPONS.aam,damage:70,range:15}},role:'Canhão perfurante e mísseis ar-ar · dano 70, alcance 15'},
 stealthDrone:{damage:50,range:10,missiles:4,arms:{stealthMissile:{...WEAPONS.stealthMissile,damage:50,range:10}},role:'Furtivo ao radar · visão 12 através do terreno · 4 mísseis, dano 50, alcance 10, só por ordem · sempre em altitude alta'}
};
/* Facção França (id 'franca', "Azul" na interface): FR guarda só o que difere da ficha base; UT(u) devolve a ficha pela facção da unidade.
   Campos próprios: evade (−fração de precisão contra ela), falloff (casas até a precisão cair), galix (fumaça ao ser atingido),
   arms (armas trocadas), barrage (salva de foguetes), salvo (mísseis por salva), seats (vagas por tipo), scoot (atira e foge), noHigh. */
const LANDING_SPEED=.6,TURN_RATE=3,FRANCE='franca',GALIX_CHARGES=2,GALIX_SMOKE=3,GALIX_PENALTY=.6,SCOOT_TIME=3,SCOOT_SPEED=1.3,SENSOR_NET=8,SHORT_RUNWAY=.7;
const FR_GUN={...HELICOPTER_MINIGUN,name:'Metralhadora',damage:6,shots:4,cooldown:.25,infantryMultiplier:2.5,vehicleMultiplier:.4},FR_CANNON={...HELICOPTER_CANNON,damage:22,cooldown:1.2};
const FR={
 infantry:{damage:55,role:'Captura e construção · fuzil alcance 3, dano 55'},
 engineer:{cost:50},
 machinegun:{cost:60,damage:20},
 antitank:{cost:60},
 missileInfantry:{cost:55,damage:40,range:12,rifle:true,role:'Mísseis contra aeronaves, dano 40 · alcance 12 · fuzil alcance 3 contra tropas a pé · fáceis de despistar'},
 commander:{aura:8,role:'Aura de comando · raio 8'},
 lightTank:{hp:95,speed:2.5,move:7,damage:40,cooldown:2.2,vision:6,role:'AMX-10 RC · sobre rodas, o mais rápido do jogo · canhão de 105 mm · alcance 4 · não perfura pesados'},
 tank:{cost:155,hp:155,speed:2,vision:5,damage:55,cooldown:2.1,falloff:4,role:'Leclerc · carregador automático · velocidade 2 · alcance 5 · precisão cai só após 4 casas'},
 heavyTank:{hp:300,damage:75,range:6,speed:1.7,vision:5,galix:true,role:'Leclerc blindado · alcance 6 · GALIX: 2 cargas de fumaça ao ser atingido, −40% de precisão contra ele por 3 s · sem Trophy'},
 artillery:{hp:80,speed:1.8,move:4,range:14,damage:80,cooldown:4,scoot:true,role:'CAESAR · sobre caminhão 6×6 · alcance 14 · atira e foge: +1 Mov (RTS: +30% de velocidade por 3 s) depois de disparar'},
 recon:{hp:65,speed:3,move:6,damage:20,cooldown:1,evade:.1,role:'VBL · silhueta pequena: −10% de precisão contra ele · reconhecimento rápido'},
 antiAirVehicle:{cost:145,hp:85,range:25,damage:90,cooldown:2.5,role:'Mistral · mísseis dano 90, alcance 25 contra aeronaves · radar global · recarga curta · exige escolta'},
 rocketArtillery:{cost:250,hp:115,speed:1,range:25,damage:20,cooldown:11,salvo:6,role:'LRU · lagartas · salva de 6 foguetes ×20, alcance 25 · ×2 contra estruturas'},
 transportTruck:{cost:115,hp:100,speed:2.2,move:6,capacity:5,role:'TRM 10000 · transporte de 5 tropas a pé · cabine blindada · sem armas'},
 helicopter:{cost:140,hp:100,speed:3.6,move:9,vision:7,damage:6,cooldown:.25,shots:4,infantryMultiplier:2.5,vehicleMultiplier:.4,gun:FR_GUN,role:'Gazelle · metralhadora 6×4 tiros · o mais rápido, visão 7 · frágil'},
 helicopterGround:{cost:245,hp:110,speed:3.5,missiles:undefined,damage:22,cooldown:1.2,gun:FR_CANNON,arms:{agm:{...WEAPONS.agm,damage:60,range:6,cooldown:3.5}},barrage:{range:4,min:1,missiles:4,damage:12,cooldown:8,infantry:1.5,vehicle:.5},role:'Tigre · canhão 30 mm, míssil alcance 6 e foguetes em área 3×3 (2 salvas, alcance 4, ×1.5 contra infantaria)'},
 helicopterAir:{cost:175,hp:140,speed:3.8,gun:undefined,weapons:['aam'],arms:{aam:{...WEAPONS.aam,damage:60,cooldown:2.2}},role:'Panther · 4 Mistral, sem canhão: não ataca alvos no solo · recarga curta'},
 transportHelicopter:{cost:230,hp:160,speed:3.2,move:9,capacity:8,seats:{recon:5},noHigh:true,role:'NH90 · rampa traseira: 8 tropas a pé ou 1 batedor + 3 tropas · sem altitude alta · sem armas'},
 reconDrone:{cost:95,hp:70,speed:2,move:6,vision:15,role:'Patroller · reconhecimento · visão 15 através do terreno · sempre em altitude alta · sem armas'},
 stealthDrone:{cost:170,hp:55,missiles:6,range:5,damage:50,accuracy:.9,arms:{stealthMissile:{name:'Bomba guiada',damage:50,range:5,accuracy:.9,cooldown:3,structureMultiplier:1.5}},role:'nEUROn · furtivo ao radar · 6 bombas guiadas alcance 5, ×1.5 contra estruturas, só por ordem · sempre em altitude alta'},
 transportPlane:{hp:230,speed:5,capacity:10,shortRunway:true,role:'A400M · pista curta: pouso e embarque 30% mais rápidos · até 10 vagas · 300 flares'}
};
const withOverrides=table=>Object.fromEntries(Object.entries(table).map(([type,o])=>[type,{...TYPES[type],...o}]));
const FR_TYPES=withOverrides(FR),RED_TYPES=withOverrides(RED),KIT_TYPES={red:RED_TYPES,[FRANCE]:FR_TYPES};
const SPEC=(type,faction)=>KIT_TYPES[faction]?.[type]||TYPES[type];
const UT=u=>u&&SPEC(u.type,KIT(u));
const salvoSize=u=>UT(u).barrage?.missiles||UT(u).salvo||SALVO.missiles;
const atMax=u=>UT(u)?.atMissiles||0;
const trophyMax=u=>UT(u)?.galix?GALIX_CHARGES:(UT(u)?.trophy??TROPHY_CHARGES);
// Vagas ocupadas num transportador: a pé 1 cada; tipos de seats (batedor no NH90) ocupam as suas.
const seatsUsed=u=>{const s=UT(u).seats;return (u.cargo||[]).reduce((n,p)=>n+(FOOT(p)?1:s?.[p.type]||0),0);};
const AIR=u=>!!TYPES[u?.type]?.air&&(!PLANE(u)||!['grounded','service','offmap','waitRunway','taxiOut','takeoffRoll','landingRoll','taxiIn'].includes(u.flightState));
const HELI=u=>!!TYPES[u?.type]?.air&&!PLANE(u)&&!TYPES[u.type].drone;
const ALTITUDE_TIME=1;
const AIRDROP_TYPES=['infantry','engineer','antitank','machinegun','missileInfantry','recon','lightTank','tank'];
const AIRDROP_FEE=150,AIRDROP_CAPACITY=12,AIRPORT_SURCHARGE=1.2;
const AIRDROP_SLOTS=type=>type==='tank'?6:TYPES[type].vehicle?4:1;
const AIRDROP_REACH=2;
const FOOT=u=>!!TYPES[u?.type]&&!TYPES[u.type].structure&&!TYPES[u.type].vehicle&&!TYPES[u.type].air;
const HELI_HIGH=1.5,heliHigh=u=>u?.type==='transportHelicopter'&&KIT(u)==='blue'&&u.altitude==='high';
function flightLevel(u){if(u.runway)return u.runway.level;const t=u.altitudeTransition;if(!t)return u.altitude==='high'?1:0;const p=Math.min(1,t.elapsed/(t.returning?.2:ALTITUDE_TIME));return t.from+(t.to-t.from)*p*p*(3-2*p);}
const MISSILE=w=>['agm','aam','atMissile','antiAirVehicle','missileInfantry','rocket','stealthMissile','jetAam','antiRadiation','jetAgm','cruiseMissile'].includes(w);
// Salva da artilharia de mísseis: quatro mísseis contra a casa central, 0,25 s entre lançamentos.
const SALVO={missiles:4,interval:.25};
const LAUNCHER_TIME=.35;
// IA planejada: prazo mínimo de preparo (turnos; RTS ×30 s) e margem sobre a força azul já vista para lançar a onda.
/* Níveis da IA: preparo (turnos; RTS ×30 s), margem sobre a força azul vista, onda mínima, fila e exército máximos,
   renda e recursos de combate (reforço de onda e recuo mais cedo na Veterana). */
const PLAN={
 easy:{prep:5,margin:1.6,wave:6,queue:4,army:40,planes:2,income:.8,posts:6,reinforce:false,followUp:1},
 normal:{prep:3,margin:1.15,wave:6,queue:4,army:48,planes:4,income:1,posts:9,reinforce:true,followUp:1},
 hard:{prep:2,margin:1.05,wave:6,queue:6,army:56,planes:4,income:1.2,posts:12,reinforce:true,followUp:1},
 veteran:{prep:2,margin:1,wave:5,queue:6,army:64,planes:5,income:1.35,posts:12,reinforce:true,followUp:.5}
};
/* Doutrina de compra: parcela do exército por tipo e mínimo fixo. A IA compra o tipo com maior déficit
   (alvo − existentes − na fila), ajustado pelo que vê; sem crédito para ele, poupa (salvo base ameaçada). */
const DOCTRINE=[
 {type:'antiAirVehicle',share:.09},{type:'helicopter',share:.09,min:1},{type:'heavyTank',share:.14,min:1},
 {type:'helicopterGround',share:.08},{type:'helicopterAir',share:.07},{type:'antitank',share:.08,min:1},
 {type:'tank',share:.08,min:1},{type:'lightTank',share:.07},{type:'machinegun',share:.07,min:1},
 {type:'artillery',share:.06,min:1},{type:'infantry',share:.14,min:2},{type:'engineer',share:.04,min:1},
 {type:'recon',share:.04,min:1},{type:'missileInfantry',share:.02},
 {type:'rocketArtillery',share:.04,min:1},{type:'reconDrone',share:.03,min:1},{type:'stealthDrone',share:.03,min:1}
];
// Cronograma: a partir de certa rodada (RTS: ×30 s) a IA mantém pelo menos uma unidade destas classes.
const SCHEDULE={antiAirVehicle:4,helicopter:1,heavyTank:6,helicopterGround:10,helicopterAir:14};
const DEFENSE=['infantry','machinegun','antitank','missileInfantry','antiAirVehicle','lightTank'];
function seeded(seed){let n=seed>>>0;const rng=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};rng.state=()=>n;rng.restore=value=>{n=value>>>0;};return rng;}
// Limite de tropas por jogador no multiplayer: em campo, embarcadas, em queda de paraquedas e na fila de produção.
const UNIT_CAP=50;
const STANDARD_FACTIONS=Object.freeze({blue:'blue',red:'red'});
// O terceiro lado (verde) só existe se vier no objeto: partidas de dois lados não mudam.
function cleanFactions(value){const ok=v=>v==='blue'||v==='red'||v===FRANCE;const sides={blue:ok(value?.blue)?value.blue:'blue',red:ok(value?.red)?value.red:'red'};if(value&&Object.hasOwn(value,'green'))sides.green=ok(value.green)?value.green:FRANCE;return Object.freeze(sides);}
const STARTING_BUDGET=600,STARTING_DEFAULT=Object.freeze({infantry:2,engineer:2,recon:1,tank:1,antitank:1});
function startingCatalog(owner='blue'){return Object.keys(TYPES).filter(type=>SPEC(type,owner).cost>0&&!TYPES[type].structure&&(!TYPES[type].plane||TYPES[type].team===owner));}
function armyOverBudget(army,faction){return !!army&&typeof army==='object'&&!Array.isArray(army)&&armyCost(army,faction)>STARTING_BUDGET;}
function armyCost(army,faction='blue'){return Object.entries(army).reduce((n,[type,count])=>n+(SPEC(type,faction)?.cost||0)*count,0);}
function cleanStartingArmy(value,owner='blue',fallback=STARTING_DEFAULT){const catalog=startingCatalog(owner);if(!value||typeof value!=='object'||Array.isArray(value)||Object.entries(value).some(([type,n])=>!catalog.includes(type)||!Number.isInteger(n)||n<0)||armyCost(value,owner)>STARTING_BUDGET)return {...fallback};return Object.fromEntries(Object.entries(value).filter(([,n])=>n>0));}
function enemyStartingArmy(seed,faction='red'){const rng=seeded((seed>>>0)^0x6a09e667),army={infantry:2,engineer:2,recon:1},types=startingCatalog(faction).filter(t=>!Object.hasOwn(army,t));for(let i=types.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[types[i],types[j]]=[types[j],types[i]];}let remaining=STARTING_BUDGET-armyCost(army,faction);for(const t of types){const cost=SPEC(t,faction).cost;if(cost<=remaining){army[t]=1;remaining-=cost;}}army.infantry+=Math.floor(remaining/TYPES.infantry.cost);return army;}
﻿class Game{
 constructor(map='river',difficulty='normal',seed=1,mode='turns',options={},doctrines={},initialArmies={},privateRandom=null,factions=STANDARD_FACTIONS){
  this.factions=cleanFactions(factions);
  const per=f=>Object.fromEntries(this.sides.map(s=>[s,f(s)]));this.out=[];this.doctrines=Object.freeze(per(s=>cleanDoctrine(doctrines?.[s])));this.nationName=NATION_DEFAULTS.name;
  this.mode=mode==='rts'?'rts':'turns';this.economyClock=0;this.aiClock=0;this.visionClock=0;this.claims=new Set();
  this.map=MAPS[map]?map:'river';this.difficulty=Object.hasOwn(PLAN,difficulty)?difficulty:'normal';this.seed=seed>>>0;this.rng=seeded(seed);this.mineRng=typeof privateRandom==='function'?privateRandom:null;this.initialArmies={blue:cleanStartingArmy(initialArmies?.blue,this.factions.blue),red:cleanStartingArmy(initialArmies?.red,this.factions.red,enemyStartingArmy(this.seed,this.factions.red)),...(this.factions.green?{green:cleanStartingArmy(initialArmies?.green,this.factions.green)}:{})};
  const o={...PROCEDURAL,...options},unit=v=>Math.max(0,Math.min(1,Number(v)||0));this.options={water:unit(o.water),forest:unit(o.forest),relief:unit(options.relief??options.mountain??PROCEDURAL.relief),farmland:unit(o.farmland),posts:Math.max(2,Math.min(32,Math.round(Number(o.posts)/2)*2||24)),landscape:o.landscape==='auto'||LANDSCAPE_LIST.includes(o.landscape)?o.landscape:'continent'};this.landscape=this.map==='random'?landscapeOf(this.seed,this.options.landscape):'continent';
  this.terrain=Array(SIZE).fill('plain');this.units=[];this.structures=[];this.mines=[];this.projectiles=[];this.events=[];this.logs=[];this.nextId=1;this.nextBatchId=1;this.nextProjectileId=1;
  this.time=0;this.round=1;this.turn='blue';this.actions=[];this.animation=null;this.aiQueue=[];this.aiWait=0;this.aiEnabled=true;this.aiDecisions=0;this.aiState='prepare';this.plan={phase:'prepare',since:this.mode==='rts'?0:1,rally:null,objective:null,wave:[],waveStart:0};this.intel=new Map();this.shotsFired=0;
  this.credits=per(()=>150);this.fires=[];this.winner=null;this.stats=per(()=>({kills:{},losses:{}}));this.visible=per(()=>Array(SIZE).fill(false));this.sky=per(()=>Array(SIZE).fill(false));this.explored=per(()=>Array(SIZE).fill(true));this.memory=per(()=>new Map());
  this.radarContacts=per(()=>new Set());this.generate();for(const owner of this.sides)for(const s of this.structures)if(s.owner==='neutral')this.memory[owner].set(KEY(s.x,s.y),{id:s.id,x:s.x,y:s.y,type:s.type,owner:s.owner,width:s.width,height:s.height});this.updateVision();this.log(this.mode==='rts'?'Operação RTS. P pausa o combate para dar ordens; P novamente retoma.':'Seu turno. Mova as tropas, execute ações e encerre quando estiver pronto.');
 }
 // Lados da partida, na ordem dos turnos; derivados de `factions` (que vai no estado do multiplayer). Dois lados = blue e red.
 get sides(){if(this._sidesOf!==this.factions||!this._sides){this._sidesOf=this.factions;this._sides=this.factions?Object.keys(this.factions):['blue','red'];}return this._sides;}
 isOut(side){return !!this.out?.includes(side);}
 nextSide(owner){const live=this.sides.filter(s=>!this.isOut(s)),i=live.indexOf(owner);return live[(i+1)%live.length]||live[0];}
 // Com três lados: sai da partida por derrota ou desistência. Tropas e QG caem; postos e aeroportos viram neutros.
 eliminate(side){
  if(!this.sides.includes(side)||this.isOut(side)||this.winner)return;
  const next=this.turn===side?this.nextSide(side):null;(this.out||=[]).push(side);
  for(const u of [...this.units])if(u.owner===side&&u.hp>0)this.hurt(u,u.hp);
  for(const s of [...this.structures])if(s.owner===side){if(s.type==='hq'||s.type==='airportSite')this.hurt(s,s.hp);else{s.owner='neutral';s.queue=[];}}
  this.drops=(this.drops||[]).filter(d=>d.owner!==side);this.log(`Equipe ${SIDE[side]} eliminada.`,this.sides);
  if(next&&this.mode==='turns'){this.actions=[];this.animation=null;this.turnEnding=next;}
  this.updateVision();
 }
 get busy(){return (this.drops||[]).length>0||(this.mode==='rts'?this.units.some(u=>u.pending||u.segment)||this.projectiles.length>0:!!this.animation||this.actions.length>0||this.projectiles.length>0);}
 all(){return [...this.units,...this.structures];}
 get(id){if(id==null)return undefined;return this.units.find(u=>u.id===id)||this.structures.find(u=>u.id===id);}
 hq(owner){return this.structures.find(u=>u.owner===owner&&u.type==='hq');}
 commandBase(owner){return this.hq(owner)||this.structures.find(s=>s.owner===owner&&s.type==='post'&&s.hp>0);}
 baseHp(owner,type){const spec=SPEC(type,this.factionOf(owner));return Math.round(spec.hp*(spec.structure?1:NATION_DOCTRINES[this.doctrines[owner]||'balanced'].hp));}
 nationLabel(owner){return owner==='blue'?this.nationName:SIDE[owner];}
 producer(owner,base){return this.sides.includes(owner)&&!!base&&base.hp>0&&base.owner===owner&&['hq','post','airportDirt','airportAsphalt'].includes(base.type)&&this.structures.includes(base);}
 producers(owner){return this.structures.filter(s=>this.producer(owner,s));}
 queueLimit(){return 5;}
 // Comandante e avião de transporte (serviço) não contam; passageiros, paraquedistas em queda e a fila de produção contam.
 armySize(owner){
  let n=0;for(const u of this.units)if(u.owner===owner&&u.hp>0){if(u.type!=='commander'&&!UT(u).airdropPlane)n++;n+=u.cargo?.length||0;}
  for(const d of this.drops||[])if(d.owner===owner)n++;
  for(const s of this.structures)if(s.owner===owner&&s.hp>0)n+=s.queue?.length||0;
  return n;
 }
 atUnitCap(owner,extra=1){return !!this.multiplayer&&this.armySize(owner)+extra>UNIT_CAP;}



 setPatrol(u,center){if(u.aiAirMission){u.aiLastAirMission={...u.aiAirMission,ended:this.aiNow(),endX:u.x,endY:u.y};u.aiAirMission=null;}const c=center||{x:u.x-4,y:u.y};u.patrol={x:Math.max(4,Math.min(COLS-5,c.x)),y:Math.max(4,Math.min(ROWS-5,c.y)),angle:Math.atan2(u.y-c.y,u.x-c.x)};u.flightState='patrol';u.flightJob=null;u.pending=false;u.order={type:'patrol'};}
 flyToward(u,p,dt,speed=UT(u).speed){const dx=p.x-u.x,dy=p.y-u.y,d=Math.hypot(dx,dy),step=speed*dt;if(d<=step){if(d>1e-8){u.facing=Math.atan2(dx,-dy);u.x=p.x;u.y=p.y;}return true;}const desired=Math.atan2(dx,-dy),diff=Math.atan2(Math.sin(desired-u.facing),Math.cos(desired-u.facing));const turn=Math.max(Math.PI*2/3,2*speed/Math.max(.5,d))*dt;u.facing+=Math.max(-turn,Math.min(turn,diff));u.x+=Math.sin(u.facing)*step;u.y-=Math.cos(u.facing)*step;if(u.x<0||u.x>COLS-1||u.y<0||u.y>ROWS-1){u.x=Math.max(0,Math.min(COLS-1,u.x));u.y=Math.max(0,Math.min(ROWS-1,u.y));u.facing=Math.atan2(COLS/2-u.x,u.y-ROWS/2);}return false;}
 orbitPlane(u,dt){const p=u.patrol||{x:Math.max(4,Math.min(COLS-5,u.x-4)),y:Math.max(4,Math.min(ROWS-5,u.y)),angle:0},goal={x:p.x+4*Math.cos(p.angle),y:p.y+4*Math.sin(p.angle)};u.patrol=p;if(Math.hypot(u.x-goal.x,u.y-goal.y)>.3){this.flyToward(u,goal,dt);return 0;}const angle=UT(u).speed*dt/4;p.angle+=angle;u.x=p.x+4*Math.cos(p.angle);u.y=p.y+4*Math.sin(p.angle);u.facing=p.angle+Math.PI;return angle;}
 planeTurnRate(u){return ({fighterBlue:100,fighterRed:130,multiroleBlue:130,multiroleRed:100,stealthFighterBlue:110,stealthFighterRed:130,bomberRed:60,fighterFr:115,multiroleFr:125,stealthFighterFr:120,bomberFr:75}[u.type]||80)*Math.PI/180*(1+(u.level-1)*.05);}
 flyCombat(u,p,dt){const speed=UT(u).speed,radius=speed/this.planeTurnRate(u),margin=radius*2+1;let goal=p;const vx=Math.sin(u.facing),vy=-Math.cos(u.facing);if(u.x<margin&&vx<0||u.x>COLS-1-margin&&vx>0||u.y<margin&&vy<0||u.y>ROWS-1-margin&&vy>0)goal={x:Math.max(margin,Math.min(COLS-1-margin,u.x+vx*margin)),y:Math.max(margin,Math.min(ROWS-1-margin,u.y+vy*margin))};const desired=Math.atan2(goal.x-u.x,u.y-goal.y),diff=Math.atan2(Math.sin(desired-u.facing),Math.cos(desired-u.facing)),turn=this.planeTurnRate(u)*dt;u.facing+=Math.max(-turn,Math.min(turn,diff));
  // Na borda, desliza rente a ela com a mesma velocidade, sem giro instantâneo.
  const step=speed*dt,vx2=Math.sin(u.facing),vy2=-Math.cos(u.facing);let x=u.x+vx2*step,y=u.y+vy2*step;
  if(x<0||x>COLS-1){x=Math.max(0,Math.min(COLS-1,x));y=u.y+(Math.sign(vy2)||Math.sign(ROWS/2-u.y)||1)*Math.sqrt(Math.max(0,step*step-(x-u.x)**2));}
  else if(y<0||y>ROWS-1){y=Math.max(0,Math.min(ROWS-1,y));x=u.x+(Math.sign(vx2)||Math.sign(COLS/2-u.x)||1)*Math.sqrt(Math.max(0,step*step-(y-u.y)**2));}
  u.x=Math.max(0,Math.min(COLS-1,x));u.y=Math.max(0,Math.min(ROWS-1,y));}
 planeAligned(u,target,cone=Math.PI/12){const bearing=Math.atan2(target.x-u.x,u.y-target.y);return Math.abs(Math.atan2(Math.sin(bearing-u.facing),Math.cos(bearing-u.facing)))<=cone;}
 gunSolution(u,target){return AIR(u)&&this.planeWeaponFits(u,'jetGun',target)&&target.hp>0&&target.owner!==u.owner&&target.owner!=='neutral'&&this.canIdentify(u,target)&&DIST(u,target)<=4+1e-8&&this.planeAligned(u,target,Math.PI/6);}
 startGunBurst(u,target){if(u.gunBurst||(u.gunCooldown||0)>1e-8||!this.gunSolution(u,target))return false;u.gunCooldown=2;u.gunBurst={targetId:target.id,left:Math.min(10,u.ammo.jetGun),clock:0};this.advanceGunBurst(u,0);return true;}
 advanceGunBurst(u,dt){const b=u.gunBurst;if(!b)return;b.clock-=dt;const target=this.get(b.targetId);if(!target||!this.gunSolution(u,target)){u.gunBurst=null;return;}if(b.clock<=1e-8){this.shoot(u,target,'jetGun');b.left--;b.clock+=.06;if(!b.left||!u.ammo.jetGun)u.gunBurst=null;}}
 // Míssil de avião a menos de 4 casas: curva evasiva limitada, sem abandonar a missão.
 incoming(u){return this.projectiles.some(p=>p.targetId===u.id&&MISSILE(p.weapon)&&PLANE(this.get(p.attackerId))&&DIST(u,p)<4);}
 jink(u,goal){return {x:goal.x+Math.cos(u.facing)*3,y:goal.y+Math.sin(u.facing)*3};}
 strikeJob(u,target,weapon,salvo){return {type:'strike',targetId:target.id,weapon,missile:this.weapon(u,target),salvo,fired:0,clock:0,elapsed:0,limit:DIST(u,target)/UT(u).speed+15,gunStarted:false,observed:null};}
 separatePlane(u){const exit=u.owner==='red'&&!this.multiplayer&&u.aiAirMission?.exit;u.flightState='egress';u.flightJob={type:'egress',elapsed:0,start:{x:u.x,y:u.y},goal:exit||{x:Math.max(0,Math.min(COLS-1,u.x+Math.sin(u.facing)*8)),y:Math.max(0,Math.min(ROWS-1,u.y-Math.cos(u.facing)*8))},combat:true};}
 endPursuit(u,returnForAmmo=false){u.pursuitIntent=null;u.gunBurst=null;this.setPatrol(u);const base=(returnForAmmo||!Object.values(u.ammo).some(n=>n>0))&&this.airports(u.owner).sort((a,b)=>DIST(u,a)-DIST(u,b)||a.id-b.id)[0];if(base){u.flightJob={type:'return',airportId:base.id};u.flightState='approach';u.pending=true;return false;}return true;}
 resumePursuit(u){const intent=u.pursuitIntent,target=intent&&this.get(intent.targetId);if(!target||target.hp<=0||!this.canIdentify(u,target))return this.endPursuit(u);u.weaponMode=intent.weapon;if(!this.weapon(u,target))return this.endPursuit(u,true);u.flightJob=this.strikeJob(u,target,intent.weapon,intent.salvo);u.flightState='approach';u.order={type:'strike',targetId:target.id};u.pending=true;return false;}
 defendPlanes(dt){for(const u of this.units.filter(u=>PLANE(u)&&AIR(u))){
  const attacker=this.units.filter(e=>e.owner!==u.owner&&PLANE(e)&&AIR(e)&&this.canIdentify(u,e)&&(e.flightJob?.targetId===u.id||this.projectiles.some(p=>p.attackerId===e.id&&p.targetId===u.id))).sort((a,b)=>DIST(u,a)-DIST(u,b)||a.id-b.id)[0];
  if(this.mode==='rts'){if(!attacker)continue;if(!u.flightJob&&u.flightState==='patrol'){this.orderPlane(u,'attack',{targetId:attacker.id,weapon:'auto',salvo:1},true);}else{const j=u.flightJob;if(j?.type==='egress'&&j.combat||j?.type==='strike'&&j.gunStarted)continue;if(this.startGunBurst(u,attacker)&&j?.type==='strike')j.gunStarted=true;}}
  else if(u.owner!==this.turn){if(attacker&&!u.airReactionUsed){u.airReactionUsed=true;u.airReaction={targetId:attacker.id,left:2,burst:false};}const r=u.airReaction,target=r&&this.get(r.targetId);if(!r||r.left<=0||!target||!this.canIdentify(u,target))continue;const step=Math.min(dt,r.left);this.flyCombat(u,target,step);r.left-=step;if(!r.burst&&r.left>1e-8&&this.startGunBurst(u,target))r.burst=true;if(r.left<=1e-8)u.gunBurst=null;}
 }}
 bombLine(owner,start,end){if(!start||!end||!INSIDE(start.x,start.y)||!INSIDE(end.x,end.y)||DIST(start,end)<4||DIST(start,end)>12)return null;const cells=[];for(let i=0;i<=Math.ceil(DIST(start,end));i++){const q=i/Math.ceil(DIST(start,end)),p=TILE({x:start.x+(end.x-start.x)*q,y:start.y+(end.y-start.y)*q});if(!this.explored[owner][KEY(p.x,p.y)])return null;cells.push(p);}return cells;}
 orderPlane(u,type,args={},batch=false){
  const rts=this.mode==='rts';if(u.runway||this.winner||u.hp<=0||!this.units.includes(u)||!rts&&(u.owner!==this.turn||type!=='stop'&&(!u.actionLeft||u.pending||this.busy&&!batch)))return false;
  if(type==='stop'){u.pursuitIntent=null;u.gunBurst=null;if(AIR(u))this.setPatrol(u);else{u.flightJob=null;u.flightState='grounded';u.pending=false;u.order={type:'stop'};}if(this.animation?.id===u.id)this.animation=null;this.actions=this.actions.filter(a=>a.id!==u.id);return true;}
  let job={type,elapsed:0};
  if(['move','patrol','takeoff'].includes(type)){const p=type==='takeoff'?{x:u.x+4,y:u.y+3}:{x:Math.round(args.x),y:Math.round(args.y)};if(!INSIDE(p.x,p.y)||u.flightState==='service')return false;job.type='transfer';job.goal={x:Math.max(4,Math.min(COLS-5,p.x)),y:Math.max(4,Math.min(ROWS-5,p.y))};job.waypoint={x:job.goal.x+4,y:job.goal.y};}
  else if(['attack','strike'].includes(type)){if(!AIR(u))return false;const target=this.get(args.targetId),weapon=args.weapon||u.weaponMode||'auto';if(!target||target.hp<=0||target.owner===u.owner||target.owner==='neutral')return false;const old=u.weaponMode;u.weaponMode=weapon;const w=this.weapon(u,target);if(!w||!this.canIdentify(u,target)){u.weaponMode=old;return false;}job=this.strikeJob(u,target,weapon,args.salvo===2?2:1);if(DRONE(u))job={type:'droneStrike',targetId:target.id,elapsed:0};}
  else if(['return','land'].includes(type)){if(!AIR(u))return false;const base=this.get(args.targetId)||this.airports(u.owner).sort((a,b)=>DIST(u,a)-DIST(u,b)||a.id-b.id)[0];if(!base||!AIRPORT(base)||base.owner!==u.owner)return false;job.type='return';job.airportId=base.id;}
  else if(type==='strikeCell'){
   // Cruzeiro marca coordenada fixa, visível ou não. As demais armas mantêm a aposta na névoa.
   const x=args.x,y=args.y,pick=args.weapon||'auto',cruise=UT(u).weapons.includes('cruiseMissile')&&(pick==='cruiseMissile'||pick==='auto'&&AUTO_CRUISE(u));
   if(!AIR(u)||!INSIDE(x,y)||!cruise&&this.visible[u.owner][KEY(x,y)])return false;
   const weapon=cruise&&u.ammo.cruiseMissile>0?'cruiseMissile':pick==='auto'?['jetAgm','jetGun'].find(w=>u.ammo[w]>0)&&'auto':['jetAgm','jetGun'].includes(pick)&&u.ammo[pick]>0?pick:null;if(!weapon)return false;
   job={type:'cellStrike',elapsed:0,cell:{x,y},goal:{x,y},weapon,salvoAgm:args.salvo===2?2:1,salvo:1,fired:0,clock:0,limit:DIST(u,{x,y})/UT(u).speed+15,targetId:null,resolved:false};
  }
  else if(type==='bombRun'){if(!AIR(u)||!this.bombLine(u.owner,args.start,args.end))return false;const count=args.bombCount===undefined?12:args.bombCount,capacity=BOMB_TYPES.reduce((n,w)=>n+(UT(u).ammo[w]||0),0);if(![6,12,24,48].includes(count)||count>capacity)return false;const bombs=[],remaining={...u.ammo};while(bombs.length<count){let added=false;for(const w of BOMB_TYPES)if(remaining[w]>0&&bombs.length<count){bombs.push(w);remaining[w]--;added=true;}if(!added)break;}if(!bombs.length)return false;job={...job,type:'bombRun',start:{...args.start},end:{...args.end},bombs,index:0,phase:'approach'};}
  else return false;
  u.pursuitIntent=job.type==='strike'&&AIR(this.get(job.targetId))?{targetId:job.targetId,weapon:job.weapon,salvo:job.salvo}:null;u.gunBurst=null;
  if(!AIR(u)){const base=this.get(u.airportId);if(!base||base.owner!==u.owner||!AIRPORT(base))return false;u.runway={type:'takeoff',phase:'wait',baseId:base.id,level:0,elapsed:0};u.flightState='waitRunway';u.altitude='high';}else u.flightState='approach';u.flightJob=job;u.pending=true;u.path=[];u.segment=null;u.order={type:job.type==='droneStrike'?'attack':DRONE(u)&&job.type==='transfer'?'move':job.type,targetId:job.targetId,goal:job.goal};u.actionLeft=rts?true:false;u.moveLeft=0;u.moved=true;
  if(!rts)this.actions.push({id:u.id,type:'planeFlight',route:[],plane:true});return true;
 }
 finishPlaneFlight(u){this.setPatrol(u);if(!Object.values(u.ammo).some(n=>n>0))this.orderPlane(u,'return',{},true);return true;}
 stepPlane(u,dt){
  if(UT(u).airdropPlane)return this.stepAirdropPlane(u,dt);
  if(u.hp<=0)return true;if(u.runway){const done=this.stepRunway(u,dt);this.touchVision();this.defendAir();return done;}if(!AIR(u))return false;
  const j=u.flightJob;if(!j){if(this.mode==='rts')this.orbitPlane(u,dt);return false;}j.elapsed=(j.elapsed||0)+dt;
  if(j.type==='patrolTurn'){j.angle=(j.angle||0)+this.orbitPlane(u,dt);if(j.angle>=Math.PI*2){this.setPatrol(u,u.patrol);return true;}}
  else if(j.type==='transfer'){if(this.flyToward(u,j.waypoint,dt)){this.setPatrol(u,j.goal);return true;}}
  else if(j.type==='return'){const base=this.get(j.airportId);if(!base||base.hp<=0||base.owner!==u.owner){this.redirectPlane(u,base);return !u.flightJob;}else{const slot=this.airportSlot(base);if(!slot||this.runwayBusy(base)){j.wait=(j.wait||0)+this.orbitPlane(u,dt);if(this.mode==='turns'&&j.wait>=Math.PI*2){u.pending=false;return true;}}else{base.runwayId=u.id;u.runway={type:'land',phase:'approach',baseId:base.id,slot,level:1,elapsed:0};u.flightState='approach';this.stepRunway(u,dt);}}}
  else if(j.type==='strike'){
   const target=this.get(j.targetId);u.weaponMode=j.weapon;
   if(!target||target.hp<=0||!this.canIdentify(u,target))return this.endPursuit(u);
   const missile=j.missile!=='jetGun'&&this.planeWeaponFits(u,j.missile,target)?j.missile:null,gun=j.weapon==='auto'||j.weapon==='jetGun';
   if(!missile&&!(gun&&this.planeWeaponFits(u,'jetGun',target))){if(j.fired||j.gunStarted)this.separatePlane(u);else return this.endPursuit(u,true);return false;}
   if(j.elapsed>j.limit){u.gunBurst=null;this.separatePlane(u);return false;}
   // Perseguição pura: o míssil se guia sozinho e a metralhadora precisa do nariz no alvo; antecipar o movimento só afastava o caça (observado em simulação).
   const goal={x:target.x+(target.width||1)/2-.5,y:target.y+(target.height||1)/2-.5};
   // Incoming aircraft missiles permit a bounded evasive turn.
   this.flyCombat(u,this.incoming(u)?this.jink(u,goal):goal,dt);j.clock-=dt;
   // RTS contra aeronave: salva resolvida e alvo vivo → nova salva, em vez de só perseguir pela metralhadora.
   if(this.mode==='rts'&&AIR(target)&&missile&&j.fired>=j.salvo&&!j.gunStarted&&!this.projectiles.some(p=>p.attackerId===u.id&&p.targetId===target.id))j.fired=0;
   if(missile&&j.fired<j.salvo&&this.planeAligned(u,target,Math.PI/6)&&DIST(u,target)<=this.weaponRange(u,missile)&&j.clock<=1e-8&&u.cooldown<=1e-8){this.shoot(u,target,missile);j.fired++;j.clock=.6;u.flightState='attack';}
   const missilesDone=!missile||j.fired>=j.salvo;
   if(missilesDone){if(gun&&this.planeWeaponFits(u,'jetGun',target)){if(!j.gunStarted&&this.startGunBurst(u,target)){j.gunStarted=true;u.flightState='attack';}if(j.gunStarted&&!u.gunBurst)this.separatePlane(u);}else this.separatePlane(u);}
  }
  else if(j.type==='droneStrike'){
   const target=this.get(j.targetId),w=target&&target.hp>0&&this.weapon(u,target);
   if(!w||!this.canIdentify(u,target)||j.elapsed>30){this.setPatrol(u);return true;}
   if(DIST(u,target)>this.range(u,target))this.flyToward(u,target,dt);
   else if(u.cooldown>1e-8)this.orbitPlane(u,dt);
   else{this.shoot(u,target,w);if(this.mode!=='rts'){this.setPatrol(u);return true;}} // RTS: a ordem segue até acabar o estoque
  }
  else if(j.type==='cellStrike'){
   const cell=j.cell;
   if(j.weapon==='cruiseMissile'){
    if(!u.ammo.cruiseMissile||j.elapsed>j.limit)return this.finishPlaneFlight(u);
    if(DIST(u,cell)<=this.weaponRange(u,'cruiseMissile')){
     if(this.launchCruise(u,cell))return this.finishPlaneFlight(u);
     this.orbitPlane(u,dt);
    }else this.flyCombat(u,this.incoming(u)?this.jink(u,cell):cell,dt);
    this.touchVision();this.defendAir();return false;
   }
   if(!j.resolved){
    // Ao entrar no alcance da melhor arma, o que houver na casa é resolvido: a aposta paga ou não.
    const ws=(j.weapon==='auto'?['jetAgm','jetGun']:[j.weapon]).filter(w=>u.ammo[w]>0);
    if(!ws.length||j.elapsed>j.limit){this.separatePlane(u);return false;}
    if(DIST(u,cell)<=Math.max(...ws.map(w=>this.weaponRange(u,w)))){
     for(const w of ws){const t=this.cellTarget(u,cell,w);if(t){j.weapon=w;j.targetId=t.id;break;}}
     if(j.targetId===null)j.weapon=ws[0];
     j.salvo=j.weapon==='jetGun'?Math.min(10,u.ammo.jetGun):Math.min(j.salvoAgm,u.ammo.jetAgm);j.resolved=true;
    }
   }
   u.weaponMode=j.resolved?j.weapon:'auto';
   if(j.resolved&&(j.elapsed>j.limit||u.ammo[j.weapon]<=0)){this.separatePlane(u);return false;}
   this.flyCombat(u,this.incoming(u)?this.jink(u,cell):cell,dt);j.clock-=dt;
   if(j.resolved&&j.clock<=1e-8&&u.cooldown<=1e-8&&DIST(u,cell)<=this.weaponRange(u,j.weapon)&&this.planeAligned(u,cell,Math.PI/6)){
    const target=j.targetId===null?null:this.get(j.targetId);
    if(j.targetId!==null){if(!target||target.hp<=0||target.owner===u.owner||!this.planeWeaponFits(u,j.weapon,target)){this.separatePlane(u);return false;}this.shoot(u,target,j.weapon);target.revealed=Math.max(target.revealed||0,2);}
    else{u.ammo[j.weapon]--;if(MISSILE(j.weapon))this.ammoWarning(u);if(j.weapon!=='jetGun')u.cooldown=u.reload=this.weaponStats(u,j.weapon).cooldown;this.event('blast',{x:cell.x,y:cell.y,owner:u.owner},{dud:true,visible:true});}
    j.fired++;j.clock=j.weapon==='jetGun'?.06:.6;u.flightState='attack';
    if(j.fired>=j.salvo)this.separatePlane(u);
   }
  }
  else if(j.type==='bombRun'){
   if(j.phase==='approach'){if(this.incoming(u))this.flyCombat(u,this.jink(u,j.start),dt);else if(this.flyToward(u,j.start,dt)){j.phase='run';u.flightState='attack';}}
   else {const finished=this.flyToward(u,j.end,dt),dx=j.end.x-j.start.x,dy=j.end.y-j.start.y,progress=((u.x-j.start.x)*dx+(u.y-j.start.y)*dy)/(dx*dx+dy*dy);
    while(j.index<j.bombs.length&&(finished||progress>=j.index/Math.max(1,j.bombs.length-1))){const q=j.index/Math.max(1,j.bombs.length-1),cell=TILE({x:j.start.x+dx*q,y:j.start.y+dy*q});this.dropBomb(u,j.bombs[j.index++],cell);}
    if(finished){u.flightState='egress';u.flightJob={type:'egress',goal:{x:Math.max(0,Math.min(COLS-1,j.end.x+dx/Math.hypot(dx,dy)*4)),y:Math.max(0,Math.min(ROWS-1,j.end.y+dy/Math.hypot(dx,dy)*4))}};}
   }
  }
  else if(j.type==='egress'&&j.combat){if(u.pursuitIntent){const target=this.get(u.pursuitIntent.targetId);if(!target||target.hp<=0||!this.canIdentify(u,target))return this.endPursuit(u);}this.flyCombat(u,j.goal,dt);if(Math.hypot(u.x-j.start.x,u.y-j.start.y)>=4||j.elapsed>6){if(u.pursuitIntent){if(this.mode==='rts')return this.resumePursuit(u);const target=this.get(u.pursuitIntent.targetId);if(!this.weapon(u,target))return this.endPursuit(u,true);this.setPatrol(u);u.order={type:'pursuit',targetId:target.id};return true;}return this.finishPlaneFlight(u);}}
  else if(j.type==='egress'){if(this.flyToward(u,j.goal,dt)){const base=!Object.values(u.ammo).some(n=>n>0)&&this.airports(u.owner).sort((a,b)=>DIST(u,a)-DIST(u,b)||a.id-b.id)[0];if(base){u.flightJob={type:'return',airportId:base.id};u.flightState='approach';}else return this.finishPlaneFlight(u);}}
  this.touchVision();this.defendAir();return false;
 }
 dropBomb(u,w,cell){if(!(u.ammo[w]>0))return false;u.ammo[w]--;this.projectiles.push({owner:u.owner,type:u.type,attackerId:u.id,weapon:w,air:false,sourceLevel:1,targetLevel:0,sx:u.x,sy:u.y,x:u.x,y:u.y,tx:cell.x,ty:cell.y,elapsed:0,duration:.6,trail:[],power:this.attackPower(u,w),hit:this.rng()<this.accuracy(u,{...cell,level:1},w)});this.shotsFired++;this.event('shot',u,{weapon:'artillery'});return true;}
 launchCruise(u,cell){
  if(!u||this.winner||u.runway||!PLANE(u)||!UT(u).weapons.includes('cruiseMissile')||!this.units.includes(u)||u.hp<=0||!AIR(u)||!cell||!INSIDE(cell.x,cell.y)||!(u.ammo.cruiseMissile>0)||u.cooldown>1e-8||DIST(u,cell)>this.weaponRange(u,'cruiseMissile'))return false;
  const w=WEAPONS.cruiseMissile;u.ammo.cruiseMissile--;this.ammoWarning(u);u.cooldown=u.reload=w.cooldown;
  this.projectiles.push({attackerId:u.id,owner:u.owner,type:u.type,weapon:'cruiseMissile',air:true,sourceLevel:flightLevel(u),targetLevel:0,sx:u.x,sy:u.y,x:u.x,y:u.y,tx:cell.x,ty:cell.y,heading:Math.atan2(cell.y-u.y,cell.x-u.x),trail:[],elapsed:0,duration:Math.max(.1,DIST(u,cell)/w.speed),power:this.attackPower(u,'cruiseMissile'),hit:true});
  this.shotsFired++;this.event('shot',u,{weapon:'antitank'});return true;
 }
 bombImpact(p){
  if(!p.hit){this.event('blast',{x:p.tx,y:p.ty},{dud:true});return;}const attacker=this.get(p.attackerId),cell={x:p.tx,y:p.ty};this.event('blast',cell,{heavy:true});
  for(const t of this.all().filter(t=>t.hp>0&&!AIR(t)&&DIST(t,cell)<=2&&Math.max(Math.max(t.x-cell.x,cell.x-t.x-(t.width||1)+1,0),Math.max(t.y-cell.y,cell.y-t.y-(t.height||1)+1,0))<=1)){
   const center=DIST(t,cell)<.1;let power=p.power*(center?1:.5);if(p.weapon==='bombFragment')power*=(UT(t).vehicle||UT(t).structure)?.25:1.5;
   this.hurt(t,Math.max(1,Math.round(power*(1-this.cover(t)))),attacker);
  }
  if(p.weapon==='bombIncendiary'){for(let y=cell.y-1;y<=cell.y+1;y++)for(let x=cell.x-1;x<=cell.x+1;x++)if(INSIDE(x,y)){const fire=this.fires.find(f=>f.x===x&&f.y===y);if(fire){fire.left=6;fire.turns={...Object.fromEntries(this.sides.map(s=>[s,2])),neutral:2};}else this.fires.push({x,y,left:6,power:p.power/4,attackerId:p.attackerId,turns:{...Object.fromEntries(this.sides.map(s=>[s,2])),neutral:2}});}}
 }
 advanceFires(dt,owner){
  const hit=new Map();for(const fire of this.fires){const active=owner?fire.turns[owner]>0:fire.left>0;if(!active)continue;for(const u of this.all())if(u.hp>0&&!AIR(u)&&(!owner||u.owner===owner)&&DIST(u,fire)<=.05){const n=fire.power*(owner?3:dt)*((UT(u).vehicle||UT(u).structure)?.5:1);const old=hit.get(u.id);if(!old||old.n<n)hit.set(u.id,{u,n,attacker:this.get(fire.attackerId)});}if(owner)fire.turns[owner]--;else fire.left-=dt;}
  for(const {u,n,attacker}of hit.values()){u.burnDamage=(u.burnDamage||0)+n;if(u.burnDamage>=1){const amount=Math.floor(u.burnDamage);u.burnDamage-=amount;this.hurt(u,amount,attacker);}}
  this.fires=this.fires.filter(f=>owner?f.turns.blue>0||f.turns.red>0:f.left>0);
 }
 servicePlane(u,rearm=true,internal=false){
  const base=this.get(u.airportId);if(u.runway||this.winner||this.mode==='turns'&&!internal&&(this.turn!==u.owner||this.busy||!u.actionLeft)||!PLANE(u)||AIR(u)||!base||base.owner!==u.owner||!AIRPORT(base)||u.flightState==='service')return false;
  const missing=Object.entries(UT(u).ammo).reduce((n,[w,q])=>n+Math.max(0,q-(u.ammo[w]||0))*AMMO_PRICE[w],0),paid=rearm&&this.credits[u.owner]>=missing;
  if(paid)this.credits[u.owner]-=missing;u.flightState='service';if(this.mode==='turns'){u.actionLeft=false;u.moveLeft=0;}u.serviceProgress=0;u.serviceRearm=paid;u.order={type:'planeService'};return true;
 }
 progressPlaneService(owner,elapsed){for(const u of this.units)if(PLANE(u)&&u.owner===owner&&u.flightState==='service'){const b=this.get(u.airportId);if(!b||b.owner!==owner)continue;u.serviceProgress+=elapsed;const duration=(b.type==='airportAsphalt'?1:2)*(this.mode==='rts'?10:1);if(u.serviceProgress+1e-8>=duration){u.hp=u.maxHp;u.flares=UT(u).flares;if(u.serviceRearm)u.ammo={...UT(u).ammo};u.flightState='grounded';u.pending=false;u.order={type:'stop'};this.event('ready',u);}}}
 completeTurn(owner){for(const u of this.units.filter(u=>u.owner===owner&&u.captureIntent&&!u.pending&&u.actionLeft)){const target=this.captureTarget(u);if(target&&(u.moveLeft>0||DIST(u,target)<=1))this.order(u,'capture',{targetId:target.id,position:u.captureIntent.position},true);}const planes=this.units.filter(u=>u.owner===owner&&FLYER(u)&&AIR(u)&&u.actionLeft&&!u.pending);if(!planes.length&&!this.actions.length){this.beginTurn(this.nextSide(owner));return;}this.turnEnding=this.nextSide(owner);for(const u of planes){if(u.pursuitIntent){const intent=u.pursuitIntent;if(this.orderPlane(u,'attack',intent,true))continue;this.endPursuit(u);}u.actionLeft=false;u.pending=true;u.flightJob=u.flightJob?.type==='return'?{...u.flightJob,wait:0}:{type:'patrolTurn',angle:0};this.actions.push({id:u.id,type:'planeFlight',plane:true,route:[]});}}

 generateAirports(carve,nodes){if(seeded(this.seed^0x43c8a15b)()>=.5)return;const {width,height}=TYPES.airportAsphalt;for(const pos of [{x:4,y:4},{x:4,y:8},{x:8,y:4}]){const pair=[pos,{x:COLS-pos.x-width,y:ROWS-pos.y-height}];if(pair.some(p=>{const area={x:p.x-2,y:p.y,width:width+4,height};return !INSIDE(area.x,area.y)||!INSIDE(area.x+area.width-1,area.y+height-1)||this.structures.some(s=>DIST({...p,width,height},s)<2||DIST(area,s)===0)||this.units.some(u=>DIST(area,u)===0)||this.mines.some(m=>DIST(area,m)===0);} ))continue;for(const p of pair){const access={x:p.x-1,y:p.y+height-1};carve(access,nodes.slice().sort((a,b)=>DIST(a,access)-DIST(b,access))[0]);this.add('neutral','airportAsphalt',p.x,p.y);}for(const p of pair)for(let y=p.y;y<p.y+height;y++)for(let x=p.x-2;x<p.x+width+2;x++)if(x>=p.x&&x<p.x+width||!['road','bridge'].includes(this.terrain[KEY(x,y)]))this.terrain[KEY(x,y)]='plain';break;}}
 airportApproaches(cell){const cells=[];for(let y=cell.y;y<cell.y+2;y++)for(const x of [cell.x-2,cell.x-1,cell.x+6,cell.x+7])if(INSIDE(x,y))cells.push({x,y});return cells;}
 airportBuildInfo(cell){const approaches=cell?this.airportApproaches(cell):[];let valid=!!cell&&INSIDE(cell.x-2,cell.y)&&INSIDE(cell.x+7,cell.y+1),duration=30;if(valid)for(let y=cell.y;y<cell.y+2;y++)for(let x=cell.x-2;x<cell.x+8;x++){const t=this.terrain[KEY(x,y)];if(['forest','hedge','hill','mountain'].includes(t))duration=60;if(t==='river'||this.structureAt(x,y)||this.mines.some(m=>m.x===x&&m.y===y)||x>=cell.x&&x<cell.x+6&&this.occupied(x,y,null,false))valid=false;}return {valid,duration,approaches};}
 airportBuildSite(cell){return this.airportBuildInfo(cell).valid;}
 airportDuration(site){return (site.buildDuration||30)/(this.mode==='rts'?1:10);}
 buildAirport(ids,cell){const info=this.airportBuildInfo(cell);const owner=this.get(ids?.[0])?.owner,workers=[...new Set(ids||[])].map(id=>this.get(id)).filter(u=>u?.type==='engineer'&&u.hp>0&&u.owner===owner&&!u.airportSiteId&&(this.mode==='rts'||u.actionLeft));if(this.winner||!this.sides.includes(owner)||this.mode==='turns'&&(this.turn!==owner||this.busy)||workers.length<2||this.credits[owner]<400||!info.valid)return false;const site={...cell,width:6,height:2};if(this.mode==='turns'&&workers.filter(u=>DIST(u,site)<=1&&!u.segment).length<2)return false;const routes=workers.map(u=>this.pathToRange(u,site,1));if(routes.filter(Boolean).length<2)return false;const s=this.add(owner,'airportSite',cell.x,cell.y);s.work=0;s.buildDuration=info.duration;s.workers=[];this.credits[owner]-=400;this.assignAirportWorkers(s,workers.map(u=>u.id));if(this.mode==='turns')this.progressAirports(owner,1);this.report('Construção de aeroporto: 400 créditos, dois engenheiros.',s);return true;}
 assignAirportWorkers(site,ids){if(!site||site.type!=='airportSite'||site.hp<=0||!this.structures.includes(site))return false;const workers=[...new Set(ids||[])].map(id=>this.get(id)).filter(u=>u?.type==='engineer'&&u.owner===site.owner&&u.hp>0&&(!u.airportSiteId||u.airportSiteId===site.id)&&(this.mode==='rts'||DIST(u,site)<=1&&!u.segment));if(workers.length<2)return false;const routes=workers.map(u=>this.pathToRange(u,site,1));if(routes.filter(r=>r!==null).length<2)return false;for(const old of this.units.filter(u=>u.airportSiteId===site.id&&!workers.includes(u))){old.airportSiteId=null;this.finishRTS(old);}site.workers=workers.map(u=>u.id);for(let i=0;i<workers.length;i++){const u=workers[i],route=routes[i];if(route===null)continue;this.cancelWork(u);u.airportSiteId=site.id;u.order={type:'airportWork',targetId:site.id};u.job={id:u.id,type:'airportWork',targetId:site.id,route};u.path=route.slice();u.pending=route.length>0;}return true;}
 progressAirports(owner,elapsed){for(const site of this.structures.filter(s=>s.owner===owner&&s.type==='airportSite')){if(this.mode==='turns'&&site.lastWorkRound===this.round)continue;const workers=this.units.filter(u=>u.owner===owner&&u.type==='engineer'&&u.airportSiteId===site.id&&u.order.type==='airportWork'&&u.hp>0&&!u.segment&&DIST(u,site)<=1&&(this.mode==='rts'||u.actionLeft));if(workers.length<2)continue;site.work+=elapsed;if(this.mode==='turns'){site.lastWorkRound=this.round;for(const u of workers)u.actionLeft=false;}if(site.work+1e-8>=this.airportDuration(site)){const cells=this.airportApproaches(site).filter(p=>this.terrain[KEY(p.x,p.y)]!=='plain');for(const p of cells)this.terrain[KEY(p.x,p.y)]='plain';if(cells.length)this.event('terrainChanged',site,{cells,visible:true});site.type='airportDirt';site.hp=site.maxHp=TYPES.airportDirt.hp;site.work=0;for(const u of this.units.filter(u=>u.airportSiteId===site.id)){u.airportSiteId=null;u.job=null;u.pending=false;u.order={type:'stop'};u.path=[];}this.updateVision();this.report('Aeroporto de terra concluído.',site);this.event('ready',site);}}}
 loseAirport(base,attacker){base.queue=[];for(const u of [...this.docked(base)])this.hurt(u,u.hp,attacker);for(const u of this.units.filter(u=>u.runway?.baseId===base.id))this.redirectPlane(u,base);base.runwayId=null;}
 canCapture(u,base){if(u?.missionRole==='informant')return false;return base?.missionTarget?u?.type==='infantry':base?.type==='post'?POST_CAPTURERS.has(u?.type):AIRPORT(base)&&u?.type==='infantry';}
 knownObjective(owner,id,position){const remembered=[...this.memory[owner].values()].find(s=>s.id===id),p=position||remembered;if(p&&this.isVisible(owner,p))return this.structures.find(s=>s.id===id)||null;const actual=this.structures.find(s=>s.id===id);return actual&&this.isVisible(owner,actual)?actual:remembered||null;}
 knownPostAt(owner,p){return [...this.structures.filter(s=>(s.type==='post'||s.missionTarget)&&this.isVisible(owner,s)),...this.memory[owner].values()].find(s=>(s.type==='post'||s.missionTarget)&&DIST(p,s)<.6)||null;}
 captureTarget(u){const intent=u.captureIntent;if(!intent)return null;const t=this.knownObjective(u.owner,intent.targetId,intent.position);if(!t||t.owner===u.owner){if(this.multiplayer||u.owner==='blue')this.log(t?'Objetivo já aliado.':'Objetivo destruído ou não existe mais.',[u.owner]);u.captureIntent=null;return null;}return t;}
 captureStatus(u){return u.work>0?'Capturando':u.captureIntent&&!u.segment&&!u.path.length&&DIST(u,u.captureIntent.position)>1?'Aguardando passagem':'Indo capturar';}
 captureStructure(base,u){if(AIRPORT(base))this.loseAirport(base,u);base.queue=[];base.owner=u.owner;this.report(UT(base).name+' capturado pela Nação '+this.nationLabel(u.owner)+'.',u);}

 planeWeapon(u,w){const t=UT(u),red=t.team==='red',fighter=!!t.radar;let base=WEAPONS[w];if(!base)return null;let range=base.range,damage=base.damage;if(w==='jetAam'){range=30;damage=fighter?(red?75:70):(red?80:65);}if(w==='antiRadiation')damage=red?90:80;if(w==='jetAgm'){range=15;damage=red?90:75;}return {...base,range,damage,...t.arms?.[w]};}
 planeEvasion(u){return Math.min(.8,UT(u).evasion+(u.level-1)*.05);}
 planeWeaponFits(u,w,b){return AIR(u)&&u.ammo[w]>0&&(w==='jetAam'?AIR(b):w==='antiRadiation'?b.type==='antiAirVehicle'&&b.radarOn:w==='jetAgm'?!AIR(b)&&(UT(b).vehicle||UT(b).structure):w==='jetGun'?!UT(b).structure&&!ARMORED.has(b.type):false);}
 /* Alvo inimigo de solo na casa compatível com a arma: tropas antes de estruturas, menor id primeiro. */
 cellTarget(u,cell,weapon){const ok=e=>e.hp>0&&e.owner!==u.owner&&e.owner!=='neutral'&&this.planeWeaponFits(u,weapon,e),units=this.units.filter(e=>!AIR(e)&&Math.round(e.x)===cell.x&&Math.round(e.y)===cell.y&&ok(e)).sort((a,b)=>a.id-b.id);return units[0]||this.structures.filter(s=>cell.x>=s.x&&cell.x<s.x+(s.width||1)&&cell.y>=s.y&&cell.y<s.y+(s.height||1)&&ok(s)).sort((a,b)=>a.id-b.id)[0]||null;}
 /* Alcance máximo das armas de solo e da antirradiação (sem ar-ar nem bombas) de um avião em voo com munição; é até onde ele enxerga uma antiaérea que acabou de disparar. */
 strikeReach(u){if(!PLANE(u)||!AIR(u))return 0;return Math.max(0,...UT(u).weapons.filter(w=>w!=='jetAam'&&w!=='cruiseMissile'&&!BOMB_TYPES.includes(w)&&u.ammo[w]>0).map(w=>this.weaponRange(u,w)));}
 canIdentify(u,target){return this.isVisible(u.owner,target)||(PLANE(u)&&target?.type==='antiAirVehicle'&&target.radarOn&&u.ammo.antiRadiation>0&&DIST(u,target)<=this.planeWeapon(u,'antiRadiation').range);}
 emitterContacts(owner){const observers=this.units.filter(u=>u.owner===owner&&u.hp>0&&PLANE(u)&&AIR(u)&&u.ammo.antiRadiation>0);return this.units.filter(u=>u.hp>0&&u.owner!==owner&&u.owner!=='neutral'&&u.type==='antiAirVehicle'&&(this.isVisible(owner,u)||u.radarOn&&observers.some(p=>this.canIdentify(p,u)))).map(u=>({id:u.id,x:u.x,y:u.y,radarOn:u.radarOn}));}
 radarCoverage(owner,u){if(!AIR(u)||UT(u).stealth||UT(u).radarStealth)return false;return this.units.some(e=>e.hp>0&&e.owner===owner&&((e.type==='antiAirVehicle'&&e.radarOn&&u.altitude==='high')||(PLANE(e)&&UT(e).radar&&e.radarOn!==false&&AIR(e)&&DIST(e,u)<=18)));}
 useSmoke(u){if(u.type!=='antiAirVehicle'||u.smokeCharges<=0||(this.mode==='rts'?u.smokeCooldown>0:u.smokeUsed))return false;u.smokeCharges--;u.smokeCooldown=12;u.smokeTime=3;u.smokeUsed=true;this.event('defenseSmoke',u);return true;}
 defendAir(interceptionOnly=false){for(const a of this.units.filter(u=>u.type==='antiAirVehicle'&&u.hp>0)){if(this.mode==='rts'?a.cooldown>0:!a.reactionReady||a.owner===this.turn)continue;const incoming=this.projectiles.filter(p=>['antiRadiation','cruiseMissile'].includes(p.weapon)&&!p.intercepted&&p.owner!==a.owner&&DIST(a,p)<=6).sort((p,q)=>Number(q.weapon==='antiRadiation')-Number(p.weapon==='antiRadiation')||Number(q.targetId===a.id)-Number(p.targetId===a.id)||Number(this.get(q.targetId)?.type==='antiAirVehicle')-Number(this.get(p.targetId)?.type==='antiAirVehicle')||DIST(a,p)-DIST(a,q));if(incoming.length){const p=incoming[0];p.projectileId??=this.nextProjectileId++;a.cooldown=3.5;a.reactionReady=false;this.shotsFired++;this.event('shot',a,{weapon:'antitank'});this.projectiles.push({projectileId:this.nextProjectileId++,targetProjectileId:p.projectileId,interceptor:true,interceptSuccess:this.rng()<(p.weapon==='cruiseMissile'?.75:.15),attackerId:a.id,owner:a.owner,type:a.type,weapon:'antiAirVehicle',air:true,sourceLevel:0,targetLevel:p.visualLevel??p.sourceLevel??0,sx:a.x,sy:a.y,x:a.x,y:a.y,tx:p.x,ty:p.y,elapsed:0,duration:Math.max(.1,p.duration-p.elapsed),heading:Math.atan2(p.y-a.y,p.x-a.x),trail:[]});continue;}if(this.mode==='rts'||interceptionOnly)continue;const target=this.units.filter(u=>u.owner!==a.owner&&PLANE(u)&&AIR(u)&&this.canFire(a,u)).sort((u,v)=>DIST(a,u)-DIST(a,v)||u.id-v.id)[0];if(target){a.reactionReady=false;this.shoot(a,target);}}}
 advanceInterceptors(dt,starts,hits){
  if(!this.projectiles.some(p=>p.interceptor))return;
  const meetings=[],expired=new Set(),targets=new Map(this.projectiles.filter(p=>!p.interceptor&&p.projectileId).map(p=>[p.projectileId,p]));
  for(const p of this.projectiles.filter(p=>p.interceptor)){
   const target=targets.get(p.targetProjectileId),start=target&&starts.get(target);if(!target||target.intercepted||!start){expired.add(p);continue;}
   const sx=p.x,sy=p.y,dx=target.x-sx,dy=target.y-sy,length=Math.hypot(dx,dy),step=Math.min(length,12*dt),vx=length?dx/length*step:0,vy=length?dy/length*step:0;
   p.elapsed+=dt;p.tx=target.x;p.ty=target.y;p.targetLevel=target.visualLevel??0;p.visualLevel=p.targetLevel;p.heading=Math.atan2(vy,vx);p.trail.push({x:sx,y:sy,level:p.visualLevel,time:this.time});p.trail=p.trail.filter(v=>this.time-v.time<=1.2);p.x+=vx;p.y+=vy;
   this.event('smoke',p,{air:true,flightLevel:p.visualLevel,visible:true,publicMissile:true});
   // Swept relative motion: only meetings before the target's impact belong to this frame.
   const until=Math.min(1,Math.max(0,(target.duration-start.elapsed)/dt)),rx=sx-start.x,ry=sy-start.y,wx=vx-(target.x-start.x)/Math.max(until,1e-8),wy=vy-(target.y-start.y)/Math.max(until,1e-8),aa=wx*wx+wy*wy,bb=2*(rx*wx+ry*wy),cc=rx*rx+ry*ry-.04,disc=bb*bb-4*aa*cc;
   const t=cc<=0?0:aa>0&&disc>=0?(-bb-Math.sqrt(disc))/(2*aa):Infinity;
   if(t>=0&&t<=until+1e-8)meetings.push({p,target,t,x:sx+vx*t,y:sy+vy*t});else if(p.elapsed>=p.duration||hits.includes(target))expired.add(p);
  }
  meetings.sort((a,b)=>a.t-b.t||a.p.projectileId-b.p.projectileId);
  for(const {p,target,x,y}of meetings){expired.add(p);if(target.intercepted)continue;if(p.interceptSuccess){target.intercepted=true;expired.add(target);this.event('blast',{x,y,owner:p.owner},{air:true,visible:true,publicMissile:true,interception:true});}}
  for(const p of this.projectiles)if(p.interceptor&&(!targets.has(p.targetProjectileId)||targets.get(p.targetProjectileId).intercepted))expired.add(p);
  this.projectiles=this.projectiles.filter(p=>!expired.has(p));
 }


 airports(owner){return this.structures.filter(s=>AIRPORT(s)&&s.hp>0&&s.owner===owner);}
 planeCatalog(owner){const faction=this.factionOf(owner);return Object.keys(PLANE_MODELS).filter(type=>TYPES[type].team===faction);}
 factionOf(owner){return this.factions?.[owner]||owner;}
 airCap(owner){return SPEC('transportPlane',this.factionOf(owner)).capacity;}
 recruitCost(type,base){const spec=SPEC(type,this.factionOf(base?.owner));return Math.round((spec?.cost||0)*(base?.type==='airportAsphalt'&&spec?.plane? .8:1));}
 runwayBusy(base){const p=this.get(base.runwayId);if(!p||p.hp<=0||p.runway?.baseId!==base.id){base.runwayId=null;return false;}return true;}
 releaseRunway(u){const b=this.get(u.runway?.baseId);if(b?.runwayId===u.id)b.runwayId=null;u.runway=null;}
 redirectPlane(u,lost){this.releaseRunway(u);u.airportId=null;const base=this.airports(u.owner).filter(b=>b!==lost).sort((a,b)=>DIST(u,a)-DIST(u,b)||a.id-b.id)[0];if(base){u.flightState='approach';u.flightJob={type:'return',airportId:base.id};u.pending=true;}else{this.setPatrol(u);if(this.mode==='turns'){this.actions=this.actions.filter(a=>a.id!==u.id);if(this.animation?.id===u.id)this.finishAction(u);}}}
 // O ponto de aproximação fica a (v0+v1)/2·T antes da cabeceira para o pouso entrar na pista com a velocidade de voo, sem tranco.
 runwayPoints(base,u){const y=base.y+base.height/2-.5,k=u?UT(u).speed*(1+LANDING_SPEED)/2*1.5*(UT(u).shortRunway?SHORT_RUNWAY:1):2;return {start:{x:base.x+.5,y},end:{x:base.x+base.width-1.5,y},approach:{x:Math.max(0,base.x+.5-k),y},climb:{x:Math.min(COLS-1,base.x+base.width+.5),y}};}
 turnToward(u,heading,dt,rate=TURN_RATE){const d=((heading-(u.facing||0)+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI,m=rate*dt;u.facing=(u.facing||0)+Math.max(-m,Math.min(m,d));}
 // Cada fase é uma curva de Hermite com velocidade inicial v0 e final v1 (casas/s) que casa com a fase vizinha; a duração e o ponto final não mudam.
 runwayPhase(u,phase,goal,duration,level){const r=u.runway,T=duration*(UT(u).shortRunway?SHORT_RUNWAY:1),D=Math.hypot(goal.x-u.x,goal.y-u.y),speed=UT(u).speed,prev=r.v1||0;
  const [v0,v1]=phase==='takeoffRoll'?[0,D?2*D/T:0]:phase==='climb'?[prev,speed]:phase==='landing'?[speed,speed*LANDING_SPEED]:phase==='landingRoll'?[prev,0]:[0,0];
  r.phase=phase;r.elapsed=0;r.from={x:u.x,y:u.y};r.goal=goal;r.duration=T;r.fromLevel=r.level;r.toLevel=level;u.flightState=phase;
  r.dist=D;r.v0=v0;r.v1=v1;r.m0=Math.min(v0*T,3*D);r.m1=Math.min(v1*T,3*D);}
 stepRunway(u,dt){
  const r=u.runway,base=this.get(r.baseId);
  if(UT(u).airdropPlane&&(!base||base.hp<=0||base.owner!==u.owner)){this.releaseRunway(u);if(AIR(u))return false;this.hurt(u,u.hp);return true;}
  if(!base||base.hp<=0||base.owner!==u.owner){if(AIR(u)){this.redirectPlane(u,base);return !u.flightJob;}this.releaseRunway(u);this.hurt(u,u.hp);return true;}
  const points=this.runwayPoints(base,u);
  if(r.phase==='wait'){if(this.runwayBusy(base)&&base.runwayId!==u.id)return false;base.runwayId=u.id;this.runwayPhase(u,'taxiOut',points.start,1.2,0);}
  if(r.phase==='approach'){if(this.incoming(u)){this.flyCombat(u,this.jink(u,points.approach),dt);return false;}if(this.flyToward(u,points.approach,dt)){this.runwayPhase(u,'landing',points.start,1.5,0);}return false;}
  r.elapsed=Math.min(r.duration,r.elapsed+dt);const p=r.elapsed/r.duration,hermite=r.dist>1e-6?Math.max(0,Math.min(1,(p*(1-p)*(1-p)*r.m0+p*p*(3-2*p)*r.dist+p*p*(p-1)*r.m1)/r.dist)):p,q=hermite;
  const dx=r.goal.x-r.from.x,dy=r.goal.y-r.from.y;if(Math.hypot(dx,dy)>.001)this.turnToward(u,Math.atan2(dx,-dy),dt);u.x=r.from.x+dx*q;u.y=r.from.y+dy*q;r.level=r.fromLevel+(r.toLevel-r.fromLevel)*p*p*(3-2*p);
  if(r.elapsed+1e-8<r.duration)return false;
  if(r.phase==='taxiOut')this.runwayPhase(u,'takeoffRoll',points.end,1.8,0);
  else if(r.phase==='takeoffRoll'){u.airportId=null;this.runwayPhase(u,'climb',{x:Math.min(COLS-1,u.x+(r.v1+UT(u).speed)/2*1*(UT(u).shortRunway?SHORT_RUNWAY:1)),y:points.climb.y},1,1);}
  else if(r.phase==='climb'){this.releaseRunway(u);u.flightState='approach';}
  else if(r.phase==='landing'){u.airportId=base.id;this.event('touchdown',u,{facing:u.facing});this.runwayPhase(u,'landingRoll',points.end,2,0);}
  else if(r.phase==='landingRoll')this.runwayPhase(u,'taxiIn',r.slot,1.5,0);
  else if(r.phase==='taxiIn'){this.releaseRunway(u);u.flightState='grounded';u.pending=false;u.flightJob=null;u.order={type:'stop'};
   if(UT(u).airdropPlane){const m=u.airdrop;m.phase='parked';m.baseId=base.id;m.line=null;u.airportId=base.id;if(m.autoLine&&u.cargo.length){const line=m.autoLine;m.autoLine=null;this.beginAirdropRun(u,line);return false;}m.autoLine=null;this.report('Avião de transporte pousou: leve tropas perto do aeroporto, embarque e use Lançar tropas.',u);return true;}
   this.servicePlane(u,true,true);return true;}
  return false;
 }
 docked(base){return this.units.filter(u=>PLANE(u)&&u.hp>0&&u.airportId===base.id&&!AIR(u));}
 airportSlot(base){const arriving=this.units.filter(u=>u.hp>0&&u.runway?.type==='land'&&u.runway.baseId===base.id&&AIR(u));if(this.docked(base).length+arriving.length>=4)return null;for(let i=0;i<4;i++){const p={x:base.x+Math.round(.5+(i+.5)*(base.width-1)/4),y:base.y+base.height-1};if(!this.occupied(p.x,p.y,null,false)&&!this.units.some(u=>u.runway?.baseId===base.id&&u.runway.slot&&u.runway.slot.x===p.x&&u.runway.slot.y===p.y))return p;}return null;}
 canTransport(u){if(UT(u)?.airdropPlane)return u.hp>0&&this.units.includes(u)&&u.airdrop?.phase==='parked'&&!u.pending&&!u.runway&&!this.winner&&(this.mode==='rts'||u.owner===this.turn&&!this.busy);return !!UT(u)?.capacity&&u.hp>0&&this.units.includes(u)&&!u.pending&&!u.segment&&!u.altitudeTransition&&!this.winner&&(this.mode==='rts'||u.owner===this.turn&&u.actionLeft&&!this.busy)&&(!AIR(u)||u.altitude==='low')&&Number.isFinite(this.cost({type:'transportTruck'},Math.round(u.x),Math.round(u.y)))&&!this.structureAt(Math.round(u.x),Math.round(u.y));}
 fitsCargo(carrier,p){
  const t=UT(carrier),cargo=carrier?.cargo||[];if(!t||!p)return false;
  if(t.airdropPlane)return AIRDROP_TYPES.includes(p.type)&&this.cargoSlots(carrier)+AIRDROP_SLOTS(p.type)<=this.airCap(carrier.owner);
  if(t.seats){const need=FOOT(p)?1:t.seats[p.type]||0;return need>0&&seatsUsed(carrier)+need<=t.capacity;}
  const sling=t.sling?.[KIT(carrier)];return FOOT(p)?cargo.filter(FOOT).length<t.capacity:!!sling&&p.type===sling&&!cargo.some(c=>c.type===sling);
 }
 canEmbark(carrier,passenger){return this.canTransport(carrier)&&!!passenger&&this.fitsCargo(carrier,passenger)&&passenger.hp>0&&passenger.owner===carrier.owner&&this.units.includes(passenger)&&!passenger.pending&&!passenger.segment&&!passenger.airportSiteId&&(UT(carrier).airdropPlane?DIST(this.get(carrier.airportId)||carrier,passenger)<=AIRDROP_REACH:DIST(carrier,passenger)<=1)&&(this.mode==='rts'||passenger.actionLeft);}
 landingCells(type,center,radius=1){
  const cells=[];for(let y=Math.max(0,center.y-radius);y<=Math.min(ROWS-1,center.y+radius);y++)for(let x=Math.max(0,center.x-radius);x<=Math.min(COLS-1,center.x+radius);x++){
   const p={x,y},d=DIST(p,center);if(d>radius||radius===1&&d!==1||this.structureAt(x,y)||this.occupied(x,y,null,false)||this.mines.some(m=>m.x===x&&m.y===y)||!Number.isFinite(this.cost({type},x,y))||(this.drops||[]).some(v=>v.x===x&&v.y===y))continue;cells.push(p);
  }return cells.sort((a,b)=>DIST(a,center)-DIST(b,center)||a.y-b.y||a.x-b.x);
 }
 transportOrder(u,type,args={}){
  if(!this.canTransport(u))return false;u.cargo||=[];
  if(type==='embark'){
   const passenger=this.get(args.targetId);if(!this.canEmbark(u,passenger))return false;
   this.cancelWork(passenger);passenger.captureIntent=null;passenger.order={type:'stop'};passenger.path=[];passenger.segment=null;passenger.pending=false;passenger.entrenched=false;passenger.embarkedIn=u.id;
   u.cargo.push(passenger);this.units=this.units.filter(v=>v!==passenger);this.actions=this.actions.filter(a=>a.id!==passenger.id);this.report(`${UT(passenger).name} embarcou. `+(UT(u).airdropPlane?`${this.cargoSlots(u)}/${this.airCap(u.owner)} vagas.`:`${seatsUsed(u)}/${UT(u).capacity} vagas${UT(u).seats?'':u.cargo.some(c=>!FOOT(c))?' + veículo pendurado':''}.`),u);
  }else{
   let count=0;for(const passenger of [...u.cargo]){const cell=this.landingCells(passenger.type,TILE(u),UT(u).airdropPlane?3:1)[0];if(!cell)continue;
    Object.assign(passenger,cell,{embarkedIn:null,pending:false,segment:null,path:[],order:{type:'stop'},captureIntent:null});if(this.mode==='turns'){passenger.moveLeft=0;passenger.actionLeft=false;}
    this.units.push(passenger);u.cargo.splice(u.cargo.indexOf(passenger),1);count++;
   }if(!count){this.report('Sem espaço livre para desembarcar.',u);return false;}this.report(`${count} tropa(s) desembarcada(s).`+(u.cargo.length?' Carga restante: sem espaço livre.':''),u);
  }
  if(this.mode==='turns'&&!UT(u).airdropPlane)u.actionLeft=false;this.updateVision();return true;
 }
 airdropPlane(owner){return this.units.find(u=>u.owner===owner&&u.hp>0&&UT(u).airdropPlane);}
 cargoSlots(u){return (u?.cargo||[]).reduce((n,p)=>n+AIRDROP_SLOTS(p.type),0);}
 airdropQuote(cargo,free,owner){
  if(!cargo||typeof cargo!=='object'||Array.isArray(cargo))return null;let slots=0,cost=AIRDROP_FEE;const types=[],faction=this.factionOf(owner);if(free===undefined)free=this.airCap(owner);
  for(const [type,count]of Object.entries(cargo)){if(!AIRDROP_TYPES.includes(type)||!Number.isInteger(count)||count<0||count>AIRDROP_CAPACITY)return null;slots+=count*AIRDROP_SLOTS(type);cost+=count*SPEC(type,faction).cost;for(let i=0;i<count;i++)types.push(type);}
  return slots>0&&slots<=free?{slots,cost,types}:null;
 }
 airdropSpace(types,destination){const used=new Set();return [...types].sort((a,b)=>Number(!!TYPES[b].vehicle)-Number(!!TYPES[a].vehicle)).every(type=>{const cell=this.landingCells(type,destination,3).find(p=>!used.has(KEY(p.x,p.y)));if(!cell)return false;used.add(KEY(cell.x,cell.y));return true;});}
 // destination (ponto) é opcional: sem ele o avião pousa e espera embarque/linha; com ele decola sozinho depois de pousar (IA).
 canAirdrop(owner,baseId,cargo,destination){
  const plane=this.airdropPlane(owner),quote=this.airdropQuote(cargo,this.airCap(owner)-this.cargoSlots(plane),owner),base=this.get(baseId);
  if(!quote||this.winner||!this.sides.includes(owner)||!(this.mode==='rts'||this.turn===owner&&!this.busy)||!AIRPORT(base)||base.owner!==owner||base.hp<=0||!this.structures.includes(base)||this.credits[owner]<quote.cost||this.atUnitCap(owner,quote.types.length))return false;
  if(destination&&!(INSIDE(destination.x,destination.y)&&this.visible[owner][KEY(destination.x,destination.y)]&&this.airdropSpace(quote.types,destination)))return false;
  return plane?plane.airdrop?.phase==='parked'&&plane.airportId===base.id:!!this.airportSlot(base);
 }
 requestAirdrop(owner,baseId,cargo,destination){
  if(!this.canAirdrop(owner,baseId,cargo,destination))return false;
  const plane=this.airdropPlane(owner),base=this.get(baseId),quote=this.airdropQuote(cargo,this.airCap(owner)-this.cargoSlots(plane),owner),line=destination?{start:{x:destination.x,y:destination.y},end:{x:destination.x,y:destination.y}}:null;
  const passengers=quote.types.sort((a,b)=>Number(!!TYPES[b].vehicle)-Number(!!TYPES[a].vehicle)).map(type=>this.add(owner,type,base.x,base.y));this.units=this.units.filter(u=>!passengers.includes(u));
  this.credits[owner]-=quote.cost;this.drops||=[];
  if(plane){
   plane.cargo.push(...passengers);this.report(`Reforço aéreo embarcado: ${this.cargoSlots(plane)}/${this.airCap(owner)} vagas, ${quote.cost} créditos.`,plane);
   if(line&&this.beginAirdropRun(plane,line)&&this.mode==='turns')this.actions.push({id:plane.id,type:'airdrop',plane:true,route:[]});
   this.updateVision();return true;
  }
  const home=CENTER(this.commandBase(owner)||base),edges=[{x:0,y:Math.round(home.y)},{x:COLS-1,y:Math.round(home.y)},{x:Math.round(home.x),y:0},{x:Math.round(home.x),y:ROWS-1}].sort((a,b)=>DIST(a,home)-DIST(b,home)),entry=edges[0];
  const unit=this.add(owner,'transportPlane',entry.x,entry.y);unit.altitude='high';unit.pending=true;unit.actionLeft=false;unit.flightState='approach';unit.order={type:'airdrop'};unit.cargo=passengers;
  unit.airdrop={phase:'inbound',baseId:base.id,exit:{x:entry.x,y:entry.y},autoLine:line,refund:0};
  if(this.mode==='turns')this.actions.push({id:unit.id,type:'airdrop',plane:true,route:[]});this.updateVision();this.report(`Reforço aéreo comprado: ${quote.slots}/${this.airCap(owner)} vagas, ${quote.cost} créditos. O avião vai pousar no aeroporto.`,unit);return true;
 }
 // Compra rápida no aeroporto: só com o avião parado na pista dele; sem taxa de voo, com acréscimo no preço da tropa.
 boardPrice(type,owner){return Math.ceil(SPEC(type,this.factionOf(owner)).cost*AIRPORT_SURCHARGE/5)*5;}
 canBoardPurchase(owner,baseId,type){
  const plane=this.airdropPlane(owner),base=this.get(baseId);
  return AIRDROP_TYPES.includes(type)&&!this.winner&&this.sides.includes(owner)&&(this.mode==='rts'||this.turn===owner&&!this.busy)&&AIRPORT(base)&&base.owner===owner&&base.hp>0&&this.structures.includes(base)&&plane?.airdrop?.phase==='parked'&&plane.airportId===base.id&&this.cargoSlots(plane)+AIRDROP_SLOTS(type)<=this.airCap(owner)&&this.credits[owner]>=this.boardPrice(type,owner)&&!this.atUnitCap(owner);
 }
 boardPurchase(owner,baseId,type){
  if(!this.canBoardPurchase(owner,baseId,type))return false;const plane=this.airdropPlane(owner),base=this.get(baseId),price=this.boardPrice(type,owner),p=this.add(owner,type,base.x,base.y);
  this.units=this.units.filter(u=>u!==p);plane.cargo.push(p);this.credits[owner]-=price;this.report(`${SPEC(type,this.factionOf(owner)).name} embarcou no avião: ${this.cargoSlots(plane)}/${this.airCap(owner)} vagas, ${price} créditos.`,plane);return true;
 }
 // Comanda a decolagem do avião estacionado: linha 4–12 casas (mesma regra do bombardeiro).
 airdropLaunch(u,args={}){
  const m=u.airdrop;if(!m||m.phase!=='parked'||!u.cargo?.length||u.hp<=0||this.winner||!this.units.includes(u)||this.mode==='turns'&&(u.owner!==this.turn||this.busy))return false;
  if(!this.bombLine(u.owner,args.start,args.end))return false;
  if(!this.beginAirdropRun(u,{start:{x:args.start.x,y:args.start.y},end:{x:args.end.x,y:args.end.y}}))return false;
  if(this.mode==='turns')this.actions.push({id:u.id,type:'airdrop',plane:true,route:[]});this.updateVision();this.report('Avião de transporte decolando para lançar a carga na linha.',u);return true;
 }
 beginAirdropRun(u,line){
  const m=u.airdrop,base=this.get(u.airportId||m.baseId);if(!base||!u.cargo?.length)return false;
  u.cargo.sort((a,b)=>Number(!!UT(b).vehicle)-Number(!!UT(a).vehicle));
  Object.assign(m,{phase:'run',leg:'toStart',line,index:0,total:u.cargo.length,baseId:base.id,wait:0});
  u.runway={type:'takeoff',phase:'wait',baseId:base.id,level:0,elapsed:0};u.flightState='waitRunway';u.altitude='high';u.pending=true;u.path=[];u.segment=null;u.order={type:'airdrop'};return true;
 }
 stepAirdropPlane(u,dt){
  const m=u.airdrop;if(!m||u.hp<=0)return true;
  if(u.runway){const done=this.stepRunway(u,dt);this.touchVision();this.defendAir();return done;}
  if(m.phase==='parked')return true;
  if(m.phase!=='exit'){const base=this.get(m.baseId);if(!base||base.hp<=0||base.owner!==u.owner||!this.structures.includes(base)){const other=this.airports(u.owner).sort((a,b)=>DIST(u,a)-DIST(u,b)||a.id-b.id)[0];m.baseId=other?.id??null;if(!other)m.phase='exit';}}
  if(m.phase==='exit'){
   const exit=m.exit||{x:0,y:u.y};if(!this.flyToward(u,exit,dt)){this.touchVision();return false;}
   const refund=(m.refund||0)+u.cargo.reduce((n,p)=>n+UT(p).cost,0);u.cargo=[];this.credits[u.owner]+=refund;if(refund)this.report(`Avião sem pista de pouso: ${refund} créditos devolvidos.`,u);
   u.pending=false;this.units=this.units.filter(v=>v!==u);this.touchVision();return true;
  }
  if(m.phase==='inbound'||m.phase==='return'){
   const base=this.get(m.baseId),slot=this.airportSlot(base);
   if(!slot||this.runwayBusy(base)){m.wait=(m.wait||0)+this.orbitPlane(u,dt);if(this.mode==='turns'&&m.wait>=Math.PI*4)m.phase='exit';this.touchVision();return false;}
   base.runwayId=u.id;u.runway={type:'land',phase:'approach',baseId:base.id,slot,level:1,elapsed:0};u.flightState='approach';this.stepRunway(u,dt);this.touchVision();return false;
  }
  const L=m.line;
  if(m.leg==='toStart'){if(this.flyToward(u,L.start,dt)){m.leg='line';u.flightState='attack';}this.touchVision();return false;}
  const dx=L.end.x-L.start.x,dy=L.end.y-L.start.y,len2=dx*dx+dy*dy,finished=this.flyToward(u,L.end,dt),progress=len2>1e-6?((u.x-L.start.x)*dx+(u.y-L.start.y)*dy)/len2:1;
  this.drops||=[];
  while(m.index<m.total&&(finished||progress>=m.index/Math.max(1,m.total-1))){
   const q=m.index/Math.max(1,m.total-1),point=TILE({x:L.start.x+dx*q,y:L.start.y+dy*q}),passenger=u.cargo.shift();m.index++;if(!passenger)break;
   const cell=this.landingCells(passenger.type,point,3)[0];
   if(cell)this.drops.push({...cell,owner:u.owner,passenger,elapsed:0,destination:point});else u.cargo.push(passenger);
  }
  if(finished){m.phase='return';m.wait=0;u.flightState='egress';}
  this.touchVision();return false;
 }
 advanceDrops(dt){
  this.drops||=[];for(const drop of [...this.drops]){drop.elapsed+=dt;if(drop.elapsed+1e-8<2)continue;
   this.drops.splice(this.drops.indexOf(drop),1);const p=drop.passenger;let cell={x:drop.x,y:drop.y};
   if(this.structureAt(cell.x,cell.y)||this.occupied(cell.x,cell.y,null,false)||!Number.isFinite(this.cost(p,cell.x,cell.y))||this.mines.some(m=>m.x===cell.x&&m.y===cell.y))cell=this.landingCells(p.type,drop.destination,3)[0];
   if(!cell){this.credits[drop.owner]+=UT(p).cost;this.report('Área de pouso bloqueada: reforço devolvido.',{...drop,type:p.type});continue;}
   Object.assign(p,cell,{order:{type:'stop'},path:[],pending:false,segment:null});if(this.mode==='turns'){p.actionLeft=false;p.moveLeft=0;}this.units.push(p);this.touchVision();
  }
 }
 snapshot(){
  const state={};for(const [key,value]of Object.entries(this))if(typeof value!=='function'&&!key.startsWith('_'))state[key]=value;
  return JSON.parse(JSON.stringify({version:1,rngState:this.rng.state?.()??this.seed,state},(key,value)=>value instanceof Map?{mapEntries:[...value]}:value instanceof Set?{setEntries:[...value]}:value));
 }
 static fromSnapshot(value){
  if(value?.version!==1||!value.state||!['rts','turns'].includes(value.state.mode)||!Object.hasOwn(MAPS,value.state.map))throw Error('Save de batalha inválido.');
  const safe=v=>{if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return true;if(Array.isArray(v))return v.every(safe);return !!v&&typeof v==='object'&&Object.entries(v).every(([k,x])=>!['__proto__','constructor','prototype'].includes(k)&&safe(x));};
  if(!safe(value))throw Error('Save de batalha inválido.');const s=value.state;if(!Array.isArray(s.units)||!Array.isArray(s.structures)||!Array.isArray(s.terrain)||s.terrain.length!==SIZE||s.terrain.some(t=>!Object.hasOwn(TERRAIN,t)))throw Error('Mapa inválido.');
  const ids=new Set(),entity=u=>{if(!u||!Object.hasOwn(TYPES,u.type)||!['blue','red','neutral'].includes(u.owner)||!Number.isInteger(u.id)||u.id<1||ids.has(u.id)||!Number.isFinite(u.x)||!Number.isFinite(u.y)||u.x<0||u.x>COLS-1||u.y<0||u.y>ROWS-1||!Number.isFinite(u.hp)||u.hp<=0||!Number.isFinite(u.maxHp)||u.hp>u.maxHp)throw Error('Unidade inválida.');ids.add(u.id);for(const p of u.cargo||u.airdrop?.cargo||[])entity(p);};
  for(const u of [...s.units,...s.structures])entity(u);for(const d of s.drops||[])entity(d.passenger);
  if(!Number.isInteger(s.nextId)||s.nextId<=Math.max(0,...ids)||!['blue','red'].includes(s.turn)||!s.credits||!['blue','red'].every(o=>Number.isFinite(s.credits[o])&&s.credits[o]>=0))throw Error('Estado inválido.');
  for(const k of ['visible','sky','explored'])if(!s[k]||!['blue','red'].every(o=>Array.isArray(s[k][o])&&s[k][o].length===SIZE))throw Error('Visão inválida.');
  const decoded=JSON.parse(JSON.stringify(s),(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===1&&Array.isArray(v.mapEntries)?new Map(v.mapEntries):v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===1&&Array.isArray(v.setEntries)?new Set(v.setEntries):v);
  const game=Object.create(Game.prototype);for(const [key,data]of Object.entries(decoded)){if(key in Game.prototype)throw Error('Campo de save inválido.');game[key]=data;}
  game.multiplayer=false;game.networkClient=false;game.drops||=[];for(const u of game.units){if(UT(u).capacity)u.cargo||=[];if(atMax(u))u.atMissiles??=atMax(u);if(UT(u).missiles)u.missiles??=UT(u).missiles;if(u.type==='heavyTank')u.trophy??=trophyMax(u);if(u.type!=='rocketArtillery'&&BARRAGE(u))u.salvos??=HELI_SALVOS;}
  for(const u of game.units)if(UT(u).airdropPlane&&u.airdrop){const m=u.airdrop;if(m.cargo){u.cargo=m.cargo;delete m.cargo;}if(m.phase==='approach'){m.phase='run';m.leg='toStart';m.line={start:{...m.destination},end:{...m.destination}};m.index=0;m.total=u.cargo.length;}else if(m.phase==='exit'&&m.baseId===undefined)m.phase='return';}
  if(game.mission&&(typeof Missions==='undefined'||!Missions.validate(game.mission,game)))throw Error('Estado de missão inválido.');
  game.rng=seeded(game.seed);game.rng.restore(value.rngState);game.updateVision();return game;
 }
 canRecruit(owner,type,base){const t=SPEC(type,this.factionOf(owner));return this.producer(owner,base)&&!!t?.cost&&(AIRPORT(base)?this.planeCatalog(owner).includes(type):!t.plane);}

 add(owner,type,x,y){
  const t=SPEC(type,this.factionOf(owner));if(!t||!INSIDE(x,y)||![...this.sides,'neutral'].includes(owner))return null;
  const u={id:this.nextId++,owner,faction:this.factionOf(owner),type,x,y,facing:owner==='blue'?0:Math.PI,hp:t.hp,maxHp:t.hp,level:1,xp:0,cooldown:0,setup:0,packing:0,idle:0,entrenched:false,suppressed:0,revealed:0,work:0,reserved:0,order:{type:'stop'},path:[],segment:null,navGoal:null,healText:0,moveLeft:t.move||0,actionLeft:!t.structure,moved:false,pending:false};
  u.hp=u.maxHp=this.baseHp(owner,type);if(t.width){u.width=t.width;u.height=t.height;}if(t.plane){u.ammo={...t.ammo};u.flightState='patrol';u.patrol={x:Math.max(4,Math.min(COLS-5,x-4)),y:Math.max(4,Math.min(ROWS-5,y)),angle:0};u.salvo=1;}if(t.drone){u.flightState='patrol';u.patrol={x:Math.max(4,Math.min(COLS-5,x-4)),y:Math.max(4,Math.min(ROWS-5,y)),angle:0};}if(t.structure)u.queue=[];if(t.air){if(!t.unarmed)u.weaponMode='auto';u.altitude=t.drone||t.plane?'high':'low';u.flares=t.drone?0:(t.flares??3);u.flareCooldown=0;u.flareUsed=false;}if(t.missiles)u.missiles=t.missiles;if(t.stealth)u.spotted=Object.fromEntries(this.sides.map(s=>[s,false]));if(atMax(u))u.atMissiles=atMax(u);if(type==='heavyTank')u.trophy=trophyMax(u);if(type!=='rocketArtillery'&&BARRAGE(u))u.salvos=HELI_SALVOS;if(type==='antiAirVehicle'){u.radarOn=true;u.smokeCharges=2;u.smokeCooldown=0;u.smokeTime=0;u.smokeUsed=false;u.reactionReady=true;}(t.structure?this.structures:this.units).push(u);if(type==='antiAirVehicle')this.updateRadarContacts();return u;
 }
  generate(){
  const o=this.options,rng=this.rng,mid=COLS/2,T=this.terrain,seed=this.seed,three=this.sides.length>2;
  const P=this.map==='random'?{relief:o.relief,ridge:Math.max(0,o.relief-.55)*2.2,water:o.water,forest:o.forest,farmland:o.farmland,hedges:.8}:MAP_PROFILES[this.map];
  // Mapa simétrico por ponto: decide meia malha e espelha (justiça e a IA presume o QG azul pelo espelho).
  const mirror=c=>({...c,x:COLS-(c.width||1)-c.x,y:ROWS-(c.height||1)-c.y}),half=(x,y)=>KEY(x,y)<=KEY(COLS-1-x,ROWS-1-y),at=(x,y)=>T[KEY(x,y)],set=(x,y,t)=>{T[KEY(x,y)]=T[KEY(COLS-1-x,ROWS-1-y)]=t;};
  const each=fn=>{for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(half(x,y))fn(x,y);};
  // Hash determinístico por semente (sem consumir o RNG): decide lotes e porteiras.
  const hash=(a,b)=>{let n=(seed^Math.imul(a+7,0x9e3779b1)^Math.imul(b+3,0x85ebca6b))>>>0;n=Math.imul(n^(n>>>15),0x2c1b3c6d)>>>0;return((n^(n>>>13))>>>0)/4294967296;};
  // Ruído de valor: grade grossa sorteada e interpolada, para manchas e contornos naturais.
  const noise=scale=>{const w=Math.ceil(COLS/scale)+2,h=Math.ceil(ROWS/scale)+2,g=Array.from({length:w*h},rng),s=t=>t*t*(3-2*t);return(x,y)=>{const fx=x/scale,fy=y/scale,ix=Math.floor(fx),iy=Math.floor(fy),tx=s(fx-ix),ty=s(fy-iy),v=(a,b)=>g[(iy+b)*w+ix+a];return(v(0,0)*(1-tx)+v(1,0)*tx)*(1-ty)+(v(0,1)*(1-tx)+v(1,1)*tx)*ty;};};
  const height=noise(6),moisture=noise(5),flow=noise(8),wobble=noise(4);
  // Limiar por quantil: a fração pedida da meia malha recebe o terreno.
  const cut=(f,frac)=>{const v=[];each((x,y)=>v.push(f(x,y)));v.sort((p,q)=>p-q);return v[v.length-1-Math.floor(frac*v.length)];};
  // Relevo e água (etapas 1 e 2): cada paisagem tem a sua; Continente é o gerador original.
  const continent=()=>{
  // 1. Relevo: colinas em manchas; picos de serra raros; no Passe, uma serra central com três passagens.
  const hills=cut(height,.32*P.relief),peaks=cut(height,.06*P.ridge);
  each((x,y)=>set(x,y,P.ridge&&!P.pass&&height(x,y)>peaks?'mountain':height(x,y)>hills?'hill':'plain'));
  if(P.pass){
   each((x,y)=>{const c=mid-.5+(wobble(x,y)-.5)*3+(y-ROWS/2)*.15;if(Math.abs(x-c)<=1.6)set(x,y,'mountain');else if(Math.abs(x-c)<=3.2&&at(x,y)==='plain'&&height(x,y)>.45)set(x,y,'hill');});
   for(const row of [Math.round(ROWS*.22),ROWS/2-1])for(let x=0;x<COLS;x++)for(const y of [row,row+1])if(at(x,y)==='mountain')set(x,y,'hill');
  }
  // 2. Água: rio central contínuo (Vale dos Rios) ou rios de borda a borda; lagos pelo ruído de fluxo.
  const wet=(x,y)=>{if(INSIDE(x,y)&&at(x,y)!=='mountain')set(x,y,'river');};
  if(P.centralRiver){
   let x=mid-1;for(let y=ROWS/2-1;y>=0;y--){wet(x,y);wet(x+1,y);const r=rng(),nx=Math.max(mid-6,Math.min(mid+4,x+(r<.32?-1:r>.68?1:0)));if(nx!==x){wet(nx,y);wet(nx+1,y);}x=nx;if(y===Math.round(ROWS*.3))for(let dx=-1;dx<=2;dx++)for(let dy=-1;dy<=1;dy++)wet(x+dx,y+dy);}
  }else for(let i=0;i<Math.round(P.water*2.2);i++){
   let x=5+Math.floor(rng()*(COLS-12));const wide=P.water>.6;
   for(let y=0;y<ROWS;y++){wet(x,y);if(wide)wet(x+1,y);const r=rng(),nx=Math.max(4,Math.min(COLS-6,x+(r<.3?-1:r>.7?1:0)));if(nx!==x){wet(nx,y);if(wide)wet(nx+1,y);}x=nx;}
  }
  const lakes=cut(flow,.035*P.water);each((x,y)=>{if(flow(x,y)>lakes&&at(x,y)!=='mountain')set(x,y,'river');});
  };
  ({continent,lakes:continent,islands:continent,highlands:continent})[this.landscape]();
  // 3. Florestas em manchas pela umidade, só em planície.
  const woods=cut(moisture,.3*P.forest);each((x,y)=>{if(at(x,y)==='plain'&&moisture(x,y)>woods)set(x,y,'forest');});
  // 4. Campos e sebes: lotes entre linhas espelhadas; lote cultivado vira campo e suas bordas viram sebes com porteiras.
  if(P.farmland>0){
   const lines=(n,min,max)=>{const out=[];for(let v=1+Math.floor(rng()*3);v<n/2-1;v+=min+Math.floor(rng()*(max-min+1)))out.push(v,n-1-v);return new Set(out);};
   const xs=lines(COLS,4,6),ys=lines(ROWS,3,5),count=(set,v)=>[...set].filter(l=>l<=v).length;
   const lot=(x,y)=>{const a=count(xs,x),b=count(ys,y),ma=xs.size-a,mb=ys.size-b;return a<ma||a===ma&&b<=mb?[a,b]:[ma,mb];};
   const farmed=(x,y)=>{const [a,b]=lot(x,y);return hash(a*31+5,b*17+11)<P.farmland;};
   // Deserto: só cultivo irrigado, a até 3 casas de água (oásis).
   const irrigated=(x,y)=>{for(let dy=-3;dy<=3;dy++)for(let dx=-3+Math.abs(dy);dx<=3-Math.abs(dy);dx++)if(INSIDE(x+dx,y+dy)&&at(x+dx,y+dy)==='river')return true;return false;};
   each((x,y)=>{if(at(x,y)==='plain'&&!xs.has(x)&&!ys.has(y)&&farmed(x,y)&&(!P.irrigated||irrigated(x,y)))set(x,y,'field');});
   // Bocage: um lote cultivado é cercado (chance pelo perfil); sebes contínuas com porteiras ocasionais e cantos fechados.
   const hedged=(x,y)=>{const [a,b]=lot(x,y);return hash(a*13+3,b*7+1)<P.hedges;};
   if(P.hedges>0){
    each((x,y)=>{if(at(x,y)!=='plain'||!(xs.has(x)||ys.has(y)))return;if(hash(x,y)>.1&&DIRS.some(([dx,dy])=>INSIDE(x+dx,y+dy)&&at(x+dx,y+dy)==='field'&&hedged(x+dx,y+dy)))set(x,y,'hedge');});
    each((x,y)=>{if(at(x,y)!=='plain'||!xs.has(x)||!ys.has(y))return;const h=(dx,dy)=>INSIDE(x+dx,y+dy)&&at(x+dx,y+dy)==='hedge';if((h(1,0)||h(-1,0))&&(h(0,1)||h(0,-1)))set(x,y,'hedge');});
   }
  }
  // 5. Base: área inicial limpa; saída da estrada ao lado do QG.
  for(let y=ROWS-5;y<ROWS;y++)for(let x=0;x<6;x++)set(x,y,'plain');
  // Três lados: a base verde ocupa o canto inferior direito, espelhada só em X (o mapa continua simétrico para azul e vermelho).
  if(three)for(let y=ROWS-5;y<ROWS;y++)for(let x=COLS-6;x<COLS;x++)set(x,y,'plain');
  const exit={x:4,y:ROWS-3},exit3={x:COLS-5,y:ROWS-3};
  // Casas ligadas à saída sem atravessar serra (rios viram pontes nas estradas).
  const reach=new Uint8Array(SIZE),queue=[KEY(exit.x,exit.y)];reach[queue[0]]=1;
  while(queue.length){const k=queue.pop(),px=k%COLS,py=(k-px)/COLS;for(const [dx,dy]of DIRS){const x=px+dx,y=py+dy,n=KEY(x,y);if(INSIDE(x,y)&&!reach[n]&&at(x,y)!=='mountain'){reach[n]=1;queue.push(n);}}}
  // 6. Postos em pontos estratégicos: colinas, cabeceiras de rio e o meio do mapa; espaçados e longe dos QGs.
  const home={x:1,y:ROWS-4,width:3,height:3},greenHome={x:COLS-4,y:ROWS-4,width:3,height:3},hqs=[home,mirror(home),...(three?[greenHome]:[])],placed=[],nearWater=(x,y)=>[[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]].some(([dx,dy])=>INSIDE(x+dx,y+dy)&&at(x+dx,y+dy)==='river');
  const candidates=[];each((x,y)=>{const p={x,y,width:2,height:2},pair=[p,mirror(p)];if(x<2||y<1||pair.some(c=>!INSIDE(c.x+c.width-1,c.y+c.height-1)||hqs.some(h=>DIST(h,c)<8)))return;
   for(const c of pair)for(let yy=c.y;yy<c.y+c.height;yy++)for(let xx=c.x;xx<c.x+c.width;xx++)if(!reach[KEY(xx,yy)]||['river','mountain'].includes(at(xx,yy)))return;
   const balance=Math.abs(DIST(p,hqs[0])-DIST(p,hqs[1]));const corner=Math.min(Math.hypot(x,y),Math.hypot(COLS-1-x,ROWS-1-y));candidates.push({...p,score:rng()*1.6+.9*Math.max(0,1-corner/12)+(at(x,y)==='hill'?.35:0)+(nearWater(x,y)?.35:0)+.25*(1-balance/40)});});
  candidates.sort((a,b)=>b.score-a.score);
  for(let space=6;space>=2&&placed.length<o.posts/2;space--)for(const c of candidates){if(placed.length>=o.posts/2)break;if([...placed,...placed.map(mirror)].some(p=>DIST(p,c)<space)||DIST(c,mirror(c))<space)continue;placed.push(c);}
  // 7. Estradas: A* com custo de obra (planície barata, colina e floresta caras, rio vira ponte, serra proibida).
  const build={road:.3,bridge:.3,plain:1,field:1.1,hedge:1.4,hill:2.4,forest:3,river:4.5};
  const reserved=new Uint8Array(SIZE);for(const s of [...hqs,...placed,...placed.map(mirror)])for(let y=s.y;y<s.y+s.height;y++)for(let x=s.x;x<s.x+s.width;x++)reserved[KEY(x,y)]=1;
  // Se uma serra isolar os pontos, a segunda tentativa abre uma passagem por ela.
  const carve=(a,b)=>{
   for(const mountain of [undefined,8]){
    const step={...build,mountain},cost=new Float64Array(SIZE).fill(Infinity),from=new Int32Array(SIZE).fill(-1),start=KEY(a.x,a.y),end=KEY(b.x,b.y),open=[[DIST(a,b),start]];cost[start]=0;
    while(open.length){let i=0;for(let j=1;j<open.length;j++)if(open[j][0]<open[i][0])i=j;const [,k]=open.splice(i,1)[0];if(k===end)break;const px=k%COLS,py=(k-px)/COLS;
     for(const [dx,dy]of DIRS){const x=px+dx,y=py+dy;if(!INSIDE(x,y))continue;const n=KEY(x,y),w=step[at(x,y)];if(reserved[n]||w===undefined)continue;const c=cost[k]+w;if(c<cost[n]){cost[n]=c;from[n]=k;open.push([c+DIST({x,y},b)*.3,n]);}}}
    if(end!==start&&from[end]<0)continue;
    for(let k=end;k>=0;k=from[k]){const x=k%COLS,y=(k-x)/COLS;set(x,y,['river','bridge'].includes(at(x,y))?'bridge':'road');}return;
   }
  };
  const center=[...Array(SIZE).keys()].filter(k=>reach[k]&&!reserved[k]&&!['river','mountain'].includes(T[k])).map(k=>({x:k%COLS,y:(k-k%COLS)/COLS})).sort((p,q)=>Math.hypot(p.x-mid+.5,p.y-ROWS/2+.5)-Math.hypot(q.x-mid+.5,q.y-ROWS/2+.5))[0]||{x:mid-1,y:ROWS/2-1};
  carve(exit,center);carve(center,mirror(center));if(three)carve(exit3,center);
  const nodes=[exit,mirror(exit),center,mirror(center),...(three?[exit3,mirror(exit3)]:[])];
  // Vale dos Rios: travessia reta extra (e o espelho), com ponte, ligada à malha pelas pontas.
  if(P.centralRiver){const y=Math.round(ROWS*.2),ends=[{x:mid-8,y},{x:mid+7,y}];for(let x=ends[0].x;x<=ends[1].x;x++)set(x,y,['river','bridge'].includes(at(x,y))?'bridge':'road');
   for(const e of ends){carve(e,nodes.slice().sort((m,n)=>DIST(m,e)-DIST(n,e))[0]);nodes.push(e,mirror(e));}}
  for(const p of placed){const access={x:p.x-1,y:p.y},q=nodes.slice().sort((m,n)=>DIST(m,access)-DIST(n,access))[0];carve(access,q);nodes.push(access,mirror(access));}
  // Complexos neutros com acesso pela borda, sem estrada atravessando os prédios.
  for(const p of placed)for(const c of [p,mirror(p)]){for(let y=c.y;y<c.y+c.height;y++)for(let x=c.x;x<c.x+c.width;x++)T[KEY(x,y)]='plain';this.add('neutral','post',c.x,c.y);}
  // 8. Tropas iniciais.
  for(const [type,p]of [['hq',home],['commander',{x:4,y:ROWS-3}]]){const q=mirror(p);this.add('blue',type,p.x,p.y);this.add('red',type,q.x,q.y);}
  if(three)for(const [type,p]of [['hq',greenHome],['commander',exit3]])this.add('green',type,p.x,p.y);
  // ponytail: com três lados não há aeroportos neutros (cairiam colados à base verde) e os postos não são balanceados para ela; ajustar se a partida pedir.
  if(!three)this.generateAirports(carve,nodes);
  // 9. Minas no centro, fora de água, serra, ponte e estruturas.
  const mineRandom=this.mineRng||rng;for(let placedMines=0,tries=0;placedMines<4&&tries<200;tries++){const x=mid-6+Math.floor(mineRandom()*12),y=Math.floor(ROWS/2)-5+Math.floor(mineRandom()*10),cells=[[x,y],[COLS-1-x,ROWS-1-y]];
   if(cells.some(([cx,cy])=>['river','mountain','bridge'].includes(at(cx,cy))||this.structureAt(cx,cy)||this.mines.some(m=>m.x===cx&&m.y===cy))||x===COLS-1-x&&y===ROWS-1-y)continue;
   for(const [cx,cy]of cells)this.mines.push({x:cx,y:cy,known:Object.fromEntries(this.sides.map(s=>[s,false]))});placedMines++;}
  for(const owner of this.sides){const positions=[];for(let y=ROWS-5;y<ROWS;y++)for(let x=0;x<6;x++)positions.push({x,y});positions.sort((a,b)=>(a.y-ROWS+5)%2-(b.y-ROWS+5)%2||a.y-b.y||Math.abs(a.x-1)-Math.abs(b.x-1)||a.x-b.x);
   for(let y=ROWS-7;y<ROWS;y++)for(let x=0;x<8;x++)if(y<ROWS-5||x>=6)positions.push({x,y});
   for(const type of startingCatalog(this.factionOf(owner)))for(let n=0;n<(this.initialArmies[owner][type]||0);n++){const cell=positions.map(p=>owner==='blue'?p:owner==='green'?{x:COLS-1-p.x,y:p.y}:mirror(p)).find(p=>!this.structureAt(p.x,p.y)&&!this.units.some(u=>u.owner===owner&&u.x===p.x&&u.y===p.y));if(!cell)throw Error('Initial army has no deployment space');if(['river','mountain'].includes(at(cell.x,cell.y)))set(cell.x,cell.y,'plain');const unit=this.add(owner,type,cell.x,cell.y);if(PLANE(unit))this.setPatrol(unit);}
  }
 }

 log(text,audiences){this.logs.unshift({time:this.mode==='rts'?this.time:this.round,text,...(this.multiplayer?{audiences:audiences||['blue']}:{})});if(this.logs.length>70)this.logs.pop();}
 report(text,...units){const audiences=this.sides.filter(owner=>units.some(u=>u.owner===owner||this.isVisible(owner,u)));if(this.multiplayer){if(audiences.length)this.log(text,audiences);}else if(audiences.includes('blue'))this.log(text);}
 reportDamage(p,target,amount){const source=this.get(p.attackerId);for(const owner of this.multiplayer?this.sides:['blue'])if(target.owner===owner||this.isVisible(owner,target)){const name=p.owner===target.owner?'Fogo amigo':p.owner===owner||source&&this.isVisible(owner,source)?UT(p).name:'Ataque não identificado';this.log(`${name}: ${UT(target).name} −${amount}.`,[owner]);}}
 event(kind,u,extra={}){const p=UT(u)?.structure?CENTER(u):u;this.events.push({kind,id:u.id,x:p.x,y:p.y,flightLevel:AIR(u)?flightLevel(u):0,air:AIR(u),contactId:AIR(u)?u.id:undefined,visible:u.owner==='blue'||this.isVisible('blue',u),...(kind==='shot'?{sourceType:u.type,facing:u.facing}:{}),...extra,...(this.multiplayer?{seq:this.nextEventSeq=(this.nextEventSeq||0)+1,audiences:this.sides.filter(owner=>u.owner===owner||this.isVisible(owner,u)||!!u.spotted?.[owner]||extra.publicMissile===true)}:{})});if(this.events.length>250)this.events.shift();}
  structureAt(x,y){return this.structures.find(s=>s.hp>0&&x>=s.x&&x<s.x+(s.width||1)&&y>=s.y&&y<s.y+(s.height||1));}
 terrainAt(u){const p=TILE(u);return this.terrain[KEY(p.x,p.y)];}
 cost(u,x,y){if(!INSIDE(x,y))return Infinity;if(AIR(u))return 1;const t=this.terrain[KEY(x,y)];if(t==='river'||t==='mountain'&&u.type!=='infantry')return Infinity;if(t==='road')return .5;const vehicle=UT(u).vehicle;return t==='forest'&&vehicle?2:(t==='hill'||t==='hedge')&&vehicle?1.5:1;}
 moveDirections(u){return AIR(u)&&!PLANE(u)?AIR_DIRS:DIRS;}
 travelDistance(u,a,b){const dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y);return AIR(u)&&!PLANE(u)?Math.max(dx,dy)+(Math.SQRT2-1)*Math.min(dx,dy):dx+dy;}
 stepCost(u,from,to){return this.cost(u,to.x,to.y)*(AIR(u)&&!PLANE(u)?Math.hypot(to.x-from.x,to.y-from.y)/(heliHigh(u)?HELI_HIGH:1):1);}
 // Ocupação e reservas por camada: aeronaves só disputam casa com aeronaves; solo, com solo.
 occupied(x,y,except,air=AIR(except)){return this.units.find(u=>u!==except&&u.hp>0&&!(FLYER(u)&&AIR(u))&&AIR(u)===air&&(DIST(TILE(u),{x,y})===0||u.segment&&(DIST(u.segment.from,{x,y})===0||DIST(u.segment.to,{x,y})===0)));}
 /* Grades por casa: guardam a primeira unidade/estrutura de cada casa, igual às buscas lineares, numa só varredura. */
 unitGrid(except,skipMoving=false){
  const grid=Array(SIZE).fill(null),air=AIR(except),mark=(x,y,v)=>{if(INSIDE(x,y)&&!grid[KEY(x,y)])grid[KEY(x,y)]=v;};
  for(const v of this.units)if(v!==except&&v.hp>0&&!(FLYER(v)&&AIR(v))&&AIR(v)===air&&!(skipMoving&&v.owner===except.owner&&(v.segment||v.job?.route?.length))){mark(Math.round(v.x),Math.round(v.y),v);if(v.segment){mark(v.segment.from.x,v.segment.from.y,v);mark(v.segment.to.x,v.segment.to.y,v);}}
  return grid;
 }
 structureGrid(observer){const grid=Array(SIZE).fill(null),known=observer?.owner==='red'&&!this.multiplayer,list=known?[...this.structures.filter(s=>s.owner==='red'||this.isVisible('red',s)),...this.memory.red.values()]:this.structures;for(const s of list)if(s.hp===undefined||s.hp>0)for(let y=s.y;y<s.y+(s.height||1);y++)for(let x=s.x;x<s.x+(s.width||1);x++)if(INSIDE(x,y)&&!grid[KEY(x,y)])grid[KEY(x,y)]=s;return grid;}
 passable(u,x,y,avoidUnits,units,structures){
  const k=KEY(x,y),s=structures[k];if(!AIR(u)&&(s?.type==='hq'||s?.width))return false;
  const blocker=units[k],known=blocker&&(blocker.owner===u.owner||this.isVisible(u.owner,blocker));return !(known&&(avoidUnits||blocker.owner!==u.owner));
 }
 /* Casas que findPath(u, casa) alcança: o A* é completo, então equivale a uma inundação com as mesmas regras. */
 reachable(u,units=this.unitGrid(u),structures=this.structureGrid(u),avoidUnits=false){
  const start=TILE(u),seen=new Uint8Array(SIZE),queue=new Int16Array(SIZE);let head=0,tail=0;seen[queue[tail++]=KEY(start.x,start.y)]=1;
  while(head<tail){const k=queue[head++],px=k%COLS,py=(k-px)/COLS;for(const [dx,dy]of this.moveDirections(u)){
   const x=px+dx,y=py+dy;if(x<0||y<0||x>=COLS||y>=ROWS)continue;const key=KEY(x,y);
   if(seen[key]||!this.passable(u,x,y,avoidUnits,units,structures)||!Number.isFinite(this.cost(u,x,y)))continue;seen[key]=1;queue[tail++]=key;
  }}return seen;
 }
 /* A* ponderado: heurística admissível (menor custo = 0,5), vizinhos conforme a camada. Heap ordenado por (f, g, inserção) = mesma ordem da antiga lista ordenada estável. */
 findPath(u,goal,avoidUnits=false,units=this.unitGrid(u),structures=this.structureGrid(u),near=null,min=0){
  const start=TILE(u);if(near===null&&(!INSIDE(goal.x,goal.y)||!Number.isFinite(this.cost(u,goal.x,goal.y))||!this.passable(u,goal.x,goal.y,avoidUnits,units,structures)))return null;
  // Batedor: menor número de casas; o custo do terreno só desempata rotas do mesmo tamanho. Demais tropas: rota mais rápida.
  const shortest=u.type==='recon',step=shortest?(from,to)=>1+this.cost(u,to.x,to.y)*1e-3:(from,to)=>this.stepCost(u,from,to),h=shortest?1:AIR(u)?(heliHigh(u)?1/HELI_HIGH:1):.5;
  const diagonal=AIR(u)&&!PLANE(u),estimate=p=>(near===null?this.travelDistance(u,p,goal):Math.max(0,DIST(p,goal)-near)*(diagonal?Math.SQRT1_2:1))*h;
  const root=KEY(start.x,start.y),end=KEY(goal.x,goal.y),costs=new Float64Array(SIZE).fill(Infinity),parents=new Int16Array(SIZE),heap=[];let seq=0;costs[root]=0;
  const before=(a,b)=>a.f<b.f||a.f===b.f&&(a.g<b.g||a.g===b.g&&a.s<b.s);
  const push=n=>{heap.push(n);let i=heap.length-1;while(i){const up=(i-1)>>1;if(!before(heap[i],heap[up]))break;[heap[i],heap[up]]=[heap[up],heap[i]];i=up;}};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<heap.length&&before(heap[l],heap[m]))m=l;if(r<heap.length&&before(heap[r],heap[m]))m=r;if(m===i)break;[heap[i],heap[m]]=[heap[m],heap[i]];i=m;}}return top;};
  push({x:start.x,y:start.y,f:estimate(start),g:0,s:seq++});
  while(heap.length){
   const p=pop(),k=KEY(p.x,p.y);if(p.g!==costs[k])continue;
   if(near===null?k===end:DIST(p,goal)<=near&&DIST(p,goal)>=min){const path=[];let key=k;while(key!==root){path.unshift({x:key%COLS,y:Math.floor(key/COLS)});key=parents[key];}return path;}
   for(const [dx,dy]of this.moveDirections(u)){
    const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=COLS||y>=ROWS||!this.passable(u,x,y,avoidUnits,units,structures))continue;
    const g=p.g+step(p,{x,y}),key=KEY(x,y);if(!Number.isFinite(g)||g>=costs[key])continue;
    costs[key]=g;parents[key]=k;push({x,y,g,f:g+estimate({x,y}),s:seq++});
   }
  }return null;
 }
 radarContact(owner,u){return !!u&&AIR(u)&&u.hp>0&&u.owner!==owner&&!!this.radarContacts[owner]?.has(u.id);}
 // Rede de sensores (FCAS em voo): revela furtivos inimigos (drone e avião) a até SENSOR_NET casas.
 updateRadarContacts(){for(const owner of this.sides){const contacts=this.radarContacts[owner],nets=this.units.filter(f=>f.owner===owner&&f.hp>0&&UT(f).sensorNet&&AIR(f)&&f.radarOn!==false);contacts.clear();for(const u of this.units)if(u.hp>0&&u.owner!==owner&&(this.radarCoverage(owner,u)||nets.length&&AIR(u)&&(UT(u).stealth||UT(u).radarStealth)&&nets.some(f=>DIST(f,u)<=SENSOR_NET)))contacts.add(u.id);}}
 setRadar(u,on){if(!u||!(u.type==='antiAirVehicle'||PLANE(u)&&UT(u).radar)||u.hp<=0||!this.units.includes(u)||typeof on!=='boolean')return false;u.radarOn=on;this.updateVision();return true;}
 isVisible(owner,u){if(PLANE(u)&&u.flightState==='offmap')return false;if(UT(u)?.structure||u?.width){for(let y=u.y;y<u.y+(u.height||1);y++)for(let x=u.x;x<u.x+(u.width||1);x++)if(this.visible[owner]?.[KEY(x,y)])return true;return false;}if(!u||!this.visible[owner])return false;if(u.spotted){const p=TILE(u);return u.hp>0&&(u.owner===owner||!!this.sky[owner][KEY(p.x,p.y)]||this.radarContact(owner,u));}const p=TILE(u);return this.radarContact(owner,u)||!!(AIR(u)?this.sky:this.visible)[owner][KEY(p.x,p.y)];}
 effectVisible(x,y,air=false,contactId,sourceId){const owner=this.playerSide||'blue',p=TILE({x,y});if(!INSIDE(p.x,p.y))return false;if((air?this.sky:this.visible)[owner][KEY(p.x,p.y)])return true;if(air)for(const id of [contactId,sourceId]){if(id===undefined)continue;const u=this.get(id);if(this.radarContact(owner,u)&&Math.hypot(x-u.x,y-u.y)<=2)return true;}return false;}
 // Alcance contra um alvo; sem alvo, o maior alcance do modo de arma atual.
 weaponStats(u,w){if(PLANE(u))return this.planeWeapon(u,w);const t=UT(u);if(w==='gun')return t.gun||WEAPONS[w];if(w==='rocket'&&t.barrage)return {...WEAPONS.rocket,damage:t.barrage.damage};return t.arms?.[w]||WEAPONS[w];}
 weaponRange(u,w,altitude=u.altitude){if(!UT(u).weapons?.includes(w))return 0;const s=this.weaponStats(u,w);return !PLANE(u)&&altitude==='high'&&w!=='gun'&&w!=='stealthMissile'?s.highRange??s.range+5:s.range;}
 range(u,target,altitude=u.altitude){const t=UT(u);if(target&&!this.weapon(u,target)||t.unarmed)return 0;if(u.type==='rocketArtillery'||u.type==='antiAirVehicle')return t.range;const w=target?this.weapon(u,target):u.atMissiles>0?'atMissile':u.type==='antitank'?'rifle':null;if(u.type==='missileInfantry'&&w!=='rifle')return t.range;if(!t.air){const reach=(GROUND_WEAPONS.has(w)?this.weaponStats(u,w).range:t.range)+({mountain:2,hill:1}[this.terrainAt(u)]||0);return w==='atMissile'&&u.type==='antitank'&&target?.type==='heavyTank'&&target.trophy>0&&!UT(target).galix&&u.owner==='red'&&!this.multiplayer?Math.min(reach,TROPHY_RANGE):reach;}if(target)return this.weaponRange(u,w,altitude);const mode=u.weaponMode||'auto';return mode==='auto'?Math.max(...t.weapons.map(w=>this.weaponRange(u,w,altitude))):this.weaponRange(u,mode,altitude);}
 sight(u){if(UT(u).airdropPlane)return AIR(u)?UT(u).vision:0;if(PLANE(u))return AIR(u)?12:0;return AIR(u)&&!UT(u).drone&&u.altitude==='high'?15:UT(u).vision+(!AIR(u)&&['mountain','hill'].includes(this.terrainAt(u))?2:0);}
 /* Arma de a contra b, ou null se incompatível. Solo: a própria tropa (só infantaria e metralhador alcançam aeronaves).
    Helicóptero: arma manual se compatível; Auto prefere o míssil contra veículo/estrutura (ar-terra) ou aeronave (ar-ar). */
 // Minigun/canhão dos helicópteros também atingem blindados; armas comuns continuam bloqueadas.
 weapon(a,b){if(a.missionRole==='informant')return null;const w=this.pickWeapon(a,b);if(a.type==='lightTank'&&b.type==='heavyTank'&&w!=='atMissile')return null;return w&&ARMORED.has(b.type)&&(w==='rifle'||!BREAKERS.has(a.type))&&w!=='atMissile'&&w!=='agm'&&w!=='jetAgm'&&!(w==='gun'&&UT(a).gun)?null:w;}
 helicopterWeaponFits(a,w,b){return UT(a).weapons.includes(w)&&(w!=='agm'||a.missiles===undefined||a.missiles>0)&&(PLANE(b)?w==='aam'&&AIR(b):w==='gun'||(w==='agm')!==AIR(b));}
 pickWeapon(a,b){
  const t=UT(a),air=AIR(b);if(t.plane){const mode=a.weaponMode||'auto';return mode==='auto'?t.weapons.find(w=>this.planeWeaponFits(a,w,b))||null:this.planeWeaponFits(a,mode,b)?mode:null;}if(t.unarmed||a.type==='rocketArtillery')return null;if(t.stealth)return a.missiles>0?'stealthMissile':null;if(atMax(a)&&!air&&(UT(b).vehicle||UT(b).structure)&&a.atMissiles>0)return 'atMissile';if(a.type==='antiAirVehicle')return air?a.type:null;if(a.type==='missileInfantry')return air?a.type:t.rifle&&FOOT(b)?'rifle':null;if(a.type==='antitank')return air?null:'rifle';if(!t.air)return air&&(PLANE(b)||a.type!=='infantry'&&a.type!=='machinegun')?null:a.type;
  const fits=w=>this.helicopterWeaponFits(a,w,b),mode=a.weaponMode||'auto';if(mode!=='auto')return fits(mode)?mode:null;
  const missile=t.weapons.find(w=>w!=='gun');return missile&&fits(missile)&&(air||UT(b).vehicle||UT(b).structure)?missile:fits('gun')?'gun':null;
 }
 setWeapon(u,mode){if(!u||!UT(u)?.weapons?.length||!['auto',...UT(u).weapons].includes(mode))return false;u.weaponMode=mode;return true;}
 // Visão agrupada: no RTS vários movimentos por tick apenas marcam a visão como suja e flushVision a refaz uma vez; por turnos segue imediata.
 touchVision(){this.visionDirty=true;if(this.mode==='turns')this.flushVision();}
 // No multiplayer RTS a visão só é refeita no relógio de 0,1 s (o mesmo ritmo do estado enviado): cada passo de cada tropa
 // a refazia 2 vezes por tick, metade do custo da simulação com 100 tropas. Mortes de aeronave e antiaérea ainda atualizam na hora.
 flushVision(){if(this.visionDirty&&!(this.multiplayer&&this.mode==='rts'))this.updateVision();}
 updateVision(){
  this.visionDirty=false;this.updateRadarContacts();const terrain=this.terrain;
  for(const owner of this.sides){
   const visible=this.visible[owner],sky=this.sky[owner],explored=this.explored[owner];visible.fill(false);sky.fill(false);
   const seers=[];
   for(const list of [this.units,this.structures])for(const u of list){
    if(u.owner!==owner||u.hp<=0)continue;const p=u.type==='hq'||u.type==='post'?CENTER(u):u,r=this.sight(u),limit=r+.05,high=AIR(u)&&!UT(u).drone&&u.altitude==='high',reach=(high?1:u.type==='recon'?3:2)+.05,open=!!UT(u).drone||!!UT(u).airdropPlane||heliHigh(u),x0=Math.max(0,Math.floor(p.x-r)),x1=Math.min(COLS-1,Math.ceil(p.x+r)),y1=Math.min(ROWS-1,Math.ceil(p.y+r));seers.push([p,limit,this.strikeReach(u)]);
    // Invariantes da tropa ficam fora do laço das casas; casa já visível por outra tropa só marca explorada/céu.
    for(let y=Math.max(0,Math.floor(p.y-r));y<=y1;y++){const dy=Math.abs(p.y-y),row=y*COLS;for(let x=x0;x<=x1;x++){const d=Math.abs(p.x-x)+dy;if(d>limit)continue;const k=row+x;explored[k]=true;sky[k]=true;if(visible[k])continue;if(open||d<=reach){visible[k]=true;continue;}const t=terrain[k];if(!(CONCEAL.has(t)||high&&(t==='hill'||t==='mountain')))visible[k]=true;}}
   }
   if(this._reveal===owner||this.isOut(owner)){visible.fill(true);sky.fill(true);explored.fill(true);} // fim de partida ou lado eliminado: mapa inteiro
   // A detecção furtiva acompanha a área de reconhecimento atual.
   for(const e of this.units)if(e.spotted&&e.owner!==owner&&e.hp>0){const p=TILE(e),wasSpotted=e.spotted[owner];e.spotted[owner]=!!sky[KEY(p.x,p.y)];if(e.spotted[owner]&&!wasSpotted){if(this.multiplayer){this.log('Drone furtivo inimigo descoberto.',[owner]);this.log('Seu drone furtivo foi descoberto.',[e.owner]);}else if(owner==='blue')this.log('Drone furtivo inimigo descoberto.');else if(e.owner==='blue')this.log('Seu drone furtivo foi descoberto.');}}
   // Helicóptero alto: cobertura terrestre até 1 casa; disparos revelam a quem tem alcance de visão, inclusive do alto.
   for(const e of this.units)if(e.owner!==owner&&e.revealed>0){const p=TILE(e),k=KEY(p.x,p.y);if(!visible[k]&&seers.some(([o,limit,reach])=>DIST(o,e)<=(e.type==='antiAirVehicle'?Math.max(limit,reach):limit)))visible[k]=true;}
   for(const [key,s]of this.memory[owner])if(this.isVisible(owner,s))this.memory[owner].delete(key);
   for(const s of this.structures)if(this.isVisible(owner,s))this.memory[owner].set(KEY(s.x,s.y),{id:s.id,x:s.x,y:s.y,type:s.type,owner:s.owner,width:s.width,height:s.height,...(s.missionTarget?{missionTarget:true,missionLabel:s.missionLabel}: {})});
   for(const m of this.mines)if(this.units.some(u=>u.type==='engineer'&&u.owner===owner&&DIST(u,m)<=2))m.known[owner]=true;
   // Inteligência da IA: última posição vista de cada tropa azul; sai quando morre ou quando a casa conhecida está à vista e vazia.
   if(owner==='red'){
    const now=this.mode==='rts'?this.time:this.round;
    for(const e of this.units)if(e.owner==='blue'&&this.isVisible('red',e)){const p=TILE(e);this.intel.set(e.id,{id:e.id,type:e.type,x:p.x,y:p.y,hp:e.hp,maxHp:e.maxHp,seenAt:now});}
    for(const [id,e]of this.intel)if(now-(e.seenAt??now)>(this.mode==='rts'?60:4)||(AIR(e)?sky:visible)[KEY(e.x,e.y)]&&!this.units.some(v=>v.id===id&&this.isVisible('red',v)))this.intel.delete(id);
   }
  }
 }
 hasAura(u){return this.units.some(c=>c.owner===u.owner&&c.type==='commander'&&c.hp>0&&DIST(u,c)<=(UT(c).aura??2));}
 cover(u){if(AIR(u))return 0;return Math.min(.75,TERRAIN[this.terrainAt(u)].cover+(u.entrenched?.25:0));}
 attackPower(u,w){return (PLANE(u)&&w||AIR(u)?this.weaponStats(u,w||'gun').damage:GROUND_WEAPONS.has(w)?this.weaponStats(u,w).damage:UT(u).damage)*(1+(u.level-1)*.1)*(this.hasAura(u)?1.2:1)*NATION_DOCTRINES[this.doctrines[u.owner]||'balanced'].damage;}
 accuracy(a,b,w=this.weapon(a,b)){
  const v=this.rawAccuracy(a,b,w),s=UT(b),smoke=!!s?.galix&&b.smokeTime>0;
  return s&&(s.evade||smoke)?Math.max(.1,v*(1-(s.evade||0))*(smoke?GALIX_PENALTY:1)):v;
 }
 rawAccuracy(a,b,w=this.weapon(a,b)){if(PLANE(a)){const model=UT(a),t=!BOMB_TYPES.includes(w)&&model.weaponModel?TYPES[model.weaponModel]:model,s=this.planeWeapon(a,w),d=s.range?Math.min(1,DIST(a,b)/s.range):0,red=t.team==='red';let base=w==='jetGun'?.85-.2*d:w==='jetAam'?(t.radar?(red?.9-.2*d:.95-.1*d):(red?.9-.1*d:.85-.1*d)):.7+t.evasion/2+(t===TYPES.multiroleRed?.1:0);return Math.max(.1,Math.min(.95,(base+(a.level-1)*.05+(this.hasAura(a)?.15:0)-(PLANE(b)?0:(b.level-1)*.05)-(a.suppressed>0?.25:0)+(MISSILE(w)&&HELI(b)?.15:0))*(w==='jetGun'&&PLANE(b)&&AIR(b)?1-this.planeEvasion(b)/2:1)));}if(UT(a).tank&&DIST(a,b)<=1.05)return 1;return Math.max(.1,Math.min(.99,(AIR(a)&&this.weaponStats(a,w)?this.weaponStats(a,w).accuracy:GROUND_WEAPONS.has(w)?this.weaponStats(a,w).accuracy:UT(a).accuracy)-(a.type==='tank'?Math.max(0,DIST(a,b)-(UT(a).falloff||3))*.1:0)+(a.level-1)*.05+(this.hasAura(a)?.15:0)-(PLANE(b)?0:(b.level-1)*.05)-(a.suppressed>0?.25:0)+(MISSILE(w)?(AIR(a)&&a.altitude==='high'?.1:0)+(AIR(b)&&b.altitude==='high'?.1:0)+(b.type==='reconDrone'&&['antiAirVehicle','missileInfantry'].includes(a.type)?.1:0):0)+(MISSILE(w)&&HELI(b)?.15:0)));}
 flareReady(u){return AIR(u)&&u.flares>0&&(this.mode==='rts'?u.flareCooldown<=1e-8:!u.flareUsed);}
 serviceSite(u,base){return (u.type==='antiAirVehicle'||atMax(u)||u.type==='heavyTank'||AIR(u)&&!PLANE(u)&&u.altitude==='low')&&!u.segment&&base?.hp>0&&base.owner===u.owner&&(AIR(u)&&!PLANE(u)?base.type==='hq'||AIRPORT(base):['hq','post'].includes(base.type))&&DIST(u,base)<=1&&this.structures.includes(base);}
 // Manutenção paga do helicóptero: HELI_REPAIR HP por passo, HELI_REPAIR_COST crédito por HP, limitado pelo caixa; devolve o curado.
 heliHeal(u,hp=HELI_REPAIR){const n=Math.min(hp,u.maxHp-u.hp,Math.floor(this.credits[u.owner]/HELI_REPAIR_COST));if(n>0){this.credits[u.owner]-=n*HELI_REPAIR_COST;u.hp+=n;}return Math.max(0,n);}
 missileLoad(u){const t=UT(u);if(atMax(u))return typeof u.atMissiles==='number'?{have:u.atMissiles,max:atMax(u)}:null;if(t?.missiles)return typeof u.missiles==='number'?{have:u.missiles,max:t.missiles}:null;const ws=t?.plane&&u.ammo?Object.keys(t.ammo||{}).filter(MISSILE):[];return ws.length?{have:ws.reduce((n,w)=>n+(u.ammo[w]||0),0),max:ws.reduce((n,w)=>n+t.ammo[w],0)}:null;}
 // Avisa só no disparo que leva até o limiar (igualdade exata), então uma salva avisa uma vez.
 // Segundos restantes da manutenção RTS em base (mesmas regras do passo 'service': cura, itens a cada 3 s, fumaça do antiaéreo a cada 10 s).
 serviceEta(u){const clock=u.serviceClock||0;if(u.type==='antiAirVehicle')return Math.max(0,10*(2-(u.smokeCharges??2))-clock);
  const heli=AIR(u)&&!PLANE(u),hurt=u.maxHp-u.hp,hp=hurt<=0?0:heli?(this.credits[u.owner]<HELI_REPAIR_COST?0:Math.ceil(hurt/HELI_REPAIR)-(u.healClock||0)):hurt/24;
  const missing=atMax(u)||u.type==='heavyTank'?Math.max(atMax(u)?atMax(u)-u.atMissiles:0,u.type==='heavyTank'?trophyMax(u)-u.trophy:0):Math.max(3-(u.flares??3),u.salvos!==undefined?HELI_SALVOS-u.salvos:0,UT(u).missiles?UT(u).missiles-u.missiles:0);
  return Math.max(0,hp,missing>0?3*missing-clock:0);}
 // Cronômetro de um processo com duração (só RTS). Devolve null sem processo ou sem os campos (unidade inimiga em multiplayer chega só com os campos visuais).
 timerFor(u){if(this.mode!=='rts'||!u)return null;const job=u.job,t=UT(u);if(!t)return null;
  const make=(label,total,left)=>({label,progress:total>0?Math.max(0,Math.min(1,1-left/total)):0,left:Math.max(0,left)});
  if(t.structure){if(u.type==='airportSite'&&u.work>0){const d=this.airportDuration(u);return make('Obra',d,d-u.work);}const q=u.queue?.[0];if(q&&typeof q.progress==='number'){const d=this.trainDuration(q.type);return make('Treinando',d,d-q.progress);}return null;}
  if(PLANE(u)){if(u.flightState!=='service'||typeof u.serviceProgress!=='number')return null;const b=this.get(u.airportId),d=(b?.type==='airportAsphalt'?1:2)*10;return make('Manutenção',d,d-u.serviceProgress);}
  if(!job)return null;const work={capture:['Capturando',2],build:['Construindo',3],repair:['Reparando',1],demine:['Desminando',1]}[job.type];
  if(work&&u.work>0)return make(work[0],work[1],work[1]-u.work);
  if(job.type==='service'){const left=this.serviceEta(u);if(left<=0)return null;job.serviceTotal=Math.max(job.serviceTotal||0,left);return make('Manutenção',job.serviceTotal,left);}
  return null;}
 ammoWarning(u){const l=this.missileLoad(u);if(!l)return;const text=l.have===0?'Munição acabou':l.have===Math.max(1,Math.floor(l.max/4))?'Pouca munição':null;if(text)this.event('text',u,{text,color:l.have?'#ffdc92':'#f26d5b'});}
 canService(u,base){return this.serviceSite(u,base)&&(u.type==='antiAirVehicle'?u.smokeCharges<2:atMax(u)||u.type==='heavyTank'?u.hp<u.maxHp||u.atMissiles<atMax(u)||u.trophy<trophyMax(u):u.hp<u.maxHp&&this.credits[u.owner]>=HELI_REPAIR_COST||u.flares<3||u.salvos<HELI_SALVOS||u.missiles<UT(u).missiles);}
 canBombard(u,cell){if(!BARRAGE(u)||!cell||!INSIDE(cell.x,cell.y)||u.hp<=0||u.type!=='rocketArtillery'&&(u.altitudeTransition||!AIR(u)))return false;const d=DIST(u,cell);return d<=barrageRange(u)+.05&&d>=(UT(u).barrage?.min??TYPES.rocketArtillery.min);}
 canFire(a,b){return !!b&&b.hp>0&&b.owner!==a.owner&&b.owner!=='neutral'&&!!this.weapon(a,b)&&this.canIdentify(a,b)&&DIST(a,b)<=this.range(a,b)+.05&&DIST(a,b)>=UT(a).min;}

 // Mira da IA: antitanque em veículos, metralhador em tropa a pé, mísseis em aeronaves; prefere abates prováveis,
 // alvos de maior valor e perto; artilharia escolhe o ponto com mais inimigos no 3×3 e nenhum aliado.
 aiAcquire(u){
  let friends,foes;const reach=this.range(u)+.05;
  const around=(list,e)=>list.filter(v=>{const c=NEAREST(v,TILE(e));return !AIR(v)&&Math.abs(c.x-Math.round(e.x))<=1.5&&Math.abs(c.y-Math.round(e.y))<=1.5;}).length;
  let best=null,bestScore=-Infinity;
  for(const list of [this.units,this.structures])for(const e of list){
   if(DIST(u,e)>reach||!this.canFire(u,e))continue;
   const w=this.weapon(u,e),t=UT(e),d=DIST(u,e);let role=1;
   if(u.type==='artillery'){if(around(friends??=this.all().filter(v=>v.owner==='red'&&v.hp>0),e))continue;role=2+around(foes??=this.all().filter(e=>e.owner==='blue'&&e.hp>0&&this.isVisible('red',e)),e)*2;}
   else if(u.type==='stealthDrone')role=['antiAirVehicle','missileInfantry'].includes(e.type)?4:2;
   else if(AIR(u))role=w!=='gun'?3:1;
   else if(u.type==='antitank')role=t.vehicle?3:0;
   else if(u.type==='machinegun')role=AIR(e)||(!t.vehicle&&!t.structure)?2:0;
   const dano=this.attackPower(u,AIR(u)?w:undefined),abate=e.hp<=dano*(1-this.cover(e))?1:0;
   const score=role*4+abate*3+Math.min(2,(t.reward||0)/50)-d*.35-(e.hp/e.maxHp)*.5;
   if(score>bestScore){bestScore=score;best=e;}
  }
  return best;
 }
  acquire(u){
  if(u.owner==='red')return this.aiAcquire(u);
  let best,bestD=Infinity,bestPriority=-1;const reach=this.range(u)+.05;
  for(const list of [this.units,this.structures])for(const e of list){
   if(this.mission&&e.missionTarget||DIST(u,e)>reach||!this.canFire(u,e))continue;const d=DIST(u,e),t=UT(e),priority=UT(u).air?Number(this.weapon(u,e)!=='gun'):u.type==='antitank'?Number(!!t.vehicle):u.type==='machinegun'?Number(!t.vehicle&&!t.structure):0;
   if(priority>bestPriority||priority===bestPriority&&(d<bestD||d===bestD&&e.hp<best.hp)){best=e;bestD=d;bestPriority=priority;}
  }return best;
 }

 cancelWork(u){if(u.reserved){this.credits[u.owner]+=u.reserved;u.reserved=0;}u.work=0;u.serviceClock=0;}
 cancelAltitude(u){if(u.altitudeTransition&&!u.altitudeTransition.returning)u.altitudeTransition={from:flightLevel(u),to:u.altitude==='high'?1:0,elapsed:0,returning:true};}
 advanceLauncher(u,raised,dt){
  const level=(u.launcherLevel||0)+(raised?1:-1)*dt/LAUNCHER_TIME;
  u.launcherLevel=level<1e-8?0:level>1-1e-8?1:level;return u.launcherLevel===(raised?1:0);
 }
 advanceAltitude(u,altitude,dt){
  if(!u.altitudeTransition||u.altitudeTransition.returning)u.altitudeTransition={from:flightLevel(u),to:altitude==='high'?1:0,elapsed:0,returning:false};
  u.altitudeTransition.elapsed=Math.min(ALTITUDE_TIME,u.altitudeTransition.elapsed+dt);
  if(u.altitudeTransition.elapsed+1e-8<ALTITUDE_TIME)return false;
  u.altitude=altitude;u.altitudeTransition=null;this.updateVision();this.report(`Altitude ${altitude==='high'?'alta':'baixa'}.`,u);return true;
 }
 buildSite(u,at){if(u?.type!=='infantry'||u.hp<=0||u.segment)return false;const p={...(at||TILE(u)),width:TYPES.post.width,height:TYPES.post.height};if(!INSIDE(p.x+p.width-1,p.y+p.height-1)||this.structures.some(s=>DIST(s,p)<3))return false;for(let y=p.y;y<p.y+p.height;y++)for(let x=p.x;x<p.x+p.width;x++)if(!['plain','road','forest','field','hill'].includes(this.terrain[KEY(x,y)])||this.occupied(x,y,u,false)||this.mines.some(m=>m.x===x&&m.y===y))return false;return true;}
 canBuild(u){return !!u&&(this.mode==='rts'||u.owner===this.turn)&&u.actionLeft&&!u.pending&&this.credits[u.owner]>=60&&this.buildSite(u);}
 pathCost(u,path){let from=TILE(u.segment?.to||u),sum=0;for(const p of path){sum+=this.stepCost(u,from,p);from=p;}return sum;}
 trimPath(u,path){if(this.mode==='rts')return path;let left=u.moveLeft,from=TILE(u);const route=[];for(const p of path){const cost=this.stepCost(u,from,p);if(cost>left+1e-8)break;left-=cost;route.push(p);from=p;}return route;}
 pathToRange(u,target,near,min=0,budget=Infinity){
  const start=this.mode==='rts'&&u.segment?{...u,...u.segment.to}:u;
  if(DIST(start,target)<=near&&DIST(start,target)>=min)return [];
  // Planejamento estratégico nos dois modos: uma busca até qualquer casa no alcance.
  if(budget===Infinity)return this.findPath(start,target,true,this.unitGrid(u),this.structureGrid(u),near,min);
  const cells=[],units=this.unitGrid(u),structures=this.structureGrid(u),r=Number.isFinite(near)?near:COLS+ROWS;for(let y=Math.max(0,Math.floor(target.y-r));y<=Math.min(ROWS-1,Math.ceil(target.y+(target.height||1)-1+r));y++)for(let x=Math.max(0,Math.floor(target.x-r));x<=Math.min(COLS-1,Math.ceil(target.x+(target.width||1)-1+r));x++){const d=DIST({x,y},target);if(d<=near&&d>=min&&this.passable(u,x,y,true,units,structures)&&Number.isFinite(this.cost(u,x,y)))cells.push({x,y});}
  const minStep=AIR(u)||!this.terrain.includes("road")?1:.5;cells.sort((a,b)=>this.travelDistance(u,a,start)-this.travelDistance(u,b,start));let best=null,bestCost=Infinity,tries=0;
  // Cada casa candidata custa uma busca A*: sem orçamento de movimento (RTS), só as 12 mais próximas são testadas.
  for(const cell of cells){const floor=this.travelDistance(u,cell,start)*minStep;if(floor>=bestCost||floor>budget+1e-8||tries++>=12&&budget===Infinity)break;const route=this.findPath(start,cell,true,units,structures);if(!route)continue;const cost=this.pathCost(u,route);if(cost<=budget+1e-8&&cost<bestCost){best=route;bestCost=cost;}}
  return best;
 }
 order(u,type,args={},batch=false){
  const rts=this.mode==='rts';
  if(type==='embark'||type==='disembark')return this.transportOrder(u,type,args);
  if(UT(u)?.airdropPlane)return type==='airdropLaunch'&&this.airdropLaunch(u,args);
  if(PLANE(u)||DRONE(u)&&['move','stop','attack'].includes(type))return this.orderPlane(u,type,args,batch);
  if(!rts&&type==='stop'&&u?.pending&&AIR(u)&&u.owner===this.turn&&!this.winner&&this.units.includes(u)){
   this.cancelAltitude(u);this.actions=this.actions.filter(a=>a.id!==u.id);u.moveLeft=0;u.actionLeft=false;u.path=[];u.order={type:'stop'};
   if(this.animation?.id===u.id){const a=this.animation;if(u.segment){a.type='move';a.route=[];}else if(a.from&&HELI(u)){a.type='move';a.route=[TILE(u)];}else this.finishAction(u);}else u.pending=false;
   return true;
  }
  if(this.winner||!u||!this.units.includes(u)||u.hp<=0||!this.sides.includes(u.owner)||!rts&&(u.owner!==this.turn||u.pending||this.busy&&!batch))return false;
  if(type!=='stop'&&u.type!=='rocketArtillery'&&BARRAGE(u)&&(rts?u.job?.type==='bombard'&&(u.job.left>0||u.job.left===undefined&&!u.segment&&this.canBombard(u,u.job.cell)):this.animation?.id===u.id&&this.animation.cell))return false;
  if(type==='stop'){if(u.airportSiteId){u.airportSiteId=null;u.job=null;}u.captureIntent=null;if(rts)this.finishRTS(u);else{u.moveLeft=0;u.actionLeft=false;u.entrenched=!AIR(u);u.order={type:'stop'};}return true;}
  let route=[],target=type==='capture'?this.knownObjective(u.owner,args.targetId,args.position):this.get(args.targetId),job={id:u.id,type,targetId:target?.id};
  if(type==='move'){
   const goal={x:Math.round(args.x),y:Math.round(args.y)};if(!INSIDE(goal.x,goal.y)||!rts&&(u.moveLeft<=0||u.type==='artillery'&&!UT(u).scoot&&!u.actionLeft&&!u.moved))return false;
   const start=rts&&u.segment?{...u,...u.segment.to}:u,path=this.findPath(start,goal,true,this.unitGrid(u,rts));if(!path)return false;route=this.trimPath(u,path);if(!route.length&&!(rts&&u.segment))return false;job.goal=goal;
  }else{
   if(!rts&&!u.actionLeft)return false;
   if(BARRAGE(u)&&(type==='bombard'||type==='attack'&&u.type==='rocketArtillery')){
    if(u.salvos!==undefined&&!(u.salvos>0))return false;
    // Casa escolhida pode estar sob névoa ou inexplorada; o ataque a um inimigo visível mira a casa dele.
    const cell=type==='bombard'?{x:Math.round(args.x),y:Math.round(args.y)}:target&&target.owner!==u.owner&&target.owner!=='neutral'&&this.isVisible(u.owner,target)?TILE(target):null;
    if(!cell||!INSIDE(cell.x,cell.y))return false;type=job.type='bombard';job.cell=cell;job.targetId=undefined;
    route=this.pathToRange(u,cell,barrageRange(u),UT(u).barrage?.min??TYPES.rocketArtillery.min,rts?Infinity:u.moveLeft);if(route===null)return false;
   }else if(type==='attack'){
    if(!target||target.owner===u.owner||target.owner==='neutral'||!this.weapon(u,target)||!this.isVisible(u.owner,target))return false;
    if(!rts&&u.type==='artillery'&&(u.moved||!this.canFire(u,target)))return false;
    route=this.pathToRange(u,target,this.range(u,target),UT(u).min,rts?Infinity:u.moveLeft);if(route===null)return false;
   }else if(type==='repair'){
    if(u.type!=='engineer'||!target||AIR(target)||target===u||target.owner!==u.owner||target.hp>=target.maxHp)return false;
    route=this.pathToRange(u,target,1,0,rts?Infinity:u.moveLeft);if(route===null)return false;
   }else if(type==='altitude'){
    if(!AIR(u)||UT(u).drone||!['low','high'].includes(args.altitude)||args.altitude===u.altitude||UT(u).noHigh&&args.altitude==='high')return false;job.altitude=args.altitude;
   }else if(type==='service'){
    if(!this.canService(u,target))return false;
   }else if(type==='capture'){
    if(!this.canCapture(u,target)||target.owner===u.owner)return false;
    const access=this.pathToRange(u,target,1);if(access===null)return false;
    route=this.trimPath(u,access);job.position={x:target.x,y:target.y,width:target.width,height:target.height};
   }else if(type==='demine'){
    const m=this.mines.find(m=>m.x===args.x&&m.y===args.y&&m.known[u.owner]);if(u.type!=='engineer'||!m)return false;
    job.goal={x:m.x,y:m.y};route=this.pathToRange(u,m,1,0,rts?Infinity:u.moveLeft);if(route===null)return false;
   }else if(type==='build'){
    if(!this.canBuild(u))return false;this.credits[u.owner]-=60;u.reserved=60;
   }else return false;
   if(!rts&&type!=='capture')u.actionLeft=false;
  }
  if(u.airportSiteId){u.airportSiteId=null;u.job=null;}
  u.captureIntent=type==='capture'?{targetId:job.targetId,position:job.position}:null;
  if(rts){this.cancelAltitude(u);if(type!=='build')this.cancelWork(u);u.work=0;u.idle=0;u.navWait=0;u.stuck=0;u.navFail=0;u.job=job;}
  u.entrenched=false;u.pending=true;u.path=route.slice();job.route=route;u.order={type,targetId:job.targetId,altitude:job.altitude,cell:job.cell,goal:route.length?route[route.length-1]:job.goal};if(!rts)this.actions.push(job);return true;
 }
 command(ids,type,args={},owner='blue'){
  if(this.winner||!this.sides.includes(owner)||this.mode!=='rts'&&(this.turn!==owner||this.busy))return 0;let count=0;const rts=this.mode==='rts',assigned=new Set(),army=[...new Set(ids)].map(id=>this.get(id)).filter(u=>u?.owner===owner&&!UT(u).structure);
  // Agrupamento em volta do destino: raio 4; no RTS cresce com a raiz do grupo para toda tropa achar casa.
  const radius=rts?Math.max(4,Math.ceil(Math.sqrt(army.length))):4;
  for(const u of army){
   if(type==='move'&&army.length>1&&!FLYER(u)){
    if(!rts&&u.moveLeft<=0)continue;
    // Grades e casa inicial valem para todas as candidatas; o A* só roda para casas livres e ainda não escolhidas.
    const air=AIR(u),slot=p=>(air?'a':'g')+KEY(p.x,p.y),units=this.unitGrid(u),structures=this.structureGrid(u),start=rts&&u.segment?{...u,...u.segment.to}:u,here=TILE(start),candidates=[];
    for(let y=Math.max(0,Math.floor(args.y-radius));y<=Math.min(ROWS-1,Math.ceil(args.y+radius));y++)for(let x=Math.max(0,Math.floor(args.x-radius));x<=Math.min(COLS-1,Math.ceil(args.x+radius));x++)if(DIST({x,y},args)<=radius&&!units[KEY(x,y)]&&(x!==here.x||y!==here.y)&&(!rts||!assigned.has(slot({x,y})))&&(air||this.structureAt(x,y)?.type!=='hq')&&Number.isFinite(this.cost(u,x,y)))candidates.push({x,y});
    candidates.sort((a,b)=>DIST(a,args)-DIST(b,args)||DIST(a,u)-DIST(b,u));
    // ponytail: um A* por tropa; destino inalcançável custa um A* completo, então a primeira falha gera a inundação que descarta as demais.
    // Se grupos de 100+ ainda travarem no plano gratuito, rotular os componentes conexos uma vez por classe de movimento.
    let reach=null;
    for(const goal of candidates){
     if(reach&&!reach[KEY(goal.x,goal.y)])continue;
     if(rts){if(this.order(u,type,goal,true)){assigned.add(slot(goal));count++;break;}}
     else{const path=this.findPath(start,goal,true,units,structures),route=path&&this.trimPath(u,path),last=route?.[route.length-1];if(last&&!assigned.has(slot(last))){if(this.order(u,type,goal,true)){assigned.add(slot(last));count++;}break;}if(path)continue;}
     reach||=this.reachable(start,units,structures,true);
    }
   }else if(this.order(u,type,args,true))count++;
  }return count;
 }
 enterCell(u){if(AIR(u))return;const m=this.mines.find(m=>m.x===u.x&&m.y===u.y);if(!m)return;this.mines=this.mines.filter(v=>v!==m);this.hurt(u,40,null);this.event('blast',u);this.report(`${UT(u).name} atingido por mina: −40.`,u);}
 // Um míssil da salva: impacto na casa escolhida (não persegue); 80% de impacto efetivo, sorteado pelo RNG do combate.
 launch(u,cell){
  const t=TYPES.rocketArtillery,b=UT(u).barrage;u.facing=Math.atan2(cell.x-u.x,u.y-cell.y);u.cooldown=u.reload=b?.cooldown??(u.type==='rocketArtillery'?UT(u).cooldown:t.cooldown);u.revealed=2;
  this.projectiles.push({attackerId:u.id,owner:u.owner,faction:KIT(u),mult:b&&{infantry:b.infantry,vehicle:b.vehicle},type:'rocketArtillery',weapon:'rocket',air:false,sourceLevel:0,targetLevel:0,sx:u.x,sy:u.y,x:u.x,y:u.y,tx:cell.x,ty:cell.y,heading:Math.atan2(cell.y-u.y,cell.x-u.x),trail:[],elapsed:0,duration:Math.max(.8,DIST(u,cell)/8),power:this.attackPower(u,'rocket'),hit:this.rng()<t.accuracy});
  this.shotsFired++;this.event('shot',u,{weapon:'antitank'});
 }
 shoot(u,target,weapon){
  if(u.type==='artillery'){if(this.mode!=='rts')u.moveLeft=UT(u).scoot?1:0;else if(UT(u).scoot)u.scoot=SCOOT_TIME;}
  // O projétil guarda arma, dano e alvo do disparo; trocar de arma depois não o altera. Helicópteros: recarga única por arma usada.
  const w=weapon||this.weapon(u,target);if(!w||PLANE(u)&&!this.planeWeaponFits(u,w,target)||UT(u).gun&&!this.helicopterWeaponFits(u,w,target))return false;const missile=MISSILE(w);const trophy=w==='atMissile'&&target.type==='heavyTank'&&target.trophy>0&&!UT(target).galix&&DIST(u,target)>TROPHY_RANGE;if(trophy)target.trophy--;if(w==='atMissile')u.atMissiles--;if(PLANE(u))u.ammo[w]--;if(w==='stealthMissile'||w==='agm'&&u.missiles!==undefined)u.missiles--;if(missile)this.ammoWarning(u);
  if(!PLANE(u))u.facing=Math.atan2(target.x-u.x,u.y-target.y);if(w==='jetGun')u.gunShotClock=.06;else u.cooldown=u.reload=(UT(u).air?this.weaponStats(u,w):GROUND_WEAPONS.has(w)?WEAPONS[w]:UT(u)).cooldown;u.revealed=2;const artillery=u.type==='artillery',aim=artillery?TILE(target):{x:target.x,y:target.y};
  const accuracyBase=this.accuracy(u,target,w),flareProtected=missile&&this.flareReady(target),evasiveAccuracy=accuracyBase*(missile&&PLANE(target)&&AIR(target)?1-Math.min(.8,this.planeEvasion(target)+(this.weaponStats(u,w)?.evasionBonus||0)):1),accuracy=evasiveAccuracy*(flareProtected?(heliHigh(target)?.35:.5):1),roll=this.rng();
  const decoy=flareProtected?{x:Math.max(0,Math.min(COLS-1,target.x+(target.id%2?1.3:-1.3))),y:Math.max(0,Math.min(ROWS-1,target.y+1.2))}:null;
  if(flareProtected){target.flares--;target.flareUsed=true;target.flareCooldown=PLANE(target)?2:heliHigh(target)?4:8;this.event('flare',target,{decoy,...(UT(target).airdropPlane?{count:30}:{})});}
  this.projectiles.push({attackerId:u.id,owner:u.owner,faction:KIT(u),type:u.type,weapon:w,air:AIR(u)||AIR(target),sourceLevel:AIR(u)?flightLevel(u):0,targetLevel:AIR(target)?flightLevel(target):0,targetId:target.id,sx:u.x,sy:u.y,x:u.x,y:u.y,tx:aim.x,ty:aim.y,heading:Math.atan2(aim.y-u.y,aim.x-u.x),trail:[],elapsed:0,duration:PLANE(u)?Math.max(.1,DIST(u,target)/this.planeWeapon(u,w).speed):missile?Math.max(.45,w==='aam'?DIST(u,target)/WEAPONS.aam.speed:w==='antiAirVehicle'?DIST(u,target)/12:Math.min(1.2,DIST(u,target)/6)):artillery?.7:u.type==='antitank'?.3:.18,power:this.attackPower(u,w),distance:DIST(u,target),range:PLANE(u)?this.weaponRange(u,w):this.range(u,target),accuracyBase,accuracy,flareProtected,trophy,attackerAltitude:u.altitude,targetAltitude:target.altitude,deflected:flareProtected&&roll>=accuracy&&roll<evasiveAccuracy,decoy,hit:roll<accuracy,critical:this.rng()<.1});
  const shot=this.projectiles.at(-1);if(w==='antiRadiation'){if(!target.smokeTime)this.useSmoke(target);}this.shotsFired++;this.event('shot',u,{weapon:w==='gun'||w==='jetGun'?'machinegun':missile?'antitank':w==='rifle'?'infantry':u.type});
 }
  impact(p){
  if(p.resolved||p.intercepted||p.interceptor)return;p.resolved=true;if(BOMB_TYPES.includes(p.weapon))return this.bombImpact(p);if(p.weapon==='rocket'||p.weapon==='cruiseMissile')return this.rocketImpact(p);
  const attacker=this.get(p.attackerId),target=this.get(p.targetId);if(PLANE(target)&&target.flightState==='offmap')return;const center={x:p.deflected?p.decoy.x:p.tx,y:p.deflected?p.decoy.y:p.ty,owner:p.owner};
  const visibility={flightLevel:p.targetLevel||0,air:p.air,contactId:p.targetId,sourceId:p.attackerId};
  const blastVisibility={...visibility,...(MISSILE(p.weapon)?{visible:true,publicMissile:true}:{})};
  if(p.lostGuidance){this.event('blast',center,{lostGuidance:true,decoy:p.deflected,...blastVisibility});return;}
  if(p.weapon==='antiRadiation'&&!p.smokeChecked){p.smokeChecked=true;if(target?.smokeTime>0&&(!p.radiationLost||DIST(target,{x:p.tx,y:p.ty})<.05)&&this.rng()<.6){p.deflected=true;p.decoy={x:p.tx+2,y:p.ty+1};}}
  if(p.deflected){this.event('blast',center,{decoy:true,...blastVisibility});return;}
  if(!p.hit){if(MISSILE(p.weapon))this.event('blast',center,{dud:true,...blastVisibility});this.event('text',center,{text:'ERROU!',color:'#efd291',...visibility});return;}
  this.event('blast',center,{heavy:p.type==='artillery',...(p.weapon==='gun'?{weapon:'gun'}:{}),...blastVisibility});
  const targets=p.radiationLost?this.all().filter(t=>{const c=NEAREST(t,center);return !AIR(t)&&t.hp>0&&Math.round(c.x)===Math.round(p.tx)&&Math.round(c.y)===Math.round(p.ty);}):p.type==='artillery'?this.all().filter(u=>{const c=NEAREST(u,center);return !AIR(u)&&Math.abs(c.x-p.tx)<=1.5&&Math.abs(c.y-p.ty)<=1.5;}):target?[target]:[];
  for(const t of targets){
   if(p.type==='lightTank'&&t.type==='heavyTank'&&p.weapon!=='atMissile'||UT(p)?.gun&&!this.helicopterWeaponFits({type:p.type,faction:p.faction,owner:p.owner},p.weapon,t))continue;
   let power=p.power;if(p.type==='artillery')power*=Math.max(.8,Math.min(1,1-.2*(DIST({x:p.sx,y:p.sy},t)-2)/Math.max(1,p.range-2)))*(t.id===p.targetId?1:.5);
   if(p.type==='recon')power*=UT(t).tank?.4:!UT(t).vehicle&&!UT(t).structure?1.5:1;
   if(p.weapon==='atMissile')power*=UT(t).vehicle?2.25:UT(t).structure?1:.5;
   if(p.type==='machinegun')power*=AIR(t)?1:UT(t).vehicle?.25:UT(t).structure?.5:1.3;
   // Contra helicópteros: infantaria −75%, metralhador −35%; cai até metade no alcance máximo do disparo.
   if(AIR(t)&&(p.type==='infantry'||p.type==='machinegun'))power*=(p.type==='infantry'?.25:.65)*(1-.5*Math.min(1,p.distance/p.range));
   if(p.weapon==='gun'){const gun=UT(p).gun||HELICOPTER_CANNON;power*=AIR(t)?(PLANE(t)?.35:1):UT(t).structure?gun.structureMultiplier:UT(t).vehicle?gun.vehicleMultiplier:gun.infantryMultiplier;}
   if(p.weapon==='jetGun'){if(UT(t).structure||ARMORED.has(t.type))continue;if(AIR(t))power*=1.75;else if(UT(t).vehicle)power*=.5;}
   const arm=UT(p)?.arms?.[p.weapon];if(arm?.structureMultiplier&&UT(t).structure)power*=arm.structureMultiplier;
   if(p.weapon==='jetAgm')power*=UT(t).vehicle?1.5:1;if(p.weapon==='agm')power*=UT(t).vehicle?1.5:UT(t).structure?1:.5;
   const n=Math.max(1,Math.round(power*(1-this.cover(t))*(p.critical?1.35:1)));this.hurt(t,n,attacker);
   if(p.critical)this.event('text',t,{text:'CRÍTICO!',color:'#efd291'});
   this.reportDamage(p,t,n);
  }
 }
 // Impacto efetivo: 20 na casa central, metade nas 8 vizinhas, ×2 em estruturas; sem queda pela distância; não atinge aeronaves.
 // Missile impacts are public; damage and logs still require recognition.
 rocketImpact(p){
  const attacker=this.get(p.attackerId),center={x:p.tx,y:p.ty};
  if(!p.hit){this.event('blast',center,{dud:true,visible:true,publicMissile:true});return;}
  this.event('blast',center,{heavy:true,visible:true,publicMissile:true});
  for(const t of this.all().filter(v=>{const c=TILE(NEAREST(v,center));return !AIR(v)&&v.hp>0&&Math.abs(c.x-center.x)<=1&&Math.abs(c.y-center.y)<=1;})){
   const c=TILE(NEAREST(t,center)),power=p.power*(c.x===center.x&&c.y===center.y?1:.5)*(p.mult?(UT(t).vehicle||UT(t).structure?p.mult.vehicle:p.mult.infantry):p.weapon==='rocket'&&UT(t).structure?2:1),n=Math.max(1,Math.round(power*(1-this.cover(t))));
   this.hurt(t,n,attacker);this.reportDamage(p,t,n);
  }
 }
 hurt(u,n,attacker){
  if(!u||u.hp<=0)return;if(u.order.type==='service'){if(this.mode==='rts')this.finishRTS(u);else{this.actions=this.actions.filter(a=>a.id!==u.id);if(this.animation?.id===u.id)this.animation=null;u.pending=false;u.order={type:'stop'};}}u.hp=Math.max(0,u.hp-n);if(u.type!=='airportSite')u.work=0;u.idle=0;u.entrenched=false;this.event('text',u,{text:`−${Math.round(n)}`,color:'#ffab96'});
  if(u.hp>0){if(!UT(u).structure)u.suppressed=this.mode==='rts'?3:2;if(UT(u).galix&&u.trophy>0&&!(u.smokeTime>0)){u.trophy--;u.smokeTime=GALIX_SMOKE;this.event('defenseSmoke',u);}return;}this.cancelWork(u);if(AIRPORT(u))this.loseAirport(u,attacker);if(u.runway)this.releaseRunway(u);if(u.type==='airportSite')for(const w of this.units.filter(w=>w.airportSiteId===u.id)){w.airportSiteId=null;this.finishRTS(w);}if(u.queue)u.queue=[];this.event('blast',u,UT(u).structure&&u.type!=='airportSite'?{wreck:{type:u.type,x:u.x,y:u.y,width:u.width||1,height:u.height||1}}:{});this.report(`${UT(u).name} da Nação ${this.nationLabel(u.owner)} destruído.`,u);
  if(u.owner==='red'&&!this.multiplayer&&UT(u).capacity)this.aiFailure(TILE(u),'transport-loss');
  const cargo=u.cargo||u.airdrop?.cargo||[];u.cargo=[];if(u.airdrop)u.airdrop.cargo=[];
  for(const passenger of cargo){passenger.x=u.x;passenger.y=u.y;this.hurt(passenger,passenger.hp,attacker);}
  // Placar por tipo (perfil do jogador): perdas de cada lado e abates de quem atirou; estruturas não contam.
  if(!UT(u).structure&&this.stats[u.owner]){const l=this.stats[u.owner].losses;l[u.type]=(l[u.type]||0)+1;const k=attacker&&attacker.owner!==u.owner&&this.stats[attacker.owner]?.kills;if(k)k[u.type]=(k[u.type]||0)+1;}
  if(u.owner==='red'&&!this.multiplayer&&PLANE(u)&&AIR(u))this.aiAirFailure(u);
  if(u.type==='commander'){this.credits[u.owner]=Math.floor(this.credits[u.owner]/2);this.report('Comandante perdido. Metade dos créditos foi perdida.',u);}
  if(attacker&&attacker.hp>0&&attacker.owner!==u.owner&&u.owner!=='neutral'){
   this.credits[attacker.owner]+=UT(u).reward||0;attacker.xp++;const level=attacker.xp>=3?3:2;
   if(level>attacker.level){attacker.level=level;const base=this.baseHp(attacker.owner,attacker.type),gain=Math.round(base*.1);attacker.maxHp=Math.round(base*(1+(level-1)*.1));attacker.hp=Math.min(attacker.maxHp,attacker.hp+gain);this.report(`${UT(attacker).name} promovido a ${level===3?'Elite':'Veterano'}.`,attacker);}
  }
  this.units=this.units.filter(v=>v.hp>0);this.structures=this.structures.filter(v=>v.hp>0);
  if(u.type==='antiAirVehicle'||AIR(u))this.updateVision();
 }

 finishAction(u){if(u&&FLYER(u)){u.pending=false;this.animation=null;this.updateVision();return;}if(u){if(this.mode==='rts')this.finishRTS(u);else{u.pending=false;u.path=[];u.segment=null;u.order=u.captureIntent?{type:'capture',targetId:u.captureIntent.targetId}:{type:'stop'};}}this.animation=null;this.updateVision();}
 resolveAction(job,u){
  const target=job.type==='capture'&&u.captureIntent?this.captureTarget(u):this.get(job.targetId);let valid=false;
  if(job.type==='capture'){if(target&&this.canCapture(u,target)&&DIST(u,target)<=1&&this.isVisible(u.owner,target)&&this.structures.includes(target)&&u.actionLeft){this.captureStructure(target,u);u.actionLeft=this.mode==='rts';u.captureIntent=null;}this.finishAction(u);return;}
  if(job.type==='move'){this.finishAction(u);if(!this.multiplayer&&this.turn==='red'&&u.actionLeft){const enemy=this.acquire(u);if(enemy)this.order(u,'attack',{targetId:enemy.id});}return;}
  if(job.type==='attack'){
   if(this.canFire(u,target)){const weapon=this.weapon(u,target),gun=weapon==='gun'?this.weaponStats(u,weapon):null;this.animation={...job,weapon,route:[],shots:gun?.shots||(u.type==='machinegun'?3:1),shotInterval:gun?.shots>1?gun.cooldown:.12,shotClock:0,fired:0};return;}
  }else if(job.type==='bombard'){
   if(this.canBombard(u,job.cell)){u.moveLeft=0;u.facing=Math.atan2(job.cell.x-u.x,u.y-job.cell.y);if(u.salvos!==undefined)u.salvos--;this.animation={...job,route:[],shots:salvoSize(u),shotClock:0,fired:0,launcherPhase:'raising'};return;}
  }else if(job.type==='repair'&&!AIR(target)&&target?.owner===u.owner&&DIST(u,target)<=1){const heal=Math.min(UT(u).repair??24,target.maxHp-target.hp);target.hp+=heal;this.event('text',target,{text:'+'+Math.round(heal),color:'#a4e7bb'});valid=true;
  }else if(job.type==='altitude'&&AIR(u)){valid=this.advanceAltitude(u,job.altitude,0);
  }else if(job.type==='service'&&this.serviceSite(u,target)){const heal=AIR(u)&&!PLANE(u)?this.heliHeal(u):Math.min(24,u.maxHp-u.hp);if(!(AIR(u)&&!PLANE(u)))u.hp+=heal;if(u.type==='antiAirVehicle')u.smokeCharges=Math.min(2,u.smokeCharges+1);else if(atMax(u)||u.type==='heavyTank'){if(atMax(u))u.atMissiles=Math.min(atMax(u),u.atMissiles+2);if(u.type==='heavyTank')u.trophy=Math.min(trophyMax(u),u.trophy+2);}else{u.flares=Math.min(3,u.flares+1);if(u.salvos!==undefined)u.salvos=Math.min(HELI_SALVOS,u.salvos+1);if(UT(u).missiles)u.missiles=Math.min(UT(u).missiles,u.missiles+2);}this.event('text',u,{text:'+'+Math.round(heal)+' HP · manutenção',color:'#a4e7bb'});valid=true;
  }else if(job.type==='capture'&&(target?.type==='post'||target?.missionTarget||AIRPORT(target))&&target.owner!==u.owner&&DIST(u,target)<=1){this.captureStructure(target,u);valid=true;
  }else if(job.type==='demine'&&DIST(u,job.goal)<=1){const mine=this.mines.find(m=>m.x===job.goal.x&&m.y===job.goal.y);if(mine){this.mines=this.mines.filter(m=>m!==mine);this.report('Mina removida.',u);valid=true;}
  }else if(job.type==='build'&&this.buildSite(u)){u.reserved=0;this.add(u.owner,'post',u.x,u.y);this.units=this.units.filter(v=>v!==u);this.report('Posto construído. Infantaria convertida em guarnição.',u);valid=true;}
  if(!valid){u.actionLeft=true;this.cancelWork(u);}this.finishAction(u);
 }
 animate(dt){
  const a=this.animation,u=this.get(a.id);if(!u||u.hp<=0){this.animation=null;return;}if(a.plane){if(this.stepPlane(u,dt))this.finishAction(u);return;}
  if(a.type==='altitude'){if(this.advanceAltitude(u,a.altitude,dt))this.finishAction(u);return;}
  if(a.shots!==undefined){
   if(a.launcherPhase==='raising'){if(!this.advanceLauncher(u,true,dt))return;a.launcherPhase='firing';}
   if(a.launcherPhase==='lowering'){if(this.advanceLauncher(u,false,dt))this.finishAction(u);return;}
   a.shotClock-=dt;if(a.shotClock<=1e-8){const target=this.get(a.targetId);if(a.shots>0&&(a.cell?this.canBombard(u,a.cell):this.canFire(u,target)&&this.weapon(u,target)===a.weapon)){if(a.cell)this.launch(u,a.cell);else this.shoot(u,target,a.weapon);a.shots--;a.fired++;a.shotClock=a.cell?SALVO.interval:a.shotInterval;if(a.cell&&!a.shots)a.launcherPhase='lowering';}else{if(!a.fired)u.actionLeft=true;if(a.cell)a.launcherPhase='lowering';else this.finishAction(u);}}return;
  }
  // Helicóptero: voo contínuo em linha reta até o fim da rota (sem órbita); a rota só define o destino e o orçamento.
  if(HELI(u)&&!u.segment&&a.route.length){
   const end=a.route.at(-1);
   if(!a.from){
    if(this.occupied(end.x,end.y,u)){a.navWait=(a.navWait||0)-dt;if(a.navWait<=0){const route=this.findPath(u,a.goal||end,true);if(route)a.route=this.trimPath(u,route);a.navWait=.4;}u.path=a.route.slice();return;}
    a.from={x:u.x,y:u.y};
   }
   u.path=[end];
   if(this.flyToward(u,end,dt,5)){u.moveLeft=Math.max(0,u.moveLeft-Math.hypot(end.x-a.from.x,end.y-a.from.y)/(heliHigh(u)?HELI_HIGH:1));a.route=[];a.from=null;u.path=[];u.moved=true;this.updateVision();}
   else this.touchVision();
   return;
  }
  if(!u.segment){
   if(!a.route.length){this.resolveAction(a,u);return;}
   const goal=a.goal||a.route.at(-1),next=a.route.shift(),cost=this.stepCost(u,TILE(u),next);
   if(AIR(u)&&this.occupied(next.x,next.y,u)){a.route.unshift(next);a.navWait=(a.navWait||0)-dt;if(a.navWait<=0){const route=this.findPath(u,goal,true);if(route)a.route=this.trimPath(u,route);a.navWait=.4;}u.path=a.route.slice();return;}
   if(this.occupied(next.x,next.y,u)||cost>u.moveLeft+1e-8){a.route=[];u.path=[];this.resolveAction(a,u);return;}
   u.segment={from:TILE(u),to:next,cost};u.path=a.route.slice();
  }
  const seg=u.segment,dx=seg.to.x-u.x,dy=seg.to.y-u.y,d=Math.hypot(dx,dy),step=5*dt;if(d>0)u.facing=Math.atan2(dx,-dy);
  if(d<=step){u.x=seg.to.x;u.y=seg.to.y;u.moveLeft=Math.max(0,u.moveLeft-seg.cost);u.moved=true;if(u.type==='artillery')u.actionLeft=false;u.segment=null;this.enterCell(u);this.updateVision();}
  else{u.x+=dx/d*step;u.y+=dy/d*step;}
 }
 income(owner){return Math.round(this.producers(owner).reduce((n,s)=>n+(s.type==='hq'?15:s.type==='post'?6:0),0)*(owner==='red'?PLAN[this.difficulty].income:1)*NATION_DOCTRINES[this.doctrines[owner]||'balanced'].income);}
 spawnCells(owner,type,base=this.hq(owner)){const cells=[];if(!this.canRecruit(owner,type,base))return cells;if(AIRPORT(base)){const slot=this.airportSlot(base);return slot?[slot]:[];}for(let r=1;r<=2;r++)for(let y=base.y-r;y<base.y+(base.height||1)+r;y++)for(let x=base.x-r;x<base.x+(base.width||1)+r;x++)if(INSIDE(x,y)&&DIST(base,{x,y})===r&&Number.isFinite(this.cost({type},x,y))&&(TYPES[type].air||!this.structureAt(x,y)&&!this.mines.some(m=>m.x===x&&m.y===y)))cells.push({x,y});return cells;}

 trainDuration(type){return TYPES[type].train*(this.mode==='rts'?10:1);}
 productionBatches(base){const batches=[],groups=new Map();for(const job of base?.queue||[]){const key=job.batch??job;if(!groups.has(key)){const batch=[];groups.set(key,batch);batches.push(batch);}groups.get(key).push(job);}return batches;}
 productionWait(base,type){let wait=0;for(const batch of this.productionBatches(base)){const job=batch[0],remaining=Math.max(0,this.trainDuration(job.type)-job.progress);wait+=remaining;if(job.type===type&&remaining>1e-8)return wait;}return wait+this.trainDuration(type);}
 enqueue(owner,type,base=this.hq(owner)){
  const t=SPEC(type,this.factionOf(owner)),price=this.recruitCost(type,base);if(this.winner||this.mode!=='rts'&&(owner!==this.turn||this.busy)||!this.canRecruit(owner,type,base)||base.queue.length>=this.queueLimit(base)||this.credits[owner]<price||this.atUnitCap(owner))return false;
  const job=base.queue.find(q=>q.type===type&&q.progress+1e-8<this.trainDuration(type));if(job&&job.batch==null)job.batch=this.nextBatchId++;
  this.credits[owner]-=price;base.queue.push({type,progress:job?.progress||0,batch:job?.batch??this.nextBatchId++});const text=`${t.name} em treinamento (${this.trainDuration(type)} ${this.mode==='rts'?'s':'turno(s)'}).`;if(this.multiplayer)this.log(text,[owner]);else this.report(text,base);return true;
 }
 production(owner,elapsed=1){
  for(const base of this.producers(owner)){const batches=this.productionBatches(base),batch=batches[0];if(!batch)continue;const job=batch[0],t=UT(job),duration=this.trainDuration(job.type),progress=job.progress+elapsed>=duration-1e-8?duration:job.progress+elapsed;for(const entry of batch)entry.progress=progress;if(progress+1e-8<duration)continue;
   // Keep a partially deployed batch ahead of later types when its exits are blocked.
   base.queue=batches.flat();
   for(const entry of batch){const cell=this.spawnCells(owner,entry.type,base).find(p=>!this.occupied(p.x,p.y,null,!!t.air));if(!cell)break;const ready=this.add(owner,entry.type,cell.x,cell.y);if(PLANE(ready)){ready.flightState='grounded';ready.airportId=base.id;}base.queue.splice(base.queue.indexOf(entry),1);const text=`${t.name} pronto para receber ordens.`;if(this.multiplayer)this.log(text,[owner]);else this.report(text,base);this.event('ready',base);}
  }
 }
 beginTurn(owner){
  this.turn=owner;if(owner===this.sides.find(s=>!this.isOut(s)))this.round++;
  for(const u of this.units){u.suppressed=Math.max(0,u.suppressed-1);u.revealed=Math.max(0,u.revealed-1);}
  for(const u of this.units)if(u.owner===owner){u.moveLeft=UT(u).move;u.actionLeft=true;u.moved=false;u.pending=false;u.path=[];u.segment=null;if(!PLANE(u)&&!u.airportSiteId)u.order=u.captureIntent?{type:'capture',targetId:u.captureIntent.targetId}:{type:'stop'};if(FLYER(u)){if(u.flightJob?.type!=='return')u.flightJob=null;u.pending=false;if(u.pursuitIntent)u.order={type:'pursuit',targetId:u.pursuitIntent.targetId};}if(UT(u).air)u.flareUsed=false;}
  for(const u of this.units)if(PLANE(u)&&u.owner!==owner){u.airReactionUsed=false;u.airReaction=null;}
  for(const a of this.units)if(a.type==='antiAirVehicle'&&a.owner!==owner){a.reactionReady=true;a.smokeUsed=false;a.smokeTime=0;}else if(a.owner===owner&&a.smokeTime>0&&UT(a).galix)a.smokeTime=0;this.advanceFires(0,owner);this.progressPlaneService(owner,1);this.progressAirports(owner,1);
   if(this.round>1){this.credits[owner]+=this.income(owner);this.production(owner);}this.updateVision();
  this.log(this.multiplayer?`Rodada ${this.round}: turno da equipe ${SIDE[owner]}.`:owner==='blue'?`Rodada ${this.round}: seu turno.`:`Rodada ${this.round}: turno da IA.`,this.sides);
  if(owner==='red'&&!this.multiplayer){this.planAI();this.aiQueue=this.aiEnabled?this.units.filter(u=>u.owner==='red').map(u=>u.id):[];this.claims=new Set();this.aiWait=.3;this.aiBuy();}
  if(this.mission)this.checkVictory();
 }
 endTurn(owner='blue'){if(this.mode==='rts'||this.winner||!this.sides.includes(owner)||this.turn!==owner||this.busy)return false;for(const u of this.units)if(u.owner===owner&&!u.moved&&u.actionLeft&&!AIR(u))u.entrenched=true;this.completeTurn(owner);return true;}
 aiAirportPlan(){
  const owner='red',hq=this.commandBase(owner);if(!hq||this.airports(owner).length)return false;
  const site=this.structures.find(s=>s.owner===owner&&s.type==='airportSite'),workers=this.units.filter(u=>u.owner===owner&&u.type==='engineer'&&u.hp>0&&(this.mode==='rts'||u.actionLeft));
  if(site){const usable=workers.filter(u=>!(u.aiBlocked?.until>this.aiNow()&&u.aiBlocked.x===site.x&&u.aiBlocked.y===site.y));let assigned=workers.filter(u=>u.airportSiteId===site.id).length>=2;if(!assigned&&usable.length>=2)assigned=this.assignAirportWorkers(site,usable.map(u=>u.id));let moved=false;if(this.mode==='turns')for(const u of usable)if(u.actionLeft&&!u.pending&&DIST(u,site)>1)moved=this.moveToward(u,site,1,Infinity,true)||moved;return assigned||moved;}
  const neutral=[...this.memory.red.values(),...this.structures.filter(s=>this.isVisible(owner,s))].filter(s=>AIRPORT(s)&&s.owner==='neutral').sort((a,b)=>DIST(a,hq)-DIST(b,hq));
  for(const s of neutral)for(const u of this.units.filter(u=>u.owner===owner&&u.type==='infantry').sort((a,b)=>DIST(a,s)-DIST(b,s)))if(u.captureIntent?.targetId===s.id||!u.pending&&!this.aiAvoid(s)&&this.order(u,'capture',{targetId:s.id,position:s}))return true;
  if(workers.length<2||this.credits[owner]<400)return false;
  if(!this.airportSearch){const cells=[];for(let y=0;y<ROWS-1;y++)for(let x=2;x<COLS-7;x++)cells.push({x,y});cells.sort((a,b)=>DIST(a,hq)-DIST(b,hq)||a.y-b.y||a.x-b.x);this.airportSearch={cells,index:0};}
  let checked=0,scanned=0;while(checked<4&&scanned++<256){const search=this.airportSearch,p=this.airportTarget||search.cells[search.index++%search.cells.length];if(!this.airportBuildSite(p)){this.airportTarget=null;continue;}checked++;
   if(this.mode==='rts'){if(this.buildAirport(workers.map(u=>u.id),p)){this.airportTarget=null;return true;}continue;}
   const nearby=workers.filter(u=>DIST(u,{...p,width:6,height:2})<=1);if(nearby.length>=2){this.airportTarget=null;return this.buildAirport(nearby.map(u=>u.id),p);}
   const goal={...p,width:6,height:2};if(workers.filter(u=>this.pathToRange(u,goal,1)!==null).length<2){this.airportTarget=null;continue;}
   this.airportTarget=p;for(const u of workers)if(u.actionLeft&&!u.pending)this.moveToward(u,goal,1,Infinity,true);return true;
  }return false;
 }
 aiAirDefenses(u){
  const contacts=new Map([...this.intel.values()].filter(e=>e.type==='antiAirVehicle').map(e=>[e.id,e]));
  for(const e of this.units)if(e.owner==='blue'&&e.hp>0&&e.type==='antiAirVehicle'&&(this.isVisible('red',e)||AIR(u)&&this.canIdentify(u,e))){const visible=this.isVisible('red',e),contact={id:e.id,type:e.type,owner:e.owner,x:e.x,y:e.y,hp:visible?e.hp:UT(e).hp,maxHp:visible?e.maxHp:UT(e).hp,seenAt:this.aiNow()};contacts.set(e.id,contact);this.intel.set(e.id,contact);}
  return [...contacts.values()];
 }
 aiAirFailure(u){
  const now=this.aiNow(),last=u.aiLastAirMission,m=u.aiAirMission||(last&&now-last.ended<=(this.mode==='rts'?3:1)&&DIST(u,{x:last.endX,y:last.endY})<=20?last:null);if(!m||now-m.since>(this.mode==='rts'?90:4))return;
  const failures=(this.plan.airFailures||[]).filter(f=>now-f.at<(this.mode==='rts'?600:30)),old=failures.find(f=>DIST(f,m)<=8),count=(old?.count||0)+1;
  this.plan.airFailures=failures.filter(f=>f!==old).concat({x:m.x,y:m.y,at:now,count,lostCost:(old?.lostCost||0)+m.cost,until:now+(this.mode==='rts'?120:6)*Math.min(3,count)}).slice(-8);
 }
 aiAirAvoid(p){const now=this.aiNow();return (this.plan.airFailures||[]).some(f=>f.until>now&&DIST(f,p)<=8);}
 aiAirSafePoint(u,defenses){
  const points=this.airports('red').map(CENTER);for(const d of defenses){const r=UT(d).range+12,dx=u.x-d.x,dy=u.y-d.y,k=r/Math.max(1,Math.abs(dx)+Math.abs(dy));points.push({x:d.x+(dx||1)*k,y:d.y+dy*k});}
  points.push({x:8,y:8},{x:COLS-9,y:8},{x:8,y:ROWS-9},{x:COLS-9,y:ROWS-9});
  const inside=points.map(p=>({x:Math.max(4,Math.min(COLS-5,p.x)),y:Math.max(4,Math.min(ROWS-5,p.y))}));
  return inside.filter(p=>defenses.every(d=>DIST(d,p)>UT(d).range+8)).sort((a,b)=>DIST(a,u)-DIST(b,u))[0]||this.plan.rally||u;
 }
 aiAirAttack(u,target,defenses){
  const weapon=target.type==='antiAirVehicle'&&target.radarOn&&u.ammo.antiRadiation>0?'antiRadiation':this.weapon(u,target);if(!weapon||!this.canIdentify(u,target))return null;
  const range=this.weaponRange(u,weapon),distance=DIST(u,target),k=distance>range?(distance-range+1)/Math.max(1,distance):0,launch={x:u.x+(target.x-u.x)*k,y:u.y+(target.y-u.y)*k};
  // ponytail: aproximação reta conservadora; planejar corredores de voo só se os testes de partida exigirem.
  const visible=this.isVisible('red',target),hp=visible?target.hp:UT(target).hp,cover=visible?this.cover(target):TERRAIN[this.terrainAt(target)].cover;
  const salvo=u.ammo[weapon]>=2&&hp>this.attackPower(u,weapon)*(1-cover)?2:1,run=salvo>1?{x:launch.x+(target.x-launch.x)*.6*UT(u).speed/Math.max(1,DIST(launch,target)),y:launch.y+(target.y-launch.y)*.6*UT(u).speed/Math.max(1,DIST(launch,target))}:launch;
  const dx=run.x-u.x,dy=run.y-u.y,danger=defenses.filter(d=>{
   // Distância Manhattan ao segmento: o mínimo ocorre em uma ponta ou no cruzamento de x/y.
   const times=[0,1];if(dx)times.push(Math.max(0,Math.min(1,(d.x-u.x)/dx)));if(dy)times.push(Math.max(0,Math.min(1,(d.y-u.y)/dy)));
   return times.some(t=>DIST(d,{x:u.x+dx*t,y:u.y+dy*t})<=UT(d).range+2);
  });
  const cost=Math.min(UT(u).cost,...this.airports('red').map(b=>this.recruitCost(u.type,b))),value=UT(target).cost||(target.type==='hq'?800:300),risk=danger.reduce((n,d)=>n+UT(d).damage,0)/Math.max(1,u.hp)*cost;
  if(this.aiAirAvoid(target)||danger.length&&(target.type==='antiAirVehicle'||risk>value||u.hp<u.maxHp*.65))return null;
  return {weapon,mode:target.type==='antiAirVehicle'||defenses.some(d=>DIST(d,target)<=UT(d).range+8)?weapon:'auto',salvo,cost,value,score:value-risk-DIST(u,target)*.5,exit:danger.length||target.type==='antiAirVehicle'?this.aiAirSafePoint(u,defenses):null};
 }
 aiPlaneAct(u,foes){
  if(u.flightState==='service'||this.mode==='turns'&&!u.actionLeft)return;
  const useful=Object.entries(u.ammo).some(([w,n])=>w!=='jetGun'&&n>0),withdraw=AIR(u)&&(!useful||u.hp/u.maxHp<.4||u.flares===0),defenses=AIR(u)?this.aiAirDefenses(u):[];
  if(u.pending){
   if(this.mode==='rts'&&!u.runway&&u.flightJob?.type!=='return'){
    const j=u.flightJob,target=j?.type==='strike'&&this.get(j.targetId),unsafe=target&&this.canIdentify(u,target)&&!this.aiAirAttack(u,target,defenses)||j?.type==='bombRun'&&defenses.some(d=>DIST(d,j.start)<=UT(d).range+8||DIST(d,j.end)<=UT(d).range+8);
    if(unsafe&&defenses.length)this.plan.airResponse={...defenses[0],owner:'blue',until:this.aiNow()+30};
    if((withdraw||unsafe)&&!this.order(u,'return'))this.order(u,'patrol',this.aiAirSafePoint(u,defenses));
   }return;
  }u.weaponMode='auto';
  if(!AIR(u)){const price=Object.entries(UT(u).ammo).reduce((n,[w,q])=>n+Math.max(0,q-(u.ammo[w]||0))*AMMO_PRICE[w],0);if(u.hp<u.maxHp*.8||u.flares===0||price>0&&this.credits.red>=price){this.servicePlane(u);return;}if(useful)this.order(u,'takeoff');return;}
  if(withdraw){if(this.order(u,'return'))return;this.order(u,'patrol',this.plan.rally||u);return;}
  const blocked=defenses.find(d=>this.aiAirAvoid(d)||DIST(d,u)<=UT(d).range+2);
  if(blocked){this.plan.airResponse={...blocked,owner:'blue',until:this.aiNow()+(this.mode==='rts'?30:2)};this.order(u,'patrol',this.aiAirSafePoint(u,defenses));return;}
  if(u.ammo.cruiseMissile>0&&u.cooldown<=1e-8){for(const p of this.bombardTargets(u))if(!this.aiAirAvoid(p)&&!this.all().some(v=>v.owner===u.owner&&!AIR(v)&&Math.abs(NEAREST(v,p).x-p.x)<=1.5&&Math.abs(NEAREST(v,p).y-p.y)<=1.5)&&this.order(u,'strikeCell',{x:p.x,y:p.y,weapon:'cruiseMissile'})){u.aiAirMission={x:p.x,y:p.y,cost:UT(u).cost,since:this.aiNow(),exit:this.aiAirSafePoint(u,defenses)};return;}}
  if(BOMB_TYPES.some(w=>u.ammo[w]>0)){for(const p of this.bombardTargets(u)){const danger=defenses.find(d=>DIST(d,p)<=UT(d).range+8);if(danger||this.aiAirAvoid(p)){if(danger)this.plan.airResponse={...danger,owner:'blue',until:this.aiNow()+(this.mode==='rts'?30:2)};continue;}const start={x:Math.max(0,p.x-2),y:p.y},end={x:Math.min(COLS-1,p.x+2),y:p.y};if(this.bombLine(u.owner,start,end)&&!this.all().some(v=>v.owner===u.owner&&!AIR(v)&&DIST(v,p)<3)&&this.order(u,'bombRun',{start,end})){u.aiAirMission={x:p.x,y:p.y,cost:UT(u).cost,since:this.aiNow(),exit:this.aiAirSafePoint(u,defenses)};return;}}}
  const targets=[...new Map([...foes,...this.units.filter(e=>e.owner==='blue'&&e.type==='antiAirVehicle'&&e.radarOn&&this.canIdentify(u,e))].map(e=>[e.id,e])).values()];
  const ranked=targets.map(target=>({target,attack:this.aiAirAttack(u,target,defenses)})).filter(v=>v.attack).sort((a,b)=>b.attack.score-a.attack.score);
  for(const {target,attack}of ranked)if(this.order(u,'attack',{targetId:target.id,weapon:attack.mode,salvo:attack.salvo})){u.aiAirMission={targetId:target.id,x:target.x,y:target.y,cost:attack.cost,value:attack.value,since:this.aiNow(),exit:attack.exit};return;}
  if(defenses.length&&targets.length){this.plan.airResponse={...defenses[0],owner:'blue',until:this.aiNow()+(this.mode==='rts'?30:2)};if(!u.ammo.antiRadiation&&UT(u).ammo.antiRadiation&&this.order(u,'return'))return;this.order(u,'patrol',this.aiAirSafePoint(u,defenses));return;}
  const goal=this.plan.objective||this.plan.rally||{x:COLS/2,y:ROWS/2},safe=defenses.some(d=>DIST(d,goal)<=UT(d).range+8)?this.aiAirSafePoint(u,defenses):goal;if(DIST(u.patrol||u,safe)>4)this.order(u,'patrol',safe);
 }
 aiPassengers(goal,carrier=null){
  const reserved=new Set(this.units.filter(c=>c!==carrier&&c.owner==='red'&&c.hp>0&&UT(c).capacity).map(c=>c.aiPassengerId));
  return this.units.filter(p=>p.owner==='red'&&FOOT(p)&&p.type!=='commander'&&p.hp>=p.maxHp*.5&&!p.airportSiteId&&!p.captureIntent&&!p.aiObjective&&!reserved.has(p.id)&&!['repair','service','attack','build','demine'].includes(p.order.type)&&DIST(p,goal)>8);
 }
 aiCargoMission(u,goal){for(const p of u.cargo||[])p.aiObjective={...goal,until:this.aiNow()+(this.mode==='rts'?120:12)};}
 aiTransport(u){
  if(this.mode==='turns'&&!u.actionLeft)return;const goal=u.transportGoal||this.plan.raid||this.plan.objective||this.plan.rally;if(!goal)return;
  const passengers=()=>this.aiPassengers(goal,u);
  const danger=this.units.some(e=>e.owner!==u.owner&&this.isVisible(u.owner,e)&&DIST(u,e)<=5&&(this.weapon(e,u)||(u.cargo||[]).some(p=>this.weapon(e,p))||BARRAGE(e)));
  if(this.mode==='rts'&&u.job?.type==='move'){
   if(!danger&&!this.aiAvoid(goal)&&this.aiTransportRouteSafe(u,u.job.route))return;
   this.order(u,'stop');if(u.segment)return;
  }
  if((u.cargo||[]).length){
   u.transportGoal||={...goal};this.aiCargoMission(u,goal);
   if(DIST(u,goal)<=4||danger||this.aiAvoid(goal)||u.aiUnload){
    if(AIR(u)&&u.altitude!=='low'){this.order(u,'altitude',{altitude:'low'});return;}
    if(this.order(u,'disembark')){if(!u.cargo.length){u.transportGoal=null;u.aiUnload=false;}u.aiPassengerId=null;return;}
    for(const cell of this.landingCells('transportTruck',TILE(u),4))if(this.landingCells(u.cargo[0].type,cell).length&&this.moveToward(u,cell,0)){u.aiUnload=true;return;}return;
   }
   if(this.mode==='turns'){const extra=passengers().find(p=>this.canEmbark(u,p));if(extra&&this.order(u,'embark',{targetId:extra.id}))return;}
   this.moveToward(u,goal,3);return;
  }
  if(danger||this.aiAvoid(goal)){u.aiPassengerId=null;return;}
  const available=passengers(),passenger=available.find(p=>p.id===u.aiPassengerId)||available.sort((a,b)=>DIST(a,u)-DIST(b,u)||a.id-b.id).slice(0,4).find(p=>{const route=this.pathToRange(u,p,1);return route!==null&&this.aiTransportRouteSafe(u,route);});
  if(!passenger){u.aiPassengerId=null;return;}u.aiPassengerId=passenger.id;
  if(DIST(u,passenger)>1){if(!this.moveToward(u,passenger,1))u.aiPassengerId=null;return;}
  if(passenger.pending||passenger.segment){this.order(passenger,'stop',{},true);return;}
  if(AIR(u)&&u.altitude!=='low'){this.order(u,'altitude',{altitude:'low'});return;}
  if(this.order(u,'embark',{targetId:passenger.id})){u.transportGoal={...goal};u.aiPassengerId=null;
   if(this.mode==='rts')for(const p of passengers())if(this.canEmbark(u,p))this.order(u,'embark',{targetId:p.id});
   this.aiCargoMission(u,goal);
  }else u.aiPassengerId=null;
 }
 aiBuyTransport(){
  const now=this.aiNow();if(now<(this.aiTransportReview??-Infinity))return false;this.aiTransportReview=now+(this.mode==='rts'?8:1);
  const base=this.commandBase('red'),goal=this.plan.raid||this.plan.objective;if(!base||!goal||this.aiAvoid(goal)||DIST(base,goal)<10)return false;
  const foes=this.units.filter(u=>u.owner==='blue'&&this.isVisible('red',u)),danger=foes.some(u=>DIST(u,base)<=8);if(danger)return false;
  const population=this.aiArmy().length+this.producers('red').reduce((n,s)=>n+s.queue.length,0);if(population>=PLAN[this.difficulty].army)return false;
  const airport=this.airports('red')[0],support=foes.some(u=>AIR(u))?'missileInfantry':foes.some(u=>UT(u).vehicle)?'antitank':'machinegun',cargo={infantry:2,[support]:2,recon:1};if(airport&&population+5+(this.airdropPlane('red')?0:1)<=PLAN[this.difficulty].army&&now>=(this.aiAirdropAfter??-Infinity)){
   const cells=this.landingCells('recon',TILE(goal),3).filter(p=>this.visible.red[KEY(p.x,p.y)]&&!this.aiAvoid(p)&&!foes.some(e=>['antiAirVehicle','missileInfantry'].includes(e.type)&&DIST(e,p)<=UT(e).range+3));
   for(const cell of cells)if(this.requestAirdrop('red',airport.id,cargo,cell)){this.aiCargoMission(this.airdropPlane('red'),goal);this.aiAirdropAfter=now+(this.mode==='rts'?45:4);return true;}
  }
  if(this.units.some(u=>u.owner==='red'&&UT(u).capacity&&!UT(u).airdropPlane)||this.structures.some(s=>s.owner==='red'&&s.queue?.some(q=>UT(q).capacity)))return false;
  const foot=this.aiPassengers(goal);if(foot.length<2||this.credits.red<320)return false;
  // Caminhão se a rota for livre e segura; senão helicóptero (ponte travada pelo inimigo).
  const usable=type=>{const c={...foot[0],type},r=this.pathToRange(c,goal,3);return r!==null&&this.aiTransportRouteSafe(c,r);},type=['transportTruck','transportHelicopter'].find(usable);
  return type?this.enqueue('red',type,base):false;
 }
 aiArmy(){return [...this.units.filter(u=>u.owner==='red').flatMap(u=>[u,...u.cargo||[]]),...(this.drops||[]).filter(d=>d.passenger.owner==='red').map(d=>d.passenger)];}
 aiBuy(){
  if(!this.aiEnabled)return;const hq=this.commandBase('red'),cfg=PLAN[this.difficulty],bases=this.producers('red'),queue=bases.flatMap(s=>s.queue);if(!hq||queue.length>=cfg.queue)return;
  const army=this.aiArmy();if(army.length+queue.length>=cfg.army)return;
  const count=type=>army.filter(u=>u.type===type).length+queue.filter(q=>q.type===type).length;
  const rally=this.plan.rally||hq,reserve=60*army.filter(u=>u.aiBuild&&u.aiBuild.until>this.aiNow()&&u.order?.type!=='build').length;
  const buy=type=>{const options=bases.filter(s=>this.canRecruit('red',type,s)&&this.credits.red-reserve>=this.recruitCost(type,s)&&s.queue.length<this.queueLimit(s)&&this.spawnCells('red',type,s).some(p=>!this.occupied(p.x,p.y,null,!!TYPES[type].air)));
   // Não recruta num posto sob fogo conhecido (a tropa nasceria na mira); só se todos estiverem assim.
   const safe=options.filter(s=>s.type==='hq'||this.aiDangerAt(s,6)===0),base=(safe.length?safe:options).sort((a,b)=>this.productionWait(a,type)-this.productionWait(b,type)||this.recruitCost(type,a)-this.recruitCost(type,b)||DIST(a,rally)-DIST(b,rally)||a.id-b.id)[0];return base?this.enqueue('red',type,base):false;};
  // Só o que a IA vê conta: aeronaves, blindados e tropas a pé azuis ajustam a doutrina; ameaça perto do QG libera compra imediata.
  const seen=this.all().filter(e=>e.owner==='blue'&&e.hp>0&&this.isVisible('red',e));
  const skies=Math.min(3,seen.filter(AIR).length),armor=Math.min(4,seen.filter(e=>UT(e).vehicle&&!AIR(e)).length),foot=Math.min(6,seen.filter(e=>!UT(e).vehicle&&!UT(e).structure&&!AIR(e)).length);
  const threatened=seen.some(e=>!UT(e).structure&&DIST(e,hq)<=6);
  const airBlocked=this.plan.airResponse?.until>this.aiNow();
  // Infantaria é a única construtora de postos. Com pressão econômica (posto perdido ou poucos postos) ela vem antes de
  // aviação e doutrina; obras em deslocamento seguram 60 créditos cada.
  const posts=this.structures.filter(s=>s.owner==='red'&&s.type==='post'&&s.hp>0).length,unguarded=this.aiUnguarded().length,goal=this.aiPostGoal(),pressure=this.aiPressure();
  const free=army.filter(u=>u.type==='infantry'&&!u.aiGuard).length+queue.filter(q=>q.type==='infantry').length,need=posts<goal?(pressure?Math.min(3,goal-posts):1):0;
  // Economia primeiro: faltando postos, a infantaria construtora é a primeira compra; com a economia montada (≥4 postos)
  // ela cede a vez à aviação. Sem pressão, o orçamento restante segue o fluxo normal.
  const late=this.aiNow()>=(this.mode==='rts'?360:12),eco=posts>=4||late,built=eco||this.credits.red>=800; // rica: aeroporto não espera
  // O construtor é pago e o resto do orçamento segue o fluxo normal no mesmo ciclo (uma compra extra no máximo).
  let lacking=free<need;
  if(lacking&&(pressure||!eco&&!threatened)&&this.credits.red>=TYPES.infantry.cost&&buy('infantry'))lacking=free+1<need;
  if(airBlocked&&!threatened&&!count('rocketArtillery')){buy('rocketArtillery');return;}
  if(!threatened&&!lacking&&!(skies&&!count('antiAirVehicle'))&&this.aiBuyTransport())return;
  const planes=army.filter(u=>PLANE(u)&&!UT(u).airdropPlane).length+queue.filter(q=>UT(q).plane).length;
  const suffix={red:'Red',blue:'Blue',[FRANCE]:'Fr'}[this.factionOf('red')]||'Red';
  if(this.airports('red').length&&planes<cfg.planes&&!threatened&&!airBlocked&&!lacking){
   const structures=[...this.memory.red.values()].filter(s=>s.owner==='blue'),knownGround=armor+foot||structures.length;
   const fighter='fighter'+suffix,stealth='stealthFighter'+suffix,multirole='multirole'+suffix,bomber='bomber'+suffix;
   const intercept=skies&&count(fighter)+count(stealth)<skies;
   const type=intercept?(skies>=2&&count(fighter)?stealth:fighter):knownGround?(planes>=2&&count(multirole)&&army.length>=12&&(structures.length>=2||foot>=3)&&!count(bomber)?bomber:multirole):planes===0?fighter:multirole;
   const available=bases.filter(s=>AIRPORT(s)&&this.canRecruit('red',type,s)&&s.queue.length<this.queueLimit(s)&&this.airportSlot(s));
   // A aeronave sai quando o caixa a paga; poupa por ela só dentro da janela limitada abaixo. O resto vira tropa no mesmo ciclo.
   // Exército terrestre primeiro: sem ≥12 unidades (+4 por aeronave), a aeronave só entra com folga (1,5× o preço) ou com
   // aeronave inimiga à vista; assim o caixa vira tropa em vez de esperar o avião.
   const ready=army.length>=12+4*planes||skies||available.length&&this.credits.red>=this.recruitCost(type,available[0])*1.5;
   if(ready&&available.length&&(planes===0||skies||knownGround)){
    if(buy(type)||skies&&intercept)return;
    // Janela de poupança limitada (decisão do usuário): segura o caixa só se a aeronave sai em ≤45 s (RTS) / 2 rodadas.
    const rate=this.income('red')/(this.mode==='rts'?10:1),wait=(this.recruitCost(type,available[0])-this.credits.red)/Math.max(rate,1e-6);
    if(wait<=(this.mode==='rts'?45:2))return;
   }
  }
  if(!threatened&&built&&!lacking&&!(skies&&!count('antiAirVehicle'))&&!this.airports('red').length){const queued=count('engineer');if(queued<2&&this.credits.red>=465){buy('engineer');return;}} // sem poupar para o aeroporto: ele sai quando o caixa sobra
  // Drone: um para reconhecimento; artilharia de mísseis quando já conhece estrutura azul (dano ×2).
  const boost={antiAirVehicle:1.5*skies,missileInfantry:1.5*skies,helicopterAir:skies,antitank:.75*armor,helicopterGround:1.5*armor,heavyTank:.5*armor,machinegun:.4*foot+.5*unguarded,
   infantry:(this.plan.routeKind==='crossing'?.75:0)+.5*unguarded,reconDrone:count('reconDrone')?0:.5,stealthDrone:!count('stealthDrone')&&(this.mode==='rts'?this.time/30:this.round)>=3?.4:0,rocketArtillery:[...this.memory.red.values()].some(s=>s.owner==='blue')?.5:0};
  const norm=DOCTRINE.reduce((a,d)=>a+d.share,0),size=Math.max(8,army.length+queue.length),clock=this.mode==='rts'?this.time/30:this.round;
  const ranked=DOCTRINE.map((d,i)=>({type:d.type,i,share:d.share,score:Math.max(d.min||0,SCHEDULE[d.type]&&clock>=SCHEDULE[d.type]?1:0,Math.round(d.share/norm*size))-count(d.type)+(boost[d.type]||0)})).sort((x,y)=>y.score-x.score||x.i-y.i);
  // Poupa pelo tipo de maior déficit até poder pagá-lo: o caro entra quando junta o dinheiro, e não é trocado pelas baratas.
  const top=ranked[0];
  if(this.credits.red-reserve>=UT(top).cost){buy(top.type);return;}
  // Sem nenhum lançador de mísseis, compra o barato enquanto poupa pelo veículo antiaéreo; com um deles, espera.
  if(top.type==='antiAirVehicle'&&!count('missileInfantry')&&this.credits.red>=TYPES.missileInfantry.cost){buy('missileInfantry');return;}
  // Poupa para a classe escolhida; só gasta com o que tem para defender a base.
  // Defesa aérea em espera não é trocada por um lançador barato.
  if(threatened&&!['antiAirVehicle','missileInfantry'].includes(top.type)){const pick=ranked.find(r=>DEFENSE.includes(r.type)&&UT(r).cost<=this.credits.red);if(pick)buy(pick.type);}
 }
 moveToward(u,target,near=1,leg=Infinity,batch=false){
  if(u.owner==='red'&&u.aiBlocked?.until>this.aiNow()&&u.aiBlocked.x===target.x&&u.aiBlocked.y===target.y)return false;
  const route=this.pathToRange(u,target,near);if(!route?.length||u.owner==='red'&&UT(u).capacity&&!this.aiTransportRouteSafe(u,route))return false;
  // Fora da onda aprovada, terrestres não atravessam zona de perigo conhecida (travessia bloqueada); batedores, defesa do
  // próprio entorno e destinos dentro da zona (combate já decidido por outra regra) ficam de fora.
  if(u.owner==='red'&&!AIR(u)&&u.type!=='recon'&&!(this.plan.phase==='attack'&&this.plan.wave?.includes(u.id))){
   const zones=Object.values(this.plan.danger||{}).filter(z=>DIST(z,u)>6&&DIST(z,target)>8);
   if(zones.some(z=>route.some((c,i)=>i%2===0&&DIST(z,c)<=6)))return false;
  }
  const part=this.trimPath(u,route).slice(0,leg);
  const ok=part.length?this.order(u,'move',part[part.length-1],batch):false;if(ok&&u.owner==='red')u.aiNav={x:target.x,y:target.y};return ok;
 }
 // Valor de combate: custo (100 sem custo) pela fração de vida. Combatentes da onda: tropas com arma, sem comandante, engenheiro e batedor.
 power(u){return UT(u).structure?0:(UT(u).cost||100)*u.hp/u.maxHp;}
 fighter(u){const t=UT(u);return u.owner==='red'&&!u.aiGuard&&!t.structure&&!t.plane&&t.damage>0&&!['commander','engineer','recon','stealthDrone','transportTruck'].includes(u.type);}
 presumedHQ(hq){return{x:COLS-(hq.width||1)-hq.x,y:ROWS-(hq.height||1)-hq.y,width:hq.width,height:hq.height};} // Espelha o retângulo completo da base.
 // Ponto de encontro: casa alcançável por tanque mais próxima de 30% do caminho entre o QG vermelho e o QG azul presumido.
 rallyPoint(hq){
  const far=this.presumedHQ(hq),aim={x:Math.round(hq.x+(far.x-hq.x)*.3),y:Math.round(hq.y+(far.y-hq.y)*.3)},start=this.spawnCells('red','tank',hq)[0]||hq;
  const seen=this.reachable({type:'tank',owner:'red',x:start.x,y:start.y},Array(SIZE).fill(null),this.structureGrid({owner:'red'}));let best=null;
  for(let k=0;k<SIZE;k++)if(seen[k]){const c={x:k%COLS,y:(k-k%COLS)/COLS};if(!best||DIST(c,aim)<DIST(best,aim))best=c;}return best||aim;
 }
 // Postos vermelhos sem guarda viva (o QG tem o ponto de encontro).
 aiUnguarded(){return this.structures.filter(s=>s.owner==='red'&&s.type==='post'&&s.hp>0&&!this.units.some(u=>u.owner==='red'&&u.hp>0&&u.aiGuard===s.id));}
 // Um guarda por posto (máx. 25% do exército): o defensor mais próximo que não esteja em onda, captura ou transporte.
 aiGuards(){
  const army=this.units.filter(u=>u.owner==='red'&&u.hp>0),posts=this.structures.filter(s=>s.owner==='red'&&s.type==='post'&&s.hp>0),wave=this.plan.phase==='attack'?this.plan.wave:[];
  for(const u of army)if(u.aiGuard&&!posts.some(s=>s.id===u.aiGuard))u.aiGuard=null;
  const cap=Math.floor(army.length*.25);let guards=army.filter(u=>u.aiGuard).length;
  for(const s of this.aiUnguarded()){
   if(guards>=cap)break;
   if(this.aiDangerAt(s,8)>TYPES.infantry.cost*2)continue; // um guarda não segura força maior; o posto vira alvo de reforço, não de sacrifício
   const pick=army.filter(u=>!u.aiGuard&&DEFENSE.includes(u.type)&&!wave.includes(u.id)&&!u.captureIntent&&!u.aiBuild&&!u.aiObjective&&!u.aiPassengerId&&!u.airportSiteId&&!u.embarkedIn&&u.hp>=u.maxHp*.5).sort((a,b)=>DIST(a,s)-DIST(b,s)||a.id-b.id)[0];
   if(pick){pick.aiGuard=s.id;guards++;}
  }
 }
 // Meta de postos: sempre ≥4 e sobe com a partida (3 + minutos); acompanha o pico próprio e o azul conhecido +1. Teto: PLAN[dificuldade].posts.
 aiPostGoal(){const blue=[...this.memory.red.values()].filter(s=>s.type==='post'&&s.owner==='blue').length,minutes=this.mode==='rts'?this.time/60:this.round/2;return Math.min(PLAN[this.difficulty].posts,Math.max(4,this.plan.peakPosts||0,blue+1,3+Math.floor(minutes)));}
 // Pressão econômica: perdeu posto há pouco, ou passou o início da partida com menos de 2 postos.
 aiPressure(){const p=this.plan,now=this.aiNow();return !!p.lostSites?.some(c=>c.until>now)||now>=(this.mode==='rts'?60:2)&&this.structures.filter(s=>s.owner==='red'&&s.type==='post'&&s.hp>0).length<2;}
 // Registra o pico de postos e onde cada um caiu: esses locais são os primeiros a reconstruir.
 aiTrackPosts(){
  const p=this.plan,now=this.aiNow(),mine=this.structures.filter(s=>s.owner==='red'&&s.type==='post'&&s.hp>0);
  const gone=(p.known||[]).filter(k=>!mine.some(m=>m.id===k.id)).map(({x,y})=>({x,y,until:now+(this.mode==='rts'?180:12)}));
  p.lostSites=[...gone,...(p.lostSites||[])].filter(c=>c.until>now&&!mine.some(m=>DIST(m,c)<3)).slice(0,4);
  p.known=mine.map(({id,x,y})=>({id,x,y}));p.peakPosts=Math.max(p.peakPosts||0,mine.length);
 }
 // Zonas de perigo: onde a IA viu força azul (ou perdeu tropa sem virar posto) nos últimos 240 s. Sobrevivem ao
 // esquecimento do contato móvel, para a infantaria não voltar sozinha a um gargalo bloqueado.
 aiTrackDanger(){
  const p=this.plan,now=this.aiNow(),ttl=this.mode==='rts'?240:12,d=p.danger||(p.danger={});
  for(const e of this.intel.values())if(!UT(e).structure&&!AIR(e))d[e.id]={x:e.x,y:e.y,power:this.power(e),until:now+ttl};
  const army=this.aiArmy(),alive=new Set(army.map(u=>u.id)),prev=p.redSeen||{};
  for(const [id,v] of Object.entries(prev))if(!alive.has(Number(id))&&!this.structures.some(s=>s.owner==='red'&&s.type==='post'&&DIST(s,v)<=2))d['x'+id]={x:v.x,y:v.y,power:Math.max(240,v.power*2),until:now+ttl*2}; // quem matou superava a tropa: ≥ um blindado pesado
  p.redSeen=Object.fromEntries(this.units.filter(u=>u.owner==='red'&&u.hp>0&&!AIR(u)).map(u=>[u.id,{x:Math.round(u.x),y:Math.round(u.y),power:this.power(u)}]));
  for(const k of Object.keys(d))if(d[k].until<=now)delete d[k];
 }
 aiDangerAt(c,radius=7){return Object.values(this.plan.danger||{}).filter(z=>DIST(z,c)<=radius).reduce((a,z)=>a+z.power,0);}
 // Força azul conhecida (ou baixas próprias) ao longo da rota até o destino; Infinity sem rota. Evita travessias bloqueadas.
 aiPathDanger(route){return Object.values(this.plan.danger||{}).filter(z=>route.some((c,i)=>i%2===0&&DIST(z,c)<=6)).reduce((a,z)=>a+z.power,0);}
 aiRouteDanger(u,target,near=1){
  if(!Object.keys(this.plan.danger||{}).length)return 0;
  const route=this.pathToRange(u,target,near);return route===null?Infinity:this.aiPathDanger(route);
 }
 // Reconhecimento de postos: quando um posto não vermelho está à vista, guarda quando e quanta força azul havia ao redor.
 // Só informação de visão; a captura e a escolha de objetivo usam esse registro enquanto ele é recente.
 aiRecordPosts(){
  const p=this.plan,now=this.aiNow(),log=p.postIntel||(p.postIntel={});
  for(const s of this.memory.red.values())if(s.type==='post'&&s.owner!=='red'&&this.isVisible('red',s))
   log[s.id]={at:now,threat:this.units.filter(e=>e.owner==='blue'&&e.hp>0&&DIST(e,s)<=6&&this.isVisible('red',e)).reduce((a,e)=>a+this.power(e),0)};
 }
 // Força azul associada a uma estrutura: o maior entre o que a IA vê/lembra por perto e o último reconhecimento do posto.
 aiGuardPower(s,radius=8){return Math.max([...this.intel.values()].filter(e=>DIST(e,s)<=radius).reduce((a,e)=>a+this.power(e),0),this.plan.postIntel?.[s.id]?.threat||0);}
 // Posto não vermelho mais próximo do QG cujo reconhecimento venceu (nunca visto ou antigo) e que nenhum outro batedor já busca.
 aiScoutTarget(u,hq){
  const p=this.plan,now=this.aiNow(),stale=this.mode==='rts'?60:4,taken=new Set(this.units.filter(v=>v!==u&&v.owner==='red'&&v.hp>0&&v.aiScout).map(v=>v.aiScout));
  return [...this.memory.red.values()].filter(s=>s.type==='post'&&s.owner!=='red'&&!taken.has(s.id)&&!this.aiAvoid(s)&&now-(p.postIntel?.[s.id]?.at??-Infinity)>=stale&&(AIR(u)||this.aiDangerAt(s,8)===0)).sort((a,b)=>DIST(a,hq)-DIST(b,hq)||a.id-b.id)[0]||null;
 }
 // Batedor/drone: vai até a distância de visão do posto vencido; ao vê-lo, aiRecordPosts atualiza o registro e ele segue.
 aiScoutPosts(u,hq){
  const t=this.aiScoutTarget(u,hq);u.aiScout=t?t.id:null;
  return !!t&&this.moveToward(u,t,Math.max(1,UT(u).vision-3));
 }
 // Local para um posto novo: primeiro onde um posto próprio caiu; depois lado vermelho do mapa a ≥6 casas de qualquer
 // estrutura ou obra de outra tropa. Nunca perto de inimigo visto. ponytail: grade de passo 3 por decisão, sem cache.
 aiPostSite(u,hq,far){
  const now=this.aiNow(),others=this.units.filter(v=>v!==u&&v.owner==='red'&&v.aiBuild),foes=[...this.intel.values()].filter(e=>!UT(e).structure);
  const free=c=>!this.aiAvoid(c)&&!others.some(v=>DIST(v.aiBuild,c)<6)&&!foes.some(e=>DIST(e,c)<=7)&&this.aiDangerAt(c,8)===0,grid=[];
  for(let y=3;y<ROWS-3;y+=3)for(let x=3;x<COLS-3;x+=3){
   const c={x,y},own=DIST(c,hq)+2<=DIST(c,far);
   // Além da faixa vermelha, só até a linha do meio e com a casa à vista agora.
   if(!(own||DIST(c,hq)<=DIST(c,far)&&this.visible.red[KEY(x,y)])||!free(c)||this.structures.some(s=>DIST(s,{...c,width:2,height:2})<6))continue;
   grid.push(c);
  }
  const lost=(this.plan.lostSites||[]).filter(c=>c.until>now&&free(c)).sort((a,b)=>DIST(a,u)-DIST(b,u));
  return [...lost,...grid.sort((a,b)=>DIST(a,u)-DIST(b,u)).slice(0,8)].find(c=>this.buildSite(u,c)&&this.aiRouteDanger(u,c,0)===0)||null;
 }
 // Expansão: a infantaria vai a um local seguro e converte-se em posto. Um construtor por vez; com pressão econômica,
 // dois (três com ≤1 posto). Devolve true se usou o turno da tropa.
 aiExpand(u,hq,far){
  if(u.type!=='infantry'||u.hp<u.maxHp*.5||u.aiGuard||u.captureIntent||u.aiObjective||u.airportSiteId)return false;
  const now=this.aiNow(),posts=this.structures.filter(s=>s.owner==='red'&&s.type==='post'&&s.hp>0).length,builders=this.units.filter(v=>v!==u&&v.owner==='red'&&v.hp>0&&v.aiBuild).length;
  if(posts+builders>=this.aiPostGoal()||builders>=(this.aiPressure()?(posts<=1?3:2):1)){u.aiBuild=null;return false;} // sem vaga de obra: solta a reserva
  if(u.aiBuild&&(u.aiBuild.until<=now||this.aiDangerAt(u.aiBuild,8)>0||DIST(u,u.aiBuild)>0&&!this.buildSite(u,u.aiBuild)))u.aiBuild=null;
  if(!u.aiBuild){const site=this.aiPostSite(u,hq,far);if(!site)return false;u.aiBuild={x:site.x,y:site.y,until:now+(this.mode==='rts'?90:8)};}
  if(DIST(u,u.aiBuild)>0)return this.moveToward(u,u.aiBuild,0)||!!(u.aiBuild=null);
  if(this.credits.red<60){this.hold(u);return true;}
  if(this.order(u,'build'))return true;
  u.aiBuild=null;return false;
 }
 // Incursão: o posto azul conhecido menos guardado, fora das áreas onde a IA já perdeu uma onda.
 aiRaidTarget(hq){
  const guard=s=>this.aiGuardPower(s);
  return [...this.memory.red.values()].filter(s=>s.type==='post'&&s.owner==='blue'&&!this.aiAvoid(s)&&!(this.plan.defeats||[]).some(d=>DIST(d,s)<=10)).sort((a,b)=>guard(a)-guard(b)||DIST(a,hq)-DIST(b,hq))[0]||null;
 }
 aiNow(){return this.mode==='rts'?this.time:this.round;}
 aiAvoid(goal){const now=this.aiNow();return (this.plan.failures||[]).some(f=>f.until>now&&(f.reason==='transport-loss'?DIST(f,goal)<=8:f.x===goal.x&&f.y===goal.y));}
 aiTransportRouteSafe(u,route){
  const now=this.aiNow(),threats=this.units.filter(e=>e.owner==='blue'&&e.hp>0&&this.isVisible('red',e)&&(this.weapon(e,u)||BARRAGE(e)));
  return !route.some(p=>(this.plan.failures||[]).some(f=>f.reason==='transport-loss'&&f.until>now&&DIST(p,f)<=8&&DIST(p,f)<DIST(u,f))||threats.some(e=>DIST(p,e)<=(BARRAGE(e)?barrageRange(e):this.range(e,u))+2&&DIST(p,e)<DIST(u,e)));
 }
 aiFailure(goal,reason){if(!goal)return;const now=this.aiNow(),p=this.plan;p.failures=(p.failures||[]).filter(f=>f.until>now&&!(f.x===goal.x&&f.y===goal.y));p.failures.push({x:goal.x,y:goal.y,id:goal.id,reason,until:now+(this.mode==='rts'?90:6)});p.failures=p.failures.slice(-8);p.probe=null;
  // Derrotas não expiram: a IA só volta ao mesmo ponto com 1,5× a força que perdeu ali.
  if(reason==='losses')p.defeats=[...(p.defeats||[]),{x:goal.x,y:goal.y,power:p.waveStart||0}].slice(-8);}
 aiLost(goal){return Math.min((this.plan.defeats||[]).filter(d=>DIST(d,goal)<=10).reduce((m,d)=>Math.max(m,d.power*1.5),0),PLAN[this.difficulty].army*50);}
 // Progresso físico, inclusive ordens pendentes: uma tropa bloqueada volta à fila de decisões.
 aiProgress(){
  const now=this.aiNow(),limit=this.mode==='rts'?12:2;
  for(const u of this.units.filter(u=>u.owner==='red'&&!PLANE(u))){
   if(u.aiBlocked?.until<=now)u.aiBlocked=null;
   const moving=this.mode==='rts'?u.job&&['move','capture','attack','airportWork'].includes(u.job.type):u.aiNav;
   if(!moving){u.aiProgress=null;continue;}
   const q=u.aiProgress;if(!q||DIST(u,q)>=1){u.aiProgress={x:u.x,y:u.y,since:now};continue;}
   if(now-q.since<limit)continue;
   const target=u.captureIntent?.position||(u.airportSiteId&&this.get(u.airportSiteId))||u.aiNav;
   if(this.mode==='rts'&&u.job?.type==='attack'&&this.canFire(u,this.get(u.job.targetId)))continue;
   if(target&&DIST(u,target)<=1)continue;
   u.aiBlocked={x:target?.x,y:target?.y,until:now+(this.mode==='rts'?20:2)};
   u.captureIntent=null;u.aiNav=null;u.aiProgress=null;u.airportSiteId=null;if(this.mode==='rts')this.finishRTS(u);
  }
 }
 // Objetivos comparados pela rota e pela força observada. Falhas expiram: não são aprendizado permanente.
 objective(hq){
  const p=this.plan,army=this.units.filter(u=>this.fighter(u)&&!AIR(u)),lead=army.sort((a,b)=>DIST(a,p.rally||hq)-DIST(b,p.rally||hq))[0]||this.units.find(u=>u.owner==='red'&&!AIR(u))||{type:'tank',owner:'red',...this.spawnCells('red','tank',hq)[0]},far=this.presumedHQ(hq);
  const strength=army.reduce((n,u)=>n+this.power(u),0),guard=s=>this.aiGuardPower(s);
  const known=[...this.memory.red.values()].filter(s=>s.owner!=='red'&&(s.owner==='blue'||s.type==='post'||AIRPORT(s))&&!this.aiAvoid(s));
  const goals=known.sort((a,b)=>DIST(a,lead)-DIST(b,lead)).slice(0,12);
  const scouts=[far,{x:COLS>>1,y:ROWS>>1},{x:COLS>>1,y:24},{x:COLS>>1,y:72}];goals.push(...scouts.filter(s=>!this.aiAvoid(s)));
  let best=null;
  for(const s of goals){if(!s.id&&DIST(lead,s)<=3)continue;const force=guard(s),bias=force*.08-(s.owner==='neutral'?18:s.owner==='blue'&&strength>=force*PLAN[this.difficulty].margin?35:0);if(best&&Math.max(0,DIST(lead,s)-2)*.5+bias>=best.score)continue;const route=this.pathToRange(lead,s,2);if(route===null)continue;const score=this.pathCost(lead,route)+bias+this.aiPathDanger(route)*.08;if(!best||score<best.score)best={s,route,score};}
  if(best){p.routeKind=best.route.some(c=>this.terrain[KEY(c.x,c.y)]==='bridge')?'crossing':'open';p.strategy=best.s.owner==='neutral'?'expand':best.s.owner==='blue'?'attack':'scout';return {...best.s};}
  // Sem acesso ao destino: aproxima-se por uma casa alcançável em outro setor, sem atravessar água.
  const reach=this.reachable(lead),aim=scouts.find(s=>!this.aiAvoid(s))||far;let cell=null;
  for(let k=0;k<SIZE;k++)if(reach[k]){const c={x:k%COLS,y:Math.floor(k/COLS)};if(DIST(c,lead)>3&&!this.aiAvoid(c)&&(!cell||DIST(c,aim)<DIST(cell,aim)))cell=c;}
  p.strategy=cell?'flank':'defend';return cell||{x:lead.x,y:lead.y};
 }
 /* Plano da IA: prepara (postos, reconhecimento, reunião no ponto de encontro) até vencer o prazo e o grupo reunido (≥ 6) superar
    a força azul vista × margem; ataca em onda; com metade da força perdida, reagrupa e volta a se preparar. */
 planAI(){
  const hq=this.commandBase('red');if(!this.aiEnabled||!hq)return;if(this.mode==='rts')this.aiAirportPlan();const p=this.plan,cfg=PLAN[this.difficulty],now=this.mode==='rts'?this.time:this.round,prep=this.mode==='rts'?cfg.prep*30:cfg.prep;
  this.aiProgress();p.rally||=this.rallyPoint(hq);const fighters=this.units.filter(u=>this.fighter(u)),sum=list=>list.reduce((a,u)=>a+this.power(u),0),home=u=>DIST(u,p.rally)<=4;
  const threats=[...this.intel.values()].filter(e=>DIST(e,hq)<=6&&this.isVisible('red',e));
  this.aiTrackPosts();this.aiGuards();this.aiRecordPosts();this.aiTrackDanger();
  // Incursões só depois de alguma economia (≥2 postos) e com derrota registrada ou travessia pelo caminho.
  if(now-(p.raidReview??-Infinity)>=(this.mode==='rts'?8:1)){
   p.raidReview=now;p.raid=this.structures.filter(s=>s.owner==='red'&&s.type==='post'&&s.hp>0).length>=2&&(p.defeats?.length||p.routeKind==='crossing')?this.aiRaidTarget(hq):null;
  }
  if(threats.length){p.strategy='defend';}
  else if(p.phase==='prepare'&&(!p.objective||now-(p.review??-Infinity)>=(this.mode==='rts'?8:1))){p.objective=this.objective(hq);p.review=now;}
  if(p.phase==='attack'){
   const carried=[...this.units.flatMap(c=>(c.cargo||[]).map(u=>({...u,x:c.x,y:c.y}))),...(this.drops||[]).map(d=>({...d.passenger,x:d.x,y:d.y}))],alive=p.wave.map(id=>this.get(id)||carried.find(u=>u.id===id)).filter(u=>u?.hp>0);
   if(!alive.length||sum(alive)<p.waveStart*.5){this.aiFailure(p.objective,'losses');p.phase='regroup';p.strategy='regroup';p.wave=[];p.objective=null;p.since=now;}
   else{
    if(cfg.reinforce)for(const u of fighters)if(!p.wave.includes(u.id)&&home(u))p.wave.push(u.id);
    const known=p.objective?.id&&[...this.memory.red.values()].find(s=>s.id===p.objective.id);
    if(!p.objective||known?.owner==='red'){p.objective=this.objective(hq);p.probe=null;}
    const ground=alive.filter(u=>!AIR(u)),column=ground.length?ground:alive,distance=column.reduce((n,u)=>n+DIST(u,p.objective),0)/column.length,q=p.probe;
    const visibleTarget=p.objective.id&&this.structures.find(s=>s.id===p.objective.id&&this.isVisible('red',s)),health=visibleTarget?.hp;
    if(!q||q.id!==p.objective.id||q.x!==p.objective.x||q.y!==p.objective.y||distance<q.distance-1||health!==undefined&&(q.health===undefined||health<q.health))p.probe={id:p.objective.id,x:p.objective.x,y:p.objective.y,distance,health,since:now};
    else if(now-q.since>=(this.mode==='rts'?30:3)){
     this.aiFailure(p.objective,'no-progress');p.objective=this.objective(hq);p.since=now;
     for(const u of alive){u.aiNav=null;if(this.mode==='rts'&&!PLANE(u)&&!u.airportSiteId)this.finishRTS(u);}
    }
   }
  }
  if(p.phase==='regroup'&&(fighters.filter(home).length>=fighters.length*.7||now-p.since>=prep*cfg.followUp)){p.phase='prepare';p.since=now;}
  if(p.phase==='prepare'&&now-p.since>=prep){
   const gathered=fighters.filter(home);
   p.objective||=this.objective(hq);
   // Força necessária: contato visto × margem; posto reconhecido, zonas de perigo (inclui baixas próprias) e rota × 1,5
   // (defensor entrincheirado) e outra vez × 1,5 numa travessia (gargalo).
   const need=(goal,lead)=>{
    const way=lead&&this.pathToRange(lead,goal,2),stat=Math.max(this.aiGuardPower(goal,10),this.aiDangerAt(goal,10),way?this.aiPathDanger(way):0);
    return Math.max(sum([...this.intel.values()].filter(e=>DIST(e,goal)<=10))*cfg.margin,stat*1.5*(p.routeKind==='crossing'?1.5:1),this.aiLost(goal));
   };
   if(gathered.length>=cfg.wave&&sum(gathered)>=need(p.objective,gathered[0]||fighters[0])){p.phase='attack';p.wave=gathered.map(u=>u.id);p.waveStart=sum(gathered);p.probe=null;}
   else if(now-p.since>=prep*2&&fighters.length>=Math.min(3,cfg.wave)){
    // A concentração num gargalo tem prazo; a nova missão usa rota e oposição locais, medidas no destino novo.
    const next=this.objective(hq);
    if(sum(fighters)>=need(next,fighters[0])){p.objective=next;p.phase='attack';p.wave=fighters.map(u=>u.id);p.waveStart=sum(fighters);p.probe=null;}
    else p.objective=next;
   }
  }
 }
 // Segurar posição: por turnos encerra a tropa (trincheira); no RTS ela fica parada com fogo automático.
 hold(u){if(this.mode!=='rts'&&u.owner===this.turn&&!u.pending)this.order(u,'stop');}
 // Batedor: patrulha centro do mapa → 2/3 do caminho até o QG presumido → centro; ferido, volta ao ponto de encontro.
 scout(u,hq){
  if(u.hp/u.maxHp<.6)return this.moveToward(u,this.plan.rally,2);
  if(this.aiScoutPosts(u,hq))return true;
  const far=this.presumedHQ(hq),legs=[{x:COLS>>1,y:ROWS>>1},{x:Math.round(hq.x+(far.x-hq.x)*2/3),y:Math.round(hq.y+(far.y-hq.y)*2/3)}];
  u.scoutLeg??=0;if(DIST(u,legs[u.scoutLeg%2])<=2)u.scoutLeg++;if(this.moveToward(u,legs[u.scoutLeg%2],2))return true;
  u.scoutLeg++;if(this.moveToward(u,legs[u.scoutLeg%2],2))return true;
  return this.moveToward(u,this.plan.objective||this.objective(hq),2);
 }
 // Drone da IA: com artilharia de mísseis, observa 8 casas à frente dela rumo ao objetivo; sem ela, patrulha como o batedor.
 // Drone furtivo da IA: com mísseis, ataca o que estiver ao alcance (prefere antiaéreas e lançadores) ou caça o mais próximo
 // desses que já viu; ferido ou sem mísseis, patrulha como o batedor.
 stealthAct(u,hq,foes){
  if(u.missiles>0&&u.hp/u.maxHp>=.5){
   const target=this.acquire(u);if(target&&this.order(u,'attack',{targetId:target.id}))return true;
   const prey=foes.filter(e=>this.weapon(u,e)&&!UT(e).structure).sort((a,b)=>Number(['antiAirVehicle','missileInfantry'].includes(b.type))-Number(['antiAirVehicle','missileInfantry'].includes(a.type))||DIST(a,u)-DIST(b,u))[0];
   if(prey&&DIST(prey,u)<=10&&this.moveToward(u,prey,UT(u).range))return true;
  }
  return this.scout(u,hq);
 }
 droneAct(u,hq){
  if(u.hp/u.maxHp<.5)return this.moveToward(u,this.plan.rally,2);
  const rocket=this.units.find(v=>v.owner===u.owner&&v.type==='rocketArtillery');if(!rocket)return this.scout(u,hq);
  const goal=this.plan.objective||this.presumedHQ(hq),k=Math.min(1,8/Math.max(1,DIST(rocket,goal)));
  return this.moveToward(u,{x:Math.round(rocket.x+(goal.x-rocket.x)*k),y:Math.round(rocket.y+(goal.y-rocket.y)*k)},1);
 }
 /* Casas para bombardear: só o que a IA viu (intel) ou lembra (estruturas), nunca a posição real de tropas ocultas.
    Valor da área 3×3 (vizinhas valem metade, estruturas o dobro); descarta áreas com tropa ou estrutura própria. */
 bombardTargets(u){
  const response=u.owner==='red'&&this.plan.airResponse?.until>this.aiNow()?this.plan.airResponse:null;
  const known=[...(response?[{x:response.x,y:response.y,value:TYPES.antiAirVehicle.cost}]:[]),...[...this.intel.values()].filter(e=>!AIR(e)).map(e=>({x:e.x,y:e.y,value:this.power(e)})),...[...this.memory[u.owner].values()].filter(s=>s.owner!==u.owner&&s.owner!=='neutral').map(s=>({x:s.x,y:s.y,value:2*(s.type==='hq'?300:120)}))];
  const near=(a,b)=>Math.abs(a.x-b.x)<=1&&Math.abs(a.y-b.y)<=1,own=this.all().filter(v=>v.owner===u.owner&&v.hp>0&&!AIR(v));
  return known.filter(c=>!own.some(v=>near(TILE(v),c))).map(c=>({x:c.x,y:c.y,score:known.filter(k=>near(k,c)).reduce((a,k)=>a+k.value*(k.x===c.x&&k.y===c.y?1:.5),0)-DIST(u,c)})).sort((a,b)=>b.score-a.score).slice(0,5);
 }
 aiAct(u){
  if(UT(u).airdropPlane)return;
  if(UT(u).capacity){
   if(u.cargo?.length||u.aiPassengerId){this.aiTransport(u);return;}
   if(BARRAGE(u)&&!u.cargo?.length&&!u.aiPassengerId){
    if(u.salvos===0||u.hp<u.maxHp*.5||u.flares===0){
     if(u.altitude!=='low'&&this.order(u,'altitude',{altitude:'low'}))return;
     const bases=this.structures.filter(s=>s.owner===u.owner&&(s.type==='hq'||AIRPORT(s))).sort((a,b)=>DIST(u,a)-DIST(u,b));
     for(const b of bases)if(this.order(u,'service',{targetId:b.id})||this.moveToward(u,b,1))return;
    }else{
     this.aiTransport(u);if(u.pending||u.segment||u.cargo?.length||u.aiPassengerId)return;
     if(this.mode==='rts'?u.cooldown<=0:u.actionLeft)for(const c of this.bombardTargets(u))if(this.canBombard(u,c)&&this.order(u,'bombard',c))return;
    }
    return;
   }
   this.aiTransport(u);return;
  }
  this.aiDecisions++;const hq=this.commandBase('red');if(!hq)return;if(u.airportSiteId)return;
  const p=this.plan,home=p.rally||(p.rally=this.rallyPoint(hq)),byDist=(a,b)=>DIST(a,u)-DIST(b,u),far=this.presumedHQ(hq);
  const army=this.units.filter(v=>v.owner==='red'),foes=this.all().filter(e=>e.owner==='blue'&&this.isVisible('red',e)),posts=this.structures.filter(s=>s.owner==='red'&&s.type==='post');
  // Ameaças: inimigos a até 6 casas do QG ou a até 3 de um posto vermelho.
  const threats=foes.filter(e=>!UT(e).structure&&(DIST(e,hq)<=6||posts.some(s=>DIST(e,s)<=5))),wave=p.phase==='attack'&&p.wave.includes(u.id);this.aiState=threats.length?'defend':p.phase;
  if(!threats.length&&u.type!=='commander'&&!u.captureIntent&&this.units.some(c=>c.owner===u.owner&&c.hp>0&&UT(c).capacity&&c.aiPassengerId===u.id)&&!this.acquire(u))return;
  if(PLANE(u)){this.aiPlaneAct(u,foes);return;}
  // Lançador volta para recarregar; tanque só volta se não houver alvo ao alcance do canhão.
  if(atMax(u)&&(u.type==='antitank'||!this.acquire(u))&&(u.atMissiles===0||u.aiResupply&&u.atMissiles<atMax(u))){
   u.aiResupply=true;for(const b of this.structures.filter(s=>s.owner===u.owner&&['hq','post'].includes(s.type)).sort(byDist))if(this.order(u,'service',{targetId:b.id})||this.moveToward(u,b,1))return;
  }else u.aiResupply=false;
  if(u.type==='reconDrone'){if(!this.droneAct(u,hq))this.hold(u);return;}
  if(u.type==='stealthDrone'){if(!this.stealthAct(u,hq,foes))this.hold(u);return;}
  if(u.type==='rocketArtillery'&&(this.mode==='rts'?u.cooldown<=0:u.actionLeft))for(const c of this.bombardTargets(u))if(this.order(u,'bombard',c))return;
  if(u.salvos>0&&u.type!=='rocketArtillery'&&BARRAGE(u)&&(this.mode==='rts'?u.cooldown<=0:u.actionLeft))for(const c of this.bombardTargets(u))if(this.canBombard(u,c)&&this.order(u,'bombard',c))return;
  if(AIR(u)){
   if(u.hp/u.maxHp<=.5||u.flares===0||u.missiles===0){
    if(u.altitude==='high'&&this.order(u,'altitude',{altitude:'low'}))return;
    const bases=this.structures.filter(b=>b.owner===u.owner&&b.hp>0&&(b.type==='hq'||AIRPORT(b))).map(b=>({b,route:this.pathToRange(u,b,1)})).filter(v=>v.route!==null).sort((a,b)=>this.pathCost(u,a.route)-this.pathCost(u,b.route));
    for(const {b,route}of bases){if(this.order(u,'service',{targetId:b.id}))return;if(route.length&&this.moveToward(u,b))return;}return;
   }
   const missileTarget=foes.find(e=>MISSILE(this.weapon(u,e))&&DIST(u,e)<=this.range(u,e,'high')+.05),danger=foes.some(e=>MISSILE(this.weapon(e,u))&&DIST(e,u)<=this.range(e,u));
   const altitude=UT(u).weapons.length>1&&missileTarget&&!danger?'high':'low';if(u.altitude!==altitude&&this.order(u,'altitude',{altitude}))return;
  }
  if(!AIR(u)&&u.hp/u.maxHp<(UT(u).cost>=150?.4:.35)){const medic=army.filter(e=>e.type==='engineer'&&e!==u).sort(byDist)[0]||hq;if(this.moveToward(u,medic))return;}
  if(u.type==='engineer'){
   if(this.mode==='turns'&&!this.airports('red').length&&this.aiAirportPlan())return;
   const allies=this.all().filter(e=>e.owner==='red'&&e!==u&&!AIR(e)&&e.hp<e.maxHp&&DIST(e,u)<=6).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp);for(const ally of allies)if(this.order(u,'repair',{targetId:ally.id}))return;
   const mine=this.mines.find(m=>m.known.red&&DIST(m,u)<=u.moveLeft+1);if(mine&&this.order(u,'demine',mine))return;
  }
  const firing=this.acquire(u);if(firing&&this.order(u,'attack',{targetId:firing.id}))return;
  // Defesa: fora da onda todos respondem; na onda, só ameaças a até 6 casas.
  for(const e of threats.filter(e=>(!wave||DIST(e,u)<=6)&&this.weapon(u,e)).sort(byDist))if(u.type==='artillery'?this.moveToward(u,e,this.range(u,e)-1):this.order(u,'attack',{targetId:e.id})||this.moveToward(u,e))return;
  // Economia em risco: construir vem antes da onda e da guarda (sempre que não há inimigo ao alcance de combate).
  if(this.aiPressure()&&this.aiExpand(u,hq,far))return;
  if(u.aiGuard){
   const post=this.get(u.aiGuard);
   if(!post||post.owner!=='red'||post.hp<=0)u.aiGuard=null;
   else{
    for(const e of foes.filter(e=>!UT(e).structure&&DIST(e,post)<=6&&this.weapon(u,e)&&this.power(e)<=this.power(u)*3).sort(byDist))if(this.order(u,'attack',{targetId:e.id})||this.moveToward(u,e))return;
    if(DIST(u,post)>2&&this.moveToward(u,post,2))return;
    this.hold(u);return;
   }
  }
  // A captura de pista atravessa vários turnos; postos mais próximos não reiniciam essa viagem.
  const mission=u.captureIntent&&this.knownObjective(u.owner,u.captureIntent.targetId,u.captureIntent.position);
  if(AIRPORT(mission)&&mission.owner!=='red'&&!this.aiAvoid(mission)&&!(u.aiBlocked?.until>this.aiNow()&&u.aiBlocked.x===mission.x&&u.aiBlocked.y===mission.y)&&this.order(u,'capture',{targetId:mission.id,position:mission}))return;
  if(u.aiObjective){
   const goal=u.aiObjective,known=goal.id&&[...this.memory.red.values()].find(s=>s.id===goal.id);
   if(goal.until<=this.aiNow()||known?.owner==='red'||this.aiAvoid(goal))u.aiObjective=null;
   else{
    if(this.canCapture(u,known)&&this.order(u,'capture',{targetId:known.id,position:known}))return;
    if(DIST(u,goal)>3&&this.moveToward(u,goal,3,4))return;
    if(DIST(u,goal)<=3){this.hold(u);return;}u.aiObjective=null;
   }
  }
  if(p.phase==='attack'&&['commander','antiAirVehicle','missileInfantry'].includes(u.type)){
   const front=p.wave.map(id=>this.get(id)).filter(v=>v&&v!==u&&!AIR(v)&&!['antiAirVehicle','missileInfantry','artillery','rocketArtillery'].includes(v.type)).sort((a,b)=>DIST(a,p.objective)-DIST(b,p.objective));
   if(front.length){const anchor=front[front.length>>1],dx=anchor.x-p.objective.x,dy=anchor.y-p.objective.y,d=Math.max(1,Math.abs(dx)+Math.abs(dy)),gap=u.type==='commander'?1:3,point={x:Math.max(0,Math.min(COLS-1,Math.round(anchor.x+dx/d*gap))),y:Math.max(0,Math.min(ROWS-1,Math.round(anchor.y+dy/d*gap)))};if(DIST(u,point)>1&&this.moveToward(u,point,1,4))return;this.hold(u);return;}
  }
  if(wave){
   if(u.type!=='artillery')for(const e of foes.filter(e=>DIST(e,u)<=6).sort(byDist))if(this.order(u,'attack',{targetId:e.id}))return;
   const goal=p.objective;
   const remembered=goal.id&&[...this.memory.red.values()].find(s=>s.id===goal.id);
   if(this.canCapture(u,remembered)&&remembered.owner!=='red'&&this.order(u,'capture',{targetId:remembered.id,position:remembered}))return;
   // Coesão: quem está mais de 3 casas à frente da mediana da onda espera; os demais avançam em pernas de até 4 casas.
   const d=p.wave.map(id=>this.get(id)).filter(v=>v&&!AIR(v)&&!v.aiBlocked).map(v=>DIST(v,goal)).sort((a,b)=>a-b);
   if(d.length&&DIST(u,goal)<d[d.length>>1]-6&&DIST(u,goal)>8)this.hold(u);
   else if(!this.moveToward(u,goal,u.type==='artillery'?this.range(u)-1:2,4)){
    const alternate=[...this.memory.red.values()].filter(s=>s.owner==='neutral'&&!this.aiAvoid(s)).sort(byDist).find(s=>this.moveToward(u,s,2,4));if(!alternate)this.hold(u);
   }return;
  }
  if(u.type==='recon'&&this.scout(u,hq))return;
  if(POST_CAPTURERS.has(u.type)&&!threats.length){
   // Expansão: posto com reconhecimento recente (≤2 janelas) e sem força azul, até 40 casas da tropa, em qualquer lado do mapa;
   // sem reconhecimento, só postos do lado vermelho a ≤25 casas do QG (o batedor confere os demais antes de a infantaria ir).
   const now=this.aiNow(),fresh=(this.mode==='rts'?90:6)*2;
   const ok=s=>{if(s.type!=='post')return DIST(s,hq)+2<=DIST(s,far);const r=this.plan.postIntel?.[s.id];if(r&&now-r.at<=fresh)return r.threat===0&&DIST(s,u)<=40;return DIST(s,hq)+2<=DIST(s,far)&&DIST(s,hq)<=25;};
   const targets=[...this.memory.red.values()].filter(s=>(s.type==='post'||AIRPORT(s))&&s.owner!=='red'&&!this.claims.has(s.id)&&!this.aiAvoid(s)&&!(u.aiBlocked?.until>this.aiNow()&&u.aiBlocked.x===s.x&&u.aiBlocked.y===s.y)&&this.aiDangerAt(s,7)===0&&ok(s)&&(s.type!=='post'||posts.length<PLAN[this.difficulty].posts)).sort(byDist); // teto de postos da dificuldade
   for(const s of targets.slice(0,4)){if(this.aiRouteDanger(u,s)>0)continue;if(this.order(u,'capture',{targetId:s.id,position:s})){this.claims.add(s.id);return;}}
  }
  // Sem posto neutro para capturar, a infantaria constrói: renda +6 e ponto de recrutamento.
  if(!threats.length&&this.aiExpand(u,hq,far))return;
  if(u.type==='engineer'&&p.phase==='attack'){const w=p.wave.map(id=>this.get(id)).filter(Boolean);if(w.length){const c={x:Math.round(w.reduce((a,v)=>a+v.x,0)/w.length),y:Math.round(w.reduce((a,v)=>a+v.y,0)/w.length)};if(this.moveToward(u,c,2,4))return;}}
  // Ponto de encontro: protege a área num raio de 4 e segura posição a até 3 casas.
  if(u.type!=='artillery')for(const e of foes.filter(e=>DIST(e,home)<=4).sort(byDist))if(this.order(u,'attack',{targetId:e.id}))return;
  if(DIST(u,home)>3&&this.moveToward(u,home,3))return;
  this.hold(u);
 }
 finishRTS(u){
  this.cancelAltitude(u);this.cancelWork(u);u.job=null;u.path=[];u.pending=!!u.segment||u.launcherLevel>0;u.idle=0;u.order={type:'stop'};
 }
 routeRTS(u,crowded=false){
  const job=u.job,target=job.type==='capture'?this.captureTarget(u):this.get(job.targetId);let route;
  // Helicóptero voa em linha reta: a "rota" é só o ponto de destino (casa mais próxima do alvo).
  if(HELI(u)){const p=job.type==='bombard'?job.cell:target?NEAREST(target,u):job.goal;job.route=p?[{x:p.x,y:p.y}]:[];u.path=job.route.slice();u.navWait=.4;return;}
  // Tropas aliadas em marcha não contam como obstáculo no planejamento; só param ou desviam se bloquearem de fato.
  if(job.type==='move')route=this.findPath(u,job.goal,true,this.unitGrid(u,!crowded));
  else if(job.type==='build')route=[];
  else if(job.type==='bombard')route=this.pathToRange(u,job.cell,barrageRange(u),UT(u).barrage?.min??TYPES.rocketArtillery.min);
  else route=target||job.goal?this.pathToRange(u,target||job.goal,job.type==='attack'?this.range(u,target):1,job.type==='attack'?UT(u).min:0):null;
  // Destino cercado por aliados que já chegaram: ir até a borda do grupo (≤5 casas dele) e parar ali conta como cumprido;
  // sem caminho nem para a borda por 3 s (cercado por aliados parados), a ordem termina onde a tropa está.
  if(job.type==='move'&&!route){route=this.pathToRange(u,job.goal,5,0);if(route?!route.length:(u.navFail=(u.navFail||0)+.4)>=3){this.finishRTS(u);return;}}
  if(route)u.navFail=0;
  job.route=route||[];u.path=job.route.slice();u.navWait=.4;
 }
 stepRTS(u,dt){
  if(dt<=1e-8||u.hp<=0||FLYER(u))return;
  u.navWait=Math.max(0,(u.navWait||0)-dt);
  // Em marcha, atira no que estiver ao alcance sem parar; artilharia e drones furtivos não disparam em movimento.
  if(u.job?.type==='move'&&u.cooldown<=0&&u.type!=='artillery'&&!UT(u).stealth){const enemy=this.acquire(u);if(enemy)this.shoot(u,enemy);}
  // A nova ordem começa na próxima casa; o segmento em curso continua reservado.
  if(u.segment){
   const seg=u.segment,dx=seg.to.x-u.x,dy=seg.to.y-u.y,d=Math.hypot(dx,dy),speed=UT(u).speed*(heliHigh(u)?HELI_HIGH:1)*(u.scoot>0?SCOOT_SPEED:1)/(AIR(u)?1:seg.cost),step=speed*dt;
   if(d>0)u.facing=Math.atan2(dx,-dy);
   if(d<=step){u.x=seg.to.x;u.y=seg.to.y;u.segment=null;u.moved=true;u.pending=!!u.job;this.enterCell(u);this.touchVision();this.stepRTS(u,dt-d/speed);}
   else{u.x+=dx/d*step;u.y+=dy/d*step;}return;
  }
  const job=u.job;
  // Recolhe antes de cumprir outra ordem; progresso próprio não reinicia ao receber dano.
  const preparing=job?.type==='bombard'&&this.canBombard(u,job.cell)&&(job.left!==undefined||u.cooldown<=0);
  if(u.launcherLevel>0&&!preparing){if(this.advanceLauncher(u,false,dt))u.pending=!!job;return;}
  if(!job){
   // Drone furtivo não dispara sozinho: só contra alvos escolhidos pelo jogador ou pela IA.
   const enemy=u.cooldown<=0&&!UT(u).stealth?this.acquire(u):null;
   if(enemy){u.idle=0;u.entrenched=false;this.shoot(u,enemy);}
   else{u.idle+=dt;if(u.idle>=3&&!AIR(u))u.entrenched=true;}return;
  }
  const target=job.type==='capture'?this.captureTarget(u):this.get(job.targetId);
  if(job.type==='capture'&&!target){this.finishRTS(u);return;}
  if(job.type==='airportWork'){if(!target||target.type!=='airportSite'||target.owner!==u.owner){u.airportSiteId=null;this.finishRTS(u);return;}if(DIST(u,target)<=1&&!u.segment){u.pending=false;return;}}
  if(job.type==='altitude'){if(this.advanceAltitude(u,job.altitude,dt))this.finishRTS(u);return;}
  if(job.type==='service'){
   if(!this.serviceSite(u,target)){this.finishRTS(u);return;}
   if(u.type==='antiAirVehicle'){u.serviceClock=(u.serviceClock||0)+dt;if(u.serviceClock>=10){u.serviceClock-=10;u.smokeCharges=Math.min(2,u.smokeCharges+1);}if(u.smokeCharges===2)this.finishRTS(u);return;}
   if(AIR(u)&&!PLANE(u)){u.healClock=(u.healClock||0)+dt;if(u.healClock>=1){u.healClock-=1;this.heliHeal(u);}}else u.hp=Math.min(u.maxHp,u.hp+24*dt);
   u.serviceClock=(u.serviceClock||0)+dt;
   if(u.serviceClock+1e-8>=3){u.serviceClock=Math.max(0,u.serviceClock-3);if(atMax(u)||u.type==='heavyTank'){if(atMax(u))u.atMissiles=Math.min(atMax(u),u.atMissiles+1);if(u.type==='heavyTank')u.trophy=Math.min(trophyMax(u),u.trophy+1);}else{u.flares=Math.min(3,u.flares+1);if(u.salvos!==undefined)u.salvos=Math.min(HELI_SALVOS,u.salvos+1);if(UT(u).missiles)u.missiles=Math.min(UT(u).missiles,u.missiles+1);}}
   if((u.hp>=u.maxHp||AIR(u)&&!PLANE(u)&&this.credits[u.owner]<HELI_REPAIR_COST)&&(atMax(u)||u.type==='heavyTank'?!(u.atMissiles<atMax(u))&&!(u.trophy<trophyMax(u)):u.flares===3&&!(u.salvos<HELI_SALVOS)&&!(u.missiles<UT(u).missiles)))this.finishRTS(u);return;
  }
  if(['attack','repair'].includes(job.type)){
   // Sem arma compatível (ex.: drone furtivo sem mísseis), o ataque termina em vez de perseguir o alvo.
   const valid=target&&target.hp>0&&(job.type==='repair'?!AIR(target)&&target.owner===u.owner&&target.hp<target.maxHp:target.owner!==u.owner&&this.isVisible(u.owner,target)&&(job.type!=='attack'||!!this.weapon(u,target)));
   if(!valid){this.finishRTS(u);return;}
  }
  if(job.type==='demine'&&!this.mines.some(m=>m.x===job.goal.x&&m.y===job.goal.y)){this.finishRTS(u);return;}
  // Salva no RTS: parada, espera a recarga e lança os quatro mísseis; nova ordem interrompe os que faltam.
  if(job.type==='bombard'&&this.canBombard(u,job.cell)){
   job.route=[];u.path=[];if(job.left===undefined){if(u.cooldown>0)return;u.facing=Math.atan2(job.cell.x-u.x,u.y-job.cell.y);if(!this.advanceLauncher(u,true,dt))return;job.left=salvoSize(u);job.clock=0;if(u.salvos!==undefined)u.salvos--;}
   job.clock-=dt;if(job.clock<=0){this.launch(u,job.cell);job.left--;job.clock+=SALVO.interval;}
   if(job.left<=0)this.finishRTS(u);return;
  }
  const inRange=job.type==='bombard'?false:job.type==='attack'?this.canFire(u,target):job.type==='build'||job.type!=='move'&&DIST(u,target||job.goal)<=1;
  if(inRange){
   job.route=[];u.path=[];
   if(job.type==='attack'){if(u.cooldown<=0)this.shoot(u,target);return;}
   u.work+=dt;const duration=job.type==='build'?3:job.type==='capture'?2:1;
   if(u.work+1e-8<duration)return;u.work=0;
   if(job.type==='repair'){
    const heal=Math.min(UT(u).repair??24,target.maxHp-target.hp);target.hp+=heal;this.event('text',target,{text:'+'+heal,color:'#a4e7bb'});if(target.hp>=target.maxHp)this.finishRTS(u);
   }else this.resolveAction(job,u);return;
  }
  if(job.type==='move'&&DIST(u,job.goal)===0){this.finishRTS(u);return;}
  if(HELI(u)){
   if(!job.route.length||u.navWait<=0)this.routeRTS(u);
   const end=job.route[0];if(!end)return;
   this.flyToward(u,end,dt,UT(u).speed*(heliHigh(u)?HELI_HIGH:1));u.path=[end];u.moved=true;u.work=0;u.idle=0;u.entrenched=false;this.touchVision();return;
  }
  if(!job.route.length&&u.navWait<=0){this.routeRTS(u);if(!u.job)return;}
  const next=job.route[0];if(!next)return;
  const blocker=this.occupied(next.x,next.y,u);
  if(blocker||this.structureAt(next.x,next.y)){
   // Aliado em marcha libera a casa logo: espera até 1,5 s em vez de recalcular a rota (evita o tumulto); depois desvia de todos.
   if(blocker&&blocker.owner===u.owner&&(blocker.segment||blocker.job?.route?.length)&&(u.stuck=(u.stuck||0)+dt)<1.5)return;
   if(u.navWait<=0)this.routeRTS(u,(u.stuck||0)>=1.5);return;
  }
  const cost=this.stepCost(u,TILE(u),next);if(!Number.isFinite(cost)){this.finishRTS(u);return;}
  u.stuck=0;job.route.shift();u.path=job.route.slice();u.segment={from:TILE(u),to:next,cost};u.work=0;u.idle=0;u.entrenched=false;this.stepRTS(u,dt);
 }
 updateRTS(dt){
  this.visionClock-=dt;if(this.visionClock<=0){this.updateVision();this.visionClock=.1;}
  this.economyClock+=dt;
  if(this.economyClock+1e-8>=10){this.economyClock=Math.max(0,this.economyClock-10);for(const owner of this.sides)this.credits[owner]+=this.income(owner);}
  for(const owner of this.sides)this.production(owner,dt);
  this.aiClock-=dt;
  if(this.aiEnabled&&this.aiClock<=0){
   this.aiClock=.6;this.claims=new Set(this.units.filter(u=>u.owner==='red'&&u.order.type==='capture').map(u=>u.order.targetId));this.planAI();this.aiBuy();
   // Ataques aéreos contínuos também precisam reavaliar recuo, manutenção e ameaças visíveis.
   const waiting=new Set(this.aiQueue);this.aiQueue=[...waiting,...this.units.filter(u=>u.owner==='red'&&!waiting.has(u.id)).map(u=>u.id)];
  }
  if(this.aiEnabled)for(let n=0;n<8&&this.aiQueue.length;){const u=this.get(this.aiQueue.shift());if(u?.hp>0&&u.owner==='red'&&(!u.pending&&!u.segment||UT(u).capacity&&u.job?.type==='move'||AIR(u)&&(['attack','strike'].includes(u.order.type)||PLANE(u)&&!u.runway))){this.aiAct(u);n++;}}
  for(const u of [...this.units])if(u.hp>0)this.stepRTS(u,dt);
  this.flushVision();
 }
  checkVictory(){
  const alive=owner=>this.structures.some(s=>s.owner===owner&&s.hp>0&&(s.type==='hq'||s.type==='post')),blue=alive('blue'),red=alive('red');
  if(this.mission){if(!blue)Missions.finish(this,false,'A última base operacional foi perdida.');else Missions.step(this);return;}
  if(this.sides.length>2){for(const s of this.sides)if(!this.isOut(s)&&!alive(s))this.eliminate(s);const rest=this.sides.filter(s=>!this.isOut(s));if(rest.length<2){this.winner=rest[0]||'draw';this.log(this.winner==='draw'?'As forças foram neutralizadas.':`Vitória da Nação ${this.nationLabel(this.winner)}.`,this.sides);}return;}
  if(!blue||!red){this.winner=!blue&&!red?'draw':blue?'blue':'red';this.log(this.winner==='draw'?'As duas forças foram neutralizadas.':`Vitória da Nação ${this.nationLabel(this.winner)}.`,this.sides);}
 }

 update(dt){
  if(this.paused)return;
  if(this.winner||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);this.time+=dt;for(const u of this.units){u.cooldown=Math.max(0,u.cooldown-dt);if(u.cooldown<1e-8)u.cooldown=0;u.gunCooldown=Math.max(0,(u.gunCooldown||0)-dt);this.advanceGunBurst(u,dt);if(u.altitudeTransition?.returning){u.altitudeTransition.elapsed+=dt;if(u.altitudeTransition.elapsed>=.2)u.altitudeTransition=null;}if(this.mode==='rts'){u.suppressed=Math.max(0,u.suppressed-dt);u.revealed=Math.max(0,u.revealed-dt);if(AIR(u))u.flareCooldown=Math.max(0,u.flareCooldown-dt);if(u.type==='antiAirVehicle'){u.smokeCooldown=Math.max(0,u.smokeCooldown-dt);u.smokeTime=Math.max(0,u.smokeTime-dt);}else if(u.smokeTime>0)u.smokeTime=Math.max(0,u.smokeTime-dt);if(u.scoot>0)u.scoot=Math.max(0,u.scoot-dt);}}
  this.advanceDrops(dt);this.defendPlanes(dt);
  if(this.projectiles.some(p=>p.weapon==='antiAirVehicle'&&!p.interceptor&&!p.lostGuidance))this.touchVision();
  let planeAdvanced=false;if(this.mode==='rts'){for(const u of [...this.units])if(FLYER(u)&&(AIR(u)||u.runway))this.stepPlane(u,dt);for(const owner of this.sides){this.progressPlaneService(owner,dt);this.progressAirports(owner,dt);}this.advanceFires(dt);this.flushVision();this.defendAir();}else if(this.animation?.plane){this.animate(dt);planeAdvanced=true;}
  if(this.mode==='turns')this.defendAir(true);
   const hits=[],starts=new Map();for(const p of this.projectiles){
   if(p.interceptor)continue;starts.set(p,{x:p.x,y:p.y,elapsed:p.elapsed});
   p.elapsed=Math.min(p.duration,p.elapsed+dt);
   const liveTarget=this.get(p.targetId);if(p.weapon==='antiRadiation'&&!p.radiationLost&&(!liveTarget||!liveTarget.radarOn)){p.radiationLost=true;p.targetLevel=0;}if(p.weapon==='antiAirVehicle'&&(!liveTarget||!this.isVisible(p.owner,liveTarget)))p.lostGuidance=true;
   if(liveTarget&&!p.lostGuidance&&!p.radiationLost){p.targetLevel=AIR(liveTarget)?flightLevel(liveTarget):0;if(MISSILE(p.weapon)){p.tx=liveTarget.x;p.ty=liveTarget.y;}}
   const previousLevel=p.visualLevel??p.sourceLevel??0;p.visualLevel=p.weapon==='rocket'?Math.sin(Math.PI*p.elapsed/p.duration)*3:(p.sourceLevel||0)+((p.targetLevel||0)-(p.sourceLevel||0))*p.elapsed/p.duration;
   if(MISSILE(p.weapon)){
    const t=p.elapsed/p.duration,dx=(p.deflected?p.decoy.x:p.tx)-p.x,dy=(p.deflected?p.decoy.y:p.ty)-p.y;
    // Interpolação pelo tempo restante garante impacto no prazo mesmo quando o alvo se move.
    const fraction=Math.min(1,dt/Math.max(dt,p.duration-p.elapsed+dt));let x=p.x+dx*fraction,y=p.y+dy*fraction;
    if(p.deflected){const control={x:p.tx,y:p.ty};x=(1-t)**2*p.sx+2*(1-t)*t*control.x+t*t*p.decoy.x;y=(1-t)**2*p.sy+2*(1-t)*t*control.y+t*t*p.decoy.y;}
    p.heading=Math.atan2(y-p.y,x-p.x);p.trail.push({x:p.x,y:p.y,level:previousLevel,time:this.time});p.trail=p.trail.filter(v=>this.time-v.time<=1.2);p.x=x;p.y=y;
    this.event('smoke',{x:p.x,y:p.y,owner:p.owner},{air:p.air,contactId:p.targetId,sourceId:p.attackerId,flightLevel:p.visualLevel,visible:true,publicMissile:true});
   }
   if(p.trophy&&!p.intercepted&&liveTarget&&liveTarget.hp>0&&DIST(p,liveTarget)<=TROPHY_RANGE){p.intercepted=true;this.event('blast',{x:p.x,y:p.y,owner:liveTarget.owner},{air:false,visible:true,publicMissile:true,interception:true,trophy:true});}
   if(p.elapsed+1e-8>=p.duration||p.intercepted)hits.push(p);
  }this.advanceInterceptors(dt,starts,hits);this.projectiles=this.projectiles.filter(p=>!hits.includes(p));for(const p of hits)this.impact(p);
  if(this.mode==='rts'){this.updateRTS(dt);this.checkVictory();return;}
  if(this.animation&&!planeAdvanced)this.animate(dt);else if(!planeAdvanced&&!this.animation&&!this.projectiles.length&&this.actions.length){this.animation=this.actions.shift();this.animate(dt);}
  if(this.turnEnding&&!this.busy){const next=this.turnEnding;this.turnEnding=null;this.beginTurn(next);}if(!this.multiplayer&&this.turn==='red'&&!this.busy&&!this.turnEnding){this.aiWait-=dt;if(this.aiWait<=0){const u=this.get(this.aiQueue.shift());if(u){this.aiAct(u);this.aiWait=.15;}else if(!this.aiQueue.length)this.completeTurn('red');}}
  this.checkVictory();
 }
}
