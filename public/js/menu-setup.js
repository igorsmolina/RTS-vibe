'use strict';
/* Nova operação: abas Teatro / Regras / Forças e cartões que espelham os <select> (montados na primeira abertura). */
const SetupMenu=(()=>{
 let ready=false,tabs=null;const pickers=[],syncs=[];
 const SAMPLE=7; // semente das miniaturas de exemplo dos cartões (a prévia grande usa a semente da operação)
 const byId=id=>document.getElementById(id);
 function init(){
  if(ready||typeof MenuKit==='undefined')return;ready=true;
  showDoctrines('playerDoctrine','playerDoctrineInfo','enemyDoctrineInfo',preparedSeed); // as doutrinas precisam existir antes dos cartões
  const K=MenuKit,art={own:0,blue:0,enemy:1,red:1,franca:2},ids=['genWater','genForest','genRelief','genFarmland'];
  const sample={water:.4,relief:.4,forest:.4,farmland:.5,posts:12};
  pickers.push(
   K.cardPicker(byId('mapSelect'),{kind:'map',cols:4,art:o=>K.thumbNode(o.value,SAMPLE,o.value==='random'?{landscape:'continent',...sample}:{},240,180)}),
   K.cardPicker(byId('genLandscape'),{kind:'map',cols:5,art:o=>o.value==='auto'?K.iconNode('dice'):K.thumbNode('random',SAMPLE,{landscape:o.value,...sample},180,135)}),
   K.cardPicker(byId('genPosts'),{kind:'none',card:'58px',enter:false}),
   K.cardPicker(byId('modeSelect'),{kind:'icon',cols:2,art:o=>K.iconNode(o.value==='rts'?'mode-rts':'mode-turns')}),
   K.cardPicker(byId('difficulty'),{kind:'icon',cols:4,art:o=>K.iconNode({easy:'rank-1',normal:'rank-2',hard:'rank-3',veteran:'rank-4'}[o.value])}),
   K.cardPicker(byId('playerDoctrine'),{kind:'icon',cols:4,art:o=>K.iconNode('doctrine-'+o.value),caption:o=>NATION_DOCTRINES[o.value]?.text}),
   K.cardPicker(byId('playerArmy'),{kind:'square',cols:3,art:o=>K.spriteNode('heavyTank',art[o.value])}),
   K.cardPicker(byId('enemyArmy'),{kind:'square',cols:4,art:o=>o.value==='auto'?K.iconNode('dice'):K.spriteNode('heavyTank',art[o.value])})
  );
  for(const id of ids)syncs.push(K.slider(byId(id),byId(id+'Out')));
  tabs=K.tabs(byId('setupTabs'),[
   {id:'theater',label:'Teatro',panel:byId('setupPaneTheater')},
   {id:'rules',label:'Regras',panel:byId('setupPaneRules')},
   {id:'forces',label:'Forças',panel:byId('setupPaneForces')}
  ]);
 }
 const refresh=()=>{if(!ready)return;for(const p of pickers)p.refresh();for(const s of syncs)s();};
 const show=id=>{if(tabs)tabs.show(id);};
 return {init,refresh,show};
})();
