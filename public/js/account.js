'use strict';
/* Perfil no navegador: salvo local, registro das partidas, nuvem Neon (login + Data API) e diálogo Perfil e conquistas. */
let profile=newProfile();try{const text=localStorage.getItem(PROFILE_KEY);if(text)profile=mergeProfiles(newProfile(),JSON.parse(text));}catch{}
function saveProfile(){try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));}catch{}}
function touchProfile(kind){if(kind)profile[kind+'At']=Date.now();saveProfile();scheduleSync();}
function bundle(){let text=null;try{text=localStorage.getItem(CAMPAIGN_KEY);}catch{}return {version:1,profile,campaign:text,settings};}
function applyBundle(b){
 profile=b.profile;saveProfile();
 let current=null;try{current=localStorage.getItem(CAMPAIGN_KEY);}catch{}
 // Batalha de campanha em andamento mantém a campanha local; o resultado sobe depois.
 if(b.campaign!==current&&!campaignBattle){try{if(b.campaign)localStorage.setItem(CAMPAIGN_KEY,b.campaign);else localStorage.removeItem(CAMPAIGN_KEY);}catch{}campaign=null;worldView=null;selectedRegion=-1;}
 settings={...SETTING_DEFAULTS,...b.settings};try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}applySettings();
 if($('titleScreen').open)refreshTitle();if($('profile').open)renderProfile();
}
function announce(fresh){if(!fresh.length)return '';say(`Conquista desbloqueada: ${fresh.map(a=>a.name).join(', ')}.`);return `\nConquista desbloqueada: ${fresh.map(a=>a.name).join(', ')}.`;}
// Chamado ao mostrar o resultado da partida; devolve o texto das conquistas novas.
function recordResult(){const fresh=recordMatch(profile,matchRecord(game,campaignBattle?.region,Date.now()));touchProfile();return announce(fresh);}
function recordCampaignResult(won){const fresh=recordCampaign(profile,won,campaignOver(campaign)==='blue',Date.now());touchProfile();announce(fresh);}
function profileSummary(){const n=Object.keys(profile.achievements).length;return `${n}/${ACHIEVEMENTS.length} conquistas · ${profile.stats.wins} vitória(s)`+(cloud.user?' · na nuvem':'');}

// Nuvem: Neon Auth (e-mail e senha) + Data API, tabela profiles protegida por RLS (db/schema.sql).
// Só com endereços em js/neon-config.js e página aberta por http(s): o Neon Auth não aceita file://.
const NEON_SDK='https://cdn.jsdelivr.net/npm/@neondatabase/neon-js/+esm';
const cloud={client:null,user:null,busy:false,pending:false,timer:0,at:0,error:''};
const cloudConfigured=()=>typeof NEON_AUTH_URL==='string'&&!!NEON_AUTH_URL&&typeof NEON_DATA_API_URL==='string'&&!!NEON_DATA_API_URL;
const cloudReachable=()=>/^https?:$/.test(location.protocol);
async function cloudClient(){if(!cloud.client){const {createClient}=await import(NEON_SDK);cloud.client=createClient({auth:{url:NEON_AUTH_URL},dataApi:{url:NEON_DATA_API_URL}});}return cloud.client;}
// Baixa, mescla e envia: duas máquinas jogando alternadamente nunca apagam o progresso uma da outra.
async function cloudSync(){
 if(!cloud.user||cloud.busy){cloud.pending=!!cloud.user;return;}
 if(!navigator.onLine){cloud.pending=true;renderAccount();return;}
 cloud.busy=true;cloud.pending=false;
 try{
  const c=await cloudClient(),{data,error}=await c.from('profiles').select('data').eq('user_id',cloud.user.id).maybeSingle();if(error)throw error;
  const remote=data&&validateBundle(data.data),merged=remote?mergeBundles(bundle(),remote):bundle();if(remote)applyBundle(merged);
  const put=await c.from('profiles').upsert({user_id:cloud.user.id,data:merged,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(put.error)throw put.error;
  cloud.at=Date.now();cloud.error='';
 }catch(e){cloud.pending=true;cloud.error=e?.message||String(e);}
 finally{cloud.busy=false;renderAccount();}
 if(cloud.pending&&!cloud.error)scheduleSync();
}
function scheduleSync(){if(!cloud.user)return;clearTimeout(cloud.timer);cloud.timer=setTimeout(cloudSync,2000);}
// Save local pertence a uma conta: trocar de conta não mistura campanha/perfil de outra pessoa.
const OWNER_KEY='wargrid.owner';
function resetLocal(){profile=newProfile();saveProfile();try{localStorage.removeItem(CAMPAIGN_KEY);}catch{}if(!campaignBattle){campaign=null;worldView=null;selectedRegion=-1;}if($('titleScreen').open)refreshTitle();}
function bindOwner(){let o=null;try{o=localStorage.getItem(OWNER_KEY);}catch{}if(o&&o!==cloud.user.id)resetLocal();try{localStorage.setItem(OWNER_KEY,cloud.user.id);}catch{}}
async function cloudStart(){
 if(!cloudConfigured()||!cloudReachable())return;
 try{const c=await cloudClient(),{data}=await c.auth.getSession();if(data?.user){cloud.user=data.user;bindOwner();await cloudSync();}}catch(e){cloud.error=e?.message||String(e);}
 renderAccount();if($('titleScreen').open)refreshTitle();
}
async function cloudSignIn(create){
 const email=$('accountEmail').value.trim(),password=$('accountPassword').value;if(!email||!password){cloud.error='Informe e-mail e senha.';renderAccount();return;}
 cloud.error='';$('accountStatus').textContent=create?'Criando conta…':'Entrando…';
 try{const c=await cloudClient(),r=create?await c.auth.signUp.email({email,password,name:email.split('@')[0]}):await c.auth.signIn.email({email,password});
  if(r.error)throw r.error;cloud.user=r.data?.user||(await c.auth.getSession()).data?.user;if(!cloud.user)throw new Error('Confirme o cadastro pelo e-mail e entre de novo.');
  bindOwner();  $('accountPassword').value='';await cloudSync();}
 catch(e){cloud.error=e?.message||String(e);}
 renderAccount();
}
// Envia o que falta antes de sair; só limpa o save local se a nuvem já tem tudo (offline mantém, e a mesma conta recupera ao entrar).
async function cloudSignOut(){clearTimeout(cloud.timer);if(cloud.user)await cloudSync();const synced=!cloud.pending&&!cloud.error;
 try{await cloud.client?.auth.signOut();}catch{}cloud.user=null;cloud.pending=false;
 if(synced){resetLocal();try{localStorage.removeItem(OWNER_KEY);}catch{}}renderAccount();if($('profile').open)renderProfile();}
window.addEventListener('online',()=>{if(cloud.pending)cloudSync();});

// --- Diálogo Perfil e conquistas
const DIFFICULTY_NAME={easy:'Fácil',normal:'Normal',hard:'Difícil',veteran:'Veterano'},MODE_NAME={turns:'Turnos',rts:'RTS'},RESULT_NAME={win:'Vitória',loss:'Derrota',draw:'Empate'};
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const when=t=>new Date(t).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const duration=h=>h.mode==='rts'?`${Math.floor(h.time/60)}:${String(h.time%60).padStart(2,'0')}`:`${h.round} rod.`;
function renderProfile(){
 $('achievementList').replaceChildren(...ACHIEVEMENTS.map(a=>{const at=profile.achievements[a.id],li=el('li',undefined,at?'done':'locked');li.append(el('b',a.name),el('span',a.text),el('small',at?'Desbloqueada em '+when(at):'Bloqueada'));return li;}));
 $('achievementCount').textContent=`${Object.keys(profile.achievements).length} de ${ACHIEVEMENTS.length}`;
 const s=profile.stats,kills=sumOf(s.kills),lost=sumOf(s.lost),rows=[['Operações',s.matches],['Vitórias / derrotas / empates',`${s.wins} / ${s.losses} / ${s.draws}`],['Aproveitamento',s.matches?Math.round(s.wins/s.matches*100)+'%':'—'],
  ['Abates / perdas',`${kills} / ${lost}`],['Aeronaves abatidas',sumOf(s.kills,t=>t.air)],['Veículos destruídos',sumOf(s.kills,t=>t.vehicle)],['Tempo em RTS',`${Math.round(s.seconds/60)} min`],['Rodadas por turnos',s.rounds],
  ['Regiões conquistadas',s.regions],['Campanhas vencidas',s.campaigns],
  ...Object.entries(DIFFICULTY_NAME).map(([k,n])=>[`${n}: vitórias / jogadas`,`${s.byDifficulty[k]?.won||0} / ${s.byDifficulty[k]?.played||0}`])];
 const top=Object.entries(s.kills).filter(([t])=>TYPES[t]).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([t,n])=>`${TYPES[t].name} ${n}`).join(' · ');if(top)rows.push(['Mais abatidos',top]);
 $('statList').replaceChildren(...rows.flatMap(([k,v])=>[el('dt',k),el('dd',String(v))]));
 $('historyBody').replaceChildren(...profile.history.map(h=>{const tr=el('tr');for(const v of [when(h.date),(MAPS[h.map]||h.map)+(h.nationName?' · '+h.nationName:''),DIFFICULTY_NAME[h.difficulty]||h.difficulty,MODE_NAME[h.mode],RESULT_NAME[h.result],duration(h),`${sumOf(h.kills)} / ${sumOf(h.lost)}`])tr.append(el('td',v));tr.className=h.result;return tr;}));
 $('historyEmpty').hidden=profile.history.length>0;renderAccount();
}
function renderAccount(){
 if(!$('profile').open)return;
 const on=cloudConfigured()&&cloudReachable();$('accountForm').hidden=!on||!!cloud.user;$('accountSignedIn').hidden=!cloud.user;
 $('accountUser').textContent=cloud.user?.email||'';
 let status;
 if(!cloudConfigured())status='Nuvem não configurada: siga "Progresso na nuvem (Neon)" no README e preencha js/neon-config.js. Seu progresso está salvo neste navegador.';
 else if(!cloudReachable())status='Para sincronizar, abra o jogo por "Jogar online.bat" (ou npm start). Por arquivo (file://) o login do Neon não funciona; o progresso fica neste navegador.';
 else if(!cloud.user)status='Entre para guardar o progresso na nuvem e continuar em outro navegador ou computador.';
 else if(cloud.busy)status='Sincronizando…';
 else if(cloud.error)status='Falha na sincronização: '+cloud.error+(cloud.pending?' · tentará de novo':'');
 else if(cloud.pending)status='Offline — salvo neste navegador; envia quando a conexão voltar.';
 else status=cloud.at?'Sincronizado às '+new Date(cloud.at).toLocaleTimeString('pt-BR',{timeStyle:'short'}):'Conectado.';
 if(cloud.error&&!cloud.user)status=cloud.error;
 $('accountStatus').textContent=status;
}
function showProfileTab(name){for(const b of document.querySelectorAll('#profile [role=tab]')){const on=b.dataset.tab===name;b.setAttribute('aria-selected',String(on));$(b.getAttribute('aria-controls')).hidden=!on;}}
function openProfile(){openMenu('profile');renderProfile();}
// Backup em arquivo: mesmo pacote da nuvem.
function exportSave(){const blob=new Blob([JSON.stringify(bundle(),null,1)],{type:'application/json'}),a=el('a');a.href=URL.createObjectURL(blob);a.download='rtsvibe-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
async function importSave(file){
 let b=null;try{b=validateBundle(JSON.parse(await file.text()));if(b?.campaign)deserializeCampaign(b.campaign);}catch{b=null;}
 if(!b){$('accountStatus').textContent='Arquivo inválido: nada foi alterado.';return;}
 applyBundle(mergeBundles(bundle(),b));touchProfile();renderProfile();$('accountStatus').textContent=`Save importado: ${b.profile.stats.wins} vitória(s), ${Object.keys(b.profile.achievements).length} conquista(s).`;
}
$('titleProfile').addEventListener('click',()=>leaveTitleFor(openProfile));
$('closeProfile').addEventListener('click',()=>closeChild('profile'));
$('profile').addEventListener('cancel',e=>{e.preventDefault();closeChild('profile');});
for(const b of document.querySelectorAll('#profile [role=tab]'))b.addEventListener('click',()=>showProfileTab(b.dataset.tab));
$('accountSignIn').addEventListener('click',()=>cloudSignIn(false));$('accountSignUp').addEventListener('click',()=>cloudSignIn(true));
$('accountSignOut').addEventListener('click',cloudSignOut);$('accountSync').addEventListener('click',()=>cloudSync());
$('exportSave').addEventListener('click',exportSave);$('importSave').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f)importSave(f);});
cloudStart();
