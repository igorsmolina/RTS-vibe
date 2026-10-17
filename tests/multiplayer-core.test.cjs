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
 // a sala comporta três jogadores; o quarto (ou um código inválido) é recusado, e a conexão é fechada
 const third=socket();say(third,{type:'join',version:1,code:a.code,nickname:'Terceiro'});assert.equal(last(third,'joined').side,'green');
 const stranger=socket();say(stranger,{type:'join',version:1,code:a.code,nickname:'Quarto'});assert.equal(last(stranger,'error').code,'room_full');assert.ok(stranger.closed);
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
{const a=pair();
 // três jogadores, cada um com o seu time de unidades; o verde começa com os franceses
 const third=socket();say(third,{type:'join',version:1,code:a.code,nickname:'Terceiro'});const j3=last(third,'joined');say(third,{type:'auth',version:1,code:a.code,token:j3.token});
 say(a.guest,{type:'prepare',faction:'franca'});say(third,{type:'prepare',faction:'red'});
 for(const s of [a.host,a.guest,third])say(s,{type:'ready',ready:true});
 say(a.host,{type:'start'});assert.equal(a.room.status,'playing');
 const game=a.room.game;
 assert.deepEqual(game.sides,['blue','red','green']);assert.deepEqual({...game.factions},{blue:'blue',red:'franca',green:'red'});
 assert.ok(['blue','red','green'].every(s=>game.hq(s)));
 // cada jogador só enxerga o próprio dinheiro
 core.tick();core.tick();core.tick();
 const view=last(third,'state').state;assert.equal(view.playerSide,'green');assert.equal(view.credits.green,game.credits.green);assert.equal(view.credits.blue,0);assert.equal(view.credits.red,0);
 // desistir com três vivos elimina só quem desistiu: a partida segue e ele vê a derrota
 say(third,{type:'surrender'});
 assert.equal(a.room.status,'playing');assert.ok(game.isOut('green'));assert.equal(game.units.filter(u=>u.owner==='green').length,0);assert.equal(game.winner,null);
 core.tick();core.tick();core.tick();assert.equal(last(third,'state').state.winner,'eliminated');assert.equal(last(a.host,'state').state.winner,null);
 say(third,{type:'command',seq:1,action:'endTurn',args:{}});assert.equal(last(third,'ack').code,'eliminated');
 say(third,{type:'surrender'});assert.equal(last(third,'error').message,'Você já foi eliminado.');
 // o jogador eliminado que cai da rede não pausa a partida
 core.detach(third);core.tick();assert.equal(a.room.paused,false);
 // com dois vivos, a desistência encerra: vence o outro
 say(a.guest,{type:'surrender'});
 assert.equal(a.room.status,'finished');assert.deepEqual({...a.room.result},{winner:'blue',reason:'surrender'});
 console.log('OK três jogadores: times próprios, estado por jogador, eliminação e vitória');}

{const a=pair();
 const third=socket();say(third,{type:'join',version:1,code:a.code,nickname:'Terceiro'});const j3=last(third,'joined');say(third,{type:'auth',version:1,code:a.code,token:j3.token});
 for(const s of [a.host,a.guest,third])say(s,{type:'ready',ready:true});say(a.host,{type:'start'});
 // quem fica sem rede por mais de dois minutos é eliminado; os outros dois seguem jogando
 core.detach(third);assert.equal(a.room.paused,true);time+=121000;core.tick();
 assert.equal(a.room.status,'playing');assert.ok(a.room.game.isOut('green'));assert.equal(a.room.paused,false);
 // quem caiu da rede não trava a revanche; os lados giram
 say(a.guest,{type:'surrender'});assert.equal(a.room.status,'finished');
 say(a.host,{type:'rematch'});say(a.guest,{type:'rematch'});
 assert.equal(a.room.status,'waiting');assert.deepEqual(a.room.players.map(p=>p.side).sort(),['blue','red']);
 console.log('OK três jogadores: queda de rede elimina e a revanche ignora quem saiu');}

{const a=pair();
 // na sala de espera, sair libera o lugar e os lados voltam a ser contíguos
 const third=socket();say(third,{type:'join',version:1,code:a.code,nickname:'Terceiro'});
 say(a.guest,{type:'leave'});assert.deepEqual(a.room.players.map(p=>p.side),['blue','red']);assert.equal(a.room.players[1].nickname,'Terceiro');
 console.log('OK sair da sala de espera reorganiza os lados');}
console.log('núcleo do multiplayer: verificações concluídas');
