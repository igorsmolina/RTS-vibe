'use strict';
// Link do servidor hospedado num PC: a página (Vercel ou arquivo local) lê o link publicado no ntfy.sh e oferece o botão
// "Entrar no servidor do PC". Só vale link https://*.trycloudflare.com publicado há menos de 10 min com estado "on".
const path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
const index=pathToFileURL(path.join(__dirname,'..','public','index.html')).href,CORS={'access-control-allow-origin':'*'};
const message=(payload,ageSeconds=30)=>JSON.stringify({id:'x'+Math.random(),time:Math.floor(Date.now()/1000)-ageSeconds,event:'message',topic:'t',message:JSON.stringify(payload)})+'\n';

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 // registry: corpo NDJSON do ntfy ('' = tópico vazio) ou 'fail' para simular queda.
 const run=async(registry,{query='',after}={})=>{
  const context=await browser.newContext(),page=await context.newPage(),visited=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://ntfy.sh/**',route=>registry==='fail'?route.abort():route.fulfill({status:200,headers:CORS,contentType:'application/x-ndjson',body:registry}));
  await page.route('https://*.trycloudflare.com/**',route=>{visited.push(route.request().url());route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>servidor</title>'});});
  await page.goto(index+query);await after(page,visited);assert.deepEqual(errors,[],'erros JS: '+errors.join(' | '));await context.close();
 };
 const openDialog=async page=>{await page.locator('#titleMultiplayer').click();await page.waitForSelector('#multiplayer[open]');await page.waitForTimeout(600);};

 await run(message({state:'on',url:'https://abc-123.trycloudflare.com'}),{after:async(page,visited)=>{
  await openDialog(page); // arquivo local: nenhuma requisição ao carregar, só depois de abrir o Multiplayerassert.equal(await page.locator('#mpPcServer').isVisible(),true);
  assert.deepEqual(visited,[],'abrir o Multiplayer não sai da página: a sala no navegador continua disponível');
  await page.locator('#mpPcServer').click();await page.waitForURL('https://abc-123.trycloudflare.com/?multiplayer=1');
  assert.deepEqual(visited,['https://abc-123.trycloudflare.com/?multiplayer=1']);
 }});
 console.log('OK servidor do PC ligado: botão visível e entra no link');

 await run(message({state:'on',url:'https://abc-123.trycloudflare.com'}),{query:'?room=ABCD1234',after:async(page)=>{
  await page.waitForSelector('#multiplayer[open]');await page.waitForFunction(()=>!document.getElementById('mpPcServer').hidden);
  await page.locator('#mpPcServer').click();await page.waitForURL('https://abc-123.trycloudflare.com/?multiplayer=1&room=ABCD1234');
 }});
 console.log('OK convite com sala: o código vai junto');

 for(const [label,body] of [
  ['desligado (state off)',message({state:'off'})],
  ['sem sinal há mais de 10 min',message({state:'on',url:'https://abc-123.trycloudflare.com'},900)],
  ['link de outro domínio',message({state:'on',url:'https://evil.example.com'})],
  ['link http sem TLS',message({state:'on',url:'http://abc-123.trycloudflare.com'})],
  ['tópico vazio',''],
  ['última mensagem vence',message({state:'on',url:'https://abc-123.trycloudflare.com'},120)+message({state:'off'},10)],
  ['sem rede','fail'],
 ])await run(body,{after:async(page,visited)=>{
  await openDialog(page);
  assert.equal(await page.locator('#mpPcServer').isHidden(),true,label+': sem botão');
  assert.deepEqual(visited,[],label+': não deve entrar');
 }});
 console.log('OK desligado, velho, domínio estranho, http, vazio e sem rede: nenhum botão');

 await browser.close();
 console.log('OK link do servidor do PC');
})().catch(e=>{console.error(e);process.exitCode=1;});
