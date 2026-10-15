'use strict';
// Hospeda o multiplayer neste PC: sobe o servidor, abre um túnel público (Cloudflare) e desliga sozinho no horário de corte.
// Antes do corte do dia liga sem perguntar; depois dele só liga se você autorizar (S) e vale até o próximo corte.
const {spawn,execFileSync}=require('node:child_process'),readline=require('node:readline'),fs=require('node:fs'),path=require('node:path');
// Tópico onde o link atual é publicado para a página (Vercel) ler: o mesmo valor de RTS_SERVER_REGISTRY em public/js/multiplayer.js.
const REGISTRY=(/RTS_SERVER_REGISTRY='([^']+)'/.exec(fs.readFileSync(path.join(__dirname,'..','public','js','multiplayer.js'),'utf8'))||[])[1];
const CUTOFF=process.env.HOST_CUTOFF||'13:00',PORT=Number(process.env.PORT)||5180;

function parse(hhmm){const m=/^(\d{1,2}):(\d{2})$/.exec(hhmm);if(!m||Number(m[1])>23||Number(m[2])>59)throw new Error('Horário inválido: '+hhmm+' (use HH:MM).');return [Number(m[1]),Number(m[2])];}
const todayAt=(now,hhmm)=>{const [h,m]=parse(hhmm),t=new Date(now);t.setHours(h,m,0,0);return t;};
// Próximo corte depois de `now`: hoje, se ainda não passou; senão amanhã.
function nextCutoff(now,hhmm=CUTOFF){const t=todayAt(now,hhmm);if(t<=now)t.setDate(t.getDate()+1);return t;}
// Do corte até a meia-noite, ligar exige autorização.
function needsPermission(now,hhmm=CUTOFF){return now>=todayAt(now,hhmm);}
// Publica o link (ou "desligado"); sem rede só avisa, o link do console continua valendo.
async function publish(state,url){
 if(!REGISTRY)return;
 try{await fetch(REGISTRY,{method:'POST',body:JSON.stringify({state,url,at:Date.now()}),signal:AbortSignal.timeout(5000)});}
 catch(e){console.error('Não consegui publicar o link para a página ('+e.message+'). Mande o link acima aos amigos.');}
}
const clock=d=>d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});

function ask(question){
 return new Promise(resolve=>{const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  rl.once('close',()=>resolve(false));rl.question(question,answer=>{resolve(/^\s*s(im)?\s*$/i.test(answer));rl.close();});});
}

async function main(){
 const withTunnel=!process.argv.includes('--sem-tunel'),start=new Date();
 if(needsPermission(start)){
  const ok=await ask(`Agora são ${clock(start)}, depois do horário de encerramento (${CUTOFF}).\nAutorizar ligar o servidor até ${clock(nextCutoff(start))} de amanhã? (S/N) `);
  if(!ok){console.log('Servidor não ligado.');return;}
 }
 const cutoff=nextCutoff(start),{createMultiplayerServer}=require('./multiplayer-server.cjs'),service=createMultiplayerServer();
 try{await new Promise((resolve,reject)=>{service.server.once('error',reject);service.server.listen(PORT,'127.0.0.1',resolve);});}
 catch(e){console.error(e.code==='EADDRINUSE'?`A porta ${PORT} já está em uso: feche o outro servidor e tente de novo.`:'Não foi possível ligar o servidor: '+e.message);await service.close();process.exitCode=1;return;}
 const local=`http://localhost:${PORT}/?multiplayer=1`;
 console.log(`Servidor no ar.\nEncerra sozinho às ${clock(cutoff)} (${cutoff.toLocaleDateString('pt-BR')}). Para parar antes: feche esta janela ou Ctrl+C.\n`);
 let tunnel=null,stopping=false,beat=null;
 const stop=async reason=>{if(stopping)return;stopping=true;console.log('\n'+reason);clearInterval(beat);try{tunnel?.kill();}catch{}await publish('off');await service.close();process.exit(0);};
 process.on('SIGINT',()=>stop('Servidor encerrado.'));process.on('SIGTERM',()=>stop('Servidor encerrado.'));

 if(withTunnel){
  let announced=false;
  tunnel=spawn('cloudflared',['tunnel','--no-autoupdate','--url','http://127.0.0.1:'+PORT],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  const scan=chunk=>{const m=!announced&&/https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(chunk));if(!m)return;announced=true;
   const link=m[0]+'/?multiplayer=1';try{execFileSync('clip',{input:link});}catch{}
   publish('on',m[0]);beat=setInterval(()=>publish('on',m[0]),4*60000);
   console.log(`Link para o seu amigo (já copiado, é só colar no WhatsApp):\n\n   ${link}\n`);};
  tunnel.stdout.on('data',scan);tunnel.stderr.on('data',scan);
  tunnel.on('error',e=>{console.error(e.code==='ENOENT'?'cloudflared não encontrado. Instale com: winget install Cloudflare.cloudflared (e abra o arquivo de novo).':'Falha no túnel: '+e.message);stop('Servidor encerrado.');});
  tunnel.on('exit',code=>{if(!stopping)console.error('O túnel caiu (código '+code+'). Feche e abra de novo para gerar um novo link.');});
 }
 if(process.stdout.isTTY)try{spawn('cmd',['/c','start','',local],{detached:true,stdio:'ignore',windowsHide:true}).unref();}catch{}

 // Avisa as partidas em andamento 10, 5 e 1 minuto antes do corte e desliga na hora.
 const warned=new Set();
 setInterval(()=>{
  const left=cutoff-Date.now();
  if(left<=0){stop(`Horário de encerramento (${CUTOFF}) atingido: servidor desligado.`);return;}
  for(const minutes of [10,5,1])if(left<=minutes*60000&&!warned.has(minutes)){warned.add(minutes);
   for(const room of service.rooms.values())if(room.status==='playing')room.game?.log(`Aviso: o servidor encerra às ${clock(cutoff)} (em ${minutes} min).`,['blue','red']);}
 },5000);
}

module.exports={nextCutoff,needsPermission,parse};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
