'use strict';
// Junta tests/artifacts/perf/*.json numa tabela única (cenário × métricas principais), com a linha de base ao lado,
// as verificações que falharam e as metas de travada não atingidas. Grava tests/artifacts/perf/summary.md e imprime no terminal.
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'artifacts','perf');let baseline={};try{baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'artifacts','perf-baseline.json'),'utf8'));}catch{}
const KEYS=['p50','p95','max','over50pct','longTaskMax','drawP95','tickP95','tickP99','tickMax','heapGrowthMB','allocMBs'];
const lines=['# Desempenho: resumo','',`Gerado em ${new Date().toISOString()} a partir de ${dir}.`,'','| Teste | Cenário | '+KEYS.join(' | ')+' |','|'+'---|'.repeat(KEYS.length+2)];
const failures=[],missed=[];
for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort()){
 const r=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8')),key=r.test+(r.variant?'@'+r.variant:''),base=baseline[key]||{};
 for(const [scenario,v] of Object.entries(r.results||{})){if(Array.isArray(v))continue;
  const cell=k=>v[k]===undefined?'':String(v[k])+(typeof base[scenario]?.[k]==='number'&&base[scenario][k]!==v[k]?` (${base[scenario][k]})`:'');
  if(KEYS.some(k=>v[k]!==undefined))lines.push(`| ${key} | ${scenario} | ${KEYS.map(cell).join(' | ')} |`);}
 failures.push(...(r.failures||[]));missed.push(...(r.missed||[]));
}
lines.push('','Entre parênteses: valor da linha de base.','',`## Verificações que falharam (${failures.length})`,'',...failures.map(m=>'- '+m),'',`## Metas de travada não atingidas (${missed.length})`,'',...missed.map(m=>'- '+m));
fs.writeFileSync(path.join(dir,'summary.md'),lines.join('\n')+'\n');console.log(lines.join('\n'));
