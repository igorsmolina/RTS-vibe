'use strict';
const TUTORIAL_KEY='rtsvibe.tutorial.v1';
// Semente fixa com posto didático a 4–8 casas do QG: cenário preparado aprovado pelo jogador.
const TUTORIAL_SEED=9;
const TUTORIAL_STEPS=[
 {event:'select',title:'Selecionar',text:'Clique numa tropa azul. Arraste para selecionar várias.',target:'#battlefield'},
 {event:'move',title:'Mover',text:'Clique com o botão direito num ponto livre. Ou use Mover (M) e clique no destino.',target:'#move'},
 {event:'camera',title:'Câmera',text:'A roda aproxima, o botão do meio arrasta e o minimapa leva a qualquer ponto.',target:'#minimap'},
 {event:'capture',title:'Capturar posto',text:'Postos dourados são neutros e rendem créditos. Com a infantaria selecionada, clique com o botão direito num posto.',target:'#battlefield'},
 {event:'recruit',title:'Produzir',text:'Clique em QG e treine uma tropa nas pastas da lateral.',target:'#hqButton'},
 {event:'group',title:'Grupos',text:'Com tropas selecionadas, Ctrl + 1 cria o grupo 1; depois, a tecla 1 seleciona o grupo.',target:'#groups'},
 {event:'endTurn',title:'Encerrar turno',text:'Terminou? Encerre o turno (Enter). A IA joga e a rodada avança.',target:'#endTurn'},
 {event:'attack',title:'Atacar',text:'Ao avistar um inimigo vermelho, selecione tropas e clique com o botão direito nele.',target:'#attackMove'}
];
const tutorialState={active:false,step:0,starting:false,completed:false};
function tutorialBadge(){let done=false;try{done=localStorage.getItem(TUTORIAL_KEY)==='done';}catch{}$('titleTutorial').classList.toggle('new',!done);}
function markTutorialDone(){try{localStorage.setItem(TUTORIAL_KEY,'done');}catch{}$('titleTutorial').classList.remove('new');}
function showTutorialStep(){
 document.querySelectorAll('.tutorial-target').forEach(e=>e.classList.remove('tutorial-target'));
 const step=TUTORIAL_STEPS[tutorialState.step];$('tutorial').hidden=false;
 if(!step){tutorialState.completed=true;markTutorialDone();setText('tutorialStep','8 passos concluídos');setText('tutorialTitle','Treinamento concluído');setText('tutorialText','Capture postos e destrua o QG inimigo para vencer.');$('tutorialSkip').hidden=true;setText('tutorialExit','Continuar jogando');return;}
 setText('tutorialStep','Passo '+(tutorialState.step+1)+' de '+TUTORIAL_STEPS.length);setText('tutorialTitle',step.title);setText('tutorialText',step.text);$('tutorialSkip').hidden=false;setText('tutorialExit','Sair do treinamento');document.querySelector(step.target)?.classList.add('tutorial-target');
}
function startTutorial(){
 endTutorial(false);if(typeof campaignBattle!=='undefined')campaignBattle=null;if(typeof campaign!=='undefined'&&campaign){campaign.current=null;if(typeof saveCampaign==='function')saveCampaign();}
 for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();backTo=null;
 tutorialState.starting=true;
 // Formação própria do treinamento não sobrescreve a formação salva do jogador.
 const army=settings.startingArmy;try{settings.startingArmy=STARTING_DEFAULT;newOperation('river','easy',TUTORIAL_SEED,'turns',undefined,STANDARD_FACTIONS);}finally{settings.startingArmy=army;tutorialState.starting=false;}
 const hq=game.hq('blue'),infantry=game.units.find(u=>u.owner==='blue'&&u.type==='infantry'),sites=[];
 for(let y=Math.max(0,hq.y-8);y<=Math.min(ROWS-1,hq.y+8);y++)for(let x=Math.max(0,hq.x-8);x<=Math.min(COLS-1,hq.x+8);x++){
  const cell={x,y},distance=DIST(hq,cell);if(distance<4||distance>8||game.structureAt(x,y)||game.units.some(u=>u.x===x&&u.y===y))continue;
  const route=game.findPath(infantry,cell,true);if(route?.length)sites.push({cell,cost:game.pathCost(infantry,route)});
 }
 sites.sort((a,b)=>a.cost-b.cost);if(sites.length){const cell=sites[0].cell,post=game.add('neutral','post',cell.x,cell.y);for(const owner of ['blue','red'])game.memory[owner].set(KEY(cell.x,cell.y),{id:post.id,x:post.x,y:post.y,type:post.type,owner:post.owner});game.updateVision();renderer.dirty=true;updateUI();}
 tutorialState.active=true;tutorialState.step=0;tutorialState.completed=false;showTutorialStep();centerCamera(infantry.x,infantry.y);renderer.dirty=true;
}
function tutorialEvent(name){
 if(name==='operation'){if(!tutorialState.starting)endTutorial(false);return;}
 if(!tutorialState.active||tutorialState.completed||TUTORIAL_STEPS[tutorialState.step].event!==name)return;
 tutorialState.step++;showTutorialStep();
}
function endTutorial(completed){tutorialState.active=false;$('tutorial').hidden=true;document.querySelectorAll('.tutorial-target').forEach(e=>e.classList.remove('tutorial-target'));if(completed)markTutorialDone();}
$('titleTutorial').addEventListener('click',startTutorial);$('manualTutorial').addEventListener('click',startTutorial);
$('tutorialSkip').addEventListener('click',()=>{if(tutorialState.active&&!tutorialState.completed){tutorialState.step++;showTutorialStep();}});
$('tutorialExit').addEventListener('click',()=>endTutorial(true));tutorialBadge();
