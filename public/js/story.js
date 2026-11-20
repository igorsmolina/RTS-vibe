'use strict';
/* Roteiro e progresso da campanha. Sem DOM, rede ou dependências. */
const Story={
 version:2,
 characters:{
  lia:{name:'Dra. Lia Azevedo',expressions:['neutral','concerned','resolved']},tomas:{name:'Tomas Ferraz',expressions:['neutral','concerned','resolved']},nara:{name:'Lara Costa',expressions:['neutral','concerned','resolved']},
  helena:{name:'Capitã Helena Duarte',expressions:['focused','suspicious','determined']},
  reis:{name:'Major Caio Reis',expressions:['attentive','worried','relieved']},
  ivo:{name:'Ivo Vargas',expressions:['anxious','explaining','exhausted']},
  vilar:{name:'General Afonso Vilar',expressions:['controlled','stern','pressured']}
 },
 chapters:[null,
  {title:'A versão oficial',threshold:0,kind:'attack',conquest:true,requiredChoices:['secondary'],brief:'Capture a estação intacta. Copie com um engenheiro adjacente por 60 s ativos ou duas rodadas.'},
  {title:'Ordens contraditórias',threshold:3,kind:'rescue',conquest:false,requiredChoices:['secondary'],brief:'Resgate Ivo e leve-o embarcado no caminhão até a extração.'},
  {title:'Corredor de saída',threshold:3,kind:'escort',conquest:false,requiredChoices:['secondary','ivo'],brief:'Escolte os dois caminhões civis até a extração. Ambos precisam sobreviver.'},
  {title:'O inimigo conveniente',threshold:5,kind:'attack',conquest:true,requiredChoices:['secondary','ivo'],brief:'Capture central e arquivo intacto. Copie os contratos com engenheiro por 60 s ativos ou duas rodadas.'},
  {title:'Carga declarada',threshold:5,kind:'attack',conquest:true,requiredChoices:['secondary','ivo','contracts'],brief:'Capture terminal e arquivo intacto. Copie o manifesto com engenheiro por 60 s ativos ou duas rodadas.'},
  {title:'Fora da frequência',threshold:7,kind:'rescue',conquest:false,requiredChoices:['secondary','ivo','contracts'],brief:'Resgate Lara e leve-a embarcada no caminhão até a extração. Ela precisa sobreviver.'},
  {title:'Ruptura',threshold:7,kind:'defense',conquest:false,requiredChoices:['secondary','ivo','contracts','channel'],brief:'Preserve a estação por 180 s ativos ou seis rodadas. Inimigos junto à antena pausam a transmissão. Três ondas incluem blindados e helicóptero.'},
  {title:'Quem ganha com a guerra',threshold:7,kind:'final',conquest:true,final:true,requiredChoices:['secondary','ivo','contracts','channel'],brief:'Capture o comando intacto, copie a autorização por 60 s ativos ou duas rodadas e leve os documentos de caminhão à transmissão.'}
 ],
 options:{
  secondary:[{value:'convoy',label:'Socorrer o comboio',effect:'Se a escolta chegar à saída, um reconhecimento adicional será reservado para a missão 2.'},{value:'records',label:'Recuperar os registros',effect:'Capturar o depósito preserva uma prova da autorização antecipada.'}],
  ivo:[{value:'protect',label:'Proteger Ivo',effect:'Preserva o depoimento; missão 4 começa com 50 créditos a menos.'},{value:'hand',label:'Entregar Ivo ao comando',effect:'Missão 4 recebe 100 créditos extras. Ivo sai da história e seu depoimento não será obtido.'}],
  contracts:[{value:'publish',label:'Divulgar os contratos',effect:'Missão 7 começa com 50 créditos a menos; a rede civil já estará preparada.'},{value:'secret',label:'Manter a investigação em sigilo',effect:'Mantém os recursos. Usar a rede civil exigirá capturar a antena auxiliar na missão 7.'}],
  channel:[{value:'civil',label:'Usar a rede civil',effect:'Uma cópia independente pode expor a conspiração. Em sigilo, capture também a antena auxiliar.'},{value:'military',label:'Aceitar o canal militar',effect:'Recebe 150 créditos extras na defesa. A transmissão permanece sob controle do comando.'}]
 },
 documents:{military:'Confirmação militar: o comando recebeu a transmissão sem identificar os destinatários. Não confirma cópia independente.',stationCopy:'Cópia da estação: a ordem de desligamento precede o ataque, mas falta o registro original para confirmar a autorização.',manifest:'Manifesto do terminal: cargas e rotas ligam o abastecimento às empresas do corredor.',records:'Autorização antecipada: a estação recebeu ordem de desligamento antes do ataque, com uma credencial do nosso comando.',testimony:'Depoimento de Ivo: os transmissores foram configurados para um suposto exercício chamado Cinzas. A equipe não recebeu aviso de que haveria soldados no posto.',contracts:'Contratos do corredor: empresas ligadas a Vilar e a oficiais de Belóvia dividiram a administração das rotas antes do ataque de fronteira.',civil:'Recibo da rede civil: os documentos chegaram a destinatários fora das cadeias militares.',authorization:'Autorização conjunta: o arquivo de Belóvia contém as assinaturas dos responsáveis pelo incidente e os acordos para ocupar o corredor comercial.'},
 create(seed){return{version:2,id:'cinzas-'+seed+'-'+Date.now().toString(36),seen:[],completed:[],choices:{},evidence:[],discoveries:[],rewards:{recon:false,terminalRecon:false},active:null,attempt:0,applied:[],scene:null,journal:[],ending:null};},
 reachable(world,blocked){const seen=new Set([world.homes.blue]),q=[world.homes.blue];for(const id of q)for(const n of world.regions[id].neighbors)if(n!==blocked&&!seen.has(n)){seen.add(n);q.push(n);}return seen;},
 prepareWorld(world){
  const distance=new Map([[world.homes.blue,0]]),q=[world.homes.blue];for(const id of q)for(const n of world.regions[id].neighbors)if(!distance.has(n)){distance.set(n,distance.get(id)+1);q.push(n);}
  const candidates=world.regions.filter(r=>r.id!==world.homes.blue&&this.reachable(world,r.id).size===world.regions.length-1).sort((a,b)=>distance.get(b.id)-distance.get(a.id)||b.x-a.x||a.id-b.id);
  if(candidates.length)world.homes.red=candidates[0].id;
 },
 next(c){if(!c.story||campaignOver(c))return null;const n=c.story.completed.length+1;return n<this.chapters.length&&c.story.seen.length>=this.chapters[n].threshold?n:null;},
 marker(c){
  const s=c.story,n=this.next(c);if(!s||!n)return null;if(s.active)return{chapter:s.active.chapter,region:s.active.region};
  const valid=id=>this.chapters[n].final?id===c.world.homes.red&&c.world.regions[id].neighbors.some(x=>c.owners[x]==='blue'):this.chapters[n].conquest?canAttack(c,id):c.owners[id]==='blue';
  if(s.marker?.chapter===n&&valid(s.marker.region))return s.marker;
  const ids=c.world.regions.filter(r=>valid(r.id)).map(r=>r.id).sort((a,b)=>Number(a===c.world.homes.blue)-Number(b===c.world.homes.blue)||a-b);
  s.marker=ids.length?{chapter:n,region:ids[0]}:null;return s.marker;
 },
 choose(c,key,value){const s=c.story;if(!s||!this.options[key]?.some(x=>x.value===value)||s.choices[key])return false;s.choices[key]=value;
  if(key==='ivo'&&value==='protect')this.proof(c,'testimony');
  s.journal.push({type:'choice',key,value});return true;},
 get proofs(){return StoryScenes.proofs;},
 validDiscoveries(values){return Array.isArray(values)&&new Set(values).size===values.length&&values.every(value=>{if(typeof value!=='string')return false;const [doc,detail,...rest]=value.split(':');return !rest.length&&this.proofs[doc]?.details?.some(x=>x.id===detail);});},
 inspect(c,documentId,detailId){const key=documentId+':'+detailId;if(!c.story||!c.story.evidence.includes(documentId)||!this.validDiscoveries([key])||c.story.discoveries.includes(key))return false;c.story.discoveries.push(key);return true;},
 proof(c,id){if(!c.story.evidence.includes(id))c.story.evidence.push(id);},
 budget(c,n){let credits=150;if(n===4)credits+=c.story.choices.ivo==='protect'?-50:c.story.choices.ivo==='hand'?100:0;
  if(n===7){if(c.story.choices.contracts==='publish')credits-=50;if(c.story.choices.channel==='military')credits+=150;}return credits;},
 begin(c,chapter,region){const marker=this.marker(c);if(!marker||marker.chapter!==chapter||marker.region!==region||c.story.active)return null;
  if(this.chapters[chapter].requiredChoices.some(key=>!c.story.choices[key]))return null;
  const attempt=++c.story.attempt,a={id:c.story.id+':'+attempt,campaignId:c.story.id,chapter,region,discoveries:[...c.story.discoveries],seed:((c.seed^Math.imul(chapter,2654435761)^Math.imul(attempt,40503))>>>0)||1};c.story.active=a;c.current=region;return a;},
 resolve(c,a,outcome){const s=c.story;if(!s||!a||a.campaignId!==s.id||s.applied.includes(a.id)||s.active?.id!==a.id)return false;
  const won=outcome.won;s.applied.push(a.id);if(s.applied.length>200)s.applied.shift();
  if(!won||this.chapters[a.chapter].conquest)applyResult(c,a.region,won);else{c.battles++;c.current=null;c.events=['Operação concluída: '+this.chapters[a.chapter].title+'.'];}
  if(won){s.completed.push(a.chapter);if(a.chapter===1){this.proof(c,'stationCopy');if(outcome.records)this.proof(c,'records');if(outcome.convoy)s.rewards.recon=true;}if(a.chapter===4)this.proof(c,'contracts');if(a.chapter===5){this.proof(c,'manifest');if(outcome.terminalRecon)s.rewards.terminalRecon=true;}if(a.chapter===7)this.proof(c,s.choices.channel==='civil'?'civil':'military');if(a.chapter===8)this.proof(c,'authorization');}
  s.active=null;s.marker=null;s.journal.push({type:'result',chapter:a.chapter,region:a.region,won});if(s.journal.length>200)s.journal.shift();
  if(campaignOver(c))s.ending=this.ending(c,campaignOver(c)==='blue');return true;
 },
 ending(c,won){const e=c.story.evidence;return !won?'defeat':e.includes('contracts')&&e.includes('authorization')&&e.includes('civil')&&(e.includes('records')||e.includes('testimony'))?'exposed':'covered';},
 pending(c){const s=c.story;if(!s)return null;if(s.completed.includes(2)&&!s.choices.ivo)return'ivo';if(s.completed.includes(4)&&!s.choices.contracts)return'contracts';return null;},
 validate(s,c){
  if(!s||s.version!==2||typeof s.id!=='string'||s.id.length>100||!Number.isInteger(s.attempt)||s.attempt<0||!s.choices||typeof s.choices!=='object'||Array.isArray(s.choices))return false;
  if(Object.entries(s.choices).some(([k,v])=>!this.options[k]?.some(x=>x.value===v)))return false;
  if(!Array.isArray(s.seen)||new Set(s.seen).size!==s.seen.length||s.seen.some(n=>!Number.isInteger(n)||!c.world.regions[n]||n===c.world.homes.blue))return false;
  if(!Array.isArray(s.completed)||s.completed.length>8||s.completed.some((n,i)=>n!==i+1))return false;
  if(!Array.isArray(s.evidence)||new Set(s.evidence).size!==s.evidence.length||s.evidence.some(x=>!Object.hasOwn(this.documents,x)))return false;
  if(!this.validDiscoveries(s.discoveries)||s.discoveries.some(id=>!s.evidence.includes(id.split(':')[0]))||s.active&&(!this.validDiscoveries(s.active.discoveries)||s.active.discoveries.some(id=>!s.discoveries.includes(id))))return false;
  if(!s.rewards||typeof s.rewards.recon!=='boolean'||typeof s.rewards.terminalRecon!=='boolean'||!Array.isArray(s.applied)||s.applied.length>200||s.applied.some(x=>typeof x!=='string'||x.length>140)||!Array.isArray(s.journal)||s.journal.length>200)return false;
  if(s.journal.some(x=>!x||typeof x!=='object'||(x.type==='choice'?!this.options[x.key]?.some(o=>o.value===x.value):x.type==='scene'?!this.sceneExists(x.id):x.type==='result'?!this.chapters[x.chapter]||!c.world.regions[x.region]||typeof x.won!=='boolean':true)))return false;
  if(s.ending!==null&&!['exposed','covered','defeat'].includes(s.ending))return false;
  if(s.active&&(!Number.isInteger(s.active.chapter)||s.active.chapter!==s.completed.length+1||!c.world.regions[s.active.region]||s.active.campaignId!==s.id||typeof s.active.id!=='string'||!Number.isInteger(s.active.seed)))return false;
  if(s.marker&&(!this.chapters[s.marker.chapter]||!c.world.regions[s.marker.region]))return false;
  if(s.scene&&s.scene.revision!==undefined&&![2,3,4].includes(s.scene.revision))return false;
  if(s.scene&&(typeof s.scene.id!=='string'||!this.sceneExists(s.scene.id)||!Number.isInteger(s.scene.index)||s.scene.index<0||s.scene.index>=this.scene({...c,story:s},s.scene.id).lines.length||s.scene.action!==undefined&&s.scene.action!==null&&!['prepareMission','launch','ending'].includes(s.scene.action)))return false;
  return true;
 },
 sceneRevision(id){return 4;},
 sceneExists(id){return /^(before|after)[1-8]$/.test(id)||['opening','defeat','exposed','covered','choice-secondary','choice-channel','retreat'].includes(id);},
 scene(c,id){return StoryScenes.scene(c,id);}
};
