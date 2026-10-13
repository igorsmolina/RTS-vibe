'use strict';
/* Cenas nativas e contexto de batalha. Nenhuma chamada externa. */
const STORY_CHECKPOINT_KEY='rtsvibe.story.checkpoint.v1';
let storyAction=null,storyFocus=null,storyReview=false,storyPriorPause=null;
function refreshStoryHUD(){
 const m=game.mission;$('missionHud').hidden=!m||!started||!!document.querySelector('dialog[open]');if(!m)return;
 setText('missionHudTitle',m.chapter+'. '+Story.chapters[m.chapter].title);setText('missionHudText',Missions.summary(game));$('missionAbandon').hidden=m.chapter!==1||m.secondary!=='pending'||m.progress<(game.mode==='rts'?60:2)||!!game.winner;
}
function refreshCampaignStory(){
 const s=campaign?.story,marker=s?Story.marker(campaign):null,shown=marker&&marker.region===selectedRegion&&!s.active;
 $('storyMission').hidden=!shown;$('storyJournal').hidden=!s;$('storyResume').hidden=!s?.scene;$('storyCheckpoint').hidden=!s?.active||!readStoryCheckpoint();
 if(shown){setText('storyMissionTitle',marker.chapter+'. '+Story.chapters[marker.chapter].title);setText('storyMissionBrief',Story.chapters[marker.chapter].brief);setText('storyMissionBudget','Créditos iniciais: '+Story.budget(campaign,marker.chapter)+' · engenheiro e transporte necessários fornecidos.');$('startStoryMission').disabled=!!Story.pending(campaign);$('attackRegion').disabled=true;}
 if(s&&!marker&&!campaignOver(campaign))setText('storyMissionBrief','Próximo capítulo: conquiste novas regiões.');
 if(s&&selectedRegion===campaign.world.homes.red&&!s.completed.includes(4))$('regionInfo').textContent+='\nAssalto final reservado: conclua os quatro capítulos da investigação.';
}
function onCampaignStoryOpen(){
 const s=campaign.story;if(!s)return;
 if(s.active&&!campaignBattle&&!readStoryCheckpoint()){s.active=null;campaign.current=null;saveCampaign();refreshCampaignStory();}
 if(s.scene){resumeStoryScene();return;}
 const pending=Story.pending(campaign);if(pending){openStoryScene(pending==='ivo'?'after2':'after3');return;}
 if(!s.opened){s.opened=true;openStoryScene('opening');}
}
function openStoryScene(id,action=null,review=false){
 if(!campaign?.story||!Story.sceneExists(id))return;storyReview=review;storyFocus=document.activeElement;storyAction=action;
 if(!$('storyScene').open)storyPriorPause=game.paused;
 campaign.story.scene={id,index:0,action};saveCampaign();renderStoryScene();if(!$('storyScene').open)openMenu('storyScene');game.paused=true;$('storyNext').focus();refreshStoryHUD();
}
function resumeStoryScene(){
 const s=campaign?.story?.scene;if(!s)return;storyReview=false;storyAction=s.action||null;storyFocus=document.activeElement;storyPriorPause=game.paused;renderStoryScene();if(!$('storyScene').open)openMenu('storyScene');game.paused=true;$('storyNext').focus();
}
function renderStoryScene(){
 const state=campaign.story.scene,data=Story.scene(campaign,state.id),line=data.lines[state.index],character=Story.characters[line.speaker];
 setText('storySceneTitle',data.title);setText('storySpeaker',character?.name||({radio:'Rádio',soldier:'Soldado do Posto Seis',narrator:'Diário de campanha'}[line.speaker]||'Comando'));setText('storyText',line.text);
 const participants=[...new Set(data.lines.map(l=>l.speaker).filter(id=>Story.characters[id]))],active=line.speaker;
 let pair=participants.includes(active)?[active,...participants.filter(x=>x!==active)].slice(0,2):[];
 // Mantém o lado de cada personagem durante a conversa.
 pair=participants.filter(id=>pair.includes(id));
 for(const [i,element]of [$('storyLeft'),$('storyRight')].entries()){
  const id=pair[i];element.hidden=!id;const isActive=id===active;element.classList.toggle('speaking',isActive);element.dataset.speaker=isActive?'active':'inactive';
  if(id){const ch=Story.characters[id],expression=isActive&&ch.expressions.includes(line.expression)?line.expression:ch.expressions[0],src='assets/characters/'+id+'-'+expression+'.webp';element.alt=ch.name;element.onerror=()=>{element.style.visibility='hidden';};element.onload=()=>{element.style.visibility='visible';};if(element.getAttribute('src')!==src)element.src=src;}
 }
 $('storyScene').dataset.active=pair.indexOf(active)===0?'left':pair.indexOf(active)===1?'right':'none';
 const choosing=!!data.choice&&state.index===data.lines.length-1;$('storyChoices').replaceChildren();$('storyNext').hidden=choosing;$('storySkip').disabled=choosing;
 if(choosing){for(const option of Story.options[data.choice]){const button=document.createElement('button');button.type='button';const title=document.createElement('strong'),effect=document.createElement('span');title.textContent=option.label;effect.textContent=option.effect;button.append(title,effect);button.addEventListener('click',()=>{if(storyReview)return;if(!Story.choose(campaign,data.choice,option.value))return;saveCampaign();completeStoryScene();});$('storyChoices').append(button);}if(storyReview)for(const b of $('storyChoices').children)b.disabled=true;}
}
function advanceStoryScene(){const state=campaign?.story?.scene;if(!state)return;const data=Story.scene(campaign,state.id);if(state.index<data.lines.length-1){state.index++;saveCampaign();renderStoryScene();}else if(!data.choice)completeStoryScene();}
function completeStoryScene(){
 const state=campaign.story.scene,action=storyAction,review=storyReview;campaign.story.scene=null;
 if(!review&&!campaign.story.journal.some(x=>x.type==='scene'&&x.id===state.id))campaign.story.journal.push({type:'scene',id:state.id});saveCampaign();$('storyScene').close();game.paused=storyPriorPause||false;syncPause();storyAction=null;storyReview=false;
 if(storyFocus?.isConnected)storyFocus.focus();if(action==='prepareMission')prepareStoryMission();else if(action==='launch')launchStoryMission();else if(action==='ending')openStoryScene(campaign.story.ending);else refreshCampaignStory();
}
function suspendStoryScene(){saveCampaign();$('storyScene').close();game.paused=storyPriorPause||false;syncPause();if(storyFocus?.isConnected)storyFocus.focus();refreshCampaignStory();}
function startStoryMission(){const m=Story.marker(campaign);if(!m||campaign.story.active)return;const pending=Story.pending(campaign);if(pending){openStoryScene(pending==='ivo'?'after2':'after3');return;}openStoryScene('before'+m.chapter,'prepareMission');}
function prepareStoryMission(){const m=Story.marker(campaign);if(!m)return;if(m.chapter===1&&!campaign.story.choices.secondary)openStoryScene('choice-secondary','launch');else if(m.chapter===4&&!campaign.story.choices.channel)openStoryScene('choice-channel','launch');else launchStoryMission();}
function launchStoryMission(){
 const m=Story.marker(campaign);if(!m)return;campaign.mode=$('campaignMode').value;changeSetting('doctrine',cleanDoctrine($('campaignDoctrine').value));const a=Story.begin(campaign,m.chapter,m.region);if(!a)return;
 const b=battleFor(campaign,m.region);$('campaign').close();audio.unlock();newOperation(b.map,b.difficulty,a.seed,campaign.mode,b.options);Missions.setup(game,campaign,a);campaignBattle={region:m.region,attempt:{...a},resolved:false};game.title=Story.chapters[m.chapter].title;renderer.rebuild();centerCamera(12,76);saveCampaign();saveStoryCheckpoint();updateUI();say('Objetivos e unidades protegidas destacados no campo.');
}
function finishCampaignResult(){
 if(!campaignBattle||!game.winner||campaignBattle.resolved)return;const link=campaignBattle,won=game.winner==='blue';
 if(link.attempt){if(!Story.resolve(campaign,link.attempt,game.mission.outcome||{won}))return;link.resolved=true;recordCampaignResult(won&&[1,3,5].includes(link.attempt.chapter));
  const ending=campaign.story.ending;campaign.story.scene={id:ending?(won?'after5':'defeat'):won?'after'+link.attempt.chapter:'retreat',index:0,action:ending&&won?'ending':null};
 }else{applyResult(campaign,link.region,won);link.resolved=true;recordCampaignResult(won);if(campaign.story&&campaignOver(campaign)){campaign.story.ending=Story.ending(campaign,won);campaign.story.scene={id:campaign.story.ending,index:0,action:null};}}
 saveCampaign();if(game.mission)saveStoryCheckpoint();
}
function exportBattleData(){return{kind:'rtsvibe-battle',battle:game.snapshot(),...(campaignBattle&&campaign?{campaign:serializeCampaign(campaign),campaignBattle:campaignBattle}: {})};}
function restoreBattleContext(data,restored){
 if(!data.campaign&&!data.campaignBattle){if(restored.mission)throw Error('Save narrativo sem campanha.');return null;}
 const c=deserializeCampaign(data.campaign),link=data.campaignBattle;if(!c||!link||!Number.isInteger(link.region)||!c.world.regions[link.region])throw Error('Contexto de campanha inválido.');
 if(link.attempt&&!restored.mission)throw Error('Contexto narrativo sem missão.');
 if(restored.mission){const a=link.attempt,m=restored.mission;if(!c.story||!a||a.id!==m.attempt.id||a.campaignId!==c.story.id||a.region!==link.region||a.chapter!==m.chapter||restored.campaignLink?.campaignId!==c.story.id)throw Error('Batalha pertence a outra campanha.');
  if(typeof link.resolved!=='boolean'||a.seed!==m.attempt.seed||a.region!==m.attempt.region||m.attempt.campaignId!==c.story.id||restored.campaignLink.attemptId!==a.id||restored.campaignLink.region!==a.region||Object.entries(m.choices).some(([k,v])=>c.story.choices[k]!==v))throw Error('Dados contraditórios da missão.');
  const requiredChoices=m.chapter<3?['secondary']:m.chapter===3?['secondary','ivo']:['secondary','ivo','contracts','channel'];
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
 add('p','Capítulos concluídos: '+s.completed.length+' / 5 · regiões distintas conquistadas: '+s.seen.length);
 for(const id of s.evidence){add('h3',({records:'Autorização antecipada',testimony:'Depoimento de Ivo',contracts:'Contratos do corredor',civil:'Recibo da rede civil',authorization:'Autorização conjunta'}[id]));add('p',Story.documents[id]);}
 for(const entry of s.journal){if(entry.type==='choice'){const o=Story.options[entry.key].find(x=>x.value===entry.value);add('p','Decisão: '+o.label+'. '+o.effect);}if(entry.type==='result')add('p',(entry.won?'Concluída: ':'Recuo: ')+Story.chapters[entry.chapter].title+'.');if(entry.type==='scene'){const data=Story.scene(campaign,entry.id);add('h3',data.title);for(const l of data.lines)add('p',(Story.characters[l.speaker]?.name||'Rádio / diário')+': '+l.text);}}
 openMenu('storyDiary');
}
$('startStoryMission').addEventListener('click',startStoryMission);$('storyNext').addEventListener('click',advanceStoryScene);$('storySkip').addEventListener('click',()=>{const state=campaign.story.scene,data=Story.scene(campaign,state.id);if(data.choice){state.index=data.lines.length-1;saveCampaign();renderStoryScene();}else completeStoryScene();});
$('storySuspend').addEventListener('click',suspendStoryScene);$('storyScene').addEventListener('cancel',e=>{e.preventDefault();suspendStoryScene();});$('storyScene').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat&&!['BUTTON','INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();advanceStoryScene();}});
$('storyResume').addEventListener('click',resumeStoryScene);$('storyCheckpoint').addEventListener('click',resumeStoryCheckpoint);$('storyJournal').addEventListener('click',showStoryDiary);$('storyHistory').addEventListener('click',showStoryDiary);$('storyDiaryClose').addEventListener('click',()=>closeMenu('storyDiary'));$('storyDiary').addEventListener('cancel',e=>{e.preventDefault();closeMenu('storyDiary');});
$('missionAbandon').addEventListener('click',()=>{Missions.abandon(game);updateUI();});
