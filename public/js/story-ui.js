'use strict';
/* Cenas nativas e contexto de batalha. Nenhuma chamada externa. */
const STORY_CHECKPOINT_KEY='rtsvibe.story.checkpoint.v1';
let storyAction=null,storyFocus=null,storyReview=false,storyPriorPause=null;
let storyGalleryOriginal;
const storyGalleryScenes=[['opening','Abertura'],...Array.from({length:8},(_,i)=>[['before'+(i+1),(i+1)+'. Antes da missão'],['after'+(i+1),(i+1)+'. Depois da missão']]).flat(),['choice-secondary','1. Escolha do objetivo'],['choice-channel','7. Escolha do canal'],['exposed','Final: conspiração exposta'],['covered','Final: verdade encoberta'],['defeat','Final: derrota'],['retreat','Retirada de missão']];
function openStoryGallery(){leaveTitleFor(()=>openMenu('storyGallery'));$('storyGalleryList').replaceChildren(...storyGalleryScenes.map(([id,label])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>playGalleryScene(id));return b;}));}
function playGalleryScene(id){
 storyGalleryOriginal=campaign;campaign=newCampaign(2024,'normal','rts','story');
 const civil=id==='exposed'||id!=='covered'&&$('storyGalleryPath').value==='protect';
 const match=/^(before|after)([1-8])$/.exec(id);
 const completed=match?Number(match[2])-(match[1]==='before'?1:0):({opening:0,'choice-secondary':0,'choice-channel':6,defeat:7,retreat:2}[id]??8);
 campaign.story.completed=Array.from({length:completed},(_,i)=>i+1);
 campaign.story.choices={...(completed>=1||id==='before1'||id==='choice-secondary'?{secondary:'records'}:{}),...(completed>=2?{ivo:civil?'protect':'hand'}:{}),...(completed>=4?{contracts:civil?'publish':'secret'}:{}),...(completed>=7||id==='before7'||id==='choice-channel'?{channel:civil?'civil':'military'}:{})};
 campaign.story.evidence=[...(completed>=1?['records','stationCopy']:[]),...(completed>=2&&civil?['testimony']:[]),...(completed>=4?['contracts']:[]),...(completed>=5?['manifest']:[]),...(completed>=7?[civil?'civil':'military']:[]),...(completed>=8?['authorization']:[])];
 campaign.story.rewards.recon=false;openStoryScene(id);$('storyHistory').hidden=true;$('storySuspend').textContent='Voltar à galeria';
}
function closeGalleryScene(){campaign=storyGalleryOriginal;storyGalleryOriginal=undefined;$('storyHistory').hidden=false;$('storySuspend').textContent='Suspender';}
$('titleScenes').addEventListener('click',openStoryGallery);
$('storyGalleryClose').addEventListener('click',()=>closeChild('storyGallery'));
$('storyGallery').addEventListener('cancel',e=>{e.preventDefault();closeChild('storyGallery');});
function refreshStoryHUD(){
 const m=game.mission;$('missionHud').hidden=!m||!started||!!document.querySelector('dialog[open]');if(!m)return;
 setText('missionHudTitle',m.chapter+'. '+Story.chapters[m.chapter].title);setText('missionHudText',Missions.summary(game));$('missionAbandon').hidden=m.chapter!==1||m.secondary!=='pending'||m.progress<(game.mode==='rts'?60:2)||!!game.winner;
}
function refreshCampaignStory(){
 const s=campaign?.story,marker=s?Story.marker(campaign):null,shown=marker&&marker.region===selectedRegion&&!s.active;
 $('storyRecap').hidden=!s;
 if(s)setText('storyRecap',s.ending?'Investigação concluída. Consulte as provas e o desfecho no diário.':s.completed.length+' de 8 capítulos concluídos. '+(Story.chapters[Story.marker(campaign)?.chapter]?.brief||'Conquiste novas regiões para abrir o próximo capítulo.'));
 $('storyMission').hidden=!shown;$('storyJournal').hidden=!s;$('storyResume').hidden=!s?.scene;$('storyCheckpoint').hidden=!s?.active||!readStoryCheckpoint();
 if(shown){setText('storyMissionTitle',marker.chapter+'. '+Story.chapters[marker.chapter].title);setText('storyMissionBrief',Story.chapters[marker.chapter].brief);setText('storyMissionBudget','Créditos iniciais: '+Story.budget(campaign,marker.chapter)+' · engenheiro e transporte necessários fornecidos.');$('startStoryMission').disabled=!!Story.pending(campaign);paintStoryPortrait(marker.chapter);$('attackRegion').disabled=true;}
 if(s&&!marker&&!campaignOver(campaign))setText('storyMissionBrief','Próximo capítulo: conquiste novas regiões.');
 if(s&&selectedRegion===campaign.world.homes.red&&!s.completed.includes(7))$('regionInfo').textContent+='\nAssalto final reservado: conclua os sete capítulos da investigação.';
}
// Retrato de quem faz o briefing da missão (primeira fala de um personagem na cena "before").
function paintStoryPortrait(chapter){
 const img=$('storyMissionPortrait'),line=Story.scene(campaign,'before'+chapter).lines.find(l=>Story.characters[l.speaker]);
 if(!line){img.hidden=true;return;}
 const ch=Story.characters[line.speaker],expression=ch.expressions.includes(line.expression)?line.expression:ch.expressions[0],src='assets/characters/'+line.speaker+'-'+expression+'.webp';
 img.onerror=()=>{img.hidden=true;};img.onload=()=>{img.hidden=false;};img.alt=ch.name;if(img.getAttribute('src')!==src)img.src=src;else img.hidden=!img.naturalWidth;
}
// Retrato de quem faz o briefing da missão (primeira fala de um personagem na cena "before").
function paintStoryPortrait(chapter){
 const img=$('storyMissionPortrait'),line=Story.scene(campaign,'before'+chapter).lines.find(l=>Story.characters[l.speaker]);
 if(!line){img.hidden=true;return;}
 const ch=Story.characters[line.speaker],expression=ch.expressions.includes(line.expression)?line.expression:ch.expressions[0],src='assets/characters/'+line.speaker+'-'+expression+'.webp';
 img.onerror=()=>{img.hidden=true;};img.onload=()=>{img.hidden=false;};img.alt=ch.name;if(img.getAttribute('src')!==src)img.src=src;else img.hidden=!img.naturalWidth;
}
function onCampaignStoryOpen(){
 const s=campaign.story;if(!s)return;
 if(s.active&&!campaignBattle&&!readStoryCheckpoint()){s.active=null;campaign.current=null;saveCampaign();refreshCampaignStory();}
 if(s.scene){resumeStoryScene();return;}
 const pending=Story.pending(campaign);if(pending){openStoryScene(pending==='ivo'?'after2':'after4');return;}
 if(!s.opened){s.opened=true;openStoryScene('opening');}
}
function openStoryScene(id,action=null,review=false){
 if(!campaign?.story||!Story.sceneExists(id))return;storyReview=review;storyFocus=document.activeElement;storyAction=action;
 if(!$('storyScene').open)storyPriorPause=game.paused;
 campaign.story.scene={id,index:0,action,revision:Story.sceneRevision(id)};saveCampaign();renderStoryScene();if(!$('storyScene').open)openMenu('storyScene');game.paused=true;$('storyNext').focus();refreshStoryHUD();
}
function resumeStoryScene(){
 const s=campaign?.story?.scene;if(!s)return;storyReview=false;storyAction=s.action||null;storyFocus=document.activeElement;storyPriorPause=game.paused;renderStoryScene();if(!$('storyScene').open)openMenu('storyScene');game.paused=true;$('storyNext').focus();
}
function renderStoryScene(){
 const state=campaign.story.scene,data=Story.scene(campaign,state.id),line=data.lines[state.index],character=Story.characters[line.speaker];
 const shot=data.shots?.[state.index],backdrop=$('storyBackdrop');
 $('storyScene').classList.toggle('illustrated',!!shot);$('storyScene').dataset.framing=shot?.framing||'wide';
 backdrop.hidden=!shot;setText('storyShotLabel',shot?.label||'');$('storyShotLabel').hidden=!shot;
 const card=$('storyDocument');card.hidden=!shot?.document;$('storyScene').dataset.document=String(!!shot?.document);const proof=Story.proofs?.[shot?.document];setText('storyDocumentTitle',proof?.title||'');setText('storyDocumentText',proof?.origin||'');$('storyInspect').dataset.proof=shot?.document||'';$('storyInspect').hidden=!shot?.document;
 setText('storyProgress',(state.index+1)+' / '+data.lines.length);
 if(shot&&backdrop.dataset.background!==shot.background){backdrop.dataset.background=shot.background;backdrop.style.visibility='hidden';backdrop.onerror=()=>{if(backdrop.getAttribute('src').endsWith('.webp'))backdrop.src='assets/story/'+({archive:'operations',station:'radio',shelter:'operations',evacuation:'transport',terminal:'operations',newsroom:'operations'}[shot.background]||shot.background)+'.svg';else backdrop.style.visibility='hidden';};backdrop.onload=()=>{backdrop.style.visibility='visible';};backdrop.src='assets/story/'+shot.background+'.webp';}
 setText('storySceneTitle',data.title);$('storySceneTitle').hidden=!!shot;setText('storySpeaker',character?.name||({radio:'Rádio',soldier:'Soldado do Posto Seis',narrator:'Diário de campanha'}[line.speaker]||'Comando'));setText('storyText',line.text);
 const participants=[...new Set(data.lines.map(l=>l.speaker).filter(id=>Story.characters[id]))],active=line.speaker;
 let pair=participants.includes(active)?[active,...participants.filter(x=>x!==active)].slice(0,2):[];
 // Mantém o lado de cada personagem durante a conversa.
 pair=(shot?.cast||participants.filter(id=>pair.includes(id))).filter(id=>id!=='vilar').slice(0,2);
 if(state.id==='before2')pair=['ivo',active==='reis'?'reis':'helena'];
 if(state.id==='after2')pair=['helena','ivo'];
 const remote=$('storyRemote'),remoteImage=$('storyRemotePortrait');remote.hidden=!shot?.remote;
 remote.classList.toggle('speaking',active==='vilar');
 if(!remote.hidden){const expression=active==='vilar'&&Story.characters.vilar.expressions.includes(line.expression)?line.expression:'controlled',src='assets/characters/vilar-'+expression+'.webp';if(remoteImage.getAttribute('src')!==src)remoteImage.src=src;}
 for(const [i,element]of [$('storyLeft'),$('storyRight')].entries()){
  const id=pair[i];element.hidden=!id;const isActive=id===active;element.classList.toggle('speaking',isActive);element.dataset.character=id||'';element.dataset.speaker=isActive?'active':'inactive';
  element.classList.toggle('story-dialogue-portrait',state.id==='choice-channel'&&id==='nara');
  if(id){const ch=Story.characters[id],expression=isActive&&ch.expressions.includes(line.expression)?line.expression:ch.expressions[0],src=state.id==='choice-channel'&&id==='nara'?'assets/characters/nara-dialogue.png':'assets/characters/'+id+'-'+expression+'.webp';element.alt=ch.name;element.onerror=()=>{element.style.visibility='hidden';};element.onload=()=>{element.style.visibility='visible';};if(element.getAttribute('src')!==src)element.src=src;}
 }
 $('storyScene').dataset.active=pair.indexOf(active)===0?'left':pair.indexOf(active)===1?'right':'none';
 const choosing=!!data.choice&&state.index===data.lines.length-1;$('storyChoices').replaceChildren();$('storyNext').hidden=choosing;$('storySkip').disabled=choosing;
 if(choosing){for(const option of Story.options[data.choice]){const button=document.createElement('button');button.type='button';const title=document.createElement('strong'),effect=document.createElement('span');title.textContent=option.label;effect.textContent=option.effect;button.append(title,effect);button.addEventListener('click',()=>{if(storyReview)return;if(storyGalleryOriginal!==undefined){completeStoryScene();return;}if(!Story.choose(campaign,data.choice,option.value))return;saveCampaign();completeStoryScene();});$('storyChoices').append(button);}if(storyReview)for(const b of $('storyChoices').children)b.disabled=true;}
}
function advanceStoryScene(){const state=campaign?.story?.scene;if(!state)return;const data=Story.scene(campaign,state.id);if(state.index<data.lines.length-1){state.index++;saveCampaign();renderStoryScene();}else if(!data.choice)completeStoryScene();}
function completeStoryScene(){
 const state=campaign.story.scene,action=storyAction,review=storyReview,gallery=storyGalleryOriginal!==undefined;if(!state)return;campaign.story.scene=null;
 if(storyGalleryOriginal===undefined&&!review&&!campaign.story.journal.some(x=>x.type==='scene'&&x.id===state.id))campaign.story.journal.push({type:'scene',id:state.id});saveCampaign();$('storyScene').close();if(storyGalleryOriginal!==undefined)closeGalleryScene();game.paused=storyPriorPause||false;syncPause();storyAction=null;storyReview=false;
 if(storyFocus?.isConnected)storyFocus.focus();if(gallery)return;if(action==='prepareMission')prepareStoryMission();else if(action==='launch')launchStoryMission();else if(action==='ending')openStoryScene(campaign.story.ending);else refreshCampaignStory();
}
function suspendStoryScene(){if(storyGalleryOriginal!==undefined){completeStoryScene();return;}saveCampaign();$('storyScene').close();game.paused=storyPriorPause||false;syncPause();if(storyFocus?.isConnected)storyFocus.focus();refreshCampaignStory();}
function startStoryMission(){const m=Story.marker(campaign);if(!m||campaign.story.active)return;const pending=Story.pending(campaign);if(pending){openStoryScene(pending==='ivo'?'after2':'after4');return;}openStoryScene('before'+m.chapter,'prepareMission');}
function prepareStoryMission(){const m=Story.marker(campaign);if(!m)return;if(m.chapter===1&&!campaign.story.choices.secondary)openStoryScene('choice-secondary','launch');else if(m.chapter===7&&!campaign.story.choices.channel)openStoryScene('choice-channel','launch');else launchStoryMission();}
function launchStoryMission(){
 const m=Story.marker(campaign);if(!m)return;campaign.mode=$('campaignMode').value;changeSetting('doctrine',cleanDoctrine($('campaignDoctrine').value));const a=Story.begin(campaign,m.chapter,m.region);if(!a)return;
 const b=battleFor(campaign,m.region);$('campaign').close();audio.unlock();newOperation(b.map,b.difficulty,a.seed,campaign.mode,b.options,STANDARD_FACTIONS);Missions.setup(game,campaign,a);campaignBattle={region:m.region,attempt:{...a},resolved:false};game.title=Story.chapters[m.chapter].title;renderer.rebuild();centerCamera(12,76);saveCampaign();saveStoryCheckpoint();updateUI();say('Objetivos e unidades protegidas destacados no campo.');
}
function finishCampaignResult(){
 if(!campaignBattle||!game.winner||campaignBattle.resolved)return;const link=campaignBattle,won=game.winner==='blue';
 if(link.attempt){if(!Story.resolve(campaign,link.attempt,game.mission.outcome||{won}))return;link.resolved=true;recordCampaignResult(won&&Story.chapters[link.attempt.chapter].conquest);
  const ending=campaign.story.ending;campaign.story.scene={id:ending?(won?'after8':'defeat'):won?'after'+link.attempt.chapter:'retreat',index:0,revision:2,action:ending&&won?'ending':null};
 }else{applyResult(campaign,link.region,won);link.resolved=true;recordCampaignResult(won);if(campaign.story&&campaignOver(campaign)){campaign.story.ending=Story.ending(campaign,won);campaign.story.scene={id:campaign.story.ending,index:0,revision:2,action:null};}}
 if(campaign.story?.scene)campaign.story.scene.revision=Story.sceneRevision(campaign.story.scene.id);
 saveCampaign();if(game.mission)saveStoryCheckpoint();
}
function exportBattleData(){return{kind:'rtsvibe-battle',battle:game.snapshot(),...(campaignBattle&&campaign?{campaign:serializeCampaign(campaign),campaignBattle:campaignBattle}: {})};}
function restoreBattleContext(data,restored){
 if(!data.campaign&&!data.campaignBattle){if(restored.mission)throw Error('Save narrativo sem campanha.');return null;}
 const c=deserializeCampaign(data.campaign),link=data.campaignBattle;if(!c||!link||!Number.isInteger(link.region)||!c.world.regions[link.region])throw Error('Contexto de campanha inválido.');
 if(link.attempt&&!restored.mission)throw Error('Contexto narrativo sem missão.');
 if(restored.mission){const a=link.attempt,m=restored.mission;if(!c.story||!a||a.id!==m.attempt.id||a.campaignId!==c.story.id||a.region!==link.region||a.chapter!==m.chapter||restored.campaignLink?.campaignId!==c.story.id)throw Error('Batalha pertence a outra campanha.');
  if(typeof link.resolved!=='boolean'||a.seed!==m.attempt.seed||a.region!==m.attempt.region||m.attempt.campaignId!==c.story.id||restored.campaignLink.attemptId!==a.id||restored.campaignLink.region!==a.region||Object.entries(m.choices).some(([k,v])=>c.story.choices[k]!==v))throw Error('Dados contraditórios da missão.');
  if(!Array.isArray(a.discoveries)||JSON.stringify(a.discoveries)!==JSON.stringify(m.attempt.discoveries)||JSON.stringify(a.discoveries)!==JSON.stringify(m.discoveries)||a.discoveries.some(id=>!c.story.discoveries.includes(id)))throw Error('Descobertas da tentativa não correspondem à campanha.');
  const requiredChoices=Story.chapters[m.chapter].requiredChoices;
  if(requiredChoices.some(k=>!m.choices[k]||m.choices[k]!==c.story.choices[k]))throw Error('Escolhas obrigatórias ausentes na missão.');
  if(link.resolved){if(!restored.winner||!c.story.applied.includes(a.id))throw Error('Resultado narrativo inválido.');}
  else if(!c.story.active||['id','campaignId','chapter','region','seed'].some(k=>c.story.active[k]!==a[k]))throw Error('Tentativa de missão inválida.');
  const current=campaign||loadCampaign();if(current?.story?.id===c.story.id&&current.story.applied.includes(a.id)){if(!link.resolved)throw Error('Esta tentativa já foi concluída. Carregue um save atual.');return{campaign:current,link:{...link,resolved:true}};}
 }
 return{campaign:c,link};
}
function saveStoryCheckpoint(){if(!game.mission||!campaignBattle)return;try{localStorage.setItem(STORY_CHECKPOINT_KEY,JSON.stringify(exportBattleData()));}catch{say('Não foi possível salvar o checkpoint local. Use Salvar batalha para exportar.');}}
function readStoryCheckpoint(){try{const d=JSON.parse(localStorage.getItem(STORY_CHECKPOINT_KEY));return d?.campaignBattle?.attempt?.campaignId===campaign?.story?.id&&d.campaignBattle.attempt.id===campaign.story.active?.id?d:null;}catch{return null;}}
function resumeStoryCheckpoint(){const d=readStoryCheckpoint();if(!d)return;try{const restored=Game.fromSnapshot(d.battle),context=restoreBattleContext(d,restored);game=restored;campaign=context.campaign;campaignBattle=context.link;started=true;paused=true;game.paused=false;resultShown=!!game.winner;selection.clear();for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();overlaid=false;renderer.rebuild();saveCampaign();updateUI();say('Operação retomada do checkpoint inicial. Retome para continuar.');}catch(error){say('Não foi possível retomar: '+error.message);}}
function showStoryDiary(){
 const s=campaign?.story;if(!s)return;const content=$('storyDiaryContent');content.replaceChildren();const add=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;content.append(e);};
 add('p','Capítulos concluídos: '+s.completed.length+' / 8 · regiões distintas conquistadas: '+s.seen.length);
 for(const id of s.evidence){const proof=Story.proofs?.[id];add('h3',proof?.title||id);add('p',Story.documents[id]||proof?.body||'');if(proof){const b=document.createElement('button');b.type='button';b.textContent='Examinar prova';b.addEventListener('click',()=>inspectStoryProof(id));content.append(b);}}
 for(const entry of s.journal){if(entry.type==='choice'){const o=Story.options[entry.key].find(x=>x.value===entry.value);add('p','Decisão: '+o.label+'. '+o.effect);}if(entry.type==='result')add('p',(entry.won?'Concluída: ':'Recuo: ')+Story.chapters[entry.chapter].title+'.');if(entry.type==='scene'){const data=Story.scene(campaign,entry.id);add('h3',data.title);for(const l of data.lines)add('p',(Story.characters[l.speaker]?.name||'Rádio / diário')+': '+l.text);}}
 openMenu('storyDiary');
}
$('startStoryMission').addEventListener('click',startStoryMission);$('storyNext').addEventListener('click',advanceStoryScene);$('storySkip').addEventListener('click',()=>{const state=campaign.story.scene,data=Story.scene(campaign,state.id);if(data.choice){state.index=data.lines.length-1;saveCampaign();renderStoryScene();}else completeStoryScene();});
$('storySuspend').addEventListener('click',suspendStoryScene);$('storyScene').addEventListener('cancel',e=>{e.preventDefault();suspendStoryScene();});$('storyScene').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat&&!['BUTTON','INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();advanceStoryScene();}});
$('storyResume').addEventListener('click',resumeStoryScene);$('storyCheckpoint').addEventListener('click',resumeStoryCheckpoint);$('storyJournal').addEventListener('click',showStoryDiary);$('storyHistory').addEventListener('click',showStoryDiary);$('storyDiaryClose').addEventListener('click',()=>closeMenu('storyDiary'));$('storyDiary').addEventListener('cancel',e=>{e.preventDefault();closeMenu('storyDiary');});
$('missionAbandon').addEventListener('click',()=>{Missions.abandon(game);updateUI();});

let storyInspection=null;
function inspectStoryProof(id){
 const proof=Story.proofs?.[id];if(!proof)return;
 storyInspection={id,focus:document.activeElement,paused:game.paused,preview:!campaign.story.evidence.includes(id),examined:[]};game.paused=true;
 setText('proofTitle',proof.title);setText('proofOrigin',proof.origin);setText('proofBody',proof.body);setText('proofReaction','Selecione uma marca no documento para conferir o detalhe.');
 $('proofDetails').replaceChildren(...proof.details.map(detail=>{const b=document.createElement('button');b.type='button';b.dataset.detail=detail.id;b.textContent=detail.label;b.addEventListener('click',()=>{if(storyInspection.preview){if(!storyInspection.examined.includes(detail.id))storyInspection.examined.push(detail.id);}else{Story.inspect(campaign,id,detail.id);saveCampaign();}setText('proofReaction',(Story.characters[detail.speaker]?.name||detail.speaker||'Diário')+': '+detail.reaction);setText('proofDetailText',detail.text);refreshProofDetails();});return b;}));
 setText('proofDetailText','');refreshProofDetails();$('proofClose').textContent=$('storyDiary').open?'Voltar ao diário':'Voltar à conversa';$('storyProof').showModal();$('proofClose').focus();
}
function refreshProofDetails(){const id=storyInspection.id,proof=Story.proofs?.[id];let count=0;for(const b of $('proofDetails').children){const found=campaign.story.discoveries?.includes(id+':'+b.dataset.detail)||storyInspection.examined.includes(b.dataset.detail);b.classList.toggle('examined',!!found);b.setAttribute('aria-pressed',String(!!found));if(found)count++;}setText('proofCount',(storyInspection.preview?'Prévia · ':'')+count+' / '+proof.details.length+' detalhes examinados'+(storyInspection.preview?' · registro disponível após recuperar a prova':''));}
function closeStoryProof(){if(!storyInspection)return;const previous=storyInspection;storyInspection=null;$('storyProof').close();game.paused=previous.paused;if(previous.focus?.isConnected)previous.focus.focus();}
$('storyInspect').addEventListener('click',()=>inspectStoryProof($('storyInspect').dataset.proof));$('proofClose').addEventListener('click',closeStoryProof);$('storyProof').addEventListener('cancel',e=>{e.preventDefault();closeStoryProof();});
function restoreLegacyStoryImport(data,rawText){if(!data.campaign)return false;const restored=deserializeCampaign(data.campaign);if(!restored?.legacyReset)return false;backupLegacyCampaign(rawText);localStorage.setItem(CAMPAIGN_KEY,serializeCampaign(restored));delete restored.legacyReset;campaign=restored;campaignBattle=null;worldView=null;selectedRegion=-1;localStorage.removeItem(STORY_CHECKPOINT_KEY);saveCampaign();for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();openCampaign();say('Campanha antiga reiniciada na primeira missão. O arquivo original foi preservado na cópia de recuperação.');return true;}
