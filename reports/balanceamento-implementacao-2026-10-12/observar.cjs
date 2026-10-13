'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=process.env.RTS_AI_ENGINE||'public/js/engine.js',code=fs.readFileSync(source,'utf8'),ctx=vm.createContext({console});
vm.runInContext(code+'\nthis.api={Game,TYPES};',ctx);const {Game,TYPES}=ctx.api;
const result={source,sourceHash:crypto.createHash('sha256').update(code).digest('hex'),limit:'Normal, semente 44, jogador azul sem ordens; 300 segundos RTS ou 48 ciclos em turnos.',matches:[]};
for(const map of ['river','desert','mountain','random'])for(const mode of ['rts','turns']){
 const g=new Game(map,'normal',44,mode),stats={embarks:0,delivered:0,airdropPurchases:0,carrierPurchases:0,redHeliSalvos:0};
 const order=g.order,enqueue=g.enqueue,request=g.requestAirdrop;
 g.order=function(u,type,...args){const cargo=u.cargo?.length||0,ok=order.call(this,u,type,...args);if(ok&&u.owner==='red'){if(type==='embark')stats.embarks++;if(type==='disembark')stats.delivered+=cargo-(u.cargo?.length||0);if(type==='bombard'&&u.type==='transportHelicopter')stats.redHeliSalvos++;}return ok;};
 g.enqueue=function(owner,type,...args){const ok=enqueue.call(this,owner,type,...args);if(ok&&owner==='red'&&TYPES[type].capacity)stats.carrierPurchases++;return ok;};
 g.requestAirdrop=function(owner,...args){const ok=request.call(this,owner,...args);if(ok&&owner==='red')stats.airdropPurchases++;return ok;};
 function tick(){g.update(1/30);if(Math.round(g.time*30)%30===0)g.events=[];assert.ok(g.credits.red>=0);}
 if(mode==='rts')for(let i=0;i<300*30&&!g.winner;i++)tick();else for(let cycle=0;cycle<48&&!g.winner;cycle++){assert.equal(g.turn,'blue');assert.ok(g.endTurn('blue'));let n=0;while((g.turn!=='blue'||g.busy)&&!g.winner&&n++<18000)tick();assert.ok(n<18000,'turno bloqueado');}
 const row={map,mode,seed:44,time:g.time,round:g.round,...stats,credits:g.credits.red,posts:g.structures.filter(s=>s.type==='post'&&s.owner==='red').length,losses:g.stats.red.losses,winner:g.winner};result.matches.push(row);console.log(JSON.stringify(row));
 fs.writeFileSync(process.env.RTS_TRANSPORT_OBSERVATION||__dirname+'/natural-depois.json',JSON.stringify(result,null,2));
}
assert.equal(result.matches.length,8);
