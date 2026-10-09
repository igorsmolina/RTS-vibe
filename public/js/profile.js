'use strict';
/* Perfil do jogador: estatísticas de carreira, histórico, conquistas e sincronização com o Neon.
   Lógica pura (testada em node); o navegador, a nuvem e o diálogo ficam em js/account.js. */
const PROFILE_KEY='wargrid.profile.v1',HISTORY_MAX=30;
const sumOf=(counts,keep=()=>true)=>Object.entries(counts||{}).reduce((n,[t,v])=>n+(TYPES[t]&&keep(TYPES[t])?v:0),0);
const ACHIEVEMENTS=[
 {id:'firstWin',name:'Primeira vitória',text:'Vença uma operação.',test:p=>p.stats.wins>=1},
 {id:'hardWin',name:'Linha dura',text:'Vença no Difícil.',test:p=>(p.stats.byDifficulty.hard?.won||0)>=1},
 {id:'veteranWin',name:'Veterano',text:'Vença no Veterano.',test:p=>(p.stats.byDifficulty.veteran?.won||0)>=1},
 {id:'rtsWin',name:'Tempo real',text:'Vença no modo RTS.',test:p=>(p.stats.byMode.rts?.won||0)>=1},
 {id:'turnsWin',name:'Estrategista',text:'Vença no modo por turnos.',test:p=>(p.stats.byMode.turns?.won||0)>=1},
 {id:'blitz',name:'Blitz',text:'Vença em até 10 rodadas ou 8 minutos.',test:(p,m)=>m?.result==='win'&&(m.mode==='rts'?m.time<=480:m.round<=10)},
 {id:'fewLosses',name:'Pouca baixa',text:'Vença perdendo no máximo 3 tropas.',test:(p,m)=>m?.result==='win'&&sumOf(m.lost)<=3},
 {id:'airHunter',name:'Caça-helicópteros',text:'Derrube 10 aeronaves no total.',test:p=>sumOf(p.stats.kills,t=>t.air)>=10},
 {id:'armorBreaker',name:'Quebra-blindados',text:'Destrua 50 veículos no total.',test:p=>sumOf(p.stats.kills,t=>t.vehicle)>=50},
 {id:'centurion',name:'Centurião',text:'Some 100 abates.',test:p=>sumOf(p.stats.kills)>=100},
 {id:'firstRegion',name:'Cabeça de ponte',text:'Conquiste uma região na campanha.',test:p=>p.stats.regions>=1},
 {id:'conqueror',name:'Conquistador',text:'Conquiste 10 regiões na campanha.',test:p=>p.stats.regions>=10},
 {id:'campaignWin',name:'Senhor da guerra',text:'Vença uma campanha.',test:p=>p.stats.campaigns>=1},
 {id:'warVeteran',name:'Veterano de guerra',text:'Jogue 25 operações.',test:p=>p.stats.matches>=25},
 {id:'cartographer',name:'Cartógrafo',text:'Vença em todos os mapas.',test:p=>Object.keys(MAPS).every(k=>p.stats.mapsWon[k])}
];
function newProfile(){return {version:1,savedAt:0,campaignAt:0,settingsAt:0,
 stats:{matches:0,wins:0,losses:0,draws:0,seconds:0,rounds:0,regions:0,campaigns:0,byDifficulty:{},byMode:{},kills:{},lost:{},mapsWon:{}},history:[],achievements:{}};}
// Partida encerrada → registro do histórico (só dados do lado azul).
function matchRecord(game,region,now){
 const s=game.stats?.blue||{kills:{},losses:{}};
 return {id:now.toString(36)+'-'+(game.seed>>>0).toString(36),date:now,map:game.map,seed:game.seed,difficulty:game.difficulty,mode:game.mode,
  result:game.winner==='blue'?'win':game.winner==='draw'?'draw':'loss',time:Math.round(game.time||0),round:game.round,kills:{...s.kills},lost:{...s.losses},region:region??null,nationName:cleanNation({name:game.nationName}).name};
}
function unlock(p,m,now){const fresh=[];for(const a of ACHIEVEMENTS)if(!p.achievements[a.id]&&a.test(p,m)){p.achievements[a.id]=now;fresh.push(a);}return fresh;}
const bump=(o,k,v=1)=>{o[k]=(o[k]||0)+v;};
function recordMatch(p,m){
 const s=p.stats,won=m.result==='win';s.matches++;bump(s,{win:'wins',loss:'losses',draw:'draws'}[m.result]);
 if(m.mode==='rts')s.seconds+=m.time;else s.rounds+=m.round;
 for(const [group,key] of [[s.byDifficulty,m.difficulty],[s.byMode,m.mode]]){group[key]=group[key]||{played:0,won:0};group[key].played++;if(won)group[key].won++;}
 for(const [t,n] of Object.entries(m.kills))bump(s.kills,t,n);for(const [t,n] of Object.entries(m.lost))bump(s.lost,t,n);
 if(won)s.mapsWon[m.map]=true;
 p.history=[m,...p.history.filter(h=>h.id!==m.id)].slice(0,HISTORY_MAX);p.savedAt=m.date;
 return unlock(p,m,m.date);
}
// Campanha: região conquistada e campanha vencida.
function recordCampaign(p,won,campaignWon,now){if(won)p.stats.regions++;if(campaignWon)p.stats.campaigns++;p.savedAt=now;return unlock(p,null,now);}
// Mescla de dados (máquina × nuvem ou arquivo): contadores pelo maior valor, flags por OU.
// Também limpa dados de fora: só números finitos, true e objetos simples passam; nada de __proto__.
function mergeMax(a,b){
 const out={...a};
 for(const [k,v] of Object.entries(b&&typeof b==='object'?b:{})){
  if(k==='__proto__'||k==='constructor'||k==='prototype')continue;
  if(typeof v==='number'&&Number.isFinite(v)&&v>=0)out[k]=Math.max(typeof out[k]==='number'?out[k]:0,v);
  else if(v===true)out[k]=true;
  else if(v&&typeof v==='object'&&!Array.isArray(v))out[k]=mergeMax(out[k]&&typeof out[k]==='object'?out[k]:{},v);
 }
 return out;
}
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:0;
function cleanHistory(list){return (Array.isArray(list)?list:[]).filter(h=>h&&typeof h.id==='string'&&h.id.length<80&&Number.isFinite(h.date)&&['win','loss','draw'].includes(h.result))
 .map(h=>({id:h.id,date:h.date,map:String(h.map||''),seed:num(h.seed),difficulty:String(h.difficulty||''),mode:h.mode==='rts'?'rts':'turns',result:h.result,time:num(h.time),round:num(h.round),kills:mergeMax({},h.kills),lost:mergeMax({},h.lost),region:Number.isInteger(h.region)?h.region:null,...(typeof h.nationName==='string'?{nationName:cleanNation({name:h.nationName}).name}:{})}));}
function mergeProfiles(a,b){
 const p=newProfile();for(const k of ['savedAt','campaignAt','settingsAt'])p[k]=Math.max(num(a?.[k]),num(b?.[k]));
 p.stats=mergeMax(mergeMax(p.stats,a?.stats),b?.stats);
 const seen=new Map();for(const h of [...cleanHistory(a?.history),...cleanHistory(b?.history)])if(!seen.has(h.id))seen.set(h.id,h);
 p.history=[...seen.values()].sort((x,y)=>y.date-x.date).slice(0,HISTORY_MAX);
 for(const src of [a?.achievements,b?.achievements])for(const [id,at] of Object.entries(src&&typeof src==='object'?src:{}))
  if(ACHIEVEMENTS.some(x=>x.id===id)&&Number.isFinite(at))p.achievements[id]=Math.min(p.achievements[id]??Infinity,at);
 return p;
}
// Pacote salvo na nuvem ou no arquivo: perfil + campanha (texto) + configurações.
function validateBundle(b){
 if(!b||typeof b!=='object'||b.version!==1||!b.profile||typeof b.profile!=='object')return null;
 if(b.campaign!==null&&b.campaign!==undefined&&typeof b.campaign!=='string')return null;
 const settings=b.settings&&typeof b.settings==='object'&&!Array.isArray(b.settings)?{...b.settings}:{};
 if(Object.hasOwn(settings,'nation'))settings.nation=cleanNation(settings.nation);if(Object.hasOwn(settings,'doctrine'))settings.doctrine=cleanDoctrine(settings.doctrine);if(Object.hasOwn(settings,'startingArmy')){if(armyOverBudget(settings.startingArmy))settings.armyRestored=true;settings.startingArmy=cleanStartingArmy(settings.startingArmy);}
 return {version:1,profile:mergeProfiles(newProfile(),b.profile),campaign:b.campaign??null,settings};
}
function mergeBundles(local,remote){
 return {version:1,profile:mergeProfiles(local.profile,remote.profile),
  campaign:num(remote.profile.campaignAt)>num(local.profile.campaignAt)?remote.campaign:local.campaign,
  settings:num(remote.profile.settingsAt)>num(local.profile.settingsAt)?remote.settings:local.settings};
}

