'use strict';
/* Motor compartilhado: turnos alternados ou RTS com ordens simultâneas. */
const COLS=128,ROWS=96,SIZE=COLS*ROWS,STEP=1/30;
const KEY=(x,y)=>y*COLS+x,INSIDE=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<COLS&&y<ROWS;
const TILE=u=>({x:Math.round(u.x),y:Math.round(u.y)}),DIST=(a,b)=>Math.max(0,a.x-b.x-(b.width||1)+1,b.x-a.x-(a.width||1)+1)+Math.max(0,a.y-b.y-(b.height||1)+1,b.y-a.y-(a.height||1)+1);
const CENTER=u=>({x:u.x+((u.width||1)-1)/2,y:u.y+((u.height||1)-1)/2});
const NEAREST=(u,p)=>({x:Math.max(u.x,Math.min(u.x+(u.width||1)-1,p.x)),y:Math.max(u.y,Math.min(u.y+(u.height||1)-1,p.y))});
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]],AIR_DIRS=[...DIRS,[1,1],[-1,1],[1,-1],[-1,-1]],SIDE={blue:'Azul',red:'Vermelha',neutral:'Neutra'};
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
const PROCEDURAL={water:.35,forest:.35,relief:.35,farmland:.6,posts:24};
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
 infantry:{move:3,name:'Infantaria',hp:100,speed:1.35,range:1.15,min:0,damage:35,accuracy:.9,vision:4,cooldown:.8,train:1,cost:50,reward:20,role:'Captura e construção'},
 lightTank:{move:6,vehicle:true,tank:true,name:'Tanque leve',hp:110,speed:2,range:3,min:0,damage:35,accuracy:.75,vision:5,cooldown:2,train:2,cost:100,reward:35,role:'Mais rápido dos tanques · alcance 3 · não perfura pesados'},
 tank:{move:5,vehicle:true,tank:true,name:'Tanque médio',hp:170,speed:1.7,range:5,min:0,damage:60,accuracy:.75,vision:5,cooldown:2.5,train:3,cost:150,reward:50,role:'Alcance 5 · precisão cai após 3 casas · velocidade intermediária'},
 heavyTank:{move:4,vehicle:true,tank:true,name:'Tanque pesado',hp:280,speed:1.5,range:7,min:0,damage:80,accuracy:.85,vision:5,cooldown:3.5,train:4,cost:240,reward:80,role:'Alcance 7 · maior dano e precisão dos tanques · requer reconhecimento distante'},
 artillery:{move:3,vehicle:true,name:'Artilharia',hp:100,speed:1.2,range:16,min:2,damage:85,accuracy:.85,vision:3,cooldown:5,train:4,cost:180,reward:40,role:'Cerco de longo alcance · área 3×3 · fogo amigo'},
 recon:{move:5,vehicle:true,name:'Batedor',hp:75,speed:2.25,range:2,min:0,damage:24,accuracy:.9,vision:7,cooldown:1.1,train:1,cost:75,reward:25,role:'Reconhecimento rápido'},
 engineer:{move:3,name:'Engenheiro',hp:85,speed:1.25,range:1.15,min:0,damage:20,accuracy:.9,vision:4,cooldown:1.2,train:2,cost:65,reward:25,role:'Reparo +24 HP por ação'},
 antitank:{move:3,name:'Antitanque',hp:90,speed:1.05,range:3,min:0,damage:40,accuracy:.85,vision:4,cooldown:3,train:2,cost:110,reward:35,role:'Foguetes contra veículos'},
 machinegun:{move:2,name:'Metralhador',hp:110,speed:1.05,range:2.5,min:0,damage:18,accuracy:.88,vision:4,cooldown:.4,train:2,cost:90,reward:30,role:'Fogo rápido contra tropas a pé'},
 antiAirVehicle:{move:5,vehicle:true,name:'Veículo antiaéreo',hp:70,speed:2.25,range:30,min:0,damage:80,accuracy:.8,vision:6,cooldown:3.5,train:3,cost:160,reward:45,role:'Mísseis · radar global · alcance 30 contra aeronaves · exige escolta'},
 missileInfantry:{move:3,name:'Soldado lançador',hp:80,speed:1.25,range:3,min:0,damage:40,accuracy:.75,vision:4,cooldown:3,train:2,cost:90,reward:30,role:'Mísseis · ar 3 casas / solo 1 casa'},
 helicopter:{...HELICOPTER_MINIGUN,gun:HELICOPTER_MINIGUN,air:true,weapons:['gun'],move:8,name:'Helicóptero',hp:120,speed:3.2,min:0,vision:6,train:3,cost:140,reward:50,role:'Minigun · alta cadência contra infantaria'},
 helicopterGround:{...HELICOPTER_CANNON,gun:HELICOPTER_CANNON,air:true,weapons:['gun','agm'],move:8,name:'Helicóptero ar-terra',hp:120,speed:3.2,min:0,vision:6,train:4,cost:230,reward:50,role:'Canhão perfurante e mísseis ar-terra'},
 helicopterAir:{...HELICOPTER_CANNON,gun:HELICOPTER_CANNON,air:true,weapons:['gun','aam'],move:8,name:'Helicóptero ar-ar',hp:120,speed:3.2,min:0,vision:6,train:4,cost:180,reward:50,role:'Canhão perfurante e mísseis ar-ar'},
 // Equilíbrio provisório das duas classes abaixo (ainda não validado em partidas).
 rocketArtillery:{move:2,vehicle:true,name:'Artilharia de mísseis',hp:90,speed:.85,range:30,min:3,damage:20,accuracy:.8,vision:3,cooldown:10,train:4,cost:240,reward:60,role:'Bombardear área 3×3 · 4 mísseis · ×2 contra estruturas'},
 reconDrone:{air:true,drone:true,unarmed:true,weapons:[],move:7,name:'Drone de reconhecimento',hp:60,speed:2.4,range:0,min:0,damage:0,accuracy:0,vision:12,cooldown:1,train:2,cost:90,reward:30,role:'Reconhecimento · visão 12 através do terreno · sempre em altitude alta · sem armas'},
 // Drone furtivo: equilíbrio provisório. Invisível ao radar; descoberto pela visão inimiga, fica revelado até ser destruído.
 stealthDrone:{air:true,drone:true,stealth:true,weapons:['stealthMissile'],missiles:2,move:6,name:'Drone furtivo',hp:50,speed:2.2,range:8,min:0,damage:35,accuracy:.85,vision:12,cooldown:3,train:3,cost:160,reward:45,role:'Furtivo ao radar · visão 12 através do terreno · 2 mísseis, alcance 8, só por ordem · sempre em altitude alta'},
 commander:{move:3,name:'Comandante',hp:140,speed:1.35,range:2,min:0,damage:40,accuracy:.9,vision:5,cooldown:1.5,reward:70,role:'Aura de comando · raio 2'},
 hq:{name:'Quartel-general',hp:300,speed:0,range:0,damage:0,vision:5,structure:true,width:3,height:3,reward:100},
 post:{name:'Posto avançado',hp:80,speed:0,range:0,damage:0,vision:8,structure:true,width:2,height:2,reward:30,role:'Reconhecimento · visão base 8 · recrutamento'}
};
// Armas dos helicópteros. Recarga em segundos (RTS); por turnos cada disparo gasta a ação.
const ARMORED=new Set(['tank','heavyTank']),BREAKERS=new Set(['antitank','lightTank','tank','heavyTank','artillery']);
const WEAPONS={gun:HELICOPTER_CANNON,agm:{name:'Míssil ar-terra',damage:65,range:5,accuracy:.85,cooldown:3},aam:{name:'Míssil ar-ar',damage:70,range:6,accuracy:.9,cooldown:3},stealthMissile:{name:'Míssil furtivo',damage:35,range:8,accuracy:.85,cooldown:3}};

const PLANE=u=>!!TYPES[u?.type]?.plane;
const AIRPORT=u=>!!TYPES[u?.type]?.airport;
const POST_CAPTURERS=new Set(['infantry','missileInfantry','machinegun','antitank','commander']);
const BOMB_TYPES=['bombCommon','bombFragment','bombIncendiary'];
const AMMO_PRICE={jetGun:1,jetAam:20,antiRadiation:25,jetAgm:25,cruiseMissile:60,bombCommon:12,bombFragment:14,bombIncendiary:18};
const PLANE_MODELS={
 fighterBlue:{name:'Caça aliado',team:'blue',hp:150,speed:6,evasion:.2,flares:6,hull:400,train:3,ammo:{jetAam:4,antiRadiation:2},radar:true,role:'Interceptação · radar 18 · investidas'},
 fighterRed:{name:'Caça inimigo',team:'red',hp:160,speed:5.4,evasion:.3,flares:6,hull:380,train:3,ammo:{jetAam:4,antiRadiation:2},radar:true,role:'Interceptação · manobrabilidade'},
 multiroleBlue:{name:'Multifunção aliado',team:'blue',hp:180,speed:5.6,evasion:.3,flares:6,hull:480,train:4,ammo:{jetAam:2,jetAgm:4,antiRadiation:2},role:'Ar/solo · rápido e manobrável'},
 multiroleRed:{name:'Multifunção inimigo',team:'red',hp:200,speed:4.8,evasion:.2,flares:8,hull:600,train:4,ammo:{jetAam:2,jetAgm:5,antiRadiation:3},role:'Ar/solo · mísseis superiores'},
 stealthFighterBlue:{name:'Caça furtivo aliado',team:'blue',hp:180,speed:6.2,evasion:.3,flares:6,hull:750,train:5,ammo:{jetAam:6,antiRadiation:2},radar:true,radarStealth:true,weaponModel:'fighterBlue',reward:140,role:'Furtivo ao radar · interceptação · radar 18'},
 stealthFighterRed:{name:'Caça furtivo inimigo',team:'red',hp:190,speed:5.8,evasion:.35,flares:6,hull:780,train:5,ammo:{jetAam:6,antiRadiation:2},radar:true,radarStealth:true,weaponModel:'fighterRed',reward:140,role:'Furtivo ao radar · interceptação · radar 18'},
 bomberBlue:{name:'Bombardeiro furtivo aliado',team:'blue',hp:240,speed:3.5,evasion:.1,flares:10,hull:1000,train:6,ammo:{bombCommon:4,bombFragment:4,bombIncendiary:4,cruiseMissile:2},radarStealth:true,role:'Furtivo ao radar · 12 bombas · 2 cruzeiros, alcance 40 · sem metralhadora'},
 bomberRed:{name:'Bombardeiro pesado inimigo',team:'red',hp:340,speed:3.8,evasion:.1,flares:12,hull:1400,train:8,ammo:{bombCommon:16,bombFragment:16,bombIncendiary:16,cruiseMissile:2},reward:180,role:'48 bombas · 2 cruzeiros, alcance 40 · sem metralhadora · detectável por radar'}
};
for(const [type,m]of Object.entries(PLANE_MODELS)){if(!m.ammo.cruiseMissile)m.ammo={...m.ammo,jetGun:80};TYPES[type]={...m,plane:true,air:true,vehicle:true,vision:12,move:0,min:0,range:m.ammo.cruiseMissile?40:m.ammo.jetAam?14:4,damage:80,accuracy:.8,cooldown:.6,reward:m.reward??120,weapons:Object.keys(m.ammo),cost:m.hull+Object.entries(m.ammo).reduce((n,[w,q])=>n+AMMO_PRICE[w]*q,0)};}
Object.assign(TYPES,{
 airportDirt:{name:'Aeroporto de terra',hp:350,structure:true,airport:true,width:6,height:2,vision:5,damage:0,range:0,reward:70},
 airportAsphalt:{name:'Aeroporto de concreto',hp:500,structure:true,airport:true,width:8,height:3,vision:5,damage:0,range:0,reward:90},
 airportSite:{name:'Canteiro de aeroporto',hp:150,structure:true,width:6,height:2,vision:2,damage:0,range:0,reward:25}
});
Object.assign(WEAPONS,{
 jetGun:{name:'Metralhadora do avi\u00e3o',damage:6,range:4,accuracy:.85,cooldown:.06,speed:40},
 jetAam:{name:'Míssil ar-ar',damage:70,range:14,accuracy:.9,cooldown:.6,speed:10},
 antiRadiation:{name:'Míssil antirradiação',damage:80,range:40,accuracy:.8,cooldown:.6,speed:14},
 jetAgm:{name:'Míssil antiblindados',damage:75,range:10,accuracy:.85,cooldown:.6,speed:10},
 cruiseMissile:{name:'Míssil de cruzeiro',damage:160,range:40,accuracy:1,cooldown:6,speed:8},
 bombCommon:{name:'Bomba comum',damage:80,range:0,accuracy:.8,cooldown:.1},
 bombFragment:{name:'Fragmentação',damage:45,range:0,accuracy:.8,cooldown:.1},
 bombIncendiary:{name:'Incendiária',damage:20,range:0,accuracy:.8,cooldown:.1}
});

const AIR=u=>!!TYPES[u?.type]?.air&&(!PLANE(u)||!['grounded','service','offmap','waitRunway','taxiOut','takeoffRoll','landingRoll','taxiIn'].includes(u.flightState));
const ALTITUDE_TIME=1;
function flightLevel(u){if(u.runway)return u.runway.level;const t=u.altitudeTransition;if(!t)return u.altitude==='high'?1:0;const p=Math.min(1,t.elapsed/(t.returning?.2:ALTITUDE_TIME));return t.from+(t.to-t.from)*p*p*(3-2*p);}
const MISSILE=w=>['agm','aam','antiAirVehicle','missileInfantry','rocket','stealthMissile','jetAam','antiRadiation','jetAgm','cruiseMissile'].includes(w);
// Salva da artilharia de mísseis: quatro mísseis contra a casa central, 0,25 s entre lançamentos.
const SALVO={missiles:4,interval:.25};
const LAUNCHER_TIME=.35;
// IA planejada: prazo mínimo de preparo (turnos; RTS ×30 s) e margem sobre a força azul já vista para lançar a onda.
/* Níveis da IA: preparo (turnos; RTS ×30 s), margem sobre a força azul vista, onda mínima, fila e exército máximos,
   renda e recursos de combate (reforço de onda e recuo mais cedo na Veterana). */
const PLAN={
 easy:{prep:5,margin:1.6,wave:6,queue:4,army:40,planes:2,income:.8,reinforce:false,followUp:1},
 normal:{prep:3,margin:1.15,wave:6,queue:4,army:48,planes:3,income:1,reinforce:true,followUp:1},
 hard:{prep:2,margin:1.05,wave:6,queue:6,army:56,planes:4,income:1.2,reinforce:true,followUp:1},
 veteran:{prep:2,margin:1,wave:5,queue:6,army:64,planes:5,income:1.35,reinforce:true,followUp:.5}
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
function seeded(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
const STARTING_BUDGET=600,STARTING_DEFAULT=Object.freeze({infantry:2,engineer:2,recon:1,tank:1,antitank:1});
function startingCatalog(owner='blue'){return Object.keys(TYPES).filter(type=>TYPES[type].cost>0&&!TYPES[type].structure&&(!TYPES[type].plane||TYPES[type].team===owner));}
function armyOverBudget(army){return !!army&&typeof army==='object'&&!Array.isArray(army)&&armyCost(army)>STARTING_BUDGET;}
function armyCost(army){return Object.entries(army).reduce((n,[type,count])=>n+(TYPES[type]?.cost||0)*count,0);}
function cleanStartingArmy(value,owner='blue',fallback=STARTING_DEFAULT){const catalog=startingCatalog(owner);if(!value||typeof value!=='object'||Array.isArray(value)||Object.entries(value).some(([type,n])=>!catalog.includes(type)||!Number.isInteger(n)||n<0)||armyCost(value)>STARTING_BUDGET)return {...fallback};return Object.fromEntries(Object.entries(value).filter(([,n])=>n>0));}
function enemyStartingArmy(seed){const rng=seeded((seed>>>0)^0x6a09e667),army={infantry:2,engineer:2,recon:1},types=startingCatalog('red').filter(t=>!Object.hasOwn(army,t));for(let i=types.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[types[i],types[j]]=[types[j],types[i]];}let remaining=STARTING_BUDGET-armyCost(army);for(const t of types)if(TYPES[t].cost<=remaining){army[t]=1;remaining-=TYPES[t].cost;}army.infantry+=Math.floor(remaining/TYPES.infantry.cost);return army;}
﻿class Game{
 constructor(map='river',difficulty='normal',seed=1,mode='turns',options={},doctrines={},initialArmies={},privateRandom=null){
  this.doctrines=Object.freeze({blue:cleanDoctrine(doctrines?.blue),red:cleanDoctrine(doctrines?.red)});this.nationName=NATION_DEFAULTS.name;
  this.mode=mode==='rts'?'rts':'turns';this.economyClock=0;this.aiClock=0;this.visionClock=0;this.claims=new Set();
  this.map=MAPS[map]?map:'river';this.difficulty=Object.hasOwn(PLAN,difficulty)?difficulty:'normal';this.seed=seed>>>0;this.rng=seeded(seed);this.mineRng=typeof privateRandom==='function'?privateRandom:null;this.initialArmies={blue:cleanStartingArmy(initialArmies?.blue),red:cleanStartingArmy(initialArmies?.red,'red',enemyStartingArmy(this.seed))};
  const o={...PROCEDURAL,...options},unit=v=>Math.max(0,Math.min(1,Number(v)||0));this.options={water:unit(o.water),forest:unit(o.forest),relief:unit(options.relief??options.mountain??PROCEDURAL.relief),farmland:unit(o.farmland),posts:Math.max(2,Math.min(32,Math.round(Number(o.posts)/2)*2||24))};
  this.terrain=Array(SIZE).fill('plain');this.units=[];this.structures=[];this.mines=[];this.projectiles=[];this.events=[];this.logs=[];this.nextId=1;this.nextBatchId=1;this.nextProjectileId=1;
  this.time=0;this.round=1;this.turn='blue';this.actions=[];this.animation=null;this.aiQueue=[];this.aiWait=0;this.aiEnabled=true;this.aiDecisions=0;this.aiState='prepare';this.plan={phase:'prepare',since:this.mode==='rts'?0:1,rally:null,objective:null,wave:[],waveStart:0};this.intel=new Map();this.shotsFired=0;
  this.credits={blue:150,red:150};this.fires=[];this.winner=null;this.stats={blue:{kills:{},losses:{}},red:{kills:{},losses:{}}};this.visible={blue:Array(SIZE).fill(false),red:Array(SIZE).fill(false)};this.sky={blue:Array(SIZE).fill(false),red:Array(SIZE).fill(false)};this.explored={blue:Array(SIZE).fill(true),red:Array(SIZE).fill(true)};this.memory={blue:new Map(),red:new Map()};
  this.radarContacts={blue:new Set(),red:new Set()};this.generate();for(const owner of ['blue','red'])for(const s of this.structures)if(s.owner==='neutral')this.memory[owner].set(KEY(s.x,s.y),{id:s.id,x:s.x,y:s.y,type:s.type,owner:s.owner,width:s.width,height:s.height});this.updateVision();this.log(this.mode==='rts'?'Operação RTS. P pausa o combate para dar ordens; P novamente retoma.':'Seu turno. Mova as tropas, execute ações e encerre quando estiver pronto.');
 }
 get busy(){return this.mode==='rts'?this.units.some(u=>u.pending||u.segment)||this.projectiles.length>0:!!this.animation||this.actions.length>0||this.projectiles.length>0;}
 all(){return [...this.units,...this.structures];}
 get(id){if(id==null)return undefined;return this.units.find(u=>u.id===id)||this.structures.find(u=>u.id===id);}
 hq(owner){return this.structures.find(u=>u.owner===owner&&u.type==='hq');}
 commandBase(owner){return this.hq(owner)||this.structures.find(s=>s.owner===owner&&s.type==='post'&&s.hp>0);}
 baseHp(owner,type){return Math.round(TYPES[type].hp*(TYPES[type].structure?1:NATION_DOCTRINES[this.doctrines[owner]||'balanced'].hp));}
 nationLabel(owner){return owner==='blue'?this.nationName:SIDE[owner];}
 producer(owner,base){return ['blue','red'].includes(owner)&&!!base&&base.hp>0&&base.owner===owner&&['hq','post','airportDirt','airportAsphalt'].includes(base.type)&&this.structures.includes(base);}
 producers(owner){return this.structures.filter(s=>this.producer(owner,s));}
 queueLimit(){return 5;}



 setPatrol(u,center){const c=center||{x:u.x-4,y:u.y};u.patrol={x:Math.max(4,Math.min(COLS-5,c.x)),y:Math.max(4,Math.min(ROWS-5,c.y)),angle:Math.atan2(u.y-c.y,u.x-c.x)};u.flightState='patrol';u.flightJob=null;u.pending=false;u.order={type:'patrol'};}
 flyToward(u,p,dt){const dx=p.x-u.x,dy=p.y-u.y,d=Math.hypot(dx,dy),speed=TYPES[u.type].speed,step=speed*dt;if(d<=step){if(d>1e-8){u.facing=Math.atan2(dx,-dy);u.x=p.x;u.y=p.y;}return true;}const desired=Math.atan2(dx,-dy),diff=Math.atan2(Math.sin(desired-u.facing),Math.cos(desired-u.facing));const turn=Math.max(Math.PI*2/3,2*speed/Math.max(.5,d))*dt;u.facing+=Math.max(-turn,Math.min(turn,diff));u.x+=Math.sin(u.facing)*step;u.y-=Math.cos(u.facing)*step;if(u.x<0||u.x>COLS-1||u.y<0||u.y>ROWS-1){u.x=Math.max(0,Math.min(COLS-1,u.x));u.y=Math.max(0,Math.min(ROWS-1,u.y));u.facing=Math.atan2(COLS/2-u.x,u.y-ROWS/2);}return false;}
 orbitPlane(u,dt){const p=u.patrol||{x:Math.max(4,Math.min(COLS-5,u.x-4)),y:Math.max(4,Math.min(ROWS-5,u.y)),angle:0},goal={x:p.x+4*Math.cos(p.angle),y:p.y+4*Math.sin(p.angle)};u.patrol=p;if(Math.hypot(u.x-goal.x,u.y-goal.y)>.3){this.flyToward(u,goal,dt);return 0;}const angle=TYPES[u.type].speed*dt/4;p.angle+=angle;u.x=p.x+4*Math.cos(p.angle);u.y=p.y+4*Math.sin(p.angle);u.facing=p.angle+Math.PI;return angle;}
 planeTurnRate(u){return ({fighterBlue:100,fighterRed:130,multiroleBlue:130,multiroleRed:100,stealthFighterBlue:110,stealthFighterRed:130,bomberRed:60}[u.type]||80)*Math.PI/180*(1+(u.level-1)*.05);}
 flyCombat(u,p,dt){const speed=TYPES[u.type].speed,radius=speed/this.planeTurnRate(u),margin=radius*2+1;let goal=p;const vx=Math.sin(u.facing),vy=-Math.cos(u.facing);if(u.x<margin&&vx<0||u.x>COLS-1-margin&&vx>0||u.y<margin&&vy<0||u.y>ROWS-1-margin&&vy>0)goal={x:Math.max(margin,Math.min(COLS-1-margin,u.x+vx*margin)),y:Math.max(margin,Math.min(ROWS-1-margin,u.y+vy*margin))};const desired=Math.atan2(goal.x-u.x,u.y-goal.y),diff=Math.atan2(Math.sin(desired-u.facing),Math.cos(desired-u.facing)),turn=this.planeTurnRate(u)*dt;u.facing+=Math.max(-turn,Math.min(turn,diff));
  // Na borda, desliza rente a ela com a mesma velocidade, sem giro instantâneo.
  const step=speed*dt,vx2=Math.sin(u.facing),vy2=-Math.cos(u.facing);let x=u.x+vx2*step,y=u.y+vy2*step;
  if(x<0||x>COLS-1){x=Math.max(0,Math.min(COLS-1,x));y=u.y+(Math.sign(vy2)||Math.sign(ROWS/2-u.y)||1)*Math.sqrt(Math.max(0,step*step-(x-u.x)**2));}
  else if(y<0||y>ROWS-1){y=Math.max(0,Math.min(ROWS-1,y));x=u.x+(Math.sign(vx2)||Math.sign(COLS/2-u.x)||1)*Math.sqrt(Math.max(0,step*step-(y-u.y)**2));}
  u.x=Math.max(0,Math.min(COLS-1,x));u.y=Math.max(0,Math.min(ROWS-1,y));}
 planeAligned(u,target,cone=Math.PI/12){const bearing=Math.atan2(target.x-u.x,u.y-target.y);return Math.abs(Math.atan2(Math.sin(bearing-u.facing),Math.cos(bearing-u.facing)))<=cone;}
 gunSolution(u,target){return AIR(u)&&this.planeWeaponFits(u,'jetGun',target)&&target.hp>0&&target.owner!==u.owner&&target.owner!=='neutral'&&this.canIdentify(u,target)&&DIST(u,target)<=4+1e-8&&this.planeAligned(u,target);}
 startGunBurst(u,target){if(u.gunBurst||(u.gunCooldown||0)>1e-8||!this.gunSolution(u,target))return false;u.gunCooldown=2;u.gunBurst={targetId:target.id,left:Math.min(10,u.ammo.jetGun),clock:0};this.advanceGunBurst(u,0);return true;}
 advanceGunBurst(u,dt){const b=u.gunBurst;if(!b)return;b.clock-=dt;const target=this.get(b.targetId);if(!target||!this.gunSolution(u,target)){u.gunBurst=null;return;}if(b.clock<=1e-8){this.shoot(u,target,'jetGun');b.left--;b.clock+=.06;if(!b.left||!u.ammo.jetGun)u.gunBurst=null;}}
 // Míssil de avião a menos de 4 casas: curva evasiva limitada, sem abandonar a missão.
 incoming(u){return this.projectiles.some(p=>p.targetId===u.id&&MISSILE(p.weapon)&&PLANE(this.get(p.attackerId))&&DIST(u,p)<4);}
 jink(u,goal){return {x:goal.x+Math.cos(u.facing)*3,y:goal.y+Math.sin(u.facing)*3};}
 strikeJob(u,target,weapon,salvo){return {type:'strike',targetId:target.id,weapon,missile:this.weapon(u,target),salvo,fired:0,clock:0,elapsed:0,limit:DIST(u,target)/TYPES[u.type].speed+15,gunStarted:false,observed:null};}
 separatePlane(u){u.flightState='egress';u.flightJob={type:'egress',elapsed:0,start:{x:u.x,y:u.y},goal:{x:Math.max(0,Math.min(COLS-1,u.x+Math.sin(u.facing)*8)),y:Math.max(0,Math.min(ROWS-1,u.y-Math.cos(u.facing)*8))},combat:true};}
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
  else if(['attack','strike'].includes(type)){if(!AIR(u))return false;const target=this.get(args.targetId),weapon=args.weapon||u.weaponMode||'auto';if(!target||target.hp<=0||target.owner===u.owner||target.owner==='neutral')return false;const old=u.weaponMode;u.weaponMode=weapon;const w=this.weapon(u,target);if(!w||!this.canIdentify(u,target)){u.weaponMode=old;return false;}job=this.strikeJob(u,target,weapon,args.salvo===2?2:1);}
  else if(['return','land'].includes(type)){if(!AIR(u))return false;const base=this.get(args.targetId)||this.airports(u.owner).sort((a,b)=>DIST(u,a)-DIST(u,b)||a.id-b.id)[0];if(!base||!AIRPORT(base)||base.owner!==u.owner)return false;job.type='return';job.airportId=base.id;}
  else if(type==='strikeCell'){
   // Cruzeiro marca coordenada fixa, visível ou não. As demais armas mantêm a aposta na névoa.
   const x=args.x,y=args.y,pick=args.weapon||'auto',cruise=TYPES[u.type].weapons.includes('cruiseMissile')&&(pick==='auto'||pick==='cruiseMissile');
   if(!AIR(u)||!INSIDE(x,y)||!cruise&&this.visible[u.owner][KEY(x,y)])return false;
   const weapon=cruise&&u.ammo.cruiseMissile>0?'cruiseMissile':pick==='auto'?['jetAgm','jetGun'].find(w=>u.ammo[w]>0)&&'auto':['jetAgm','jetGun'].includes(pick)&&u.ammo[pick]>0?pick:null;if(!weapon)return false;
   job={type:'cellStrike',elapsed:0,cell:{x,y},goal:{x,y},weapon,salvoAgm:args.salvo===2?2:1,salvo:1,fired:0,clock:0,limit:DIST(u,{x,y})/TYPES[u.type].speed+15,targetId:null,resolved:false};
  }
  else if(type==='bombRun'){if(!AIR(u)||!this.bombLine(u.owner,args.start,args.end))return false;const count=args.bombCount===undefined?12:args.bombCount,capacity=BOMB_TYPES.reduce((n,w)=>n+(TYPES[u.type].ammo[w]||0),0);if(![6,12,24,48].includes(count)||count>capacity)return false;const bombs=[],remaining={...u.ammo};while(bombs.length<count){let added=false;for(const w of BOMB_TYPES)if(remaining[w]>0&&bombs.length<count){bombs.push(w);remaining[w]--;added=true;}if(!added)break;}if(!bombs.length)return false;job={...job,type:'bombRun',start:{...args.start},end:{...args.end},bombs,index:0,phase:'approach'};}
  else return false;
  u.pursuitIntent=job.type==='strike'&&AIR(this.get(job.targetId))?{targetId:job.targetId,weapon:job.weapon,salvo:job.salvo}:null;u.gunBurst=null;
  if(!AIR(u)){const base=this.get(u.airportId);if(!base||base.owner!==u.owner||!AIRPORT(base))return false;u.runway={type:'takeoff',phase:'wait',baseId:base.id,level:0,elapsed:0};u.flightState='waitRunway';u.altitude='high';}else u.flightState='approach';u.flightJob=job;u.pending=true;u.path=[];u.segment=null;u.order={type:job.type,targetId:job.targetId,goal:job.goal};u.actionLeft=rts?true:false;u.moveLeft=0;u.moved=true;
  if(!rts)this.actions.push({id:u.id,type:'planeFlight',route:[],plane:true});return true;
 }
 finishPlaneFlight(u){this.setPatrol(u);if(!Object.values(u.ammo).some(n=>n>0))this.orderPlane(u,'return',{},true);return true;}
 stepPlane(u,dt){
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
   const previous=j.observed,horizon=Math.min(1.5,DIST(u,target)/TYPES[u.type].speed),vx=previous?(target.x-previous.x)/dt:0,vy=previous?(target.y-previous.y)/dt:0,speed=Math.hypot(vx,vy),limit=TYPES[target.type].speed||0,scale=speed>limit&&speed>0?limit/speed:1;
   j.observed={x:target.x,y:target.y};const goal={x:target.x+(target.width||1)/2-.5+vx*scale*horizon,y:target.y+(target.height||1)/2-.5+vy*scale*horizon};
   // Only observed motion is extrapolated. Incoming aircraft missiles permit a bounded evasive turn.
   this.flyCombat(u,this.incoming(u)?this.jink(u,goal):goal,dt);j.clock-=dt;
   if(missile&&j.fired<j.salvo&&this.planeAligned(u,target,Math.PI/6)&&DIST(u,target)<=this.weaponRange(u,missile)&&j.clock<=1e-8&&u.cooldown<=1e-8){this.shoot(u,target,missile);j.fired++;j.clock=.6;u.flightState='attack';}
   const missilesDone=!missile||j.fired>=j.salvo;
   if(missilesDone){if(gun&&this.planeWeaponFits(u,'jetGun',target)){if(!j.gunStarted&&this.startGunBurst(u,target)){j.gunStarted=true;u.flightState='attack';}if(j.gunStarted&&!u.gunBurst)this.separatePlane(u);}else this.separatePlane(u);}
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
    else{u.ammo[j.weapon]--;if(j.weapon!=='jetGun')u.cooldown=u.reload=this.weaponStats(u,j.weapon).cooldown;this.event('blast',{x:cell.x,y:cell.y,owner:u.owner},{dud:true,visible:true});}
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
  if(!u||this.winner||u.runway||!PLANE(u)||!TYPES[u.type].weapons.includes('cruiseMissile')||!this.units.includes(u)||u.hp<=0||!AIR(u)||!cell||!INSIDE(cell.x,cell.y)||!(u.ammo.cruiseMissile>0)||u.cooldown>1e-8||DIST(u,cell)>this.weaponRange(u,'cruiseMissile'))return false;
  const w=WEAPONS.cruiseMissile;u.ammo.cruiseMissile--;u.cooldown=u.reload=w.cooldown;
  this.projectiles.push({attackerId:u.id,owner:u.owner,type:u.type,weapon:'cruiseMissile',air:true,sourceLevel:flightLevel(u),targetLevel:0,sx:u.x,sy:u.y,x:u.x,y:u.y,tx:cell.x,ty:cell.y,heading:Math.atan2(cell.y-u.y,cell.x-u.x),trail:[],elapsed:0,duration:Math.max(.1,DIST(u,cell)/w.speed),power:this.attackPower(u,'cruiseMissile'),hit:true});
  this.shotsFired++;this.event('shot',u,{weapon:'antitank'});return true;
 }
 bombImpact(p){
  if(!p.hit){this.event('blast',{x:p.tx,y:p.ty},{dud:true});return;}const attacker=this.get(p.attackerId),cell={x:p.tx,y:p.ty};this.event('blast',cell,{heavy:true});
  for(const t of this.all().filter(t=>t.hp>0&&!AIR(t)&&DIST(t,cell)<=2&&Math.max(Math.max(t.x-cell.x,cell.x-t.x-(t.width||1)+1,0),Math.max(t.y-cell.y,cell.y-t.y-(t.height||1)+1,0))<=1)){
   const center=DIST(t,cell)<.1;let power=p.power*(center?1:.5);if(p.weapon==='bombFragment')power*=(TYPES[t.type].vehicle||TYPES[t.type].structure)?.25:1.5;
   this.hurt(t,Math.max(1,Math.round(power*(1-this.cover(t)))),attacker);
  }
  if(p.weapon==='bombIncendiary'){for(let y=cell.y-1;y<=cell.y+1;y++)for(let x=cell.x-1;x<=cell.x+1;x++)if(INSIDE(x,y)){const fire=this.fires.find(f=>f.x===x&&f.y===y);if(fire){fire.left=6;fire.turns={blue:2,red:2,neutral:2};}else this.fires.push({x,y,left:6,power:p.power/4,attackerId:p.attackerId,turns:{blue:2,red:2,neutral:2}});}}
 }
 advanceFires(dt,owner){
  const hit=new Map();for(const fire of this.fires){const active=owner?fire.turns[owner]>0:fire.left>0;if(!active)continue;for(const u of this.all())if(u.hp>0&&!AIR(u)&&(!owner||u.owner===owner)&&DIST(u,fire)<=.05){const n=fire.power*(owner?3:dt)*((TYPES[u.type].vehicle||TYPES[u.type].structure)?.5:1);const old=hit.get(u.id);if(!old||old.n<n)hit.set(u.id,{u,n,attacker:this.get(fire.attackerId)});}if(owner)fire.turns[owner]--;else fire.left-=dt;}
  for(const {u,n,attacker}of hit.values()){u.burnDamage=(u.burnDamage||0)+n;if(u.burnDamage>=1){const amount=Math.floor(u.burnDamage);u.burnDamage-=amount;this.hurt(u,amount,attacker);}}
  this.fires=this.fires.filter(f=>owner?f.turns.blue>0||f.turns.red>0:f.left>0);
 }
 servicePlane(u,rearm=true,internal=false){
  const base=this.get(u.airportId);if(u.runway||this.winner||this.mode==='turns'&&!internal&&(this.turn!==u.owner||this.busy||!u.actionLeft)||!PLANE(u)||AIR(u)||!base||base.owner!==u.owner||!AIRPORT(base)||u.flightState==='service')return false;
  const missing=Object.entries(TYPES[u.type].ammo).reduce((n,[w,q])=>n+Math.max(0,q-(u.ammo[w]||0))*AMMO_PRICE[w],0),paid=rearm&&this.credits[u.owner]>=missing;
  if(paid)this.credits[u.owner]-=missing;u.flightState='service';if(this.mode==='turns'){u.actionLeft=false;u.moveLeft=0;}u.serviceProgress=0;u.serviceRearm=paid;u.order={type:'planeService'};return true;
 }
 progressPlaneService(owner,elapsed){for(const u of this.units)if(PLANE(u)&&u.owner===owner&&u.flightState==='service'){const b=this.get(u.airportId);if(!b||b.owner!==owner)continue;u.serviceProgress+=elapsed;const duration=(b.type==='airportAsphalt'?1:2)*(this.mode==='rts'?10:1);if(u.serviceProgress+1e-8>=duration){u.hp=u.maxHp;u.flares=TYPES[u.type].flares;if(u.serviceRearm)u.ammo={...TYPES[u.type].ammo};u.flightState='grounded';u.pending=false;u.order={type:'stop'};this.event('ready',u);}}}
 completeTurn(owner){for(const u of this.units.filter(u=>u.owner===owner&&u.captureIntent&&!u.pending&&u.actionLeft)){const target=this.captureTarget(u);if(target&&(u.moveLeft>0||DIST(u,target)<=1))this.order(u,'capture',{targetId:target.id,position:u.captureIntent.position},true);}const planes=this.units.filter(u=>u.owner===owner&&PLANE(u)&&AIR(u)&&u.actionLeft&&!u.pending);if(!planes.length&&!this.actions.length){this.beginTurn(owner==='blue'?'red':'blue');return;}this.turnEnding=owner==='blue'?'red':'blue';for(const u of planes){if(u.pursuitIntent){const intent=u.pursuitIntent;if(this.orderPlane(u,'attack',intent,true))continue;this.endPursuit(u);}u.actionLeft=false;u.pending=true;u.flightJob=u.flightJob?.type==='return'?{...u.flightJob,wait:0}:{type:'patrolTurn',angle:0};this.actions.push({id:u.id,type:'planeFlight',plane:true,route:[]});}}

 generateAirports(carve,nodes){if(seeded(this.seed^0x43c8a15b)()>=.5)return;const {width,height}=TYPES.airportAsphalt;for(const pos of [{x:4,y:4},{x:4,y:8},{x:8,y:4}]){const pair=[pos,{x:COLS-pos.x-width,y:ROWS-pos.y-height}];if(pair.some(p=>{const area={x:p.x-2,y:p.y,width:width+4,height};return !INSIDE(area.x,area.y)||!INSIDE(area.x+area.width-1,area.y+height-1)||this.structures.some(s=>DIST({...p,width,height},s)<2||DIST(area,s)===0)||this.units.some(u=>DIST(area,u)===0)||this.mines.some(m=>DIST(area,m)===0);} ))continue;for(const p of pair){const access={x:p.x-1,y:p.y+height-1};carve(access,nodes.slice().sort((a,b)=>DIST(a,access)-DIST(b,access))[0]);this.add('neutral','airportAsphalt',p.x,p.y);}for(const p of pair)for(let y=p.y;y<p.y+height;y++)for(let x=p.x-2;x<p.x+width+2;x++)if(x>=p.x&&x<p.x+width||!['road','bridge'].includes(this.terrain[KEY(x,y)]))this.terrain[KEY(x,y)]='plain';break;}}
 airportApproaches(cell){const cells=[];for(let y=cell.y;y<cell.y+2;y++)for(const x of [cell.x-2,cell.x-1,cell.x+6,cell.x+7])if(INSIDE(x,y))cells.push({x,y});return cells;}
 airportBuildInfo(cell){const approaches=cell?this.airportApproaches(cell):[];let valid=!!cell&&INSIDE(cell.x-2,cell.y)&&INSIDE(cell.x+7,cell.y+1),duration=30;if(valid)for(let y=cell.y;y<cell.y+2;y++)for(let x=cell.x-2;x<cell.x+8;x++){const t=this.terrain[KEY(x,y)];if(['forest','hedge','hill','mountain'].includes(t))duration=60;if(t==='river'||this.structureAt(x,y)||this.mines.some(m=>m.x===x&&m.y===y)||x>=cell.x&&x<cell.x+6&&this.occupied(x,y,null,false))valid=false;}return {valid,duration,approaches};}
 airportBuildSite(cell){return this.airportBuildInfo(cell).valid;}
 airportDuration(site){return (site.buildDuration||30)/(this.mode==='rts'?1:10);}
 buildAirport(ids,cell){const info=this.airportBuildInfo(cell);const owner=this.get(ids?.[0])?.owner,workers=[...new Set(ids||[])].map(id=>this.get(id)).filter(u=>u?.type==='engineer'&&u.hp>0&&u.owner===owner&&!u.airportSiteId&&(this.mode==='rts'||u.actionLeft));if(this.winner||!['blue','red'].includes(owner)||this.mode==='turns'&&(this.turn!==owner||this.busy)||workers.length<2||this.credits[owner]<400||!info.valid)return false;const site={...cell,width:6,height:2};if(this.mode==='turns'&&workers.filter(u=>DIST(u,site)<=1&&!u.segment).length<2)return false;const routes=workers.map(u=>this.pathToRange(u,site,1));if(routes.filter(Boolean).length<2)return false;const s=this.add(owner,'airportSite',cell.x,cell.y);s.work=0;s.buildDuration=info.duration;s.workers=[];this.credits[owner]-=400;this.assignAirportWorkers(s,workers.map(u=>u.id));if(this.mode==='turns')this.progressAirports(owner,1);this.report('Construção de aeroporto: 400 créditos, dois engenheiros.',s);return true;}
 assignAirportWorkers(site,ids){if(!site||site.type!=='airportSite'||site.hp<=0||!this.structures.includes(site))return false;const workers=[...new Set(ids||[])].map(id=>this.get(id)).filter(u=>u?.type==='engineer'&&u.owner===site.owner&&u.hp>0&&(!u.airportSiteId||u.airportSiteId===site.id)&&(this.mode==='rts'||DIST(u,site)<=1&&!u.segment));if(workers.length<2)return false;const routes=workers.map(u=>this.pathToRange(u,site,1));if(routes.filter(r=>r!==null).length<2)return false;for(const old of this.units.filter(u=>u.airportSiteId===site.id&&!workers.includes(u))){old.airportSiteId=null;this.finishRTS(old);}site.workers=workers.map(u=>u.id);for(let i=0;i<workers.length;i++){const u=workers[i],route=routes[i];if(route===null)continue;this.cancelWork(u);u.airportSiteId=site.id;u.order={type:'airportWork',targetId:site.id};u.job={id:u.id,type:'airportWork',targetId:site.id,route};u.path=route.slice();u.pending=route.length>0;}return true;}
 progressAirports(owner,elapsed){for(const site of this.structures.filter(s=>s.owner===owner&&s.type==='airportSite')){if(this.mode==='turns'&&site.lastWorkRound===this.round)continue;const workers=this.units.filter(u=>u.owner===owner&&u.type==='engineer'&&u.airportSiteId===site.id&&u.order.type==='airportWork'&&u.hp>0&&!u.segment&&DIST(u,site)<=1&&(this.mode==='rts'||u.actionLeft));if(workers.length<2)continue;site.work+=elapsed;if(this.mode==='turns'){site.lastWorkRound=this.round;for(const u of workers)u.actionLeft=false;}if(site.work+1e-8>=this.airportDuration(site)){const cells=this.airportApproaches(site).filter(p=>this.terrain[KEY(p.x,p.y)]!=='plain');for(const p of cells)this.terrain[KEY(p.x,p.y)]='plain';if(cells.length)this.event('terrainChanged',site,{cells,visible:true});site.type='airportDirt';site.hp=site.maxHp=TYPES.airportDirt.hp;site.work=0;for(const u of this.units.filter(u=>u.airportSiteId===site.id)){u.airportSiteId=null;u.job=null;u.pending=false;u.order={type:'stop'};u.path=[];}this.updateVision();this.report('Aeroporto de terra concluído.',site);this.event('ready',site);}}}
 loseAirport(base,attacker){base.queue=[];for(const u of [...this.docked(base)])this.hurt(u,u.hp,attacker);for(const u of this.units.filter(u=>u.runway?.baseId===base.id))this.redirectPlane(u,base);base.runwayId=null;}
 canCapture(u,base){return base?.type==='post'?POST_CAPTURERS.has(u?.type):AIRPORT(base)&&u?.type==='infantry';}
 knownObjective(owner,id,position){const remembered=[...this.memory[owner].values()].find(s=>s.id===id),p=position||remembered;if(p&&this.isVisible(owner,p))return this.structures.find(s=>s.id===id)||null;const actual=this.structures.find(s=>s.id===id);return actual&&this.isVisible(owner,actual)?actual:remembered||null;}
 knownPostAt(owner,p){return [...this.structures.filter(s=>s.type==='post'&&this.isVisible(owner,s)),...this.memory[owner].values()].find(s=>s.type==='post'&&DIST(p,s)<.6)||null;}
 captureTarget(u){const intent=u.captureIntent;if(!intent)return null;const t=this.knownObjective(u.owner,intent.targetId,intent.position);if(!t||t.owner===u.owner){if(this.multiplayer||u.owner==='blue')this.log(t?'Objetivo já aliado.':'Objetivo destruído ou não existe mais.',[u.owner]);u.captureIntent=null;return null;}return t;}
 captureStatus(u){return u.work>0?'Capturando':u.captureIntent&&!u.segment&&!u.path.length&&DIST(u,u.captureIntent.position)>1?'Aguardando passagem':'Indo capturar';}
 captureStructure(base,u){if(AIRPORT(base))this.loseAirport(base,u);base.queue=[];base.owner=u.owner;this.report(TYPES[base.type].name+' capturado pela Nação '+this.nationLabel(u.owner)+'.',u);}

 planeWeapon(u,w){const t=TYPES[u.type],red=t.team==='red',fighter=!!t.radar;let base=WEAPONS[w];if(!base)return null;let range=base.range,damage=base.damage;if(w==='jetAam'){range=fighter?14:12;damage=fighter?(red?75:70):(red?80:65);}if(w==='antiRadiation')damage=red?90:80;if(w==='jetAgm'){range=red?12:10;damage=red?90:75;}return {...base,range,damage};}
 planeEvasion(u){return Math.min(.8,TYPES[u.type].evasion+(u.level-1)*.05);}
 planeWeaponFits(u,w,b){return AIR(u)&&u.ammo[w]>0&&(w==='jetAam'?AIR(b):w==='antiRadiation'?b.type==='antiAirVehicle'&&b.radarOn:w==='jetAgm'?!AIR(b)&&(TYPES[b.type].vehicle||TYPES[b.type].structure):w==='jetGun'?!TYPES[b.type].structure&&!ARMORED.has(b.type):false);}
 /* Alvo inimigo de solo na casa compatível com a arma: tropas antes de estruturas, menor id primeiro. */
 cellTarget(u,cell,weapon){const ok=e=>e.hp>0&&e.owner!==u.owner&&e.owner!=='neutral'&&this.planeWeaponFits(u,weapon,e),units=this.units.filter(e=>!AIR(e)&&Math.round(e.x)===cell.x&&Math.round(e.y)===cell.y&&ok(e)).sort((a,b)=>a.id-b.id);return units[0]||this.structures.filter(s=>cell.x>=s.x&&cell.x<s.x+(s.width||1)&&cell.y>=s.y&&cell.y<s.y+(s.height||1)&&ok(s)).sort((a,b)=>a.id-b.id)[0]||null;}
 /* Alcance máximo das armas de solo e da antirradiação (sem ar-ar nem bombas) de um avião em voo com munição; é até onde ele enxerga uma antiaérea que acabou de disparar. */
 strikeReach(u){if(!PLANE(u)||!AIR(u))return 0;return Math.max(0,...TYPES[u.type].weapons.filter(w=>w!=='jetAam'&&w!=='cruiseMissile'&&!BOMB_TYPES.includes(w)&&u.ammo[w]>0).map(w=>this.weaponRange(u,w)));}
 canIdentify(u,target){return this.isVisible(u.owner,target)||(PLANE(u)&&target?.type==='antiAirVehicle'&&target.radarOn&&u.ammo.antiRadiation>0&&DIST(u,target)<=this.planeWeapon(u,'antiRadiation').range);}
 emitterContacts(owner){const observers=this.units.filter(u=>u.owner===owner&&u.hp>0&&PLANE(u)&&AIR(u)&&u.ammo.antiRadiation>0);return this.units.filter(u=>u.hp>0&&u.owner!==owner&&u.owner!=='neutral'&&u.type==='antiAirVehicle'&&(this.isVisible(owner,u)||u.radarOn&&observers.some(p=>this.canIdentify(p,u)))).map(u=>({id:u.id,x:u.x,y:u.y,radarOn:u.radarOn}));}
 radarCoverage(owner,u){if(!AIR(u)||TYPES[u.type].stealth||TYPES[u.type].radarStealth)return false;return this.units.some(e=>e.hp>0&&e.owner===owner&&((e.type==='antiAirVehicle'&&e.radarOn&&u.altitude==='high')||(PLANE(e)&&TYPES[e.type].radar&&e.radarOn!==false&&AIR(e)&&DIST(e,u)<=18)));}
 useSmoke(u){if(u.type!=='antiAirVehicle'||u.smokeCharges<=0||(this.mode==='rts'?u.smokeCooldown>0:u.smokeUsed))return false;u.smokeCharges--;u.smokeCooldown=12;u.smokeTime=3;u.smokeUsed=true;this.event('defenseSmoke',u);return true;}
 defendAir(interceptionOnly=false){for(const a of this.units.filter(u=>u.type==='antiAirVehicle'&&u.hp>0)){if(this.mode==='rts'?a.cooldown>0:!a.reactionReady||a.owner===this.turn)continue;const incoming=this.projectiles.filter(p=>['antiRadiation','cruiseMissile'].includes(p.weapon)&&!p.intercepted&&p.owner!==a.owner&&DIST(a,p)<=6).sort((p,q)=>Number(q.weapon==='antiRadiation')-Number(p.weapon==='antiRadiation')||Number(q.targetId===a.id)-Number(p.targetId===a.id)||Number(this.get(q.targetId)?.type==='antiAirVehicle')-Number(this.get(p.targetId)?.type==='antiAirVehicle')||DIST(a,p)-DIST(a,q));if(incoming.length){const p=incoming[0];p.projectileId??=this.nextProjectileId++;a.cooldown=3.5;a.reactionReady=false;this.shotsFired++;this.event('shot',a,{weapon:'antitank'});this.projectiles.push({projectileId:this.nextProjectileId++,targetProjectileId:p.projectileId,interceptor:true,interceptSuccess:this.rng()<(p.weapon==='cruiseMissile'?.75:.3),attackerId:a.id,owner:a.owner,type:a.type,weapon:'antiAirVehicle',air:true,sourceLevel:0,targetLevel:p.visualLevel??p.sourceLevel??0,sx:a.x,sy:a.y,x:a.x,y:a.y,tx:p.x,ty:p.y,elapsed:0,duration:Math.max(.1,p.duration-p.elapsed),heading:Math.atan2(p.y-a.y,p.x-a.x),trail:[]});continue;}if(this.mode==='rts'||interceptionOnly)continue;const target=this.units.filter(u=>u.owner!==a.owner&&PLANE(u)&&AIR(u)&&this.canFire(a,u)).sort((u,v)=>DIST(a,u)-DIST(a,v)||u.id-v.id)[0];if(target){a.reactionReady=false;this.shoot(a,target);}}}
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
 planeCatalog(owner){return Object.keys(PLANE_MODELS).filter(type=>TYPES[type].team===owner);}
 recruitCost(type,base){return Math.round((TYPES[type]?.cost||0)*(base?.type==='airportAsphalt'&&TYPES[type]?.plane? .8:1));}
 runwayBusy(base){const p=this.get(base.runwayId);if(!p||p.hp<=0||p.runway?.baseId!==base.id){base.runwayId=null;return false;}return true;}
 releaseRunway(u){const b=this.get(u.runway?.baseId);if(b?.runwayId===u.id)b.runwayId=null;u.runway=null;}
 redirectPlane(u,lost){this.releaseRunway(u);u.airportId=null;const base=this.airports(u.owner).filter(b=>b!==lost).sort((a,b)=>DIST(u,a)-DIST(u,b)||a.id-b.id)[0];if(base){u.flightState='approach';u.flightJob={type:'return',airportId:base.id};u.pending=true;}else{this.setPatrol(u);if(this.mode==='turns'){this.actions=this.actions.filter(a=>a.id!==u.id);if(this.animation?.id===u.id)this.finishAction(u);}}}
 runwayPoints(base){const y=base.y+base.height/2-.5;return {start:{x:base.x+.5,y},end:{x:base.x+base.width-1.5,y},approach:{x:base.x-1.5,y},climb:{x:Math.min(COLS-1,base.x+base.width+.5),y}};}
 runwayPhase(u,phase,goal,duration,level){const r=u.runway;r.phase=phase;r.elapsed=0;r.from={x:u.x,y:u.y};r.goal=goal;r.duration=duration;r.fromLevel=r.level;r.toLevel=level;u.flightState=phase;}
 stepRunway(u,dt){
  const r=u.runway,base=this.get(r.baseId);if(!base||base.hp<=0||base.owner!==u.owner){if(AIR(u)){this.redirectPlane(u,base);return !u.flightJob;}this.releaseRunway(u);this.hurt(u,u.hp);return true;}
  const points=this.runwayPoints(base);
  if(r.phase==='wait'){if(this.runwayBusy(base)&&base.runwayId!==u.id)return false;base.runwayId=u.id;this.runwayPhase(u,'taxiOut',points.start,1.2,0);}
  if(r.phase==='approach'){if(this.incoming(u)){this.flyCombat(u,this.jink(u,points.approach),dt);return false;}if(this.flyToward(u,points.approach,dt)){u.facing=Math.PI/2;this.runwayPhase(u,'landing',points.start,1.5,0);}return false;}
  r.elapsed=Math.min(r.duration,r.elapsed+dt);const p=r.elapsed/r.duration,q=r.phase==='takeoffRoll'?p*p:r.phase==='landingRoll'?1-(1-p)*(1-p):p;
  const dx=r.goal.x-r.from.x,dy=r.goal.y-r.from.y;if(Math.hypot(dx,dy)>.001)u.facing=Math.atan2(dx,-dy);u.x=r.from.x+dx*q;u.y=r.from.y+dy*q;r.level=r.fromLevel+(r.toLevel-r.fromLevel)*p*p*(3-2*p);
  if(r.elapsed+1e-8<r.duration)return false;
  if(r.phase==='taxiOut')this.runwayPhase(u,'takeoffRoll',points.end,1.8,0);
  else if(r.phase==='takeoffRoll'){u.airportId=null;this.runwayPhase(u,'climb',points.climb,1,1);}
  else if(r.phase==='climb'){this.releaseRunway(u);u.flightState='approach';}
  else if(r.phase==='landing'){u.airportId=base.id;this.runwayPhase(u,'landingRoll',points.end,2,0);}
  else if(r.phase==='landingRoll')this.runwayPhase(u,'taxiIn',r.slot,1.5,0);
  else if(r.phase==='taxiIn'){this.releaseRunway(u);u.flightState='grounded';u.pending=false;u.flightJob=null;u.order={type:'stop'};this.servicePlane(u,true,true);return true;}
  return false;
 }
 docked(base){return this.units.filter(u=>PLANE(u)&&u.hp>0&&u.airportId===base.id&&!AIR(u));}
 airportSlot(base){const arriving=this.units.filter(u=>u.hp>0&&u.runway?.type==='land'&&u.runway.baseId===base.id&&AIR(u));if(this.docked(base).length+arriving.length>=4)return null;for(let i=0;i<4;i++){const p={x:base.x+Math.round(.5+(i+.5)*(base.width-1)/4),y:base.y+base.height-1};if(!this.occupied(p.x,p.y,null,false)&&!this.units.some(u=>u.runway?.baseId===base.id&&u.runway.slot&&u.runway.slot.x===p.x&&u.runway.slot.y===p.y))return p;}return null;}
 canRecruit(owner,type,base){const t=TYPES[type];return this.producer(owner,base)&&!!t?.cost&&(AIRPORT(base)?this.planeCatalog(owner).includes(type):!t.plane);}

 add(owner,type,x,y){
  const t=TYPES[type];if(!t||!INSIDE(x,y)||!['blue','red','neutral'].includes(owner))return null;
  const u={id:this.nextId++,owner,type,x,y,facing:owner==='blue'?0:Math.PI,hp:t.hp,maxHp:t.hp,level:1,xp:0,cooldown:0,setup:0,packing:0,idle:0,entrenched:false,suppressed:0,revealed:0,work:0,reserved:0,order:{type:'stop'},path:[],segment:null,navGoal:null,healText:0,moveLeft:t.move||0,actionLeft:!t.structure,moved:false,pending:false};
  u.hp=u.maxHp=this.baseHp(owner,type);if(t.width){u.width=t.width;u.height=t.height;}if(t.plane){u.ammo={...t.ammo};u.flightState='patrol';u.patrol={x:Math.max(4,Math.min(COLS-5,x-4)),y:Math.max(4,Math.min(ROWS-5,y)),angle:0};u.salvo=1;}if(t.structure)u.queue=[];if(t.air){if(!t.unarmed)u.weaponMode='auto';u.altitude=t.drone||t.plane?'high':'low';u.flares=t.drone?0:t.flares||3;u.flareCooldown=0;u.flareUsed=false;}if(t.stealth){u.missiles=t.missiles;u.spotted={blue:false,red:false};}if(type==='antiAirVehicle'){u.radarOn=true;u.smokeCharges=2;u.smokeCooldown=0;u.smokeTime=0;u.smokeUsed=false;u.reactionReady=true;}(t.structure?this.structures:this.units).push(u);if(type==='antiAirVehicle')this.updateRadarContacts();return u;
 }
  generate(){
  const o=this.options,rng=this.rng,mid=COLS/2,T=this.terrain,seed=this.seed;
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
  const exit={x:4,y:ROWS-3};
  // Casas ligadas à saída sem atravessar serra (rios viram pontes nas estradas).
  const reach=new Uint8Array(SIZE),queue=[KEY(exit.x,exit.y)];reach[queue[0]]=1;
  while(queue.length){const k=queue.pop(),px=k%COLS,py=(k-px)/COLS;for(const [dx,dy]of DIRS){const x=px+dx,y=py+dy,n=KEY(x,y);if(INSIDE(x,y)&&!reach[n]&&at(x,y)!=='mountain'){reach[n]=1;queue.push(n);}}}
  // 6. Postos em pontos estratégicos: colinas, cabeceiras de rio e o meio do mapa; espaçados e longe dos QGs.
  const home={x:1,y:ROWS-4,width:3,height:3},hqs=[home,mirror(home)],placed=[],nearWater=(x,y)=>[[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]].some(([dx,dy])=>INSIDE(x+dx,y+dy)&&at(x+dx,y+dy)==='river');
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
  carve(exit,center);carve(center,mirror(center));
  const nodes=[exit,mirror(exit),center,mirror(center)];
  // Vale dos Rios: travessia reta extra (e o espelho), com ponte, ligada à malha pelas pontas.
  if(P.centralRiver){const y=Math.round(ROWS*.2),ends=[{x:mid-8,y},{x:mid+7,y}];for(let x=ends[0].x;x<=ends[1].x;x++)set(x,y,['river','bridge'].includes(at(x,y))?'bridge':'road');
   for(const e of ends){carve(e,nodes.slice().sort((m,n)=>DIST(m,e)-DIST(n,e))[0]);nodes.push(e,mirror(e));}}
  for(const p of placed){const access={x:p.x-1,y:p.y},q=nodes.slice().sort((m,n)=>DIST(m,access)-DIST(n,access))[0];carve(access,q);nodes.push(access,mirror(access));}
  // Complexos neutros com acesso pela borda, sem estrada atravessando os prédios.
  for(const p of placed)for(const c of [p,mirror(p)]){for(let y=c.y;y<c.y+c.height;y++)for(let x=c.x;x<c.x+c.width;x++)T[KEY(x,y)]='plain';this.add('neutral','post',c.x,c.y);}
  // 8. Tropas iniciais.
  for(const [type,p]of [['hq',home],['commander',{x:4,y:ROWS-3}]]){const q=mirror(p);this.add('blue',type,p.x,p.y);this.add('red',type,q.x,q.y);}
  this.generateAirports(carve,nodes);
  // 9. Minas no centro, fora de água, serra, ponte e estruturas.
  const mineRandom=this.mineRng||rng;for(let placedMines=0,tries=0;placedMines<4&&tries<200;tries++){const x=mid-6+Math.floor(mineRandom()*12),y=Math.floor(ROWS/2)-5+Math.floor(mineRandom()*10),cells=[[x,y],[COLS-1-x,ROWS-1-y]];
   if(cells.some(([cx,cy])=>['river','mountain','bridge'].includes(at(cx,cy))||this.structureAt(cx,cy)||this.mines.some(m=>m.x===cx&&m.y===cy))||x===COLS-1-x&&y===ROWS-1-y)continue;
   for(const [cx,cy]of cells)this.mines.push({x:cx,y:cy,known:{blue:false,red:false}});placedMines++;}
  for(const owner of ['blue','red']){const positions=[];for(let y=ROWS-5;y<ROWS;y++)for(let x=0;x<6;x++)positions.push({x,y});positions.sort((a,b)=>(a.y-ROWS+5)%2-(b.y-ROWS+5)%2||a.y-b.y||Math.abs(a.x-1)-Math.abs(b.x-1)||a.x-b.x);
   for(let y=ROWS-7;y<ROWS;y++)for(let x=0;x<8;x++)if(y<ROWS-5||x>=6)positions.push({x,y});
   for(const type of startingCatalog(owner))for(let n=0;n<(this.initialArmies[owner][type]||0);n++){const cell=positions.map(p=>owner==='blue'?p:mirror(p)).find(p=>!this.structureAt(p.x,p.y)&&!this.units.some(u=>u.owner===owner&&u.x===p.x&&u.y===p.y));if(!cell)throw Error('Initial army has no deployment space');if(['river','mountain'].includes(at(cell.x,cell.y)))set(cell.x,cell.y,'plain');const unit=this.add(owner,type,cell.x,cell.y);if(PLANE(unit))this.setPatrol(unit);}
  }
 }

 log(text,audiences){this.logs.unshift({time:this.mode==='rts'?this.time:this.round,text,...(this.multiplayer?{audiences:audiences||['blue']}:{})});if(this.logs.length>70)this.logs.pop();}
 report(text,...units){const audiences=['blue','red'].filter(owner=>units.some(u=>u.owner===owner||this.isVisible(owner,u)));if(this.multiplayer){if(audiences.length)this.log(text,audiences);}else if(audiences.includes('blue'))this.log(text);}
 reportDamage(p,target,amount){const source=this.get(p.attackerId);for(const owner of this.multiplayer?['blue','red']:['blue'])if(target.owner===owner||this.isVisible(owner,target)){const name=p.owner===target.owner?'Fogo amigo':p.owner===owner||source&&this.isVisible(owner,source)?TYPES[p.type].name:'Ataque não identificado';this.log(`${name}: ${TYPES[target.type].name} −${amount}.`,[owner]);}}
 event(kind,u,extra={}){const p=TYPES[u?.type]?.structure?CENTER(u):u;this.events.push({kind,id:u.id,x:p.x,y:p.y,flightLevel:AIR(u)?flightLevel(u):0,air:AIR(u),contactId:AIR(u)?u.id:undefined,visible:u.owner==='blue'||this.isVisible('blue',u),...(kind==='shot'?{sourceType:u.type,facing:u.facing}:{}),...extra,...(this.multiplayer?{seq:this.nextEventSeq=(this.nextEventSeq||0)+1,audiences:['blue','red'].filter(owner=>u.owner===owner||this.isVisible(owner,u)||!!u.spotted?.[owner]||extra.publicMissile===true)}:{})});if(this.events.length>250)this.events.shift();}
  structureAt(x,y){return this.structures.find(s=>s.hp>0&&x>=s.x&&x<s.x+(s.width||1)&&y>=s.y&&y<s.y+(s.height||1));}
 terrainAt(u){const p=TILE(u);return this.terrain[KEY(p.x,p.y)];}
 cost(u,x,y){if(!INSIDE(x,y))return Infinity;if(AIR(u))return 1;const t=this.terrain[KEY(x,y)];if(t==='river'||t==='mountain'&&u.type!=='infantry')return Infinity;if(t==='road')return .5;const vehicle=TYPES[u.type].vehicle;return t==='forest'&&vehicle?2:(t==='hill'||t==='hedge')&&vehicle?1.5:1;}
 moveDirections(u){return AIR(u)&&!PLANE(u)?AIR_DIRS:DIRS;}
 travelDistance(u,a,b){const dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y);return AIR(u)&&!PLANE(u)?Math.max(dx,dy)+(Math.SQRT2-1)*Math.min(dx,dy):dx+dy;}
 stepCost(u,from,to){return this.cost(u,to.x,to.y)*(AIR(u)&&!PLANE(u)?Math.hypot(to.x-from.x,to.y-from.y):1);}
 crossingFlight(u,from,to,knownOnly=false){if(!AIR(u)||PLANE(u)||from.x===to.x||from.y===to.y)return false;return this.units.some(v=>v!==u&&v.hp>0&&AIR(v)&&!PLANE(v)&&v.segment&&(!knownOnly||v.owner===u.owner||this.isVisible(u.owner,v))&&v.segment.from.x!==v.segment.to.x&&v.segment.from.y!==v.segment.to.y&&from.x+to.x===v.segment.from.x+v.segment.to.x&&from.y+to.y===v.segment.from.y+v.segment.to.y);}
 /* Segmentos diagonais de outros voos conhecidos por u, como soma (de+para): é o que crossingFlight(u,a,b,true) procura, calculado uma vez por busca. */
 crossings(u){const sums=new Set();if(AIR(u)&&!PLANE(u))for(const v of this.units)if(v!==u&&v.hp>0&&AIR(v)&&!PLANE(v)&&v.segment&&v.segment.from.x!==v.segment.to.x&&v.segment.from.y!==v.segment.to.y&&(v.owner===u.owner||this.isVisible(u.owner,v)))sums.add((v.segment.from.x+v.segment.to.x)*512+v.segment.from.y+v.segment.to.y);return sums;}
 // Ocupação e reservas por camada: aeronaves só disputam casa com aeronaves; solo, com solo.
 occupied(x,y,except,air=AIR(except)){return this.units.find(u=>u!==except&&u.hp>0&&!(PLANE(u)&&AIR(u))&&AIR(u)===air&&(DIST(TILE(u),{x,y})===0||u.segment&&(DIST(u.segment.from,{x,y})===0||DIST(u.segment.to,{x,y})===0)));}
 /* Grades por casa: guardam a primeira unidade/estrutura de cada casa, igual às buscas lineares, numa só varredura. */
 unitGrid(except){
  const grid=Array(SIZE).fill(null),air=AIR(except),mark=(x,y,v)=>{if(INSIDE(x,y)&&!grid[KEY(x,y)])grid[KEY(x,y)]=v;};
  for(const v of this.units)if(v!==except&&v.hp>0&&!(PLANE(v)&&AIR(v))&&AIR(v)===air){mark(Math.round(v.x),Math.round(v.y),v);if(v.segment){mark(v.segment.from.x,v.segment.from.y,v);mark(v.segment.to.x,v.segment.to.y,v);}}
  return grid;
 }
 structureGrid(){const grid=Array(SIZE).fill(null);for(const s of this.structures)if(s.hp>0)for(let y=s.y;y<s.y+(s.height||1);y++)for(let x=s.x;x<s.x+(s.width||1);x++)if(INSIDE(x,y)&&!grid[KEY(x,y)])grid[KEY(x,y)]=s;return grid;}
 passable(u,x,y,avoidUnits,units,structures){
  const k=KEY(x,y);if(!AIR(u)&&(structures[k]?.type==='hq'||structures[k]?.width))return false;
  const blocker=units[k],known=blocker&&(blocker.owner===u.owner||this.isVisible(u.owner,blocker));return !(known&&(avoidUnits||blocker.owner!==u.owner));
 }
 /* Casas que findPath(u, casa) alcança: o A* é completo, então equivale a uma inundação com as mesmas regras. */
 reachable(u,units=this.unitGrid(u),structures=this.structureGrid()){
  const start=TILE(u),seen=new Uint8Array(SIZE),queue=new Int16Array(SIZE),crossings=this.crossings(u);let head=0,tail=0;seen[queue[tail++]=KEY(start.x,start.y)]=1;
  while(head<tail){const k=queue[head++],px=k%COLS,py=(k-px)/COLS;for(const [dx,dy]of this.moveDirections(u)){
   const x=px+dx,y=py+dy;if(x<0||y<0||x>=COLS||y>=ROWS)continue;const key=KEY(x,y);
   if(seen[key]||px!==x&&py!==y&&crossings.has((px+x)*512+py+y)||!this.passable(u,x,y,false,units,structures)||!Number.isFinite(this.cost(u,x,y)))continue;seen[key]=1;queue[tail++]=key;
  }}return seen;
 }
 /* A* ponderado: heurística admissível (menor custo = 0,5), vizinhos conforme a camada. Heap ordenado por (f, g, inserção) = mesma ordem da antiga lista ordenada estável. */
 findPath(u,goal,avoidUnits=false,units=this.unitGrid(u),structures=this.structureGrid(),near=null,min=0){
  const start=TILE(u);if(near===null&&(!INSIDE(goal.x,goal.y)||!Number.isFinite(this.cost(u,goal.x,goal.y))||!this.passable(u,goal.x,goal.y,avoidUnits,units,structures)))return null;
  // Batedor: menor número de casas; o custo do terreno só desempata rotas do mesmo tamanho. Demais tropas: rota mais rápida.
  const shortest=u.type==='recon',step=shortest?(from,to)=>1+this.cost(u,to.x,to.y)*1e-3:(from,to)=>this.stepCost(u,from,to),h=shortest||AIR(u)?1:.5;
  const diagonal=AIR(u)&&!PLANE(u),estimate=p=>(near===null?this.travelDistance(u,p,goal):Math.max(0,DIST(p,goal)-near)*(diagonal?Math.SQRT1_2:1))*h;
  const crossings=this.crossings(u),root=KEY(start.x,start.y),end=KEY(goal.x,goal.y),costs=new Float64Array(SIZE).fill(Infinity),parents=new Int16Array(SIZE),heap=[];let seq=0;costs[root]=0;
  const before=(a,b)=>a.f<b.f||a.f===b.f&&(a.g<b.g||a.g===b.g&&a.s<b.s);
  const push=n=>{heap.push(n);let i=heap.length-1;while(i){const up=(i-1)>>1;if(!before(heap[i],heap[up]))break;[heap[i],heap[up]]=[heap[up],heap[i]];i=up;}};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<heap.length&&before(heap[l],heap[m]))m=l;if(r<heap.length&&before(heap[r],heap[m]))m=r;if(m===i)break;[heap[i],heap[m]]=[heap[m],heap[i]];i=m;}}return top;};
  push({x:start.x,y:start.y,f:estimate(start),g:0,s:seq++});
  while(heap.length){
   const p=pop(),k=KEY(p.x,p.y);if(p.g!==costs[k])continue;
   if(near===null?k===end:DIST(p,goal)<=near&&DIST(p,goal)>=min){const path=[];let key=k;while(key!==root){path.unshift({x:key%COLS,y:Math.floor(key/COLS)});key=parents[key];}return path;}
   for(const [dx,dy]of this.moveDirections(u)){
    const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=COLS||y>=ROWS||!this.passable(u,x,y,avoidUnits,units,structures))continue;
    if(p.x!==x&&p.y!==y&&crossings.has((p.x+x)*512+p.y+y))continue;
    const g=p.g+step(p,{x,y}),key=KEY(x,y);if(!Number.isFinite(g)||g>=costs[key])continue;
    costs[key]=g;parents[key]=k;push({x,y,g,f:g+estimate({x,y}),s:seq++});
   }
  }return null;
 }
 radarContact(owner,u){return !!u&&AIR(u)&&u.hp>0&&u.owner!==owner&&!!this.radarContacts[owner]?.has(u.id);}
 updateRadarContacts(){for(const owner of ['blue','red']){const contacts=this.radarContacts[owner];contacts.clear();for(const u of this.units)if(u.hp>0&&u.owner!==owner&&this.radarCoverage(owner,u))contacts.add(u.id);}}
 setRadar(u,on){if(!u||!(u.type==='antiAirVehicle'||PLANE(u)&&TYPES[u.type].radar)||u.hp<=0||!this.units.includes(u)||typeof on!=='boolean')return false;u.radarOn=on;this.updateVision();return true;}
 isVisible(owner,u){if(PLANE(u)&&u.flightState==='offmap')return false;if(TYPES[u?.type]?.structure||u?.width){for(let y=u.y;y<u.y+(u.height||1);y++)for(let x=u.x;x<u.x+(u.width||1);x++)if(this.visible[owner]?.[KEY(x,y)])return true;return false;}if(!u||!this.visible[owner])return false;if(u.spotted)return u.hp>0&&!!u.spotted[owner];const p=TILE(u);return this.radarContact(owner,u)||!!(AIR(u)?this.sky:this.visible)[owner][KEY(p.x,p.y)];}
 effectVisible(x,y,air=false,contactId,sourceId){const owner=this.playerSide||'blue',p=TILE({x,y});if(!INSIDE(p.x,p.y))return false;if((air?this.sky:this.visible)[owner][KEY(p.x,p.y)])return true;if(air)for(const id of [contactId,sourceId]){if(id===undefined)continue;const u=this.get(id);if(this.radarContact(owner,u)&&Math.hypot(x-u.x,y-u.y)<=2)return true;}return false;}
 // Alcance contra um alvo; sem alvo, o maior alcance do modo de arma atual.
 weaponStats(u,w){return PLANE(u)?this.planeWeapon(u,w):w==='gun'?TYPES[u.type].gun||WEAPONS[w]:WEAPONS[w];}
 weaponRange(u,w,altitude=u.altitude){if(!TYPES[u.type].weapons?.includes(w))return 0;return this.weaponStats(u,w).range+(!PLANE(u)&&altitude==='high'&&w!=='gun'&&w!=='stealthMissile'?5:0);}
 range(u,target,altitude=u.altitude){const t=TYPES[u.type];if(target&&!this.weapon(u,target)||t.unarmed)return 0;if(u.type==='rocketArtillery'||u.type==='antiAirVehicle')return t.range;if(u.type==='missileInfantry')return target&&!AIR(target)?1:3;if(!t.air)return t.range+({mountain:2,hill:1}[this.terrainAt(u)]||0);if(target)return this.weaponRange(u,this.weapon(u,target),altitude);const mode=u.weaponMode||'auto';return mode==='auto'?Math.max(...t.weapons.map(w=>this.weaponRange(u,w,altitude))):this.weaponRange(u,mode,altitude);}
 sight(u){if(PLANE(u))return AIR(u)?12:0;return AIR(u)&&!TYPES[u.type].drone&&u.altitude==='high'?15:TYPES[u.type].vision+(!AIR(u)&&['mountain','hill'].includes(this.terrainAt(u))?2:0);}
 /* Arma de a contra b, ou null se incompatível. Solo: a própria tropa (só infantaria e metralhador alcançam aeronaves).
    Helicóptero: arma manual se compatível; Auto prefere o míssil contra veículo/estrutura (ar-terra) ou aeronave (ar-ar). */
 // Minigun/canhão dos helicópteros também atingem blindados; armas comuns continuam bloqueadas.
 weapon(a,b){if(a.type==='lightTank'&&b.type==='heavyTank')return null;const w=this.pickWeapon(a,b);return w&&ARMORED.has(b.type)&&!BREAKERS.has(a.type)&&w!=='agm'&&w!=='jetAgm'&&!(w==='gun'&&TYPES[a.type].gun)?null:w;}
 pickWeapon(a,b){
  const t=TYPES[a.type],air=AIR(b);if(t.plane){const mode=a.weaponMode||'auto';return mode==='auto'?t.weapons.find(w=>this.planeWeaponFits(a,w,b))||null:this.planeWeaponFits(a,mode,b)?mode:null;}if(t.unarmed||a.type==='rocketArtillery')return null;if(t.stealth)return a.missiles>0?'stealthMissile':null;if(a.type==='antiAirVehicle')return air?a.type:null;if(a.type==='missileInfantry')return a.type;if(!t.air)return air&&a.type!=='infantry'&&a.type!=='machinegun'?null:a.type;
  const fits=w=>w==='gun'||(w==='agm')!==air,mode=a.weaponMode||'auto';if(mode!=='auto')return fits(mode)?mode:null;
  const missile=t.weapons[1];return missile&&fits(missile)&&(air||TYPES[b.type].vehicle||TYPES[b.type].structure)?missile:'gun';
 }
 setWeapon(u,mode){if(!u||!TYPES[u.type]?.weapons?.length||!['auto',...TYPES[u.type].weapons].includes(mode))return false;u.weaponMode=mode;return true;}
 // Visão agrupada: no RTS vários movimentos por tick apenas marcam a visão como suja e flushVision a refaz uma vez; por turnos segue imediata.
 touchVision(){this.visionDirty=true;if(this.mode==='turns')this.flushVision();}
 flushVision(){if(this.visionDirty)this.updateVision();}
 updateVision(){
  this.visionDirty=false;this.updateRadarContacts();
  for(const owner of ['blue','red']){
   const visible=this.visible[owner],sky=this.sky[owner],explored=this.explored[owner];visible.fill(false);sky.fill(false);
   const seers=[];
   for(const list of [this.units,this.structures])for(const u of list){
    if(u.owner!==owner||u.hp<=0)continue;const p=u.type==='hq'||u.type==='post'?CENTER(u):u,r=this.sight(u),limit=r+.05,high=AIR(u)&&!TYPES[u.type].drone&&u.altitude==='high',detection=high?1:u.type==='recon'?3:2,x0=Math.max(0,Math.floor(p.x-r)),x1=Math.min(COLS-1,Math.ceil(p.x+r));seers.push([p,limit,this.strikeReach(u)]);
    for(let y=Math.max(0,Math.floor(p.y-r));y<=Math.min(ROWS-1,Math.ceil(p.y+r));y++){const dy=Math.abs(p.y-y);for(let x=x0;x<=x1;x++){const d=Math.abs(p.x-x)+dy;if(d<=limit){const k=KEY(x,y),terrain=this.terrain[k],concealed=!TYPES[u.type].drone&&(CONCEAL.has(terrain)||high&&(terrain==='hill'||terrain==='mountain'));explored[k]=true;sky[k]=true;if(!concealed||d<=detection+.05)visible[k]=true;}}}
   }
   // Drone furtivo: a primeira vez no céu visto por este lado o descobre de vez.
   for(const e of this.units)if(e.spotted&&e.owner!==owner&&e.hp>0&&!e.spotted[owner]){const p=TILE(e);if(sky[KEY(p.x,p.y)]){e.spotted[owner]=true;if(this.multiplayer){this.log('Drone furtivo inimigo descoberto.',[owner]);this.log('Seu drone furtivo foi descoberto.',[e.owner]);}else if(owner==='blue')this.log('Drone furtivo inimigo descoberto.');else if(e.owner==='blue')this.log('Seu drone furtivo foi descoberto.');}}
   // Helicóptero alto: cobertura terrestre até 1 casa; disparos revelam a quem tem alcance de visão, inclusive do alto.
   for(const e of this.units)if(e.owner!==owner&&e.revealed>0){const p=TILE(e),k=KEY(p.x,p.y);if(!visible[k]&&seers.some(([o,limit,reach])=>DIST(o,e)<=(e.type==='antiAirVehicle'?Math.max(limit,reach):limit)))visible[k]=true;}
   for(const [key,s]of this.memory[owner])if(this.isVisible(owner,s))this.memory[owner].delete(key);
   for(const s of this.structures)if(this.isVisible(owner,s))this.memory[owner].set(KEY(s.x,s.y),{id:s.id,x:s.x,y:s.y,type:s.type,owner:s.owner,width:s.width,height:s.height});
   for(const m of this.mines)if(this.units.some(u=>u.type==='engineer'&&u.owner===owner&&DIST(u,m)<=2))m.known[owner]=true;
   // Inteligência da IA: última posição vista de cada tropa azul; sai quando morre ou quando a casa conhecida está à vista e vazia.
   if(owner==='red'){
    for(const e of this.units)if(e.owner==='blue'&&this.isVisible('red',e)){const p=TILE(e);this.intel.set(e.id,{id:e.id,type:e.type,x:p.x,y:p.y,hp:e.hp,maxHp:e.maxHp});}
    for(const [id,e]of this.intel){const live=this.get(id);if(!live||live.hp<=0||(AIR(e)?sky:visible)[KEY(e.x,e.y)]&&!this.isVisible('red',live))this.intel.delete(id);}
   }
  }
 }
 hasAura(u){return this.units.some(c=>c.owner===u.owner&&c.type==='commander'&&c.hp>0&&DIST(u,c)<=2);}
 cover(u){if(AIR(u))return 0;return Math.min(.75,TERRAIN[this.terrainAt(u)].cover+(u.entrenched?.25:0));}
 attackPower(u,w){return (PLANE(u)&&w||AIR(u)?this.weaponStats(u,w||'gun').damage:TYPES[u.type].damage)*(1+(u.level-1)*.1)*(this.hasAura(u)?1.2:1)*NATION_DOCTRINES[this.doctrines[u.owner]||'balanced'].damage;}
 accuracy(a,b,w=this.weapon(a,b)){if(PLANE(a)){const model=TYPES[a.type],t=!BOMB_TYPES.includes(w)&&model.weaponModel?TYPES[model.weaponModel]:model,s=this.planeWeapon(a,w),d=s.range?Math.min(1,DIST(a,b)/s.range):0,red=t.team==='red';let base=w==='jetGun'?.85-.2*d:w==='jetAam'?(t.radar?(red?.9-.2*d:.95-.1*d):(red?.9-.1*d:.85-.1*d)):.7+t.evasion/2+(t===TYPES.multiroleRed?.1:0);return Math.max(.1,Math.min(.95,(base+(a.level-1)*.05+(this.hasAura(a)?.15:0)-(PLANE(b)?0:(b.level-1)*.05)-(a.suppressed>0?.25:0))*(w==='jetGun'&&PLANE(b)&&AIR(b)?1-this.planeEvasion(b)/2:1)));}return Math.max(.1,Math.min(.99,(AIR(a)&&this.weaponStats(a,w)?this.weaponStats(a,w).accuracy:TYPES[a.type].accuracy)-(a.type==='tank'?Math.max(0,DIST(a,b)-3)*.1:0)+(a.level-1)*.05+(this.hasAura(a)?.15:0)-(PLANE(b)?0:(b.level-1)*.05)-(a.suppressed>0?.25:0)+(MISSILE(w)?(AIR(a)&&a.altitude==='high'?.1:0)+(AIR(b)&&b.altitude==='high'?.1:0)+(b.type==='reconDrone'&&['antiAirVehicle','missileInfantry'].includes(a.type)?.1:0):0)));}
 flareReady(u){return AIR(u)&&u.flares>0&&(this.mode==='rts'?u.flareCooldown<=1e-8:!u.flareUsed);}
 serviceSite(u,base){return (u.type==='antiAirVehicle'||AIR(u)&&!PLANE(u)&&u.altitude==='low')&&!u.segment&&base?.hp>0&&base.owner===u.owner&&['hq','post'].includes(base.type)&&DIST(u,base)<=1&&this.structures.includes(base);}
 canService(u,base){return this.serviceSite(u,base)&&(u.type==='antiAirVehicle'?u.smokeCharges<2:u.hp<u.maxHp||u.flares<3);}
 canBombard(u,cell){if(u?.type!=='rocketArtillery'||!cell||!INSIDE(cell.x,cell.y))return false;const t=TYPES[u.type],d=DIST(u,cell);return d<=t.range+.05&&d>=t.min;}
 canFire(a,b){return !!b&&b.hp>0&&b.owner!==a.owner&&b.owner!=='neutral'&&!!this.weapon(a,b)&&this.canIdentify(a,b)&&DIST(a,b)<=this.range(a,b)+.05&&DIST(a,b)>=TYPES[a.type].min;}

 // Mira da IA: antitanque em veículos, metralhador em tropa a pé, mísseis em aeronaves; prefere abates prováveis,
 // alvos de maior valor e perto; artilharia escolhe o ponto com mais inimigos no 3×3 e nenhum aliado.
 aiAcquire(u){
  let friends,foes;const reach=this.range(u)+.05;
  const around=(list,e)=>list.filter(v=>Math.max(Math.abs(v.x-e.x),Math.abs(v.y-e.y))<=1).length;
  let best=null,bestScore=-Infinity;
  for(const list of [this.units,this.structures])for(const e of list){
   if(DIST(u,e)>reach||!this.canFire(u,e))continue;
   const w=this.weapon(u,e),t=TYPES[e.type],d=DIST(u,e);let role=1;
   if(u.type==='artillery')role=around(friends??=this.units.filter(v=>v.owner==='red'&&v.hp>0),e)?-10:2+around(foes??=this.all().filter(e=>e.owner==='blue'&&e.hp>0),e)*2;
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
   if(DIST(u,e)>reach||!this.canFire(u,e))continue;const d=DIST(u,e),t=TYPES[e.type],priority=TYPES[u.type].air?Number(this.weapon(u,e)!=='gun'):u.type==='antitank'?Number(!!t.vehicle):u.type==='machinegun'?Number(!t.vehicle&&!t.structure):0;
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
 buildSite(u){if(u?.type!=='infantry'||u.hp<=0||u.segment)return false;const p={...TILE(u),width:TYPES.post.width,height:TYPES.post.height};if(!INSIDE(p.x+p.width-1,p.y+p.height-1)||this.structures.some(s=>DIST(s,p)<3))return false;for(let y=p.y;y<p.y+p.height;y++)for(let x=p.x;x<p.x+p.width;x++)if(!['plain','road','forest','field','hill'].includes(this.terrain[KEY(x,y)])||this.occupied(x,y,u,false)||this.mines.some(m=>m.x===x&&m.y===y))return false;return true;}
 canBuild(u){return !!u&&(this.mode==='rts'||u.owner===this.turn)&&u.actionLeft&&!u.pending&&this.credits[u.owner]>=60&&this.buildSite(u);}
 pathCost(u,path){let from=TILE(u.segment?.to||u),sum=0;for(const p of path){sum+=this.stepCost(u,from,p);from=p;}return sum;}
 trimPath(u,path){if(this.mode==='rts')return path;let left=u.moveLeft,from=TILE(u);const route=[];for(const p of path){const cost=this.stepCost(u,from,p);if(cost>left+1e-8)break;left-=cost;route.push(p);from=p;}return route;}
 pathToRange(u,target,near,min=0,budget=Infinity){
  const start=this.mode==='rts'&&u.segment?{...u,...u.segment.to}:u;
  if(DIST(start,target)<=near&&DIST(start,target)>=min)return [];
  // RTS: uma busca até qualquer casa no alcance, inclusive quando nenhuma rota existe.
  if(this.mode==='rts'&&budget===Infinity)return this.findPath(start,target,true,this.unitGrid(u),this.structureGrid(),near,min);
  const cells=[],units=this.unitGrid(u),structures=this.structureGrid(),r=Number.isFinite(near)?near:COLS+ROWS;for(let y=Math.max(0,Math.floor(target.y-r));y<=Math.min(ROWS-1,Math.ceil(target.y+(target.height||1)-1+r));y++)for(let x=Math.max(0,Math.floor(target.x-r));x<=Math.min(COLS-1,Math.ceil(target.x+(target.width||1)-1+r));x++){const d=DIST({x,y},target);if(d<=near&&d>=min&&this.passable(u,x,y,true,units,structures)&&Number.isFinite(this.cost(u,x,y)))cells.push({x,y});}
  const minStep=AIR(u)||!this.terrain.includes("road")?1:.5;cells.sort((a,b)=>this.travelDistance(u,a,start)-this.travelDistance(u,b,start));let best=null,bestCost=Infinity,tries=0;
  // Cada casa candidata custa uma busca A*: sem orçamento de movimento (RTS), só as 12 mais próximas são testadas.
  for(const cell of cells){const floor=this.travelDistance(u,cell,start)*minStep;if(floor>=bestCost||floor>budget+1e-8||tries++>=12&&budget===Infinity)break;const route=this.findPath(start,cell,true,units,structures);if(!route)continue;const cost=this.pathCost(u,route);if(cost<=budget+1e-8&&cost<bestCost){best=route;bestCost=cost;}}
  return best;
 }
 order(u,type,args={},batch=false){
  const rts=this.mode==='rts';
  if(PLANE(u))return this.orderPlane(u,type,args,batch);
  if(!rts&&type==='stop'&&u?.pending&&AIR(u)&&u.owner===this.turn&&!this.winner&&this.units.includes(u)){
   this.cancelAltitude(u);this.actions=this.actions.filter(a=>a.id!==u.id);u.moveLeft=0;u.actionLeft=false;u.path=[];u.order={type:'stop'};
   if(this.animation?.id===u.id){if(u.segment){this.animation.type='move';this.animation.route=[];}else this.finishAction(u);}else u.pending=false;
   return true;
  }
  if(this.winner||!u||!this.units.includes(u)||u.hp<=0||!['blue','red'].includes(u.owner)||!rts&&(u.owner!==this.turn||u.pending||this.busy&&!batch))return false;
  if(type==='stop'){if(u.airportSiteId){u.airportSiteId=null;u.job=null;}u.captureIntent=null;if(rts)this.finishRTS(u);else{u.moveLeft=0;u.actionLeft=false;u.entrenched=!AIR(u);u.order={type:'stop'};}return true;}
  let route=[],target=type==='capture'?this.knownObjective(u.owner,args.targetId,args.position):this.get(args.targetId),job={id:u.id,type,targetId:target?.id};
  if(type==='move'){
   const goal={x:Math.round(args.x),y:Math.round(args.y)};if(!INSIDE(goal.x,goal.y)||!rts&&(u.moveLeft<=0||u.type==='artillery'&&!u.actionLeft&&!u.moved))return false;
   const start=rts&&u.segment?{...u,...u.segment.to}:u,path=this.findPath(start,goal,true,this.unitGrid(u));if(!path)return false;route=this.trimPath(u,path);if(!route.length&&!(rts&&u.segment))return false;job.goal=goal;
  }else{
   if(!rts&&!u.actionLeft)return false;
   if(u.type==='rocketArtillery'&&(type==='bombard'||type==='attack')){
    // Casa escolhida pode estar sob névoa ou inexplorada; o ataque a um inimigo visível mira a casa dele.
    const cell=type==='bombard'?{x:Math.round(args.x),y:Math.round(args.y)}:target&&target.owner!==u.owner&&target.owner!=='neutral'&&this.isVisible(u.owner,target)?TILE(target):null;
    if(!cell||!INSIDE(cell.x,cell.y))return false;type=job.type='bombard';job.cell=cell;job.targetId=undefined;
    route=this.pathToRange(u,cell,TYPES[u.type].range,TYPES[u.type].min,rts?Infinity:u.moveLeft);if(route===null)return false;
   }else if(type==='attack'){
    if(!target||target.owner===u.owner||target.owner==='neutral'||!this.weapon(u,target)||!this.isVisible(u.owner,target))return false;
    if(!rts&&u.type==='artillery'&&(u.moved||!this.canFire(u,target)))return false;
    route=this.pathToRange(u,target,this.range(u,target),TYPES[u.type].min,rts?Infinity:u.moveLeft);if(route===null)return false;
   }else if(type==='repair'){
    if(u.type!=='engineer'||!target||AIR(target)||target===u||target.owner!==u.owner||target.hp>=target.maxHp)return false;
    route=this.pathToRange(u,target,1,0,rts?Infinity:u.moveLeft);if(route===null)return false;
   }else if(type==='altitude'){
    if(!AIR(u)||TYPES[u.type].drone||!['low','high'].includes(args.altitude)||args.altitude===u.altitude)return false;job.altitude=args.altitude;
   }else if(type==='service'){
    if(!this.canService(u,target))return false;
   }else if(type==='capture'){
    if(!this.canCapture(u,target)||target.owner===u.owner)return false;
    route=this.trimPath(u,this.pathToRange(u,target,1)||[]);job.position={x:target.x,y:target.y,width:target.width,height:target.height};
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
  if(rts){this.cancelAltitude(u);if(type!=='build')this.cancelWork(u);u.work=0;u.idle=0;u.navWait=0;u.job=job;}
  u.entrenched=false;u.pending=true;u.path=route.slice();job.route=route;u.order={type,targetId:job.targetId,altitude:job.altitude,cell:job.cell,goal:route.length?route[route.length-1]:job.goal};if(!rts)this.actions.push(job);return true;
 }
 command(ids,type,args={},owner='blue'){
  if(this.winner||!['blue','red'].includes(owner)||this.mode!=='rts'&&(this.turn!==owner||this.busy))return 0;let count=0;const assigned=new Set(),army=[...new Set(ids)].map(id=>this.get(id)).filter(u=>u?.owner===owner&&!TYPES[u.type].structure);
  for(const u of army){
   if(type==='move'&&army.length>1&&!PLANE(u)){
    const candidates=[];for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(DIST({x,y},args)<=4&&!this.occupied(x,y,u)&&(AIR(u)||this.structureAt(x,y)?.type!=='hq')&&Number.isFinite(this.cost(u,x,y)))candidates.push({x,y});
    candidates.sort((a,b)=>DIST(a,args)-DIST(b,args)||DIST(a,u)-DIST(b,u));
    for(const goal of candidates){const start=this.mode==='rts'&&u.segment?{...u,...u.segment.to}:u,path=this.findPath(start,goal,true,this.unitGrid(u));if(!path)continue;const route=this.trimPath(u,path),last=route[route.length-1],slot=(AIR(u)?'a':'g')+KEY(last?.x,last?.y);if(!last||assigned.has(slot))continue;if(this.order(u,type,goal,true)){assigned.add(slot);count++;break;}}
   }else if(this.order(u,type,args,true))count++;
  }return count;
 }
 enterCell(u){if(AIR(u))return;const m=this.mines.find(m=>m.x===u.x&&m.y===u.y);if(!m)return;this.mines=this.mines.filter(v=>v!==m);this.hurt(u,40,null);this.event('blast',u);this.report(`${TYPES[u.type].name} atingido por mina: −40.`,u);}
 // Um míssil da salva: impacto na casa escolhida (não persegue); 80% de impacto efetivo, sorteado pelo RNG do combate.
 launch(u,cell){
  const t=TYPES[u.type];u.facing=Math.atan2(cell.x-u.x,u.y-cell.y);u.cooldown=u.reload=t.cooldown;u.revealed=2;
  this.projectiles.push({attackerId:u.id,owner:u.owner,type:u.type,weapon:'rocket',air:false,sourceLevel:0,targetLevel:0,sx:u.x,sy:u.y,x:u.x,y:u.y,tx:cell.x,ty:cell.y,heading:Math.atan2(cell.y-u.y,cell.x-u.x),trail:[],elapsed:0,duration:Math.max(.8,DIST(u,cell)/8),power:this.attackPower(u),hit:this.rng()<t.accuracy});
  this.shotsFired++;this.event('shot',u,{weapon:'antitank'});
 }
 shoot(u,target,weapon){
  if(u.type==='lightTank'&&target?.type==='heavyTank')return false;
  if(u.type==='artillery'&&this.mode!=='rts')u.moveLeft=0;
  // O projétil guarda arma, dano e alvo do disparo; trocar de arma depois não o altera. Helicópteros: recarga única por arma usada.
  const w=weapon||this.weapon(u,target);if(!w||PLANE(u)&&!this.planeWeaponFits(u,w,target))return false;const missile=MISSILE(w);if(PLANE(u))u.ammo[w]--;if(w==='stealthMissile')u.missiles--;
  if(!PLANE(u))u.facing=Math.atan2(target.x-u.x,u.y-target.y);if(w==='jetGun')u.gunShotClock=.06;else u.cooldown=u.reload=(TYPES[u.type].air?this.weaponStats(u,w):TYPES[u.type]).cooldown;u.revealed=2;const artillery=u.type==='artillery',aim=artillery?TILE(target):{x:target.x,y:target.y};
  const accuracyBase=this.accuracy(u,target,w),flareProtected=missile&&this.flareReady(target),evasiveAccuracy=accuracyBase*(missile&&PLANE(target)&&AIR(target)?1-this.planeEvasion(target):1),accuracy=evasiveAccuracy*(flareProtected?.5:1),roll=this.rng();
  const decoy=flareProtected?{x:Math.max(0,Math.min(COLS-1,target.x+(target.id%2?1.3:-1.3))),y:Math.max(0,Math.min(ROWS-1,target.y+1.2))}:null;
  if(flareProtected){target.flares--;target.flareUsed=true;target.flareCooldown=8;this.event('flare',target,{decoy});}
  this.projectiles.push({attackerId:u.id,owner:u.owner,type:u.type,weapon:w,air:AIR(u)||AIR(target),sourceLevel:AIR(u)?flightLevel(u):0,targetLevel:AIR(target)?flightLevel(target):0,targetId:target.id,sx:u.x,sy:u.y,x:u.x,y:u.y,tx:aim.x,ty:aim.y,heading:Math.atan2(aim.y-u.y,aim.x-u.x),trail:[],elapsed:0,duration:PLANE(u)?Math.max(.1,DIST(u,target)/this.planeWeapon(u,w).speed):missile?Math.max(.45,w==='antiAirVehicle'?DIST(u,target)/12:Math.min(1.2,DIST(u,target)/6)):artillery?.7:u.type==='antitank'?.3:.18,power:this.attackPower(u,w),distance:DIST(u,target),range:PLANE(u)?this.weaponRange(u,w):this.range(u,target),accuracyBase,accuracy,flareProtected,attackerAltitude:u.altitude,targetAltitude:target.altitude,deflected:flareProtected&&roll>=accuracy&&roll<evasiveAccuracy,decoy,hit:roll<accuracy,critical:this.rng()<.1});
  const shot=this.projectiles.at(-1);if(w==='antiRadiation'){if(!target.smokeTime)this.useSmoke(target);}this.shotsFired++;this.event('shot',u,{weapon:w==='gun'||w==='jetGun'?'machinegun':missile?'antitank':u.type});
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
   if(p.type==='lightTank'&&t.type==='heavyTank')continue;
   let power=p.power;if(p.type==='artillery')power*=Math.max(.8,Math.min(1,1-.2*(DIST({x:p.sx,y:p.sy},t)-2)/Math.max(1,p.range-2)))*(t.id===p.targetId?1:.5);
   if(p.type==='recon')power*=TYPES[t.type].tank?.4:!TYPES[t.type].vehicle&&!TYPES[t.type].structure?1.5:1;
   if(p.type==='antitank')power*=TYPES[t.type].vehicle?2.25:TYPES[t.type].structure?1:.5;
   if(p.type==='machinegun')power*=AIR(t)?1:TYPES[t.type].vehicle?.25:TYPES[t.type].structure?.5:1.3;
   // Contra helicópteros: infantaria −75%, metralhador −35%; cai até metade no alcance máximo do disparo.
   if(AIR(t)&&(p.type==='infantry'||p.type==='machinegun'))power*=(p.type==='infantry'?.25:.65)*(1-.5*Math.min(1,p.distance/p.range));
   if(p.weapon==='gun'){const gun=TYPES[p.type].gun||HELICOPTER_CANNON;power*=AIR(t)?(PLANE(t)?.35:1):TYPES[t.type].structure?gun.structureMultiplier:TYPES[t.type].vehicle?gun.vehicleMultiplier:gun.infantryMultiplier;}
   if(p.weapon==='jetGun'){if(TYPES[t.type].structure||ARMORED.has(t.type))continue;if(AIR(t))power*=1.75;else if(TYPES[t.type].vehicle)power*=.5;}
   if(p.weapon==='jetAgm')power*=TYPES[t.type].vehicle?1.5:1;if(p.weapon==='agm')power*=TYPES[t.type].vehicle?1.5:TYPES[t.type].structure?1:.5;
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
   const c=TILE(NEAREST(t,center)),power=p.power*(c.x===center.x&&c.y===center.y?1:.5)*(p.weapon==='rocket'&&TYPES[t.type].structure?2:1),n=Math.max(1,Math.round(power*(1-this.cover(t))));
   this.hurt(t,n,attacker);this.reportDamage(p,t,n);
  }
 }
 hurt(u,n,attacker){
  if(!u||u.hp<=0)return;if(u.order.type==='service'){if(this.mode==='rts')this.finishRTS(u);else{this.actions=this.actions.filter(a=>a.id!==u.id);if(this.animation?.id===u.id)this.animation=null;u.pending=false;u.order={type:'stop'};}}u.hp=Math.max(0,u.hp-n);if(u.type!=='airportSite')u.work=0;u.idle=0;u.entrenched=false;this.event('text',u,{text:`−${Math.round(n)}`,color:'#ffab96'});
  if(u.hp>0){if(!TYPES[u.type].structure)u.suppressed=this.mode==='rts'?3:2;return;}this.cancelWork(u);if(AIRPORT(u))this.loseAirport(u,attacker);if(u.runway)this.releaseRunway(u);if(u.type==='airportSite')for(const w of this.units.filter(w=>w.airportSiteId===u.id)){w.airportSiteId=null;this.finishRTS(w);}if(u.queue)u.queue=[];this.event('blast',u,TYPES[u.type].structure&&u.type!=='airportSite'?{wreck:{type:u.type,x:u.x,y:u.y,width:u.width||1,height:u.height||1}}:{});this.report(`${TYPES[u.type].name} da Nação ${this.nationLabel(u.owner)} destruído.`,u);
  // Placar por tipo (perfil do jogador): perdas de cada lado e abates de quem atirou; estruturas não contam.
  if(!TYPES[u.type].structure&&this.stats[u.owner]){const l=this.stats[u.owner].losses;l[u.type]=(l[u.type]||0)+1;const k=attacker&&attacker.owner!==u.owner&&this.stats[attacker.owner]?.kills;if(k)k[u.type]=(k[u.type]||0)+1;}
  if(u.type==='commander'){this.credits[u.owner]=Math.floor(this.credits[u.owner]/2);this.report('Comandante perdido. Metade dos créditos foi perdida.',u);}
  if(attacker&&attacker.hp>0&&attacker.owner!==u.owner&&u.owner!=='neutral'){
   this.credits[attacker.owner]+=TYPES[u.type].reward||0;attacker.xp++;const level=attacker.xp>=3?3:2;
   if(level>attacker.level){attacker.level=level;const base=this.baseHp(attacker.owner,attacker.type),gain=Math.round(base*.1);attacker.maxHp=Math.round(base*(1+(level-1)*.1));attacker.hp=Math.min(attacker.maxHp,attacker.hp+gain);this.report(`${TYPES[attacker.type].name} promovido a ${level===3?'Elite':'Veterano'}.`,attacker);}
  }
  this.units=this.units.filter(v=>v.hp>0);this.structures=this.structures.filter(v=>v.hp>0);
  if(u.type==='antiAirVehicle'||AIR(u))this.updateVision();
 }

 finishAction(u){if(u&&PLANE(u)){u.pending=false;this.animation=null;this.updateVision();return;}if(u){if(this.mode==='rts')this.finishRTS(u);else{u.pending=false;u.path=[];u.segment=null;u.order=u.captureIntent?{type:'capture',targetId:u.captureIntent.targetId}:{type:'stop'};}}this.animation=null;this.updateVision();}
 resolveAction(job,u){
  const target=job.type==='capture'&&u.captureIntent?this.captureTarget(u):this.get(job.targetId);let valid=false;
  if(job.type==='capture'){if(target&&this.canCapture(u,target)&&DIST(u,target)<=1&&this.isVisible(u.owner,target)&&this.structures.includes(target)&&u.actionLeft){this.captureStructure(target,u);u.actionLeft=this.mode==='rts';u.captureIntent=null;}this.finishAction(u);return;}
  if(job.type==='move'){this.finishAction(u);if(!this.multiplayer&&this.turn==='red'&&u.actionLeft){const enemy=this.acquire(u);if(enemy)this.order(u,'attack',{targetId:enemy.id});}return;}
  if(job.type==='attack'){
   if(this.canFire(u,target)){const weapon=this.weapon(u,target),gun=weapon==='gun'?this.weaponStats(u,weapon):null;this.animation={...job,weapon,route:[],shots:gun?.shots||(u.type==='machinegun'?3:1),shotInterval:gun?.shots>1?gun.cooldown:.12,shotClock:0,fired:0};return;}
  }else if(job.type==='bombard'){
   if(this.canBombard(u,job.cell)){u.moveLeft=0;u.facing=Math.atan2(job.cell.x-u.x,u.y-job.cell.y);this.animation={...job,route:[],shots:SALVO.missiles,shotClock:0,fired:0,launcherPhase:'raising'};return;}
  }else if(job.type==='repair'&&!AIR(target)&&target?.owner===u.owner&&DIST(u,target)<=1){const heal=Math.min(24,target.maxHp-target.hp);target.hp+=heal;this.event('text',target,{text:'+'+Math.round(heal),color:'#a4e7bb'});valid=true;
  }else if(job.type==='altitude'&&AIR(u)){valid=this.advanceAltitude(u,job.altitude,0);
  }else if(job.type==='service'&&this.serviceSite(u,target)){const heal=Math.min(24,u.maxHp-u.hp);u.hp+=heal;if(u.type==='antiAirVehicle')u.smokeCharges=Math.min(2,u.smokeCharges+1);else u.flares=Math.min(3,u.flares+1);this.event('text',u,{text:'+'+Math.round(heal)+' HP · manutenção',color:'#a4e7bb'});valid=true;
  }else if(job.type==='capture'&&(target?.type==='post'||AIRPORT(target))&&target.owner!==u.owner&&DIST(u,target)<=1){this.captureStructure(target,u);valid=true;
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
  if(!u.segment){
   if(!a.route.length){this.resolveAction(a,u);return;}
   const goal=a.goal||a.route.at(-1),next=a.route.shift(),cost=this.stepCost(u,TILE(u),next);
   if(AIR(u)&&(this.occupied(next.x,next.y,u)||this.crossingFlight(u,TILE(u),next))){a.route.unshift(next);a.navWait=(a.navWait||0)-dt;if(a.navWait<=0){const route=this.findPath(u,goal,true);if(route)a.route=this.trimPath(u,route);a.navWait=.4;}u.path=a.route.slice();return;}
   if(this.occupied(next.x,next.y,u)||cost>u.moveLeft+1e-8){a.route=[];u.path=[];this.resolveAction(a,u);return;}
   u.segment={from:TILE(u),to:next,cost};u.path=a.route.slice();
  }
  const seg=u.segment,dx=seg.to.x-u.x,dy=seg.to.y-u.y,d=Math.hypot(dx,dy),step=5*dt;if(d>0)u.facing=Math.atan2(dx,-dy);
  if(d<=step){u.x=seg.to.x;u.y=seg.to.y;u.moveLeft=Math.max(0,u.moveLeft-seg.cost);u.moved=true;if(u.type==='artillery')u.actionLeft=false;u.segment=null;this.enterCell(u);this.updateVision();}
  else{u.x+=dx/d*step;u.y+=dy/d*step;}
 }
 income(owner){return Math.round(this.producers(owner).reduce((n,s)=>n+(s.type==='hq'?15:s.type==='post'?8:0),0)*(owner==='red'?PLAN[this.difficulty].income:1)*NATION_DOCTRINES[this.doctrines[owner]||'balanced'].income);}
 spawnCells(owner,type,base=this.hq(owner)){const cells=[];if(!this.canRecruit(owner,type,base))return cells;if(AIRPORT(base)){const slot=this.airportSlot(base);return slot?[slot]:[];}for(let r=1;r<=2;r++)for(let y=base.y-r;y<base.y+(base.height||1)+r;y++)for(let x=base.x-r;x<base.x+(base.width||1)+r;x++)if(INSIDE(x,y)&&DIST(base,{x,y})===r&&Number.isFinite(this.cost({type},x,y))&&(TYPES[type].air||!this.structureAt(x,y)&&!this.mines.some(m=>m.x===x&&m.y===y)))cells.push({x,y});return cells;}

 trainDuration(type){return TYPES[type].train*(this.mode==='rts'?10:1);}
 productionBatches(base){const batches=[],groups=new Map();for(const job of base?.queue||[]){const key=job.batch??job;if(!groups.has(key)){const batch=[];groups.set(key,batch);batches.push(batch);}groups.get(key).push(job);}return batches;}
 productionWait(base,type){let wait=0;for(const batch of this.productionBatches(base)){const job=batch[0],remaining=Math.max(0,this.trainDuration(job.type)-job.progress);wait+=remaining;if(job.type===type&&remaining>1e-8)return wait;}return wait+this.trainDuration(type);}
 enqueue(owner,type,base=this.hq(owner)){
  const t=TYPES[type],price=this.recruitCost(type,base);if(this.winner||this.mode!=='rts'&&(owner!==this.turn||this.busy)||!this.canRecruit(owner,type,base)||base.queue.length>=this.queueLimit(base)||this.credits[owner]<price)return false;
  const job=base.queue.find(q=>q.type===type&&q.progress+1e-8<this.trainDuration(type));if(job&&job.batch==null)job.batch=this.nextBatchId++;
  this.credits[owner]-=price;base.queue.push({type,progress:job?.progress||0,batch:job?.batch??this.nextBatchId++});const text=`${t.name} em treinamento (${this.trainDuration(type)} ${this.mode==='rts'?'s':'turno(s)'}).`;if(this.multiplayer)this.log(text,[owner]);else this.report(text,base);return true;
 }
 production(owner,elapsed=1){
  for(const base of this.producers(owner)){const batches=this.productionBatches(base),batch=batches[0];if(!batch)continue;const job=batch[0],t=TYPES[job.type],duration=this.trainDuration(job.type),progress=job.progress+elapsed>=duration-1e-8?duration:job.progress+elapsed;for(const entry of batch)entry.progress=progress;if(progress+1e-8<duration)continue;
   // Keep a partially deployed batch ahead of later types when its exits are blocked.
   base.queue=batches.flat();
   for(const entry of batch){const cell=this.spawnCells(owner,entry.type,base).find(p=>!this.occupied(p.x,p.y,null,!!t.air));if(!cell)break;const ready=this.add(owner,entry.type,cell.x,cell.y);if(PLANE(ready)){ready.flightState='grounded';ready.airportId=base.id;}base.queue.splice(base.queue.indexOf(entry),1);const text=`${t.name} pronto para receber ordens.`;if(this.multiplayer)this.log(text,[owner]);else this.report(text,base);this.event('ready',base);}
  }
 }
 beginTurn(owner){
  this.turn=owner;if(owner==='blue')this.round++;
  for(const u of this.units){u.suppressed=Math.max(0,u.suppressed-1);u.revealed=Math.max(0,u.revealed-1);}
  for(const u of this.units)if(u.owner===owner){u.moveLeft=TYPES[u.type].move;u.actionLeft=true;u.moved=false;u.pending=false;u.path=[];u.segment=null;if(!PLANE(u)&&!u.airportSiteId)u.order=u.captureIntent?{type:'capture',targetId:u.captureIntent.targetId}:{type:'stop'};if(PLANE(u)){if(u.flightJob?.type!=='return')u.flightJob=null;u.pending=false;if(u.pursuitIntent)u.order={type:'pursuit',targetId:u.pursuitIntent.targetId};}if(TYPES[u.type].air)u.flareUsed=false;}
  for(const u of this.units)if(PLANE(u)&&u.owner!==owner){u.airReactionUsed=false;u.airReaction=null;}
  for(const a of this.units)if(a.type==='antiAirVehicle'&&a.owner!==owner){a.reactionReady=true;a.smokeUsed=false;a.smokeTime=0;}this.advanceFires(0,owner);this.progressPlaneService(owner,1);this.progressAirports(owner,1);
   if(this.round>1){this.credits[owner]+=this.income(owner);this.production(owner);}this.updateVision();
  this.log(this.multiplayer?`Rodada ${this.round}: turno da equipe ${SIDE[owner]}.`:owner==='blue'?`Rodada ${this.round}: seu turno.`:`Rodada ${this.round}: turno da IA.`,['blue','red']);
  if(owner==='red'&&!this.multiplayer){this.planAI();this.aiQueue=this.aiEnabled?this.units.filter(u=>u.owner==='red').map(u=>u.id):[];this.claims=new Set();this.aiWait=.3;this.aiBuy();}
 }
 endTurn(owner='blue'){if(this.mode==='rts'||this.winner||!['blue','red'].includes(owner)||this.turn!==owner||this.busy)return false;for(const u of this.units)if(u.owner===owner&&!u.moved&&u.actionLeft&&!AIR(u))u.entrenched=true;this.completeTurn(owner);return true;}
 aiAirportPlan(){
  const owner='red',hq=this.commandBase(owner);if(!hq||this.airports(owner).length)return false;
  const site=this.structures.find(s=>s.owner===owner&&s.type==='airportSite'),workers=this.units.filter(u=>u.owner===owner&&u.type==='engineer'&&u.hp>0&&(this.mode==='rts'||u.actionLeft));
  if(site){if(workers.length>=2)this.assignAirportWorkers(site,workers.map(u=>u.id));if(this.mode==='turns')for(const u of workers)if(u.actionLeft&&!u.pending&&DIST(u,site)>1)this.moveToward(u,site,1,Infinity,true);return true;}
  const neutral=this.structures.filter(s=>AIRPORT(s)&&s.owner==='neutral'&&this.isVisible(owner,s)).sort((a,b)=>DIST(a,hq)-DIST(b,hq))[0],inf=this.units.filter(u=>u.owner===owner&&u.type==='infantry'&&!u.pending).sort((a,b)=>DIST(a,neutral||hq)-DIST(b,neutral||hq))[0];
  if(neutral&&inf&&this.pathToRange(inf,neutral,1)!==null){this.order(inf,'capture',{targetId:neutral.id});return true;}
  if(workers.length<2||this.credits[owner]<400)return false;
  if(!this.airportSearch){const cells=[];for(let y=0;y<ROWS-1;y++)for(let x=2;x<COLS-7;x++)cells.push({x,y});cells.sort((a,b)=>DIST(a,hq)-DIST(b,hq)||a.y-b.y||a.x-b.x);this.airportSearch={cells,index:0};}
  let checked=0,scanned=0;while(checked<4&&scanned++<256){const search=this.airportSearch,p=this.airportTarget||search.cells[search.index++%search.cells.length];if(!this.airportBuildSite(p)){this.airportTarget=null;continue;}checked++;
   if(this.mode==='rts'){if(this.buildAirport(workers.map(u=>u.id),p)){this.airportTarget=null;return true;}continue;}
   const nearby=workers.filter(u=>DIST(u,{...p,width:6,height:2})<=1);if(nearby.length>=2){this.airportTarget=null;return this.buildAirport(nearby.map(u=>u.id),p);}
   let moved=false;for(const u of workers)if(u.actionLeft&&!u.pending)moved=this.moveToward(u,{...p,width:6,height:2},1,Infinity,true)||moved;if(moved){this.airportTarget=p;return true;}this.airportTarget=null;
  }return false;
 }
 aiPlaneAct(u,foes){
  if(u.flightState==='service'||this.mode==='turns'&&!u.actionLeft)return;
  const withdraw=AIR(u)&&(!Object.values(u.ammo).some(n=>n>0)||u.hp/u.maxHp<.4||u.flares===0);if(u.pending&&!(withdraw&&u.pursuitIntent))return;u.weaponMode='auto';
  if(!AIR(u)){const missing=Object.entries(TYPES[u.type].ammo).some(([w,q])=>u.ammo[w]<q);if(u.hp<u.maxHp||u.flares<TYPES[u.type].flares||missing){this.servicePlane(u);return;}this.order(u,'takeoff');return;}
  const threat=foes.filter(e=>e.type==='antiAirVehicle'&&e.radarOn&&DIST(u,e)<=15).sort((a,b)=>DIST(a,u)-DIST(b,u))[0];
  if(withdraw){if(this.order(u,'return'))return;this.order(u,'patrol',this.plan.rally||u);return;}
  if(u.ammo.cruiseMissile>0&&u.cooldown<=1e-8){for(const p of this.bombardTargets(u))if(!this.all().some(v=>v.owner===u.owner&&!AIR(v)&&Math.abs(NEAREST(v,p).x-p.x)<=1.5&&Math.abs(NEAREST(v,p).y-p.y)<=1.5)&&this.order(u,'strikeCell',{x:p.x,y:p.y,weapon:'cruiseMissile'}))return;}
  if(BOMB_TYPES.some(w=>u.ammo[w]>0)){for(const p of this.bombardTargets(u)){const start={x:Math.max(0,p.x-2),y:p.y},end={x:Math.min(COLS-1,p.x+2),y:p.y};if(this.bombLine(u.owner,start,end)&&!this.all().some(v=>v.owner===u.owner&&!AIR(v)&&DIST(v,p)<3)&&this.order(u,'bombRun',{start,end}))return;}}
  const targets=[...foes,...this.all().filter(e=>e.owner==='blue'&&e.type==='antiAirVehicle'&&e.radarOn&&DIST(u,e)<=this.weaponRange(u,'antiRadiation'))];
  const target=targets.filter(e=>this.weapon(u,e)&&this.canIdentify(u,e)).sort((a,b)=>Number(b.type==='antiAirVehicle'&&b.radarOn)-Number(a.type==='antiAirVehicle'&&a.radarOn)||DIST(a,u)-DIST(b,u))[0];
  if(target&&this.order(u,'attack',{targetId:target.id,salvo:u.ammo[this.weapon(u,target)]>=2&&target.hp>this.attackPower(u,this.weapon(u,target))?2:1}))return;
  if(threat){const p={x:Math.max(4,Math.min(COLS-5,u.x+(u.x-threat.x)*2)),y:Math.max(4,Math.min(ROWS-5,u.y+(u.y-threat.y)*2))};this.order(u,'patrol',p);return;}
  this.order(u,'patrol',this.plan.objective||this.plan.rally||{x:COLS/2,y:ROWS/2});
 }
 aiBuy(){
  if(!this.aiEnabled)return;const hq=this.commandBase('red'),cfg=PLAN[this.difficulty],bases=this.producers('red'),queue=bases.flatMap(s=>s.queue);if(!hq||queue.length>=cfg.queue)return;
  const army=this.units.filter(u=>u.owner==='red');if(army.length+queue.length>=cfg.army)return;
  const count=type=>army.filter(u=>u.type===type).length+queue.filter(q=>q.type===type).length;
  const rally=this.plan.rally||hq;
  const buy=type=>{const base=bases.filter(s=>this.canRecruit('red',type,s)&&this.credits.red>=this.recruitCost(type,s)&&s.queue.length<this.queueLimit(s)&&this.spawnCells('red',type,s).some(p=>!this.occupied(p.x,p.y,null,!!TYPES[type].air))).sort((a,b)=>this.productionWait(a,type)-this.productionWait(b,type)||this.recruitCost(type,a)-this.recruitCost(type,b)||DIST(a,rally)-DIST(b,rally)||a.id-b.id)[0];return base?this.enqueue('red',type,base):false;};
  // Só o que a IA vê conta: aeronaves, blindados e tropas a pé azuis ajustam a doutrina; ameaça perto do QG libera compra imediata.
  const seen=this.all().filter(e=>e.owner==='blue'&&e.hp>0&&this.isVisible('red',e));
  const skies=Math.min(3,seen.filter(AIR).length),armor=Math.min(4,seen.filter(e=>TYPES[e.type].vehicle&&!AIR(e)).length),foot=Math.min(6,seen.filter(e=>!TYPES[e.type].vehicle&&!TYPES[e.type].structure&&!AIR(e)).length);
  const threatened=seen.some(e=>!TYPES[e.type].structure&&DIST(e,hq)<=6);
  if(!threatened&&!(skies&&!count('antiAirVehicle'))&&!this.airports('red').length){const queued=count('engineer');if(queued<2&&this.credits.red>=465){buy('engineer');return;}if(queued>=2&&this.credits.red<400)return;}
  const planes=army.filter(PLANE).length+queue.filter(q=>TYPES[q.type].plane).length;if(this.airports('red').length&&planes<cfg.planes&&!threatened){const types=['fighterRed','multiroleRed','stealthFighterRed','bomberRed'],type=types[planes%4];if(buy(type))return;}
  // Drone: um para reconhecimento; artilharia de mísseis quando já conhece estrutura azul (dano ×2).
  const boost={antiAirVehicle:1.5*skies,missileInfantry:1.5*skies,helicopterAir:skies,antitank:.75*armor,helicopterGround:1.5*armor,heavyTank:.5*armor,machinegun:.4*foot,
   reconDrone:count('reconDrone')?0:.5,stealthDrone:!count('stealthDrone')&&(this.mode==='rts'?this.time/30:this.round)>=3?.4:0,rocketArtillery:[...this.memory.red.values()].some(s=>s.owner==='blue')?.5:0};
  const norm=DOCTRINE.reduce((a,d)=>a+d.share,0),size=Math.max(8,army.length+queue.length),clock=this.mode==='rts'?this.time/30:this.round;
  const ranked=DOCTRINE.map((d,i)=>({type:d.type,i,share:d.share,score:Math.max(d.min||0,SCHEDULE[d.type]&&clock>=SCHEDULE[d.type]?1:0,Math.round(d.share/norm*size))-count(d.type)+(boost[d.type]||0)})).sort((x,y)=>y.score-x.score||x.i-y.i);
  // Poupa pelo tipo de maior déficit até poder pagá-lo: o caro entra quando junta o dinheiro, e não é trocado pelas baratas.
  const top=ranked[0];
  if(this.credits.red>=TYPES[top.type].cost){buy(top.type);return;}
  // Sem nenhum lançador de mísseis, compra o barato enquanto poupa pelo veículo antiaéreo; com um deles, espera.
  if(top.type==='antiAirVehicle'&&!count('missileInfantry')&&this.credits.red>=TYPES.missileInfantry.cost){buy('missileInfantry');return;}
  // Poupa para a classe escolhida; só gasta com o que tem para defender a base.
  // Defesa aérea em espera não é trocada por um lançador barato.
  if(threatened&&!['antiAirVehicle','missileInfantry'].includes(top.type)){const pick=ranked.find(r=>DEFENSE.includes(r.type)&&TYPES[r.type].cost<=this.credits.red);if(pick)buy(pick.type);}
 }
 moveToward(u,target,near=1,leg=Infinity,batch=false){const route=this.pathToRange(u,target,near);if(!route?.length)return false;const part=this.trimPath(u,route).slice(0,leg);return part.length?this.order(u,'move',part[part.length-1],batch):false;}
 // Valor de combate: custo (100 sem custo) pela fração de vida. Combatentes da onda: tropas com arma, sem comandante, engenheiro e batedor.
 power(u){return TYPES[u.type].structure?0:(TYPES[u.type].cost||100)*u.hp/u.maxHp;}
 fighter(u){const t=TYPES[u.type];return u.owner==='red'&&!t.structure&&t.damage>0&&!['commander','engineer','recon','stealthDrone'].includes(u.type);}
 presumedHQ(hq){return{x:COLS-(hq.width||1)-hq.x,y:ROWS-(hq.height||1)-hq.y,width:hq.width,height:hq.height};} // Espelha o retângulo completo da base.
 // Ponto de encontro: casa alcançável por tanque mais próxima de 30% do caminho entre o QG vermelho e o QG azul presumido.
 rallyPoint(hq){
  const far=this.presumedHQ(hq),aim={x:Math.round(hq.x+(far.x-hq.x)*.3),y:Math.round(hq.y+(far.y-hq.y)*.3)},start=this.spawnCells('red','tank',hq)[0]||hq;
  const seen=this.reachable({type:'tank',owner:'red',x:start.x,y:start.y},Array(SIZE).fill(null),this.structureGrid());let best=null;
  for(let k=0;k<SIZE;k++)if(seen[k]){const c={x:k%COLS,y:(k-k%COLS)/COLS};if(!best||DIST(c,aim)<DIST(best,aim))best=c;}return best||aim;
 }
 // Objetivo: estrutura azul conhecida menos defendida pelo que a IA viu (raio 4); sem nenhuma, o QG presumido.
 objective(hq){
  const guard=s=>[...this.intel.values()].filter(e=>DIST(e,s)<=4).reduce((a,e)=>a+this.power(e),0),rally=this.plan.rally||hq;
  const best=[...this.memory.red.values()].filter(s=>s.owner==='blue').sort((a,b)=>guard(a)-guard(b)||DIST(a,rally)-DIST(b,rally))[0];
  return best?{id:best.id,x:best.x,y:best.y}:this.presumedHQ(hq);
 }
 /* Plano da IA: prepara (postos, reconhecimento, reunião no ponto de encontro) até vencer o prazo e o grupo reunido (≥ 6) superar
    a força azul vista × margem; ataca em onda; com metade da força perdida, reagrupa e volta a se preparar. */
 planAI(){
  const hq=this.commandBase('red');if(!this.aiEnabled||!hq)return;if(this.mode==='rts')this.aiAirportPlan();const p=this.plan,cfg=PLAN[this.difficulty],now=this.mode==='rts'?this.time:this.round,prep=this.mode==='rts'?cfg.prep*30:cfg.prep;
  p.rally||=this.rallyPoint(hq);const fighters=this.units.filter(u=>this.fighter(u)),sum=list=>list.reduce((a,u)=>a+this.power(u),0),home=u=>DIST(u,p.rally)<=4;
  if(p.phase==='attack'){
   const alive=p.wave.map(id=>this.get(id)).filter(u=>u?.hp>0);
   if(!alive.length||sum(alive)<p.waveStart*.5){p.phase='regroup';p.wave=[];p.objective=null;p.since=now;}
   else{if(cfg.reinforce)for(const u of fighters)if(!p.wave.includes(u.id)&&home(u))p.wave.push(u.id);const t=p.objective?.id&&this.get(p.objective.id);if(!p.objective||p.objective.id&&(!t||t.owner!=='blue')||!p.objective.id&&[...this.memory.red.values()].some(s=>s.owner==='blue'))p.objective=this.objective(hq);}
  }
  if(p.phase==='regroup'&&(fighters.filter(home).length>=fighters.length*.7||now-p.since>=prep*cfg.followUp)){p.phase='prepare';p.since=now;}
  if(p.phase==='prepare'&&now-p.since>=prep){
   const gathered=fighters.filter(home);
   if(gathered.length>=cfg.wave&&sum(gathered)>=sum([...this.intel.values()])*cfg.margin){p.phase='attack';p.wave=gathered.map(u=>u.id);p.waveStart=sum(gathered);p.objective=this.objective(hq);}
  }
 }
 // Segurar posição: por turnos encerra a tropa (trincheira); no RTS ela fica parada com fogo automático.
 hold(u){if(this.mode!=='rts'&&u.owner===this.turn&&!u.pending)this.order(u,'stop');}
 // Batedor: patrulha centro do mapa → 2/3 do caminho até o QG presumido → centro; ferido, volta ao ponto de encontro.
 scout(u,hq){
  if(u.hp/u.maxHp<.6)return this.moveToward(u,this.plan.rally,2);
  const far=this.presumedHQ(hq),legs=[{x:COLS>>1,y:ROWS>>1},{x:Math.round(hq.x+(far.x-hq.x)*2/3),y:Math.round(hq.y+(far.y-hq.y)*2/3)}];
  u.scoutLeg??=0;if(DIST(u,legs[u.scoutLeg%2])<=2)u.scoutLeg++;return this.moveToward(u,legs[u.scoutLeg%2],2);
 }
 // Drone da IA: com artilharia de mísseis, observa 8 casas à frente dela rumo ao objetivo; sem ela, patrulha como o batedor.
 // Drone furtivo da IA: com mísseis, ataca o que estiver ao alcance (prefere antiaéreas e lançadores) ou caça o mais próximo
 // desses que já viu; ferido ou sem mísseis, patrulha como o batedor.
 stealthAct(u,hq,foes){
  if(u.missiles>0&&u.hp/u.maxHp>=.5){
   const target=this.acquire(u);if(target&&this.order(u,'attack',{targetId:target.id}))return true;
   const prey=foes.filter(e=>this.weapon(u,e)&&!TYPES[e.type].structure).sort((a,b)=>Number(['antiAirVehicle','missileInfantry'].includes(b.type))-Number(['antiAirVehicle','missileInfantry'].includes(a.type))||DIST(a,u)-DIST(b,u))[0];
   if(prey&&DIST(prey,u)<=10&&this.moveToward(u,prey,TYPES[u.type].range))return true;
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
  const known=[...[...this.intel.values()].filter(e=>!AIR(e)).map(e=>({x:e.x,y:e.y,value:this.power(e)})),...[...this.memory[u.owner].values()].filter(s=>s.owner!==u.owner&&s.owner!=='neutral').map(s=>({x:s.x,y:s.y,value:2*(s.type==='hq'?300:120)}))];
  const near=(a,b)=>Math.abs(a.x-b.x)<=1&&Math.abs(a.y-b.y)<=1,own=this.all().filter(v=>v.owner===u.owner&&v.hp>0&&!AIR(v));
  return known.filter(c=>!own.some(v=>near(TILE(v),c))).map(c=>({x:c.x,y:c.y,score:known.filter(k=>near(k,c)).reduce((a,k)=>a+k.value*(k.x===c.x&&k.y===c.y?1:.5),0)-DIST(u,c)})).sort((a,b)=>b.score-a.score).slice(0,5);
 }
 aiAct(u){
  this.aiDecisions++;const hq=this.commandBase('red');if(!hq)return;if(u.airportSiteId)return;
  const p=this.plan,home=p.rally||(p.rally=this.rallyPoint(hq)),byDist=(a,b)=>DIST(a,u)-DIST(b,u),far=this.presumedHQ(hq);
  const army=this.units.filter(v=>v.owner==='red'),foes=this.all().filter(e=>e.owner==='blue'&&this.isVisible('red',e)),posts=this.structures.filter(s=>s.owner==='red'&&s.type==='post');
  // Ameaças: inimigos a até 6 casas do QG ou a até 3 de um posto vermelho.
  const threats=foes.filter(e=>!TYPES[e.type].structure&&(DIST(e,hq)<=6||posts.some(s=>DIST(e,s)<=3))),wave=p.phase==='attack'&&p.wave.includes(u.id);this.aiState=threats.length?'defend':p.phase;
  if(PLANE(u)){this.aiPlaneAct(u,foes);return;}
  if(u.type==='reconDrone'){if(!this.droneAct(u,hq))this.hold(u);return;}
  if(u.type==='stealthDrone'){if(!this.stealthAct(u,hq,foes))this.hold(u);return;}
  if(u.type==='rocketArtillery'&&(this.mode==='rts'?u.cooldown<=0:u.actionLeft))for(const c of this.bombardTargets(u))if(this.order(u,'bombard',c))return;
  if(AIR(u)){
   if(u.hp/u.maxHp<=.5||u.flares===0){
    if(u.altitude==='high'&&this.order(u,'altitude',{altitude:'low'}))return;
    const bases=this.structures.filter(b=>b.owner===u.owner&&b.hp>0).map(b=>({b,route:this.pathToRange(u,b,1)})).filter(v=>v.route!==null).sort((a,b)=>this.pathCost(u,a.route)-this.pathCost(u,b.route));
    for(const {b,route}of bases){if(this.order(u,'service',{targetId:b.id}))return;if(route.length&&this.moveToward(u,b))return;}return;
   }
   const missileTarget=foes.find(e=>MISSILE(this.weapon(u,e))&&DIST(u,e)<=this.range(u,e,'high')+.05),danger=foes.some(e=>MISSILE(this.weapon(e,u))&&DIST(e,u)<=this.range(e,u));
   const altitude=TYPES[u.type].weapons.length>1&&missileTarget&&!danger?'high':'low';if(u.altitude!==altitude&&this.order(u,'altitude',{altitude}))return;
  }
  if(!AIR(u)&&u.hp/u.maxHp<(TYPES[u.type].cost>=150?.4:.35)){const medic=army.filter(e=>e.type==='engineer'&&e!==u).sort(byDist)[0]||hq;if(this.moveToward(u,medic))return;}
  if(u.type==='engineer'){
   if(this.mode==='turns'&&!this.airports('red').length&&this.aiAirportPlan())return;
   const allies=this.all().filter(e=>e.owner==='red'&&e!==u&&!AIR(e)&&e.hp<e.maxHp&&DIST(e,u)<=6).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp);for(const ally of allies)if(this.order(u,'repair',{targetId:ally.id}))return;
   const mine=this.mines.find(m=>m.known.red&&DIST(m,u)<=u.moveLeft+1);if(mine&&this.order(u,'demine',mine))return;
  }
  const firing=this.acquire(u);if(firing&&this.order(u,'attack',{targetId:firing.id}))return;
  // Defesa: fora da onda todos respondem; na onda, só ameaças a até 6 casas.
  for(const e of threats.filter(e=>(!wave||DIST(e,u)<=6)&&this.weapon(u,e)).sort(byDist))if(this.order(u,'attack',{targetId:e.id})||this.moveToward(u,e))return;
  if(wave){
   for(const e of foes.filter(e=>DIST(e,u)<=6).sort(byDist))if(this.order(u,'attack',{targetId:e.id}))return;
   const goal=p.objective,target=goal.id&&this.get(goal.id);
   if(this.canCapture(u,target)&&target?.type==='post'&&target.owner!=='red'&&this.order(u,'capture',{targetId:target.id}))return;
   // Coesão: quem está mais de 3 casas à frente da mediana da onda espera; os demais avançam em pernas de até 4 casas.
   const d=p.wave.map(id=>this.get(id)).filter(Boolean).map(v=>DIST(v,goal)).sort((a,b)=>a-b);
   if(DIST(u,goal)<d[d.length>>1]-3||!this.moveToward(u,goal,2,4))this.hold(u);return;
  }
  if(u.type==='recon'&&this.scout(u,hq))return;
  if(POST_CAPTURERS.has(u.type)&&!threats.length){
   // Expansão segura: só postos claramente do lado vermelho (6 casas mais perto do QG vermelho que do azul presumido).
   const targets=[...this.memory.red.values()].filter(s=>s.type==='post'&&s.owner!=='red'&&!this.claims.has(s.id)&&DIST(s,hq)+2<=DIST(s,far)).sort(byDist);
   for(const s of targets){if(this.order(u,'capture',{targetId:s.id,position:s})){this.claims.add(s.id);return;}}
  }
  if(u.type==='engineer'&&p.phase==='attack'){const w=p.wave.map(id=>this.get(id)).filter(Boolean);if(w.length){const c={x:Math.round(w.reduce((a,v)=>a+v.x,0)/w.length),y:Math.round(w.reduce((a,v)=>a+v.y,0)/w.length)};if(this.moveToward(u,c,2,4))return;}}
  // Ponto de encontro: protege a área num raio de 4 e segura posição a até 3 casas.
  for(const e of foes.filter(e=>DIST(e,home)<=4).sort(byDist))if(this.order(u,'attack',{targetId:e.id}))return;
  if(DIST(u,home)>3&&this.moveToward(u,home,3))return;
  this.hold(u);
 }
 finishRTS(u){
  this.cancelAltitude(u);this.cancelWork(u);u.job=null;u.path=[];u.pending=!!u.segment||u.launcherLevel>0;u.idle=0;u.order={type:'stop'};
 }
 routeRTS(u){
  const job=u.job,target=job.type==='capture'?this.captureTarget(u):this.get(job.targetId);let route;
  if(job.type==='move')route=this.findPath(u,job.goal,true);
  else if(job.type==='build')route=[];
  else if(job.type==='bombard')route=this.pathToRange(u,job.cell,TYPES[u.type].range,TYPES[u.type].min);
  else route=target||job.goal?this.pathToRange(u,target||job.goal,job.type==='attack'?this.range(u,target):1,job.type==='attack'?TYPES[u.type].min:0):null;
  job.route=route||[];u.path=job.route.slice();u.navWait=.4;
 }
 stepRTS(u,dt){
  if(dt<=1e-8||u.hp<=0||PLANE(u))return;
  u.navWait=Math.max(0,(u.navWait||0)-dt);
  // A nova ordem começa na próxima casa; o segmento em curso continua reservado.
  if(u.segment){
   const seg=u.segment,dx=seg.to.x-u.x,dy=seg.to.y-u.y,d=Math.hypot(dx,dy),speed=TYPES[u.type].speed/(AIR(u)?1:seg.cost),step=speed*dt;
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
   const enemy=u.cooldown<=0&&!TYPES[u.type].stealth?this.acquire(u):null;
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
   u.hp=Math.min(u.maxHp,u.hp+24*dt);u.serviceClock=(u.serviceClock||0)+dt;
   if(u.serviceClock+1e-8>=3){u.serviceClock=Math.max(0,u.serviceClock-3);u.flares=Math.min(3,u.flares+1);}
   if(u.hp>=u.maxHp&&u.flares===3)this.finishRTS(u);return;
  }
  if(['attack','repair'].includes(job.type)){
   // Sem arma compatível (ex.: drone furtivo sem mísseis), o ataque termina em vez de perseguir o alvo.
   const valid=target&&target.hp>0&&(job.type==='repair'?!AIR(target)&&target.owner===u.owner&&target.hp<target.maxHp:target.owner!==u.owner&&this.isVisible(u.owner,target)&&(job.type!=='attack'||!!this.weapon(u,target)));
   if(!valid){this.finishRTS(u);return;}
  }
  if(job.type==='demine'&&!this.mines.some(m=>m.x===job.goal.x&&m.y===job.goal.y)){this.finishRTS(u);return;}
  // Salva no RTS: parada, espera a recarga e lança os quatro mísseis; nova ordem interrompe os que faltam.
  if(job.type==='bombard'&&this.canBombard(u,job.cell)){
   job.route=[];u.path=[];if(job.left===undefined){if(u.cooldown>0)return;u.facing=Math.atan2(job.cell.x-u.x,u.y-job.cell.y);if(!this.advanceLauncher(u,true,dt))return;job.left=SALVO.missiles;job.clock=0;}
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
    const heal=Math.min(24,target.maxHp-target.hp);target.hp+=heal;this.event('text',target,{text:'+'+heal,color:'#a4e7bb'});if(target.hp>=target.maxHp)this.finishRTS(u);
   }else this.resolveAction(job,u);return;
  }
  if(job.type==='move'&&DIST(u,job.goal)===0){this.finishRTS(u);return;}
  if(!job.route.length&&u.navWait<=0)this.routeRTS(u);
  const next=job.route[0];if(!next)return;
  if(this.occupied(next.x,next.y,u)||this.crossingFlight(u,TILE(u),next)){
   if(u.navWait<=0)this.routeRTS(u);return;
  }
  const cost=this.stepCost(u,TILE(u),next);if(!Number.isFinite(cost)){this.finishRTS(u);return;}
  job.route.shift();u.path=job.route.slice();u.segment={from:TILE(u),to:next,cost};u.work=0;u.idle=0;u.entrenched=false;this.stepRTS(u,dt);
 }
 updateRTS(dt){
  this.visionClock-=dt;if(this.visionClock<=0){this.updateVision();this.visionClock=.1;}
  this.economyClock+=dt;
  if(this.economyClock+1e-8>=10){this.economyClock=Math.max(0,this.economyClock-10);for(const owner of ['blue','red'])this.credits[owner]+=this.income(owner);}
  for(const owner of ['blue','red'])this.production(owner,dt);
  this.aiClock-=dt;
  if(this.aiEnabled&&this.aiClock<=0){
   this.aiClock=.6;this.claims=new Set(this.units.filter(u=>u.owner==='red'&&u.order.type==='capture').map(u=>u.order.targetId));this.planAI();this.aiBuy();
   // Ataques aéreos contínuos também precisam reavaliar recuo, manutenção e ameaças visíveis.
   const waiting=new Set(this.aiQueue);this.aiQueue=[...waiting,...this.units.filter(u=>u.owner==='red'&&!waiting.has(u.id)).map(u=>u.id)];
  }
  if(this.aiEnabled)for(let n=0;n<8&&this.aiQueue.length;){const u=this.get(this.aiQueue.shift());if(u?.hp>0&&u.owner==='red'&&(!u.pending&&!u.segment||AIR(u)&&['attack','strike'].includes(u.order.type))){this.aiAct(u);n++;}}
  for(const u of [...this.units])if(u.hp>0)this.stepRTS(u,dt);
  this.flushVision();
 }
  checkVictory(){
  const alive=owner=>this.structures.some(s=>s.owner===owner&&s.hp>0&&(s.type==='hq'||s.type==='post')),blue=alive('blue'),red=alive('red');
  if(!blue||!red){this.winner=!blue&&!red?'draw':blue?'blue':'red';this.log(this.winner==='draw'?'As duas forças foram neutralizadas.':`Vitória da Nação ${this.nationLabel(this.winner)}.`,['blue','red']);}
 }

 update(dt){
  if(this.winner||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);this.time+=dt;for(const u of this.units){u.cooldown=Math.max(0,u.cooldown-dt);if(u.cooldown<1e-8)u.cooldown=0;u.gunCooldown=Math.max(0,(u.gunCooldown||0)-dt);this.advanceGunBurst(u,dt);if(u.altitudeTransition?.returning){u.altitudeTransition.elapsed+=dt;if(u.altitudeTransition.elapsed>=.2)u.altitudeTransition=null;}if(this.mode==='rts'){u.suppressed=Math.max(0,u.suppressed-dt);u.revealed=Math.max(0,u.revealed-dt);if(AIR(u))u.flareCooldown=Math.max(0,u.flareCooldown-dt);if(u.type==='antiAirVehicle'){u.smokeCooldown=Math.max(0,u.smokeCooldown-dt);u.smokeTime=Math.max(0,u.smokeTime-dt);}}}
  this.defendPlanes(dt);
  if(this.projectiles.some(p=>p.weapon==='antiAirVehicle'&&!p.interceptor&&!p.lostGuidance))this.touchVision();
  let planeAdvanced=false;if(this.mode==='rts'){for(const u of [...this.units])if(PLANE(u)&&(AIR(u)||u.runway))this.stepPlane(u,dt);for(const owner of ['blue','red']){this.progressPlaneService(owner,dt);this.progressAirports(owner,dt);}this.advanceFires(dt);this.flushVision();this.defendAir();}else if(this.animation?.plane){this.animate(dt);planeAdvanced=true;}
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
   if(p.elapsed+1e-8>=p.duration)hits.push(p);
  }this.advanceInterceptors(dt,starts,hits);this.projectiles=this.projectiles.filter(p=>!hits.includes(p));for(const p of hits)this.impact(p);
  if(this.mode==='rts'){this.updateRTS(dt);this.checkVictory();return;}
  if(this.animation&&!planeAdvanced)this.animate(dt);else if(!planeAdvanced&&!this.animation&&!this.projectiles.length&&this.actions.length){this.animation=this.actions.shift();this.animate(dt);}
  if(this.turnEnding&&!this.busy){const next=this.turnEnding;this.turnEnding=null;this.beginTurn(next);}if(!this.multiplayer&&this.turn==='red'&&!this.busy&&!this.turnEnding){this.aiWait-=dt;if(this.aiWait<=0){const u=this.get(this.aiQueue.shift());if(u){this.aiAct(u);this.aiWait=.15;}else if(!this.aiQueue.length)this.completeTurn('red');}}
  this.checkVictory();
 }
}
