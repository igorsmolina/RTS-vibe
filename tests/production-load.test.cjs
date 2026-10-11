'use strict';
// Produção pesada: QG e postos com filas cheias nos dois lados, muitas unidades nascendo juntas por 3 min RTS.
const {engine,ticks,tickStats,suite}=require('./perf-kit.cjs');
const {Game}=engine(),S=suite('production-load');
const g=new Game('river','normal',5,'rts',{posts:32});g.aiEnabled=false;g.credits={blue:1e6,red:1e6};
for(const s of g.structures)if(s.owner==='neutral')s.owner=s.x<64?'blue':'red';
const kinds=['infantry','tank','antitank','recon','artillery','machinegun'],before=g.units.length;let queued=0;
const refill=()=>{for(const owner of ['blue','red'])for(const base of g.producers(owner))for(let k=0;k<12;k++)if(g.enqueue(owner,kinds[(k+base.id)%kinds.length],base))queued++;};
refill();const bases=['blue','red'].reduce((n,o)=>n+g.producers(o).length,0);
const t=ticks(g,30*180,undefined,i=>{if(i%300===0)refill();});
S.budget('3 min de filas cheias',{bases,queued,spawned:g.units.length-before,...tickStats(t)});
S.expect(bases>=6,`só ${bases} produtores`);S.expect(g.units.length-before>=50,`só ${g.units.length-before} unidades nasceram`);
S.finish('produção com filas cheias medida.');
