'use strict';
// Base comum dos testes de performance: Chrome real offline, CPU limitada por CDP, ritmo de quadros, tarefas longas, heap,
// canvases e timers, orçamento (tests/perf-budget.json) e linha de base (tests/artifacts/perf-baseline.json).
// Variáveis: RTS_PUBLIC=<pasta public> mede outra cópia; RTS_REPORT_ONLY=1 só relata; RTS_STRICT=1 também falha nas metas de travada;
// RTS_THROTTLE=<n> troca a CPU 4× padrão; RTS_NO_GPU=1 desliga a GPU; RTS_WRITE_BASELINE=1 grava a linha de base.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=process.env.RTS_PUBLIC?path.resolve(process.env.RTS_PUBLIC):path.join(__dirname,'..','public');
const out=path.join(__dirname,'artifacts','perf'),baselineFile=path.join(__dirname,'artifacts','perf-baseline.json');fs.mkdirSync(out,{recursive:true});
const soft=!!process.env.RTS_REPORT_ONLY,strict=!!process.env.RTS_STRICT,writeBaseline=!!process.env.RTS_WRITE_BASELINE;
const THROTTLE=Number(process.env.RTS_THROTTLE)||4,variant=(THROTTLE!==4?'cpu'+THROTTLE:'')+(process.env.RTS_NO_GPU?'-nogpu':'');
const budgets=JSON.parse(fs.readFileSync(path.join(__dirname,'perf-budget.json'),'utf8'));
const readBaseline=()=>{try{return JSON.parse(fs.readFileSync(baselineFile,'utf8'));}catch{return {};}};

const quantiles=(values,extra={})=>{
 const f=[...values].sort((a,b)=>a-b),q=p=>f.length?f[Math.min(f.length-1,Math.floor(f.length*p))]:0,r=n=>Math.round(n*10)/10;
 return{n:f.length,mean:r(f.reduce((a,b)=>a+b,0)/Math.max(1,f.length)),p50:r(q(.5)),p95:r(q(.95)),p99:r(q(.99)),max:r(f.at(-1)||0),...extra};
};

// Roda antes dos scripts da página: tarefas longas, canvases criados e timers pendentes, mais o medidor de quadros __measure.
function probe(){
 window.__longTasks=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__longTasks.push({at:e.startTime,ms:Math.round(e.duration)});}).observe({type:'longtask',buffered:true});}catch{}
 window.__canvases=0;const create=Document.prototype.createElement;Document.prototype.createElement=function(tag,...a){if(String(tag).toLowerCase()==='canvas')window.__canvases++;return create.call(this,tag,...a);};
 const timers=window.__timers=new Set(),st=window.setTimeout,ct=window.clearTimeout,si=window.setInterval,ci=window.clearInterval;
 window.setTimeout=function(fn,...a){const id=st.call(window,function(...b){timers.delete(id);return typeof fn==='function'?fn.apply(this,b):undefined;},...a);timers.add(id);return id;};
 window.clearTimeout=id=>{timers.delete(id);ct.call(window,id);};
 window.setInterval=function(...a){const id=si.apply(window,a);timers.add('i'+id);return id;};window.clearInterval=id=>{timers.delete('i'+id);ci.call(window,id);};
 // Conta chamadas e tempo de obj[name] até restore().
 window.__wrap=(obj,name)=>{const original=obj[name],s={calls:0,ms:0,restore(){obj[name]=original;}};obj[name]=function(...a){s.calls++;const t=performance.now();try{return original.apply(this,a);}finally{s.ms+=performance.now()-t;}};return s;};
 // Partida com exércitos grandes, no padrão do stress.browser.test: blue em marcha de ataque contra red.
 window.__army=({map='river',mode='rts',seed=44,blue=150,red=150,planes=12,attack=true,ai=false}={})=>{
  for(const d of document.querySelectorAll('dialog[open]'))d.close();newOperation(map,'normal',seed,mode);game.aiEnabled=ai;
  const kinds=['infantry','infantry','engineer','antitank','machinegun','lightTank','tank','heavyTank','artillery','recon','missileInfantry','antiAirVehicle','helicopter','rocketArtillery','reconDrone','stealthDrone'];
  for(const [owner,total] of [['blue',blue],['red',red]]){let placed=0,i=0;while(placed<total&&i<6000){const x=owner==='blue'?34+i%12*2:78+i%12*2,y=(6+Math.floor(i/12)*3)%92;i++;try{if(game.add(owner,kinds[placed%kinds.length],x,y))placed++;}catch{}}}
  for(let i=0;i<planes;i++){const b=i<planes/2;try{game.add(b?'blue':'red',b?(i%2?'fighterBlue':'multiroleBlue'):(i%2?'fighterRed':'multiroleRed'),b?30+i*3:98-(i-planes/2)*3,50);}catch{}}
  game.updateVision();const own=game.units.filter(u=>u.owner==='blue');if(attack)for(const u of own)game.order(u,'attackMove',{x:100,y:48},true);
  setSelection([]);centerCamera(60,30);paused=true;updateUI();renderer.consume();return game.units.length;
 };
 // Mede quadros reais por requestAnimationFrame durante ms; step(i,now) roda no início de cada quadro (câmera, entrada, ordens).
 window.__measure=async(ms,step,{warmup=3,until}={})=>{
  const frames=[],draws=[],alloc=[],tasksBefore=window.__longTasks.length,canvasesBefore=window.__canvases,draw=renderer.draw;let i=0,last=performance.now(),heap=performance.memory?.usedJSHeapSize||0;
  renderer.draw=function(...a){const t=performance.now(),r=draw.apply(this,a);draws.push(performance.now()-t);return r;};
  const start=performance.now();
  try{await new Promise((done,fail)=>{const tick=now=>{try{if(i>=warmup)frames.push(now-last);last=now;const h=performance.memory?.usedJSHeapSize||0;if(h>heap)alloc.push(h-heap);heap=h;if(step)step(i,now);i++;if(now-start<ms&&!until?.())requestAnimationFrame(tick);else done();}catch(e){fail(e);}};requestAnimationFrame(tick);});}
  finally{renderer.draw=draw;}
  const seconds=(performance.now()-start)/1000,tasks=window.__longTasks.slice(tasksBefore);
  return{frames,draws,seconds,allocMBs:alloc.reduce((a,b)=>a+b,0)/1048576/seconds,longTasks:tasks.map(t=>t.ms),canvasesCreated:window.__canvases-canvasesBefore};
 };
}

async function launch(){
 const {chromium}=require('playwright-core');
 return chromium.launch({channel:'chrome',headless:true,args:['--enable-precise-memory-info',...(process.env.RTS_NO_GPU?['--disable-gpu']:[])]});
}
// Abre o jogo pronto para uso: offline, terreno e campo de batalha carregados, diálogos fechados. O throttle é ligado à parte (setup costuma ser lento).
async function open(browser,{viewport={width:1100,height:700},dpr=1,reducedMotion}={}){
 const context=await browser.newContext({viewport,deviceScaleFactor:dpr,...(reducedMotion?{reducedMotion:'reduce'}:{})}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await context.setOffline(true);await page.addInitScript(probe);
 const t0=Date.now();await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.evaluate(()=>terrainReady);await page.evaluate(()=>typeof battlefieldReady==='undefined'?null:battlefieldReady);
 const loadMs=Date.now()-t0;await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();});
 const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
 return{context,page,cdp,errors,loadMs,throttle:(rate=THROTTLE)=>cdp.send('Emulation.setCPUThrottlingRate',{rate}),close:()=>context.close()};
}
// Converte o resultado de __measure em métricas: quadros, desenho, alocação, tarefas longas e travadas.
function frameStats(m){
 const f=quantiles(m.frames),d=quantiles(m.draws);
 return{frames:f.n,fps:Math.round(f.n/Math.max(.001,m.seconds)*10)/10,p50:f.p50,p95:f.p95,p99:f.p99,max:f.max,over33:m.frames.filter(x=>x>33).length,over50:m.frames.filter(x=>x>50).length,
  over50pct:Math.round(m.frames.filter(x=>x>50).length/Math.max(1,f.n)*1000)/10,drawP50:d.p50,drawP95:d.p95,drawMax:d.max,allocMBs:Math.round(m.allocMBs*10)/10,
  longTasks:m.longTasks.length,longTaskMax:Math.max(0,...m.longTasks),canvasesCreated:m.canvasesCreated};
}
async function metrics(cdp,gc=true){
 if(gc)await cdp.send('HeapProfiler.collectGarbage');const m=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
 return{heapMB:Math.round(m.JSHeapUsedSize/1048576*100)/100,nodes:m.Nodes,listeners:m.JSEventListeners,layouts:m.LayoutCount,styles:m.RecalcStyleCount,layoutMs:m.LayoutDuration*1000,scriptMs:m.ScriptDuration*1000,taskMs:m.TaskDuration*1000};
}

// Coleta verificações de um arquivo de teste e grava o relatório. budget(scenario,values): tetos de perf-budget.json[test][scenario] (falha),
// metas de travada em perf-budget.json.targets (só falham com RTS_STRICT=1) e regressão de 20% sobre a linha de base.
function suite(test){
 const failures=[],missed=[],results={},cfg=budgets[test]||{},baseline=(readBaseline()[test+(variant?'@'+variant:'')])||{};
 const fail=message=>{if(soft)failures.push(message);else{write();assert.fail(message);}};
 const expect=(ok,message)=>{if(!ok)fail(message);};
 // Meta de travada: relatada sempre, só falha com RTS_STRICT=1. Para o que o jogo ainda não cumpre e deve passar a cumprir.
 const target=(ok,message)=>{if(ok)return;missed.push(test+' › '+message);if(strict)fail(message);};
 const write=()=>fs.writeFileSync(path.join(out,test+(variant?'@'+variant:'')+'.json'),JSON.stringify({test,variant,throttle:THROTTLE,root,failures,missed,results},null,2));
 function budget(scenario,values){
  results[scenario]={...results[scenario],...values};const caps={...cfg['*'],...cfg[scenario]},targets=budgets.targets||{};
  for(const [metric,limit] of Object.entries(caps))if(values[metric]!==undefined)expect(values[metric]<=limit,`${test} › ${scenario}: ${metric} ${values[metric]} > teto ${limit}`);
  for(const [metric,limit] of Object.entries(targets))if(values[metric]!==undefined&&values[metric]>limit){const m=`${test} › ${scenario}: ${metric} ${values[metric]} > meta de travada ${limit}`;missed.push(m);if(strict)fail(m);}
  const base=baseline[scenario]||{};
  for(const metric of budgets.regression||[])if(typeof base[metric]==='number'&&typeof values[metric]==='number'){const limit=base[metric]*1.2+(budgets.slack?.[metric]??2);expect(values[metric]<=limit,`${test} › ${scenario}: ${metric} ${values[metric]} piorou mais de 20% sobre a linha de base ${base[metric]}`);}
 }
 function finish(message){
  write();
  if(writeBaseline){const all=readBaseline();all[test+(variant?'@'+variant:'')]=results;fs.writeFileSync(baselineFile,JSON.stringify(all,null,1));}
  for(const [name,r] of Object.entries(results))console.log(`  ${name.padEnd(34)} ${Object.entries(r).filter(([,v])=>typeof v==='number').map(([k,v])=>k+' '+v).join(' · ')}`);
  if(missed.length){console.log(`METAS DE TRAVADA NÃO ATINGIDAS (${missed.length}):`);for(const m of missed)console.log(' - '+m);}
  if(soft&&failures.length){console.log(`RELATÓRIO: ${failures.length} verificações falhariam`);for(const m of failures)console.log(' - '+m);return;}
  console.log('OK '+message);
 }
 return{expect,target,budget,finish,results};
}
// Motor fora do vm (tempo real do motor), mais um campo de teste e um tick cronometrado para os testes Node.
let engineCache;
function engine(){
 if(!engineCache){engineCache=new Function(fs.readFileSync(path.join(root,'js','engine.js'),'utf8')+'\nreturn {Game,TYPES,AIR,PLANE,STEP,KEY,COLS,ROWS,SIZE,DIST};')();}
 return engineCache;
}
const KINDS=['infantry','infantry','engineer','antitank','machinegun','lightTank','tank','heavyTank','artillery','recon','missileInfantry','antiAirVehicle','helicopter','rocketArtillery','reconDrone','stealthDrone'];
// Exércitos em colunas (como __army no navegador), blue em marcha de ataque.
function battle({mode='rts',map='river',seed=44,blue=150,red=150,planes=0,ai=false,attack=true,difficulty='normal'}={}){
 const {Game}=engine(),g=new Game(map,difficulty,seed,mode);g.aiEnabled=ai;
 for(const [owner,total] of [['blue',blue],['red',red]]){let placed=0,i=0;while(placed<total&&i<12000){const x=owner==='blue'?20+i%20*2:68+i%20*2,y=(4+Math.floor(i/20)*2)%92;i++;try{if(g.add(owner,KINDS[placed%KINDS.length],x,y))placed++;}catch{}}}
 for(let i=0;i<planes;i++){const b=i<planes/2;try{g.add(b?'blue':'red',b?(i%2?'fighterBlue':'multiroleBlue'):(i%2?'fighterRed':'multiroleRed'),b?30+i*3:98-(i-planes/2)*3,50);}catch{}}
 g.updateVision();if(attack)for(const u of g.units)if(u.owner==='blue')g.order(u,'attackMove',{x:100,y:48},true);return g;
}
function ticks(g,n,dt=engine().STEP,each){const t=[];for(let i=0;i<n;i++){const s=performance.now();g.update(dt);t.push(performance.now()-s);g.events.length=0;if(each)each(i);}return t;}
const tickStats=t=>{const q=quantiles(t);return{tickMean:q.mean,tickP50:q.p50,tickP95:q.p95,tickP99:q.p99,tickMax:q.max};};
// Executa o corpo com navegador e encerra com código 1 em erro.
function run(body){(async()=>{const browser=await launch();try{await body(browser);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});}

module.exports={root,THROTTLE,quantiles,engine,battle,ticks,tickStats,KINDS,launch,open,frameStats,metrics,suite,run};
