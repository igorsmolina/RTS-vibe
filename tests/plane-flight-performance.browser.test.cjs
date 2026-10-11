'use strict';
// Voo longo no navegador com CPU 4× mais lenta: câmera parada contra câmera acompanhando o avião (o jogador arrasta ou rola atrás dele),
// mapa vazio e contestado, RTS e por turnos, 1× e 2×. Mede casas repintadas por quadro e o ritmo real de quadros.
// RTS_PUBLIC=<pasta public> mede outra cópia; RTS_REPORT_ONLY=1 registra as falhas em vez de interromper.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
const root=process.env.RTS_PUBLIC?path.resolve(process.env.RTS_PUBLIC):path.join(__dirname,'..','public'),artifacts=path.join(__dirname,'artifacts');
fs.mkdirSync(artifacts,{recursive:true});
const soft=!!process.env.RTS_REPORT_ONLY,failures=[],expect=(ok,message)=>{if(ok)return;if(soft)failures.push(message);else assert.fail(message);};

const scenarios=[
 {name:'rts vazio, câmera parada',mode:'rts',contested:false,follow:false,speed:1},
 {name:'rts vazio, câmera segue',mode:'rts',contested:false,follow:true,speed:1},
 {name:'rts contestado, câmera parada',mode:'rts',contested:true,follow:false,speed:1},
 {name:'rts contestado, câmera segue',mode:'rts',contested:true,follow:true,speed:1},
 {name:'rts contestado, câmera segue, 2×',mode:'rts',contested:true,follow:true,speed:2},
 {name:'turnos vazio, câmera parada',mode:'turns',contested:false,follow:false,speed:1},
 {name:'turnos vazio, câmera segue',mode:'turns',contested:false,follow:true,speed:1}
];

const setup=({mode,contested})=>{
 for(const d of document.querySelectorAll('dialog[open]'))d.close();newOperation('river','normal',19,mode);game.aiEnabled=false;
 const planes=[];for(let i=0;i<4;i++){try{const p=game.add('blue',i%2?'fighterBlue':'multiroleBlue',8+i*2,62);p.facing=Math.PI/2;planes.push(p);}catch(e){}}
 if(contested){
  const kinds=['infantry','tank','antiAirVehicle','helicopter','artillery','recon','missileInfantry'];
  for(let i=0;i<30;i++){try{game.add('red',kinds[i%kinds.length],60+i%6*5,14+Math.floor(i/6)*7);}catch(e){}}
  for(let i=0;i<3;i++){try{game.add('red',i%2?'fighterRed':'multiroleRed',62+i*4,40);}catch(e){}}
 }
 game.updateVision();setSelection(planes.map(p=>p.id));cam.zoom=1;centerCamera(planes[0].x,planes[0].y);paused=true;updateUI();
 return planes.length;
};

const fly=async({follow,speed:speedX,mode})=>{
 const dtc=window.drawTerrainCell,draw=renderer.draw;let cells=0;const perFrame=[];
 window.drawTerrainCell=function(...a){cells++;return dtc.apply(this,a);};
 renderer.draw=function(...a){const c0=cells;const r=draw.apply(this,a);perFrame.push(cells-c0);return r;};
 const planes=selectedUnits(),leader=planes[0],goal={x:78,y:30};
 for(const p of planes)if(!game.order(p,'move',goal,true))throw new Error('ordem de voo recusada');
 const frames=[];let last=performance.now(),running=true;
 const tick=now=>{frames.push(now-last);last=now;if(follow){const pose=flightPose(leader);centerCamera(pose.x,pose.y);renderer.drawMini();}if(running)requestAnimationFrame(tick);};
 speed=speedX;paused=false;const start=performance.now();requestAnimationFrame(tick);
 await new Promise(done=>{const check=()=>{const elapsed=performance.now()-start,flying=leader.flightJob?.type==='transfer';if(!flying&&elapsed>1500||elapsed>26000)done();else setTimeout(check,100);};check();});
 running=false;paused=true;speed=1;renderer.draw=draw;window.drawTerrainCell=dtc;
 const v=viewCells(),full=(v.x1-v.x0)*(v.y1-v.y0),f=frames.slice(2).sort((a,b)=>a-b),q=p=>f[Math.min(f.length-1,Math.floor(f.length*p))];
 return{frames:f.length,p50:+q(.5).toFixed(1),p95:+q(.95).toFixed(1),max:+f.at(-1).toFixed(0),over66:f.filter(x=>x>66).length,full,cellsPerFrame:+(perFrame.reduce((a,b)=>a+b,0)/Math.max(1,perFrame.length)).toFixed(1),fullRepaints:perFrame.filter(c=>c>=full*.8).length,arrived:leader.flightJob?.type!=='transfer',travelled:+Math.hypot(leader.x-8,leader.y-62).toFixed(0)};
};

(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];try{
 for(const s of scenarios){
  const context=await browser.newContext({viewport:{width:1100,height:700}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await context.setOffline(true);
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.evaluate(()=>terrainReady);await page.evaluate(()=>typeof battlefieldReady==='undefined'?null:battlefieldReady);
  const planes=await page.evaluate(setup,s);assert.equal(planes,4,'os quatro aviões foram criados');await page.evaluate(()=>renderer.groundReady);
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const r={name:s.name,...await page.evaluate(fly,s)};results.push(r);
  expect(r.arrived&&r.travelled>=40,`${s.name}: o avião deve completar o voo (percorreu ${r.travelled} casas)`);
  expect(errors.length===0,`${s.name}: erros JS ${errors[0]||''}`);await context.close();
 }
 for(const r of results)console.log(`${r.name.padEnd(36)} quadros ${String(r.frames).padStart(4)}  p50 ${String(r.p50).padStart(5)}  p95 ${String(r.p95).padStart(5)}  máx ${String(r.max).padStart(4)}  >66ms ${String(r.over66).padStart(3)}  casas/quadro ${String(r.cellsPerFrame).padStart(6)} de ${r.full}  repinturas ${r.fullRepaints}`);
 const by=name=>results.find(r=>r.name===name);
 for(const [follow,still] of [['rts vazio, câmera segue','rts vazio, câmera parada'],['rts contestado, câmera segue','rts contestado, câmera parada'],['turnos vazio, câmera segue','turnos vazio, câmera parada']]){
  const a=by(follow),b=by(still);
  expect(a.fullRepaints<=3,`${follow}: ${a.fullRepaints} repinturas completas do terreno`);
  expect(a.cellsPerFrame<=a.full*.35,`${follow}: ${a.cellsPerFrame} casas por quadro de ${a.full}`);
  // Comparação de tempo é só um limite grosso (ruído de CPU 4×); o guarda de regressão são as repinturas e casas por quadro, que são exatas.
  expect(a.p95<=b.p95*1.6+15,`${follow}: p95 ${a.p95} ms contra ${b.p95} ms com a câmera parada`);
 }
 const fast=by('rts contestado, câmera segue, 2×');expect(fast.fullRepaints<=3&&fast.cellsPerFrame<=fast.full*.35,'2×: câmera seguindo sem repintura completa');
 fs.writeFileSync(path.join(artifacts,'plane-flight-performance.json'),JSON.stringify({root,failures,results},null,2));
 if(soft){console.log('RELATÓRIO: '+failures.length+' verificações falhariam');for(const m of failures)console.log(' - '+m);return;}
 console.log('OK voo longo: câmera acompanhando o avião sem repintar o terreno, em RTS e turnos, 1× e 2×, com CPU 4×.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
