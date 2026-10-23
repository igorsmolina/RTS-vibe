'use strict';
/* Núcleo do multiplayer: salas, jogadores, validação de ordens, estado por jogador e tick.
   Não depende de Node nem do DOM: roda no servidor (scripts/multiplayer-server.cjs) e dentro de um Web Worker
   (hospedagem pelo navegador, public/js/host-worker.js). Um "socket" é qualquer objeto com send(texto) e close(código,motivo);
   o núcleo anota nele o jogador e a sala. Recebe o motor pronto: createCore(engine, opções). */
function createCore(engine,{graceMs=120000,now=Date.now,maxRooms=16}={}){
 const {Game,TYPES,MAPS,NATION_DOCTRINES,PROCEDURAL,STARTING_DEFAULT,STARTING_BUDGET,UNIT_CAP,startingCatalog,armyCost,cleanStartingArmy,STEP,SIZE,KEY,TILE,AIR,MISSILE}=engine;
 // Até três jogadores, todos contra todos; o primeiro é o anfitrião. Sem escolha explícita, cada lado usa um time de unidades diferente.
 const SIDES=['blue','red','green'],DEFAULT_FACTION={blue:'blue',red:'red',green:'franca'},plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o),id=n=>Number.isSafeInteger(n)&&n>0;
 const copy=o=>JSON.parse(JSON.stringify(o)),pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
 const failure=(message,status=400,code='invalid')=>Object.assign(new Error(message),{status,code});
 const random32=()=>globalThis.crypto.getRandomValues(new Uint32Array(1))[0],privateRandom=()=>random32()/0x100000000;
 const token=()=>Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',roomCode=()=>Array.from(globalThis.crypto.getRandomValues(new Uint8Array(8)),b=>ALPHABET[b%ALPHABET.length]).join('');
 const factionOf=value=>value==='blue'||value==='red'||value==='franca'||value==='roxo'?value:null;
 function nickname(value){if(typeof value!=='string'||!value.trim()||value.trim().length>32||/[\x00-\x1f\x7f]/.test(value))throw failure('Informe um apelido de 1 a 32 caracteres.');return value.trim();}
 function config(value={},previous={map:'river',mode:'rts',seed:1,options:{...PROCEDURAL}}){
  if(!plain(value))throw failure('Configuração inválida.');const result={...previous,options:{...previous.options}};
  if(value.map!==undefined){if(!Object.hasOwn(MAPS,value.map))throw failure('Mapa inválido.');result.map=value.map;}
  if(value.mode!==undefined){if(!['rts','turns'].includes(value.mode))throw failure('Modo inválido.');result.mode=value.mode;}
  if(value.seed!==undefined){if(!Number.isInteger(value.seed)||value.seed<0||value.seed>0xffffffff)throw failure('Semente inválida.');result.seed=value.seed;}
  if(value.options!==undefined){if(!plain(value.options))throw failure('Terreno inválido.');for(const [key,n]of Object.entries(value.options)){if(!Object.hasOwn(PROCEDURAL,key)||(key==='landscape'?!['auto','continent','lakes','islands','highlands'].includes(n):!Number.isFinite(n)||(key==='posts'?!(Number.isInteger(n)&&n>=2&&n<=32&&n%2===0):n<0||n>1)))throw failure('Opção de terreno inválida.');result.options[key]=n;}}
  return result;
 }
 // O catálogo vale para a facção (as unidades escolhidas), não para o lado.
 function army(value,faction){if(!plain(value)||Object.entries(value).some(([type,n])=>!startingCatalog(faction).includes(type)||!Number.isInteger(n)||n<0)||armyCost(value,faction)>STARTING_BUDGET)throw failure('Exército inicial inválido ou acima do orçamento.');return copy(cleanStartingArmy(value,faction));}
 function mask(values){const bytes=new Uint8Array(Math.ceil(SIZE/8));for(let i=0;i<SIZE;i++)if(values[i])bytes[i>>3]|=1<<(i&7);let text='';for(const b of bytes)text+=String.fromCharCode(b);return btoa(text);}
 function optical(game,side,u){if(u.spotted)return !!u.spotted[side]&&u.hp>0;const p=TILE(u);return !!(AIR(u)?game.sky:game.visible)[side][KEY(p.x,p.y)];}
 function viewState(room,player){
  const game=room.game,side=player.side,others=game.sides.filter(s=>s!==side),known=new Set(),emitters=new Set(game.emitterContacts(side).map(c=>c.id));
  const visual=['id','type','owner','faction','x','y','width','height','hp','maxHp','level','facing','altitude','altitudeTransition','flightState','entrenched','suppressed','launcherLevel','radarOn'];
  // Cópias rasas: cada estado é serializado logo em seguida. `job` (rota do RTS) repete `path` e o cliente não o usa.
  // A rota inteira só serve à linha tracejada: as 16 próximas casas e o destino bastam (a rota era 57% do estado).
  const ownEntity=u=>{const {job,...result}=u;if(result.spotted)result.spotted={[side]:!!result.spotted[side]};if(result.path?.length>17)result.path=[...result.path.slice(0,16),result.path[result.path.length-1]];return result;};
  const entity=u=>{
   known.add(u.id);if(u.owner===side)return ownEntity(u);
   const contact=!TYPES[u.type].structure&&!optical(game,side,u);
   if(contact)return {...pick(u,['id','type','owner','faction','x','y','facing','altitude','flightState','radarOn']),hp:1,maxHp:1,contactOnly:emitters.has(u.id)&&!game.radarContact(side,u)?'emitter':'radar',order:{type:'stop'},path:[],spotted:u.spotted?{[side]:!!u.spotted[side]}:undefined};
   const result=pick(u,visual);result.order={type:'stop'};result.path=[];if(u.runway)result.runway={level:u.runway.level};if(u.spotted)result.spotted={[side]:!!u.spotted[side]};return result;
  };
  const units=game.units.filter(u=>u.owner===side||game.isVisible(side,u)||emitters.has(u.id)).map(entity),structures=game.structures.filter(s=>s.owner===side||game.isVisible(side,s)).map(entity);
  const visiblePoint=(p,air=false)=>{const t=TILE(p);return t.x>=0&&t.y>=0&&t.x<128&&t.y<96&&!!(air?game.sky:game.visible)[side][KEY(t.x,t.y)];};
  const projectiles=game.projectiles.flatMap(p=>{
   const missile=MISSILE(p.weapon),t=Math.min(1,p.elapsed/p.duration),target=game.get(p.targetId),tx=target?.x??p.tx,ty=target?.y??p.ty,x=missile?p.x:p.sx+(tx-p.sx)*t,y=missile?p.y:p.sy+(ty-p.sy)*t;
   if(!missile&&p.owner!==side&&!visiblePoint({x,y},p.air))return [];
   const q=pick(p,['projectileId','owner','weapon','air','elapsed','duration','visualLevel','sourceLevel','targetLevel','heading']);
   q.type=p.owner===side||known.has(p.attackerId)?p.type:missile?'missile':'infantry';q.networkVisual=true;q.x=x;q.y=y;q.sx=x;q.sy=y;q.tx=x;q.ty=y;
   if(p.weapon==='cruiseMissile'&&p.owner===side)q.area={x:p.tx,y:p.ty};
   if(known.has(p.attackerId))q.attackerId=p.attackerId;if(known.has(p.targetId))q.targetId=p.targetId;
   q.trail=(p.trail||[]).filter(v=>missile||p.owner===side||visiblePoint(v,p.air)).map(v=>pick(v,['x','y','level','time']));return [q];
  });
  const eventSeq=game.nextEventSeq||0,events=game.events.filter(e=>e.seq>player.eventCursor&&e.audiences?.includes(side)).map(e=>{
   const q={...e};delete q.audiences;q.visible=true;for(const key of ['id','contactId','sourceId'])if(!known.has(q[key]))delete q[key];if(e.id&&!known.has(e.id))delete q.sourceType;if(q.cells)q.cells=q.cells.filter(p=>visiblePoint(p));return q;
  });player.eventCursor=eventSeq;
  const logs=game.logs.filter(l=>l.audiences?.includes(side)).map(l=>pick(l,['time','text']));
  const state={...pick(game,['map','mode','difficulty','seed','options','doctrines','factions','time','round','turn','winner','nationName','turnEnding']),multiplayer:true,playerSide:side,networkBusy:game.busy,paused:room.paused,terrainRevision:room.terrainRevision,units,structures,projectiles,events,logs,
   visible:{[side]:mask(game.visible[side])},sky:{[side]:mask(game.sky[side])},explored:{[side]:mask(game.explored[side])},memory:{[side]:[...game.memory[side]]},radarContacts:{[side]:[...game.radarContacts[side]].filter(n=>known.has(n))},intel:[],claims:[],credits:{[side]:game.credits[side],...Object.fromEntries(others.map(s=>[s,0]))},stats:{[side]:game.stats[side],...Object.fromEntries(others.map(s=>[s,{kills:{},losses:{}}]))},initialArmies:{[side]:game.initialArmies[side]},
   drops:(game.drops||[]).filter(d=>d.owner===side||visiblePoint(d)).map(d=>({...pick(d,['x','y','owner','elapsed']),passenger:pick(d.passenger,['id','type','owner','faction','hp','maxHp']),destination:pick(d.destination,['x','y'])})),
   mines:game.mines.filter(m=>m.known[side]).map(m=>({x:m.x,y:m.y,known:{[side]:true}})),fires:game.fires.filter(f=>visiblePoint(f)).map(f=>pick(f,['x','y','left'])),actions:[],animation:null,aiEnabled:false,aiQueue:[],nextId:0};
  state.out=[...(game.out||[])];if(!state.winner&&game.isOut(side))state.winner='eliminated'; // eliminado: vê a derrota, os outros seguem
  if(!player.knownTerrain){player.knownTerrain=game.terrain.slice();player.knownTerrainRevision=0;}
  let terrainChanged=false;for(let i=0;i<SIZE;i++)if(game.visible[side][i]&&player.knownTerrain[i]!==game.terrain[i]){player.knownTerrain[i]=game.terrain[i];terrainChanged=true;}if(terrainChanged)player.knownTerrainRevision++;
  state.terrainRevision=player.knownTerrainRevision;if(player.terrainRevision!==player.knownTerrainRevision){state.terrain=player.knownTerrain.slice();player.terrainRevision=player.knownTerrainRevision;}
  return state;
 }

 // ponytail: salas em um processo; persistência e múltiplas instâncias exigirão armazenamento compartilhado.
 const rooms=new Map(),sockets=new Set();let tickNumber=0,closing=false;
 const send=(socket,value)=>{if(socket&&(socket.readyState===undefined||socket.readyState===1))socket.send(JSON.stringify(value));};
 const publicRoom=room=>({code:room.code,status:room.status,hostSide:room.players.find(p=>p.host)?.side,config:room.config,matchId:room.matchId,paused:room.paused,reconnectDeadline:room.paused?Math.min(...room.players.filter(p=>!p.ws&&!p.out).map(p=>p.disconnectedAt+graceMs)):null,result:room.result||null,players:room.players.map(p=>({nickname:p.nickname,side:p.side,ready:p.ready,connected:!!p.ws,doctrine:p.doctrine,faction:p.faction,army:p.army,rematch:!!p.rematch,out:!!p.out}))});
 // stateOnly: o envio periódico (10 Hz) leva só o estado; sala e resultado saem quando a sala muda.
 const broadcast=(room,stateOnly=false)=>{for(const r of room?[room]:rooms.values())for(const p of r.players){if(!p.ws)continue;if(!stateOnly)send(p.ws,{type:'room',side:p.side,room:publicRoom(r)});if(r.game)send(p.ws,{type:'state',side:p.side,matchId:r.matchId,state:viewState(r,p)});if(r.result&&!stateOnly)send(p.ws,{type:'result',...r.result});}};
 const newPlayer=(name,side,host=false)=>({nickname:nickname(name),side,host,token:token(),ready:false,doctrine:'balanced',faction:null,army:{...STARTING_DEFAULT},ws:null,lastSeq:0,acks:new Map(),eventCursor:0,terrainRevision:-1,disconnectedAt:null,rematch:false,out:false,left:false});
 // Facção = unidades usadas; sem escolha explícita vale o padrão do lado.
 const factionFor=p=>p.faction||DEFAULT_FACTION[p.side];
 const active=room=>room.players.filter(p=>!p.out);
 // Jogadores derrotados em combate (o motor registra em game.out) ficam marcados na sala; devolve se algo mudou.
 const sync=room=>{let changed=false;for(const p of room.players)if(!p.out&&room.game?.out?.includes(p.side)){p.out=true;changed=true;}return changed;};
 // Lados contíguos na ordem de entrada (sem buracos depois que alguém sai da sala de espera).
 const compact=room=>{room.players.sort((a,b)=>SIDES.indexOf(a.side)-SIDES.indexOf(b.side));room.players.forEach((p,i)=>{p.side=SIDES[i];});};
 const finish=(room,winner,reason)=>{room.status=winner?'finished':'cancelled';room.paused=false;room.finishedAt=now();room.players=room.players.filter(p=>!p.left);room.result={winner:winner||null,reason};if(room.game)room.game.winner=winner||'cancelled';broadcast(room);};
 // Sai da partida (desistência, abandono ou prazo de reconexão): com três vivos ela segue sem ele; com dois, o outro vence.
 // `expired` só dá a vitória a quem ainda está conectado.
 const lose=(room,player,reason)=>{
  sync(room);if(player.out||room.status!=='playing')return;const rest=active(room).filter(p=>p!==player);
  if(rest.length>1){player.out=true;room.game.eliminate(player.side);broadcast(room);return;}
  const winner=reason==='expired'?rest.find(p=>p.ws):rest[0];finish(room,winner?.side,reason==='expired'?winner?'abandonment':'disconnected':reason);
 };
 const abandon=(room,player)=>{if(room.status==='playing')lose(room,player,'abandonment');else if(room.status==='waiting'){if(player.host){room.status='cancelled';room.result={winner:null,reason:'host_left'};broadcast(room);rooms.delete(room.code);}else{room.players=room.players.filter(p=>p!==player);room.players.forEach(p=>p.ready=false);compact(room);broadcast(room);}}};
 // Carga real do servidor para o /health: ticks por segundo executados (meta 30) e fração de um núcleo usada, em janelas de 5 s.
 const load={tickRate:0,cpu:0},cpuUsage=typeof process!=='undefined'&&typeof process.cpuUsage==='function'?process.cpuUsage:null;let loadAt=performance.now(),loadTicks=0,loadCpu=cpuUsage?.();
 const sampleLoad=()=>{loadTicks++;const t=performance.now();if(t-loadAt<5000)return;load.tickRate=Math.round(loadTicks/(t-loadAt)*1e4)/10;if(cpuUsage){const used=cpuUsage(loadCpu);load.cpu=Math.round((used.user+used.system)/1000/(t-loadAt)*100)/100;loadCpu=cpuUsage();}loadAt=t;loadTicks=0;};
 const tick=()=>{
  sampleLoad();tickNumber++;for(const room of rooms.values()){
   if(room.status==='waiting'&&now()-room.lastTouch>15*60000||['finished','cancelled'].includes(room.status)&&now()-room.finishedAt>5*60000){rooms.delete(room.code);for(const p of room.players)p.ws?.close(1000,'Sala encerrada');continue;}
   if(room.status!=='playing')continue;
   for(const p of active(room))if(!p.ws&&now()-p.disconnectedAt>=graceMs)lose(room,p,'expired');
   if(room.status!=='playing')continue;
   const missing=active(room).filter(p=>!p.ws);if(missing.length){room.paused=true;continue;}
   room.paused=false;const latest=room.game.nextEventSeq||0;room.game.update(STEP);if(room.game.events.some(e=>e.seq>latest&&e.kind==='terrainChanged'))room.terrainRevision++;
   const changed=sync(room);
   if(room.game.winner)finish(room,room.game.winner,'battle');else if(changed)broadcast(room);else if(tickNumber%3===0)broadcast(room,true);
  }
 };
 const issue=(socket,e)=>send(socket,{type:'error',code:e.code||'invalid',message:e.status?e.message:'Mensagem inválida.'});

 function createRoom(name,configuration){
  if(rooms.size>=maxRooms)throw failure('Servidor cheio. Tente novamente mais tarde.',503,'server_full');
  let code;do{code=roomCode();}while(rooms.has(code));
  const player=newPlayer(name,'blue',true),room={code,status:'waiting',config:config(configuration),players:[player],lastTouch:now(),matchId:0,paused:false,terrainRevision:0};rooms.set(code,room);
  return {code,token:player.token,side:player.side};
 }
 function joinRoom(code,name){
  const room=rooms.get(code);if(!room)throw failure('Sala indisponível ou encerrada.',404,'room_missing');if(room.status!=='waiting'||room.players.length>=SIDES.length)throw failure('Sala cheia ou partida já iniciada.',409,'room_full');
  const player=newPlayer(name,SIDES.find(s=>!room.players.some(p=>p.side===s)));room.players.push(player);room.players.forEach(p=>p.ready=false);room.lastTouch=now();
  return {code:room.code,token:player.token,side:player.side,room};
 }

 const applyCommand=(room,player,msg)=>{
  const g=room.game,side=player.side,a=msg.args;if(player.out)throw failure('Você foi eliminado.',403,'eliminated');if(room.status!=='playing'||room.paused||active(room).some(p=>!p.ws))throw failure('Aguarde a conexão dos jogadores.',409,'paused');if(!plain(a))throw failure('Argumentos inválidos.');const stop=msg.action==='order'&&a.type==='stop';if(g.mode==='turns'&&(g.turn!==side||g.busy&&!stop))throw failure('Aguarde seu turno e o fim da ação.',409,'turn');
  const owned=n=>{if(!id(n))throw failure('Unidade inválida.');const u=g.get(n);if(!u||u.owner!==side||u.hp<=0)throw failure('Esta unidade não pertence a você.',403,'ownership');return u;};
  const ownIds=ids=>{if(!Array.isArray(ids)||!ids.length||ids.length>128||ids.some(n=>!id(n)))throw failure('Seleção inválida.');ids.forEach(owned);return [...new Set(ids)];};
  const point=p=>{if(!plain(p)||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.x>=128||p.y<0||p.y>=96)throw failure('Posição inválida.');return {x:p.x,y:p.y};};
  const capped=(extra=1)=>{if(g.atUnitCap(side,extra))throw failure('Limite de '+UNIT_CAP+' tropas por jogador: em campo, embarcadas e na fila de produção.',409,'cap');};
  switch(msg.action){
   case 'order':{
    const ids=ownIds(a.ids),allowed=['move','attack','capture','repair','stop','altitude','service','demine','build','bombard','takeoff','patrol','strike','return','land','bombRun','strikeCell','embark','disembark','airdropLaunch'];if(!allowed.includes(a.type)||!plain(a.args||{}))throw failure('Ordem inválida.');const input=a.args||{},args={};
    if(a.type==='embark'){owned(input.targetId);args.targetId=input.targetId;}
    if(['move','patrol','demine','bombard','strikeCell'].includes(a.type))Object.assign(args,point(input));
    if(['attack','strike','capture','repair','service'].includes(a.type)){if(!id(input.targetId))throw failure('Alvo inválido.');args.targetId=input.targetId;}
    if(['return','land'].includes(a.type)&&input.targetId!==undefined){owned(input.targetId);args.targetId=input.targetId;}
    if(a.type==='capture'){const remembered=[...g.memory[side].values()].find(s=>s.id===input.targetId),live=g.get(input.targetId);if(!remembered&&(!live||!g.isVisible(side,live)))throw failure('Objetivo não identificado.');if(remembered)args.position=pick(remembered,['x','y','width','height']);}
    if(a.type==='altitude'){if(!['low','high'].includes(input.altitude))throw failure('Altitude inválida.');args.altitude=input.altitude;}
    if(['attack','strike','strikeCell'].includes(a.type)){if(input.weapon!==undefined){if(typeof input.weapon!=='string'||input.weapon.length>32)throw failure('Arma inválida.');args.weapon=input.weapon;}if(input.salvo!==undefined){if(![1,2].includes(input.salvo))throw failure('Salva inválida.');args.salvo=input.salvo;}}
    if(a.type==='airdropLaunch'){args.start=point(input.start);args.end=point(input.end);}
    if(a.type==='bombRun'){args.start=point(input.start);args.end=point(input.end);if(input.bombCount!==undefined){if(![6,12,24,48].includes(input.bombCount))throw failure('Quantidade de bombas inválida.');args.bombCount=input.bombCount;}}if(g.mode==='turns'&&g.busy&&stop)return ids.map(n=>g.order(g.get(n),'stop')).some(Boolean);return g.command(ids,a.type,args,side)>0;
   }
   case 'enqueue':{const base=owned(a.baseId);if(typeof a.type!=='string'||!Object.hasOwn(TYPES,a.type))throw failure('Tropa inválida.');capped();return g.enqueue(side,a.type,base);}
   case 'requestAirdrop':{const base=owned(a.baseId);if(!plain(a.cargo))throw failure('Carga inválida.');capped(g.airdropQuote(a.cargo)?.types.length);return g.requestAirdrop(side,base.id,a.cargo,a.destination===undefined||a.destination===null?undefined:point(a.destination));}
   case 'boardPurchase':{const base=owned(a.baseId);if(typeof a.type!=='string'||!Object.hasOwn(TYPES,a.type))throw failure('Tropa inválida.');capped();return g.boardPurchase(side,base.id,a.type);}
   case 'endTurn':return g.endTurn(side);
   case 'setWeapon':{const ids=ownIds(a.ids||[a.id]);if(typeof a.weapon!=='string')throw failure('Arma inválida.');return ids.map(n=>g.setWeapon(owned(n),a.weapon)).some(Boolean);}
   case 'setRadar':if(typeof a.on!=='boolean')throw failure('Radar inválido.');return g.setRadar(owned(a.id),a.on);
   case 'buildAirport':return g.buildAirport(ownIds(a.ids),point(a.cell||a));
   case 'assignAirportWorkers':return g.assignAirportWorkers(owned(a.siteId),ownIds(a.ids));
   case 'servicePlane':if(a.rearm!==undefined&&typeof a.rearm!=='boolean')throw failure('Manutenção inválida.');return g.servicePlane(owned(a.id),a.rearm!==false);
   default:throw failure('Comando desconhecido.');
  }
 };

 // Conexão: o socket recebe os campos de controle (jogador, sala, limite de taxa) e o prazo de autenticação.
 function attach(socket){
  sockets.add(socket);socket.rateAt=now();socket.rateCount=0;
  socket.authTimer=setTimeout(()=>{if(!socket.player)socket.close(1008,'Autenticação necessária');},10000);socket.authTimer.unref?.();
  return socket;
 }
 function receive(ws,text){
  try{
   // Acima de 60 mensagens/s, ordens consomem o número de sequência e voltam recusadas (code 'rate'); sem isso toda ordem seguinte falharia por sequência até reconectar.
   if(now()-ws.rateAt>=1000){ws.rateAt=now();ws.rateCount=0;}const limited=++ws.rateCount>60;let msg;try{msg=JSON.parse(text);}catch{throw failure('JSON inválido.');}if(!plain(msg)||typeof msg.type!=='string')throw failure('Mensagem inválida.');
   if(limited&&!(ws.player&&msg.type==='command'))throw failure('Muitas mensagens. Aguarde.',429,'rate');
   if(!ws.player){
    // Entrar sem HTTP (hospedagem pelo navegador): devolve o token e a conexão segue com auth.
    if(msg.type==='join'){if(msg.version!==1||typeof msg.code!=='string')throw failure('Mensagem inválida.');const joined=joinRoom(msg.code,msg.nickname);send(ws,{type:'joined',code:joined.code,token:joined.token,side:joined.side});broadcast(joined.room);return;}
    if(msg.type!=='auth'||msg.version!==1||typeof msg.code!=='string'||typeof msg.token!=='string')throw failure('Sessão inválida.',401,'auth');const room=rooms.get(msg.code);if(!room)throw failure('Sala indisponível ou encerrada.',404,'room_missing');const player=room.players.find(p=>p.token===msg.token);if(!player)throw failure('Sessão inválida.',401,'auth');
    if(room.status==='playing')for(const p of active(room))if(!p.ws&&now()-p.disconnectedAt>=graceMs)lose(room,p,'expired');
    clearTimeout(ws.authTimer);if(player.ws&&player.ws!==ws)player.ws.close(1000,'Sessão retomada em outra aba');player.ws=ws;player.disconnectedAt=null;player.terrainRevision=-1;player.eventCursor=room.game?.nextEventSeq||0;ws.player=player;ws.room=room;room.lastTouch=now();room.paused=room.status==='playing'&&active(room).some(p=>!p.ws);send(ws,{type:'authenticated',side:player.side,lastSeq:player.lastSeq});broadcast(room);return;
   }
   const room=ws.room,player=ws.player;if(!rooms.has(room.code)||player.ws!==ws)throw failure('Sala indisponível ou encerrada.',404,'room_missing');room.lastTouch=now();
   if(msg.type==='command'){
    if(!id(msg.seq))throw failure('Número de comando inválido.');if(msg.seq<=player.lastSeq){send(ws,player.acks.get(msg.seq)||{type:'ack',seq:msg.seq,ok:false,duplicate:true});return;}if(msg.seq!==player.lastSeq+1)throw failure('Sequência de comandos inválida.',409,'sequence');
    player.lastSeq=msg.seq;let ack;try{if(limited)throw failure('Muitas ordens de uma vez. Aguarde um instante.',429,'rate');const ok=!!applyCommand(room,player,msg);ack={type:'ack',seq:msg.seq,ok,...(!ok?{message:'Ação indisponível neste estado.'}:{})};}catch(e){ack={type:'ack',seq:msg.seq,ok:false,message:e.status?e.message:'Comando inválido.',code:e.code||'invalid'};}player.acks.set(msg.seq,ack);while(player.acks.size>128)player.acks.delete(player.acks.keys().next().value);send(ws,ack);return;
   }
   if(msg.type==='leave'){player.left=true;abandon(room,player);if(['finished','cancelled'].includes(room.status)&&room.players.includes(player)){room.players=room.players.filter(p=>p!==player);broadcast(room);}player.ws=null;ws.close(1000,'Você saiu da sala');return;}
   // Desistir: derrota de quem desistiu, os dois seguem na sala (revanche). Só o anfitrião encerra a partida para todos.
   if(msg.type==='surrender'){if(room.status!=='playing')throw failure('Não há partida em andamento.');if(player.out)throw failure('Você já foi eliminado.');lose(room,player,'surrender');return;}
   if(msg.type==='end'){if(!player.host)throw failure('Somente o anfitrião pode encerrar a partida.',403,'host');if(room.status!=='playing')throw failure('Não há partida em andamento.');finish(room,null,'host_ended');return;}
   if(msg.type==='rematch'){
    // Só quem continua conectado entra na revanche (quem saiu ou caiu fica de fora); os lados giram: azul → vermelho → verde → azul.
    const staying=room.players.filter(p=>p.ws);if(room.status!=='finished'||staying.length<2||!staying.includes(player))throw failure('Revanche indisponível.');player.rematch=true;if(staying.every(p=>p.rematch)){room.players=staying;room.status='waiting';room.game=null;room.result=null;room.paused=false;for(const p of room.players){p.side=SIDES[(SIDES.indexOf(p.side)+1)%staying.length];p.out=false;p.ready=false;p.rematch=false;p.army={...STARTING_DEFAULT};p.lastSeq=0;p.acks.clear();p.eventCursor=0;p.terrainRevision=-1;}room.terrainRevision=0;}broadcast(room);return;
   }
   if(room.status!=='waiting')throw failure('A partida já começou.');
   if(msg.type==='configure'){if(!player.host)throw failure('Somente o anfitrião pode configurar.',403,'host');room.config=config(msg.config,room.config);room.players.forEach(p=>p.ready=false);}
   else if(msg.type==='prepare'){
    if(msg.faction!==undefined){if(msg.faction!==null&&!factionOf(msg.faction))throw failure('Unidades inválidas.');player.faction=msg.faction;}
    if(msg.army!==undefined)player.army=army(msg.army,factionFor(player));else if(msg.faction!==undefined)player.army=copy(cleanStartingArmy(player.army,factionFor(player)));
    if(msg.doctrine!==undefined){if(!Object.hasOwn(NATION_DOCTRINES,msg.doctrine))throw failure('Doutrina inválida.');player.doctrine=msg.doctrine;}room.players.forEach(p=>p.ready=false);
   }
   else if(msg.type==='ready'){if(typeof msg.ready!=='boolean')throw failure('Confirmação inválida.');player.ready=msg.ready;}
   else if(msg.type==='start'){
    if(!player.host||room.players.length<2||room.players.some(p=>!p.ready||!p.ws))throw failure('Todos os jogadores precisam estar conectados e prontos (mínimo de dois).');const c=room.config,doctrines={},armies={},factions={};for(const p of room.players){p.out=false;doctrines[p.side]=p.doctrine;armies[p.side]=p.army;factions[p.side]=factionFor(p);p.eventCursor=0;p.terrainRevision=-1;p.lastSeq=0;p.acks.clear();}
    room.game=new Game(c.map,'normal',c.seed,c.mode,c.options,doctrines,armies,privateRandom,factions);room.game.multiplayer=true;room.game.aiEnabled=false;room.game.rng=privateRandom;room.game.radarRng=privateRandom;room.game.logs=[];room.game.events=[];room.game.log('Partida multiplayer iniciada.',room.game.sides);for(const p of room.players){p.knownTerrain=null;p.knownTerrainRevision=0;}room.status='playing';room.paused=false;room.matchId++;room.terrainRevision=0;
   }else throw failure('Mensagem desconhecida.');broadcast(room);
  }catch(e){issue(ws,e);if(!ws.player)ws.close(1008,'Sessão inválida');}
 }
 function detach(ws){
  clearTimeout(ws.authTimer);sockets.delete(ws);const p=ws.player,r=ws.room;if(!p||p.ws!==ws)return;p.ws=null;p.disconnectedAt=now();if(closing)return;if(r.status==='playing'&&!p.out)r.paused=true;else if(r.status==='waiting')r.players.forEach(q=>q.ready=false);broadcast(r);
 }
 return {rooms,sockets,load,createRoom,joinRoom,attach,receive,detach,tick,broadcast,viewState:(room,side)=>viewState(room,room.players.find(p=>p.side===side)),close(){closing=true;}};
}
if(typeof module!=='undefined')module.exports={createCore};
