'use strict';
/* Campanha no mapa-múndi: desenho do mundo, escolha de região, batalha gerada pelo bioma e progresso salvo no navegador. */
const CAMPAIGN_KEY='wargrid.campaign.v1',OWNER_TINT={blue:[64,150,210],red:[220,92,78]},OWNER_LABEL={blue:'sua',red:'inimiga',neutral:'neutra'};
let campaign=null,campaignBattle=null,worldView=null,hoverRegion=-1,selectedRegion=-1,confirmNew=0;
const randomSeed=()=>Math.floor(Math.random()*4294967294)+1,hexColor=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
function saveCampaign(){try{localStorage.setItem(CAMPAIGN_KEY,serializeCampaign(campaign));}catch{}touchProfile('campaign');}
function loadCampaign(){try{const text=localStorage.getItem(CAMPAIGN_KEY);return text?deserializeCampaign(text):null;}catch{return null;}}
// Base em pixels (oceano por profundidade, biomas, costas e fronteiras): refeita só quando o mundo muda.
function paintWorld(){
 const canvas=$('worldMap'),W=canvas.width,H=canvas.height,w=campaign.world,ids=new Int16Array(W*H),base=new ImageData(W,H),edges=w.regions.map(()=>[]);
 for(let py=0;py<H;py++)for(let px=0;px<W;px++){
  const x=(px+.5)/W*w.w,y=(py+.5)/H*w.h,k=py*W+px,id=w.regionAt(x,y),e=w.elevation(x,y);ids[k]=id;let col;
  if(id>=0)col=hexColor(BIOMES[w.regions[id].biome].color).map(v=>v*(.86+Math.min(.26,e*.32)));
  else if(w.land(x,y))col=[160,161,140];
  else{const deep=Math.max(0,Math.min(1,-e*2.5));col=[34+34*(1-deep),82+46*(1-deep),118+40*(1-deep)];}
  base.data.set([col[0],col[1],col[2],255],k*4);
 }
 for(let py=0;py<H;py++)for(let px=0;px<W;px++){
  const k=py*W+px,id=ids[k],right=px+1<W?ids[k+1]:id,down=py+1<H?ids[k+W]:id;if(right===id&&down===id)continue;
  const coast=id<0||right<0||down<0;for(let i=0;i<3;i++)base.data[k*4+i]*=coast?.5:.7;
  if(id>=0)edges[id].push(k);if(right>=0&&right!==id)edges[right].push(k+1);if(down>=0&&down!==id)edges[down].push(k+W);
 }
 worldView={seed:w.seed,ids,base,edges,owners:null,img:null};
}
// Posse por cor: azul e vermelho tingem as regiões; refeito quando a posse muda.
function composeWorld(){
 const key=campaign.owners.join()+TEAM.blue;if(worldView.owners===key)return;const {ids,base}=worldView,img=new ImageData(new Uint8ClampedArray(base.data),base.width,base.height),tints={...OWNER_TINT,blue:hexColor(TEAM.blue)};
 for(let k=0;k<ids.length;k++){const tint=ids[k]>=0&&tints[campaign.owners[ids[k]]];if(!tint)continue;for(let i=0;i<3;i++)img.data[k*4+i]=img.data[k*4+i]*.5+tint[i]*.5;}
 worldView.img=img;worldView.owners=key;
}
function drawWorld(){
 if(!campaign)return;if(!worldView||worldView.seed!==campaign.world.seed)paintWorld();composeWorld();
 const canvas=$('worldMap'),c=canvas.getContext('2d'),w=campaign.world,sx=canvas.width/w.w,sy=canvas.height/w.h;c.putImageData(worldView.img,0,0);
 c.save();c.setLineDash([6,6]);c.strokeStyle='#d9e8efa0';c.lineWidth=1.5;for(const [a,b]of w.lanes){const A=w.regions[a],B=w.regions[b];c.beginPath();c.moveTo(A.x*sx,A.y*sy);c.lineTo(B.x*sx,B.y*sy);c.stroke();}c.restore();
 // Contornos: alvos possíveis em dourado; região sob o mouse e selecionada em destaque.
 const outline=(id,color)=>{c.fillStyle=color;for(const k of worldView.edges[id])c.fillRect(k%canvas.width-.5,Math.floor(k/canvas.width)-.5,2,2);};
 for(const r of w.regions)if(canAttack(campaign,r.id))outline(r.id,'#f2cf7a');
 if(hoverRegion>=0)outline(hoverRegion,'#ffffff');if(selectedRegion>=0)outline(selectedRegion,'#ffe9a8');
 c.font='600 12px Segoe UI, sans-serif';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#0c1b21d0';
 for(const r of w.regions){
  const x=r.x*sx,y=r.y*sy,owner=campaign.owners[r.id];
  if(r.id===w.homes.blue||r.id===w.homes.red){c.fillStyle=r.id===w.homes.blue?TEAM.blue:TEAM.red;c.beginPath();c.arc(x,y-13,6,0,Math.PI*2);c.fill();c.lineWidth=2;c.stroke();c.lineWidth=3;}
  c.strokeText(r.name,x,y+5);c.fillStyle=owner==='blue'?'#d4f1fb':owner==='red'?'#ffd6cc':'#f3efdf';c.fillText(r.name,x,y+5);
 }
 if(campaign.story){const mark=Story.marker(campaign);if(mark){const r=w.regions[mark.region];c.fillStyle='#ffe3a1';c.fillRect(r.x*sx-9,r.y*sy-30,18,16);c.fillStyle='#142219';c.fillText(String(mark.chapter),r.x*sx,r.y*sy-18);}}
}
function renderCampaignStats(){
 const n=o=>campaign.owners.filter(v=>v===o).length,over=campaignOver(campaign);$('campaignNationName').textContent=settings.nation.name;drawNationFlag('campaignNationFlag',settings.nation);
 {const chips=[[`${n('blue')} suas`,'friendly'],[`${n('red')} inimigas`,'hostile'],[`${n('neutral')} neutras`,'neutral'],[`${campaign.battles} batalha(s)`,'battles']];if(over)chips.push([over==='blue'?'Campanha vencida':'Campanha perdida',over==='blue'?'win':'loss']);
 const nodes=[];chips.forEach(([text,kind],i)=>{if(i)nodes.push(document.createTextNode(' · '));const chip=document.createElement('span');chip.className='stat-chip '+kind;const [num,...rest]=text.split(' ');if(/^\d+$/.test(num)){const b=document.createElement('b');b.textContent=num;chip.append(b,' '+rest.join(' '));}else chip.textContent=text;nodes.push(chip);});$('campaignStats').replaceChildren(...nodes);const total=campaign.owners.length||1,bar=$('campaignControl');bar.style.setProperty('--own',n('blue')/total*100+'%');bar.style.setProperty('--foe',n('red')/total*100+'%');bar.style.setProperty('--neu',n('neutral')/total*100+'%');}
 $('campaignEvents').replaceChildren(...campaign.events.map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));$('campaignEvents').scrollLeft=1e6;
 const order=campaign.world.regions.slice().sort((a,b)=>Number(canAttack(campaign,b.id))-Number(canAttack(campaign,a.id))||a.name.localeCompare(b.name));
 $('regionSelect').replaceChildren(new Option('Escolha uma região…',''),...order.map(r=>new Option(`${r.name} — ${BIOMES[r.biome].name} (${OWNER_LABEL[campaign.owners[r.id]]})${canAttack(campaign,r.id)?' · atacável':''}`,r.id)));
 $('regionSelect').value=selectedRegion>=0?String(selectedRegion):'';
 if(typeof refreshCampaignStory==='function')refreshCampaignStory();
}
// Ameaça pela dificuldade da IA (região inimiga já vem um nível acima em battleFor).
const THREAT={easy:[25,'Baixa','fácil'],normal:[50,'Média','normal'],hard:[75,'Alta','difícil'],veteran:[100,'Extrema','veterano']},BIOME_ICON={temperate:'farmland',arid:'sun',highland:'relief',wetland:'water',woodland:'forest'};
function fillDossier(r,b,battle,home){
 const owner=r&&campaign.owners[r.id],badge=$('regionOwner'),tag=$('regionBiomeTag');
 $('regionPhoto').dataset.empty=String(!r);tag.hidden=!r;badge.hidden=!r;$('regionHq').hidden=!r||!home;
 if(!r){$('regionBiome').textContent='–';$('regionThreat').textContent='–';$('regionThreatBar').style.setProperty('--v','0%');return;}
 const icon=BIOME_ICON[r.biome],t=owner==='blue'?[0,'Sob seu controle','']:THREAT[battle.difficulty]||THREAT.normal;
 $('regionBiome').textContent=b.name;$('regionBiome').dataset.icon=icon;tag.textContent=b.name;tag.dataset.icon=icon;
 badge.textContent=OWNER_LABEL[owner];badge.dataset.owner=owner;
 $('regionThreatBar').style.setProperty('--v',t[0]+'%');$('regionThreat').textContent=owner==='blue'?t[1]:`${t[1]} · IA ${t[2]}`;
}
// Cartões que espelham os selects: montados na primeira abertura (as opções de doutrina só existem depois de showDoctrines).
let campaignUi=null;
function buildCampaignUi(){
 if(campaignUi||typeof MenuKit==='undefined')return;
 showDoctrines('campaignDoctrine','campaignDoctrineInfo','campaignEnemyDoctrineInfo',null);
 const K=MenuKit,art={own:0,blue:0,enemy:1,red:1,franca:2,roxo:3},team=o=>K.spriteNode('heavyTank',art[o.value]);
 campaignUi=[
  K.cardPicker($('campaignDoctrine'),{kind:'icon',cols:2,art:o=>K.iconNode('doctrine-'+o.value),caption:o=>NATION_DOCTRINES[o.value]?.text}),
  K.cardPicker($('campaignUnits'),{kind:'square',cols:4,art:team}),
  K.cardPicker($('campaignEnemyArmy'),{kind:'square',cols:3,art:o=>o.value==='auto'?K.iconNode('sliders'):team(o)}),
  K.cardPicker($('campaignMode'),{kind:'icon',cols:2,art:o=>K.iconNode(o.value==='rts'?'mode-rts':'mode-turns')}),
  K.cardPicker($('campaignKind'),{kind:'icon',cols:2,art:o=>K.iconNode(o.value==='story'?'medal':'map')})
 ];
}
const refreshCampaignPickers=()=>{if(campaignUi)for(const p of campaignUi)p.refresh();};
function showRegion(id){
 selectedRegion=Number.isInteger(id)&&campaign.world.regions[id]?id:-1;const w=campaign.world,r=w.regions[selectedRegion],over=campaignOver(campaign);
 if(!r){$('regionName').textContent=over?(over==='blue'?'Campanha vencida':'Campanha perdida'):'Escolha uma região';$('regionInfo').textContent=over?'Comece uma nova campanha para jogar outro mundo.':'Clique numa região do mapa. Contorno dourado: regiões vizinhas do seu território, que podem ser atacadas.';
  $('attackRegion').disabled=true;$('attackRegion').textContent='Atacar região';$('regionPreview').getContext('2d').clearRect(0,0,252,196);fillDossier(null);}
 else{
  const b=BIOMES[r.biome],battle=battleFor(campaign,r.id),home=r.id===w.homes.blue?' · seu QG':r.id===w.homes.red?' · QG inimigo':'',attack=canAttack(campaign,r.id);
  $('regionName').textContent=r.name;$('regionInfo').textContent=`Campo: ${b.terrain} (${MAPS[battle.map]})`;fillDossier(r,b,battle,home);
  $('attackRegion').disabled=!attack;$('attackRegion').textContent=attack?'Atacar região':campaign.owners[r.id]==='blue'?'Região sua':over?'Campanha encerrada':'Sem fronteira com seu território';
  drawPreview($('regionPreview'),new Game(battle.map,'normal',battle.seed,'turns',battle.options));
 }
 if($('regionSelect').value!==String(selectedRegion>=0?selectedRegion:''))$('regionSelect').value=selectedRegion>=0?String(selectedRegion):'';
 showDoctrines('campaignDoctrine','campaignDoctrineInfo','campaignEnemyDoctrineInfo',r&&canAttack(campaign,r.id)?battleFor(campaign,r.id).seed:null);$('campaignDoctrine').disabled=!r||!canAttack(campaign,r.id);refreshCampaignPickers();drawWorld();
 if(typeof refreshCampaignStory==='function')refreshCampaignStory();
}
function openCampaign(){
 if(!campaign){campaign=loadCampaign()||newCampaign(randomSeed(),$('difficulty').value,$('modeSelect').value,$('campaignKind').value);
  if(campaign.current!==null&&!campaignBattle&&!campaign.story){campaign.events=[`Batalha por ${campaign.world.regions[campaign.current].name} interrompida.`];campaign.current=null;saveCampaign();}}
 if($('setup').open)$('setup').close();if($('result').open)$('result').close();
 buildCampaignUi();$('campaignMode').value=campaign.mode;openMenu('campaign');hoverRegion=-1;renderCampaignStats();showRegion(selectedRegion);
 if(typeof onCampaignStoryOpen==='function')onCampaignStoryOpen();
}
function closeCampaign(){closeChild('campaign');}
// Resumo para o menu inicial: regiões dominadas e batalhas, ou vazio sem campanha salva.
function campaignSummary(){const c=campaign||loadCampaign();if(!c)return '';const n=c.owners.filter(o=>o==='blue').length;return `${n} região(ões) · ${c.battles} batalha(s)`;}
$('openCampaign').addEventListener('click',openCampaign);$('worldButton').addEventListener('click',openCampaign);$('closeCampaign').addEventListener('click',closeCampaign);
$('campaign').addEventListener('cancel',e=>{e.preventDefault();closeCampaign();});
$('regionSelect').addEventListener('change',()=>showRegion($('regionSelect').value===''?-1:Number($('regionSelect').value)));
$('campaignMode').addEventListener('change',()=>{campaign.mode=$('campaignMode').value;saveCampaign();});
const worldPixel=e=>{const canvas=$('worldMap'),r=canvas.getBoundingClientRect(),px=Math.floor((e.clientX-r.left)/r.width*canvas.width),py=Math.floor((e.clientY-r.top)/r.height*canvas.height);return px<0||py<0||px>=canvas.width||py>=canvas.height?-1:worldView.ids[py*canvas.width+px];};
$('worldMap').addEventListener('pointermove',e=>{if(!worldView)return;const id=worldPixel(e);if(id!==hoverRegion){hoverRegion=id;drawWorld();}});
$('worldMap').addEventListener('pointerleave',()=>{if(hoverRegion>=0){hoverRegion=-1;drawWorld();}});
$('worldMap').addEventListener('click',e=>{if(worldView)showRegion(worldPixel(e));});
// Atacar: batalha com mapa, opções e dificuldade da região; a vitória conquista a região.
$('attackRegion').addEventListener('click',()=>{
 if(campaign.story&&Story.marker(campaign)?.region===selectedRegion){startStoryMission();return;}
 if(selectedRegion<0||!canAttack(campaign,selectedRegion))return;campaign.mode=$('campaignMode').value;changeSetting('doctrine',cleanDoctrine($('campaignDoctrine').value));const battle=battleFor(campaign,selectedRegion),region=selectedRegion;
 campaign.current=region;saveCampaign();$('campaign').close();audio.unlock();if(!document.fullscreenElement)toggleFullscreen();
 newOperation(battle.map,battle.difficulty,battle.seed,battle.mode,battle.options);game.title=battle.title;campaignBattle={region};updateUI();
 say(`Campanha: batalha por ${campaign.world.regions[region].name}. Vença para conquistar a região.`);
});
$('backToWorld').addEventListener('click',()=>{if(!campaignBattle||!game.winner)return;finishCampaignResult();campaignBattle=null;openCampaign();});
// Uma batalha rápida abandona a batalha de campanha em andamento (sem resultado).
$('setupForm').addEventListener('submit',()=>{if(campaignBattle){campaignBattle=null;campaign.current=null;if(campaign.story){campaign.story.active=null;campaign.story.scene=null;}saveCampaign();}},true);
$('newCampaign').addEventListener('click',()=>{
 if(campaign?.battles>0&&Date.now()-confirmNew>4000){confirmNew=Date.now();$('newCampaign').textContent='Confirmar nova campanha?';return;}
 confirmNew=0;$('newCampaign').textContent='Nova campanha';campaign=newCampaign(randomSeed(),campaign?.difficulty||$('difficulty').value,$('campaignMode').value,$('campaignKind').value);campaignBattle=null;worldView=null;selectedRegion=-1;saveCampaign();renderCampaignStats();showRegion(-1);onCampaignStoryOpen();
});
