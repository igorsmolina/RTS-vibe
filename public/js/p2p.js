'use strict';
/* Hospedagem pelo navegador. A sala (motor + núcleo do multiplayer) roda num Web Worker do anfitrião; o convidado conecta
   por WebRTC (canal de dados). O ntfy.sh só carrega a oferta e a resposta da conexão, nunca a partida.
   Os "sockets" devolvidos têm a cara de um WebSocket (send, close, readyState, addEventListener) para o multiplayer.js. */
const P2P=(()=>{
 const ICE=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}];
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const topic=code=>(window.RTS_SIGNAL||'https://ntfy.sh')+'/rts-vibe-sala-'+String(code).toLowerCase();
 const randomId=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>b.toString(16).padStart(2,'0')).join('');
 // Compressão do texto (ofertas WebRTC e estados do jogo): deflate-raw nativo do navegador.
 const deflate=async text=>new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
 const inflate=async bytes=>new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
 const toBase64=bytes=>{let text='';for(const b of bytes)text+=String.fromCharCode(b);return btoa(text);};
 const pack=async text=>toBase64(await deflate(text)),unpack=async data=>inflate(Uint8Array.from(atob(data),c=>c.charCodeAt(0)));
 async function post(code,message){const response=await fetch(topic(code),{method:'POST',body:JSON.stringify(message)});if(!response.ok)throw Error('Sinalização indisponível ('+response.status+').');}
 async function poll(code,since){
  const response=await fetch(topic(code)+'/json?poll=1&since='+(since||'all'));if(!response.ok)throw Error('Sinalização indisponível ('+response.status+').');
  return (await response.text()).split(String.fromCharCode(10)).filter(Boolean).map(line=>JSON.parse(line)).filter(e=>e.event==='message');
 }
 const gathered=(pc,limit=5000)=>new Promise(resolve=>{if(pc.iceGatheringState==='complete'){resolve();return;}const done=()=>{if(pc.iceGatheringState==='complete'){pc.removeEventListener('icegatheringstatechange',done);resolve();}};pc.addEventListener('icegatheringstatechange',done);setTimeout(resolve,limit);});
 // Canal de dados com ordem preservada: textos grandes (estados de 60–180 KB) vão comprimidos, os pequenos direto.
 function wrap(channel){
  channel.binaryType='arraybuffer';const listeners=new Set();let inbound=Promise.resolve(),outbound=Promise.resolve();
  channel.addEventListener('message',event=>{inbound=inbound.then(async()=>{const text=typeof event.data==='string'?event.data:await inflate(event.data);for(const f of listeners)f(text);});});
  return {channel,onText:f=>listeners.add(f),get open(){return channel.readyState==='open';},
   send(text){outbound=outbound.then(async()=>{if(channel.readyState!=='open')return;channel.send(text.length>1024?await deflate(text):text);});}};
 }
 const opened=(channel,limit=25000)=>new Promise((resolve,reject)=>{if(channel.readyState==='open'){resolve();return;}const timer=setTimeout(()=>reject(Error('Não foi possível conectar ao anfitrião. A rede de um dos dois pode bloquear a conexão direta.')),limit);channel.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});});
 // Objeto com a interface de WebSocket usada pelo multiplayer.js.
 function fakeSocket({send,close,isOpen,subscribe}){
  const target=new EventTarget(),socket={get readyState(){return isOpen()?1:3;},send,close,addEventListener:(type,handler)=>target.addEventListener(type,handler)};
  subscribe(text=>target.dispatchEvent(new MessageEvent('message',{data:text})),reason=>target.dispatchEvent(Object.assign(new Event('close'),{reason})));
  setTimeout(()=>target.dispatchEvent(new Event('open')),0); // depois que quem recebeu o socket anexou os ouvintes
  return socket;
 }

 async function host(nickname,config){
  if(!window.Worker||!window.RTCPeerConnection||!window.CompressionStream)throw Error('Este navegador não suporta hospedar pelo navegador. Use um servidor ou outro navegador.');
  const worker=new Worker('js/host-worker.js'),sinks=new Map(),channels=new Map();let stopped=false,guests=0;
  const created=await new Promise((resolve,reject)=>{worker.onerror=e=>reject(Error('Não foi possível iniciar a sala: '+(e.message||'erro no worker')));worker.addEventListener('message',({data})=>{if(data.type==='hosted')data.error?reject(Error(data.error)):resolve(data);},{once:true});worker.postMessage({type:'host',nickname,config});});
  worker.onerror=null;
  worker.addEventListener('message',({data})=>{
   if(data.type==='out')(channels.get(data.id)?.send??sinks.get(data.id)?.text)?.call(null,data.text);
   else if(data.type==='closed'){channels.get(data.id)?.channel.close();sinks.get(data.id)?.close('');}
  });
  const code=created.code,answered=new Set();let since='',fastUntil=Date.now()+90000;
  async function accept(offer){
   const pc=new RTCPeerConnection({iceServers:ICE});
   pc.addEventListener('datachannel',({channel})=>{
    const id='g'+(++guests),wrapped=wrap(channel);channels.set(id,wrapped);worker.postMessage({type:'open',id});
    wrapped.onText(text=>worker.postMessage({type:'in',id,text}));
    channel.addEventListener('close',()=>{worker.postMessage({type:'close',id});channels.delete(id);pc.close();fastUntil=Date.now()+90000;});
   });
   await pc.setRemoteDescription({type:'offer',sdp:await unpack(offer.sdp)});await pc.setLocalDescription(await pc.createAnswer());await gathered(pc);
   await post(code,{kind:'answer',to:offer.id,sdp:await pack(pc.localDescription.sdp)});
  }
  (async()=>{
   while(!stopped){
    try{for(const message of await poll(code,since)){since=message.id;const data=JSON.parse(message.message);if(data.kind==='offer'&&!answered.has(data.id)){answered.add(data.id);accept(data).catch(()=>answered.delete(data.id));}}}catch{}
    // O ntfy.sh limita as consultas (rajada de 60, depois 1 a cada 5 s): rápido enquanto espera alguém e devagar depois.
    await pause(Date.now()<fastUntil?2000:10000);
   }
  })();
  return {code,token:created.token,side:created.side,hosting:true,
   socket(){
    worker.postMessage({type:'open',id:'local'});
    return fakeSocket({send:text=>worker.postMessage({type:'in',id:'local',text}),close:()=>worker.postMessage({type:'close',id:'local'}),isOpen:()=>!stopped,
     subscribe:(onText,onClose)=>sinks.set('local',{text:onText,close:onClose})});
   },
   stop(){stopped=true;worker.terminate();for(const {channel} of channels.values())try{channel.close();}catch{}}};
 }

 // Convidado: oferta → resposta pelo ntfy → canal aberto. Reaproveitado para reconectar (a sessão continua válida pelo token).
 async function connect(code){
  const pc=new RTCPeerConnection({iceServers:ICE}),channel=pc.createDataChannel('rts'),id=randomId();
  await pc.setLocalDescription(await pc.createOffer());await gathered(pc);
  await post(code,{kind:'offer',id,sdp:await pack(pc.localDescription.sdp)});
  let since='',answered=false;const deadline=Date.now()+45000;
  while(!answered&&Date.now()<deadline){
   for(const message of await poll(code,since)){since=message.id;const data=JSON.parse(message.message);if(data.kind==='answer'&&data.to===id){await pc.setRemoteDescription({type:'answer',sdp:await unpack(data.sdp)});answered=true;}}
   if(!answered)await pause(1200);
  }
  if(!answered){pc.close();throw Error('O anfitrião não respondeu. Confira o código e se ele mantém a aba aberta.');}
  await opened(channel);return {pc,wrapped:wrap(channel)};
 }
 const guestSocket=({wrapped})=>fakeSocket({send:text=>wrapped.send(text),close:()=>wrapped.channel.close(),isOpen:()=>wrapped.open,
  subscribe:(onText,onClose)=>{wrapped.onText(onText);wrapped.channel.addEventListener('close',()=>onClose(''));}});
 async function join(code,nickname){
  const link=await connect(code);
  const joined=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('A sala não respondeu.')),10000);
   link.wrapped.onText(text=>{let message;try{message=JSON.parse(text);}catch{return;}if(message.type==='joined'){clearTimeout(timer);resolve(message);}else if(message.type==='error'){clearTimeout(timer);reject(Error(message.message||'Não foi possível entrar na sala.'));}});
   link.wrapped.send(JSON.stringify({type:'join',version:1,code,nickname}));
  });
  let first=link;
  return {code:joined.code,token:joined.token,side:joined.side,hosting:false,
   async socket(){const current=first||await connect(code);first=null;return guestSocket(current);},
   stop(){try{link.wrapped.channel.close();link.pc.close();}catch{}}};
 }
 // Retoma como convidado depois de recarregar a página: nova oferta e auth com o token guardado.
 const rejoin=code=>({code,hosting:false,async socket(){return guestSocket(await connect(code));},stop(){}});
 return {host,join,rejoin,supported:()=>!!(window.Worker&&window.RTCPeerConnection&&window.CompressionStream&&location.protocol!=='file:')};
})();
window.P2P=P2P;
