'use strict';
// Núcleo do multiplayer (o mesmo código roda no servidor e no navegador do anfitrião), com sockets falsos e sem rede.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const names='Game,TYPES,MAPS,NATION_DOCTRINES,PROCEDURAL,STARTING_DEFAULT,STARTING_BUDGET,UNIT_CAP,startingCatalog,armyCost,cleanStartingArmy,STEP,SIZE,KEY,TILE,AIR,MISSILE';
const engine=new Function(fs.readFileSync(path.join(__dirname,'..','public','js','engine.js'),'utf8')+String.fromCharCode(10)+'return {'+names+'};')();
const {createCore}=require('../public/js/multiplayer-core.js');
let time=1000;const core=createCore(engine,{now:()=>time});
function socket(){const s={inbox:[],closed:null,send(text){this.inbox.push(JSON.parse(text));},close(code,reason){this.closed={code,reason};}};core.attach(s);return s;}
const say=(s,message)=>core.receive(s,JSON.stringify(message)),last=(s,type)=>s.inbox.filter(m=>m.type===type).at(-1);
function pair(){
 const host=socket(),guest=socket(),created=core.createRoom('Anfitrião',{map:'river',mode:'rts',seed:5});
 say(host,{type:'auth',version:1,code:created.code,token:created.token});
 say(guest,{type:'join',version:1,code:created.code,nickname:'Convidado'});const joined=last(guest,'joined');
 say(guest,{type:'auth',version:1,code:created.code,token:joined.token});
 return {host,guest,code:created.code,room:core.rooms.get(created.code),joined};
}
const start=(a)=>{for(const s of [a.host,a.guest])say(s,{type:'ready',ready:true});say(a.host,{type:'start'});assert.equal(a.room.status,'playing');};

{const a=pair();
 assert.equal(a.joined.side,'red');assert.equal(a.room.players.length,2);assert.ok(last(a.guest,'authenticated'));
 // entrar sem código válido ou com sala cheia é recusado, e a conexão é fechada
 const stranger=socket();say(stranger,{type:'join',version:1,code:a.code,nickname:'Terceiro'});assert.equal(last(stranger,'error').code,'room_full');assert.ok(stranger.closed);
 const lost=socket();say(lost,{type:'join',version:1,code:'ZZZZZZZZ',nickname:'X'});assert.equal(last(lost,'error').code,'room_missing');
 console.log('OK entrar na sala sem HTTP: token, auth e sala cheia');}

{const a=pair();
 // facção: sem escolha acompanha o lado; escolha explícita vale para o exército e para o jogo
 say(a.guest,{type:'prepare',faction:'blue'});
 assert.equal(a.room.players[1].faction,'blue');
 say(a.guest,{type:'prepare',faction:'verde'});assert.equal(last(a.guest,'error').message,'Unidades inválidas.');
 start(a);
 assert.deepEqual({...a.room.game.factions},{blue:'blue',red:'blue'});
 assert.ok(a.room.game.units.filter(u=>u.owner==='red').every(u=>u.faction==='blue'));
 console.log('OK facção escolhida vira o exército do jogador');}

{const a=pair();start(a);
 // desistir: o adversário vence e os dois podem pedir revanche
 say(a.guest,{type:'surrender'});
 assert.equal(a.room.status,'finished');assert.deepEqual({...a.room.result},{winner:'blue',reason:'surrender'});
 assert.equal(last(a.host,'result').winner,'blue');assert.equal(a.room.game.winner,'blue');
 say(a.host,{type:'rematch'});say(a.guest,{type:'rematch'});
 assert.equal(a.room.status,'waiting');assert.equal(a.room.players.find(p=>p.host).side,'red');
 // fora de partida, desistir não faz nada
 say(a.guest,{type:'surrender'});assert.equal(last(a.guest,'error').message,'Não há partida em andamento.');
 console.log('OK desistir dá vitória ao adversário e permite revanche');}

{const a=pair();start(a);
 // encerrar: só o anfitrião, e a partida acaba sem vencedor
 say(a.guest,{type:'end'});assert.equal(last(a.guest,'error').code,'host');assert.equal(a.room.status,'playing');
 say(a.host,{type:'end'});assert.equal(a.room.status,'cancelled');assert.equal(a.room.result.reason,'host_ended');assert.equal(a.room.result.winner,null);
 console.log('OK só o anfitrião encerra a partida');}

{const a=pair();start(a);
 // ordens passam pelo mesmo núcleo: o convidado só comanda unidades dele
 const own=a.room.game.units.find(u=>u.owner==='red'&&u.type==='infantry'),foe=a.room.game.units.find(u=>u.owner==='blue'&&u.type==='infantry');
 say(a.guest,{type:'command',seq:1,action:'order',args:{ids:[foe.id],type:'stop',args:{}}});assert.equal(last(a.guest,'ack').code,'ownership');
 say(a.guest,{type:'command',seq:2,action:'order',args:{ids:[own.id],type:'stop',args:{}}});assert.equal(last(a.guest,'ack').ok,true);
 // o estado enviado aos dois jogadores é independente e sem a rota duplicada
 core.tick();core.tick();core.tick();
 const state=last(a.guest,'state');assert.equal(state.side,'red');assert.equal(state.state.playerSide,'red');assert.deepEqual({...state.state.factions},{blue:'blue',red:'red'});
 assert.ok(state.state.units.every(u=>!('job' in u)));
 console.log('OK ordens, propriedade e estado por jogador');}

{const a=pair();start(a);
 // queda de conexão: a sala pausa e o abandono só vem depois do prazo
 core.detach(a.guest);assert.equal(a.room.paused,true);time+=119000;core.tick();assert.equal(a.room.status,'playing');
 time+=2000;core.tick();assert.equal(a.room.status,'finished');assert.equal(a.room.result.reason,'abandonment');
 console.log('OK reconexão: prazo de dois minutos antes do abandono');}
console.log('núcleo do multiplayer: verificações concluídas');
