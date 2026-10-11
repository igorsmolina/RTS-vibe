'use strict';
// Turno da IA com 200 e 400 unidades no modo por turnos: duração do turno em tempo de jogo, maior bloco síncrono (um update)
// e custo de encerrar o turno do jogador. Um bloco acima de 100 ms é uma travada visível.
const {battle,quantiles,suite}=require('./perf-kit.cjs');
const S=suite('turns-ai');
for(const n of [200,400]){
 const g=battle({mode:'turns',blue:n/2,red:n/2,ai:true,attack:false});g.credits.red=3000;
 let t=performance.now();const ok=g.endTurn('blue');const endMs=performance.now()-t;S.expect(ok,'encerrar o turno azul');
 const blocks=[];let ticks=0;while(g.turn!=='blue'&&ticks<30*900&&!g.winner){t=performance.now();g.update(1/30);blocks.push(performance.now()-t);g.events.length=0;ticks++;}
 const q=quantiles(blocks);S.expect(g.turn==='blue',`${n}: o turno da IA não terminou em ${ticks} ticks`);
 S.budget(n+' unidades',{endTurnMs:Math.round(endMs*10)/10,turnGameSeconds:Math.round(ticks/30),turnCpuMs:Math.round(blocks.reduce((a,b)=>a+b,0)),tickP95:q.p95,tickP99:q.p99,tickMax:q.max,aiDecisions:g.aiDecisions});
}
S.finish('turno da IA com 200 e 400 unidades medido.');
