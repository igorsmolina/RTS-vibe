'use strict';
/* Roteiro e progresso da campanha. Sem DOM, rede ou dependências. */
const Story={
 version:1,
 characters:{
  helena:{name:'Capitã Helena Duarte',expressions:['focused','suspicious','determined']},
  reis:{name:'Major Caio Reis',expressions:['attentive','worried','relieved']},
  ivo:{name:'Ivo Varga',expressions:['anxious','explaining','exhausted']},
  vilar:{name:'General Afonso Vilar',expressions:['controlled','stern','pressured']}
 },
 chapters:[null,
  {title:'A versão oficial',threshold:1,kind:'attack',brief:'Capture a estação com infantaria. Mantenha um engenheiro junto ao terminal por 60 s ativos ou duas rodadas completas. A estação precisa sobreviver.'},
  {title:'Ordens contraditórias',threshold:3,kind:'rescue',brief:'Encontre Ivo, embarque-o no caminhão e conduza-o à extração. A rota curta tem antitanques; a rota longa permite flanquear. Ivo precisa sobreviver.'},
  {title:'O inimigo conveniente',threshold:5,kind:'attack',brief:'Capture a central e o arquivo. Copie os contratos por 60 s ou duas rodadas com um engenheiro adjacente e os dois pontos aliados. Preserve o arquivo.'},
  {title:'Ruptura',threshold:7,kind:'defense',brief:'Defenda a estação durante 180 s ativos ou seis rodadas. Ondas em 0/60/120 s ou rodadas 1/3/5. Haverá blindados e helicóptero. Inimigos junto à antena pausam a transmissão.'},
  {title:'Quem ganha com a guerra',threshold:7,kind:'final',brief:'Capture o centro de comando intacto, copie a autorização por 60 s ou duas rodadas e leve o caminhão dos documentos à transmissão. A cópia aciona a reserva inimiga.'}
 ],
 options:{
  secondary:[{value:'convoy',label:'Socorrer o comboio',effect:'Se a escolta chegar à saída, um reconhecimento adicional será reservado para a missão 2.'},{value:'records',label:'Recuperar os registros',effect:'Capturar o depósito preserva uma prova da autorização antecipada.'}],
  ivo:[{value:'protect',label:'Proteger Ivo',effect:'Preserva o depoimento; missão 3 começa com 50 créditos a menos.'},{value:'hand',label:'Entregar Ivo ao comando',effect:'Missão 3 recebe 100 créditos extras. Ivo sai da história e seu depoimento não será obtido.'}],
  contracts:[{value:'publish',label:'Divulgar os contratos',effect:'Missão 4 começa com 50 créditos a menos; a rede civil já estará preparada.'},{value:'secret',label:'Manter a investigação em sigilo',effect:'Mantém os recursos. Usar a rede civil exigirá capturar a antena auxiliar na missão 4.'}],
  channel:[{value:'civil',label:'Usar a rede civil',effect:'Uma cópia independente pode expor a conspiração. Em sigilo, capture também a antena auxiliar.'},{value:'military',label:'Aceitar o canal militar',effect:'Recebe 150 créditos extras na defesa. A transmissão permanece sob controle do comando.'}]
 },
 documents:{records:'Autorização antecipada: a estação recebeu ordem de desligamento antes do ataque, com uma credencial do nosso comando.',testimony:'Depoimento de Ivo: os transmissores foram configurados para um suposto exercício chamado Cinzas. A equipe não recebeu aviso de que haveria soldados no posto.',contracts:'Contratos do corredor: empresas ligadas a Vilar e a oficiais de Orsen dividiram a administração das rotas antes do ataque de fronteira.',civil:'Recibo da rede civil: os documentos chegaram a destinatários fora das cadeias militares.',authorization:'Autorização conjunta: o arquivo de Orsen contém as assinaturas dos responsáveis pelo incidente e os acordos para ocupar o corredor comercial.'},
 create(seed){return{version:1,id:'cinzas-'+seed+'-'+Date.now().toString(36),seen:[],completed:[],choices:{},evidence:[],rewards:{recon:false},active:null,attempt:0,applied:[],scene:null,journal:[],ending:null};},
 reachable(world,blocked){const seen=new Set([world.homes.blue]),q=[world.homes.blue];for(const id of q)for(const n of world.regions[id].neighbors)if(n!==blocked&&!seen.has(n)){seen.add(n);q.push(n);}return seen;},
 prepareWorld(world){
  const distance=new Map([[world.homes.blue,0]]),q=[world.homes.blue];for(const id of q)for(const n of world.regions[id].neighbors)if(!distance.has(n)){distance.set(n,distance.get(id)+1);q.push(n);}
  const candidates=world.regions.filter(r=>r.id!==world.homes.blue&&this.reachable(world,r.id).size===world.regions.length-1).sort((a,b)=>distance.get(b.id)-distance.get(a.id)||b.x-a.x||a.id-b.id);
  if(candidates.length)world.homes.red=candidates[0].id;
 },
 next(c){if(!c.story||campaignOver(c))return null;const n=c.story.completed.length+1;return n<=5&&c.story.seen.length>=this.chapters[n].threshold?n:null;},
 marker(c){
  const s=c.story,n=this.next(c);if(!s||!n)return null;if(s.active)return{chapter:s.active.chapter,region:s.active.region};
  const valid=id=>n===5?id===c.world.homes.red&&c.world.regions[id].neighbors.some(x=>c.owners[x]==='blue'):[1,3].includes(n)?canAttack(c,id):c.owners[id]==='blue';
  if(s.marker?.chapter===n&&valid(s.marker.region))return s.marker;
  const ids=c.world.regions.filter(r=>valid(r.id)).map(r=>r.id).sort((a,b)=>Number(a===c.world.homes.blue)-Number(b===c.world.homes.blue)||a-b);
  s.marker=ids.length?{chapter:n,region:ids[0]}:null;return s.marker;
 },
 choose(c,key,value){const s=c.story;if(!s||!this.options[key]?.some(x=>x.value===value)||s.choices[key])return false;s.choices[key]=value;
  if(key==='ivo'&&value==='protect')this.proof(c,'testimony');
  s.journal.push({type:'choice',key,value});return true;},
 proof(c,id){if(!c.story.evidence.includes(id))c.story.evidence.push(id);},
 budget(c,n){let credits=150;if(n===3)credits+=c.story.choices.ivo==='protect'?-50:c.story.choices.ivo==='hand'?100:0;
  if(n===4){if(c.story.choices.contracts==='publish')credits-=50;if(c.story.choices.channel==='military')credits+=150;}return credits;},
 begin(c,chapter,region){const marker=this.marker(c);if(!marker||marker.chapter!==chapter||marker.region!==region||c.story.active)return null;
  if(chapter===1&&!c.story.choices.secondary||chapter===4&&!c.story.choices.channel)return null;
  const attempt=++c.story.attempt,a={id:c.story.id+':'+attempt,campaignId:c.story.id,chapter,region,seed:((c.seed^Math.imul(chapter,2654435761)^Math.imul(attempt,40503))>>>0)||1};c.story.active=a;c.current=region;return a;},
 resolve(c,a,outcome){const s=c.story;if(!s||!a||a.campaignId!==s.id||s.applied.includes(a.id)||s.active?.id!==a.id)return false;
  const won=outcome.won;s.applied.push(a.id);if(s.applied.length>200)s.applied.shift();
  if(!won||[1,3,5].includes(a.chapter))applyResult(c,a.region,won);else{c.battles++;c.current=null;c.events=['Operação concluída: '+this.chapters[a.chapter].title+'.'];}
  if(won){s.completed.push(a.chapter);if(a.chapter===1){if(outcome.records)this.proof(c,'records');if(outcome.convoy)s.rewards.recon=true;}if(a.chapter===3)this.proof(c,'contracts');if(a.chapter===4&&s.choices.channel==='civil')this.proof(c,'civil');if(a.chapter===5)this.proof(c,'authorization');}
  s.active=null;s.marker=null;s.journal.push({type:'result',chapter:a.chapter,region:a.region,won});if(s.journal.length>200)s.journal.shift();
  if(campaignOver(c))s.ending=this.ending(c,campaignOver(c)==='blue');return true;
 },
 ending(c,won){const e=c.story.evidence;return !won?'defeat':e.includes('contracts')&&e.includes('authorization')&&e.includes('civil')&&(e.includes('records')||e.includes('testimony'))?'exposed':'covered';},
 pending(c){const s=c.story;if(!s)return null;if(s.completed.includes(2)&&!s.choices.ivo)return'ivo';if(s.completed.includes(3)&&!s.choices.contracts)return'contracts';return null;},
 validate(s,c){
  if(!s||s.version!==1||typeof s.id!=='string'||s.id.length>100||!Number.isInteger(s.attempt)||s.attempt<0||!s.choices||typeof s.choices!=='object'||Array.isArray(s.choices))return false;
  if(Object.entries(s.choices).some(([k,v])=>!this.options[k]?.some(x=>x.value===v)))return false;
  if(!Array.isArray(s.seen)||new Set(s.seen).size!==s.seen.length||s.seen.some(n=>!Number.isInteger(n)||!c.world.regions[n]||n===c.world.homes.blue))return false;
  if(!Array.isArray(s.completed)||s.completed.length>5||s.completed.some((n,i)=>n!==i+1))return false;
  if(!Array.isArray(s.evidence)||new Set(s.evidence).size!==s.evidence.length||s.evidence.some(x=>!Object.hasOwn(this.documents,x)))return false;
  if(!s.rewards||typeof s.rewards.recon!=='boolean'||!Array.isArray(s.applied)||s.applied.length>200||s.applied.some(x=>typeof x!=='string'||x.length>140)||!Array.isArray(s.journal)||s.journal.length>200)return false;
  if(s.journal.some(x=>!x||typeof x!=='object'||(x.type==='choice'?!this.options[x.key]?.some(o=>o.value===x.value):x.type==='scene'?!this.sceneExists(x.id):x.type==='result'?!this.chapters[x.chapter]||!c.world.regions[x.region]||typeof x.won!=='boolean':true)))return false;
  if(s.ending!==null&&!['exposed','covered','defeat'].includes(s.ending))return false;
  if(s.active&&(!Number.isInteger(s.active.chapter)||s.active.chapter!==s.completed.length+1||!c.world.regions[s.active.region]||s.active.campaignId!==s.id||typeof s.active.id!=='string'||!Number.isInteger(s.active.seed)))return false;
  if(s.marker&&(!this.chapters[s.marker.chapter]||!c.world.regions[s.marker.region]))return false;
  if(s.scene&&(typeof s.scene.id!=='string'||!this.sceneExists(s.scene.id)||!Number.isInteger(s.scene.index)||s.scene.index<0||s.scene.index>=this.scene({...c,story:s},s.scene.id).lines.length||s.scene.action!==undefined&&s.scene.action!==null&&!['prepareMission','launch','ending'].includes(s.scene.action)))return false;
  return true;
 },
 sceneExists(id){return ['opening','before1','before2','before3','before4','before5','after1','after2','after3','after4','after5','defeat','exposed','covered','choice-secondary','choice-channel','retreat'].includes(id);},
 scene(c,id){
  const s=c.story,region=c.world.regions[s.active?.region??s.marker?.region]?.name||'a região',nation=typeof settings!=='undefined'?settings.nation.name:'sua nação';
  const L=(speaker,text,expression)=>({speaker,text,expression});let choice=null,title='Operação Véu de Cinzas',lines=[];
  switch(id){
   case'opening':lines=[L('radio','Posto Seis, confirme sua situação.'),L('soldier','Perdemos a estrada. Tem gente nossa passando pelo bloqueio, mas ninguém responde aos códigos.'),L('radio','Identifique os veículos.'),L('soldier','São os mesmos que chegaram ontem com o comboio de manutenção.'),L('narrator','A transmissão cai. Horas depois, o governo de '+nation+' atribui o ataque ao Diretório de Orsen. Você assume o comando das forças mobilizadas.'),L('vilar','Precisamos abrir a estrada antes que eles tragam artilharia. Retome as comunicações e estabeleça uma posição.'),L('helena','Ainda não recebemos as imagens do ataque.','suspicious'),L('vilar','Você receberá quando forem liberadas. A operação começa agora.','stern')];break;
   case'before1':title=this.chapters[1].title;lines=[L('helena','O posto ficou sem rádio às quatro e dezessete. A ordem para desligar a estação foi registrada às três e cinquenta.'),L('reis','Pode ter sido manutenção.'),L('helena','Pode. Quero ver quem assinou.','suspicious'),L('narrator','A estação em '+region+' guardou uma cópia da transmissão. Capture-a intacta e mantenha um engenheiro junto ao terminal.')];break;
   case'choice-secondary':choice='secondary';lines=[L('reis','Um comboio nosso está preso na outra estrada. O depósito está apagando seus registros. Precisamos decidir onde concentrar a escolta.','worried')];break;
   case'after1':lines=[L('helena','A estação foi desligada antes do ataque. Usaram uma credencial do nosso comando.','suspicious'),L('reis','Roubada?'),L('helena',s.evidence.includes('records')?'Ainda não sei. Vou guardar o original antes de perguntar.':'Perdemos os registros originais do depósito. Temos a cópia da estação, mas ainda falta confirmar a autorização.')];if(s.rewards.recon)lines.push(L('reis','O comboio chegou. Um reconhecimento vai acompanhar a próxima extração.','relieved'));break;
   case'before2':title=this.chapters[2].title;lines=[L('ivo','Disseram que o posto estava vazio. Que vocês tinham sido avisados.','anxious'),L('helena','Quem disse isso?'),L('ivo','Eu entrego os nomes quando sair daqui.','explaining'),L('reis','A estrada curta tem antitanques. A outra passa por fora da posição. O caminhão vai seguir suas ordens.')];break;
   case'after2':choice='ivo';lines=[L('vilar','Uma equipe vai buscar o prisioneiro. Vocês já cumpriram sua parte.'),L('ivo','Pergunte a eles qual era o nome do exercício. Se responderem Cinzas, não me entregue.','anxious')];break;
   case'before3':title=this.chapters[3].title;lines=[L('reis','Esse depósito recebeu combustível enquanto nossas unidades estavam racionando.'),L('helena','E Orsen também escoltou os caminhões.','suspicious'),L('reis','Então vamos descobrir de quem é a carga.'),L('narrator','Capture a central de energia e o arquivo. O engenheiro precisa dos dois pontos aliados para copiar os contratos. Não destrua o arquivo.')];if(s.choices.ivo==='protect')lines.splice(2,0,L('ivo','Os caminhões levavam a mesma identificação dos contratos. Eu configurei os rádios das escoltas.','explaining'));else if(s.choices.ivo==='hand')lines.splice(2,0,L('helena','Tentei localizar Ivo. O número da transferência existe, mas o destino foi removido.'));break;
   case'after3':choice='contracts';lines=[L('helena','Os contratos dividem o corredor entre empresas de Vilar e oficiais de Orsen. Assinaram antes do ataque.','determined'),L('reis','Se publicar, o general vai saber que fomos nós.','worried'),L('helena','Ele já sabe quais arquivos estavam aqui. A diferença é quem mais vai ficar sabendo.')];break;
   case'before4':title=this.chapters[4].title;lines=[L('vilar','Retorne à base e entregue os arquivos. É uma ordem.','stern'),L('reis','Cancelaram nossa cobertura. A justificativa é falta de combustível.','worried'),L('helena','O depósito que encontramos continua abastecido.'),L('reis','Eu sei. Estou distribuindo a munição.'),L('narrator','Três ondas se aproximam. A última inclui um helicóptero. Preserve a estação e mantenha o perímetro livre para transmitir.')];break;
   case'choice-channel':choice='channel';lines=[L('helena','A rede civil mantém uma cópia fora dos dois comandos. O canal de Vilar oferece recursos, mas ele controla o destinatário.','determined')];break;
   case'after4':lines=s.choices.channel==='civil'?[L('radio','Recebemos os contratos e os registros. Faltam as assinaturas da autorização inicial.'),L('helena','Estão no comando regional de Orsen.'),L('radio','Então tragam o original. Já temos gente conferindo o restante.')]:[L('radio','Transmissão recebida pelo comando.'),L('vilar','Abriremos uma investigação. Mantenha sua posição.'),L('helena','Só enviaram uma confirmação automática. Não temos uma cópia independente.','suspicious')];break;
   case'before5':title=this.chapters[5].title;lines=[L('vilar','A artilharia resolve isso. Não exponha suas tropas por um prédio.','pressured'),L('helena','Ele pediu para destruir o arquivo três vezes. Não perguntou pela guarnição.','determined'),L('reis','Podemos abrir uma passagem. Vai custar mais do que bombardear.'),L('narrator','Capture o comando intacto. Depois da cópia, uma reserva tentará interceptar o caminhão dos documentos. Proteja a retirada.')];break;
   case'after5':lines=[L('helena','As autorizações estão aqui. Vilar e os parceiros em Orsen prepararam o incidente para dividir o corredor comercial.'),L('reis','O arquivo foi transmitido. A guarnição se rendeu.','relieved')];break;
   case'exposed':title='Conspiração exposta';lines=[L('narrator','Os contratos, a autorização e a confirmação independente são verificados fora da cadeia militar. Vilar é afastado. Seus parceiros em Orsen perdem apoio. Começam negociações para retirar as tropas do corredor.'),L('reis','Recebi ordem de recolher as peças de artilharia.','relieved'),L('helena','De quem?'),L('reis','Do comando provisório. Conferi duas vezes.'),L('narrator','O último relatório registra as perdas da campanha. A responsabilização dos envolvidos continua em andamento.')];break;
   case'covered':title='Vitória com a verdade encoberta';lines=[L('narrator','O QG inimigo caiu. Vilar anuncia a vitória. Sem confirmação suficiente ou uma cópia independente, os documentos são classificados. Os contratos do corredor recebem novos nomes.'),L('helena','Meu relatório voltou. Retiraram seis páginas.','suspicious'),L('reis','Você ficou com uma cópia?'),L('helena','Fiquei.')];if(s.choices.ivo==='protect')lines.push(L('ivo','Meu depoimento também fica. Se alguém vier perguntar, eu conto de novo.','exhausted'));break;
   case'defeat':title='Retirada';lines=[L('narrator','A capital caiu. As unidades sobreviventes se reúnem para a retirada.'),L('reis','Último transporte pronto. Precisamos sair.','worried'),L('helena','A estação confirmou o recebimento?'),L('reis',s.evidence.includes('civil')?'Confirmou. Agora embarca.':'Não conseguimos uma transmissão independente. Trouxe os arquivos que ainda estavam conosco.')];if(s.choices.ivo==='protect')lines.push(L('ivo','Estou no transporte. Ainda posso prestar o depoimento.','exhausted'));break;
   case'retreat':title='Operação perdida';lines=[L('reis','A posição ficou insustentável. Estamos reorganizando a unidade para uma nova tentativa.','worried'),L('helena','As provas já preservadas continuam no diário. Vamos revisar a rota.')];break;
  }
  return{title,lines,choice};
 }
};
