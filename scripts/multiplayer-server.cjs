'use strict';
// Servidor do multiplayer: HTTP (arquivos, /health, /api/rooms) e WebSocket. Salas, regras e estado ficam em
// public/js/multiplayer-core.js, o mesmo núcleo que roda no navegador do anfitrião (Web Worker).
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {WebSocketServer}=require('ws');
const publicRoot=path.resolve(__dirname,'..','public');
// O motor roda como função e não em vm.runInContext: o contexto vm deixa Math, Object e os demais globais ~5× mais lentos (tick de 300 unidades em marcha: 43 → 10 ms).
const NAMES='Game,TYPES,MAPS,NATION_DOCTRINES,PROCEDURAL,STARTING_DEFAULT,STARTING_BUDGET,UNIT_CAP,startingCatalog,armyCost,cleanStartingArmy,STEP,SIZE,KEY,TILE,AIR,MISSILE';
const engine=new Function(fs.readFileSync(path.join(publicRoot,'js','engine.js'),'utf8')+String.fromCharCode(10)+'return {'+NAMES+'};')();
const {createCore}=require(path.join(publicRoot,'js','multiplayer-core.js'));
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav'};
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o),failure=(message,status=400,code='invalid')=>Object.assign(new Error(message),{status,code});
function createMultiplayerServer({graceMs=120000,now=Date.now,autoTick=true,maxRooms=16}={}){
 const core=createCore(engine,{graceMs,now,maxRooms}),{rooms,sockets,load}=core;
 const server=http.createServer(async(req,res)=>{
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  try{
   const url=new URL(req.url,'http://local');if(url.pathname==='/health'){json(200,{ok:true,multiplayer:true,rooms:rooms.size,tickRate:load.tickRate,cpu:load.cpu});return;}
   if(url.pathname.startsWith('/api/')){
    if(req.method!=='POST')throw failure('Método inválido.',405);let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)throw failure('Mensagem muito grande.',413);}let body;try{body=JSON.parse(raw);}catch{throw failure('JSON inválido.');}if(!plain(body))throw failure('Mensagem inválida.');
    if(url.pathname==='/api/rooms'){json(201,core.createRoom(body.nickname,body.config));return;}
    const match=url.pathname.match(new RegExp('^/api/rooms/([A-Z0-9]{8})/join$'));if(!match)throw failure('Sala indisponível ou encerrada.',404,'room_missing');
    const {code,token,side,room}=core.joinRoom(match[1],body.nickname);json(201,{code,token,side});core.broadcast(room);return;
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
   let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}
   const file=path.resolve(publicRoot,'.'+pathname.replace(new RegExp('/$'),'/index.html'));if(!file.startsWith(publicRoot+path.sep)){res.writeHead(403).end();return;}
   fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Não encontrado');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);});
  }catch(e){json(e.status||500,{error:e.status?e.message:'Não foi possível abrir a sala.',code:e.code||'invalid'});}
 });
 // Nível 1: um estado de ~170 KB comprime em 0,4 ms (nível 6: 1,3 ms) e a CPU da hospedagem gratuita é curta.
 const wss=new WebSocketServer({noServer:true,maxPayload:16384,perMessageDeflate:{threshold:1024,serverNoContextTakeover:true,clientNoContextTakeover:true,zlibDeflateOptions:{level:1}}});
 server.on('upgrade',(req,socket,head)=>{try{const url=new URL(req.url,'http://local');if(url.pathname!=='/multiplayer'||req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));}catch{socket.destroy();}});
 wss.on('connection',ws=>{
  core.attach(ws);ws.alive=true;ws.on('pong',()=>ws.alive=true);
  ws.on('message',data=>core.receive(ws,data.toString()));
  ws.on('close',()=>core.detach(ws));ws.on('error',()=>{});
 });
 const clock=autoTick?setInterval(core.tick,1000/30):null;if(clock)clock.unref();const heartbeat=setInterval(()=>{for(const ws of sockets){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},25000);heartbeat.unref();
 const close=()=>new Promise(resolve=>{core.close();if(clock)clearInterval(clock);clearInterval(heartbeat);for(const ws of sockets)ws.terminate();wss.close(()=>{if(server.listening)server.close(resolve);else resolve();});});
 return {server,rooms,tick:core.tick,broadcast:core.broadcast,close,viewState:core.viewState};
}
module.exports={createMultiplayerServer};
if(require.main===module){const multiplayer=createMultiplayerServer();multiplayer.server.listen(Number(process.env.PORT)||5173,'0.0.0.0',()=>console.log('rtsvibe multiplayer em http://localhost:'+multiplayer.server.address().port));for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>multiplayer.close().then(()=>process.exit(0)));}
