'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {WebSocketServer,WebSocket}=require('ws');
const publicRoot=path.resolve(__dirname,'..','public');
// O motor roda como função e não em vm.runInContext: o contexto vm deixa Math, Object e os demais globais ~5× mais lentos (tick de 300 unidades em marcha: 43 → 10 ms).
const {Game,TYPES,MAPS,NATION_DOCTRINES,PROCEDURAL,STARTING_DEFAULT,STARTING_BUDGET,startingCatalog,armyCost,cleanStartingArmy,STEP,SIZE,KEY,TILE,AIR,MISSILE}=new Function(fs.readFileSync(path.join(publicRoot,'js','engine.js'),'utf8')+'\nreturn {Game,TYPES,MAPS,NATION_DOCTRINES,PROCEDURAL,STARTING_DEFAULT,STARTING_BUDGET,startingCatalog,armyCost,cleanStartingArmy,STEP,SIZE,KEY,TILE,AIR,MISSILE};')();
const sides=['blue','red'],other=side=>side==='blue'?'red':'blue',plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o),id=n=>Number.isSafeInteger(n)&&n>0;
const copy=o=>JSON.parse(JSON.stringify(o)),pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav'};
function failure(message,status=400,code='invalid'){return Object.assign(new Error(message),{status,code});}
function nickname(value){if(typeof value!=='string'||!value.trim()||value.trim().length>32||/[\x00-\x1f\x7f]/.test(value))throw failure('Informe um apelido de 1 a 32 caracteres.');return value.trim();}
function config(value={},previous={map:'river',mode:'rts',seed:1,options:{...PROCEDURAL}}){
 if(!plain(value))throw failure('Configuração inválida.');const result={...previous,options:{...previous.options}};
 if(value.map!==undefined){if(!Object.hasOwn(MAPS,value.map))throw failure('Mapa inválido.');result.map=value.map;}
 if(value.mode!==undefined){if(!['rts','turns'].includes(value.mode))throw failure('Modo inválido.');result.mode=value.mode;}
 if(value.seed!==undefined){if(!Number.isInteger(value.seed)||value.seed<0||value.seed>0xffffffff)throw failure('Semente inválida.');result.seed=value.seed;}
 if(value.options!==undefined){if(!plain(value.options))throw failure('Terreno inválido.');for(const [key,n]of Object.entries(value.options)){if(!Object.hasOwn(PROCEDURAL,key)||!Number.isFinite(n)||(key==='posts'?!(Number.isInteger(n)&&n>=2&&n<=32&&n%2===0):n<0||n>1))throw failure('Opção de terreno inválida.');result.options[key]=n;}}
 return result;
}
function army(value,side){if(!plain(value)||Object.entries(value).some(([type,n])=>!startingCatalog(side).includes(type)||!Number.isInteger(n)||n<0)||armyCost(value)>STARTING_BUDGET)throw failure('Exército inicial inválido ou acima do orçamento.');return copy(cleanStartingArmy(value,side));}
function mask(values){const bytes=Buffer.alloc(Math.ceil(SIZE/8));for(let i=0;i<SIZE;i++)if(values[i])bytes[i>>3]|=1<<(i&7);return bytes.toString('base64');}
function optical(game,side,u){if(u.spotted)return !!u.spotted[side]&&u.hp>0;const p=TILE(u);return !!(AIR(u)?game.sky:game.visible)[side][KEY(p.x,p.y)];}
function viewState(room,player){
 const game=room.game,side=player.side,known=new Set(),emitters=new Set(game.emitterContacts(side).map(c=>c.id));
 const visual=['id','type','owner','x','y','width','height','hp','maxHp','level','facing','altitude','altitudeTransition','flightState','entrenched','suppressed','launcherLevel','radarOn'];
 // Cópias rasas: cada estado é serializado logo em seguida. `job` (rota do RTS) repete `path` e o cliente não o usa.
 const ownEntity=u=>{const {job,...result}=u;if(result.spotted)result.spotted={[side]:!!result.spotted[side]};return result;};
 const entity=u=>{
  known.add(u.id);if(u.owner===side)return ownEntity(u);
  const contact=!TYPES[u.type].structure&&!optical(game,side,u);
  if(contact)return {...pick(u,['id','type','owner','x','y','facing','altitude','flightState','radarOn']),hp:1,maxHp:1,contactOnly:emitters.has(u.id)&&!game.radarContact(side,u)?'emitter':'radar',order:{type:'stop'},path:[],spotted:u.spotted?{[side]:!!u.spotted[side]}:undefined};
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
 const state={...pick(game,['map','mode','difficulty','seed','options','doctrines','time','round','turn','winner','nationName','turnEnding']),multiplayer:true,playerSide:side,networkBusy:game.busy,paused:room.paused,terrainRevision:room.terrainRevision,units,structures,projectiles,events,logs,
  visible:{[side]:mask(game.visible[side])},sky:{[side]:mask(game.sky[side])},explored:{[side]:mask(game.explored[side])},memory:{[side]:[...game.memory[side]]},radarContacts:{[side]:[...game.radarContacts[side]].filter(n=>known.has(n))},intel:[],claims:[],credits:{[side]:game.credits[side],[other(side)]:0},stats:{[side]:game.stats[side],[other(side)]:{kills:{},losses:{}}},initialArmies:{[side]:game.initialArmies[side]},
  drops:(game.drops||[]).filter(d=>d.owner===side||visiblePoint(d)).map(d=>({...pick(d,['x','y','owner','elapsed']),passenger:pick(d.passenger,['id','type','owner','hp','maxHp']),destination:pick(d.destination,['x','y'])})),
  mines:game.mines.filter(m=>m.known[side]).map(m=>({x:m.x,y:m.y,known:{[side]:true}})),fires:game.fires.filter(f=>visiblePoint(f)).map(f=>pick(f,['x','y','left'])),actions:[],animation:null,aiEnabled:false,aiQueue:[],nextId:0};
 if(!player.knownTerrain){player.knownTerrain=game.terrain.slice();player.knownTerrainRevision=0;}
 let terrainChanged=false;for(let i=0;i<SIZE;i++)if(game.visible[side][i]&&player.knownTerrain[i]!==game.terrain[i]){player.knownTerrain[i]=game.terrain[i];terrainChanged=true;}if(terrainChanged)player.knownTerrainRevision++;
 state.terrainRevision=player.knownTerrainRevision;if(player.terrainRevision!==player.knownTerrainRevision){state.terrain=player.knownTerrain.slice();player.terrainRevision=player.knownTerrainRevision;}
 return state;
}
function createMultiplayerServer({graceMs=120000,now=Date.now,autoTick=true,maxRooms=16}={}){
 // ponytail: salas em um processo; persistência e múltiplas instâncias exigirão armazenamento compartilhado.
 const rooms=new Map(),sockets=new Set();let tickNumber=0,closing=false;
 const send=(ws,value)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(value));};
 const publicRoom=room=>({code:room.code,status:room.status,hostSide:room.players.find(p=>p.host)?.side,config:room.config,matchId:room.matchId,paused:room.paused,reconnectDeadline:room.paused?Math.min(...room.players.filter(p=>!p.ws).map(p=>p.disconnectedAt+graceMs)):null,result:room.result||null,players:room.players.map(p=>({nickname:p.nickname,side:p.side,ready:p.ready,connected:!!p.ws,doctrine:p.doctrine,army:p.army,rematch:!!p.rematch}))});
 // stateOnly: o envio periódico (10 Hz) leva só o estado; sala e resultado saem quando a sala muda.
 const broadcast=(room,stateOnly=false)=>{for(const r of room?[room]:rooms.values())for(const p of r.players){if(!p.ws)continue;if(!stateOnly)send(p.ws,{type:'room',side:p.side,room:publicRoom(r)});if(r.game)send(p.ws,{type:'state',side:p.side,matchId:r.matchId,state:viewState(r,p)});if(r.result&&!stateOnly)send(p.ws,{type:'result',...r.result});}};
 const newPlayer=(name,side,host=false)=>({nickname:nickname(name),side,host,token:crypto.randomBytes(32).toString('hex'),ready:false,doctrine:'balanced',army:{...STARTING_DEFAULT},ws:null,lastSeq:0,acks:new Map(),eventCursor:0,terrainRevision:-1,disconnectedAt:null,rematch:false});
 const finish=(room,winner,reason)=>{room.status=winner?'finished':'cancelled';room.paused=false;room.finishedAt=now();room.result={winner:winner||null,reason};if(room.game)room.game.winner=winner||'cancelled';broadcast(room);};
 const abandon=(room,player)=>{if(room.status==='playing')finish(room,room.players.find(p=>p!==player)?.side,'abandonment');else if(room.status==='waiting'){if(player.host){room.status='cancelled';room.result={winner:null,reason:'host_left'};broadcast(room);rooms.delete(room.code);}else{room.players=room.players.filter(p=>p!==player);room.players.forEach(p=>p.ready=false);broadcast(room);}}};
 const tick=()=>{
  tickNumber++;for(const room of rooms.values()){
   if(room.status==='waiting'&&now()-room.lastTouch>15*60000||['finished','cancelled'].includes(room.status)&&now()-room.finishedAt>5*60000){rooms.delete(room.code);for(const p of room.players)p.ws?.close(1000,'Sala encerrada');continue;}
   if(room.status!=='playing')continue;
   const missing=room.players.filter(p=>!p.ws);if(missing.length){room.paused=true;if(missing.some(p=>now()-p.disconnectedAt>=graceMs)){const connected=room.players.find(p=>p.ws);finish(room,connected?.side,connected?'abandonment':'disconnected');}continue;}
   room.paused=false;const latest=room.game.nextEventSeq||0;room.game.update(STEP);if(room.game.events.some(e=>e.seq>latest&&e.kind==='terrainChanged'))room.terrainRevision++;
   if(room.game.winner)finish(room,room.game.winner,'battle');else if(tickNumber%3===0)broadcast(room,true);
  }
 };
 const issue=(ws,e)=>send(ws,{type:'error',code:e.code||'invalid',message:e.status?e.message:'Mensagem inválida.'});
 const server=http.createServer(async(req,res)=>{
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  try{
   const url=new URL(req.url,'http://local');if(url.pathname==='/health'){json(200,{ok:true,multiplayer:true});return;}
   if(url.pathname.startsWith('/api/')){
    if(req.method!=='POST')throw failure('Método inválido.',405);let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)throw failure('Mensagem muito grande.',413);}let body;try{body=JSON.parse(raw);}catch{throw failure('JSON inválido.');}if(!plain(body))throw failure('Mensagem inválida.');
    if(url.pathname==='/api/rooms'){
     if(rooms.size>=maxRooms)throw failure('Servidor cheio. Tente novamente mais tarde.',503,'server_full');let code;do{code=crypto.randomBytes(6).toString('base64url').toUpperCase().replace(/[-_]/g,'').slice(0,8);}while(code.length!==8||rooms.has(code));
     const player=newPlayer(body.nickname,'blue',true),room={code,status:'waiting',config:config(body.config),players:[player],lastTouch:now(),matchId:0,paused:false,terrainRevision:0};rooms.set(code,room);json(201,{code,token:player.token,side:player.side});return;
    }
    const match=url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{8})\/join$/),room=match&&rooms.get(match[1]);if(!room)throw failure('Sala indisponível ou encerrada.',404,'room_missing');if(room.status!=='waiting'||room.players.length>=2)throw failure('Sala cheia ou partida já iniciada.',409,'room_full');
    const player=newPlayer(body.nickname,'red');room.players.push(player);room.players.forEach(p=>p.ready=false);room.lastTouch=now();json(201,{code:room.code,token:player.token,side:player.side});broadcast(room);return;
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
   let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}
   const file=path.resolve(publicRoot,'.'+pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(publicRoot+path.sep)){res.writeHead(403).end();return;}
   fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Não encontrado');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);});
  }catch(e){json(e.status||500,{error:e.status?e.message:'Não foi possível abrir a sala.',code:e.code||'invalid'});}
 });
 // Nível 1: um estado de ~170 KB comprime em 0,4 ms (nível 6: 1,3 ms) e a CPU da hospedagem gratuita é curta.
 const wss=new WebSocketServer({noServer:true,maxPayload:16384,perMessageDeflate:{threshold:1024,serverNoContextTakeover:true,clientNoContextTakeover:true,zlibDeflateOptions:{level:1}}});
 server.on('upgrade',(req,socket,head)=>{try{const url=new URL(req.url,'http://local');if(url.pathname!=='/multiplayer'||req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));}catch{socket.destroy();}});
 const applyCommand=(room,player,msg)=>{
  const g=room.game,side=player.side,a=msg.args;if(room.status!=='playing'||room.paused||room.players.some(p=>!p.ws))throw failure('Aguarde a conexão dos dois jogadores.',409,'paused');if(!plain(a))throw failure('Argumentos inválidos.');const stop=msg.action==='order'&&a.type==='stop';if(g.mode==='turns'&&(g.turn!==side||g.busy&&!stop))throw failure('Aguarde seu turno e o fim da ação.',409,'turn');
  const owned=n=>{if(!id(n))throw failure('Unidade inválida.');const u=g.get(n);if(!u||u.owner!==side||u.hp<=0)throw failure('Esta unidade não pertence a você.',403,'ownership');return u;};
  const ownIds=ids=>{if(!Array.isArray(ids)||!ids.length||ids.length>128||ids.some(n=>!id(n)))throw failure('Seleção inválida.');ids.forEach(owned);return [...new Set(ids)];};
  const point=p=>{if(!plain(p)||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.x>=128||p.y<0||p.y>=96)throw failure('Posição inválida.');return {x:p.x,y:p.y};};
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
   case 'enqueue':{const base=owned(a.baseId);if(typeof a.type!=='string'||!Object.hasOwn(TYPES,a.type))throw failure('Tropa inválida.');return g.enqueue(side,a.type,base);}
   case 'requestAirdrop':{const base=owned(a.baseId);if(!plain(a.cargo))throw failure('Carga inválida.');return g.requestAirdrop(side,base.id,a.cargo,a.destination===undefined||a.destination===null?undefined:point(a.destination));}
   case 'boardPurchase':{const base=owned(a.baseId);if(typeof a.type!=='string'||!Object.hasOwn(TYPES,a.type))throw failure('Tropa inválida.');return g.boardPurchase(side,base.id,a.type);}
   case 'endTurn':return g.endTurn(side);
   case 'setWeapon':{const ids=ownIds(a.ids||[a.id]);if(typeof a.weapon!=='string')throw failure('Arma inválida.');return ids.map(n=>g.setWeapon(owned(n),a.weapon)).some(Boolean);}
   case 'setRadar':if(typeof a.on!=='boolean')throw failure('Radar inválido.');return g.setRadar(owned(a.id),a.on);
   case 'buildAirport':return g.buildAirport(ownIds(a.ids),point(a.cell||a));
   case 'assignAirportWorkers':return g.assignAirportWorkers(owned(a.siteId),ownIds(a.ids));
   case 'servicePlane':if(a.rearm!==undefined&&typeof a.rearm!=='boolean')throw failure('Manutenção inválida.');return g.servicePlane(owned(a.id),a.rearm!==false);
   default:throw failure('Comando desconhecido.');
  }
 };
 wss.on('connection',ws=>{
  sockets.add(ws);ws.alive=true;ws.rateAt=now();ws.rateCount=0;const authTimer=setTimeout(()=>{if(!ws.player)ws.close(1008,'Autenticação necessária');},10000);authTimer.unref();ws.on('pong',()=>ws.alive=true);
  ws.on('message',data=>{
   try{
    // Acima de 60 mensagens/s, ordens consomem o número de sequência e voltam recusadas (code 'rate'); sem isso toda ordem seguinte falharia por sequência até reconectar.
    if(now()-ws.rateAt>=1000){ws.rateAt=now();ws.rateCount=0;}const limited=++ws.rateCount>60;let msg;try{msg=JSON.parse(data.toString());}catch{throw failure('JSON inválido.');}if(!plain(msg)||typeof msg.type!=='string')throw failure('Mensagem inválida.');
    if(limited&&!(ws.player&&msg.type==='command'))throw failure('Muitas mensagens. Aguarde.',429,'rate');
    if(!ws.player){
     if(msg.type!=='auth'||msg.version!==1||typeof msg.code!=='string'||typeof msg.token!=='string')throw failure('Sessão inválida.',401,'auth');const room=rooms.get(msg.code);if(!room)throw failure('Sala indisponível ou encerrada.',404,'room_missing');const player=room.players.find(p=>p.token===msg.token);if(!player)throw failure('Sessão inválida.',401,'auth');
     if(room.status==='playing'&&room.players.some(p=>!p.ws&&now()-p.disconnectedAt>=graceMs)){const connected=room.players.find(p=>p.ws);finish(room,connected?.side,connected?'abandonment':'disconnected');}
     clearTimeout(authTimer);if(player.ws&&player.ws!==ws)player.ws.close(1000,'Sessão retomada em outra aba');player.ws=ws;player.disconnectedAt=null;player.terrainRevision=-1;player.eventCursor=room.game?.nextEventSeq||0;ws.player=player;ws.room=room;room.lastTouch=now();room.paused=room.status==='playing'&&room.players.some(p=>!p.ws);send(ws,{type:'authenticated',side:player.side,lastSeq:player.lastSeq});broadcast(room);return;
    }
    const room=ws.room,player=ws.player;if(!rooms.has(room.code)||player.ws!==ws)throw failure('Sala indisponível ou encerrada.',404,'room_missing');room.lastTouch=now();
    if(msg.type==='command'){
     if(!id(msg.seq))throw failure('Número de comando inválido.');if(msg.seq<=player.lastSeq){send(ws,player.acks.get(msg.seq)||{type:'ack',seq:msg.seq,ok:false,duplicate:true});return;}if(msg.seq!==player.lastSeq+1)throw failure('Sequência de comandos inválida.',409,'sequence');
     player.lastSeq=msg.seq;let ack;try{if(limited)throw failure('Muitas ordens de uma vez. Aguarde um instante.',429,'rate');const ok=!!applyCommand(room,player,msg);ack={type:'ack',seq:msg.seq,ok,...(!ok?{message:'Ação indisponível neste estado.'}:{})};}catch(e){ack={type:'ack',seq:msg.seq,ok:false,message:e.status?e.message:'Comando inválido.',code:e.code||'invalid'};}player.acks.set(msg.seq,ack);while(player.acks.size>128)player.acks.delete(player.acks.keys().next().value);send(ws,ack);return;
    }
    if(msg.type==='leave'){abandon(room,player);player.ws=null;ws.close(1000,'Você saiu da sala');return;}
    if(msg.type==='rematch'){
     if(room.status!=='finished'||room.players.some(p=>!p.ws))throw failure('Revanche indisponível.');player.rematch=true;if(room.players.every(p=>p.rematch)){room.status='waiting';room.game=null;room.result=null;room.paused=false;for(const p of room.players){p.side=other(p.side);p.ready=false;p.rematch=false;p.army={...STARTING_DEFAULT};p.lastSeq=0;p.acks.clear();p.eventCursor=0;p.terrainRevision=-1;}room.terrainRevision=0;}broadcast(room);return;
    }
    if(room.status!=='waiting')throw failure('A partida já começou.');
    if(msg.type==='configure'){if(!player.host)throw failure('Somente o anfitrião pode configurar.',403,'host');room.config=config(msg.config,room.config);room.players.forEach(p=>p.ready=false);}
    else if(msg.type==='prepare'){if(msg.army!==undefined)player.army=army(msg.army,player.side);if(msg.doctrine!==undefined){if(!Object.hasOwn(NATION_DOCTRINES,msg.doctrine))throw failure('Doutrina inválida.');player.doctrine=msg.doctrine;}room.players.forEach(p=>p.ready=false);}
    else if(msg.type==='ready'){if(typeof msg.ready!=='boolean')throw failure('Confirmação inválida.');player.ready=msg.ready;}
    else if(msg.type==='start'){
     if(!player.host||room.players.length!==2||room.players.some(p=>!p.ready||!p.ws))throw failure('Os dois jogadores precisam estar conectados e prontos.');const c=room.config,doctrines={},armies={};for(const p of room.players){doctrines[p.side]=p.doctrine;armies[p.side]=p.army;p.eventCursor=0;p.terrainRevision=-1;p.lastSeq=0;p.acks.clear();}
     const privateRandom=()=>crypto.randomInt(0,0x100000000)/0x100000000;room.game=new Game(c.map,'normal',c.seed,c.mode,c.options,doctrines,armies,privateRandom);room.game.multiplayer=true;room.game.aiEnabled=false;room.game.rng=privateRandom;room.game.radarRng=privateRandom;room.game.logs=[];room.game.events=[];room.game.log('Partida multiplayer iniciada.',['blue','red']);for(const p of room.players){p.knownTerrain=null;p.knownTerrainRevision=0;}room.status='playing';room.paused=false;room.matchId++;room.terrainRevision=0;
    }else throw failure('Mensagem desconhecida.');broadcast(room);
   }catch(e){issue(ws,e);if(!ws.player)ws.close(1008,'Sessão inválida');}
  });
  ws.on('close',()=>{clearTimeout(authTimer);sockets.delete(ws);const p=ws.player,r=ws.room;if(!p||p.ws!==ws)return;p.ws=null;p.disconnectedAt=now();if(closing)return;if(r.status==='playing')r.paused=true;else if(r.status==='waiting')r.players.forEach(q=>q.ready=false);broadcast(r);});ws.on('error',()=>{});
 });
 const clock=autoTick?setInterval(tick,1000/30):null;if(clock)clock.unref();const heartbeat=setInterval(()=>{for(const ws of sockets){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},25000);heartbeat.unref();
 const close=()=>new Promise(resolve=>{closing=true;if(clock)clearInterval(clock);clearInterval(heartbeat);for(const ws of sockets)ws.terminate();wss.close(()=>{if(server.listening)server.close(resolve);else resolve();});});
 return {server,rooms,tick,broadcast,close,viewState:(room,side)=>viewState(room,room.players.find(p=>p.side===side))};
}
module.exports={createMultiplayerServer};
if(require.main===module){const multiplayer=createMultiplayerServer();multiplayer.server.listen(Number(process.env.PORT)||5173,'0.0.0.0',()=>console.log('rtsvibe multiplayer em http://localhost:'+multiplayer.server.address().port));for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>multiplayer.close().then(()=>process.exit(0)));}
