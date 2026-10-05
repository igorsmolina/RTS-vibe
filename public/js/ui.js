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
  else if(kind==='victory')[392,494,587,784].forEach((n,i)=>this.tone(n,.3,'triangle',i*.17));
  else if(kind==='defeat')[330,294,220,165].forEach((n,i)=>this.tone(n,.4,'triangle',i*.2));
 }
}

const $=id=>document.getElementById(id),CELL=56,TEAM={blue:'#77c8e2',red:'#ee9986',neutral:'#e0c992'};
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)'),audio=new Sound();let reducedMotion=motionPreference.matches;
let game=new Game(),selection=new Set(),groups=Array.from({length:5},()=>[]),paused=true,started=false,speed=1,mode=null,hover=null,drag=null,marker=null,resultShown=false,addMode=false,panTool=false,pointer=null,pan=null;
let lastFrame=performance.now(),uiClock=0,lastLog=null;
/* Configurações do jogador, salvas neste navegador (com try/catch: sem armazenamento, valem só na sessão). */
const SETTINGS_KEY='wargrid.settings.v1',SETTING_DEFAULTS={sound:true,grid:false,speed:1,fullscreen:true,difficulty:'normal',mode:'turns',graphics:'balanced'};
let settings={...SETTING_DEFAULTS};try{Object.assign(settings,JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'));}catch{}
if(!Object.hasOwn(GRAPHICS,settings.graphics))settings.graphics='balanced';
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}if(typeof touchProfile==='function')touchProfile('settings');}
function changeSetting(key,value){settings[key]=value;saveSettings();}
let showGrid=settings.grid===true;speed=[.25,.5,1,2].includes(settings.speed)?settings.speed:1;
let logOpen=false,detailsOpen=false,radarCollapsed=null;try{logOpen=localStorage.getItem('wargrid.log.v1')==='true';}catch{}
const renderer=new Renderer();
motionPreference.addEventListener('change',e=>{reducedMotion=e.matches;renderer.ambientParticles=[];renderer.dirty=true;});
function selectedUnits(){return [...selection].map(id=>game.get(id)).filter(u=>u&&u.owner==='blue'&&!TYPES[u.type].structure);}
function menusClosed(){return !document.querySelector('dialog[open]');}
function canCommand(){return started&&!game.winner&&(game.mode==='rts'||game.turn==='blue'&&!game.busy)&&menusClosed();}
function playable(){return started&&!game.winner&&!paused&&menusClosed();}
function say(text){$('hint').textContent=text;}
function timeLabel(value){return game.mode==='rts'?Math.floor(value/60).toString().padStart(2,'0')+':'+Math.floor(value%60).toString().padStart(2,'0'):'Rodada '+value;}
function entitiesAt(p){const visible=u=>u.owner==='blue'||game.isVisible('blue',u),near=game.units.filter(u=>{const pose=flightPose(u);return visible(u)&&(Math.hypot(u.x-p.x,u.y-p.y)<.55||AIR(u)&&Math.hypot(pose.x-p.x,pose.y-p.y)<.55*pose.scale);});return [...near.filter(AIR),...near.filter(u=>!AIR(u)),...game.structures.filter(u=>visible(u)&&Math.max(Math.abs(u.x-p.x),Math.abs(u.y-p.y))<.6)];}
function entityAt(p){return entitiesAt(p)[0];}
function weaponLabel(w){return w==='auto'?'Auto':WEAPONS[w].name;}
function setSelection(ids,add=false){if(!add)selection.clear();for(const id of ids)if(game.get(id))selection.add(id);mode=null;updateUI();}
function orderName(u){return u.pending?{move:'Em deslocamento',attack:'Atacando',repair:'Reparando',service:'Em manutenção',altitude:(u.order.altitude==='high'?'SUBINDO':'DESCENDO')+' ('+Math.max(0,ALTITUDE_TIME-(u.altitudeTransition?.returning?0:u.altitudeTransition?.elapsed||0)).toFixed(1)+' s)',capture:'Capturando',build:'Construindo',demine:'Desarmando'}[u.order.type]||'Executando ordem':u.entrenched?'Entrincheirada':game.mode==='rts'?'Pronta · fogo automático':u.actionLeft?'Ação disponível':'Ação usada';}
function flightStatus(u){return `\nAltitude: ${u.altitude==='high'?'ALTA':'Baixa'} · Flares: ${u.flares}/3 · ${game.flareReady(u)?'prontos':u.flares===0?'sem estoque':game.mode==='rts'?'recarga '+u.flareCooldown.toFixed(1).replace('.',',')+' s':'recarga até o próximo turno próprio'}`;}
/* Escritas no DOM só quando o valor muda: evita recálculo de estilo e layout a cada atualização do painel. */
function setText(id,value){const e=$(id);value=String(value);if(e.textContent!==value)e.textContent=value;}
function setProp(id,key,value){const e=typeof id==='string'?$(id):id;if(e[key]!==value)e[key]=value;}
function setAttr(id,key,value){const e=$(id);if(e.getAttribute(key)!==value)e.setAttribute(key,value);}
function setWidth(id,ratio){const e=$(id),value=Math.round(Math.max(0,Math.min(1,ratio))*1000)/10+'%';if(e.style.width!==value)e.style.width=value;}
let portraitKey=null,recruitButtons=[];
function updateUI(){
  setAttr('grid','aria-pressed',String(showGrid));
  const rts=game.mode==='rts';
  for(const id of selection){const u=game.get(id);if(!u||(u.owner!=='blue'&&!game.isVisible('blue',u)))selection.delete(id);}
  groups=groups.map(g=>g.filter(id=>game.get(id)?.owner==='blue'));
  setText('mapTitle',game.title||MAPS[game.map]);setText('credits',game.credits.blue);setText('income','+'+game.income('blue'));setText('incomeLabel',rts?'Renda / 10 s':'Renda / turno');setProp('income','title',rts?`+${game.income('blue')} créditos a cada 10 segundos de jogo`:`+${game.income('blue')} créditos no início do seu turno, a partir da rodada 2`);setText('force',game.units.filter(u=>u.owner==='blue').length);
  setText('clock',timeLabel(rts?game.time:game.round));setText('status',game.winner?'Operação encerrada':rts?(paused?'Pausa tática':'Combate em tempo real'):game.turn==='red'?'Turno da IA':game.busy?'Executando ordem':'Seu turno');setText('pause',paused?'Continuar [P]':'Pausar [P]');setProp('pause','disabled',!started||!!game.winner);setAttr('pause','aria-pressed',String(paused));setText('speed',String(speed).replace('.',',')+'×');setProp('pauseOverlay','hidden',!paused||!!game.winner);$('pauseOverlay').classList.toggle('tactical',rts);setText('pauseLabel',rts?'Pausa tática · emita ordens · P para continuar':'Animações pausadas');
  setText('modeTitle',rts?'Fronteiras / RTS':'Fronteiras / Por turnos');setText('keyHint','Clique numa tropa: barra de comando · QG: produção · Botão direito: ordem · Bordas, roda, botão do meio ou ✋: câmera');setAttr('addSelect','aria-pressed',String(addMode));setAttr('panTool','aria-pressed',String(panTool));renderer.canvas.classList.toggle('grab',panTool);setProp('speed','title',rts?'Velocidade do combate: 0,25×, 0,5×, 1× e 2×':'Velocidade das animações: 0,25×, 0,5×, 1× e 2×');setAttr('speed','aria-label',rts?'Alternar velocidade do combate':'Alternar velocidade das animações');setAttr('battlefield','aria-label',(rts?'Campo em tempo real.':'Campo por turnos.')+' Clique ou arraste para selecionar; botão direito emite ordens. Bordas, roda e botão do meio movem a câmera.');setText('stop',rts?'Parar [S]':'Aguardar [S]');
  setProp('endTurn','hidden',rts);setProp('endTurn','disabled',rts||!canCommand());
  setText('difficultyLabel','IA '+{easy:'fácil',normal:'normal',hard:'difícil',veteran:'veterana'}[game.difficulty]);setText('operationInfo',`Semente ${game.seed} · ${COLS} × ${ROWS} casas · Capture postos e destrua o QG inimigo`);setText('explored',Math.round(game.explored.blue.filter(Boolean).length/SIZE*100)+'%');
  const units=selectedUnits(),items=[...selection].map(id=>game.get(id)).filter(Boolean),u=items[0];setText('selectionCount',items.length?items.length+' selecionada(s)':'—');
  // Barra de comando: ordens para tropas azuis; produção quando o QG azul está selecionado; detalhes pelo botão i.
  setProp('commandBar','hidden',!items.length);setProp('modeLabel','hidden',!mode);setAttr('infoToggle','aria-expanded',String(detailsOpen));setProp('details','hidden',!detailsOpen);setProp('ordersPanel','hidden',!units.length);setProp('productionPanel','hidden',!items.some(v=>v.type==='hq'&&v.owner==='blue'));
  const key=u?u.type+u.owner:'';if(key!==portraitKey){portraitKey=key;const portrait=$('portrait').getContext('2d');portrait.clearRect(0,0,108,108);if(u)unitIcon(portrait,u.type,54,59,TEAM[u.owner],1.55);}
  if(u){
   const total=items.reduce((a,b)=>a+b.hp,0),max=items.reduce((a,b)=>a+b.maxHp,0);setWidth('healthBar',total/max);
   setText('unitName',items.length>1?`Grupo de ${items.length} tropas`:TYPES[u.type].name);
   setText('unitRole',items.length>1?[...new Set(items.map(v=>TYPES[v.type].name))].join(', '):rts&&u.type==='engineer'?'Reparo +24 HP por segundo':TYPES[u.type].role||'Estrutura de apoio');
   const t=TYPES[u.type],flight=t.air?flightStatus(u)+'\nArma: '+weaponLabel(u.weaponMode)+' · '+t.weapons.map(w=>WEAPONS[w].name+' '+WEAPONS[w].range+' casas, '+WEAPONS[w].cooldown+' s').join(' · ')+(rts?' · '+(u.cooldown>0?'recarga '+u.cooldown.toFixed(1).replace('.',',')+' s':'pronto'):''):'';
   const rangeText=u.type==='missileInfantry'?'solo 1 / ar 3':u.type==='antiAirVehicle'?': ilimitado — somente aeronaves':t.min+'–'+game.range(u);
   setText('unitInfo',items.length>1?'Integridade '+Math.ceil(total)+' / '+max+' HP\n'+(rts?units.filter(v=>v.pending).length+' tropas executando ordens':units.filter(v=>v.actionLeft).length+' ações disponíveis · '+units.filter(v=>v.moveLeft>0).length+' tropas com movimento')+units.filter(AIR).map(v=>'\n'+TYPES[v.type].name+flightStatus(v)).join(''):Math.ceil(u.hp)+' / '+u.maxHp+' HP · '+(t.air?(game.sky.blue[KEY(TILE(u).x,TILE(u).y)]?'Em voo sobre '+TERRAIN[game.terrainAt(u)].name.toLowerCase():'Em voo · terreno não observado'):TERRAIN[game.terrainAt(u)].name+' · '+Math.round(game.cover(u)*100)+'% defesa')+'\n'+(t.structure?(u.type==='hq'?'Treinamento serial · até 5 tropas':rts?'Renda +8 / 10 s':'Renda +8 por turno'):(rts?'Velocidade '+String(t.speed).replace('.',',')+' casas/s':'Movimento '+u.moveLeft+' / '+t.move)+' · Alcance'+(u.type==='antiAirVehicle'?'':' ')+rangeText+'\n'+'★'.repeat(u.level)+' '+orderName(u)+(game.hasAura(u)?' · Aura ativa':'')+(u.suppressed>0?' · Suprimida (−25 pontos de precisão)':'')+(!t.air&&CONCEAL.has(game.terrainAt(u))&&!(u.revealed>0)?' · Oculta na '+TERRAIN[game.terrainAt(u)].name.toLowerCase():'')+flight));
  }else{setText('unitName','Nenhuma unidade');setText('unitRole','Clique ou arraste no campo.');setText('unitInfo',rts?'Botão direito: ordem. Pausar congela o combate para dar ordens.':'Botão direito: ordem. Encerrar turno passa a vez à IA.');setWidth('healthBar',0);}
  const can=canCommand()&&units.length>0;setProp('move','disabled',!can||!rts&&!units.some(u=>u.moveLeft>0&&(u.type!=='artillery'||u.actionLeft||u.moved)));setProp('attackMove','disabled',!can||!rts&&!units.some(u=>u.actionLeft));setProp('stop','disabled',!can||!rts&&!units.some(u=>u.moveLeft>0||u.actionLeft));
  const noEngineer=!can||!units.some(u=>u.type==='engineer'&&(rts||u.actionLeft));setProp('repair','disabled',noEngineer);setProp('demine','disabled',noEngineer);setProp('build','disabled',!can||!units.some(u=>game.canBuild(u)));
  for(const id of ['move','attackMove','repair','demine','service'])setAttr(id,'aria-pressed',String(mode===(id==='attackMove'?'attack':id)));setText('modeLabel',mode?{move:'Escolha o destino',attack:'Escolha um inimigo',repair:'Escolha um aliado terrestre',service:'Escolha QG/posto aliado próximo',demine:'Escolha uma mina'}[mode]:'Contextual');
  const flying=units.filter(AIR);setProp('flightControls','hidden',!flying.length);
  const radars=units.filter(v=>v.type==='antiAirVehicle'),radarEnabled=started&&!game.winner&&(rts||game.turn==='blue')&&menusClosed(),radarState=radars.every(v=>v.radarOn)?'ligado':radars.some(v=>v.radarOn)?'misto':'desligado';setProp('radarControls','hidden',!radars.length);setText('radarToggle','Radar: '+radarState);setAttr('radarToggle','aria-pressed',radarState==='misto'?'mixed':String(radarState==='ligado'));setProp('radarToggle','disabled',!radarEnabled);setText('radarCount','Contatos da equipe: '+game.radarContacts.blue.size);
  for(const [id,altitude]of [['altitudeLow','low'],['altitudeHigh','high']]){setProp(id,'disabled',!can||!flying.some(v=>v.altitude!==altitude&&(rts||v.actionLeft)));setAttr(id,'aria-pressed',String(!!flying.length&&flying.every(v=>v.altitude===altitude)));}
  setProp('service','disabled',!can||!flying.some(v=>(rts||v.actionLeft)&&game.structures.some(b=>game.canService(v,b))));
  const armed=units.filter(v=>TYPES[v.type].weapons?.length>1),current=armed[0]?.weaponMode,missiles=[...new Set(armed.map(v=>TYPES[v.type].weapons[1]))];setProp('weapons','hidden',!armed.length);
  for(const b of $('weapons').children){const w=b.dataset.weapon;setProp(b,'disabled',!canCommand());setAttr(b.id,'aria-pressed',String(w==='missile'?missiles.includes(current):current===w));}setText('weaponMissile',missiles.length===1?WEAPONS[missiles[0]].name:'Míssil');
  const hq=game.hq('blue'),queue=hq?.queue||[],job=queue[0];setText('queueCount',`${queue.length} / 5`);
  for(const button of recruitButtons){const type=button.dataset.recruit,t=TYPES[type],duration=game.trainDuration(type)+(rts?' s':' turno(s)');setProp(button,'disabled',!canCommand()||!hq||queue.length>=5||game.credits.blue<t.cost);setProp(button,'title',`${t.name} · ${t.cost} créditos · ${duration} · ${t.role}`);if(button.getAttribute('aria-label')!==`Treinar ${t.name}, ${t.cost} créditos, ${duration}`)button.setAttribute('aria-label',`Treinar ${t.name}, ${t.cost} créditos, ${duration}`);}
  const duration=job?game.trainDuration(job.type):1;setWidth('productionBar',job?job.progress/duration:0);setText('queueStatus',!hq?'QG destruído.':job?job.progress>=duration?'Saída bloqueada. Afaste as tropas do QG.':`${TYPES[job.type].name} · ${Math.ceil(duration-job.progress)} ${rts?'s':'turno(s)'} restantes`:'Linha de produção livre.');
  setText('queue',queue.slice(1).map(q=>TYPES[q.type].name).join(' → '));
  for(let i=0;i<5;i++){$('group'+i).classList.toggle('filled',groups[i].length>0);setProp('group'+i,'title',`Grupo ${i+1}: ${groups[i].length} tropas. Clique seleciona; botão direito atribui.`);}
  if(game.logs[0]!==lastLog){lastLog=game.logs[0];$('log').replaceChildren(...game.logs.map(e=>{const div=document.createElement('div');div.className='log-line';const time=document.createElement('small');time.textContent=timeLabel(e.time);div.append(time,document.createTextNode(e.text));return div;}));setText('logLast',game.logs[0]?.text||'');}
  setAttr('logToggle','aria-expanded',String(logOpen));setProp('log','hidden',!logOpen);
  renderer.drawMini();renderer.drawRadar();
  if(game.winner&&!resultShown){resultShown=true;paused=true;audio.play(game.winner==='blue'?'victory':'defeat');$('resultTitle').textContent=game.winner==='blue'?'Vitória da Nação Azul':game.winner==='draw'?'Cessar-fogo':'Operação perdida';$('resultText').textContent=`Operação encerrada ${rts?'aos '+timeLabel(game.time):'na rodada '+game.round}. ${game.winner==='blue'?'O comando inimigo foi neutralizado.':'Reorganize suas forças e tente uma nova operação.'}`;$('backToWorld').hidden=!(typeof campaignBattle!=='undefined'&&campaignBattle);$('resultText').textContent+=recordResult();$('result').showModal();}
}
function issueAt(p,forced=mode){
 if(!canCommand()){say(game.mode==='rts'?'Feche o menu para emitir ordens.':'Aguarde o seu turno e a conclusão da ordem atual.');return;}const units=selectedUnits();if(!units.length){say('Selecione suas tropas primeiro.');return;}
 const cell=TILE(p);if(!INSIDE(cell.x,cell.y))return;const list=entitiesAt(p),hostile=list.filter(e=>e.owner==='red'&&!TYPES[e.type].structure),hurt=list.find(e=>e.owner==='blue'&&e.hp<e.maxHp&&!units.includes(e));
 const target=forced==='service'?list.find(e=>['hq','post'].includes(e.type)&&e.owner==='blue'):hostile.find(e=>units.some(u=>game.weapon(u,e)))||hostile[0]||((forced==='repair'||!forced&&units.some(u=>u.type==='engineer'))&&hurt&&!AIR(hurt)&&hurt)||list[0];let type=forced,args={x:cell.x,y:cell.y};
 if(!type){if(target?.type==='post'&&target.owner!=='blue'&&units.some(u=>u.type==='infantry'))type='capture';else if(target&&target.owner==='red')type='attack';else if(target?.owner==='blue'&&units.some(u=>u.type==='engineer')&&target.hp<target.maxHp)type='repair';else type='move';}
 if(['attack','capture','repair','service'].includes(type)){if(!target){say('Escolha um alvo válido para essa ordem.');return;}args={targetId:target.id};}
 const n=game.command(units.map(u=>u.id),type,args);
 if(n){marker={x:cell.x,y:cell.y,t:0,color:type==='attack'||type==='attackMove'?'#f9b09a':'#b8e5e6'};audio.play('click');say(`${paused?(game.mode==='rts'?'Pausa tática: ordem preparada. P para executar. ':'Animações pausadas: pressione P para executar. '):''}${n} unidade(s): ${{move:'mover',attackMove:'atacar-mover',attack:'atacar',capture:'capturar posto',repair:'reparar',service:'manutenção',demine:'desarmar mina'}[type]}${args.targetId?' · alvo: '+TYPES[target.type].name:''}.`);mode=null;}
 else say(game.mode==='rts'?'Ordem indisponível: confira o alvo, o terreno e os créditos.':type==='move'||type==='attackMove'?'Movimento indisponível: confira os pontos restantes e o terreno.':'Ação indisponível: confira o alvo, alcance e ações restantes.');updateUI();
}
function pointerPosition(e,canvas=renderer.canvas){const r=canvas.getBoundingClientRect();if(canvas===renderer.canvas)return{x:(cam.x+(e.clientX-r.left)/cam.zoom)/CELL-.5,y:(cam.y+(e.clientY-r.top)/cam.zoom)/CELL-.5};return{x:(e.clientX-r.left)/r.width*COLS-.5,y:(e.clientY-r.top)/r.height*ROWS-.5};}
function describe(p){const cell=TILE(p);if(!INSIDE(cell.x,cell.y))return;const k=KEY(cell.x,cell.y);$('tileInfo').textContent=`Casa ${cell.x+1}·${ROWS-cell.y} ·${game.explored.blue[k]?TERRAIN[game.terrain[k]].name:'Não explorado'}`;}
renderer.canvas.addEventListener('contextmenu',e=>e.preventDefault());
renderer.canvas.addEventListener('pointerdown',e=>{
 if($('setup').open||$('manual').open)return;audio.unlock();renderer.canvas.focus();const p=pointerPosition(e);hover=p;
 // Com ✋ Câmera ativa, o botão esquerdo arrasta a câmera; um clique sem arrastar continua selecionando.
 if(e.button===1||e.button===0&&panTool&&!mode){e.preventDefault();pan={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,left:e.button===0};renderer.canvas.setPointerCapture(e.pointerId);return;}
 if(e.button===2){e.preventDefault();issueAt(p);return;}if(e.button!==0)return;
 if(mode){issueAt(p);return;}drag={id:e.pointerId,start:p,end:p,active:false,shift:e.shiftKey||addMode};renderer.canvas.setPointerCapture(e.pointerId);
});
renderer.canvas.addEventListener('pointermove',e=>{const r=renderer.canvas.getBoundingClientRect();pointer={x:e.clientX-r.left,y:e.clientY-r.top,client:{clientX:e.clientX,clientY:e.clientY}};if(pan?.id===e.pointerId){cam.x-=(e.clientX-pan.x)/cam.zoom;cam.y-=(e.clientY-pan.y)/cam.zoom;pan.x=e.clientX;pan.y=e.clientY;clampCamera();renderer.drawMini();}hover=pointerPosition(e);describe(hover);if(drag&&drag.id===e.pointerId){drag.end=hover;drag.active ||= Math.hypot(drag.end.x-drag.start.x,drag.end.y-drag.start.y)>.18;}});
renderer.canvas.addEventListener('pointerup',e=>{
 if(pan?.id===e.pointerId){const p=pan;pan=null;if(!p.left||Math.hypot(e.clientX-p.sx,e.clientY-p.sy)>=5)return;drag={id:e.pointerId,active:false,shift:e.shiftKey||addMode};}
 if(!drag||drag.id!==e.pointerId)return;const box=drag;drag=null;if(renderer.canvas.hasPointerCapture(e.pointerId))renderer.canvas.releasePointerCapture(e.pointerId);
 if(box.active){const x1=Math.min(box.start.x,box.end.x),x2=Math.max(box.start.x,box.end.x),y1=Math.min(box.start.y,box.end.y),y2=Math.max(box.start.y,box.end.y),inside=p=>p.x>=x1&&p.x<=x2&&p.y>=y1&&p.y<=y2;setSelection(game.units.filter(u=>u.owner==='blue'&&(inside(u)||AIR(u)&&inside(flightPose(u)))).map(u=>u.id),box.shift);say(`${selectedUnits().length} tropas selecionadas.`);}
 else{const list=entitiesAt(pointerPosition(e)),at=list.findIndex(v=>selection.has(v.id)),u=list.length>1&&selection.size===1&&at>=0?list[(at+1)%list.length]:list[0];
  if(box.shift&&u?.owner==='blue'){if(selection.has(u.id))selection.delete(u.id);else selection.add(u.id);updateUI();}else setSelection(u?[u.id]:[]);
  if(u&&list.length>1)say(`${TYPES[u.type].name} selecionado (${list.indexOf(u)+1}/${list.length} nesta casa). Clique de novo para alternar.`);}
});
renderer.canvas.addEventListener('pointercancel',()=>{drag=null;pan=null;});renderer.canvas.addEventListener('pointerleave',()=>{pointer=null;if(!drag)hover=null;});window.addEventListener('blur',()=>{drag=null;pan=null;pointer=null;});
renderer.canvas.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault();});
renderer.canvas.addEventListener('wheel',e=>{e.preventDefault();const r=renderer.canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top,wx=cam.x+mx/cam.zoom,wy=cam.y+my/cam.zoom;cam.zoom*=e.deltaY<0?1.15:1/1.15;clampCamera();cam.x=wx-mx/cam.zoom;cam.y=wy-my/cam.zoom;clampCamera();renderer.drawMini();hover=pointerPosition(e);},{passive:false});
new ResizeObserver(()=>{const v=renderer.canvas,dpr=devicePixelRatio||1;v.width=Math.max(1,Math.round(v.clientWidth*dpr));v.height=Math.max(1,Math.round(v.clientHeight*dpr));clampCamera();renderer.draw(0);renderer.drawMini();}).observe(renderer.canvas);
$('minimap').addEventListener('contextmenu',e=>{e.preventDefault();issueAt(pointerPosition(e,$('minimap')));});
function miniPan(e){if(e.buttons!==1||mode)return;const p=pointerPosition(e,$('minimap'));centerCamera(p.x,p.y);renderer.drawMini();}
$('minimap').addEventListener('pointerdown',e=>{if(e.button!==0)return;if(mode){issueAt(pointerPosition(e,$('minimap')));return;}$('minimap').setPointerCapture(e.pointerId);miniPan(e);});$('minimap').addEventListener('pointermove',miniPan);
function setMode(next){if(!canCommand()||!selectedUnits().length)return;if(mode===(next==='attackMove'?'attack':next)){mode=null;updateUI();say('Ordem cancelada.');return;}mode=next==='attackMove'?'attack':next;updateUI();say(next==='service'?'Clique no QG ou posto aliado na mesma casa ou ao lado do helicóptero parado em baixa altitude.':next==='repair'?(game.mode==='rts'?'Clique em um aliado terrestre para reparar até 24 HP por segundo.':'Clique em um aliado terrestre para reparar até 24 HP com uma ação.'):next==='demine'?'Clique em uma mina detectada.':'Clique no destino ou use o botão direito.');}
for(const id of ['move','attackMove','repair','demine','service'])$(id).addEventListener('click',()=>setMode(id));
for(const [id,altitude]of [['altitudeLow','low'],['altitudeHigh','high']])$(id).addEventListener('click',()=>{if(!canCommand())return;const n=game.command(selectedUnits().filter(AIR).map(u=>u.id),'altitude',{altitude});mode=null;updateUI();say(n?`${n} helicóptero(s): altitude ${altitude==='high'?'alta':'baixa'} em ${ALTITUDE_TIME} s ${game.mode==='rts'?'parado; S cancela.':'com uma ação.'}${paused?' Ordem preparada durante a pausa.':''}`:'Altitude indisponível.');});
function stopSelected(){if(!canCommand())return;game.command(selectedUnits().map(u=>u.id),'stop');mode=null;updateUI();say(game.mode==='rts'?'Ordem cancelada. As tropas param ao chegar à próxima casa.':'Tropas aguardando. Movimento e ação encerrados; trincheira ativa.');}
$('stop').addEventListener('click',stopSelected);
// Botão direito sobre a barra emite a ordem no ponto do mapa por baixo; com uma ordem escolhida, clicar fora dos botões também.
$('commandBar').addEventListener('contextmenu',e=>{e.preventDefault();issueAt(pointerPosition(e));});
$('commandBar').addEventListener('click',e=>{if(mode&&!e.target.closest('button,input,select'))issueAt(pointerPosition(e));});
$('closeSelection').addEventListener('click',()=>{setSelection([]);say('Seleção limpa.');});
$('infoToggle').addEventListener('click',()=>{detailsOpen=!detailsOpen;updateUI();});
$('hqButton').addEventListener('click',()=>{const hq=game.hq('blue');if(!hq){say('QG destruído.');return;}centerCamera(hq.x,hq.y);setSelection([hq.id]);renderer.drawMini();say('QG selecionado: escolha as tropas para treinar na barra de comando.');});
$('logToggle').addEventListener('click',()=>{logOpen=!logOpen;try{localStorage.setItem('wargrid.log.v1',String(logOpen));}catch{}updateUI();});
// Troca de arma: não gasta nem devolve ação e não altera a recarga comum.
for(const b of $('weapons').children)b.addEventListener('click',()=>{if(!canCommand())return;const w=b.dataset.weapon,armed=selectedUnits().filter(u=>TYPES[u.type].weapons?.length>1);for(const u of armed)game.setWeapon(u,w==='missile'?TYPES[u.type].weapons[1]:w);updateUI();if(armed.length)say(`Arma: ${b.textContent} (${armed.length} helicóptero(s)).`);});$('build').addEventListener('click',()=>{if(!canCommand())return;const count=game.command(selectedUnits().map(u=>u.id),'build');say(count?`${count} posto(s) ordenado(s). A infantaria será convertida em guarnição.`:'Escolha infantaria parada, com espaço para um posto.');updateUI();});
function groupAction(i,assign){if(assign){groups[i]=selectedUnits().map(u=>u.id);say(`Grupo ${i+1}: ${groups[i].length} tropas atribuídas.`);}else{setSelection(groups[i].filter(id=>game.get(id)));say(`Grupo ${i+1} selecionado.`);}updateUI();}
for(let i=0;i<5;i++){const b=document.createElement('button');b.id='group'+i;b.textContent=i+1;b.addEventListener('click',e=>groupAction(i,e.ctrlKey||e.metaKey));b.addEventListener('contextmenu',e=>{e.preventDefault();groupAction(i,true);});$('groups').append(b);}
for(const type of ['infantry','recon','engineer','artillery','lightTank','tank','heavyTank','antitank','machinegun','helicopter','helicopterGround','helicopterAir','antiAirVehicle','missileInfantry']){const t=TYPES[type],b=document.createElement('button');b.className='recruit';b.dataset.recruit=type;b.setAttribute('aria-label',`Treinar ${t.name}, ${t.cost} créditos, ${t.train} turno(s)`);b.title=`${t.name} · ${t.cost} créditos · ${t.train} turno(s) · ${t.role}`;b.innerHTML=`<canvas width="60" height="60" aria-hidden="true"></canvas><span>${{infantry:'Infant.',recon:'Batedor',engineer:'Engenh.',artillery:'Artilh.',lightTank:'Leve',tank:'Médio',heavyTank:'Pesado',antitank:'Antitanque',machinegun:'Metralh.',helicopter:'Helicóp.',helicopterGround:'Ar-terra',helicopterAir:'Ar-ar',antiAirVehicle:'Antiaéreo',missileInfantry:'Lançador'}[type]}</span><strong>${t.cost}</strong>`;unitIcon(b.querySelector('canvas').getContext('2d'),type,30,33,TEAM.blue,1);b.addEventListener('click',()=>{if(canCommand()&&game.enqueue('blue',type)){audio.play('click');updateUI();}});$('recruits').append(b);recruitButtons.push(b);}
function togglePause(){if(!started||game.winner||!menusClosed())return;paused=!paused;mode=null;drag=null;lastFrame=performance.now();updateUI();say(game.mode==='rts'?(paused?'Pausa tática. Selecione tropas e emita ordens; P retoma o combate.':'Combate retomado. Tropas e IA agem ao mesmo tempo.'):(paused?'Animações pausadas. P para continuar.':'Animações retomadas. Planeje sem pressa no seu turno.'));}
function endPlayerTurn(){if(!canCommand()||!game.endTurn())return;paused=false;mode=null;drag=null;lastFrame=performance.now();updateUI();say('Turno da IA. Aguarde a próxima rodada.');}
$('endTurn').addEventListener('click',endPlayerTurn);
$('radarCollapse').addEventListener('click',()=>{radarCollapsed=!radarCollapsed;renderer.drawRadar();clampCamera();renderer.drawMini();});
$('radarToggle').addEventListener('click',()=>{if(!started||game.winner||!menusClosed()||game.mode!=='rts'&&game.turn!=='blue')return;const units=selectedUnits().filter(u=>u.type==='antiAirVehicle'),on=units.some(u=>!u.radarOn);for(const u of units)game.setRadar(u,on);updateUI();say(`Radar ${on?'ligado':'desligado'} em ${units.length} antiaérea(s). Contatos da equipe: ${game.radarContacts.blue.size}.`);});
function toggleGrid(){showGrid=!showGrid;changeSetting('grid',showGrid);renderer.dirty=true;updateUI();}
$('grid').addEventListener('click',toggleGrid);
$('pause').addEventListener('click',togglePause);$('speed').addEventListener('click',()=>{const speeds=[.25,.5,1,2];speed=speeds[(speeds.indexOf(speed)+1)%speeds.length];updateUI();});
$('panTool').addEventListener('click',()=>{panTool=!panTool;updateUI();say(panTool?'Câmera ativa: arraste com o botão esquerdo para mover o mapa; clique seleciona. Desative para voltar à seleção em caixa.':'Botão esquerdo volta a selecionar em caixa.');});
$('addSelect').addEventListener('click',()=>{addMode=!addMode;updateUI();say(addMode?'Somar ativo: cliques e caixas adicionam ou removem tropas da seleção.':'Seleção normal.');});
function toggleFullscreen(){if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else document.documentElement.requestFullscreen?.().catch(()=>{});}
$('fullscreen').addEventListener('click',toggleFullscreen);document.addEventListener('fullscreenchange',()=>{const on=!!document.fullscreenElement;$('fullscreen').textContent=on?'Sair da tela cheia':'Tela cheia';$('fullscreen').setAttribute('aria-pressed',String(on));});
$('sound').addEventListener('click',()=>{audio.enabled=!audio.enabled;changeSetting('sound',audio.enabled);if(audio.master)audio.master.gain.value=audio.enabled?.14:0;audio.unlock();$('sound').textContent=audio.enabled?'Som ligado':'Som desligado';$('sound').setAttribute('aria-pressed',String(audio.enabled));});
let overlaid=false,pausedBefore=true,backTo=null;
// Pausa de todos os diálogos: guarda o estado anterior ao primeiro menu e o restaura quando o último fecha.
function syncPause(){const open=!!document.querySelector('dialog[open]');if(open&&!overlaid){overlaid=true;pausedBefore=paused;}if(open)paused=true;else if(overlaid){overlaid=false;paused=started?pausedBefore:true;}lastFrame=performance.now();updateUI();}
function openMenu(id){drag=null;mode=null;$(id).showModal();syncPause();}
function closeMenu(id){$(id).close();syncPause();}
// Fecha um diálogo: volta ao menu inicial se ele veio de lá; senão retoma a partida.
function closeChild(id){$(id).close();if(backTo){backTo=null;openTitle();}else syncPause();}
function leaveTitleFor(fn){if($('titleScreen').open){$('titleScreen').close();backTo='titleScreen';}fn();}
function openTitle(){backTo=null;if(!$('titleScreen').open)openMenu('titleScreen');refreshTitle();$('titlePlay').focus();}
function refreshTitle(){paintTitle();$('titleResume').hidden=!started;const info=campaignSummary();const label=$('titleCampaign').querySelector('span');label.textContent=info?'Continuar campanha':'Campanha';$('titleCampaignInfo').textContent=info||'Mapa-múndi gerado por semente';$('titleProfileInfo').textContent=profileSummary();}
// Fundo do menu: um campo gerado ao acaso, em movimento lento (CSS), sem afetar a partida atual.
function paintTitle(){const maps=Object.keys(MAPS);drawPreview($('titleBg'),new Game(maps[Math.floor(Math.random()*maps.length)],'normal',Math.floor(Math.random()*4294967294)+1,'turns'));}
function setupDescription(){$('setupDescription').textContent=$('modeSelect').value==='rts'?'Tropas e IA agem ao mesmo tempo. Pressione P ou Pausar para congelar o combate, selecionar tropas e preparar ordens. Continue para executá-las.':'Você joga primeiro. Cada tropa tem movimento limitado e uma ação por turno. A IA só age quando você encerra o turno. Planeje sem limite de tempo.';}
$('modeSelect').addEventListener('change',setupDescription);
function setupOptions(){return{water:$('genWater').value/100,forest:$('genForest').value/100,relief:$('genRelief').value/100,farmland:$('genFarmland').value/100,posts:Number($('genPosts').value)};}
function setupPreview(){$('procedural').hidden=$('mapSelect').value!=='random';drawPreview($('preview'),new Game($('mapSelect').value,'normal',Number($('seed').value)||1,'turns',setupOptions()));}
function rerollSeed(){$('seed').value=Math.floor(Math.random()*4294967294)+1;setupPreview();}
for(const id of ['mapSelect','seed','genWater','genForest','genRelief','genFarmland','genPosts'])$(id).addEventListener('input',setupPreview);$('reroll').addEventListener('click',rerollSeed);
function openSetup(){if($('result').open)$('result').close();$('mapSelect').value=game.map;// Primeira operação usa as configurações padrão; depois, repete o modo e a dificuldade da partida anterior.
$('difficulty').value=started?game.difficulty:settings.difficulty;$('modeSelect').value=started?game.mode:settings.mode;setupDescription();rerollSeed();openMenu('setup');}
function newOperation(map,difficulty,seed,battleMode='turns',options){game=new Game(map,difficulty,seed,battleMode,options);selection=new Set();groups=Array.from({length:5},()=>[]);radarCollapsed=null;paused=false;started=true;overlaid=false;backTo=null;speed=settings.speed;mode=null;drag=null;hover=null;marker=null;resultShown=false;lastLog=null;lastFrame=performance.now();if($('result').open)$('result').close();renderer.rebuild();const hq=game.hq('blue');centerCamera(hq.x,hq.y);updateUI();say(game.mode==='rts'?'Combate em tempo real. Pausar congela o combate para selecionar tropas e preparar ordens.':'Seu turno: selecione, mova e ataque. Encerrar turno passa a vez à IA.');}
$('newGame').addEventListener('click',openSetup);$('playAgain').addEventListener('click',openSetup);$('cancelSetup').addEventListener('click',()=>closeChild('setup'));
$('help').addEventListener('click',()=>openMenu('manual'));$('closeHelp').addEventListener('click',()=>closeChild('manual'));
for(const id of ['setup','manual','settings'])$(id).addEventListener('cancel',e=>{e.preventDefault();closeChild(id);});
$('review').addEventListener('click',()=>{$('result').close();updateUI();});
$('setupForm').addEventListener('submit',e=>{e.preventDefault();if(!$('setupForm').reportValidity())return;audio.unlock();const seed=$('seed').value?Number($('seed').value):Math.floor(Math.random()*4294967294)+1;$('setup').close();if(settings.fullscreen&&!document.fullscreenElement)toggleFullscreen();newOperation($('mapSelect').value,$('difficulty').value,seed,$('modeSelect').value,setupOptions());});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!game.winner){paused=true;if(overlaid)pausedBefore=true;drag=null;mode=null;updateUI();say('Operação pausada ao sair da aba. Continue quando estiver pronto.');}lastFrame=performance.now();});
document.addEventListener('keydown',e=>{
 if(e.target.tagName==='BUTTON'&&(e.key==='Enter'||e.key===' '))return;
 if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;const key=e.key.toLowerCase();
 if(/^[1-5]$/.test(key)){e.preventDefault();groupAction(Number(key)-1,e.ctrlKey||e.metaKey);return;}
 if(key==='p'||key===' '&&e.target===renderer.canvas){e.preventDefault();togglePause();return;}if(key==='escape'){mode=null;drag=null;selection.clear();updateUI();return;}
 if(e.ctrlKey||e.metaKey||e.altKey)return;if(key==='g'){e.preventDefault();if(!e.repeat)toggleGrid();}else if(key==='enter'){e.preventDefault();if(!e.repeat)endPlayerTurn();}else if(key==='s'){e.preventDefault();stopSelected();}else if(key==='a'){e.preventDefault();setMode('attackMove');}else if(key==='m')setMode('move');else if(key==='r')setMode('repair');
});
/* Parado (pausa, menus, fim de jogo), o quadro só é redesenhado após uma interação ou a cada 0,25 s. */
for(const type of ['pointerdown','pointermove','pointerup','keydown','click'])document.addEventListener(type,()=>{renderer.dirty=true;},{capture:true,passive:true});
let idleClock=0;
function frame(now){
 const wall=Math.min(.1,Math.max(0,(now-lastFrame)/1000));lastFrame=now;const dt=playable()?wall*speed:0;
 // Rolagem pela borda: 24 px do contorno do campo movem a câmera ~900 px de tela por segundo.
 if(pointer&&!pan&&started&&menusClosed()){const v=renderer.canvas,edge=24,step=900*wall/cam.zoom,dx=pointer.x<edge?-1:pointer.x>v.clientWidth-edge?1:0,dy=pointer.y<edge?-1:pointer.y>v.clientHeight-edge?1:0;
  if(dx||dy){const before=cam.x+','+cam.y;cam.x+=dx*step;cam.y+=dy*step;clampCamera();if(before!==cam.x+','+cam.y){hover=pointerPosition(pointer.client);if(drag)drag.end=hover;renderer.drawMini();}}}
 if(dt){const previousTurn=game.turn;for(let remaining=dt;remaining>1e-8;remaining-=STEP)game.update(Math.min(STEP,remaining));if(previousTurn==='red'&&game.turn==='blue'&&!game.winner)say('Seu turno. Movimento e ações renovados. Enter encerra o turno.');}renderer.consume();idleClock+=wall;
 if(dt||renderer.dirty||idleClock>=.25){renderer.draw(dt);renderer.dirty=false;idleClock=0;}uiClock+=wall;
 if(uiClock>=.12||game.winner&&!resultShown){uiClock=0;updateUI();}requestAnimationFrame(frame);
}
troopAtlas.onload=tankAtlas.onload=tankAtlas.onerror=heliAtlas.onload=heliAtlas.onerror=antiAirAtlas.onload=antiAirAtlas.onerror=highCloud.onload=highCloud.onerror=()=>{
 sprites.clear();portraitKey=null;renderer.dirty=true;
 for(const button of recruitButtons){const c=button.querySelector('canvas').getContext('2d');c.clearRect(0,0,60,60);unitIcon(c,button.dataset.recruit,30,33,TEAM.blue);}
 updateUI();
};
troopAtlas.src=troopAtlasData;
tankAtlas.src=tankAtlasData;
heliAtlas.src=heliAtlasData;
antiAirAtlas.src=antiAirAtlasData;
highCloud.src=highCloudData;
const terrainReady=Promise.all(Object.entries(terrainData).map(([name,src])=>new Promise(resolve=>{const image=terrainImages[name]=new Image();image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=src;}))).then(()=>{clearTerrainCaches();renderer.paintGround();renderer.drawMini();setupPreview();});
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
$('titleScreen').addEventListener('keydown',e=>{if(e.key!=='ArrowDown'&&e.key!=='ArrowUp')return;const items=[...document.querySelectorAll('.title-menu button')].filter(b=>!b.hidden);const i=items.indexOf(document.activeElement);e.preventDefault();items[(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();});
// Configurações: cada alteração vale na hora e fica salva.
function fillSettings(){$('setSound').checked=audio.enabled;$('setGrid').checked=showGrid;$('setFullscreen').checked=settings.fullscreen;$('setSpeed').value=String(settings.speed);$('setDifficulty').value=settings.difficulty;$('setMode').value=settings.mode;$('setGraphics').value=settings.graphics;}
function applySettings(){audio.enabled=settings.sound!==false;if(audio.master)audio.master.gain.value=audio.enabled?.14:0;$('sound').textContent=audio.enabled?'Som ligado':'Som desligado';$('sound').setAttribute('aria-pressed',String(audio.enabled));showGrid=settings.grid===true;fillSettings();}
function openSettings(){fillSettings();openMenu('settings');}
$('setSound').addEventListener('change',()=>{audio.enabled=$('setSound').checked;if(audio.master)audio.master.gain.value=audio.enabled?.14:0;audio.unlock();$('sound').textContent=audio.enabled?'Som ligado':'Som desligado';$('sound').setAttribute('aria-pressed',String(audio.enabled));changeSetting('sound',audio.enabled);});
$('setGrid').addEventListener('change',()=>{showGrid=$('setGrid').checked;renderer.dirty=true;changeSetting('grid',showGrid);updateUI();});
$('setFullscreen').addEventListener('change',()=>changeSetting('fullscreen',$('setFullscreen').checked));
$('setSpeed').addEventListener('change',()=>changeSetting('speed',Number($('setSpeed').value)));
$('setDifficulty').addEventListener('change',()=>changeSetting('difficulty',$('setDifficulty').value));
$('setMode').addEventListener('change',()=>changeSetting('mode',$('setMode').value));
ambientClouds.forEach((image,i)=>{image.onload=()=>{const s=document.createElement('canvas');s.width=image.width;s.height=image.height;const c=s.getContext('2d');c.drawImage(image,0,0);c.globalCompositeOperation='source-in';c.fillStyle='#071c2c';c.fillRect(0,0,s.width,s.height);cloudShadows[i]=s;renderer.dirty=true;};image.onerror=()=>{cloudShadows[i]=null;renderer.dirty=true;};image.src=ambientCloudData[i];});
$('setGraphics').addEventListener('change',()=>{changeSetting('graphics',$('setGraphics').value);renderer.dirty=true;say('Perfil gráfico aplicado: '+$('setGraphics').selectedOptions[0].textContent+'.');});
$('settingsReset').addEventListener('click',()=>{settings={...SETTING_DEFAULTS};saveSettings();applySettings();});
$('settingsBack').addEventListener('click',()=>closeChild('settings'));
applySettings();
