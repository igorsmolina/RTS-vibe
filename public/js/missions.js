'use strict';
/* Objetivos especiais usam o motor e a carga existentes. Estado inteiro no snapshot. */
const Missions={
 setup(g,c,a){
  const chapter=a.chapter,m=g.mission={version:2,chapter,attempt:{...a,discoveries:[...(a.discoveries||c.story.discoveries)]},choices:{...c.story.choices},discoveries:[...(a.discoveries||c.story.discoveries)],terminalRecon:false,contactReward:false,ids:{},extraction:{x:10,y:82},progress:0,lastTime:g.time,lastRound:g.round,roundEligible:false,roundInitialized:false,waves:0,secondary:'pending',copied:false,loaded:false,outcome:null};
  g.campaignLink={campaignId:c.story.id,attemptId:a.id,region:a.region};g.credits.blue=Story.budget(c,chapter);
  g.mines=[];g.structures=g.structures.filter(s=>s.type==='hq');g.units=g.units.filter(u=>u.owner==='blue');
  g.memory={blue:new Map(),red:new Map()};g.intel=new Map();for(const owner of ['blue','red'])g.explored[owner].fill(false);
  const blue=g.structures.find(s=>s.owner==='blue'),red=g.structures.find(s=>s.owner==='red');Object.assign(blue,{x:9,y:79});Object.assign(red,{x:114,y:12});
  const road=(from,to)=>{let x=from.x,y=from.y;const paint=()=>{for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(INSIDE(x+dx,y+dy))g.terrain[KEY(x+dx,y+dy)]='plain';};paint();while(x!==to.x){x+=Math.sign(to.x-x);paint();}while(y!==to.y){y+=Math.sign(to.y-y);paint();}};
  const points=[{x:12,y:76},{x:52,y:55},{x:68,y:42},{x:30,y:30},{x:45,y:58},{x:64,y:42},{x:82,y:26},{x:114,y:12},m.extraction];
  // ponytail: rotas locais ortogonais garantem acesso; substituir por templates manuais se a direção de arte exigir.
  for(const p of points)road({x:12,y:76},p);road({x:8,y:82},{x:82,y:26});road({x:85,y:22},{x:45,y:58});
  if(chapter===2||chapter===6){road({x:12,y:76},{x:52,y:50});road({x:12,y:76},{x:18,y:35});road({x:18,y:35},{x:52,y:50});}
  const add=(key,type,owner,x,y,label,role)=>{road({x,y},{x,y});const u=g.add(owner,type,x,y);if(!u)throw Error('Posição de missão inválida.');u.missionLabel=label;u.missionRole=role||key;if(TYPES[type].structure)u.missionTarget=true;m.ids[key]=u.id;return u;};
  let index=0;for(const u of g.units){const cell={x:12+index%8,y:72-Math.floor(index/8)*2};Object.assign(u,cell,{order:{type:'stop'},path:[],segment:null,job:null});road(cell,cell);index++;}
  add('engineer','engineer','blue',12,77,'Engenheiro da operação');
  if([1,2,6,8].includes(chapter))add('truck','transportTruck','blue',13,77,'Transporte protegido');
  if(chapter===1){add('station','post','red',52,55,'Estação de comunicações');add('records','post','red',68,42,'Depósito de registros');const convoy=add('convoy','transportTruck','blue',30,30,'Comboio encurralado');if(m.choices.secondary!=='convoy')convoy.missionLabel='Comboio';}
  if(chapter===2){add('ivo','infantry','blue',52,50,'Ivo Vargas','informant');if(c.story.rewards.recon)add('recon','recon','blue',14,77,'Reconhecimento do comboio');}
  if(chapter===3){m.extraction={x:108,y:74};road({x:30,y:58},m.extraction);add('civilian1','transportTruck','blue',30,58,'Caminhão civil 1','informant');add('civilian2','transportTruck','blue',30,62,'Caminhão civil 2','informant');if(m.discoveries.includes('records:route')){m.route={x:75,y:80};road({x:30,y:62},m.route);road(m.route,m.extraction);}}
  if(chapter===5){add('terminal','post','red',44,55,'Terminal de carga');add('archive','hq','red',67,43,'Arquivo do manifesto');if(m.discoveries.includes('contracts:cargo'))add('cargo','post','red',30,30,'Carga identificada · reconhecimento');}
  if(chapter===6){add('nara','infantry','blue',52,50,'Lara','informant');if(c.story.rewards.terminalRecon)add('recon','recon','blue',14,77,'Reconhecimento do terminal');if(m.discoveries.includes('manifest:contact'))add('contact','post','red',30,30,'Contato local · 50 créditos');}
  if(chapter===4){add('power','post','red',44,55,'Central de energia');add('archive','hq','red',67,43,'Arquivo administrativo');}
  if(chapter===7){add('station','post','blue',45,58,'Estação de transmissão');add('aux','post','red',64,42,'Antena auxiliar');add('aa','antiAirVehicle','blue',44,61,'Defesa da estação');}
  if(chapter===8)add('archive','hq','red',82,26,'Centro de comando e arquivo');
  if(chapter!==7){const at=[2,6].includes(chapter)?{x:31,y:62}:{x:chapter===8?85:55,y:chapter===8?31:48};
   for(const [i,type]of ['infantry','infantry','antitank','lightTank'].entries()){const p={x:at.x+i*2,y:at.y};road(p,p);g.add('red',type,p.x,p.y);}
   if(chapter===4)g.add('red','antitank',46,52);
  }
  g.plan={phase:'prepare',since:g.mode==='rts'?g.time:g.round,rally:null,objective:null,wave:[],waveStart:0};g.aiQueue=[];g.actions=[];g.animation=null;g.updateVision();this.step(g);
 },
 protected(g,key){const id=g.mission.ids[key];return g.get(id)||g.units.flatMap(u=>u.cargo||[]).find(u=>u.id===id)||null;},
 finish(g,won,reason){if(g.winner)return;g.mission.outcome={won,reason,records:g.mission.secondary==='records',convoy:g.mission.secondary==='convoy',terminalRecon:g.mission.terminalRecon};g.winner=won?'blue':'red';g.log(reason,['blue','red']);},
 wave(g){const m=g.mission,i=m.waves++;const types=i===0?['infantry','infantry','recon']:i===1?['tank','antitank','infantry']:['helicopter','lightTank','infantry'];
  for(const [n,type]of types.entries()){const x=85+n*3,y=22+i*3;g.terrain[KEY(x,y)]='plain';const u=g.add('red',type,x,y);if(u&&g.mode==='turns')g.aiQueue.push(u.id);}
  g.log(i===2?'Reserva aérea confirmada: helicóptero e blindados.':'Onda '+(i+1)+' entrando pelo acesso norte.',['blue','red']);
 },
 step(g){
  const m=g.mission;if(!m||g.winner||g.paused)return;const dt=Math.max(0,g.time-m.lastTime),rounds=Math.max(0,g.round-m.lastRound);m.lastTime=g.time;m.lastRound=g.round;
  const entity=key=>g.get(m.ids[key]),own=key=>entity(key)?.owner==='blue',engineer=key=>{const t=entity(key);return !!t&&g.units.some(u=>u.owner==='blue'&&u.type==='engineer'&&u.hp>0&&DIST(u,t)<=1&&!u.segment);};
  const critical=[1,7].includes(m.chapter)?'station':[4,5,8].includes(m.chapter)?'archive':null;
  if(critical&&!entity(critical)||m.chapter===4&&!entity('power')||m.chapter===5&&!entity('terminal')){this.finish(g,false,'O objetivo protegido foi destruído.');return;}
  let eligible=false;
  if(m.chapter===1){eligible=own('station')&&engineer('station');if(m.secondary==='pending'){
   if(m.choices.secondary==='records'&&own('records'))m.secondary='records';
   else if(m.choices.secondary==='records'&&!entity('records'))m.secondary='failed';
   else if(m.choices.secondary==='convoy'){const u=entity('convoy');if(!u)m.secondary='failed';else if(DIST(u,m.extraction)<=2)m.secondary='convoy';}
  }}
  if(m.chapter===3){const trucks=['civilian1','civilian2'].map(entity);if(trucks.some(u=>!u)){this.finish(g,false,'Um dos caminhões civis foi destruído.');return;}if(trucks.every(u=>DIST(u,m.extraction)<=2))this.finish(g,true,'Os dois caminhões civis chegaram à extração.');return;}
  if(m.chapter===5&&own('cargo'))m.terminalRecon=true;
  if(m.chapter===6&&own('contact')&&!m.contactReward){m.contactReward=true;g.credits.blue+=50;g.log('Contato local: 50 créditos recebidos.',['blue']);}
  if(m.chapter===2||m.chapter===6){const person=m.chapter===2?'ivo':'nara',name=m.chapter===2?'Ivo':'Lara',ivo=this.protected(g,person);if(!ivo){this.finish(g,false,name+' não sobreviveu à extração.');return;}
   const carrier=g.units.find(u=>u.owner==='blue'&&u.type==='transportTruck'&&(u.cargo||[]).some(p=>p.id===ivo.id));if(carrier&&DIST(carrier,m.extraction)<=2)this.finish(g,true,name+' chegou à extração.');return;}
  if(m.chapter===5)eligible=own('terminal')&&own('archive')&&engineer('archive');
  if(m.chapter===4)eligible=own('power')&&own('archive')&&engineer('archive');
  if(m.chapter===7){const elapsed=g.mode==='rts'?g.time:g.round-1;while(m.waves<3&&elapsed>=(g.mode==='rts'?m.waves*60:m.waves*2))this.wave(g);
   const station=entity('station'),enemy=g.units.some(u=>u.owner==='red'&&!AIR(u)&&DIST(u,station)<=3);eligible=own('station')&&!enemy&&(m.choices.channel!=='civil'||m.choices.contracts==='publish'||own('aux'));}
  if(m.chapter===8){eligible=own('archive')&&engineer('archive');if(!m.loaded&&!entity('truck')){const replacement=g.units.find(u=>u.owner==='blue'&&u.type==='transportTruck');if(replacement)m.ids.truck=replacement.id;}
   const truck=entity('truck');if(m.loaded&&!truck){this.finish(g,false,'O veículo com os documentos foi destruído.');return;}
   if(m.copied&&!m.loaded&&truck&&DIST(truck,entity('archive'))<=1){m.loaded=true;truck.missionLabel='Autorização final a bordo';g.log('Documentos embarcados. Conduza o caminhão à transmissão.',['blue']);}
   if(m.loaded&&truck&&DIST(truck,m.extraction)<=2){this.finish(g,true,'Autorização final transmitida.');return;}
  }
  if(g.mode==='rts'){if(eligible)m.progress+=dt;}else{
   if(!m.roundInitialized){m.roundInitialized=true;m.roundEligible=eligible;}
   if(rounds){if(eligible&&m.roundEligible)m.progress+=1;m.roundEligible=eligible;}else if(!eligible)m.roundEligible=false;
  }
  const goal=m.chapter===7?(g.mode==='rts'?180:6):(g.mode==='rts'?60:2);
  if(m.progress+1e-6>=goal){m.progress=goal;if(m.chapter===1&&m.secondary!=='pending')this.finish(g,true,'Cópia da estação preservada.');if(m.chapter===5)this.finish(g,true,'Manifesto recuperado.');if(m.chapter===4)this.finish(g,true,'Contratos recuperados.');if(m.chapter===7)this.finish(g,true,'Transmissão concluída.');if(m.chapter===8&&!m.copied){m.copied=true;this.wave(g);g.log('Autorização copiada. Aproxime o caminhão do arquivo; reserva inimiga a caminho.',['blue']);}}
 },
 abandon(g){if(g.mission?.chapter===1&&g.mission.secondary==='pending'){g.mission.secondary='abandoned';g.checkVictory();return true;}return false;},
 summary(g){const m=g.mission;if(!m)return'';const goal=m.chapter===7?(g.mode==='rts'?180:6):(g.mode==='rts'?60:2),measure=g.mode==='rts'?'s':'rodadas';
  const base=Story.chapters[m.chapter].brief,progress=[2,6].includes(m.chapter)?(m.chapter===2?'Ivo: ':'Lara: ')+(this.protected(g,m.chapter===2?'ivo':'nara')?'vivo':'perdido'):m.chapter===3?'Caminhões na extração: '+['civilian1','civilian2'].filter(k=>{const u=g.get(m.ids[k]);return u&&DIST(u,m.extraction)<=2;}).length+' / 2':m.chapter===8&&m.loaded?'Documentos a bordo: conduza o caminhão à transmissão.':'Progresso: '+Math.floor(m.progress)+' / '+goal+' '+measure;
  return base+'\n'+progress+(m.chapter===1?'\nObjetivo secundário: '+({pending:'pendente',records:'registros preservados',convoy:'comboio salvo',failed:'perdido',abandoned:'abandonado'}[m.secondary]):'');
 },
 validate(m,g){
  if(!m||m.version!==2||!Number.isInteger(m.chapter)||m.chapter<1||m.chapter>8||!m.attempt||m.attempt.chapter!==m.chapter||typeof m.attempt.id!=='string'||typeof m.attempt.campaignId!=='string'||!Number.isInteger(m.attempt.region)||!Number.isInteger(m.attempt.seed))return false;
  if(m.route&&(!Number.isInteger(m.route.x)||!Number.isInteger(m.route.y)||!INSIDE(m.route.x,m.route.y)))return false;
  if(!Story.validDiscoveries(m.discoveries)||!Story.validDiscoveries(m.attempt.discoveries)||JSON.stringify(m.discoveries)!==JSON.stringify(m.attempt.discoveries)||typeof m.terminalRecon!=='boolean'||typeof m.contactReward!=='boolean')return false;
  if(!m.ids||Object.values(m.ids).some(n=>!Number.isInteger(n)||n<1||n>=g.nextId)||!m.extraction||!INSIDE(m.extraction.x,m.extraction.y)||!Number.isFinite(m.progress)||m.progress<0||m.progress>(g.mode==='rts'?180:6)||!Number.isFinite(m.lastTime)||m.lastTime>g.time||!Number.isInteger(m.lastRound)||m.lastRound>g.round)return false;
  const required={1:['station','records','convoy','engineer','truck'],2:['ivo','truck','engineer'],3:['civilian1','civilian2','engineer'],4:['power','archive','engineer'],5:['terminal','archive','engineer'],6:['nara','truck','engineer'],7:['station','aux','aa','engineer'],8:['archive','truck','engineer']}[m.chapter];
  if(required.some(k=>!Number.isInteger(m.ids[k]))||typeof m.roundEligible!=='boolean'||typeof m.roundInitialized!=='boolean'||m.lastTime<0||m.lastRound<1)return false;
  if(m.outcome!==null&&(!m.outcome||typeof m.outcome.won!=='boolean'||typeof m.outcome.records!=='boolean'||typeof m.outcome.convoy!=='boolean'||typeof m.outcome.terminalRecon!=='boolean'||typeof m.outcome.reason!=='string'||m.outcome.reason.length>300||g.winner!==(m.outcome.won?'blue':'red')))return false;
  if(g.winner&&!m.outcome)return false;
  if(!Number.isInteger(m.waves)||m.waves<0||m.waves>3||!['pending','records','convoy','failed','abandoned'].includes(m.secondary)||typeof m.loaded!=='boolean'||typeof m.copied!=='boolean'||!m.choices)return false;
  return Object.entries(m.choices).every(([k,v])=>Story.options[k]?.some(x=>x.value===v));
 },
 draw(c,g){const m=g.mission;if(!m)return;c.save();c.font='bold 12px sans-serif';c.textAlign='center';
  const mark=(p,text)=>{if(!p)return;const x=(p.x+.5)*CELL,y=(p.y+.5)*CELL;c.strokeStyle='#f8dd94';c.lineWidth=2;c.strokeRect(x-17,y-17,34,34);c.lineWidth=4;c.strokeStyle='#122018';c.strokeText(text,x,y-23);c.fillStyle='#fff0bd';c.fillText(text,x,y-23);};
  for(const id of Object.values(m.ids)){const u=g.get(id);if(u?.missionLabel)mark(u,u.missionLabel);}if(m.route)mark(m.route,'Rota alternativa');if([1,2,3,6,8].includes(m.chapter))mark(m.extraction,m.chapter===8?'Transmissão':'Extração');c.restore();}
};
