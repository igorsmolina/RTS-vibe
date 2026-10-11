'use strict';
// Salvar e carregar com dados grandes, CPU 4×: perfil com histórico cheio e campanha avançada. Mede saveProfile, saveCampaign,
// recordResult no fim de uma partida de 300 unidades, bundle (exportar) e applyBundle (importar). Cada um abaixo de 50 ms.
const {open,suite,run}=require('./perf-kit.cjs');
const S=suite('save-load');

run(async browser=>{
 const g=await open(browser,{viewport:{width:1280,height:800}}),{page}=g;
 await page.evaluate(()=>{__army({blue:150,red:150,planes:8});});await g.throttle();
 const r=await page.evaluate(()=>{
  const time=f=>{const t=performance.now();f();return Math.round((performance.now()-t)*10)/10;},out={};
  const sample={date:Date.now(),map:'river',difficulty:'hard',mode:'rts',result:'win',time:1800,round:0,kills:{infantry:40,tank:12},lost:{infantry:20},nationName:'Teste'};
  for(let i=0;i<500;i++)profile.history.unshift({...sample,date:Date.now()-i*1000});out.history=profile.history.length;
  out.saveProfileMs=time(()=>saveProfile());
  out.recordResultMs=time(()=>{game.winner='blue';recordResult();game.winner=null;});
  if(typeof saveCampaign==='function'&&typeof newCampaign==='function'){try{campaign=newCampaign(7);}catch{}}
  out.saveCampaignMs=typeof saveCampaign==='function'&&campaign?time(()=>saveCampaign()):0;
  let b;out.bundleMs=time(()=>{b=JSON.stringify(bundle());});out.bundleKB=Math.round(b.length/1024);
  out.applyBundleMs=time(()=>applyBundle(JSON.parse(b)));out.historyAfter=profile.history.length;
  return out;});
 S.budget('dados grandes',r);
 for(const k of ['saveProfileMs','recordResultMs','saveCampaignMs','bundleMs','applyBundleMs'])S.expect(r[k]<=50,`${k}: ${r[k]} ms (bloqueia o quadro)`);
 S.expect(g.errors.length===0,'erros JS: '+g.errors[0]);await g.close();
 S.finish('salvar e carregar perfil e campanha grandes abaixo de 50 ms.');
});
