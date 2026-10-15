'use strict';
// Optional public address for the static/offline copy. The hosted server uses its own origin.
window.RTS_MULTIPLAYER_URL='https://rts-vibe-multiplayer.onrender.com';
// Servidor hospedado num PC (scripts/host-local.cjs): o link muda a cada vez, então o host o publica neste tópico do ntfy.sh e a página lê daqui.
// Qualquer um que conheça o tópico pode publicar; por isso só links https://*.trycloudflare.com são aceitos. Vazio = usa só o endereço acima.
window.RTS_SERVER_REGISTRY='https://ntfy.sh/rts-vibe-b760a287e42ddf70';
const Multiplayer={
 session:null,room:null,socket:null,connected:false,editingArmy:false,seq:0,pending:new Map(),matchId:null,lastEvent:0,retry:0,timer:null,poses:new Map(),receivedAt:0,
 get side(){return this.session?.side||'blue';},
 canAct(){return this.connected&&this.room?.status==='playing'&&!game.paused&&!game.winner;},
 status(text){if(this.statusText===text)return;this.statusText=text;$('mpStatus').textContent=text;$('networkStatus').textContent=text;},
 async open(){
  if(this.session){this.show();return;}
  if(location.protocol==='file:'){this.openRemote();return;}
  try{const response=await fetch('/health',{signal:AbortSignal.timeout(6000)}),data=await response.json();if(!response.ok||data.multiplayer!==true){this.openRemote();return;}}
  catch{this.openRemote();return;}
  this.show();
 },
 // Link atual do servidor do host: texto https://... (ligado), null (desligado ou sem sinal há 10 min) ou undefined (não consegui consultar).
 async liveServer(){
  try{
   const response=await fetch(window.RTS_SERVER_REGISTRY+'/json?poll=1&since=12h',{signal:AbortSignal.timeout(6000)});if(!response.ok)return undefined;
   const last=(await response.text()).split(String.fromCharCode(10)).filter(Boolean).map(line=>JSON.parse(line)).filter(e=>e.event==='message').at(-1);if(!last)return null;
   const data=JSON.parse(last.message);
   return data.state==='on'&&Date.now()/1000-last.time<600&&new RegExp('^https://[a-z0-9-]+[.]trycloudflare[.]com$').test(data.url)?data.url:null;
  }catch{return undefined;}
 },
 // Na página hospedada fora do servidor (Vercel, arquivo local) mostra no botão se o servidor do host está ligado.
 async serverInfo(){
  if(!window.RTS_SERVER_REGISTRY||!$('titleMultiplayer'))return;
  if(location.protocol!=='file:'){try{const data=await (await fetch('/health',{signal:AbortSignal.timeout(6000)})).json();if(data.multiplayer===true)return;}catch{}}
  const live=await this.liveServer(),label=$('titleMultiplayer').querySelector('small');
  if(label)label.textContent=live?'servidor ligado · toque para entrar':live===null?'servidor desligado (o host precisa ligar)':'salas privadas por código';
 },
 async openRemote(){
  if(window.RTS_SERVER_REGISTRY){
   this.show();$('mpCreate').disabled=$('mpJoin').disabled=true;this.status('Procurando o servidor do host…');
   const live=await this.liveServer();
   if(live){const room=new URLSearchParams(location.search).get('room'),target=new URL(live);target.searchParams.set('multiplayer','1');if(room)target.searchParams.set('room',room);location.assign(target.href);return;}
   this.status(live===null?'Servidor desligado. Peça ao host para abrir o "Hospedar multiplayer.bat" e tente de novo.':'Não consegui consultar o servidor agora. Feche e abra o Multiplayer de novo em instantes.');return;
  }
  let url;try{url=new URL(window.RTS_MULTIPLAYER_URL);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error();}catch{}
  if(url&&url.origin!==location.origin){const room=new URLSearchParams(location.search).get('room');url.searchParams.set('multiplayer','1');if(room)url.searchParams.set('room',room);location.assign(url.href);return;}
  this.show();$('mpCreate').disabled=$('mpJoin').disabled=true;this.status('Abra a versão online para jogar pela internet. O endereço do servidor ainda não foi configurado nesta cópia.');
 },
 show(){
  if($('titleScreen').open)$('titleScreen').close();backTo=null;if(!$('multiplayer').open)openMenu('multiplayer');this.renderRoom();$('mpNickname').focus();
 },
 async enter(join=false){
  if(!$('mpNickname').reportValidity()||join&&!$('mpCode').reportValidity())return;
  if(join&&!$('mpCode').value.trim()){this.status('Informe o código da sala.');$('mpCode').focus();return;}
  $('mpCreate').disabled=$('mpJoin').disabled=true;this.status('Conectando ao servidor…');
  try{
   const code=$('mpCode').value.trim().toUpperCase(),response=await fetch(join?'/api/rooms/'+encodeURIComponent(code)+'/join':'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:$('mpNickname').value.trim(),...(!join?{config:this.config()}:{} )}),signal:AbortSignal.timeout(15000)}),data=await response.json();
   if(!response.ok)throw Error(data.error||'Não foi possível entrar na sala.');
   this.session={code:data.code,token:data.token,side:data.side,nickname:$('mpNickname').value.trim()};this.seq=0;this.pending.clear();this.persist();this.connect();
  }catch(error){this.status(error.message);$('mpCreate').disabled=$('mpJoin').disabled=false;}
 },
 persist(){try{sessionStorage.setItem('rtsvibe.multiplayer',JSON.stringify({...this.session,seq:this.seq}));}catch{}},
 connect(){
  if(!this.session)return;clearTimeout(this.timer);const socket=this.socket=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/multiplayer');
  socket.addEventListener('open',()=>socket.send(JSON.stringify({type:'auth',code:this.session.code,token:this.session.token,version:1})));
  socket.addEventListener('message',event=>{if(socket!==this.socket)return;try{this.receive(JSON.parse(event.data));}catch(error){console.error('Multiplayer:',error);this.status('Não foi possível atualizar a partida.');}});
  socket.addEventListener('error',()=>this.status('Conexão interrompida. Tentando reconectar…'));
  socket.addEventListener('close',event=>{if(socket!==this.socket||!this.session)return;if(event.reason==='Sessão retomada em outra aba'){this.expired('Sua sessão foi retomada em outra aba.');return;}this.connected=false;if(game.multiplayer){game.paused=true;paused=true;renderer.dirty=true;updateUI();}this.status('Conexão interrompida. Tentando reconectar por até dois minutos…');if(!this.retrySince)this.retrySince=Date.now();if(Date.now()-this.retrySince>=120000){this.expired('Prazo de reconexão encerrado.');return;}this.timer=setTimeout(()=>this.connect(),Math.min(8000,500*2**Math.min(4,this.retry++)));});
 },
 send(message){if(this.socket?.readyState!==WebSocket.OPEN)return false;this.socket.send(JSON.stringify(message));return true;},
 command(action,args){if(!this.canAct())return false;const message={type:'command',seq:++this.seq,action,args};this.pending.set(message.seq,message);this.persist();return this.send(message);},
 receive(message){
  if(message.type==='room'){
   const first=!this.room,rematch=this.room?.status==='finished'&&message.room.status==='waiting';this.connected=true;this.retry=0;this.retrySince=0;this.room=message.room;
   if(rematch){this.seq=0;this.pending.clear();}
   const me=this.room.players.find(p=>p.token===this.session.token)||this.room.players.find(p=>p.side===this.session.side)||this.room.players.find(p=>p.nickname===$('mpNickname').value.trim());
   // Side is sent separately on auth/rematch; player seat stays fixed while teams swap.
   if(message.side)this.session.side=message.side;else if(this.room.players.some(p=>p.self))this.session.side=this.room.players.find(p=>p.self).side;
   if(me&&first&&this.room.status==='waiting'&&!me.ready)this.send({type:'prepare',army:cleanStartingArmy(settings.startingArmy,this.side),doctrine:settings.doctrine});
   this.persist();this.renderRoom();if(first){for(const queued of this.pending.values())this.send(queued);}return;
  }
  if(message.type==='authenticated'||message.type==='auth'){if(message.side)this.session.side=message.side;this.connected=true;this.retry=0;this.retrySince=0;if(Number.isInteger(message.lastSeq)){this.seq=message.lastSeq;for(const [seq,queued]of this.pending){if(seq<=message.lastSeq)this.pending.delete(seq);else{this.seq=Math.max(this.seq,seq);this.send(queued);}}}this.persist();return;}
  if(message.type==='state'){this.connected=true;this.retry=0;this.retrySince=0;if(message.side)this.session.side=message.side;this.persist();this.applyState(message);return;}
  if(message.type==='ack'){this.pending.delete(message.seq);if(message.ok===false){this.status(message.message||'Ação indisponível.');say(message.message||'Ação indisponível.');}return;}
  if(message.type==='error'){if(message.seq)this.pending.delete(message.seq);this.status(message.error||message.message||'Ação indisponível.');if(message.fatal||['room_missing','auth','ROOM_NOT_FOUND','INVALID_SESSION'].includes(message.code))this.expired(message.error||'Sala indisponível. O servidor pode ter sido reiniciado.');return;}
  if(message.type==='result'){const reason={abandonment:'Partida encerrada por abandono do adversário.',disconnected:'Partida cancelada: os dois jogadores perderam a conexão.',host_left:'Sala encerrada pelo anfitrião.',victory:'Partida encerrada.'}[message.reason]||'Partida encerrada.';if(game.multiplayer){game.winner=message.winner||'cancelled';updateUI();$('resultText').textContent=reason;}this.status(reason);return;}
  if(message.type==='closed'||message.type==='expired')this.expired(message.reason||'Sala indisponível. O servidor pode ter sido reiniciado.');
 },
 config(){return {map:$('mpMap').value,mode:$('mpMode').value,seed:Number($('mpSeed').value)||1,options:{water:Number($('mpWater').value)/100,forest:Number($('mpForest').value)/100,relief:Number($('mpRelief').value)/100,farmland:Number($('mpFarmland').value)/100,posts:Number($('mpPosts').value)}};},
 configure(){if(this.room&&this.room.status==='waiting'&&this.side===this.room.hostSide)this.send({type:'configure',config:this.config()});},
 prepare(){const me=this.room?.players.find(p=>p.side===this.side);this.send({type:'prepare',doctrine:$('mpDoctrine').value,army:me?.army||cleanStartingArmy(settings.startingArmy,this.side)});},
 editArmy(){if(!this.session)return;this.editingArmy=true;const me=this.room.players.find(p=>p.side===this.side);fillArmyEditor(me?.army||cleanStartingArmy(settings.startingArmy,this.side),this.side);openMenu('armyEditor');},
 saveArmy(army){this.send({type:'prepare',army,doctrine:$('mpDoctrine').value});this.editingArmy=false;},
 ready(){const me=this.room?.players.find(p=>p.side===this.side);this.send({type:'ready',ready:!me?.ready});},
 rematch(){if(!this.session)return;if($('result').open)$('result').close();this.send({type:'rematch'});this.show();this.status('Revanche solicitada. Aguardando o adversário; as equipes serão trocadas.');},
 leave(show=true){
  this.send({type:'leave'});this.session=null;this.connected=false;this.room=null;this.pending.clear();this.poses.clear();this.matchId=null;this.retrySince=0;clearTimeout(this.timer);const socket=this.socket;this.socket=null;socket?.close();try{sessionStorage.removeItem('rtsvibe.multiplayer');}catch{}
  $('networkStatus').hidden=true;$('mpCreate').disabled=$('mpJoin').disabled=false;this.editingArmy=false;if(game.multiplayer){game.multiplayer=false;game.playerSide='blue';paused=true;started=false;selection.clear();updateUI();}if($('multiplayer').open)closeMenu('multiplayer');if(show)openTitle();
 },
 expired(reason){this.leave(false);this.show();this.status(reason);},
 renderRoom(){
  const room=this.room,waiting=room?.status==='waiting',host=!room||this.side===room.hostSide;
  $('mpEntry').hidden=!!room;$('mpRoom').hidden=!room;$('mpConfiguration').disabled=!!room&&(!waiting||!host);$('mpFormation').hidden=!room;
  $('mpCodeLabel').textContent=room?.code||'';$('mpOwnSide').textContent=this.side==='blue'?'Equipe azul':'Equipe vermelha';
  if(room){const config=room.config;for(const [id,value]of [['mpMap',config.map],['mpMode',config.mode],['mpSeed',config.seed],['mpWater',config.options.water*100],['mpForest',config.options.forest*100],['mpRelief',config.options.relief*100],['mpFarmland',config.options.farmland*100],['mpPosts',config.options.posts]])if(document.activeElement!==$(id))$(id).value=String(value);
   const me=room.players.find(p=>p.side===this.side);if(me){$('mpDoctrine').value=me.doctrine;$('mpArmySummary').textContent=armyCost(me.army||{})+' / 600 pontos';$('mpReady').textContent=me.ready?'Cancelar pronto':'Estou pronto';$('mpReady').setAttribute('aria-pressed',String(me.ready));}
   $('mpPlayers').replaceChildren(...room.players.map(p=>{const item=document.createElement('li');item.textContent=p.nickname+' · '+(p.side==='blue'?'Azul':'Vermelho')+' · '+(!p.connected?'Desconectado':p.ready?'Pronto':'Preparando');return item;}));
   $('mpStart').hidden=!host;$('mpStart').disabled=!waiting||room.players.length!==2||!room.players.every(p=>p.ready&&p.connected);$('mpReady').disabled=!waiting||!this.connected;$('mpDoctrine').disabled=$('mpArmy').disabled=!waiting;
   $('mpRematch').hidden=!['finished','cancelled'].includes(room.status);$('mpResume').hidden=room.status!=='playing';$('mpLeave').textContent=room.status==='playing'?'Desistir e sair da sala':'Sair da sala';
   if(waiting)this.status('Sala '+room.code+' · compartilhe o código com seu amigo.');else if(room.paused)this.status('Partida suspensa · aguardando reconexão.');else if(room.status==='playing')this.status('Partida em andamento · '+(this.side==='blue'?'Azul':'Vermelho'));else this.status('Partida encerrada.');
  }
  $('mpTerrain').hidden=$('mpMap').value!=='random';$('networkStatus').hidden=!game.multiplayer;
 },
 replica(){
  const view=Object.create(Game.prototype);Object.defineProperty(view,'busy',{get(){return !!this.networkBusy;}});
  view.command=(ids,type,args={})=>this.command('order',{ids,type,args})?ids.length:0;
  view.order=(u,type,args={})=>!!u&&this.command('order',{ids:[u.id],type,args});
  view.enqueue=(owner,type,base)=>!!base&&this.command('enqueue',{type,baseId:base.id});view.endTurn=()=>this.command('endTurn',{});
  view.setWeapon=(u,weapon)=>!!u&&this.command('setWeapon',{id:u.id,weapon});view.setRadar=(u,on)=>!!u&&this.command('setRadar',{id:u.id,on});
  view.buildAirport=(ids,cell)=>this.command('buildAirport',{ids,cell});view.assignAirportWorkers=(site,ids)=>!!site&&this.command('assignAirportWorkers',{siteId:site.id,ids});
  view.servicePlane=u=>!!u&&this.command('servicePlane',{id:u.id});
  view.requestAirdrop=(owner,baseId,cargo,destination)=>this.command('requestAirdrop',{baseId,cargo,destination});
  view.boardPurchase=(owner,baseId,type)=>this.command('boardPurchase',{baseId,type});
  view.update=()=>{};view.log=()=>{};return view;
 },
 // Máscara de casas (bits em base64) para vetor de booleanos; o vetor anterior é reaproveitado enquanto o texto não muda.
 mask(key,side,bits){
  const slot=(this.masks||={})[key+side]||=({bits:undefined,cells:null});
  if(slot.cells&&slot.bits===bits)return slot.cells;
  slot.bits=bits;if(typeof bits!=='string')return slot.cells=bits||Array(SIZE).fill(false);
  const packed=atob(bits),cells=Array(SIZE).fill(false);
  for(let i=0;i<packed.length;i++){const byte=packed.charCodeAt(i);if(byte)for(let b=0;b<8;b++)if(byte&(1<<b))cells[i*8+b]=true;}
  return slot.cells=cells;
 },
 applyState(message){
  // Só a pose visual anterior (x, y, direção, altitude) importa para interpolar; não copiar as unidades inteiras.
  const snap=u=>{const r=u._renderPose;return r?{x:r.x,y:r.y,facing:r.facing||0,_flightLevel:r._flightLevel}:{x:u.x,y:u.y,facing:u.facing||0,_flightLevel:flightLevel(u)};};
  const fresh=!game.multiplayer||this.matchId!==message.matchId,previous=game.multiplayer?new Map(game.units.map(u=>[u.id,snap(u)])):new Map(),state=message.state;
  if(fresh){if(this.session.matchId!==message.matchId){this.seq=0;this.pending.clear();}this.session.matchId=message.matchId;this.persist();game=this.replica();this.lastEvent=0;this.poses.clear();this.matchId=message.matchId;selection.clear();groups=Array.from({length:5},()=>[]);mode=null;drag=null;hover=null;bombLineStart=null;marker=null;resultShown=false;lastLog=null;radarCollapsed=null;productionBaseId=null;productionCollapsed=false;if(typeof endTutorial==='function')endTutorial(false);if(typeof campaignBattle!=='undefined')campaignBattle=null;}
  const events=(state.events||[]).filter(e=>(e.seq||0)>this.lastEvent);for(const e of state.events||[])this.lastEvent=Math.max(this.lastEvent,e.seq||0);
  const terrainChanged=!fresh&&state.terrain&&state.terrainRevision!==game.terrainRevision;
  Object.assign(game,state,{playerSide:message.side,multiplayer:true,networkClient:true,events});
  for(const key of ['visible','sky','explored']){const source=state[key]||{};game[key]={};for(const side of ['blue','red'])game[key][side]=this.mask(key,side,source[side]);}
  for(const key of ['memory']){game[key]={};for(const side of ['blue','red'])game[key][side]=new Map(state[key]?.[side]||[]);}game.radarContacts={};for(const side of ['blue','red'])game.radarContacts[side]=new Set(state.radarContacts?.[side]||[]);game.intel=new Map();game.claims=new Set();game.actions||=[];game.projectiles||=[];game.fires||=[];game.mines||=[];game.logs||=[];
  this.receivedAt=performance.now();this.poses.clear();for(const u of game.units){const prev=previous.get(u.id);if(prev&&Math.hypot(u.x-prev.x,u.y-prev.y)<8)this.poses.set(u.id,{from:prev,to:{x:u.x,y:u.y,facing:u.facing||0,_flightLevel:flightLevel(u)}});}
  started=true;paused=!!game.paused||!!game.winner;speed=1;overlaid=false;backTo=null;
  if(fresh){for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();renderer.rebuild();const base=game.hq(this.side);if(base){const p=CENTER(base);centerCamera(p.x,p.y);}for(const button of recruitButtons){const c=button.querySelector('canvas').getContext('2d');c.clearRect(0,0,60,60);unitIcon(c,button.dataset.recruit,30,33,TEAM[this.side]);}}else if(terrainChanged)renderer.paintGround();
  // O laço principal já atualiza a interface a cada 0,12 s; aqui só na partida nova e para mostrar o resultado.
  $('networkStatus').hidden=false;this.status(game.paused?'Partida suspensa · aguardando reconexão.':'Sala '+this.session.code+' · '+(this.side==='blue'?'Azul':'Vermelho'));renderer.dirty=true;if(fresh||game.winner&&!resultShown)updateUI();
 },
 interpolate(now){
  const t=game.paused?1:Math.max(0,Math.min(1,(now-this.receivedAt)/100));for(const u of game.units){const poses=this.poses.get(u.id);if(!poses){delete u._renderPose;continue;}const a=poses.from,b=poses.to,angle=Math.atan2(Math.sin(b.facing-a.facing),Math.cos(b.facing-a.facing));u._renderPose={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,facing:a.facing+angle*t,_flightLevel:a._flightLevel+(b._flightLevel-a._flightLevel)*t};}
 }
};
window.Multiplayer=Multiplayer;
window.addEventListener('load',()=>{
 $('titleMultiplayer').addEventListener('click',()=>Multiplayer.open());$('mpCreate').addEventListener('click',()=>Multiplayer.enter());$('mpJoin').addEventListener('click',()=>Multiplayer.enter(true));$('mpReady').addEventListener('click',()=>Multiplayer.ready());$('mpStart').addEventListener('click',()=>Multiplayer.send({type:'start'}));$('mpArmy').addEventListener('click',()=>Multiplayer.editArmy());$('mpDoctrine').addEventListener('change',()=>Multiplayer.prepare());$('mpLeave').addEventListener('click',()=>Multiplayer.leave());$('mpBack').addEventListener('click',()=>{closeMenu('multiplayer');openTitle();});$('mpResume').addEventListener('click',()=>closeMenu('multiplayer'));$('mpRematch').addEventListener('click',()=>Multiplayer.rematch());
 $('multiplayer').addEventListener('cancel',event=>{event.preventDefault();closeMenu('multiplayer');if(!started)openTitle();});
 $('armyEditor').addEventListener('close',()=>Multiplayer.editingArmy=false);
 for(const id of ['mpMap','mpMode','mpSeed','mpWater','mpForest','mpRelief','mpFarmland','mpPosts'])$(id).addEventListener('change',()=>{Multiplayer.configure();$('mpTerrain').hidden=$('mpMap').value!=='random';});
 $('mpDoctrine').replaceChildren(...Object.entries(NATION_DOCTRINES).map(([id,d])=>new Option(d.name,id)));
 $('mpPosts').replaceChildren(...Array.from({length:16},(_,i)=>new Option(String(i*2+2),String(i*2+2))));$('mpPosts').value='24';
 const params=new URLSearchParams(location.search),invitation=params.get('room');if(invitation)$('mpCode').value=invitation;if(invitation||params.has('multiplayer'))Multiplayer.open();else Multiplayer.serverInfo();
 try{const session=JSON.parse(sessionStorage.getItem('rtsvibe.multiplayer')||'null');if(session?.code&&session.token&&location.protocol!=='file:'){Multiplayer.session=session;Multiplayer.seq=session.seq||0;$('mpNickname').value=session.nickname||'Jogador';Multiplayer.show();Multiplayer.connect();}}catch{}
});
