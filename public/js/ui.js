'use strict';
class Sound{
 constructor(){this.enabled=true;this.ctx=null;this.buffers=new Map();this.last={};}
 unlock(){
  if(!this.enabled)return;
  try{if(!this.ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;this.ctx=new Audio();this.master=this.ctx.createGain();this.master.gain.value=.14;this.master.connect(this.ctx.destination);}if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}catch{this.enabled=false;}
 }
 tone(freq,length=.12,type='sine',offset=0,end=freq){
  if(!this.enabled||!this.ctx)return;const t=this.ctx.currentTime+offset,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
  osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+length);gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(.5,t+.01);gain.gain.exponentialRampToValueAtTime(.001,t+length);osc.connect(gain);gain.connect(this.master);osc.start(t);osc.stop(t+length+.02);
 }
 noise(length=.2,frequency=900){
  if(!this.enabled||!this.ctx)return;let buffer=this.buffers.get(length);
  if(!buffer){const n=Math.floor(this.ctx.sampleRate*length),data=(buffer=this.ctx.createBuffer(1,n,this.ctx.sampleRate)).getChannelData(0);for(let i=0;i<n;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/n,2);this.buffers.set(length,buffer);}
  const source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=frequency;source.connect(filter);filter.connect(this.master);source.start();
 }
 play(kind){
  if(!this.enabled)return;this.unlock();
  const now=performance.now();if(now-(this.last[kind]??-1e9)<40)return;this.last[kind]=now; // disparos simultâneos viram um só som
  if(kind==='click')this.tone(600,.045,'sine',0,400);
  else if(kind==='purchase'){this.tone(440,.12);this.tone(660,.16,'sine',.12);}
  else if(kind==='tank'){this.noise(.35,600);this.tone(120,.3,'triangle',0,30);}
  else if(kind==='artillery'||kind==='blast'){this.noise(.55,900);this.tone(90,.5,'sine',0,22);}
  else if(kind==='infantry'){this.noise(.1,2400);this.tone(180,.07,'square',0,70);}
  else if(kind==='ui-hover')this.tone(1500,.025,'sine',0,1700);
  else if(kind==='ui-select'){this.tone(520,.05,'square',0,640);this.tone(780,.06,'sine',.045,820);}
  else if(kind==='ui-confirm'){this.tone(392,.09,'triangle');this.tone(587,.14,'triangle',.08);}
  else if(kind==='ui-open')this.tone(180,.18,'sawtooth',0,420);
  else if(kind==='victory')[392,494,587,784].forEach((n,i)=>this.tone(n,.3,'triangle',i*.17));
  else if(kind==='defeat')[330,294,220,165].forEach((n,i)=>this.tone(n,.4,'triangle',i*.2));
 }
}

const $=id=>document.getElementById(id),CELL=56,TEAM={blue:'#77c8e2',red:'#ee9986',green:'#a8dc6a',neutral:'#e0c992'};
const RECRUIT_TYPES=['infantry','recon','engineer','artillery','lightTank','tank','heavyTank','antitank','machinegun','helicopter','helicopterGround','helicopterAir','antiAirVehicle','missileInfantry','rocketArtillery','reconDrone','stealthDrone','fighterBlue','multiroleBlue'];
const UNIT_CATEGORY={infantry:'infantaria',engineer:'infantaria',antitank:'infantaria',machinegun:'infantaria',missileInfantry:'infantaria',commander:'infantaria',recon:'veiculos',lightTank:'veiculos',tank:'veiculos',heavyTank:'veiculos',antiAirVehicle:'veiculos',artillery:'artilharia',rocketArtillery:'artilharia',helicopter:'aereo',helicopterGround:'aereo',helicopterAir:'aereo',reconDrone:'aereo',stealthDrone:'aereo',fighterBlue:'aereo',multiroleBlue:'aereo',fighterRed:'aereo',multiroleRed:'aereo',bomberRed:'aereo',bomberBlue:'aereo',stealthFighterBlue:'aereo',stealthFighterRed:'aereo'};
const CATEGORY_NAME={infantaria:'Infantaria',veiculos:'Veículos',artilharia:'Artilharia',aereo:'Aéreo'};
RECRUIT_TYPES.push('transportTruck','transportHelicopter','transportPlane');Object.assign(UNIT_CATEGORY,{transportTruck:'veiculos',transportHelicopter:'aereo',transportPlane:'aereo',fighterFr:'aereo',multiroleFr:'aereo',bomberFr:'aereo',stealthFighterFr:'aereo'});
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)'),audio=new Sound();let reducedMotion=motionPreference.matches;
let game=new Game(),selection=new Set(),groups=Array.from({length:5},()=>[]),paused=true,started=false,speed=1,mode=null,hover=null,drag=null,marker=null,resultShown=false,addMode=false,panTool=false,pointer=null,pan=null;
let bombLineStart=null;
let lastFrame=performance.now(),uiClock=0,lastLog=null;
/* Configurações do jogador, salvas neste navegador (com try/catch: sem armazenamento, valem só na sessão). */
const SETTINGS_KEY='wargrid.settings.v1',SETTING_DEFAULTS={army:'own',sound:true,grid:false,speed:1,fullscreen:true,difficulty:'normal',mode:'turns',graphics:'balanced',nation:NATION_DEFAULTS,doctrine:'balanced',startingArmy:STARTING_DEFAULT},ARMY_NOTICE='A formação salva passou de 600 pontos com o limite atual e foi substituída pela sugerida (565 pontos).';
let settings={...SETTING_DEFAULTS};try{Object.assign(settings,JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'));}catch{}
// Seletores: army = suas unidades (own verdes, enemy vermelhas, franca azuis); enemyArmy = unidades da IA (auto, blue, red, franca).
const ARMY_FACTION={own:'blue',enemy:'red',franca:FRANCE};
function playerFaction(){return ARMY_FACTION[settings.army]||'blue';}
function enemyFaction(){return ['blue','red',FRANCE].includes(settings.enemyArmy)?settings.enemyArmy:playerFaction()==='red'?'blue':'red';}
function playerFactions(){return {blue:playerFaction(),red:enemyFaction()};}
if(!Object.hasOwn(GRAPHICS,settings.graphics))settings.graphics='balanced';
settings.army=Object.hasOwn(ARMY_FACTION,settings.army)?settings.army:'own';settings.enemyArmy=['blue','red',FRANCE].includes(settings.enemyArmy)?settings.enemyArmy:'auto';if(armyOverBudget(settings.startingArmy,playerFaction()))settings.armyRestored=true;settings.nation=cleanNation(settings.nation);settings.doctrine=cleanDoctrine(settings.doctrine);settings.startingArmy=cleanStartingArmy(settings.startingArmy,playerFaction());
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}if(typeof touchProfile==='function')touchProfile('settings');}
function changeSetting(key,value){settings[key]=value;saveSettings();}
let showGrid=settings.grid===true;speed=[.25,.5,1,2].includes(settings.speed)?settings.speed:1;
let logOpen=false,detailsOpen=false,radarCollapsed=null;try{logOpen=localStorage.getItem('wargrid.log.v1')==='true';}catch{}
const renderer=new Renderer();
motionPreference.addEventListener('change',e=>{reducedMotion=e.matches;renderer.ambientParticles=[];renderer.dirty=true;});
function selectedUnits(){return [...selection].map(id=>game.get(id)).filter(u=>u&&u.owner===localPlayerSide()&&!UT(u).structure);}
function selectedProducer(){return [...selection].map(id=>game.get(id)).find(u=>game.producer(localPlayerSide(),u));}
function battleUnitName(type,owner=localPlayerSide()){return game.multiplayer&&owner===localPlayerSide()&&TYPES[type].team==='red'?TYPES[type].name.replace(/inimigo$/,'vermelho'):TYPES[type].name;}
function drawBattleIdentity(){
 const side=localPlayerSide(),n=settings.nation,online=!!game.multiplayer,canvas=$('nationHeaderFlag'),key=online?side+':'+(Multiplayer.session?.nickname||'Jogador')+':'+TEAM[side]:JSON.stringify(n);
 if(canvas.dataset.identity===key)return;canvas.dataset.identity=key;
 if(online){setText('nationHeaderName',(Multiplayer.session?.nickname||'Jogador')+' · '+SIDE_NAME[side]);$('nationHeaderName').style.color=TEAM[side];const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.fillStyle=TEAM[side];c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#edf2e7';c.fillRect(0,canvas.height/3,canvas.width,canvas.height/3);canvas.setAttribute('aria-label','Bandeira da equipe '+SIDE_TEAM[side]);}
 else{setText('nationHeaderName',n.name);$('nationHeaderName').style.removeProperty('color');drawNationFlag('nationHeaderFlag',n);}
}
// Capacidade permanente; créditos, ação, munição e posição são disponibilidade.
function supportsOrder(u,type){
 const t=UT(u);
 switch(type){
  case 'embark':case 'disembark':return !!t.capacity;
  case 'repair':case 'demine':case 'buildAirport':case 'assignAirport':return u.type==='engineer';
  case 'build':return u.type==='infantry';
  case 'service':return u.type==='antiAirVehicle'||atMax(u)||u.type==='heavyTank'||t.air&&!t.plane&&!t.drone;
  case 'altitude':return t.air&&!t.plane&&!t.drone;
  case 'weapons':return !t.plane&&t.weapons?.length>1;
  case 'bombard':return BARRAGE(u);
  case 'airdropLine':return !!t.airdropPlane;
  case 'planeBomb':case 'bombRun':return t.plane&&BOMB_TYPES.some(w=>t.weapons.includes(w));
  case 'strikeCell':return t.plane&&t.weapons.some(w=>w==='jetAgm'||w==='jetGun'||w==='cruiseMissile');
  case 'takeoff':case 'return':case 'planeService':return t.plane;
  case 'attack':case 'attackMove':return !t.unarmed&&(!t.plane||t.weapons.some(w=>!BOMB_TYPES.includes(w)));
  case 'move':return true;
  case 'capture':return POST_CAPTURERS.has(u.type);
  default:return type==='stop';
 }
}
function orderAvailable(u,type){
 if(u.runway||!supportsOrder(u,type))return false;
 const rts=game.mode==='rts';
 if(type==='move')return PLANE(u)||UT(u).drone?u.flightState!=='service'&&(rts||u.actionLeft):rts||u.moveLeft>0&&(u.type!=='artillery'||u.actionLeft||u.moved);
 if(!rts&&!u.actionLeft)return false;
 if(type==='attack'||type==='attackMove')return UT(u).stealth?u.missiles>0:PLANE(u)?AIR(u)&&UT(u).weapons.some(w=>!BOMB_TYPES.includes(w)&&u.ammo[w]>0):true;
 return true;
}
function orderUnits(type){return selectedUnits().filter(u=>supportsOrder(u,type));}
const MODE_BUTTON={move:'move',attack:'attackMove',attackMove:'attackMove',repair:'repair',demine:'demine',service:'service',bombard:'bombard',planeBomb:'planeBomb',buildAirport:'buildAirport',assignAirport:'assignAirport'};
let productionBaseId=null,productionCollapsed=false;
function updateProduction(base){
 if(base?.id!==productionBaseId){productionBaseId=base?.id;productionCollapsed=false;}
 const open=!!base&&!productionCollapsed;
 setProp('productionPanel','hidden',!open);setProp('productionToggle','hidden',!base);setAttr('productionToggle','aria-expanded',String(open));
 document.querySelector('.map-stage').classList.toggle('production-open',open);
 if(base)setText('productionName',UT(base).name);setText('productionCredits',game.credits[localPlayerSide()]+' créditos'+(game.multiplayer?' · tropas '+game.armySize(localPlayerSide())+'/'+UNIT_CAP:''));
 const tutorial=$('tutorial'),home=document.querySelector('.map-frame'),slot=$('productionTutorialSlot');
 if(tutorial){const parent=open?slot:home;if(tutorial.parentElement!==parent)parent.append(tutorial);}
 const available=Object.values(recruitGroups).filter(g=>{const shown=[...g.querySelectorAll('[data-recruit]')].some(b=>!b.hidden);setProp(g,'hidden',!shown);return shown;});
 if(base&&available.length&&!available.some(g=>g.open)&&!available.some(g=>g.dataset.chosen))available[0].open=true;
}
function menusClosed(){return !document.querySelector('dialog[open]');}
function canCommand(){return (!game.multiplayer||Multiplayer.canAct())&&started&&!game.winner&&(game.mode==='rts'||game.turn===localPlayerSide()&&!game.busy)&&menusClosed();}
function playable(){return started&&!game.winner&&!paused&&(game.multiplayer||menusClosed());}
function say(text){$('hint').textContent=text;}
function timeLabel(value){return game.mode==='rts'?Math.floor(value/60).toString().padStart(2,'0')+':'+Math.floor(value%60).toString().padStart(2,'0'):'Rodada '+value;}
function entitiesAt(p){const visible=u=>u.owner===localPlayerSide()||game.isVisible(localPlayerSide(),u)||selectedUnits().some(p=>PLANE(p)&&AIR(p)&&game.canIdentify(p,u)),near=game.units.filter(u=>{const pose=flightPose(u);return visible(u)&&(Math.hypot(u.x-p.x,u.y-p.y)<.55||AIR(u)&&Math.hypot(pose.x-p.x,pose.y-p.y)<.55*pose.scale);});return [...near.filter(AIR),...near.filter(u=>!AIR(u)),...game.structures.filter(u=>visible(u)&&DIST(u,p)<.6)];}
function entityAt(p){return entitiesAt(p)[0];}
function weaponLabel(w,u){return w==='auto'?'Auto':(u?game.weaponStats(u,w):WEAPONS[w]).name;}
function weaponInfo(u,w){const s=game.weaponStats(u,w);return s.name+' '+game.weaponRange(u,w)+' casas'+(w==='jetAam'?' (dano base '+s.damage+')':'')+', '+(w==='jetGun'?'dano 10,5 em voo / 6 no solo; rajada de até 4 tiros a cada 0,12 s, 2 s entre rajadas':(PLANE(u)?'0,6':String(s.cooldown).replace('.',','))+' s')+(w==='gun'?' · '+Math.round(s.accuracy*100)+'% · dano '+Math.round(s.damage*s.infantryMultiplier)+' infantaria / '+Math.round(s.damage*s.vehicleMultiplier)+' veículos / '+Math.round(s.damage*s.structureMultiplier)+' estruturas / '+s.damage+' helicópteros e drones / sem dano contra aviões'+(game.mode==='turns'?' · '+s.shots+' tiro(s) por ação':''):'');}
function setSelection(ids,add=false){if(!add)selection.clear();bombLineStart=null;for(const id of ids)if(game.get(id))selection.add(id);mode=null;updateUI();if(ids.length&&typeof tutorialEvent==='function')tutorialEvent('select');}
function planePhase(u){return u.flightJob?.type==='egress'&&u.flightJob.combat?'Separação':{patrol:'Patrulha',approach:'Aproximação',attack:'Investida',egress:'Saída',grounded:'Pousado',service:'Manutenção',offmap:'Fora do mapa',waitRunway:'Aguardando pista',taxiOut:'Taxiando para decolar',takeoffRoll:'Decolagem',climb:'Subida',landing:'Descida para pouso',landingRoll:'Frenagem na pista',taxiIn:'Taxiando para estacionar'}[u.flightState]||u.flightState;}
function orderName(u){if(u.runway)return planePhase(u);if(PLANE(u)&&AIR(u)){if(u.pending&&['approach','attack','egress'].includes(u.flightState))return planePhase(u)+(u.pursuitIntent?' · perseguição':'');if(u.pursuitIntent)return 'Perseguição pendente · '+(game.mode==='turns'&&u.actionLeft?'nova investida ao encerrar o turno':'próximo turno');}if(u.captureIntent)return game.captureStatus(u)+(game.mode==='turns'&&!u.pending?' \u00b7 pr\u00f3ximo turno':'');return u.pending?{move:'Em deslocamento',attack:'Atacando',repair:'Reparando',service:'Em manutenção',altitude:(u.order.altitude==='high'?'SUBINDO':'DESCENDO')+' ('+Math.max(0,ALTITUDE_TIME-(u.altitudeTransition?.returning?0:u.altitudeTransition?.elapsed||0)).toFixed(1)+' s)',capture:'Capturando',build:'Construindo',demine:'Desarmando',bombard:'Bombardeando área'}[u.order.type]||'Executando ordem':u.entrenched?'Entrincheirada':game.mode==='rts'?(UT(u).stealth?'Pronta · ataca só por ordem':'Pronta · fogo automático'):u.actionLeft?'Ação disponível':'Ação usada';}
function flightStatus(u){if(UT(u).airdropPlane){const phases={inbound:'a caminho do aeroporto',parked:'parado na pista',run:'em rota de lançamento',return:'voltando à pista',exit:'saindo do mapa'};return '\n'+(AIR(u)?'Altitude alta':'No solo')+' · sem armas · Vagas '+game.cargoSlots(u)+'/'+game.airCap(u.owner)+' · '+(phases[u.airdrop?.phase]||'em voo')+' · visão '+game.sight(u)+' · flares '+u.flares;}if(UT(u).capacity&&AIR(u))return '\nAltitude '+(u.altitude==='high'?'alta':'baixa')+' · sem armas · Flares: '+u.flares+'/3 · Visão: '+game.sight(u);if(u.contactOnly)return '\nContato de '+(u.contactOnly==='radar'?'radar':'emissor')+' · integridade e armamento desconhecidos';if(PLANE(u))return '\nAltitude: ALTA · '+planePhase(u)+(UT(u).radarStealth?' · furtivo ao radar':'')+' · visão '+game.sight(u)+' · esquiva '+Math.round(game.planeEvasion(u)*100)+'%\nContramedidas: '+u.flares+'/'+UT(u).flares+' · '+Object.entries(u.ammo||{}).map(([w,n])=>weaponLabel(w)+': '+n+(w==='jetGun'?' tiros':'')).join(' · ');if(UT(u).unarmed)return '\nAltitude: ALTA (permanente) · sem armas nem flares';if(UT(u).stealth){const found=Object.entries(u.spotted||{}).some(([s,v])=>v&&s!==u.owner);return `\nAltitude: ALTA (permanente) · sem flares · ${found?'Descoberto: visível ao inimigo':'Furtivo: invisível ao radar'}\nMísseis: ${u.missiles}/${UT(u).missiles} · alcance ${UT(u).range} casas${u.missiles?(game.mode==='rts'?' · '+(u.cooldown>0?'recarga '+u.cooldown.toFixed(1).replace('.',',')+' s':'pronto'):''):' · só reconhecimento'}`;}return `\nAltitude: ${u.altitude==='high'?'ALTA':'Baixa'} · Flares: ${u.flares}/3 · ${game.flareReady(u)?'prontos':u.flares===0?'sem estoque':game.mode==='rts'?'recarga '+u.flareCooldown.toFixed(1).replace('.',',')+' s':'recarga até o próximo turno próprio'}\nVisão: ${game.sight(u)} casas${u.altitude==='high'?' · cobertura terrestre: 1 casa (floresta, sebe, colina e montanha)':''}`;}
/* Escritas no DOM só quando o valor muda: evita recálculo de estilo e layout a cada atualização do painel. */
function setText(id,value){const e=$(id);value=String(value);if(e.textContent!==value)e.textContent=value;}
function setProp(id,key,value){const e=typeof id==='string'?$(id):id;if(e[key]!==value)e[key]=value;}
function setAttr(id,key,value){const e=$(id);if(e.getAttribute(key)!==value)e.setAttribute(key,value);}
function setWidth(id,ratio){const e=$(id),value=Math.round(Math.max(0,Math.min(1,ratio))*1000)/10+'%';if(e.style.width!==value)e.style.width=value;}
const airdropDraft={baseId:null,destination:null};let airdropIconColor=null,airdropPipKey='';
const airdropInputs=[],airdropCards=[];
const AIRDROP_PRESETS=[['12 infantaria',{infantry:12}],['2 tanques médios',{tank:2}],['Tanque leve + 8 tropas',{lightTank:1,infantry:8}],['Limpar',{}]];
function setAirdropCargo(cargo){for(const input of airdropInputs)input.value=String(cargo[input.dataset.cargoType]||0);updateAirdropForm();}
for(const [label,cargo]of AIRDROP_PRESETS){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>setAirdropCargo(cargo));$('airdropPresets').append(b);}
for(const type of AIRDROP_TYPES){
 const t=TYPES[type],slots=AIRDROP_SLOTS(type),card=document.createElement('div'),icon=document.createElement('canvas'),name=document.createElement('strong'),info=document.createElement('small'),row=document.createElement('div'),input=document.createElement('input');
 card.className='airdrop-card';icon.width=icon.height=64;icon.setAttribute('aria-hidden','true');icon.dataset.icon=type;name.textContent=t.name;info.textContent=t.cost+' créditos · '+slots+(slots>1?' vagas':' vaga');row.className='airdrop-stepper';
 input.type='number';input.min='0';input.max=String(Math.floor(AIRDROP_CAPACITY/slots));input.step='1';input.value=type==='infantry'?'4':'0';input.required=true;input.dataset.cargoType=type;input.setAttribute('aria-label','Quantidade de '+t.name);input.addEventListener('input',updateAirdropForm);
 const buttons=[[-1,'−'],[1,'+']].map(([direction,text])=>{const b=document.createElement('button');b.type='button';b.className='stepper';b.textContent=text;b.setAttribute('aria-label',(direction<0?'Remover ':'Adicionar ')+t.name);b.addEventListener('click',()=>{direction<0?input.stepDown():input.stepUp();input.dispatchEvent(new Event('input',{bubbles:true}));});return b;});
 row.append(buttons[0],input,buttons[1]);card.append(icon,name,info,row);$('airdropCargo').append(card);airdropInputs.push(input);airdropCards.push({type,card,minus:buttons[0],plus:buttons[1]});
}
function airdropCargo(){return Object.fromEntries(airdropInputs.map(i=>[i.dataset.cargoType,Number(i.value)]));}
function drawAirdropIcons(){const color=TEAM[localPlayerSide()];if(color===airdropIconColor)return;airdropIconColor=color;
 for(const canvas of [...$('airdropCargo').querySelectorAll('canvas'),...$('transportQuick').querySelectorAll('canvas')]){const c=canvas.getContext('2d');c.clearRect(0,0,64,64);unitIcon(c,canvas.dataset.icon,32,36,color,1.05,0,0,false,0,false,sideArt(localPlayerSide()));}
 const plane=$('airdropPlaneIcon').getContext('2d');plane.clearRect(0,0,72,72);unitIcon(plane,'transportPlane',36,40,color,.9,0,0,false,0,false,sideArt(localPlayerSide()));}
function updateAirdropForm(){
 drawAirdropIcons();
 const side=localPlayerSide(),faction=game.factionOf(side),cap=game.airCap(side),plane=game.airdropPlane(side),free=cap-game.cargoSlots(plane),cargo=airdropCargo(),quote=game.airdropQuote(cargo,free,side),credits=game.credits[side];
 let used=0,cost=0;for(const [type,count]of Object.entries(cargo)){if(!Number.isFinite(count)||count<0)continue;used+=count*AIRDROP_SLOTS(type);cost+=count*SPEC(type,faction).cost;}
 const total=used?cost+AIRDROP_FEE:0,pips=[];for(let i=0;i<cap-free;i++)pips.push('aboard');
 for(const type of AIRDROP_TYPES)for(let i=0;i<(cargo[type]>0?cargo[type]:0);i++)for(let k=0;k<AIRDROP_SLOTS(type);k++)pips.push(type==='tank'?'heavy':TYPES[type].vehicle?'veh':'foot');
 const key=pips.slice(0,cap).join(',')+'|'+used+'|'+cap;
 if(key!==airdropPipKey){airdropPipKey=key;$('airdropPips').replaceChildren(...Array.from({length:cap},(_,i)=>{const s=document.createElement('i');if(pips[i])s.className=pips[i];return s;}));$('airdropPips').classList.toggle('over',used>free);}
 for(const {type,card,minus,plus}of airdropCards){const n=cargo[type]||0,price=SPEC(type,faction).cost;card.classList.toggle('active',n>0);setProp(card.querySelector('small'),'textContent',price+' créditos · '+AIRDROP_SLOTS(type)+(AIRDROP_SLOTS(type)>1?' vagas':' vaga'));setProp(minus,'disabled',n<=0);setProp(plus,'disabled',used+AIRDROP_SLOTS(type)>free||credits<(used?total:AIRDROP_FEE)+price);}
 setText('airdropTotal',quote?`${quote.slots}/${free} vagas · Total: ${quote.cost} créditos · Disponíveis: ${credits}`:used>free?`Carga acima de ${free} vagas livres: remova unidades.`:'Adicione tropas ou veículos à carga.');
 const valid=game.canAirdrop(side,airdropDraft.baseId,cargo),step=quote?2:1;setProp('airdropConfirm','disabled',!valid);
 for(const li of $('airdropDialog').querySelectorAll('.airdrop-steps li')){const n=Number(li.dataset.step);li.classList.toggle('done',n<step);if(n===step)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');}
 setText('airdropError',quote&&!valid?(plane&&plane.airdrop?.phase!=='parked'?'O avião de transporte está em missão: aguarde o pouso.':game.atUnitCap(side,quote.types.length)?'Limite de '+UNIT_CAP+' tropas por jogador: não há vagas para esta carga.':'Compra indisponível: confira créditos, aeroporto e vaga na pista.'):'');
}
const transportQuick=[];let transportPipKey='';
for(const type of AIRDROP_TYPES){const b=document.createElement('button'),icon=document.createElement('canvas'),name=document.createElement('span'),info=document.createElement('small');b.type='button';b.dataset.boardType=type;icon.width=icon.height=64;icon.setAttribute('aria-hidden','true');icon.dataset.icon=type;name.textContent=TYPES[type].name;b.append(icon,name,info);
 b.addEventListener('click',()=>{if(!canCommand())return;const base=selectedProducer();if(base&&game.boardPurchase(localPlayerSide(),base.id,type)){audio.play('purchase');say(TYPES[type].name+' comprada e embarcada no avião.');}else say(game.atUnitCap(localPlayerSide())?'Limite de '+UNIT_CAP+' tropas por jogador atingido.':'Compra indisponível: o avião precisa estar parado neste aeroporto, com vaga e créditos.');updateUI();});
 $('transportQuick').append(b);transportQuick.push({type,b,info});}
function updateTransportCard(base){
 const can=canCommand(),air=!!base&&AIRPORT(base);setProp('transportCard','hidden',!air);if(!air)return;
 const side=localPlayerSide(),plane=game.airdropPlane(side),phase=plane?.airdrop?.phase,here=!!plane&&plane.airportId===base.id&&phase==='parked';
 const status=!plane?'Sem avião · chame um para começar':phase==='parked'?(here?'Na pista deste aeroporto · pronto para embarque':'Parado em outro aeroporto'):({inbound:'A caminho do aeroporto',run:'Em rota de lançamento',return:'Voltando à pista',exit:'Saindo do mapa'}[phase]||'Em voo');
 setText('transportCardStatus',status);
 const src=(game.factionOf(side)===FRANCE?franceImages.transportPlane:transportImages.transportPlane[game.factionOf(side)==='red'?1:0]).src;if(src&&$('transportCardImg').getAttribute('src')!==src)$('transportCardImg').src=src;
 const kinds=[];for(const p of plane?.cargo||[])for(let k=0;k<AIRDROP_SLOTS(p.type);k++)kinds.push(p.type==='tank'?'heavy':UT(p).vehicle?'veh':'foot');
 const key=kinds.join(',')+'|'+game.airCap(side);if(key!==transportPipKey){transportPipKey=key;$('transportCardPips').replaceChildren(...Array.from({length:game.airCap(side)},(_,i)=>{const s=document.createElement('i');if(kinds[i])s.className=kinds[i];return s;}));}
 setProp('airdropOpen','disabled',!canCommand()||!!plane&&!here);
 setProp('transportSelect','disabled',!plane);setProp('transportLaunchQuick','disabled',!can||!here||!(plane.cargo||[]).length);
 drawAirdropIcons();
 for(const {type,b,info}of transportQuick){const ok=can&&game.canBoardPurchase(side,base.id,type);setProp(b,'disabled',!ok);const text=game.boardPrice(type,side)+' cr · '+AIRDROP_SLOTS(type)+(AIRDROP_SLOTS(type)>1?' vagas':' vaga');if(info.textContent!==text)info.textContent=text;}
}
$('transportSelect').addEventListener('click',()=>{const p=game.airdropPlane(localPlayerSide());if(p){setSelection([p.id]);say('Avião selecionado: use Embarcar, Desembarcar ou Lançar tropas.');}});
$('transportLaunchQuick').addEventListener('click',()=>{if(!canCommand())return;const p=game.airdropPlane(localPlayerSide());if(!p)return;setSelection([p.id]);bombLineStart=null;mode='airdropLine';say('Escolha o início da linha de lançamento; o fim fica a 4–12 casas.');updateUI();});
function updateTransportUI(units,base,can){
 const carriers=units.filter(u=>UT(u).capacity);setProp('transportControls','hidden',!carriers.length);
 setProp('embark','disabled',!can||!carriers.some(u=>game.canTransport(u)&&(UT(u).airdropPlane?game.cargoSlots(u)<game.airCap(u.owner):seatsUsed(u)<UT(u).capacity||UT(u).sling?.[KIT(u)]&&!(u.cargo||[]).some(p=>p.type===UT(u).sling[u.owner]))));
 setProp('airdropLaunch','hidden',!carriers.some(u=>UT(u).airdropPlane));setProp('airdropLaunch','disabled',!can||!carriers.some(u=>UT(u).airdropPlane&&u.airdrop?.phase==='parked'&&(u.cargo||[]).length));
 setProp('disembark','disabled',!can||!carriers.some(u=>game.canTransport(u)&&(u.cargo||[]).some(p=>game.landingCells(p.type,TILE(u),UT(u).airdropPlane?3:1).length)));
 setText('transportCargo',carriers.map(u=>`${UT(u).name}: ${UT(u).airdropPlane?game.cargoSlots(u)+'/'+game.airCap(u.owner)+' vagas':seatsUsed(u)+'/'+UT(u).capacity} · `+((u.cargo||[]).map(p=>`${UT(p).name}${FOOT(p)?'':UT(u).seats?' a bordo':' pendurado'} (${Math.ceil(p.hp)} HP)`).join(', ')||'vazio')).join(' | '));
 updateTransportCard(base);
 if($('airdropDialog').open)updateAirdropForm();
}
$('embark').addEventListener('click',()=>{if(!canCommand())return;mode='embark';say('Clique na tropa a pé junto ao transporte para embarcar (helicóptero também leva 1 tanque leve pendurado).');updateUI();});
$('disembark').addEventListener('click',()=>{if(!canCommand())return;const n=game.command(selectedUnits().filter(u=>UT(u).capacity).map(u=>u.id),'disembark',{},localPlayerSide());say(n?'Desembarque confirmado. Carga sem espaço permanece a bordo.':'Sem espaço ou transporte indisponível.');mode=null;updateUI();});
$('airdropOpen').addEventListener('click',()=>{if(!canCommand())return;airdropDraft.baseId=selectedProducer()?.id;openMenu('airdropDialog');updateAirdropForm();});
$('airdropCancel').addEventListener('click',()=>closeMenu('airdropDialog'));$('airdropDialog').addEventListener('cancel',e=>{e.preventDefault();closeMenu('airdropDialog');});
$('airdropForm').addEventListener('submit',e=>{e.preventDefault();if(!$('airdropForm').reportValidity())return;const ok=game.requestAirdrop(localPlayerSide(),airdropDraft.baseId,airdropCargo());if(ok){closeMenu('airdropDialog');audio.play('purchase');say('Reforço comprado. O avião vai pousar no aeroporto: leve tropas para perto, embarque e use Lançar tropas.');}else updateAirdropForm();updateUI();});
$('airdropLaunch').addEventListener('click',()=>{if(!canCommand())return;bombLineStart=null;mode='airdropLine';say('Escolha o início da linha de lançamento; o fim fica a 4–12 casas.');updateUI();});
function submitAirdropLine(start,end){const ids=orderUnits('airdropLine').map(u=>u.id),ok=game.command(ids,'airdropLaunch',{start,end},localPlayerSide());if(ok){mode=null;bombLineStart=null;audio.play('purchase');say('Avião decolando: as tropas serão lançadas ao longo da linha.');}else say('Linha inválida: 4–12 casas de área explorada, com o avião pousado e carregado.');updateUI();return ok;}
let portraitKey=null,recruitButtons=[];
// Tela final: carimbo, título, resumo e os números da operação (duração, abates e perdas do lado local).
function fillResult(){
 const side=localPlayerSide(),won=game.winner===side,rts=game.mode==='rts',total=o=>Object.values(o||{}).reduce((n,v)=>n+v,0),stats=game.stats?.[side];
 $('result').dataset.result=won?'win':['draw','cancelled'].includes(game.winner)?'draw':'loss';
 setText('resultKicker',game.multiplayer?'Partida multiplayer':'Relatório de operação');
 setText('resultStamp',won?'Vitória':game.winner==='cancelled'?'Cancelada':game.winner==='draw'?'Empate':'Derrota');
 $('resultTitle').textContent=won?(game.multiplayer?'Vitória da sua equipe':'Vitória da Nação '+game.nationName):game.winner==='cancelled'?'Partida cancelada':game.winner==='draw'?'Cessar-fogo':'Operação perdida';
 $('resultText').textContent=game.winner==='eliminated'?'Sua equipe foi eliminada. A partida segue entre os outros jogadores: feche este aviso para assistir ao mapa inteiro ou saia da sala.':`Operação encerrada ${rts?'aos '+timeLabel(game.time):'na rodada '+game.round}. ${won?'O comando inimigo foi neutralizado.':'Reorganize suas forças e tente uma nova operação.'}`;
 setText('resultTime',timeLabel(rts?game.time:game.round));setText('resultKills',total(stats?.kills));setText('resultLosses',total(stats?.losses));
}
function updateUI(){
 if(typeof finishCampaignResult==='function'&&game.winner&&typeof campaignBattle!=='undefined'&&campaignBattle)finishCampaignResult();
 if(typeof refreshStoryHUD==='function')refreshStoryHUD();
  drawBattleIdentity();
  setAttr('grid','aria-pressed',String(showGrid));setProp('surrender','hidden',!started||!!game.winner);setProp('menuButton','title',game.multiplayer?'Voltar ao menu inicial (a partida continua)':'Voltar ao menu inicial (a partida pausa)');
  const rts=game.mode==='rts';
  for(const id of selection){const u=game.get(id);if(!u||(u.owner!==localPlayerSide()&&!game.isVisible(localPlayerSide(),u)))selection.delete(id);}
  groups=groups.map(g=>g.filter(id=>game.get(id)?.owner===localPlayerSide()));
  setText('mapTitle',game.title||MAPS[game.map]);setText('credits',game.credits[localPlayerSide()]);setText('income','+'+game.income(localPlayerSide()));setText('incomeLabel',rts?'Renda / 10 s':'Renda / turno');setProp('income','title',rts?`+${game.income(localPlayerSide())} créditos a cada 10 segundos de jogo`:`+${game.income(localPlayerSide())} créditos no início do seu turno, a partir da rodada 2`);setText('force',game.units.filter(u=>u.owner===localPlayerSide()).length);
  setText('clock',timeLabel(rts?game.time:game.round));setText('status',game.winner==='eliminated'?'Eliminado · assistindo':game.winner?'Operação encerrada':rts?(paused?'Pausa tática':'Combate em tempo real'):game.turn!==localPlayerSide()?(game.multiplayer?game.sides.length>2?'Turno da equipe '+SIDE_TEAM[game.turn]:'Turno do adversário':'Turno da IA'):game.busy?'Executando ordem':'Seu turno');setText('pause',paused?'Continuar':'Pausar');setProp('pause','disabled',!!game.multiplayer||!started||!!game.winner);setProp('speed','disabled',!!game.multiplayer);setAttr('pause','aria-pressed',String(paused));setText('speed',String(speed).replace('.',',')+'×');setProp('pauseOverlay','hidden',!paused||!!game.winner);$('pauseOverlay').classList.toggle('tactical',rts);setText('pauseLabel',game.multiplayer?'Conexão interrompida · aguardando reconexão':rts?'Pausa tática · emita ordens · P para continuar':'Animações pausadas');
  setText('modeTitle',rts?'RTS':'Por turnos');setText('keyHint','Clique numa tropa: barra de comando · QG/posto: produção · Botão direito: ordem · Bordas, roda, botão do meio ou ✋: câmera');setAttr('addSelect','aria-pressed',String(addMode));setAttr('panTool','aria-pressed',String(panTool));renderer.canvas.classList.toggle('grab',panTool);setProp('speed','title',rts?'Velocidade do combate: 0,25×, 0,5×, 1× e 2×':'Velocidade das animações: 0,25×, 0,5×, 1× e 2×');setAttr('speed','aria-label',rts?'Alternar velocidade do combate':'Alternar velocidade das animações');setAttr('battlefield','aria-label',(rts?'Campo em tempo real.':'Campo por turnos.')+' Clique ou arraste para selecionar; botão direito emite ordens. Bordas, roda e botão do meio movem a câmera.');setText('stop',rts?'Parar':'Aguardar');
  setProp('endTurn','hidden',rts);setProp('endTurn','disabled',rts||!canCommand());$('endTurn').classList.toggle('ready',!rts&&canCommand()&&game.units.filter(u=>u.owner===localPlayerSide()).every(u=>!u.actionLeft&&!(u.moveLeft>0)));
  setText('difficultyLabel',game.multiplayer?'Multiplayer · '+SIDE_NAME[localPlayerSide()]:'IA '+{easy:'fácil',normal:'normal',hard:'difícil',veteran:'veterana'}[game.difficulty]);setText('operationInfo',`Semente ${game.seed} · ${COLS} × ${ROWS} casas · Capture postos e destrua o QG inimigo`);setText('explored',Math.round(game.explored[localPlayerSide()].filter(Boolean).length/SIZE*100)+'%');
  const units=selectedUnits(),items=[...selection].map(id=>game.get(id)).filter(Boolean),u=items[0];setText('selectionCount',items.length?items.length+' selecionada(s)':'—');
  // Produção da primeira estrutura aliada selecionada, com fila própria.
  setProp('commandBar','hidden',!items.length);setProp('modeLabel','hidden',!mode);setAttr('infoToggle','aria-expanded',String(detailsOpen));setProp('details','hidden',!detailsOpen);setProp('ordersPanel','hidden',!units.length);if(mode&&!orderUnits(mode).length){mode=null;bombLineStart=null;}
  const key=u?u.type+u.owner+KIT(u):'';if(key!==portraitKey){portraitKey=key;const portrait=$('portrait').getContext('2d');portrait.clearRect(0,0,108,108);if(u)unitIcon(portrait,u.type,54,59,TEAM[u.owner],1.55,0,0,false,0,false,unitArt(u));}
  if(game.multiplayer&&u&&u.owner!==localPlayerSide()){
   setText('unitName',u.contactOnly?'Contato de '+(u.contactOnly==='radar'?'radar':'emissor'):UT(u).name);setText('unitRole','Contato inimigo');setText('unitInfo',u.contactOnly?'Integridade e armamento desconhecidos.':Math.ceil(u.hp)+' / '+u.maxHp+' HP');setWidth('healthBar',u.contactOnly?0:u.hp/u.maxHp);
  }else if(u){
   const total=items.reduce((a,b)=>a+b.hp,0),max=items.reduce((a,b)=>a+b.maxHp,0);setWidth('healthBar',total/max);setAttr('healthBar','data-level',total/max>.5?'ok':total/max>.25?'warn':'crit');
   setText('unitName',items.length>1?`Grupo de ${items.length} tropas`:battleUnitName(u.type,u.owner));
   setText('unitRole',items.length>1?[...new Set(items.map(v=>battleUnitName(v.type,v.owner)))].join(', '):rts&&u.type==='engineer'?'Reparo +'+UT(u).repair+' HP por segundo':UT(u).role||'Estrutura de apoio');
   const tankStats=UT(u).tank?'\nDano base '+UT(u).damage+' · Precisão base '+(u.type==='tank'?'75% até '+(UT(u).falloff||3)+' casas; 65% a '+((UT(u).falloff||3)+1)+'; 55% a '+((UT(u).falloff||3)+2):Math.round(UT(u).accuracy*100)+'%')+' · Visão base '+UT(u).vision+(u.type==='lightTank'?(atMax(u)?' · Perfura tanques pesados com mísseis antitanque':' · Não perfura tanques pesados'):u.type==='heavyTank'?' · Reconhecimento aliado para tiros além da visão':''):'';
   const t=UT(u),flight=t.air&&(t.drone||t.unarmed)?flightStatus(u):t.air?flightStatus(u)+'\nArma: '+weaponLabel(u.weaponMode,u)+' · '+t.weapons.map(w=>weaponInfo(u,w)).join(' · ')+(rts?' · '+(PLANE(u)?'mísseis ':'')+(u.cooldown>0?'recarga '+u.cooldown.toFixed(1).replace('.',',')+' s':'pronto'):'')+(u.ammo?.jetGun!==undefined?' · metralhadora '+(u.gunBurst?'em rajada':u.gunCooldown>0?'recarga própria '+u.gunCooldown.toFixed(1).replace('.',',')+' s':'pronta'):''):'';
   const rangeText=u.type==='rocketArtillery'?`${t.min}–${game.range(u)} · área 3×3 · salva de ${salvoSize(u)} mísseis${rts?' · '+(u.cooldown>0?'recarga '+u.cooldown.toFixed(1).replace('.',',')+' s':'pronta'):''}`:t.unarmed?'— sem armas':u.type==='missileInfantry'?`só aeronaves · ${t.range}${t.rifle?' · fuzil '+game.weaponStats(u,'rifle').range:''}`:atMax(u)?`míssil ${game.weaponStats(u,'atMissile').range} (${u.atMissiles}/${atMax(u)}) · ${u.type==='antitank'?'fuzil '+game.weaponStats(u,'rifle').range:t.min+'–'+t.range}`:u.type!=='rocketArtillery'&&BARRAGE(u)?`rajada 3×3 · ${barrageRange(u)} · salvas ${u.salvos}/2${rts&&u.cooldown>0?' · recarga '+u.cooldown.toFixed(1).replace('.',',')+' s':''}`:u.type==='antiAirVehicle'?'0–'+t.range+' · somente aeronaves':t.min+'–'+game.range(u);
   setText('unitInfo',items.length>1?'Integridade '+Math.ceil(total)+' / '+max+' HP\n'+(rts?units.filter(v=>v.pending).length+' tropas executando ordens':units.filter(v=>v.actionLeft).length+' ações disponíveis · '+units.filter(v=>v.moveLeft>0).length+' tropas com movimento')+units.filter(AIR).map(v=>'\n'+UT(v).name+flightStatus(v)).join(''):Math.ceil(u.hp)+' / '+u.maxHp+' HP · '+(t.air?'Em voo sobre '+TERRAIN[game.terrainAt(u)].name.toLowerCase():TERRAIN[game.terrainAt(u)].name+' · '+Math.round(game.cover(u)*100)+'% defesa')+'\n'+(u.type==='airportSite'?`Obra: ${Math.max(0,game.airportDuration(u)-u.work).toFixed(rts?1:0)} / ${game.airportDuration(u)} ${rts?'s':'turnos próprios'} restantes; precisa de dois engenheiros`:t.structure?(`Treinamento em lotes · até ${game.queueLimit(u)} tropas`+(u.type==='post'?(rts?' · renda base +8 / 10 s':' · renda base +8 por turno'):'')):(rts?'Velocidade '+String(t.speed).replace('.',',')+' casas/s':'Movimento '+String(Number(u.moveLeft.toFixed(2))).replace('.',',')+' / '+t.move)+' · Alcance '+rangeText+(u.type==='heavyTank'?(UT(u).galix?' · GALIX '+u.trophy+'/'+GALIX_CHARGES+(u.smokeTime>0?' · fumaça ativa: −40% de precisão contra ele':''):' · Trophy '+u.trophy+'/'+trophyMax(u)):'')+'\n'+'★'.repeat(u.level)+' '+orderName(u)+(game.hasAura(u)?' · Aura ativa':'')+(u.suppressed>0?' · Suprimida (−25 pontos de precisão)':'')+(!t.air&&CONCEAL.has(game.terrainAt(u))&&!(u.revealed>0)?' · Oculta na '+TERRAIN[game.terrainAt(u)].name.toLowerCase():'')+flight+tankStats+(game.missileLoad(u)?'\nMísseis '+game.missileLoad(u).have+' / '+game.missileLoad(u).max:'')));
  }else{setText('unitName','Nenhuma unidade');setText('unitRole','Clique ou arraste no campo.');setText('unitInfo',rts?'Botão direito: ordem. Pausar congela o combate para dar ordens.':'Botão direito: ordem. Encerrar turno passa a vez à IA.');setWidth('healthBar',0);}
  for(const [action,id]of Object.entries({...MODE_BUTTON,build:'build'}))setProp(id,'hidden',!units.some(u=>supportsOrder(u,action)));
  const onlyPlanes=units.length>0&&units.every(v=>PLANE(v));if(onlyPlanes){setProp('move','hidden',true);setProp('attackMove','hidden',true);}
  const can=canCommand()&&units.length>0;setProp('move','disabled',!can||!units.some(u=>orderAvailable(u,'move')));setProp('attackMove','disabled',!can||!units.some(u=>orderAvailable(u,'attack')));setProp('stop','disabled',!(can&&units.some(u=>!u.runway&&(rts||u.moveLeft>0||u.actionLeft))||started&&game.turn===localPlayerSide()&&units.some(u=>!u.runway&&AIR(u)&&u.pending)));
  const noEngineer=!can||!units.some(u=>u.type==='engineer'&&(rts||u.actionLeft));setProp('repair','disabled',noEngineer);setProp('demine','disabled',noEngineer);setProp('build','disabled',!can||!units.some(u=>game.canBuild(u)));const rockets=units.filter(BARRAGE);setProp('bombard','hidden',!rockets.length);setProp('bombard','disabled',!can||!rockets.some(u=>(rts||u.actionLeft)&&!(u.salvos<=0)));
  for(const id of ['move','attackMove','repair','demine','service','bombard'])setAttr(id,'aria-pressed',String(mode===(id==='attackMove'?'attack':id)));setText('modeLabel',mode?{move:'Escolha o destino',attack:cruiseUnits().length?'Marque a área 3×3':'Escolha um inimigo',repair:'Escolha um aliado terrestre',service:'Escolha QG/posto aliado próximo',demine:'Escolha uma mina',bombard:'Escolha a casa central (3×3)',planeBomb:'Escolha o início e o fim da passagem',airdropLine:'Escolha o início e o fim da linha de lançamento',embark:'Clique na tropa que vai embarcar',buildAirport:'Escolha o terreno da pista',assignAirport:'Escolha uma obra de aeroporto'}[mode]+' · Esc cancela':'Contextual');
  const flying=units.filter(v=>AIR(v)&&!UT(v).drone&&!PLANE(v));setProp('flightControls','hidden',!flying.length);
  const radars=units.filter(v=>v.type==='antiAirVehicle'),radarEnabled=(!game.multiplayer||Multiplayer.canAct())&&started&&!game.winner&&(rts||game.turn===localPlayerSide())&&menusClosed(),radarState=radars.every(v=>v.radarOn)?'ligado':radars.some(v=>v.radarOn)?'misto':'desligado';setProp('radarControls','hidden',!radars.length);setText('radarToggle','Radar: '+radarState);setAttr('radarToggle','aria-pressed',radarState==='misto'?'mixed':String(radarState==='ligado'));setProp('radarToggle','disabled',!radarEnabled);setText('radarCount','Contatos da equipe: '+game.radarContacts[localPlayerSide()].size+' · fumaça '+radars.map(u=>u.smokeCharges+'/2').join(', '));
  for(const [id,altitude]of [['altitudeLow','low'],['altitudeHigh','high']]){setProp(id,'disabled',!can||!flying.some(v=>v.altitude!==altitude&&!(altitude==='high'&&UT(v).noHigh)&&(rts||v.actionLeft)));setAttr(id,'aria-pressed',String(!!flying.length&&flying.every(v=>v.altitude===altitude)));}
  setProp('service','disabled',!can||!units.some(v=>(rts||v.actionLeft)&&game.structures.some(b=>game.canService(v,b))));
  const armed=units.filter(v=>!PLANE(v)&&UT(v).weapons?.length>1),current=armed[0]?.weaponMode,missiles=[...new Set(armed.map(v=>UT(v).weapons[1]))];setProp('weapons','hidden',!armed.length);
  for(const b of $('weapons').children){const w=b.dataset.weapon;setProp(b,'disabled',!canCommand());setAttr(b.id,'aria-pressed',String(w==='missile'?missiles.includes(current):current===w));}setText('weaponGun',armed.length?weaponLabel('gun',armed[0]):'Canhão');setText('weaponMissile',missiles.length===1?WEAPONS[missiles[0]].name:'Míssil');
  const base=selectedProducer(),queue=base?.queue||[],batches=game.productionBatches(base),job=queue[0],batchLabel=b=>battleUnitName(b[0].type)+' ×'+b.length,limit=game.queueLimit(base);setText('queueCount',`${queue.length} / ${limit}`);updateTransportUI(units,base,can);
  const capped=game.atUnitCap(localPlayerSide());for(const button of recruitButtons){const type=button.dataset.recruit,t=SPEC(type,game.factionOf(localPlayerSide())),name=battleUnitName(type),price=game.recruitCost(type,base),duration=game.trainDuration(type)+(rts?' s':' turno(s)');setProp(button.querySelector('span'),'textContent',name);button.classList.toggle('poor',game.credits[localPlayerSide()]<price);setProp(button,'hidden',!base||!game.canRecruit(localPlayerSide(),type,base));setProp(button,'disabled',!canCommand()||!base||queue.length>=limit||game.credits[localPlayerSide()]<price||capped);setProp(button.querySelector('strong'),'textContent',price+' créditos');setProp(button.querySelector('.recruit-duration'),'textContent',duration);setProp(button,'title',`${name} · ${price} créditos · ${duration} · ${t.role}`+(price<t.cost?' · desconto de concreto: 20%':'')+(capped?' · limite de '+UNIT_CAP+' tropas atingido':''));if(button.getAttribute('aria-label')!==`Treinar ${name}, ${price} créditos, ${duration}`)button.setAttribute('aria-label',`Treinar ${name}, ${price} créditos, ${duration}`);}
  const duration=job?game.trainDuration(job.type):1;setWidth('productionBar',job?job.progress/duration:0);setText('queueStatus',!base?'Selecione QG, posto ou aeroporto aliado.':job?job.progress>=duration?`${batchLabel(batches[0])} — Saída bloqueada. Afaste as tropas da estrutura.`:`${batchLabel(batches[0])} — ${Math.ceil(duration-job.progress)} ${rts?'s':'turno(s)'} restantes`:`${UT(base).name} · linha de produção livre.`);
  setText('queue',batches.slice(1).map(batchLabel).join(' → ')+(base&&AIRPORT(base)?' · pousados '+game.docked(base).length+' / 4':''));updateAviationUI(units,base,can);updateProduction(base);
  for(let i=0;i<5;i++){$('group'+i).classList.toggle('filled',groups[i].length>0);setAttr('group'+i,'data-count',String(groups[i].length));setProp('group'+i,'title',`Grupo ${i+1}: ${groups[i].length} tropas. Clique seleciona; botão direito atribui.`);}
  if(game.logs[0]!==lastLog){lastLog=game.logs[0];$('log').replaceChildren(...game.logs.map(e=>{const div=document.createElement('div');div.className='log-line';const time=document.createElement('small');time.textContent=timeLabel(e.time);div.append(time,document.createTextNode(e.text));return div;}));setText('logLast',game.logs[0]?.text||'');}
  setAttr('logToggle','aria-expanded',String(logOpen));setProp('log','hidden',!logOpen);
  renderer.drawMini();renderer.drawRadar();
  if(game.winner&&!resultShown){resultShown=true;paused=true;audio.play(game.winner===localPlayerSide()?'victory':'defeat');fillResult();$('revealMap').hidden=game.multiplayer;$('backToWorld').hidden=game.multiplayer||!(typeof campaignBattle!=='undefined'&&campaignBattle);if(!game.multiplayer)$('resultText').textContent+=recordResult();setText('playAgain',game.multiplayer?'Revanche · trocar lados':'Nova operação');$('result').showModal();$('result').scrollTop=0;}
}
function issueAt(p,forced=mode){
 if(forced==='embark'){if(!canCommand())return;const passenger=entitiesAt(p).find(u=>u.owner===localPlayerSide()&&selectedUnits().some(c=>game.canEmbark(c,u)));const carrier=passenger&&selectedUnits().find(u=>game.canEmbark(u,passenger));const count=carrier?game.command([carrier.id],'embark',{targetId:passenger.id},localPlayerSide()):0;say(count?'Embarque confirmado.':'Embarque indisponível: aproxime a tropa do transporte parado (a até 2 casas do aeroporto, no caso do avião), com vaga livre; helicóptero em altitude baixa.');if(count)mode=null;updateUI();return;}
 if(!canCommand()){say(game.mode==='rts'?'Feche o menu para emitir ordens.':'Aguarde o seu turno e a conclusão da ordem atual.');return;}const units=selectedUnits();if(!units.length){say('Selecione suas tropas primeiro.');return;}
 const cell=TILE(p);if(!INSIDE(cell.x,cell.y))return;
 if(forced==='airdropLine'){if(!bombLineStart){bombLineStart=cell;say('Escolha o fim da linha, a 4–12 casas do início: é a faixa onde as tropas cairão.');}else submitAirdropLine(bombLineStart,cell);updateUI();return;}
 if(forced==='planeBomb'){if(!bombLineStart){bombLineStart=cell;setText('lineX1',cell.x+1);$('lineX1').value=cell.x+1;$('lineY1').value=ROWS-cell.y;say('Escolha o fim da linha, a 4–12 casas. A área pode atingir aliados.');}else{submitBombLine(bombLineStart,cell,forced);}updateUI();return;}
 if(forced==='buildAirport'){const n=game.buildAirport(units.filter(u=>u.type==='engineer').map(u=>u.id),cell);say(n?'Construção iniciada: mantenha dois engenheiros adjacentes.':'Escolha uma pista 6 × 2 com duas casas em cada ponta, sem água, estruturas ou minas; dois engenheiros e 400 créditos.');if(n)mode=null;updateUI();return;}
 if(forced==='assignAirport'){const site=game.structureAt(cell.x,cell.y);const ok=game.assignAirportWorkers(site,units.filter(u=>u.type==='engineer').map(u=>u.id));say(ok?'Engenheiros enviados à obra.':(game.mode==='turns'?'Selecione dois engenheiros adjacentes e uma obra aliada.':'Selecione dois engenheiros e uma obra aliada.'));if(ok)mode=null;updateUI();return;}
 if(forced==='bombard'){const n=game.command(units.filter(u=>supportsOrder(u,'bombard')).map(u=>u.id),'bombard',{x:cell.x,y:cell.y});if(n){marker={x:cell.x,y:cell.y,t:0,color:'#f9b09a'};audio.play('click');mode=null;}say(n?`${paused&&game.mode==='rts'?'Pausa tática: ordem preparada. P para executar. ':''}${n} unidade(s): bombardear a área ${cell.x+1}·${ROWS-cell.y}.`:'Bombardeio indisponível: a casa central precisa ficar a 3–30 casas (helicóptero de transporte: 3–10 em altitude baixa, 3–30 em alta, com salva restante) de uma posição alcançável'+(game.mode==='rts'?'.':' com o movimento restante, e a ação deve estar livre.'));updateUI();return;}
 const list=entitiesAt(p),hostile=list.filter(e=>e.owner!==localPlayerSide()&&!UT(e).structure),hurt=list.find(e=>e.owner===localPlayerSide()&&e.hp<e.maxHp&&!units.includes(e));
 const known=game.knownPostAt(localPlayerSide(),p),capture=!forced&&known&&known.owner!==localPlayerSide()&&units.some(u=>game.canCapture(u,known));
 const target=forced==='service'?list.find(e=>e.owner===localPlayerSide()&&(['hq','post'].includes(e.type)||AIRPORT(e))):hostile.find(e=>units.some(u=>game.weapon(u,e)))||hostile[0]||(capture&&known)||((forced==='repair'||!forced&&units.some(u=>u.type==='engineer'))&&hurt&&!AIR(hurt)&&hurt)||list[0];let type=forced,args={x:cell.x,y:cell.y};
 if(!type){if((target?.type==='post'||target?.missionTarget||AIRPORT(target))&&target.owner!==localPlayerSide()&&units.some(u=>game.canCapture(u,target)))type='capture';else if(target&&target.owner!==localPlayerSide())type='attack';else if(target?.owner===localPlayerSide()&&units.some(u=>u.type==='engineer')&&target.hp<target.maxHp)type='repair';else type='move';}
 // Ataque por aposta: Investida numa casa não visível, sem alvo identificado, com avião que leva arma de solo.
 const cruise=(type==='attack'||forced==='attack')&&cruiseUnits().length>0;
 if(cruise){type='strikeCell';args={x:cell.x,y:cell.y,weapon:'cruiseMissile',salvo:1};}
 else if((type==='attack'||forced==='attack')&&!target&&!game.visible[localPlayerSide()][KEY(cell.x,cell.y)]&&units.some(u=>supportsOrder(u,'strikeCell'))){type='strikeCell';args={x:cell.x,y:cell.y,weapon:['jetAgm','jetGun'].includes($('planeWeapon').value)?$('planeWeapon').value:'auto',salvo:Number($('planeSalvo').value)};}
 if(['attack','capture','repair','service'].includes(type)){if(!target){say('Escolha um alvo válido para essa ordem.');return;}args={targetId:target.id,weapon:$('planeWeapon').value,salvo:Number($('planeSalvo').value)};}
 const n=game.command((cruise?cruiseUnits():units).filter(u=>supportsOrder(u,type)&&(type!=='capture'||game.canCapture(u,target))).map(u=>u.id),type,args);
 if(n){if(typeof tutorialEvent==='function')tutorialEvent(type);marker={x:cell.x,y:cell.y,t:0,color:type==='attack'||type==='attackMove'?'#f9b09a':'#b8e5e6'};audio.play('click');say(`${paused?(game.mode==='rts'?'Pausa tática: ordem preparada. P para executar. ':'Animações pausadas: pressione P para executar. '):''}${n} unidade(s): ${cruise?'cruzeiro na área 3×3 '+(cell.x+1)+'·'+(ROWS-cell.y):{move:'mover',attackMove:'atacar-mover',attack:'atacar',strikeCell:'ataque por aposta',capture:'capturar posto',repair:'reparar',service:'manutenção',demine:'desarmar mina'}[type]}${args.targetId?' · alvo: '+UT(target).name:''}.`);mode=null;}
 else say(game.mode==='rts'?'Ordem indisponível: confira o alvo, o terreno e os créditos.':type==='move'||type==='attackMove'?'Movimento indisponível: confira os pontos restantes e o terreno.':'Ação indisponível: confira o alvo, alcance e ações restantes.');updateUI();
}
function pointerPosition(e,canvas=renderer.canvas){const r=canvas.getBoundingClientRect();if(canvas===renderer.canvas)return{x:(cam.x+(e.clientX-r.left)/cam.zoom)/CELL-.5,y:(cam.y+(e.clientY-r.top)/cam.zoom)/CELL-.5};const {s,ox,oy}=miniTransform(canvas);return{x:((e.clientX-r.left)/r.width*canvas.width-ox)/s-.5,y:((e.clientY-r.top)/r.height*canvas.height-oy)/s-.5};}
function describe(p){const cell=TILE(p);if(!INSIDE(cell.x,cell.y))return;const k=KEY(cell.x,cell.y);$('tileInfo').textContent=`Casa ${cell.x+1}·${ROWS-cell.y} ·${game.explored[localPlayerSide()][k]?TERRAIN[game.terrain[k]].name:'Não explorado'}`;}
renderer.canvas.addEventListener('contextmenu',e=>e.preventDefault());
renderer.canvas.addEventListener('pointerdown',e=>{
 if($('setup').open||$('manual').open)return;audio.unlock();renderer.canvas.focus();const p=pointerPosition(e);hover=p;
 // Com ✋ Câmera ativa, o botão esquerdo arrasta a câmera; um clique sem arrastar continua selecionando.
 if(e.button===1||e.button===0&&panTool&&!mode){e.preventDefault();pan={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,left:e.button===0};renderer.canvas.setPointerCapture(e.pointerId);return;}
 // Botão direito: arrastar move a câmera; clique sem arrastar dá a ordem na casa clicada.
 if(e.button===2){e.preventDefault();pan={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,right:true,at:p};renderer.canvas.setPointerCapture(e.pointerId);return;}if(e.button!==0)return;
 if(mode){issueAt(p);return;}drag={id:e.pointerId,start:p,end:p,active:false,shift:e.shiftKey||addMode};renderer.canvas.setPointerCapture(e.pointerId);
});
renderer.canvas.addEventListener('pointermove',e=>{const r=renderer.canvas.getBoundingClientRect();pointer={x:e.clientX-r.left,y:e.clientY-r.top,client:{clientX:e.clientX,clientY:e.clientY}};if(pan?.id===e.pointerId){cam.x-=(e.clientX-pan.x)/cam.zoom;cam.y-=(e.clientY-pan.y)/cam.zoom;pan.x=e.clientX;pan.y=e.clientY;clampCamera();renderer.drawMini();if(typeof tutorialEvent==='function')tutorialEvent('camera');}hover=pointerPosition(e);describe(hover);if(drag&&drag.id===e.pointerId){drag.end=hover;drag.active ||= Math.hypot(drag.end.x-drag.start.x,drag.end.y-drag.start.y)>.18;}});
renderer.canvas.addEventListener('pointerup',e=>{
 if(pan?.id===e.pointerId){const p=pan;pan=null;if(p.right&&Math.hypot(e.clientX-p.sx,e.clientY-p.sy)<5){issueAt(p.at);return;}if(!p.left||Math.hypot(e.clientX-p.sx,e.clientY-p.sy)>=5)return;drag={id:e.pointerId,active:false,shift:e.shiftKey||addMode};}
 if(!drag||drag.id!==e.pointerId)return;const box=drag;drag=null;if(renderer.canvas.hasPointerCapture(e.pointerId))renderer.canvas.releasePointerCapture(e.pointerId);
 if(box.active){const x1=Math.min(box.start.x,box.end.x),x2=Math.max(box.start.x,box.end.x),y1=Math.min(box.start.y,box.end.y),y2=Math.max(box.start.y,box.end.y),inside=p=>p.x>=x1&&p.x<=x2&&p.y>=y1&&p.y<=y2;setSelection(game.units.filter(u=>u.owner===localPlayerSide()&&(inside(u)||AIR(u)&&inside(flightPose(u)))).map(u=>u.id),box.shift);say(`${selectedUnits().length} tropas selecionadas.`);}
 else{const list=entitiesAt(pointerPosition(e)),at=list.findIndex(v=>selection.has(v.id)),u=list.length>1&&selection.size===1&&at>=0?list[(at+1)%list.length]:list[0];
  if(box.shift&&u?.owner===localPlayerSide()){if(selection.has(u.id))selection.delete(u.id);else selection.add(u.id);updateUI();}else setSelection(u?[u.id]:[]);
  if(u&&list.length>1)say(`${UT(u).name} selecionado (${list.indexOf(u)+1}/${list.length} nesta casa). Clique de novo para alternar.`);}
});
renderer.canvas.addEventListener('pointercancel',()=>{drag=null;pan=null;});renderer.canvas.addEventListener('pointerleave',()=>{pointer=null;if(!drag)hover=null;});window.addEventListener('blur',()=>{drag=null;pan=null;pointer=null;});
renderer.canvas.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault();});
renderer.canvas.addEventListener('wheel',e=>{e.preventDefault();const r=renderer.canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top,wx=cam.x+mx/cam.zoom,wy=cam.y+my/cam.zoom;cam.zoom*=e.deltaY<0?1.15:1/1.15;clampCamera();cam.x=wx-mx/cam.zoom;cam.y=wy-my/cam.zoom;clampCamera();renderer.drawMini();hover=pointerPosition(e);if(typeof tutorialEvent==='function')tutorialEvent('camera');},{passive:false});
new ResizeObserver(()=>{const v=renderer.canvas,dpr=devicePixelRatio||1;v.width=Math.max(1,Math.round(v.clientWidth*dpr));v.height=Math.max(1,Math.round(v.clientHeight*dpr));clampCamera();renderer.draw(0);renderer.drawMini();}).observe(renderer.canvas);
$('minimap').addEventListener('contextmenu',e=>{e.preventDefault();issueAt(pointerPosition(e,$('minimap')));});
function miniPan(e){if(e.buttons!==1||mode)return;const p=pointerPosition(e,$('minimap'));centerCamera(p.x,p.y);renderer.drawMini();if(typeof tutorialEvent==='function')tutorialEvent('camera');}
$('minimap').addEventListener('pointerdown',e=>{if(e.button!==0)return;if(mode){issueAt(pointerPosition(e,$('minimap')));return;}$('minimap').setPointerCapture(e.pointerId);miniPan(e);});$('minimap').addEventListener('pointermove',miniPan);
function setMode(next){if(!canCommand()||!orderUnits(next).length||MODE_BUTTON[next]&&$(MODE_BUTTON[next]).disabled)return;if(mode===(next==='attackMove'?'attack':next)){mode=null;updateUI();say('Ordem cancelada.');return;}mode=next==='attackMove'?'attack':next;updateUI();say(next==='service'?'Clique na instalação aliada colada na tropa: QG ou posto; o helicóptero parado em baixa altitude só é atendido no QG ou no aeroporto (posto não atende).':next==='repair'?(game.mode==='rts'?'Clique em um aliado terrestre para reparar até 24 HP por segundo.':'Clique em um aliado terrestre para reparar até 24 HP com uma ação.'):next==='demine'?'Clique em uma mina detectada.':next==='bombard'?'Clique na casa central da área 3×3, a 3–30 casas (helicóptero de transporte: 10 em altitude baixa, 30 em alta; 2 salvas); vale sob a névoa. Quatro mísseis, 80% de impacto cada.':'Clique no destino ou use o botão direito.');}
for(const id of ['move','attackMove','repair','demine','service','bombard'])$(id).addEventListener('click',()=>setMode(id));
for(const [id,altitude]of [['altitudeLow','low'],['altitudeHigh','high']])$(id).addEventListener('click',()=>{if(!canCommand())return;const n=game.command(orderUnits('altitude').map(u=>u.id),'altitude',{altitude});mode=null;updateUI();say(n?`${n} helicóptero(s): altitude ${altitude==='high'?'alta':'baixa'} em ${ALTITUDE_TIME} s ${game.mode==='rts'?'parado; S cancela.':'com uma ação.'}${paused?' Ordem preparada durante a pausa.':''}`:'Altitude indisponível.');});
function stopSelected(){if(selectedUnits().every(u=>u.runway))return;if(!canCommand()){if(started&&!game.winner&&game.turn===localPlayerSide()&&menusClosed())for(const u of selectedUnits().filter(AIR))game.order(u,'stop');updateUI();return;}game.command(selectedUnits().map(u=>u.id),'stop');mode=null;updateUI();say(game.mode==='rts'?'Ordem cancelada. As tropas param ao chegar à próxima casa.':'Tropas aguardando. Movimento e ação encerrados; trincheira ativa.');}
$('stop').addEventListener('click',stopSelected);
// Botão direito sobre a barra emite a ordem no ponto do mapa por baixo; com uma ordem escolhida, clicar fora dos botões também.
$('commandBar').addEventListener('contextmenu',e=>{e.preventDefault();issueAt(pointerPosition(e));});
$('commandBar').addEventListener('click',e=>{if(mode&&!e.target.closest('button,input,select'))issueAt(pointerPosition(e));});
$('closeSelection').addEventListener('click',()=>{setSelection([]);say('Seleção limpa.');});
$('infoToggle').addEventListener('click',()=>{detailsOpen=!detailsOpen;updateUI();});
$('hqButton').addEventListener('click',()=>{const hq=game.hq(localPlayerSide());if(!hq){say('QG destruído.');return;}const p=CENTER(hq);centerCamera(p.x,p.y);setSelection([hq.id]);renderer.drawMini();say('QG selecionado: escolha as tropas para treinar nas pastas da lateral.');});
$('logToggle').addEventListener('click',()=>{logOpen=!logOpen;try{localStorage.setItem('wargrid.log.v1',String(logOpen));}catch{}updateUI();});
// Troca de arma: não gasta nem devolve ação e não altera a recarga comum.
for(const b of $('weapons').children)b.addEventListener('click',()=>{if(!canCommand())return;const w=b.dataset.weapon,armed=orderUnits('weapons');for(const u of armed)game.setWeapon(u,w==='missile'?UT(u).weapons[1]:w);updateUI();if(armed.length)say(`Arma: ${b.textContent} (${armed.length} helicóptero(s)).`);});$('build').addEventListener('click',()=>{if(!canCommand())return;const count=game.command(orderUnits('build').map(u=>u.id),'build');say(count?`${count} posto(s) ordenado(s). A infantaria será convertida em guarnição.`:'Escolha infantaria parada, com espaço para um posto.');updateUI();});
function groupAction(i,assign){if(assign){groups[i]=selectedUnits().map(u=>u.id);if(groups[i].length&&typeof tutorialEvent==='function')tutorialEvent('group');say(`Grupo ${i+1}: ${groups[i].length} tropas atribuídas.`);}else{setSelection(groups[i].filter(id=>game.get(id)));say(`Grupo ${i+1} selecionado.`);}updateUI();}
for(let i=0;i<5;i++){const b=document.createElement('button');b.id='group'+i;b.textContent=i+1;b.addEventListener('click',e=>groupAction(i,e.ctrlKey||e.metaKey));b.addEventListener('contextmenu',e=>{e.preventDefault();groupAction(i,true);});$('groups').append(b);}
const PRODUCTION_CATEGORY={infantaria:['infantry','engineer','antitank','machinegun','missileInfantry'],tanques:['lightTank','tank','heavyTank'],apoio:['recon','antiAirVehicle','transportTruck'],artilharia:['artillery','rocketArtillery'],aeronaves:['helicopter','helicopterGround','helicopterAir','transportHelicopter','reconDrone','stealthDrone','fighterBlue','multiroleBlue','fighterRed','multiroleRed','bomberRed','bomberBlue','stealthFighterBlue','stealthFighterRed','fighterFr','multiroleFr','bomberFr','stealthFighterFr']};
const recruitGroups={};for(const [category,types]of Object.entries(PRODUCTION_CATEGORY)){const group=document.createElement('details'),summary=document.createElement('summary');group.className='production-folder';summary.textContent={infantaria:'Infantaria',tanques:'Tanques',apoio:'Apoio',artilharia:'Artilharia',aeronaves:'Aeronaves'}[category];group.append(summary);summary.addEventListener('click',()=>group.dataset.chosen='true');$('recruits').append(group);recruitGroups[category]=group;
 for(const type of types){const t=TYPES[type],b=document.createElement('button');b.className='recruit';b.dataset.recruit=type;b.innerHTML='<canvas width="60" height="60" aria-hidden="true"></canvas><span>'+t.name+'</span><strong>'+t.cost+' créditos</strong><small class="recruit-duration"></small>';unitIcon(b.querySelector('canvas').getContext('2d'),type,30,33,TEAM.blue,1);b.addEventListener('click',()=>{if(canCommand()&&game.enqueue(localPlayerSide(),type,selectedProducer())){audio.play('purchase');updateUI();if(typeof tutorialEvent==='function')tutorialEvent('recruit');}});group.append(b);recruitButtons.push(b);}}

$('productionClose').addEventListener('click',()=>{productionCollapsed=true;updateUI();$('productionToggle').focus();});
$('productionToggle').addEventListener('click',()=>{productionCollapsed=!productionCollapsed;updateUI();if(!productionCollapsed)$('productionClose').focus();});
$('productionPanel').addEventListener('pointerenter',()=>{pointer=null;hover=null;});

const WEAPON_NAME={jetAam:'Ar-ar',antiRadiation:'Antirradiação',jetAgm:'Antiblindado',jetGun:'Metralhadora',cruiseMissile:'Míssil de cruzeiro'},WEAPON_TARGET={jetAam:'aeronaves',antiRadiation:'antiaérea com radar',jetAgm:'veículos e estruturas',jetGun:'infantaria e veículos leves',cruiseMissile:'área 3×3 · fogo amigo'};
const cruiseReach=units=>Math.max(...units.map(u=>game.weaponRange(u,'cruiseMissile')));
function cruiseUnits(){const w=$('planeWeapon').value;return selectedUnits().filter(u=>PLANE(u)&&UT(u).weapons.includes('cruiseMissile')&&(w==='cruiseMissile'||w==='auto'&&AUTO_CRUISE(u)));}
// Estado de cada ação do painel do avião: visível só se faz sentido, desabilitada com motivo escrito quando falta algo.
function planeActionState(planes,can){
 const rts=game.mode==='rts',ready=u=>rts||u.actionLeft,flying=planes.filter(u=>!u.runway&&AIR(u)),grounded=planes.filter(u=>u.flightState==='grounded'),base=game.airports(localPlayerSide()).length>0;
 const st=(show,ok,reason)=>({show,disabled:!can||!ok,reason:show&&can&&!ok?reason:''}),away=planes.filter(u=>u.flightState!=='grounded'),armed=u=>UT(u).weapons.some(w=>!BOMB_TYPES.includes(w)&&u.ammo[w]>0);
 return{
  takeoff:st(grounded.length>0,grounded.some(ready),'sem ação neste turno'),
  service:st(grounded.length>0,grounded.some(u=>ready(u)&&game.airports(localPlayerSide()).some(b=>b.id===u.airportId)),'fora do aeroporto de origem'),
  patrol:st(away.length>0,planes.some(u=>orderAvailable(u,'move')),away.some(u=>u.runway||u.flightState==='service')?'em pista ou manutenção':'sem ação neste turno'),
  strike:st(away.some(u=>supportsOrder(u,'attack')),planes.some(u=>orderAvailable(u,'attack')),!away.some(armed)?'sem munição de ataque':away.some(u=>u.runway||u.flightState==='service')?'em pista ou manutenção':'sem ação neste turno'),
  bomb:st(flying.some(u=>supportsOrder(u,'planeBomb')),flying.some(u=>supportsOrder(u,'planeBomb')&&ready(u)&&BOMB_TYPES.some(w=>u.ammo[w]>0)),flying.some(u=>BOMB_TYPES.some(w=>u.ammo[w]>0))?'sem ação neste turno':'sem bombas'),
  return:st(flying.length>0,flying.some(ready)&&base,base?'sem ação neste turno':'sem aeroporto aliado')
 };
}
function updatePlanePanel(planes,can){
 if(!planes.length)return;
 const first=planes[0],hp=planes.reduce((n,u)=>n+u.hp,0),max=planes.reduce((n,u)=>n+u.maxHp,0);
 if($('planeWeapon').value!=='auto'&&!planes.some(u=>u.ammo?.[$('planeWeapon').value]>0))$('planeWeapon').value='auto';
 const current=$('planeWeapon').value||'auto';
 setText('planeTitle',planes.length===1?UT(first).name:planes.length+' aviões');setText('planePhaseLabel',planePhase(first)+(planes.length>1?' (primeiro da seleção)':''));setText('planeHp','Integridade '+Math.ceil(hp)+' / '+max);
 // Armas em botões: munição somada dos selecionados e contra o que serve.
 const rows=[{w:'auto',have:null}];for(const w of ['jetAam','antiRadiation','jetAgm','jetGun','cruiseMissile']){const owners=planes.filter(u=>UT(u).weapons.includes(w));if(owners.length)rows.push({w,have:owners.reduce((n,u)=>n+(u.ammo[w]||0),0),max:owners.reduce((n,u)=>n+(UT(u).ammo[w]||0),0)});}
 const box=$('planeWeapons'),key=JSON.stringify(rows)+current;
 if(box.dataset.signature!==key){box.dataset.signature=key;box.replaceChildren(...rows.map(r=>{const b=document.createElement('button'),name=r.w==='auto'?'Automática':WEAPON_NAME[r.w],small=document.createElement('small');b.dataset.weapon=r.w;b.setAttribute('aria-pressed',String(r.w===current));b.append(document.createTextNode(r.w==='auto'?name:`${name} ${r.have}/${r.max}`),small);small.textContent=r.w==='auto'?'a melhor para o alvo':WEAPON_TARGET[r.w]+(r.w==='cruiseMissile'?' · alcance '+cruiseReach(planes.filter(u=>UT(u).weapons.includes('cruiseMissile'))):'');if(r.have===0){b.classList.add('empty');b.disabled=true;b.title=name+': sem munição';}return b;}));}
 const missiles=['jetAam','antiRadiation','jetAgm'].some(w=>planes.some(u=>u.ammo?.[w]>0)),salvo=$('planeSalvo').value;setProp('planeSalvoButtons','hidden',!missiles||current==='jetGun'||cruiseUnits().length>0);for(const b of $('planeSalvoButtons').children)b.setAttribute('aria-pressed',String(b.dataset.salvo===salvo));
 const state=planeActionState(planes,can),ids={takeoff:'planeTakeoff',service:'planeService',patrol:'planePatrol',strike:'planeStrike',bomb:'planeBomb',return:'planeReturn'},mixed=selectedUnits().some(u=>!PLANE(u));
 for(const [name,id] of Object.entries(ids)){const a=state[name];setProp(id,'hidden',!a.show||mixed&&(name==='patrol'||name==='strike'));setProp(id,'disabled',a.disabled||!a.show);}
 setText('planeReasons',Object.entries(state).filter(([,a])=>a.reason).map(([n,a])=>({takeoff:'Decolar',service:'Manutenção',patrol:'Patrulhar',strike:'Investida',bomb:'Linha de bombas',return:'Retornar'}[n])+': '+a.reason).join(' · '));
 const bet=mode==='attack'&&planes.some(u=>supportsOrder(u,'strikeCell'));setProp('planeHint','hidden',!bet);setText('planeHint',cruiseUnits().length?'Marque a área 3×3, inclusive na névoa. Alcance '+cruiseReach(cruiseUnits())+'; um cruzeiro por ordem; pode atingir aliados. Fora do alcance, o bombardeiro se aproxima para lançar.':'Clique num inimigo, ou numa casa na névoa para atacar por aposta: se houver alvo de solo lá, o avião o atinge; se não, a munição é gasta.');
}
function updateAviationUI(units,base,can){
 const planes=units.filter(u=>PLANE(u)&&!UT(u).airdropPlane),engineers=units.filter(u=>u.type==='engineer');
 setProp('planeControls','hidden',!planes.length);setProp('airportControls','hidden',!engineers.length);
 setProp('buildAirport','disabled',!can||engineers.filter(u=>!u.airportSiteId&&(game.mode==='rts'||u.actionLeft)).length<2||game.credits[localPlayerSide()]<400);setProp('assignAirport','disabled',!can||engineers.length<2);
 updatePlanePanel(planes,can);
 updateEmitterUI(planes,can);
 setProp('bombLineControls','hidden',mode!=='planeBomb');
 const capacity=Math.min(...planes.filter(u=>BOMB_TYPES.some(w=>UT(u).ammo[w]>0)).map(u=>BOMB_TYPES.reduce((n,w)=>n+(UT(u).ammo[w]||0),0)));
 setProp('planeBombCountLabel','hidden',!Number.isFinite(capacity));for(const option of $('planeBombCount').options)option.hidden=option.disabled=Number(option.value)>capacity;if(Number($('planeBombCount').value)>capacity)$('planeBombCount').value='12';
}
function contactWeapon(target){return AIR(target)?'jetAam':'antiRadiation';}
function emitterAttackers(id){const target=game.get(id),w=target&&contactWeapon(target);return target?selectedUnits().filter(u=>PLANE(u)&&AIR(u)&&u.ammo[w]>0&&u.cooldown<=1e-8&&(game.mode==='rts'||u.actionLeft)&&game.planeWeaponFits(u,w,target)&&game.canIdentify(u,target)&&DIST(u,target)<=game.weaponRange(u,w)):[];}
function updateEmitterUI(planes,can){
 const radarPlane=planes.find(u=>UT(u).weapons.includes('antiRadiation')),reference=radarPlane||planes[0];setProp('emitterPanel','hidden',!reference);if(!reference){renderer.emitterHighlight=null;return;}
 const airContacts=planes.some(u=>UT(u).weapons.includes('jetAam'))?[...game.radarContacts[localPlayerSide()]].map(id=>game.get(id)).filter(u=>u&&u.hp>0&&AIR(u)).map(u=>({id:u.id,x:u.x,y:u.y,air:true})):[],contacts=[...(radarPlane?game.emitterContacts(localPlayerSide()):[]),...airContacts].sort((a,b)=>DIST(reference,a)-DIST(reference,b)||a.id-b.id),list=$('emitterList');setText('emitterCount',contacts.length);setProp('emitterEmpty','hidden',!!contacts.length);
 if(!contacts.some(c=>c.id===renderer.emitterHighlight))renderer.emitterHighlight=null;
 for(const row of [...list.children])if(!contacts.some(c=>String(c.id)===row.dataset.emitterId))row.remove();
 for(const contact of contacts){let row=[...list.children].find(r=>r.dataset.emitterId===String(contact.id));if(!row){row=document.createElement('div');row.className='emitter-row';row.dataset.emitterId=contact.id;const focus=document.createElement('button'),attack=document.createElement('button');focus.dataset.emitterFocus=contact.id;attack.dataset.emitterAttack=contact.id;attack.textContent='Atacar';focus.addEventListener('click',()=>{const c=[...game.emitterContacts(localPlayerSide()),...(contact.air?[game.get(contact.id)].filter(Boolean):[])].find(c=>c.id===contact.id);if(!c)return;renderer.emitterHighlight=c.id;centerCamera(c.x,c.y);renderer.drawMini();updateUI();});attack.addEventListener('click',()=>{const t=game.get(contact.id);if(!canCommand()||!t||!(contact.air?game.radarContact(localPlayerSide(),t):game.emitterContacts(localPlayerSide()).some(c=>c.id===contact.id)))return;const n=game.command(emitterAttackers(contact.id).map(u=>u.id),'attack',{targetId:contact.id,weapon:contactWeapon(t),salvo:Number($('planeSalvo').value)});if(n)mode=null;updateUI();say(n?n+' aeronave(s): investida antirradia\u00e7\u00e3o.':'Nenhuma aeronave apta.');});row.append(focus,attack);}
 const weapon=contact.air?'jetAam':'antiRadiation',distance=DIST(reference,contact),designated=reference.flightJob?.targetId===contact.id,status=designated?'Alvo designado':!AIR(reference)?'Em solo':game.mode==='turns'&&!reference.actionLeft?'Sem a\u00e7\u00e3o':!contact.air&&!contact.radarOn?'Radar desligado':!reference.ammo[weapon]?'Sem muni\u00e7\u00e3o':distance>game.weaponRange(reference,weapon)?'Fora do alcance':reference.cooldown>1e-8?'Recarregando':'Dispon\u00edvel',focus=row.children[0],attack=row.children[1],label=(contact.air?'Contato a\u00e9reo #':'Emissor #')+contact.id+' \u00b7 '+distance.toFixed(1).replace('.0','')+' casas \u00b7 '+status;
 if(focus.textContent!==label)focus.textContent=label;focus.setAttribute('aria-pressed',String(renderer.emitterHighlight===contact.id));attack.disabled=!can||!emitterAttackers(contact.id).length;attack.setAttribute('aria-label','Atacar '+(contact.air?'contato a\u00e9reo #':'emissor #')+contact.id);const index=contacts.indexOf(contact);if(list.children[index]!==row)list.insertBefore(row,list.children[index]||null);
 }
}
function planeAction(type){if(!canCommand()||$({takeoff:'planeTakeoff',return:'planeReturn',service:'planeService'}[type]).disabled)return;let n=0;for(const u of orderUnits(type==='service'?'planeService':type))if(type==='service'?game.servicePlane(u):game.order(u,type,{},true))n++;if(n)mode=null;updateUI();say(n?n+' aeronave(s): '+({takeoff:'decolagem',return:'retorno',service:'manutenção'}[type]):'Operação indisponível.');}
function submitBombLine(start,end,operation=mode){if(operation!=='planeBomb')return false;const ok=game.command(orderUnits('bombRun').map(u=>u.id),'bombRun',{start,end,bombCount:Number($('planeBombCount').value)},localPlayerSide());if(ok){mode=null;bombLineStart=null;say('Linha confirmada: bombas em área, com fogo amigo.');}else say('Linha inválida: 4–12 casas do mapa, aeronave pronta e munição disponível.');updateUI();return ok;}
$('planePatrol').addEventListener('click',()=>setMode('move'));$('planeStrike').addEventListener('click',()=>setMode('attackMove'));$('planeBomb').addEventListener('click',()=>{bombLineStart=null;setMode('planeBomb');say('Escolha início e fim da linha ou use as coordenadas. Área 3 × 3, com fogo amigo.');});
$('planeTakeoff').addEventListener('click',()=>planeAction('takeoff'));$('planeReturn').addEventListener('click',()=>planeAction('return'));$('planeService').addEventListener('click',()=>planeAction('service'));
$('planeWeapons').addEventListener('click',e=>{const b=e.target.closest('button[data-weapon]');if(!b||b.disabled)return;$('planeWeapon').value=b.dataset.weapon;$('planeWeapon').dispatchEvent(new Event('change'));});
$('planeSalvoButtons').addEventListener('click',e=>{const b=e.target.closest('button[data-salvo]');if(!b)return;$('planeSalvo').value=b.dataset.salvo;updateUI();});
$('planeWeapon').addEventListener('change',()=>{for(const u of selectedUnits().filter(u=>PLANE(u)))game.setWeapon(u,$('planeWeapon').value);if($('planeWeapon').value==='cruiseMissile'&&canCommand()&&cruiseUnits().some(u=>orderAvailable(u,'attack')))mode='attack';updateUI();});
for(const id of ['buildAirport','assignAirport'])$(id).addEventListener('click',()=>setMode(id));
$('confirmBombLine').addEventListener('click',()=>{if(!canCommand())return;submitBombLine({x:Number($('lineX1').value)-1,y:ROWS-Number($('lineY1').value)},{x:Number($('lineX2').value)-1,y:ROWS-Number($('lineY2').value)});});
$('cancelBombLine').addEventListener('click',()=>{mode=null;bombLineStart=null;updateUI();});

function togglePause(){if(game.multiplayer)return;if(!started||game.winner||!menusClosed())return;paused=!paused;mode=null;drag=null;lastFrame=performance.now();updateUI();say(game.mode==='rts'?(paused?'Pausa tática. Selecione tropas e emita ordens; P retoma o combate.':'Combate retomado. Tropas e IA agem ao mesmo tempo.'):(paused?'Animações pausadas. P para continuar.':'Animações retomadas. Planeje sem pressa no seu turno.'));}
function endPlayerTurn(){if(!canCommand()||!game.endTurn())return;paused=false;mode=null;drag=null;lastFrame=performance.now();updateUI();say('Turno da IA. Aguarde a próxima rodada.');if(typeof tutorialEvent==='function')tutorialEvent('endTurn');}
$('endTurn').addEventListener('click',endPlayerTurn);
$('radarCollapse').addEventListener('click',()=>{radarCollapsed=!radarCollapsed;renderer.drawRadar();clampCamera();renderer.drawMini();});
$('radarToggle').addEventListener('click',()=>{if(!started||game.winner||!menusClosed()||game.mode!=='rts'&&game.turn!==localPlayerSide())return;const units=selectedUnits().filter(u=>u.type==='antiAirVehicle'),on=units.some(u=>!u.radarOn);for(const u of units)game.setRadar(u,on);updateUI();say(`Radar ${on?'ligado':'desligado'} em ${units.length} antiaérea(s). Contatos da equipe: ${game.radarContacts[localPlayerSide()].size}.`);});
function toggleGrid(){showGrid=!showGrid;changeSetting('grid',showGrid);renderer.dirty=true;updateUI();}
$('grid').addEventListener('click',toggleGrid);
$('pause').addEventListener('click',togglePause);$('speed').addEventListener('click',()=>{if(game.multiplayer)return;const speeds=[.25,.5,1,2];speed=speeds[(speeds.indexOf(speed)+1)%speeds.length];updateUI();});
$('panTool').addEventListener('click',()=>{panTool=!panTool;updateUI();say(panTool?'Câmera ativa: arraste com o botão esquerdo para mover o mapa; clique seleciona. Desative para voltar à seleção em caixa.':'Botão esquerdo volta a selecionar em caixa.');});
$('addSelect').addEventListener('click',()=>{addMode=!addMode;updateUI();say(addMode?'Somar ativo: cliques e caixas adicionam ou removem tropas da seleção.':'Seleção normal.');});
function toggleFullscreen(){if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else document.documentElement.requestFullscreen?.().catch(()=>{});}
$('fullscreen').addEventListener('click',toggleFullscreen);document.addEventListener('fullscreenchange',()=>{const on=!!document.fullscreenElement;$('fullscreen').textContent=on?'Sair da tela cheia':'Tela cheia';$('fullscreen').setAttribute('aria-pressed',String(on));});
$('sound').addEventListener('click',()=>{audio.enabled=!audio.enabled;changeSetting('sound',audio.enabled);if(audio.master)audio.master.gain.value=audio.enabled?.14:0;audio.unlock();$('sound').textContent=audio.enabled?'Som ligado':'Som desligado';$('sound').setAttribute('aria-pressed',String(audio.enabled));});
let overlaid=false,pausedBefore=true,backTo=null;
// Pausa de todos os diálogos: guarda o estado anterior ao primeiro menu e o restaura quando o último fecha.
function syncPause(){if(game.multiplayer){paused=!!game.paused;overlaid=false;lastFrame=performance.now();updateUI();return;}const open=!!document.querySelector('dialog[open]');if(open&&!overlaid){overlaid=true;pausedBefore=paused;}if(open)paused=true;else if(overlaid){overlaid=false;paused=started?pausedBefore:true;}lastFrame=performance.now();updateUI();}
function openMenu(id){drag=null;mode=null;$(id).showModal();syncPause();if(typeof MenuSystem!=='undefined')MenuSystem.opened(id);if(id==='manual'){renderUnitSheets();$('manualSearch').value='';filterManual('');$('manualSearch').focus();}}
function closeMenu(id){$(id).close();syncPause();}
// Fecha um diálogo: volta ao menu inicial se ele veio de lá; senão retoma a partida.
function closeChild(id){$(id).close();if(backTo){backTo=null;openTitle();}else syncPause();}
function leaveTitleFor(fn){if($('titleScreen').open){$('titleScreen').close();backTo='titleScreen';}fn();}
function openTitle(){backTo=null;if(!$('titleScreen').open)openMenu('titleScreen');refreshTitle();$('titlePlay').focus();}
function refreshTitle(){paintTitle();drawNationFlag('titleNationFlag',settings.nation);setText('titleNationName',settings.nation.name);$('titleResume').hidden=!started;const info=campaignSummary();const label=$('titleCampaign').querySelector('span');label.textContent=info?'Continuar campanha':'Campanha';$('titleCampaignInfo').textContent=info||'Mapa-múndi gerado por semente';$('titleProfileInfo').textContent=profileSummary();}
// Carta animada do início (public/js/title-map.js): independente da semente e do estado da operação.
function paintTitle(){TitleMap.paint();}
function setupDescription(){$('setupDescription').textContent=$('modeSelect').value==='rts'?'Tropas e IA agem ao mesmo tempo. Pressione P ou Pausar para congelar o combate, selecionar tropas e preparar ordens. Continue para executá-las.':'Você joga primeiro. Cada tropa tem movimento limitado e uma ação por turno. A IA só age quando você encerra o turno. Planeje sem limite de tempo.';}
$('modeSelect').addEventListener('change',setupDescription);
function setupOptions(){return{landscape:$('genLandscape').value,water:$('genWater').value/100,forest:$('genForest').value/100,relief:$('genRelief').value/100,farmland:$('genFarmland').value/100,posts:Number($('genPosts').value)};}
let preparedSeed=1;
function setupPreview(){
 const seed=Number($('seed').value)||preparedSeed,map=$('mapSelect').value;preparedSeed=seed;$('procedural').hidden=map!=='random';
 const g=new Game(map,'normal',seed,'turns',setupOptions());TitleMap.render($('preview'),g,map);
 setText('previewCaption',MAPS[map]+(map==='random'?' · '+LANDSCAPE_NAMES[g.landscape]:'')+' · semente '+seed);
 const frame=$('preview').parentElement;frame.classList.remove('scan');void frame.offsetWidth;frame.classList.add('scan'); // varredura a cada nova prévia
 showDoctrines('playerDoctrine','playerDoctrineInfo','enemyDoctrineInfo',seed);if(typeof SetupMenu!=='undefined')SetupMenu.refresh();
}
function rerollSeed(){$('seed').value=Math.floor(Math.random()*4294967294)+1;setupPreview();}
for(const id of ['mapSelect','seed','genLandscape','genWater','genForest','genRelief','genFarmland','genPosts'])$(id).addEventListener('input',setupPreview);$('reroll').addEventListener('click',rerollSeed);
function openSetup(){if(typeof SetupMenu!=='undefined')SetupMenu.init();if($('result').open)$('result').close();$('mapSelect').value=game.map;// Primeira operação usa as configurações padrão; depois, repete o modo e a dificuldade da partida anterior.
$('difficulty').value=started?game.difficulty:settings.difficulty;$('modeSelect').value=started?game.mode:settings.mode;setupDescription();updateArmySummary();if(!$('seed').value)rerollSeed();else setupPreview();if(typeof SetupMenu!=='undefined')SetupMenu.show('theater');openMenu('setup');}
// Facção do jogador: as unidades "inimigas" (vermelhas) valem na batalha rápida e na campanha livre; tutorial e história passam o padrão.
function newOperation(map,difficulty,seed,battleMode='turns',options,factions=playerFactions()){if(Multiplayer.session)Multiplayer.leave(false);if(typeof tutorialEvent==='function')tutorialEvent('operation');game=new Game(map,difficulty,seed,battleMode,options,{blue:settings.doctrine,red:enemyDoctrine(seed)},{blue:settings.startingArmy},null,factions);game.nationName=settings.nation.name;selection=new Set();groups=Array.from({length:5},()=>[]);radarCollapsed=null;productionBaseId=null;productionCollapsed=false;for(const g of Object.values(recruitGroups)){g.open=false;delete g.dataset.chosen;}paused=false;started=true;overlaid=false;backTo=null;speed=settings.speed;mode=null;bombLineStart=null;drag=null;hover=null;marker=null;resultShown=false;lastLog=null;lastFrame=performance.now();if($('result').open)$('result').close();paintRecruitIcons();renderer.rebuild();const hq=game.hq(localPlayerSide()),p=CENTER(hq);centerCamera(p.x,p.y);updateUI();say(game.mode==='rts'?'Combate em tempo real. Pausar congela o combate para selecionar tropas e preparar ordens.':'Seu turno: selecione, mova e ataque. Encerrar turno passa a vez à IA.');if(settings.armyRestored){game.log(ARMY_NOTICE);say(ARMY_NOTICE);delete settings.armyRestored;saveSettings();updateArmySummary();updateUI();}}
// Desistir vale em todos os modos: solo, campanha, história e tutorial dão a derrota na hora; no multiplayer o adversário vence e os dois seguem na sala.
$('surrender').addEventListener('click',()=>{
 if(!started||game.winner||!confirm('Desistir da partida? Ela conta como derrota.'))return;
 try{$('gameMore').hidePopover();}catch{}
 if(game.multiplayer){Multiplayer.surrender();return;}
 if(game.mission&&typeof Missions!=='undefined')Missions.finish(game,false,'Missão abandonada.');else{game.winner='red';game.log('Operação abandonada.');}
 paused=true;updateUI();
});
$('newGame').addEventListener('click',openSetup);$('playAgain').addEventListener('click',()=>game.multiplayer?Multiplayer.rematch():openSetup());$('cancelSetup').addEventListener('click',()=>closeChild('setup'));
$('help').addEventListener('click',()=>openMenu('manual'));$('closeHelp').addEventListener('click',()=>closeChild('manual'));
for(const id of ['setup','manual','settings'])$(id).addEventListener('cancel',e=>{e.preventDefault();closeChild(id);});
$('review').addEventListener('click',()=>{$('result').close();updateUI();});
$('revealMap').addEventListener('click',()=>{game._reveal=localPlayerSide();game.updateVision();$('result').close();updateUI();say('Mapa inteiro revelado: posições do inimigo ao fim da operação.');});
$('resultToMenu').addEventListener('click',()=>{if($('result').open)$('result').close();openTitle();});
$('setupForm').addEventListener('submit',e=>{e.preventDefault();if(!$('setupForm').reportValidity())return;audio.unlock();const seed=Number($('seed').value)||preparedSeed;changeSetting('doctrine',cleanDoctrine($('playerDoctrine').value));$('setup').close();if(settings.fullscreen&&!document.fullscreenElement)toggleFullscreen();newOperation($('mapSelect').value,$('difficulty').value,seed,$('modeSelect').value,setupOptions());});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!game.winner&&!game.multiplayer){paused=true;if(overlaid)pausedBefore=true;drag=null;mode=null;updateUI();say('Operação pausada ao sair da aba. Continue quando estiver pronto.');}lastFrame=performance.now();});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&document.querySelector(':popover-open'))return;
 if(e.key===' '&&started&&menusClosed()&&!['INPUT','SELECT','TEXTAREA','BUTTON','SUMMARY'].includes(e.target.tagName)){e.preventDefault();if(!e.repeat)togglePause();return;}
 if(['BUTTON','SUMMARY'].includes(e.target.tagName)&&(e.key==='Enter'||e.key===' '))return;
 if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;const key=e.key.toLowerCase();
 if(/^[1-5]$/.test(key)){e.preventDefault();groupAction(Number(key)-1,e.ctrlKey||e.metaKey);return;}
 if(key==='p'){e.preventDefault();togglePause();return;}if(key==='escape'){mode=null;drag=null;selection.clear();updateUI();return;}
 if(e.ctrlKey||e.metaKey||e.altKey)return;if(key==='g'){e.preventDefault();if(!e.repeat)toggleGrid();}else if(key==='enter'){e.preventDefault();if(!e.repeat)endPlayerTurn();}else if(key==='s'){e.preventDefault();stopSelected();}else if(key==='a'){e.preventDefault();setMode('attackMove');}else if(key==='m')setMode('move');else if(key==='b')setMode(orderUnits('planeBomb').length&&!$('planeBomb').disabled?'planeBomb':'bombard');else if(key==='t')planeAction('takeoff');else if(key==='l')planeAction('return');else if(key==='r')setMode('repair');
});
/* Parado (pausa, menus, fim de jogo), o quadro só é redesenhado após uma interação ou a cada 0,25 s. */
for(const type of ['pointerdown','pointermove','pointerup','keydown','click'])document.addEventListener(type,()=>{renderer.dirty=true;},{capture:true,passive:true});
let idleClock=0;
function frame(now){
 const frameSeconds=Math.max(0,(now-lastFrame)/1000),wall=Math.min(.1,frameSeconds);lastFrame=now;const dt=playable()?wall*speed:0;
 // Rolagem pela borda: 24 px do contorno do campo movem a câmera ~900 px de tela por segundo.
 if(pointer&&!pan&&started&&menusClosed()){const v=cameraViewport(),edge=24,step=900*wall/cam.zoom,inside=pointer.x>=0&&pointer.x<=v.width&&pointer.y>=0&&pointer.y<=v.height,dx=inside?(pointer.x<edge?-1:pointer.x>v.width-edge?1:0):0,dy=inside?(pointer.y<edge?-1:pointer.y>v.height-edge?1:0):0;
  if(dx||dy){const before=cam.x+','+cam.y;cam.x+=dx*step;cam.y+=dy*step;clampCamera();if(before!==cam.x+','+cam.y){hover=pointerPosition(pointer.client);if(drag)drag.end=hover;renderer.drawMini();}}}
 if(dt&&!game.multiplayer){const previousTurn=game.turn;for(let remaining=dt;remaining>1e-8;remaining-=STEP)game.update(Math.min(STEP,remaining));if(previousTurn==='red'&&game.turn===localPlayerSide()&&!game.winner)say('Seu turno. Movimento e ações renovados. Enter encerra o turno.');}if(game.multiplayer)Multiplayer.interpolate(now);renderer.consume();idleClock+=wall;
 if(dt||renderer.dirty||idleClock>=.25){renderer.draw(dt);if(dt>0&&(game.mode==='rts'||game.busy||game.projectiles.length))renderer.fx.observe(renderer.lastDrawMs,frameSeconds);renderer.dirty=false;idleClock=0;}uiClock+=wall;
 if(uiClock>=.12||game.winner&&!resultShown){uiClock=0;updateUI();}requestAnimationFrame(frame);
}
troopAtlas.onload=tankAtlas.onload=tankAtlas.onerror=heliAtlas.onload=heliAtlas.onerror=antiAirAtlas.onload=antiAirAtlas.onerror=highCloud.onload=highCloud.onerror=()=>{
 sprites.clear();portraitKey=null;renderer.dirty=true;
 paintRecruitIcons();
 updateUI();
};
troopAtlas.src=troopAtlasData;
tankAtlas.src=tankAtlasData;
heliAtlas.src=heliAtlasData;
antiAirAtlas.src=antiAirAtlasData;
highCloud.src=highCloudData;
for(const [type,image]of Object.entries(planeImages)){image.onload=image.onerror=troopAtlas.onload;image.src=planeSpriteData[type];}
for(const [type,image]of Object.entries(airportImages)){image.onload=image.onerror=troopAtlas.onload;image.src=airportSpriteData[type];}
for(const [type,images]of Object.entries(newTroopImages))images.forEach((image,i)=>{image.onload=image.onerror=troopAtlas.onload;image.src=type==='stealthDrone'?stealthDroneData:newTroopData[type][i];});
for(const [type,images]of Object.entries(transportImages))images.forEach((image,i)=>{image.onload=image.onerror=troopAtlas.onload;image.src=transportSpriteData[type][i];});
rocketLauncherImages.forEach((poses,team)=>poses.forEach((image,frame)=>{image.onload=image.onerror=troopAtlas.onload;image.src=rocketLauncherData[team][frame];}));
for(const [type,image]of Object.entries(franceImages)){image.onload=image.onerror=troopAtlas.onload;image.src=franceSpriteData[type];}
franceLaunchImages.forEach((image,frame)=>{image.onload=image.onerror=troopAtlas.onload;image.src=franceLaunchData[frame];});
for(const [name,image]of Object.entries(missileImages)){image.onload=image.onerror=troopAtlas.onload;image.src=missileSpriteData[name];}
const terrainReady=Promise.all(Object.entries(terrainData).map(([name,src])=>new Promise(resolve=>{const image=terrainImages[name]=new Image();image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=src;}))).then(()=>{clearTerrainCaches();renderer.paintGround();renderer.drawMini();setupPreview();$('titleBg').dataset.ready='';paintTitle();});
const battlefieldReady=typeof battlefieldData==='undefined'?Promise.resolve(false):Promise.all([
 ...Object.entries(battlefieldData.terrain).map(([name,src])=>{const image=battlefieldTerrainImages[name]=new Image();return loadBattlefieldImage(image,src);}),
 ...Object.entries(battlefieldImages).map(([name,image])=>loadBattlefieldImage(image,battlefieldData[name])),
 ...battlefieldClouds.map((image,i)=>loadBattlefieldImage(image,battlefieldData.clouds[i]).then(ok=>{if(ok){const s=document.createElement('canvas');s.width=image.width;s.height=image.height;const c=s.getContext('2d');c.drawImage(image,0,0);c.globalCompositeOperation='source-in';c.fillStyle='#071c2c';c.fillRect(0,0,s.width,s.height);battlefieldCloudShadows[i]=s;}return ok;}))
]).then(result=>{clearTerrainCaches();renderer.paintGround();renderer.dirty=true;return result.every(Boolean);});
// Reinício da GPU (driver, suspensão, captura de tela): o navegador devolve os canvas em branco e o jogo refaz os desenhos guardados.
let canvasRestore=0;
document.addEventListener('contextrestored',()=>{clearTimeout(canvasRestore);canvasRestore=setTimeout(restoreCanvases,100);},true);
function restoreCanvases(){
 clearTerrainCaches();planeShadows=new WeakMap();renderer.lighting.clear();
 Object.assign(renderer,{glow:{small:glow(2.8),large:glow(4)},contactShadow:softLight('#07130e70'),airShadow:softLight('#071c2c54'),terrainView:null,terrainBack:null,visionMask:null});
 renderer.rebuild();renderer.drawMini();$('titleBg').dataset.ready='';paintTitle();$('nationHeaderFlag').dataset.identity='';applyNation();
}
function loadBattlefieldImage(image,src){return new Promise(resolve=>{image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=src;});}
// Ao abrir, o menu inicial aparece sobre o campo; ele depende de campaign.js, por isso espera a página carregar.
updateUI();window.addEventListener('load',()=>openTitle());requestAnimationFrame(frame);
// Menu inicial: Continuar, Jogar, Campanha, Configurações e Como jogar; setas navegam os botões.
$('titlePlay').addEventListener('click',()=>leaveTitleFor(openSetup));
$('titleResume').addEventListener('click',()=>closeChild('titleScreen'));
$('titleCampaign').addEventListener('click',()=>leaveTitleFor(openCampaign));
$('titleSettings').addEventListener('click',()=>leaveTitleFor(openSettings));
$('titleHelp').addEventListener('click',()=>leaveTitleFor(()=>openMenu('manual')));
$('menuButton').addEventListener('click',()=>{if(started)openTitle();});
$('titleScreen').addEventListener('cancel',e=>{e.preventDefault();if(started)closeChild('titleScreen');});
$('titleScreen').addEventListener('keydown',e=>{if(e.key!=='ArrowDown'&&e.key!=='ArrowUp')return;const items=[...document.querySelectorAll('.title-menu button')].filter(b=>!b.hidden);const i=items.indexOf(document.activeElement);if(i<0)return;e.preventDefault();items[(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();});
// Tema dos menus: independente das configurações sincronizadas da partida.
applyMenuTheme();
// Configurações: cada alteração vale na hora e fica salva.
function drawNationFlag(id,n){
 const canvas=typeof id==='string'?$(id):id,c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,main=NATION_COLORS[n.primary],second=NATION_SECONDARY[n.secondary];c.clearRect(0,0,w,h);c.fillStyle=main;c.fillRect(0,0,w,h);
 c.fillStyle=second;if(n.pattern==='horizontal')c.fillRect(0,h/3,w,h/3);if(n.pattern==='vertical')c.fillRect(w/3,0,w/3,h);
 if(n.emblem!=='none'){c.save();c.translate(w/2,h/2);c.beginPath();const r=h*.23;
  if(n.emblem==='circle')c.arc(0,0,r,0,Math.PI*2);else{const count=n.emblem==='star'?10:4;for(let i=0;i<count;i++){const a=-Math.PI/2+i*Math.PI*2/count,rad=n.emblem==='star'&&i%2?r*.43:r;const x=Math.cos(a)*rad,y=Math.sin(a)*rad;if(!i)c.moveTo(x,y);else c.lineTo(x,y);}c.closePath();}
  c.strokeStyle=main;c.lineWidth=Math.max(2,h*.04);c.stroke();c.fillStyle=second;c.fill();c.restore();
 }
 canvas.setAttribute('aria-label','Bandeira da nação '+n.name);
}
// Ícones dos botões de recrutar: cor do dono e arte da facção (trocam ao mudar a nação ou as unidades).
function paintRecruitIcons(){airdropIconColor=null;for(const button of recruitButtons){const c=button.querySelector('canvas').getContext('2d');c.clearRect(0,0,60,60);unitIcon(c,button.dataset.recruit,30,33,TEAM[localPlayerSide()],1,0,0,false,0,false,sideArt(localPlayerSide()));}}
function applyNation(){
 const n=settings.nation;document.documentElement.style.setProperty('--nation',NATION_COLORS[n.primary]);drawNationFlag('titleNationFlag',n);setText('titleNationName',n.name);game.nationName=n.name;TEAM.blue=NATION_COLORS[n.primary];setText('campaignNationName',n.name);drawNationFlag('campaignNationFlag',n);
 portraitKey=null;sprites.clear();renderer.dirty=true;
 paintRecruitIcons();
 if($('campaign').open){renderCampaignStats();drawWorld();}if($('setup').open)setupPreview();updateUI();
}
function showDoctrines(selectId,infoId,enemyId,seed){
 const select=$(selectId);if(!select.options.length)select.replaceChildren(...Object.entries(NATION_DOCTRINES).map(([id,d])=>new Option(d.name,id)));
 for(const id of ['playerArmy','campaignUnits'])if($(id))$(id).value=settings.army;for(const id of ['enemyArmy','campaignEnemyArmy'])if($(id))$(id).value=settings.enemyArmy;select.value=settings.doctrine;setText(infoId,NATION_DOCTRINES[settings.doctrine].text+' · travada durante a batalha');
 const d=NATION_DOCTRINES[enemyDoctrine(seed)];setText(enemyId,seed===null?'Selecione uma região atacável.':`Inimiga: ${d.name} · ${d.text}`);
}
for(const [select,info,enemy]of [['playerDoctrine','playerDoctrineInfo','enemyDoctrineInfo'],['campaignDoctrine','campaignDoctrineInfo','campaignEnemyDoctrineInfo']])$(select).addEventListener('change',()=>{changeSetting('doctrine',cleanDoctrine($(select).value));if(select==='playerDoctrine')setupPreview();else showDoctrines(select,info,enemy,selectedRegion>=0?battleFor(campaign,selectedRegion).seed:null);});
for(const id of ['playerArmy','campaignUnits'])$(id).addEventListener('change',()=>{changeSetting('army',Object.hasOwn(ARMY_FACTION,$(id).value)?$(id).value:'own');for(const other of ['playerArmy','campaignUnits'])$(other).value=settings.army;updateArmySummary();});
for(const id of ['enemyArmy','campaignEnemyArmy'])$(id).addEventListener('change',()=>{changeSetting('enemyArmy',$(id).value);for(const other of ['enemyArmy','campaignEnemyArmy'])$(other).value=settings.enemyArmy;});
function nationDraft(){return {name:$('nationName').value.trim(),primary:$('nationPrimary').value,secondary:$('nationSecondary').value,pattern:$('nationPattern').value,emblem:$('nationEmblem').value};}
function previewNation(){const n=nationDraft();$('nationName').setCustomValidity(n.name.length>=1&&n.name.length<=32?'':'Digite um nome de 1 a 32 caracteres.');setText('nationPreviewName',n.name);drawNationFlag('nationPreviewFlag',cleanNation(n));}
$('personalizeNation').addEventListener('click',()=>{const n=settings.nation;for(const [id,key]of [['nationName','name'],['nationPrimary','primary'],['nationSecondary','secondary'],['nationPattern','pattern'],['nationEmblem','emblem']])$(id).value=n[key];previewNation();openMenu('nationEditor');$('nationName').focus();});
for(const id of ['nationName','nationPrimary','nationSecondary','nationPattern','nationEmblem'])$(id).addEventListener('input',previewNation);
$('nationForm').addEventListener('submit',e=>{e.preventDefault();previewNation();if(!$('nationForm').reportValidity())return;changeSetting('nation',cleanNation(nationDraft()));applyNation();closeMenu('nationEditor');});
$('cancelNation').addEventListener('click',()=>closeMenu('nationEditor'));
$('nationEditor').addEventListener('cancel',e=>{e.preventDefault();closeMenu('nationEditor');});
function fillSettings(){$('setSound').checked=audio.enabled;$('setGrid').checked=showGrid;$('setFullscreen').checked=settings.fullscreen;$('setSpeed').value=String(settings.speed);$('setDifficulty').value=settings.difficulty;$('setMode').value=settings.mode;$('setGraphics').value=settings.graphics;}
function applySettings(){settings.army=Object.hasOwn(ARMY_FACTION,settings.army)?settings.army:'own';settings.enemyArmy=['blue','red',FRANCE].includes(settings.enemyArmy)?settings.enemyArmy:'auto';if(armyOverBudget(settings.startingArmy,playerFaction()))settings.armyRestored=true;settings.nation=cleanNation(settings.nation);settings.doctrine=cleanDoctrine(settings.doctrine);settings.startingArmy=cleanStartingArmy(settings.startingArmy,playerFaction());document.documentElement.dataset.fx=settings.graphics;audio.enabled=settings.sound!==false;if(audio.master)audio.master.gain.value=audio.enabled?.14:0;$('sound').textContent=audio.enabled?'Som ligado':'Som desligado';$('sound').setAttribute('aria-pressed',String(audio.enabled));showGrid=settings.grid===true;fillSettings();applyNation();updateArmySummary();}
function openSettings(){fillSettings();openMenu('settings');}
$('setSound').addEventListener('change',()=>{audio.enabled=$('setSound').checked;if(audio.master)audio.master.gain.value=audio.enabled?.14:0;audio.unlock();$('sound').textContent=audio.enabled?'Som ligado':'Som desligado';$('sound').setAttribute('aria-pressed',String(audio.enabled));changeSetting('sound',audio.enabled);});
$('setGrid').addEventListener('change',()=>{showGrid=$('setGrid').checked;renderer.dirty=true;changeSetting('grid',showGrid);updateUI();});
$('setFullscreen').addEventListener('change',()=>changeSetting('fullscreen',$('setFullscreen').checked));
$('setSpeed').addEventListener('change',()=>changeSetting('speed',Number($('setSpeed').value)));
$('setDifficulty').addEventListener('change',()=>changeSetting('difficulty',$('setDifficulty').value));
$('setMode').addEventListener('change',()=>changeSetting('mode',$('setMode').value));
ambientClouds.forEach((image,i)=>{image.onload=()=>{const s=document.createElement('canvas');s.width=image.width;s.height=image.height;const c=s.getContext('2d');c.drawImage(image,0,0);c.globalCompositeOperation='source-in';c.fillStyle='#071c2c';c.fillRect(0,0,s.width,s.height);cloudShadows[i]=s;renderer.dirty=true;};image.onerror=()=>{cloudShadows[i]=null;renderer.dirty=true;};image.src=ambientCloudData[i];});
$('setGraphics').addEventListener('change',()=>{changeSetting('graphics',$('setGraphics').value);document.documentElement.dataset.fx=settings.graphics;renderer.dirty=true;say('Perfil gráfico aplicado: '+$('setGraphics').selectedOptions[0].textContent+'.');});
$('settingsReset').addEventListener('click',()=>{settings={...SETTING_DEFAULTS};saveSettings();applySettings();setMenuTheme('system');});
$('settingsBack').addEventListener('click',()=>closeChild('settings'));
applySettings();

let armyEditorFaction='blue';
function updateArmySummary(){const army=settings.startingArmy,n=Object.values(army).reduce((a,b)=>a+b,0),text=n+' tropas escolhidas + comandante · '+armyCost(army,playerFaction())+' / '+STARTING_BUDGET+' pontos'+(settings.armyRestored?' · ⚠ '+ARMY_NOTICE:'');for(const id of ['setupArmySummary','campaignArmySummary'])setText(id,text);}
function armyDraft(){return Object.fromEntries([...$('armyUnits').querySelectorAll('input')].map(input=>[input.dataset.army,input.valueAsNumber]));}
function updateArmyBudget(){const army=armyDraft(),valid=Object.values(army).every(n=>Number.isInteger(n)&&n>=0),cost=valid?armyCost(army,armyEditorFaction):NaN,over=cost>STARTING_BUDGET;setText('armySpent',valid?cost:'—');setText('armyRemaining',valid?STARTING_BUDGET-cost:'—');setText('armyError',!valid?'Use quantidades inteiras, iguais ou maiores que zero.':over?'A formação excede os 600 pontos.':'');setProp('saveArmy','disabled',!valid||over);setWidth('armyBar',valid?cost/STARTING_BUDGET:0);$('armyBar').parentElement.classList.toggle('over',over);for(const row of $('armyUnits').querySelectorAll('.army-unit'))row.dataset.count=row.querySelector('input').value;for(const section of $('armyUnits').querySelectorAll('.army-category')){const n=[...section.querySelectorAll('input')].reduce((a,i)=>a+(i.valueAsNumber>0?i.valueAsNumber:0),0);section.querySelector('.army-count').textContent=n?n+' escolhida'+(n>1?'s':''):'';}}
function fillArmyEditor(army,owner='blue',faction=owner){
 armyEditorFaction=faction;
 const groups={};$('armyUnits').replaceChildren();for(const [category,label]of Object.entries(CATEGORY_NAME)){const section=document.createElement('section');section.className='army-category';section.dataset.category=category;const heading=document.createElement('h3');const icon=document.createElement('i');icon.dataset.icon={infantaria:'infantry',veiculos:'tank',artilharia:'target',aereo:'plane'}[category];icon.setAttribute('aria-hidden','true');const count=document.createElement('span');count.className='army-count';heading.append(icon,label,count);const grid=document.createElement('div');grid.className='army-cards';section.append(heading,grid);$('armyUnits').append(section);groups[category]=grid;}
 for(const type of startingCatalog(faction)){const t=SPEC(type,faction),row=document.createElement('div');row.className='army-unit';const icon=document.createElement('canvas');icon.width=icon.height=64;icon.setAttribute('aria-hidden','true');unitIcon(icon.getContext('2d'),type,32,32,TEAM[owner],.75,0,0,false,0,false,ART[faction]||0);const label=document.createElement('label');label.htmlFor='army-'+type;label.textContent=t.name;const price=document.createElement('small');price.textContent=t.cost+' pontos'+(t.plane?' · começa em voo':'');label.append(price);const input=document.createElement('input');input.id=label.htmlFor;input.dataset.army=type;input.type='number';input.min='0';input.max=String(Math.floor(STARTING_BUDGET/t.cost));input.step='1';input.required=true;input.value=String(army[type]||0);input.setAttribute('aria-label','Quantidade de '+t.name);const buttons=[[-1,'−'],[1,'+']].map(([direction,text])=>{const b=document.createElement('button');b.type='button';b.className='stepper';b.dataset.step=String(direction);b.textContent=text;b.setAttribute('aria-label',(direction<0?'Remover ':'Adicionar ')+t.name);return b;});row.append(icon,label,buttons[0],input,buttons[1]);groups[UNIT_CATEGORY[type]].append(row);}updateArmyBudget();
}
// Um só listener para todos os botões − e + do editor.
$('armyUnits').addEventListener('click',e=>{const b=e.target.closest('.stepper');if(!b)return;const input=b.parentElement.querySelector('input');+b.dataset.step<0?input.stepDown():input.stepUp();input.dispatchEvent(new Event('input',{bubbles:true}));});
for(const id of ['setupArmy','campaignArmy'])$(id).addEventListener('click',()=>{fillArmyEditor(settings.startingArmy,'blue',playerFaction());openMenu('armyEditor');});
$('armyUnits').addEventListener('input',updateArmyBudget);$('resetArmy').addEventListener('click',()=>fillArmyEditor(STARTING_DEFAULT,Multiplayer.editingArmy?Multiplayer.session.side:'blue',Multiplayer.editingArmy?Multiplayer.faction:playerFaction()));$('clearArmy').addEventListener('click',()=>fillArmyEditor({},Multiplayer.editingArmy?Multiplayer.session.side:'blue',Multiplayer.editingArmy?Multiplayer.faction:playerFaction()));$('cancelArmy').addEventListener('click',()=>closeMenu('armyEditor'));$('armyEditor').addEventListener('cancel',e=>{e.preventDefault();closeMenu('armyEditor');});$('armyForm').addEventListener('submit',e=>{e.preventDefault();updateArmyBudget();if($('saveArmy').disabled||!$('armyForm').reportValidity())return;if(Multiplayer.editingArmy){Multiplayer.saveArmy(armyDraft());closeMenu('armyEditor');return;}delete settings.armyRestored;changeSetting('startingArmy',cleanStartingArmy(armyDraft(),playerFaction()));updateArmySummary();closeMenu('armyEditor');});updateArmySummary();

/* Busca e fichas só escrevem no DOM ao abrir o manual ou mudar a consulta. */
const manualFold=text=>text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
function filterManual(query){const term=manualFold(query.trim());let total=0;for(const topic of $('manual').querySelectorAll('.topic')){const match=!term||manualFold(topic.textContent).includes(term);topic.hidden=!match;topic.open=!!term&&match;if(match)total++;}for(const section of $('manual').querySelectorAll('.manual-section'))section.hidden=!section.querySelector('.topic:not([hidden])');$('manualEmpty').hidden=total>0;if(!total)setText('manualEmpty','Nenhum tópico com “'+query+'”. Tente outra palavra.');return total;}
// Fichas em três painéis (Verde / Vermelho / Azul-França) com abas. Cada painel é montado na primeira vez que aparece e reconstruído só se a cor da nação mudar.
function renderUnitSheets(){
 const container=$('unitSheets'),color=TEAM.blue;let host=$('unitSheetTabs');if(host&&host.dataset.color===color)return;
 const number=n=>n.toLocaleString('pt-BR');
 const build=(type,t,art)=>{const article=document.createElement('article');article.className='unit-sheet';const icon=document.createElement('canvas');icon.width=icon.height=96;icon.setAttribute('aria-hidden','true');unitIcon(icon.getContext('2d'),type,48,52,art===1?TEAM.red:color,1.5,0,0,false,0,false,art);const heading=document.createElement('h4');heading.textContent=t.name+(art===2?' · azul (França)':'');const role=document.createElement('p');role.textContent=t.role;const dl=document.createElement('dl'),fields=[['Custo','cost'],['Vida','hp'],['Treino','train'],['Movimento','move'],['Velocidade','speed'],['Alcance','range'],['Visão','vision'],['Dano','damage'],['Precisão','accuracy']];for(const [label,key]of fields){if(t[key]===undefined)continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=key==='train'?number(t.train)+' turnos / '+number(t.train*10)+' s':key==='range'?number(t.min||0)+'–'+number(t.range):key==='speed'?number(t.speed)+' casas/s':key==='accuracy'?number(t.accuracy*100)+'%':number(t[key]);dl.append(dt,dd);}article.append(icon,heading,role,dl);return article;};
 const redTypes=[...RECRUIT_TYPES.map(type=>({fighterBlue:'fighterRed',multiroleBlue:'multiroleRed'}[type]||type)),'bomberRed','stealthFighterRed'].filter(type=>TYPES[type]);
 const lists={unitSheets:()=>RECRUIT_TYPES.map(type=>build(type,TYPES[type],0)),unitSheetsRed:()=>redTypes.map(type=>build(type,SPEC(type,'red'),1)),unitSheetsFrance:()=>[...Object.keys(FR_TYPES),'fighterFr','multiroleFr','stealthFighterFr','bomberFr'].map(type=>build(type,SPEC(type,FRANCE),2))};
 const fill=panel=>{if(panel.dataset.color===color)return;panel.replaceChildren(...lists[panel.id]());panel.dataset.color=color;};
 if(!host){
  host=document.createElement('div');host.id='unitSheetTabs';const red=document.createElement('div'),fr=document.createElement('div');red.id='unitSheetsRed';fr.id='unitSheetsFrance';red.className=fr.className=container.className;
  container.before(host);container.after(red,fr);
  MenuKit.tabs(host,[{id:'sheets-verde',label:'Verde',panel:container},{id:'sheets-vermelho',label:'Vermelho',panel:red},{id:'sheets-franca',label:'Azul (França)',panel:fr}],{onChange:()=>{for(const panel of [container,red,fr])if(!panel.hidden)fill(panel);}});
 }
 host.dataset.color=color;for(const id of Object.keys(lists)){const panel=$(id);if(!panel.hidden)fill(panel);}
}
$('manualSearch').addEventListener('input',e=>filterManual(e.target.value));
const transportManual=document.createElement('details');transportManual.className='topic';transportManual.id='man-transportes';transportManual.innerHTML='<summary>Transportes, embarque e reforço aéreo</summary><p>Caminhão: 4 tropas; helicóptero: 6 tropas e mais 1 tanque leve pendurado embaixo. Selecione o transporte, use Embarcar e clique numa tropa a pé adjacente (ou no tanque leve, para o helicóptero). Transporte parado e helicóptero em altitude baixa sobre terreno transitável. Desembarcar usa casas livres adjacentes; a carga restante fica a bordo. Passageiros não atacam, capturam, dão visão ou aura. Abate elimina os passageiros. Em turnos, embarque/desembarque consome a ação; passageiros desembarcados agem no próximo turno.</p><p>No aeroporto, escolha Reforço aéreo e monte até 12 vagas. Tropas a pé usam 1 vaga; batedor e tanque leve usam 4; tanque médio usa 6. O total inclui 150 créditos do voo. O avião chega pela borda do mapa e pousa na pista; tropas suas a até 2 casas do aeroporto podem embarcar nele (selecione o avião, Embarcar, clique na tropa), até completar as vagas. Com o avião pousado, use Lançar tropas e marque início e fim de uma linha de 4 a 12 casas: ele decola, solta uma tropa a cada trecho da linha por paraquedas (2 segundos; veículos usam plataforma) e volta a pousar para novo embarque, sem nova taxa. No painel do aeroporto, com o avião parado na pista, a compra rápida põe cada tropa direto dentro do avião por +20% do preço e sem taxa de voo. Carga sem área de pouso volta a bordo. Avião vulnerável à defesa aérea; abate perde a carga a bordo, paraquedas já lançados continuam. Uma missão por equipe. Helicóptero aliado leva 1 tanque leve pendurado; o inimigo leva 1 artilharia de mísseis.</p><p>Mais → Salvar batalha exporta a operação local com carga e voos. Carregar batalha restaura uma operação pausada; o backup de perfil e campanha continua separado. Verde e vermelho têm as mesmas capacidades (só os sprites diferem). O azul (França) tem fichas próprias: NH90 com 8 vagas ou 1 batedor + 3 tropas, caminhão com 5 e A400M com 10 vagas e pista curta. Balanceamento provisório.</p>';$('unitSheets').parentElement.append(transportManual);
const transportLink=document.createElement('a');transportLink.className='chip';transportLink.dataset.icon='plane-landing';transportLink.href='#man-transportes';transportLink.textContent='Transportes';$('manualNav').append(transportLink);
// Save de batalha separado do backup de perfil/campanha e da sincronização da conta.
const battleSaveButton=document.createElement('button'),battleLoadLabel=document.createElement('label'),battleLoadInput=document.createElement('input');
battleSaveButton.id='saveBattle';battleSaveButton.textContent='Salvar batalha';battleLoadLabel.className='file-button';battleLoadLabel.textContent='Carregar batalha';battleLoadInput.id='loadBattle';battleLoadInput.type='file';battleLoadInput.accept='.json,application/json';battleLoadLabel.append(battleLoadInput);$('gameMore').append(battleSaveButton,battleLoadLabel);
battleSaveButton.addEventListener('click',()=>{if(!started||game.multiplayer){say('Salvar batalha está disponível nas operações locais.');return;}const data=typeof exportBattleData==='function'?exportBattleData():{kind:'rtsvibe-battle',battle:game.snapshot()},url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='rtsvibe-batalha.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Batalha exportada com passageiros e contexto da campanha.');});
battleLoadInput.addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(game.multiplayer){say('Encerre a sessão multiplayer antes de carregar uma batalha local.');return;}try{if(file.size>8*1024*1024)throw Error('Arquivo excede 8 MB.');const data=JSON.parse(await file.text());if(data.kind!=='rtsvibe-battle')throw Error('Escolha um arquivo de batalha.');const restored=Game.fromSnapshot(data.battle),context=typeof restoreBattleContext==='function'?restoreBattleContext(data,restored):null;game=restored;game.paused=false;campaignBattle=context?.link||null;if(context){campaign=context.campaign;worldView=null;saveCampaign();}selection.clear();groups=Array.from({length:5},()=>[]);started=true;paused=true;mode=null;resultShown=false;portraitKey=null;lastLog=null;lastFrame=performance.now();for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();overlaid=false;renderer.rebuild();const base=game.commandBase('blue');if(base)centerCamera(base.x,base.y);updateUI();say('Batalha carregada e pausada. Retome para continuar.');}catch(error){say('Não foi possível carregar: '+error.message);}});
