'use strict';
// Anfitrião no navegador: o motor e o núcleo do multiplayer rodam aqui, fora da aba (a partida não para quando a aba perde o foco).
// A página fala com este worker por mensagens: {type:'host'} cria a sala; {type:'open'|'in'|'close',id} conecta cada jogador.
importScripts('engine.js','multiplayer-core.js');
const core=createCore({Game,TYPES,MAPS,NATION_DOCTRINES,PROCEDURAL,STARTING_DEFAULT,STARTING_BUDGET,UNIT_CAP,startingCatalog,armyCost,cleanStartingArmy,STEP,SIZE,KEY,TILE,AIR,MISSILE},{maxRooms:1});
const connections=new Map();
setInterval(core.tick,1000/30);
self.onmessage=({data})=>{
 if(data.type==='host'){
  try{self.postMessage({type:'hosted',...core.createRoom(data.nickname,data.config)});}catch(e){self.postMessage({type:'hosted',error:e.message});}
  return;
 }
 if(data.type==='open'){
  const socket={send:text=>self.postMessage({type:'out',id:data.id,text}),close:(code,reason)=>self.postMessage({type:'closed',id:data.id,code,reason})};
  connections.set(data.id,core.attach(socket));return;
 }
 const socket=connections.get(data.id);if(!socket)return;
 if(data.type==='in')core.receive(socket,data.text);
 else if(data.type==='close'){core.detach(socket);connections.delete(data.id);}
};
