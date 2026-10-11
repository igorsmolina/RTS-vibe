'use strict';
// IA em todas as dificuldades: 200 unidades vermelhas contra 100 azuis em RTS. Maior tick, p99 e fila da IA limitada.
// RTS_AI_MINUTES muda a duração (padrão 5 min de jogo por dificuldade).
const {battle,ticks,tickStats,suite}=require('./perf-kit.cjs');
const S=suite('ai-spikes'),MINUTES=Number(process.env.RTS_AI_MINUTES)||5;
for(const difficulty of ['easy','normal','hard','veteran']){
 const g=battle({blue:100,red:200,planes:8,ai:true,difficulty});g.credits.red=5000;let queue=0;const before=g.aiDecisions;
 const t=ticks(g,MINUTES*60*30,undefined,()=>{queue=Math.max(queue,g.aiQueue.length);for(const s of g.structures)if(s.type==='hq')s.hp=s.maxHp;g.winner=null;});
 const s={...tickStats(t),aiQueueMax:queue,aiDecisions:g.aiDecisions-before,redUnits:g.units.filter(u=>u.owner==='red').length};S.budget(difficulty,s);
 S.expect(queue<=g.units.length+20,`${difficulty}: fila da IA chegou a ${queue} para ${g.units.length} unidades`);
}
S.finish(`IA por ${MINUTES} min em todas as dificuldades, sem fila crescente.`);
