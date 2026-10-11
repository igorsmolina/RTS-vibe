'use strict';
// Roda os testes de desempenho em sequência, um processo por vez (sem concorrência que distorça o tempo), segue mesmo se um falhar
// e no fim gera o resumo (perf-summary). Uso: node tests/perf-run.cjs [quick|full|soak|baseline]. Sai com 1 se algum falhou.
const {spawnSync}=require('node:child_process'),path=require('node:path');
const existing=['camera-performance.browser','plane-flight-performance','plane-flight-performance.browser','stress.browser','zoom.browser','exploration.browser','flight-path-performance','flight-path.browser','structures-fx.browser','battlefield-performance.browser'];
const node=['engine-scaling','pathfinding-worst','ai-spikes','combat-burst','turns-ai','production-load','vision-load'];
const browser=['zoom-performance.browser','cold-cache.browser','frame-breakdown.browser','screen-size.browser','resize.browser','quality-switch.browser','fog-reveal.browser','minimap-load.browser','selection-load.browser',
 'heavy-combat-camera.browser','visibility.browser','speed-change.browser','startup.browser','ui-dom.browser','dialogs-in-battle.browser','save-load.browser'];
const groups={
 quick:['zoom-performance.browser','cold-cache.browser','frame-breakdown.browser','engine-scaling','heavy-combat-camera.browser'],
 soak:['soak.browser','restart.browser'],
 full:[...existing,...node,...browser,'soak.browser','restart.browser','multiplayer-load.browser.integration']
};
groups.baseline=groups.full;
const group=process.argv[2]||'full',list=groups[group];if(!list){console.error('grupo desconhecido: '+group);process.exit(2);}
const env={...process.env,...(group==='baseline'?{RTS_WRITE_BASELINE:'1',RTS_REPORT_ONLY:'1'}:{})},failed=[],started=Date.now();
for(const name of list){
 const file=path.join(__dirname,name+(name.endsWith('.integration')?'.cjs':'.test.cjs')),t=Date.now();console.log(`\n▶ ${name}`);
 const r=spawnSync(process.execPath,[file],{stdio:'inherit',env});const s=((Date.now()-t)/1000).toFixed(0);
 if(r.status!==0){failed.push(name);console.log(`✗ ${name} (${s} s)`);}else console.log(`✓ ${name} (${s} s)`);
}
spawnSync(process.execPath,[path.join(__dirname,'perf-summary.cjs')],{stdio:'inherit'});
console.log(`\n${list.length-failed.length}/${list.length} testes de desempenho passaram em ${((Date.now()-started)/60000).toFixed(1)} min.`+(failed.length?' Falharam: '+failed.join(', '):''));
process.exitCode=failed.length?1:0;
