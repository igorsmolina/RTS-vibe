'use strict';
// Hospedagem pelo navegador: a sala roda num Web Worker do anfitrião e o convidado conecta por WebRTC (canal de dados).
// O ntfy.sh (sinalização) é simulado em memória; duas páginas do mesmo Chrome fazem os dois papéis.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const root=path.join(__dirname,'..','public'),TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};

async function main(){
 const server=http.createServer((req,res)=>{
  const file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/\/$/,'/index.html'));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('nao encontrado');return;}res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream'});res.end(data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const topics=new Map();let counter=0;
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-features=WebRtcHideLocalIpsWithMdns']});
 try{
  const context=await browser.newContext(),guestContext=await browser.newContext(),errors=[];
  const ntfy=route=>{
   const url=new URL(route.request().url()),topic=url.pathname.split('/')[1],list=topics.get(topic)||[];topics.set(topic,list);
   if(route.request().method()==='POST'){list.push({id:'m'+(++counter),time:Math.floor(Date.now()/1000),event:'message',topic,message:route.request().postData()});route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},body:'{}'});return;}
   const since=url.searchParams.get('since'),from=since&&since!=='all'?list.findIndex(m=>m.id===since)+1:0;
   route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/x-ndjson',body:list.slice(from).map(m=>JSON.stringify(m)).join(String.fromCharCode(10))});
  };
  for(const c of [context,guestContext])await c.route('https://ntfy.sh/**',ntfy);
  const host=await context.newPage(),guest=await guestContext.newPage();
  for(const page of [host,guest]){page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(origin+'/');}

  // 1. Criar e entrar
  await host.locator('#titleMultiplayer').click();await host.locator('#mpNickname').fill('Anfitrião');
  await host.waitForFunction(()=>!document.getElementById('mpCreate').disabled);
  assert.equal(await host.locator('#mpPcServer').isHidden(),true,'sem servidor do PC ligado o botão não aparece');
  await host.locator('#mpCreate').click();await host.waitForFunction(()=>/^[A-Z0-9]{8}$/.test(document.getElementById('mpCodeLabel').textContent),null,{timeout:20000});
  const code=await host.locator('#mpCodeLabel').textContent();
  await guest.locator('#titleMultiplayer').click();await guest.locator('#mpNickname').fill('Convidado');await guest.locator('#mpCode').fill(code);
  await guest.waitForFunction(()=>!document.getElementById('mpJoin').disabled);await guest.locator('#mpJoin').click();
  for(const page of [host,guest])await page.waitForFunction(()=>Multiplayer.room?.players.length===2&&Multiplayer.connected,null,{timeout:60000});
  assert.equal(await guest.evaluate(()=>Multiplayer.p2p.hosting),false);assert.equal(await host.evaluate(()=>Multiplayer.p2p.hosting),true);
  console.log('OK sala criada no navegador e convidado conectado por WebRTC');

  // 2. Unidades: o convidado joga com as azuis; só o anfitrião configura
  await guest.locator('#mpFaction').selectOption('blue');
  await host.waitForFunction(()=>Multiplayer.room.players.find(p=>p.side==='red')?.faction==='blue');
  assert.equal(await guest.locator('#mpMap').isDisabled(),true,'convidado não configura a sala');
  for(const page of [host,guest]){await page.locator('#mpReady').click();}
  await host.waitForFunction(()=>!document.getElementById('mpStart').disabled);await host.locator('#mpStart').click();
  for(const page of [host,guest])await page.waitForFunction(()=>started&&game.multiplayer&&game.networkClient&&game.units.length>0,null,{timeout:30000});
  assert.deepEqual(await guest.evaluate(()=>({...game.factions})),{blue:'blue',red:'blue'});
  assert.deepEqual(await host.evaluate(()=>({...game.factions})),{blue:'blue',red:'blue'});
  console.log('OK partida iniciada e facções aplicadas nos dois navegadores');

  // 3. Uma ordem do convidado chega ao anfitrião (a simulação roda no worker dele)
  const unit=await guest.evaluate(()=>{
   const u=game.units.find(v=>v.owner==='red'&&v.type==='infantry'),goal=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:u.x+dx,y:u.y+dy})).find(p=>p.x>=0&&p.y>=0&&p.x<128&&p.y<96&&!game.structureAt(p.x,p.y)&&!game.occupied(p.x,p.y,u)&&Number.isFinite(game.cost(u,p.x,p.y)));
   return {id:u.id,goal};
  });
  assert.ok(unit.goal,'a tropa do convidado tem uma casa livre ao lado');
  await guest.evaluate(({id,goal})=>{setSelection([id]);game.command([id],'move',goal);},unit);
  await guest.waitForFunction(({id,goal})=>{const u=game.get(id);return Math.abs(u.x-goal.x)<.01&&Math.abs(u.y-goal.y)<.01;},unit,{timeout:30000});
  console.log('OK ordem do convidado executada pelo anfitrião');

  // 4. Só o anfitrião vê Encerrar partida; Desistir dá derrota a quem desistiu e vitória ao outro
  for(const page of [host,guest])await page.evaluate(()=>Multiplayer.show());
  assert.equal(await host.locator('#mpEnd').isVisible(),true);assert.equal(await guest.locator('#mpEnd').isHidden(),true);
  for(const page of [host,guest])await page.evaluate(()=>closeMenu('multiplayer'));
  await guest.evaluate(()=>document.getElementById('surrender').click());
  for(const page of [host,guest])await page.waitForFunction(()=>document.getElementById('result').open,null,{timeout:20000});
  assert.equal(await guest.locator('#result').getAttribute('data-result'),'loss');assert.equal(await host.locator('#result').getAttribute('data-result'),'win');
  assert.match(await guest.locator('#resultText').textContent(),/Você desistiu/);assert.match(await host.locator('#resultText').textContent(),/O adversário desistiu/);
  console.log('OK desistir: derrota para quem desistiu e vitória para o adversário');

  // 5. Revanche: os dois voltam à sala com os lados trocados e a partida recomeça; o anfitrião encerra para todos
  for(const page of [host,guest])await page.locator('#playAgain').click();
  for(const page of [host,guest])await page.waitForFunction(()=>Multiplayer.room?.status==='waiting'&&Multiplayer.session.side==='red'||Multiplayer.room?.status==='waiting'&&Multiplayer.session.side==='blue',null,{timeout:20000});
  assert.equal(await guest.evaluate(()=>Multiplayer.session.side),'blue');
  for(const page of [host,guest]){await page.locator('#mpReady').click();}
  await host.waitForFunction(()=>!document.getElementById('mpStart').disabled);await host.locator('#mpStart').click();
  for(const page of [host,guest])await page.waitForFunction(()=>started&&game.multiplayer&&!game.winner&&game.units.length>0,null,{timeout:30000});
  await host.evaluate(()=>{Multiplayer.show();document.getElementById('mpEnd').click();});
  for(const page of [host,guest])await page.waitForFunction(()=>document.getElementById('result').open,null,{timeout:20000});
  assert.match(await guest.locator('#resultText').textContent(),/encerrada pelo anfitrião/);
  console.log('OK revanche com lados trocados e encerramento pelo anfitrião');
  assert.deepEqual(errors,[],'erros JS: '+errors.join(' | '));
 }finally{await browser.close();server.close();}
}
main().then(()=>console.log('OK hospedagem pelo navegador'),e=>{console.error(e);process.exitCode=1;});
