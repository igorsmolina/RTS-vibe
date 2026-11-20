'use strict';
/* Menus de sistema (Configurações e Personalizar nação): cartões que espelham os <select>, montados na primeira abertura.
   Perfil, Editor de exército e Manual são montados por account.js e ui.js. ui.js chama MenuSystem.opened(id) em openMenu. */
const MenuSystem=(()=>{
 const byId=id=>document.getElementById(id),K=MenuKit;
 const settingsPickers=[],nationPickers=[],minis=[];let settingsReady=false,nationReady=false;
 const FX={performance:'fx-performance',balanced:'fx-balanced',cinematic:'fx-cinematic'},RANK={easy:'rank-1',normal:'rank-2',hard:'rank-3',veteran:'rank-4'};
 function initSettings(){
  if(settingsReady)return;settingsReady=true;
  settingsPickers.push(
   K.cardPicker(byId('setGraphics'),{kind:'icon',cols:3,art:o=>K.iconNode(FX[o.value])}),
   K.cardPicker(byId('setDifficulty'),{kind:'icon',cols:4,art:o=>K.iconNode(RANK[o.value])}),
   K.cardPicker(byId('setSpeed'),{kind:'none',cols:4}),
   K.cardPicker(byId('setMode'),{kind:'icon',cols:2,art:o=>K.iconNode(o.value==='rts'?'mode-rts':'mode-turns')})
  );
  byId('settingsReset').addEventListener('click',()=>{for(const p of settingsPickers)p.refresh();paintSettingsNation();});
 }
 function paintSettingsNation(){drawNationFlag('settingsNationFlag',settings.nation);byId('settingsNationName').textContent=settings.nation.name;}
 // Miniatura de bandeira para os cartões de padrão e emblema (usa as cores escolhidas no momento).
 const mini=(kind)=>o=>{const c=document.createElement('canvas');c.width=72;c.height=48;minis.push({c,kind,value:o.value});return c;};
 const swatch=table=>o=>{const s=document.createElement('span');s.className='swatch';s.style.background=table[o.value];return s;};
 function paintMinis(){const n=nationDraft();for(const {c,kind,value} of minis)drawNationFlag(c,{...n,[kind]:value});}
 function initNation(){
  if(nationReady)return;nationReady=true;
  nationPickers.push(
   K.cardPicker(byId('nationPrimary'),{kind:'square',cols:4,art:swatch(NATION_COLORS)}),
   K.cardPicker(byId('nationSecondary'),{kind:'square',cols:3,art:swatch(NATION_SECONDARY)}),
   K.cardPicker(byId('nationPattern'),{kind:'icon',cols:3,art:mini('pattern')}),
   K.cardPicker(byId('nationEmblem'),{kind:'icon',cols:4,art:mini('emblem')})
  );
  for(const id of ['nationPrimary','nationSecondary','nationPattern','nationEmblem'])byId(id).addEventListener('input',paintMinis);
 }
 // Chamado por openMenu depois de showModal: os valores dos <select> podem ter sido atribuídos por código.
 function opened(id){
  if(id==='settings'){initSettings();for(const p of settingsPickers)p.refresh();paintSettingsNation();}
  else if(id==='nationEditor'){initNation();for(const p of nationPickers)p.refresh();paintMinis();}
 }
 return {opened};
})();
