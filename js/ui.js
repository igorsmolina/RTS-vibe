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
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches,audio=new Sound();
let game=new Game(),selection=new Set(),groups=Array.from({length:5},()=>[]),paused=true,started=false,speed=1,mode=null,hover=null,drag=null,marker=null,resultShown=false,addMode=false,panTool=false,pointer=null,pan=null;
let menuWasPaused=true,lastFrame=performance.now(),uiClock=0,lastLog=null;
let showGrid=false;try{showGrid=localStorage.getItem('wargrid.grid.v1')==='true';}catch{}
const renderer=new Renderer();
function selectedUnits(){return [...selection].map(id=>game.get(id)).filter(u=>u&&u.owner==='blue'&&!TYPES[u.type].structure);}
function menusClosed(){return !$('setup').open&&!$('manual').open&&!$('result').open;}
function canCommand(){return started&&!game.winner&&(game.mode==='rts'||game.turn==='blue'&&!game.busy)&&menusClosed();}
function playable(){return started&&!game.winner&&!paused&&menusClosed();}
function say(text){$('hint').textContent=text;}
function timeLabel(value){return game.mode==='rts'?Math.floor(value/60).toString().padStart(2,'0')+':'+Math.floor(value%60).toString().padStart(2,'0'):'Rodada '+value;}
function entityAt(p){const visible=u=>u.owner==='blue'||game.isVisible('blue',u);return game.units.filter(visible).find(u=>Math.hypot(u.x-p.x,u.y-p.y)<.55)||game.structures.filter(visible).find(u=>Math.max(Math.abs(u.x-p.x),Math.abs(u.y-p.y))<.6);}
function setSelection(ids,add=false){if(!add)selection.clear();for(const id of ids)if(game.get(id))selection.add(id);mode=null;updateUI();}
function orderName(u){return u.pending?{move:'Em deslocamento',attack:'Atacando',repair:'Reparando',capture:'Capturando',build:'Construindo',demine:'Desarmando'}[u.order.type]||'Executando ordem':u.entrenched?'Entrincheirada':game.mode==='rts'?'Pronta · fogo automático':u.actionLeft?'Ação disponível':'Ação usada';}
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
  setText('mapTitle',MAPS[game.map]);setText('credits',game.credits.blue);setText('income','+'+game.income('blue'));setText('incomeLabel',rts?'Renda / 10 s':'Renda / turno');setProp('income','title',rts?`+${game.income('blue')} créditos a cada 10 segundos de jogo`:`+${game.income('blue')} créditos no início do seu turno, a partir da rodada 2`);setText('force',game.units.filter(u=>u.owner==='blue').length);
  setText('clock',timeLabel(rts?game.time:game.round));setText('status',game.winner?'Operação encerrada':rts?(paused?'Pausa tática':'Combate em tempo real'):game.turn==='red'?'Turno da IA':game.busy?'Executando ordem':'Seu turno');setText('pause',paused?'Continuar [P]':'Pausar [P]');setProp('pause','disabled',!started||!!game.winner);setAttr('pause','aria-pressed',String(paused));setText('speed',String(speed).replace('.',',')+'×');setProp('pauseOverlay','hidden',!paused||!!game.winner);$('pauseOverlay').classList.toggle('tactical',rts);setText('pauseLabel',rts?'Pausa tática · emita ordens · P para continuar':'Animações pausadas');
  setText('modeTitle',rts?'Fronteiras / RTS':'Fronteiras / Por turnos');setText('keyHint','Bordas, roda, botão do meio ou ✋ + botão esquerdo: câmera · Botão direito: ordem · Botão direito no grupo: atribuir');setAttr('addSelect','aria-pressed',String(addMode));setAttr('panTool','aria-pressed',String(panTool));renderer.canvas.classList.toggle('grab',panTool);setProp('speed','title',rts?'Velocidade do combate: 0,25×, 0,5×, 1× e 2×':'Velocidade das animações: 0,25×, 0,5×, 1× e 2×');setAttr('speed','aria-label',rts?'Alternar velocidade do combate':'Alternar velocidade das animações');setAttr('battlefield','aria-label',(rts?'Campo em tempo real.':'Campo por turnos.')+' Clique ou arraste para selecionar; botão direito emite ordens. Bordas, roda e botão do meio movem a câmera.');setText('stop',rts?'Parar [S]':'Aguardar [S]');
  setProp('endTurn','hidden',rts);setProp('endTurn','disabled',rts||!canCommand());
  setText('difficultyLabel','IA '+{easy:'fácil',normal:'normal',hard:'difícil'}[game.difficulty]);setText('operationInfo',`Semente ${game.seed} · ${COLS} × ${ROWS} casas · Capture postos e destrua o QG inimigo`);setText('explored',Math.round(game.explored.blue.filter(Boolean).length/SIZE*100)+'%');
  const units=selectedUnits(),items=[...selection].map(id=>game.get(id)).filter(Boolean),u=items[0];setText('selectionCount',items.length?items.length+' selecionada(s)':'—');
  const key=u?u.type+u.owner:'';if(key!==portraitKey){portraitKey=key;const portrait=$('portrait').getContext('2d');portrait.clearRect(0,0,108,108);if(u)unitIcon(portrait,u.type,54,59,TEAM[u.owner],1.55);}
  if(u){
   const total=items.reduce((a,b)=>a+b.hp,0),max=items.reduce((a,b)=>a+b.maxHp,0);setWidth('healthBar',total/max);
   setText('unitName',items.length>1?`Grupo de ${items.length} tropas`:TYPES[u.type].name);
   setText('unitRole',items.length>1?[...new Set(items.map(v=>TYPES[v.type].name))].join(', '):rts&&u.type==='engineer'?'Reparo +24 HP por segundo':TYPES[u.type].role||'Estrutura de apoio');
   const t=TYPES[u.type];setText('unitInfo',items.length>1?'Integridade '+Math.ceil(total)+' / '+max+' HP\n'+(rts?units.filter(v=>v.pending).length+' tropas executando ordens':units.filter(v=>v.actionLeft).length+' ações disponíveis · '+units.filter(v=>v.moveLeft>0).length+' tropas com movimento'):Math.ceil(u.hp)+' / '+u.maxHp+' HP · '+TERRAIN[game.terrainAt(u)].name+' · '+Math.round(game.cover(u)*100)+'% defesa\n'+(t.structure?(u.type==='hq'?'Treinamento serial · até 5 tropas':rts?'Renda +8 / 10 s':'Renda +8 por turno'):(rts?'Velocidade '+String(t.speed).replace('.',',')+' casas/s':'Movimento '+u.moveLeft+' / '+t.move)+' · Alcance '+t.min+'–'+game.range(u)+'\n'+'★'.repeat(u.level)+' '+orderName(u)+(game.hasAura(u)?' · Aura ativa':'')));
  }else{setText('unitName','Nenhuma unidade');setText('unitRole','Clique ou arraste no campo.');setText('unitInfo',rts?'Botão direito: ordem. Pausar congela o combate para dar ordens.':'Botão direito: ordem. Encerrar turno passa a vez à IA.');setWidth('healthBar',0);}
  const can=canCommand()&&units.length>0;setProp('move','disabled',!can||!rts&&!units.some(u=>u.moveLeft>0&&(u.type!=='artillery'||u.actionLeft||u.moved)));setProp('attackMove','disabled',!can||!rts&&!units.some(u=>u.actionLeft));setProp('stop','disabled',!can||!rts&&!units.some(u=>u.moveLeft>0||u.actionLeft));
  const noEngineer=!can||!units.some(u=>u.type==='engineer'&&(rts||u.actionLeft));setProp('repair','disabled',noEngineer);setProp('demine','disabled',noEngineer);setProp('build','disabled',!can||!units.some(u=>game.canBuild(u)));
  for(const id of ['move','attackMove','repair','demine'])setAttr(id,'aria-pressed',String(mode===(id==='attackMove'?'attack':id)));setText('modeLabel',mode?{move:'Escolha o destino',attack:'Escolha um inimigo',repair:'Escolha um aliado',demine:'Escolha uma mina'}[mode]:'Contextual');
  const hq=game.hq('blue'),queue=hq?.queue||[],job=queue[0];setText('queueCount',`${queue.length} / 5`);
  for(const button of recruitButtons){const type=button.dataset.recruit,t=TYPES[type],duration=game.trainDuration(type)+(rts?' s':' turno(s)');setProp(button,'disabled',!canCommand()||!hq||queue.length>=5||game.credits.blue<t.cost);setProp(button,'title',`${t.name} · ${t.cost} créditos · ${duration} · ${t.role}`);if(button.getAttribute('aria-label')!==`Treinar ${t.name}, ${t.cost} créditos, ${duration}`)button.setAttribute('aria-label',`Treinar ${t.name}, ${t.cost} créditos, ${duration}`);}
  const duration=job?game.trainDuration(job.type):1;setWidth('productionBar',job?job.progress/duration:0);setText('queueStatus',!hq?'QG destruído.':job?job.progress>=duration?'Saída bloqueada. Afaste as tropas do QG.':`${TYPES[job.type].name} · ${Math.ceil(duration-job.progress)} ${rts?'s':'turno(s)'} restantes`:'Linha de produção livre.');
  setText('queue',queue.slice(1).map(q=>TYPES[q.type].name).join(' → '));
  for(let i=0;i<5;i++){$('group'+i).classList.toggle('filled',groups[i].length>0);setProp('group'+i,'title',`Grupo ${i+1}: ${groups[i].length} tropas. Clique seleciona; botão direito atribui.`);}
  if(game.logs[0]!==lastLog){lastLog=game.logs[0];$('log').replaceChildren(...game.logs.map(e=>{const div=document.createElement('div');div.className='log-line';const time=document.createElement('small');time.textContent=timeLabel(e.time);div.append(time,document.createTextNode(e.text));return div;}));}
  renderer.drawMini();
  if(game.winner&&!resultShown){resultShown=true;paused=true;audio.play(game.winner==='blue'?'victory':'defeat');$('resultTitle').textContent=game.winner==='blue'?'Vitória da Nação Azul':game.winner==='draw'?'Cessar-fogo':'Operação perdida';$('resultText').textContent=`Operação encerrada ${rts?'aos '+timeLabel(game.time):'na rodada '+game.round}. ${game.winner==='blue'?'O comando inimigo foi neutralizado.':'Reorganize suas forças e tente uma nova operação.'}`;$('result').showModal();}
}
function issueAt(p,forced=mode){
 if(!canCommand()){say(game.mode==='rts'?'Feche o menu para emitir ordens.':'Aguarde o seu turno e a conclusão da ordem atual.');return;}const units=selectedUnits();if(!units.length){say('Selecione suas tropas primeiro.');return;}
 const cell=TILE(p);if(!INSIDE(cell.x,cell.y))return;const target=entityAt(p);let type=forced,args={x:cell.x,y:cell.y};
 if(!type){if(target?.type==='post'&&target.owner!=='blue'&&units.some(u=>u.type==='infantry'))type='capture';else if(target&&target.owner==='red')type='attack';else if(target?.owner==='blue'&&units.some(u=>u.type==='engineer')&&target.hp<target.maxHp)type='repair';else type='move';}
 if(['attack','capture','repair'].includes(type)){if(!target){say('Escolha um alvo válido para essa ordem.');return;}args={targetId:target.id};}
 const n=game.command(units.map(u=>u.id),type,args);
 if(n){marker={x:cell.x,y:cell.y,t:0,color:type==='attack'||type==='attackMove'?'#f9b09a':'#b8e5e6'};audio.play('click');say(`${paused?(game.mode==='rts'?'Pausa tática: ordem preparada. P para executar. ':'Animações pausadas: pressione P para executar. '):''}${n} unidade(s): ${{move:'mover',attackMove:'atacar-mover',attack:'atacar',capture:'capturar posto',repair:'reparar',demine:'desarmar mina'}[type]}.`);mode=null;}
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
 if(box.active){const x1=Math.min(box.start.x,box.end.x),x2=Math.max(box.start.x,box.end.x),y1=Math.min(box.start.y,box.end.y),y2=Math.max(box.start.y,box.end.y);setSelection(game.units.filter(u=>u.owner==='blue'&&u.x>=x1&&u.x<=x2&&u.y>=y1&&u.y<=y2).map(u=>u.id),box.shift);say(`${selectedUnits().length} tropas selecionadas.`);}
 else{const u=entityAt(pointerPosition(e));if(box.shift&&u?.owner==='blue'){if(selection.has(u.id))selection.delete(u.id);else selection.add(u.id);updateUI();}else setSelection(u?[u.id]:[]);}
});
renderer.canvas.addEventListener('pointercancel',()=>{drag=null;pan=null;});renderer.canvas.addEventListener('pointerleave',()=>{pointer=null;if(!drag)hover=null;});window.addEventListener('blur',()=>{drag=null;pan=null;pointer=null;});
renderer.canvas.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault();});
renderer.canvas.addEventListener('wheel',e=>{e.preventDefault();const r=renderer.canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top,wx=cam.x+mx/cam.zoom,wy=cam.y+my/cam.zoom;cam.zoom*=e.deltaY<0?1.15:1/1.15;clampCamera();cam.x=wx-mx/cam.zoom;cam.y=wy-my/cam.zoom;clampCamera();renderer.drawMini();hover=pointerPosition(e);},{passive:false});
new ResizeObserver(()=>{const v=renderer.canvas,dpr=devicePixelRatio||1;v.width=Math.max(1,Math.round(v.clientWidth*dpr));v.height=Math.max(1,Math.round(v.clientHeight*dpr));clampCamera();renderer.draw(0);renderer.drawMini();}).observe(renderer.canvas);
$('minimap').addEventListener('contextmenu',e=>{e.preventDefault();issueAt(pointerPosition(e,$('minimap')));});
function miniPan(e){if(e.buttons!==1||mode)return;const p=pointerPosition(e,$('minimap'));centerCamera(p.x,p.y);renderer.drawMini();}
$('minimap').addEventListener('pointerdown',e=>{if(e.button!==0)return;if(mode){issueAt(pointerPosition(e,$('minimap')));return;}$('minimap').setPointerCapture(e.pointerId);miniPan(e);});$('minimap').addEventListener('pointermove',miniPan);
function setMode(next){if(!canCommand()||!selectedUnits().length)return;if(mode===(next==='attackMove'?'attack':next)){mode=null;updateUI();say('Ordem cancelada.');return;}mode=next==='attackMove'?'attack':next;updateUI();say(next==='repair'?(game.mode==='rts'?'Clique em um aliado para reparar até 24 HP por segundo.':'Clique em um aliado para reparar até 24 HP com uma ação.'):next==='demine'?'Clique em uma mina detectada.':'Clique no destino ou use o botão direito.');}
for(const id of ['move','attackMove','repair','demine'])$(id).addEventListener('click',()=>setMode(id));
function stopSelected(){if(!canCommand())return;game.command(selectedUnits().map(u=>u.id),'stop');mode=null;updateUI();say(game.mode==='rts'?'Ordem cancelada. As tropas param ao chegar à próxima casa.':'Tropas aguardando. Movimento e ação encerrados; trincheira ativa.');}
$('stop').addEventListener('click',stopSelected);$('build').addEventListener('click',()=>{if(!canCommand())return;const count=game.command(selectedUnits().map(u=>u.id),'build');say(count?`${count} posto(s) ordenado(s). A infantaria será convertida em guarnição.`:'Escolha infantaria parada, com espaço para um posto.');updateUI();});
function groupAction(i,assign){if(assign){groups[i]=selectedUnits().map(u=>u.id);say(`Grupo ${i+1}: ${groups[i].length} tropas atribuídas.`);}else{setSelection(groups[i].filter(id=>game.get(id)));say(`Grupo ${i+1} selecionado.`);}updateUI();}
for(let i=0;i<5;i++){const b=document.createElement('button');b.id='group'+i;b.textContent=i+1;b.addEventListener('click',e=>groupAction(i,e.ctrlKey||e.metaKey));b.addEventListener('contextmenu',e=>{e.preventDefault();groupAction(i,true);});$('groups').append(b);}
for(const type of ['infantry','recon','engineer','artillery','lightTank','tank','heavyTank','antitank','machinegun']){const t=TYPES[type],b=document.createElement('button');b.className='recruit';b.dataset.recruit=type;b.setAttribute('aria-label',`Treinar ${t.name}, ${t.cost} créditos, ${t.train} turno(s)`);b.title=`${t.name} · ${t.cost} créditos · ${t.train} turno(s) · ${t.role}`;b.innerHTML=`<canvas width="60" height="60" aria-hidden="true"></canvas><span>${{infantry:'Infant.',recon:'Batedor',engineer:'Engenh.',artillery:'Artilh.',lightTank:'Leve',tank:'Médio',heavyTank:'Pesado',antitank:'Antitanque',machinegun:'Metralh.'}[type]}</span><strong>${t.cost}</strong>`;unitIcon(b.querySelector('canvas').getContext('2d'),type,30,33,TEAM.blue,1);b.addEventListener('click',()=>{if(canCommand()&&game.enqueue('blue',type)){audio.play('click');updateUI();}});$('recruits').append(b);recruitButtons.push(b);}
function togglePause(){if(!started||game.winner||!menusClosed())return;paused=!paused;mode=null;drag=null;lastFrame=performance.now();updateUI();say(game.mode==='rts'?(paused?'Pausa tática. Selecione tropas e emita ordens; P retoma o combate.':'Combate retomado. Tropas e IA agem ao mesmo tempo.'):(paused?'Animações pausadas. P para continuar.':'Animações retomadas. Planeje sem pressa no seu turno.'));}
function endPlayerTurn(){if(!canCommand()||!game.endTurn())return;paused=false;mode=null;drag=null;lastFrame=performance.now();updateUI();say('Turno da IA. Aguarde a próxima rodada.');}
$('endTurn').addEventListener('click',endPlayerTurn);
function toggleGrid(){showGrid=!showGrid;try{localStorage.setItem('wargrid.grid.v1',String(showGrid));}catch{}renderer.dirty=true;updateUI();}
$('grid').addEventListener('click',toggleGrid);
$('pause').addEventListener('click',togglePause);$('speed').addEventListener('click',()=>{const speeds=[.25,.5,1,2];speed=speeds[(speeds.indexOf(speed)+1)%speeds.length];updateUI();});
$('panTool').addEventListener('click',()=>{panTool=!panTool;updateUI();say(panTool?'Câmera ativa: arraste com o botão esquerdo para mover o mapa; clique seleciona. Desative para voltar à seleção em caixa.':'Botão esquerdo volta a selecionar em caixa.');});
$('addSelect').addEventListener('click',()=>{addMode=!addMode;updateUI();say(addMode?'Somar ativo: cliques e caixas adicionam ou removem tropas da seleção.':'Seleção normal.');});
function toggleFullscreen(){if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else document.documentElement.requestFullscreen?.().catch(()=>{});}
$('fullscreen').addEventListener('click',toggleFullscreen);document.addEventListener('fullscreenchange',()=>{const on=!!document.fullscreenElement;$('fullscreen').textContent=on?'Sair da tela cheia':'Tela cheia';$('fullscreen').setAttribute('aria-pressed',String(on));});
$('sound').addEventListener('click',()=>{audio.enabled=!audio.enabled;if(audio.master)audio.master.gain.value=audio.enabled?.14:0;audio.unlock();$('sound').textContent=audio.enabled?'Som ligado':'Som desligado';$('sound').setAttribute('aria-pressed',String(audio.enabled));});
function openMenu(id){menuWasPaused=paused;paused=true;drag=null;mode=null;$(id).showModal();updateUI();}
function closeMenu(id){$(id).close();paused=started?menuWasPaused:true;lastFrame=performance.now();updateUI();}
function setupDescription(){$('setupDescription').textContent=$('modeSelect').value==='rts'?'Tropas e IA agem ao mesmo tempo. Pressione P ou Pausar para congelar o combate, selecionar tropas e preparar ordens. Continue para executá-las.':'Você joga primeiro. Cada tropa tem movimento limitado e uma ação por turno. A IA só age quando você encerra o turno. Planeje sem limite de tempo.';}
$('modeSelect').addEventListener('change',setupDescription);
function setupOptions(){return{water:$('genWater').value/100,forest:$('genForest').value/100,mountain:$('genMountain').value/100,posts:Number($('genPosts').value)};}
function setupPreview(){$('procedural').hidden=$('mapSelect').value!=='random';drawPreview($('preview'),new Game($('mapSelect').value,'normal',Number($('seed').value)||1,'turns',setupOptions()));}
function rerollSeed(){$('seed').value=Math.floor(Math.random()*4294967294)+1;setupPreview();}
for(const id of ['mapSelect','seed','genWater','genForest','genMountain','genPosts'])$(id).addEventListener('input',setupPreview);$('reroll').addEventListener('click',rerollSeed);
function openSetup(){if($('result').open)$('result').close();$('mapSelect').value=game.map;$('difficulty').value=game.difficulty;$('modeSelect').value=game.mode;setupDescription();rerollSeed();$('cancelSetup').hidden=!started;openMenu('setup');}
function newOperation(map,difficulty,seed,battleMode='turns',options){game=new Game(map,difficulty,seed,battleMode,options);selection=new Set();groups=Array.from({length:5},()=>[]);paused=false;started=true;mode=null;drag=null;hover=null;marker=null;resultShown=false;lastLog=null;lastFrame=performance.now();if($('result').open)$('result').close();renderer.rebuild();const hq=game.hq('blue');centerCamera(hq.x,hq.y);updateUI();say(game.mode==='rts'?'Combate em tempo real. Pausar congela o combate para selecionar tropas e preparar ordens.':'Seu turno: selecione, mova e ataque. Encerrar turno passa a vez à IA.');}
$('newGame').addEventListener('click',openSetup);$('playAgain').addEventListener('click',openSetup);$('cancelSetup').addEventListener('click',()=>closeMenu('setup'));
$('help').addEventListener('click',()=>openMenu('manual'));$('closeHelp').addEventListener('click',()=>closeMenu('manual'));
for(const id of ['setup','manual'])$(id).addEventListener('cancel',e=>{e.preventDefault();if(started||id==='manual')closeMenu(id);});
$('review').addEventListener('click',()=>{$('result').close();updateUI();});
$('setupForm').addEventListener('submit',e=>{e.preventDefault();if(!$('setupForm').reportValidity())return;audio.unlock();const seed=$('seed').value?Number($('seed').value):Math.floor(Math.random()*4294967294)+1;$('setup').close();if(!document.fullscreenElement)toggleFullscreen();newOperation($('mapSelect').value,$('difficulty').value,seed,$('modeSelect').value,setupOptions());});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!game.winner){paused=true;menuWasPaused=true;drag=null;mode=null;updateUI();say('Operação pausada ao sair da aba. Continue quando estiver pronto.');}lastFrame=performance.now();});
document.addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||$('setup').open||$('manual').open||$('result').open)return;const key=e.key.toLowerCase();
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
troopAtlas.onload=tankAtlas.onload=tankAtlas.onerror=()=>{
 sprites.clear();portraitKey=null;renderer.dirty=true;
 for(const button of recruitButtons){const c=button.querySelector('canvas').getContext('2d');c.clearRect(0,0,60,60);unitIcon(c,button.dataset.recruit,30,33,TEAM.blue);}
 updateUI();
};
troopAtlas.src=troopAtlasData;
tankAtlas.src=tankAtlasData;
const terrainReady=Promise.all(Object.entries(terrainData).map(([name,src])=>new Promise(resolve=>{const image=terrainImages[name]=new Image();image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=src;}))).then(()=>{clearTerrainCaches();renderer.paintGround();renderer.drawMini();setupPreview();});
updateUI();openSetup();requestAnimationFrame(frame);
