// Jogo real no Google Chrome, com rede desligada: controles, câmera, gerador, tanques e terreno. node tests/browser.test.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.join(__dirname,'..'),types=['lightTank','tank','heavyTank'];
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 // --- controles e modos
 {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});await page.context().setOffline(true);
 await page.goto(pathToFileURL(path.join(__dirname,'..','public','index.html')).href);assert.equal(await page.title(),'rtsvibe — Fronteiras');assert.equal(await page.locator('#titleScreen').evaluate(e=>e.open),true,'Abre no menu inicial');await page.locator('#titlePlay').click();assert.equal(await page.locator('#setup').evaluate(e=>e.open),true);
 assert.equal(await page.locator('#modeSelect option[value="rts"]').count(),1,'A configuração deve oferecer RTS com pausa tática');
 assert.equal(await page.evaluate(()=>typeof troopAtlas!=='undefined'),true,'A arte das tropas deve ser carregada');
 await page.waitForFunction(()=>troopAtlas.complete&&troopAtlas.naturalWidth>0&&tankAtlas.complete&&tankAtlas.naturalWidth>0);
 const troopArt=await page.evaluate(()=>['blue','red'].flatMap(owner=>['commander','infantry','engineer','recon','lightTank','tank','heavyTank','artillery','antitank','machinegun'].map(type=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const c=canvas.getContext('2d');unitIcon(c,type,48,48,TEAM[owner]);const pixels=c.getImageData(0,0,96,96).data;let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0)visible++;return{type,owner,visible,corner:pixels[3],image:canvas.toDataURL()};})));
 assert.equal(new Set(troopArt.map(a=>a.image)).size,20);for(const art of troopArt){assert.ok(art.visible>400,art.type+'/'+art.owner);assert.equal(art.corner,0);}
 assert.equal(await page.evaluate(()=>recruitButtons.every(button=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=60;unitIcon(canvas.getContext('2d'),button.dataset.recruit,30,33,TEAM.blue);return canvas.toDataURL()===button.querySelector('canvas').toDataURL();})),true,'Recrutamento deve atualizar a arte após carregar');console.log('OK 20 sprites distintos com transparência e recrutamento atualizado, offline');
 await page.locator('#seed').fill('17');await page.getByRole('button',{name:'Iniciar operação'}).click();assert.equal(await page.locator('#speed').textContent(),'1×');assert.equal(await page.locator('#status').textContent(),'Seu turno');
 const snapshot=()=>page.evaluate(()=>JSON.stringify({army:game.units.map(u=>[u.x,u.y,u.hp]),credits:game.credits,decisions:game.aiDecisions,round:game.round}));const initial=await snapshot();await page.waitForTimeout(900);assert.equal(await snapshot(),initial);
 const ROWS_=await page.evaluate(()=>ROWS);
 async function point(x,y){const r=await page.locator('#battlefield').boundingBox(),v=await page.evaluate(()=>({...cam}));return{x:r.x+((x+.5)*56-v.x)*v.zoom,y:r.y+((y+.5)*56-v.y)*v.zoom};}
 async function click(x,y,button='left'){const p=await point(x,y);await page.mouse.click(p.x,p.y,{button});}
 async function settled(){await page.waitForFunction(()=>!game.busy&&game.turn==='blue',null,{timeout:20000});}
 async function fixture(type='infantry') {return page.evaluate(type=>{newOperation('desert','normal',19);game.aiEnabled=false;game.terrain.fill('plain');game.units=[];game.structures=[];game.mines=[];game.add('blue','hq',0,13);game.add('red','hq',17,0);game.add('red','infantry',17,1);const unit=game.add('blue',type,4,7);game.rng=()=>.2;game.updateVision();renderer.rebuild();centerCamera(6,8);setSelection([unit.id]);return unit.id;},type);}
 const a=await point(.4,ROWS_-4.6),b=await point(4.5,ROWS_-1.5);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();assert.equal(await page.evaluate(()=>selection.size),5);await page.keyboard.press('Control+1');assert.equal(await page.evaluate(()=>groups[0].length),5);await click(9,ROWS_-2);await page.keyboard.press('1');assert.equal(await page.evaluate(()=>selection.size),5);
 await fixture();assert.match(await page.locator('#unitInfo').textContent(),/Movimento 3 \/ 3/);await click(5,7,'right');await settled();assert.equal(await page.evaluate(()=>selectedUnits()[0].moveLeft),2);await page.keyboard.press('s');assert.equal(await page.evaluate(()=>selectedUnits()[0].actionLeft),false);assert.equal(await page.locator('#move').isDisabled(),true);
 const chosen=await page.evaluate(()=>[...selection]);assert.equal(await page.locator('#productionPanel').isVisible(),false,'Produção só no balão do QG');await page.locator('#hqButton').click();assert.equal(await page.locator('#productionPanel').isVisible(),true);assert.equal(await page.locator('#ordersPanel').isVisible(),false);
 await page.locator('[data-recruit="infantry"]').click();assert.match(await page.locator('#queueStatus').textContent(),/1 turno/);await page.evaluate(ids=>{setSelection(ids);centerCamera(6,8);},chosen);await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>game.hq('blue').queue[0].progress),0);await page.locator('#endTurn').click();await settled();await page.waitForFunction(()=>document.querySelector('#clock').textContent==='Rodada 2');assert.equal(await page.evaluate(()=>game.hq('blue').queue.length),0);assert.equal(await page.evaluate(()=>selectedUnits()[0].moveLeft),3);assert.equal(await page.locator('#income').textContent(),'+45');
 await page.keyboard.press('Enter');await settled();assert.equal(await page.evaluate(()=>game.round),3);console.log('OK planejamento, seleção, grupos, movimento, aguardar, Enter e treinamento por turno');
 await fixture('antitank');await page.evaluate(()=>{game.add('red','tank',6,7);game.updateVision();});await page.keyboard.press('a');assert.equal(await page.evaluate(()=>mode),'attack');assert.equal(await page.locator('#attackMove').getAttribute('aria-pressed'),'true');await click(6,7);await settled();assert.equal(await page.evaluate(()=>game.units.find(u=>u.type==='tank').hp),80);assert.equal(await page.locator('#attackMove').isDisabled(),true);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>game.shotsFired),1);
 await fixture('machinegun');await page.evaluate(()=>{game.add('red','infantry',5,7);game.updateVision();});await click(5,7,'right');await settled();assert.equal(await page.evaluate(()=>game.shotsFired),3);console.log('OK ataque manual, antitanque e rajada por uma ação');
 await fixture('artillery');await page.evaluate(()=>{game.add('red','tank',6,7);game.updateVision();});await page.locator('#pause').click();await click(6,7,'right');assert.equal(await page.locator('#endTurn').isDisabled(),true);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>game.shotsFired),0);await page.keyboard.press('p');await page.waitForFunction(()=>game.projectiles.length>0);await page.keyboard.press('p');const projectile=await page.evaluate(()=>game.projectiles[0].elapsed);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>game.projectiles[0].elapsed),projectile);await page.keyboard.press('p');await settled();assert.equal(await page.locator('#move').isDisabled(),true);assert.equal(await page.evaluate(()=>game.units.find(u=>u.type==='tank').hp),100);
 await page.locator('#help').click();assert.equal(await page.locator('#manual').evaluate(e=>e.open),true);await page.locator('#closeHelp').click();console.log('OK artilharia, pausa de animação, bloqueio de ações e manual');
 await fixture();await page.evaluate(()=>{game.add('neutral','post',5,7);game.updateVision();});await click(5,7,'right');await settled();assert.equal(await page.evaluate(()=>game.structureAt(5,7).owner),'blue');
 await fixture('engineer');await page.evaluate(()=>{game.add('blue','tank',5,7).hp=90;game.updateVision();});await page.keyboard.press('r');await click(5,7);await settled();assert.equal(await page.evaluate(()=>game.units.find(u=>u.type==='tank').hp),114);
 await fixture();await page.locator('#build').click();await settled();assert.equal(await page.evaluate(()=>game.structureAt(4,7).type),'post');console.log('OK captura, reparo e construção por ação');
 await page.evaluate(()=>{newOperation('river','normal',21);speed=2;});const redBefore=await page.evaluate(()=>game.units.filter(u=>u.owner==='red').map(u=>[u.x,u.y]));await page.locator('#endTurn').click();assert.equal(await page.locator('#endTurn').isDisabled(),true);await page.keyboard.press('p');const frozen=await snapshot();await page.waitForTimeout(250);assert.equal(await snapshot(),frozen);await page.keyboard.press('p');await settled();assert.notDeepEqual(await page.evaluate(()=>game.units.filter(u=>u.owner==='red').map(u=>[u.x,u.y])),redBefore);assert.equal(await page.evaluate(()=>game.round),2);await page.waitForFunction(()=>document.querySelector('#status').textContent==='Seu turno');
 await page.locator('#endTurn').click();await page.locator('#newGame').click();await page.getByRole('button',{name:'Iniciar operação'}).click();assert.equal(await page.evaluate(()=>game.round),1);assert.equal(await page.evaluate(()=>game.turn),'blue');assert.equal(await page.evaluate(()=>game.busy),false);console.log('OK turno da IA, pausa, retorno do controle e reinício durante execução');
 for(const viewport of [{width:1440,height:1000},{width:1280,height:800},{width:768,height:1024},{width:390,height:844},{width:375,height:667}]){await page.setViewportSize(viewport);await page.waitForTimeout(100);const layout=await page.evaluate(()=>{const c=document.querySelector('#battlefield').getBoundingClientRect(),e=document.querySelector('#endTurn').getBoundingClientRect(),[l,r]=[...document.querySelectorAll('.hud')].map(h=>h.getBoundingClientRect()),inside=h=>!h.width||h.left>=c.left-1&&h.right<=c.right+1&&h.top>=c.top-1&&h.bottom<=c.bottom+1;return{overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,canvasBottom:c.bottom,height:innerHeight,buttonRight:e.right,width:innerWidth,buttonTop:e.top,huds:inside(l)&&inside(r)&&(!l.width||!r.width||l.right<=r.left||r.right<=l.left||l.bottom<=r.top||r.bottom<=l.top)};});assert.equal(layout.overflow,false,JSON.stringify(viewport));assert.ok(layout.canvasBottom<=layout.height&&layout.huds,JSON.stringify({viewport,layout}));assert.ok(layout.buttonRight<=layout.width&&layout.buttonTop>=0);}
 console.log('OK cinco layouts, incluindo celular baixo; comandos e mapa acessíveis');
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{setSelection(game.units.filter(u=>u.owner==='blue'&&u.type==='infantry').map(u=>u.id));});
 await page.locator('#newGame').click();await page.locator('#modeSelect').selectOption('rts');assert.match(await page.locator('#setupDescription').textContent(),/congelar/);await page.getByRole('button',{name:'Iniciar operação'}).click();await page.keyboard.press('p');
 assert.equal(await page.evaluate(()=>game.mode),'rts');assert.equal(await page.locator('#endTurn').isVisible(),false);assert.equal(await page.locator('#stop').textContent(),'Parar [S]');assert.match(await page.locator('#clock').textContent(),/^\d\d:\d\d$/);assert.equal(await page.locator('#pauseOverlay').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
 const ids=await page.evaluate(()=>{newOperation('desert','normal',19,'rts');paused=true;speed=1;game.aiEnabled=false;game.terrain.fill('plain');game.units=[];game.structures=[];game.mines=[];game.add('blue','hq',0,13);game.add('red','hq',17,0);game.add('red','infantry',17,1);const a=game.add('blue','infantry',4,7),b=game.add('blue','infantry',4,9);game.add('blue','artillery',4,5);game.add('red','hq',6,5);game.rng=()=>.2;game.updateVision();renderer.rebuild();centerCamera(6,8);setSelection([]);return{a:a.id,b:b.id};});
 const rtsSnapshot=()=>page.evaluate(()=>JSON.stringify({time:game.time,units:game.units,structures:game.structures,credits:game.credits,projectiles:game.projectiles,decisions:game.aiDecisions,shots:game.shotsFired}));
 await page.locator('#hqButton').click();await page.locator('[data-recruit="infantry"]').click();assert.match(await page.locator('#queueStatus').textContent(),/10 s/);await page.evaluate(()=>{setSelection([]);centerCamera(6,8);});await click(4,7);await page.keyboard.press('Control+1');await click(8,7,'right');await click(4,9);await page.keyboard.press('Control+2');await click(8,9,'right');await page.keyboard.press('1');await click(7,7,'right');
 assert.equal(await page.evaluate(id=>game.get(id).order.goal.x,ids.a),7);const ordered=await rtsSnapshot();await page.waitForTimeout(250);assert.equal(await rtsSnapshot(),ordered,'Pausa deve congelar as ordens, IA, produção e projéteis');
 await page.keyboard.press('p');await page.waitForFunction(ids=>game.get(ids.a).x>4&&game.get(ids.b).x>4&&game.projectiles.length>0,ids);await page.locator('#pause').click();assert.equal(await page.evaluate(()=>paused),true);assert.ok(await page.evaluate(()=>game.projectiles.length>0));
 const endpoint=await page.evaluate(id=>({...game.get(id).segment.to}),ids.b);await page.keyboard.press('2');await page.keyboard.press('s');await page.keyboard.press('1');const position=await page.evaluate(id=>[game.get(id).x,game.get(id).y],ids.a);await click(7,8,'right');assert.deepEqual(await page.evaluate(id=>[game.get(id).x,game.get(id).y],ids.a),position,'Nova ordem pausada não teletransporta');
 const active=await rtsSnapshot();await page.waitForTimeout(250);assert.equal(await rtsSnapshot(),active);await page.locator('#help').click();await page.locator('#closeHelp').click();assert.equal(await page.evaluate(()=>paused),true);assert.equal(await rtsSnapshot(),active);await page.locator('#newGame').click();assert.equal(await page.locator('#modeSelect').inputValue(),'rts');await page.locator('#cancelSetup').click();assert.equal(await page.evaluate(()=>paused),true);
 await page.keyboard.press('p');await page.waitForFunction(({id,endpoint})=>game.get(id).x===endpoint.x&&game.get(id).y===endpoint.y&&!game.get(id).segment,{id:ids.b,endpoint});await page.waitForFunction(id=>game.get(id).x===7&&game.get(id).y===8,ids.a);assert.deepEqual(await page.evaluate(id=>[game.get(id).x,game.get(id).y],ids.b),[endpoint.x,endpoint.y]);await page.locator('#help').click();const menuState=await rtsSnapshot();await page.waitForTimeout(150);assert.equal(await rtsSnapshot(),menuState);await page.locator('#closeHelp').click();assert.equal(await page.evaluate(()=>paused),false);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});assert.equal(await page.evaluate(()=>paused),true);const tabState=await rtsSnapshot();await page.waitForTimeout(150);assert.equal(await rtsSnapshot(),tabState);console.log('OK RTS: grupos, ordens simultâneas, substituição, parada, pausa completa, menus e saída da aba');
 await page.keyboard.press('p');await page.locator('#help').click();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});await page.locator('#closeHelp').click();assert.equal(await page.evaluate(()=>paused),true,'Sair da aba com menu aberto deve exigir continuar manualmente');
 const scaled=await page.evaluate(()=>{newOperation('river','normal',17,'rts');game.aiEnabled=false;speed=2;const before=game.time,raf=window.requestAnimationFrame;try{window.requestAnimationFrame=()=>0;frame(lastFrame+100);}finally{window.requestAnimationFrame=raf;paused=true;}return game.time-before;});assert.ok(Math.abs(scaled-.2)<1e-8,'2× deve avançar 0,2 s num quadro de 0,1 s');
 for(const map of ['river','desert','mountain','random'])for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  await page.setViewportSize(viewport);await page.evaluate(map=>{newOperation(map,'normal',17,'rts');speed=1;setSelection(game.units.filter(u=>u.owner==='blue'&&u.type==='infantry').map(u=>u.id));},map);await page.waitForTimeout(250);
  const layout=await page.evaluate(()=>{const c=document.querySelector('#battlefield').getBoundingClientRect(),e=document.querySelector('#endTurn').getBoundingClientRect(),[l,r]=[...document.querySelectorAll('.hud')].map(h=>h.getBoundingClientRect()),inside=h=>!h.width||h.left>=c.left-1&&h.right<=c.right+1&&h.top>=c.top-1&&h.bottom<=c.bottom+1;return{turnHidden:document.querySelector('#endTurn').hidden,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,canvasBottom:c.bottom,height:innerHeight,buttonRight:e.right,width:innerWidth,buttonTop:e.top,huds:inside(l)&&inside(r)&&(!l.width||!r.width||l.right<=r.left)};});assert.equal(layout.overflow,false,map+'/'+device);assert.ok(layout.canvasBottom<=layout.height&&layout.huds,map+'/'+device);assert.ok(layout.turnHidden);
  const bar=await page.evaluate(()=>{const b=document.querySelector('#commandBar').getBoundingClientRect(),c=renderer.canvas.getBoundingClientRect();return !document.querySelector('#commandBar').hidden&&b.left>=c.left-1&&b.right<=c.right+1&&b.top>=c.top-1&&b.bottom<=c.bottom+1;});assert.ok(bar,'Barra de comando dentro do campo: '+map+'/'+device);
  await page.locator('#pause').click();
  const badge=await page.locator('#pauseLabel').boundingBox(),canvas=await page.locator('#battlefield').boundingBox();assert.ok(badge.height<canvas.height/3,'Aviso de pausa compacto');
  if(device==='mobile'){const unit=await page.evaluate(()=>{const u=TILE(selectedUnits()[0]);centerCamera(u.x,u.y);const r=renderer.canvas.getBoundingClientRect(),onCanvas=p=>document.elementFromPoint(r.left+((p.x+.5)*CELL-cam.x)*cam.zoom,r.top+((p.y+.5)*CELL-cam.y)*cam.zoom)===renderer.canvas;const target=Array.from({length:12},(_,n)=>({x:u.x+1+n%4,y:u.y-Math.floor(n/4)})).find(p=>(p.x!==u.x||p.y!==u.y)&&onCanvas(p)&&!game.occupied(p.x,p.y)&&game.findPath(selectedUnits()[0],p));return target;});await page.locator('#move').click();await click(unit.x,unit.y);assert.equal(await page.evaluate(()=>paused),true);assert.equal(await page.evaluate(()=>selectedUnits().some(u=>u.pending)),true,'Ordens por toque devem funcionar pausadas');}
 }
 await page.locator('#newGame').click();await page.locator('#modeSelect').selectOption('turns');await page.getByRole('button',{name:'Iniciar operação'}).click();assert.equal(await page.evaluate(()=>game.mode),'turns');assert.equal(await page.locator('#endTurn').isVisible(),true);assert.equal(await page.locator('#clock').textContent(),'Rodada 1');assert.equal(await page.evaluate(()=>game.busy),false);console.log('OK velocidade RTS, quatro mapas em computador/celular, pausa compacta e retorno ao modo por turnos');
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('OK sem erros JavaScript ou acesso à rede; jogo offline');
 }
 // --- mouse, câmera e gerador
 {
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(__dirname,'..','public','index.html')).href);await page.locator('#titlePlay').click();
 // Gerador: controles visíveis só no mapa procedural; a prévia acompanha os parâmetros e "Gerar outro" troca a semente.
 assert.equal(await page.locator('#procedural').isHidden(),true);await page.locator('#mapSelect').selectOption('random');assert.equal(await page.locator('#procedural').isVisible(),true);
 const shot=()=>page.locator('#preview').evaluate(c=>c.toDataURL());const before=await shot();await page.locator('#genWater').fill('100');const wet=await shot();assert.notEqual(wet,before);
 const seed=await page.locator('#seed').inputValue();await page.locator('#reroll').click();assert.notEqual(await page.locator('#seed').inputValue(),seed);assert.notEqual(await shot(),wet);
 await page.locator('#genRelief').fill('0');await page.locator('#genFarmland').fill('100');await page.locator('#genPosts').selectOption('12');await page.getByRole('button',{name:'Iniciar operação'}).click();
 assert.equal(await page.evaluate(()=>game.structures.filter(s=>s.type==='post').length),12);assert.equal(await page.evaluate(()=>game.options.water),1);assert.equal(await page.evaluate(()=>[game.options.relief,game.options.farmland,game.terrain.filter(t=>t==='hill'||t==='mountain').length].join()),'0,1,0','Relevo 0 e campos 100');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth),true,'Página sem rolagem');
 console.log('OK gerador procedural: parâmetros, prévia, nova semente e partida 128 × 96');
 // Câmera só com mouse: começa no QG, rola pela borda, arrasta com o botão do meio, aproxima com a roda e salta pelo minimapa.
 const camera=()=>page.evaluate(()=>({...cam}));const box=await page.locator('#battlefield').boundingBox();const start=await camera();
 assert.ok(await page.evaluate(()=>{const hq=game.hq('blue'),v=renderer.canvas;return(hq.x+.5)*CELL>=cam.x&&(hq.x+.5)*CELL<=cam.x+v.clientWidth/cam.zoom&&(hq.y+.5)*CELL>=cam.y&&(hq.y+.5)*CELL<=cam.y+v.clientHeight/cam.zoom;}),'QG visível ao iniciar');
 await page.mouse.move(box.x+box.width-5,box.y+box.height/2);await page.waitForTimeout(300);assert.ok((await camera()).x>start.x,'Borda direita rola a câmera');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);const mid=await camera();await page.mouse.down({button:'middle'});await page.mouse.move(box.x+box.width/2-100,box.y+box.height/2-80,{steps:4});await page.mouse.up({button:'middle'});const middle=await camera();const limits=await page.evaluate(()=>{const v=cameraViewport();return{x:(COLS-.5)*CELL-v.width/cam.zoom/2,y:(ROWS-.5)*CELL-v.height/cam.zoom/2};});assert.ok(Math.abs(middle.x-Math.min(limits.x,mid.x+100/mid.zoom))<1&&Math.abs(middle.y-Math.min(limits.y,mid.y+80/mid.zoom))<1,'Botão do meio desloca a câmera e respeita os limites do campo');
 await page.locator('#panTool').click();assert.equal(await page.locator('#panTool').getAttribute('aria-pressed'),'true');await page.evaluate(()=>setSelection([]));const leftStart=await camera();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+120,box.y+box.height/2,{steps:4});await page.mouse.up();assert.ok((await camera()).x<leftStart.x,'✋ Câmera: botão esquerdo arrasta a câmera');assert.equal(await page.evaluate(()=>selection.size),0,'Arrastar a câmera não seleciona em caixa');
 {const u=await page.evaluate(()=>{const u=game.units.find(u=>u.owner==='blue'&&u.type==='tank');centerCamera(u.x,u.y);return{x:u.x,y:u.y,id:u.id};}),r=await page.locator('#battlefield').boundingBox(),v=await camera();await page.mouse.click(r.x+((u.x+.5)*56-v.x)*v.zoom,r.y+((u.y+.5)*56-v.y)*v.zoom);assert.deepEqual(await page.evaluate(()=>[...selection]),[u.id],'Clique simples ainda seleciona');}
 await page.locator('#panTool').click();const panned=await camera();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.wheel(0,300);await page.waitForTimeout(50);assert.ok((await camera()).zoom<1,'Roda afasta');await page.mouse.wheel(0,-300);await page.waitForTimeout(50);
 const mini=await page.locator('#minimap').boundingBox();await page.mouse.click(mini.x+mini.width*.9,mini.y+mini.height*.1);const jumped=await camera();assert.ok(jumped.x>panned.x&&jumped.y<panned.y,'Minimapa move a câmera');
 // Comandos de teclado com equivalente de mouse: atribuir grupo, somar seleção, cancelar ordem, tela cheia.
 await page.evaluate(()=>{const hq=game.hq('blue');centerCamera(hq.x,hq.y);});
 const pointAt=async(x,y)=>{const r=await page.locator('#battlefield').boundingBox(),v=await camera();return{x:r.x+((x+.5)*56-v.x)*v.zoom,y:r.y+((y+.5)*56-v.y)*v.zoom};};
 const [first,second]=await page.evaluate(()=>game.units.filter(u=>u.owner==='blue'&&u.type==='infantry').map(u=>({x:u.x,y:u.y,id:u.id})));
 let p=await pointAt(first.x,first.y);await page.mouse.click(p.x,p.y);await page.locator('#addSelect').click();assert.equal(await page.locator('#addSelect').getAttribute('aria-pressed'),'true');
 p=await pointAt(second.x,second.y);await page.mouse.click(p.x,p.y);assert.deepEqual(await page.evaluate(()=>[...selection].sort()),[first.id,second.id].sort(),'+ Somar adiciona sem Shift');await page.locator('#addSelect').click();
 await page.locator('#group2').click({button:'right'});assert.equal(await page.evaluate(()=>groups[2].length),2,'Botão direito atribui o grupo');await page.evaluate(()=>setSelection([]));await page.locator('#group2').click();assert.equal(await page.evaluate(()=>selection.size),2);
 await page.locator('#move').click();assert.equal(await page.evaluate(()=>mode),'move');await page.locator('#move').click();assert.equal(await page.evaluate(()=>mode),null,'Clicar de novo cancela a ordem');
 await page.locator('#fullscreen').click();await page.waitForTimeout(100);await page.locator('#fullscreen').click();
 assert.deepEqual(errors,[]);console.log('OK câmera por borda, botão do meio, roda e minimapa; grupos, seleção somada e cancelamento só com mouse');
 }
 // --- tanques
 {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});await page.context().setOffline(true);await page.goto(pathToFileURL(path.join(root,'public','index.html')).href);await page.evaluate(()=>terrainReady);await page.waitForFunction(()=>tankAtlas.complete&&tankAtlas.naturalWidth===384);
 assert.equal(await page.evaluate(()=>tankAtlas.naturalHeight),256);
 const files=['light-blue','light-red','medium-blue','medium-red','heavy-blue','heavy-red'];
 for(const name of files){const input='data:image/png;base64,'+fs.readFileSync(path.join(root,'assets','Tanques',name+'.png')).toString('base64');const pixels=await page.evaluate(async src=>{const i=new Image();i.src=src;await i.decode();const c=document.createElement('canvas');c.width=c.height=128;const p=c.getContext('2d');p.drawImage(i,0,0);const d=p.getImageData(0,0,128,128).data;let clear=0,solid=0;for(let k=3;k<d.length;k+=4){if(d[k]===0)clear++;if(d[k]>=250)solid++;}return{width:i.width,height:i.height,clear,solid,corners:[d[3],d[127*4+3],d[127*128*4+3],d[d.length-1]]};},input);assert.equal(pixels.width,128);assert.equal(pixels.height,128);assert.ok(pixels.clear>5000&&pixels.solid>3000,name);assert.deepEqual(pixels.corners,[0,0,0,0]);}
 const art=await page.evaluate(()=>['blue','red'].flatMap(owner=>['lightTank','tank','heavyTank'].map(type=>{const c=document.createElement('canvas');c.width=c.height=96;const p=c.getContext('2d');unitIcon(p,type,48,48,TEAM[owner]);const normal=c.toDataURL();p.clearRect(0,0,96,96);unitIcon(p,type,48,48,TEAM[owner],1,Math.PI/2);const rotated=c.toDataURL();p.clearRect(0,0,96,96);unitIcon(p,type,48,48,TEAM[owner],1,0,0,true);return{normal,rotated,firing:c.toDataURL()};})));
 assert.equal(new Set(art.map(a=>a.normal)).size,6);for(const a of art){assert.notEqual(a.normal,a.rotated);assert.notEqual(a.normal,a.firing);}console.log('OK seis PNGs RGBA 128x128, atlas 3x2, classes/equipes, rotação e disparo');
 await page.locator('#titlePlay').click();await page.getByRole('button',{name:'Iniciar operação'}).click();
 for(const mode of ['turns','rts'])for(const viewport of [{width:1440,height:1000},{width:768,height:1024},{width:390,height:844},{width:375,height:667}]){
  // Produção no balão do QG; mouse fora do campo para a rolagem pela borda não mover o balão.
  await page.mouse.move(1,1);await page.setViewportSize(viewport);await page.evaluate(mode=>{newOperation('desert','normal',17,mode);paused=true;game.aiEnabled=false;game.credits.blue=10000;setSelection([game.hq('blue').id]);},mode);
  assert.equal(await page.locator('[data-recruit]:visible').count(),17);
  for(const type of [...types,'infantry','recon','engineer','artillery','antitank','machinegun','helicopter','helicopterGround','helicopterAir','antiAirVehicle','missileInfantry']){const button=page.locator(`[data-recruit="${type}"]`);await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width+1);await button.click();assert.equal(await page.evaluate(()=>game.hq('blue').queue[0].type),type);assert.match(await button.getAttribute('aria-label'),new RegExp(mode==='rts'?'s$':'turno'));await page.evaluate(()=>{game.hq('blue').queue=[];updateUI();});}
  for(const type of [...types,'helicopter','helicopterGround','helicopterAir']){await page.evaluate(type=>{const u=game.add('blue',type,5,8);setSelection([u.id]);},type);assert.match(await page.locator('#unitName').textContent(),/Tanque|Helicóptero/);assert.equal(await page.evaluate(()=>{const u=selectedUnits()[0],c=document.createElement('canvas');c.width=c.height=108;unitIcon(c.getContext('2d'),u.type,54,59,TEAM[u.owner],1.55);return c.toDataURL()===document.querySelector('#portrait').toDataURL();}),true);}
  await page.locator('#help').click();assert.equal(await page.locator('.tank-stats').count(),2);assert.equal(await page.locator('#manual').evaluate(e=>e.scrollWidth<=e.clientWidth),true,'Manual sem corte lateral');await page.locator('#closeHelp').click();assert.equal(await page.evaluate(()=>paused),true);
 }
 console.log('OK nove compras e retratos nos dois modos, quatro tamanhos de tela, manual e pausa preservada');
 // Falha real do atlas: evento onerror deve invalidar também retrato e recrutamento.
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{setSelection([game.units.find(u=>u.owner==='blue'&&u.type==='heavyTank').id]);tankAtlas.src='data:image/png;base64,AA==';});await page.waitForFunction(()=>tankAtlas.complete&&!tankAtlas.naturalWidth);
 const fallback=await page.evaluate(()=>['blue','red'].flatMap(owner=>['lightTank','tank','heavyTank'].map(type=>{const c=document.createElement('canvas');c.width=c.height=96;unitIcon(c.getContext('2d'),type,48,48,TEAM[owner]);return c.toDataURL();})));assert.equal(new Set(fallback).size,6);fallback.forEach((data,i)=>assert.notEqual(data,art[i].normal));
 assert.equal(await page.evaluate(()=>recruitButtons.every(b=>{const c=document.createElement('canvas');c.width=c.height=60;unitIcon(c.getContext('2d'),b.dataset.recruit,30,33,TEAM.blue);return c.toDataURL()===b.querySelector('canvas').toDataURL();})),true);
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('OK falha de atlas com seis desenhos alternativos, offline sem erros');
 }
 // --- terreno
 {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});await page.context().setOffline(true);
 await page.goto(pathToFileURL(path.join(__dirname,'..','public','index.html')).href);
 assert.equal(await page.evaluate(()=>typeof terrainReady!=='undefined'),true,'Texturas devem ser carregadas');
 await page.evaluate(()=>terrainReady);assert.equal(await page.evaluate(()=>Object.values(terrainImages).every(i=>i.naturalWidth===128&&i.naturalHeight===128)),true);
 const roads=await page.evaluate(()=>Array.from({length:16},(_,mask)=>{const tile=roadOverlay(mask),c=tile.getContext('2d');return{mask,alpha:[[28,0],[55,28],[28,55],[0,28]].map(([x,y])=>c.getImageData(x,y,1,1).data[3]),corner:c.getImageData(0,0,1,1).data[3],cached:roadOverlay(mask)===tile};}));
 for(const {mask,alpha,corner,cached} of roads){assert.ok(cached);assert.equal(corner,0);for(let d=0;d<4;d++)assert.equal(alpha[d]>200,!!(mask&(1<<d)),'Road mask '+mask+' direction '+d);}
 const connections=await page.evaluate(()=>{
  game.terrain.fill('plain');game.terrain[KEY(8,6)]=game.terrain[KEY(9,6)]='river';const pair=[terrainTopology(game,8,6).waterMask,terrainTopology(game,9,6).waterMask];
  const group=[];for(const p of [[8,6],[9,6],[8,7],[9,7]])game.terrain[KEY(...p)]='river';for(const p of [[8,6],[9,6],[8,7],[9,7]])group.push(terrainTopology(game,...p).waterMask);
  game.terrain.fill('plain');game.terrain[KEY(0,0)]='river';const edge=terrainTopology(game,0,0).waterMask;
  game.terrain.fill('plain');for(let x=6;x<=11;x++)game.terrain[KEY(x,6)]=x===8||x===9?'bridge':'road';const bridges=[8,9].map(x=>terrainTopology(game,x,6));
  game.terrain.fill('plain');game.terrain[KEY(8,6)]='bridge';game.terrain[KEY(8,5)]=game.terrain[KEY(8,7)]='road';const vertical=terrainTopology(game,8,6).vertical;
  game.terrain[KEY(7,6)]=game.terrain[KEY(9,6)]='road';const tie=terrainTopology(game,8,6).vertical;
  return{pair,group,edge,bridges,vertical,tie};
 });
 assert.deepEqual(connections.pair,[2,8]);assert.deepEqual(connections.group,[6,12,3,9]);assert.equal(connections.edge,0);assert.equal(connections.vertical,true);assert.equal(connections.tie,false);for(const bridge of connections.bridges){assert.equal(bridge.vertical,false);assert.equal(bridge.roadMask,10);}
 console.log('OK 16 conexões de estrada, rios agrupados, bordas e orientação de pontes');
 const palettes=await page.evaluate(()=>{game.terrain.fill('plain');game.terrain[KEY(8,6)]='river';game.map='river';const green=terrainTile(game,8,6);game.map='desert';const sand=terrainTile(game,8,6);return green===sand;});assert.equal(palettes,false,'Margens dos dois biomas devem ter caches distintos');
 await page.evaluate(()=>document.querySelector('#setup').close());
 for(const map of ['river','desert','mountain','random'])for(const seed of [17,83]){
  const state=await page.evaluate(({map,seed})=>{
   const snapshot=g=>JSON.stringify({terrain:g.terrain,army:g.all(),mines:g.mines,path:g.findPath({type:'tank',owner:'blue',x:4,y:ROWS-2},{x:COLS-5,y:1}),next:g.rng()});
   const expected=snapshot(new Game(map,'normal',seed,'turns',{}, {blue:settings.doctrine,red:enemyDoctrine(seed)}));newOperation(map,'normal',seed);renderer.paintGround();renderer.drawMini();renderer.draw(0);return{expected,actual:snapshot(game)};
  },{map,seed});assert.equal(state.actual,state.expected,map+'/'+seed);
 }
 const lifecycle=await page.evaluate(async()=>{
  newOperation('river','normal',17);paused=true;const state=JSON.stringify(game.terrain),particles=renderer.particles,texts=renderer.texts;renderer.shake=3;renderer.paintGround();
  const preserved=renderer.particles===particles&&renderer.texts===texts&&renderer.shake===3&&JSON.stringify(game.terrain)===state;
  const image=terrainImages.plain,canvas=document.createElement('canvas');canvas.width=canvas.height=CELL;const c=canvas.getContext('2d');renderer.terrain(c,0,0,'plain',0);const textured=canvas.toDataURL();
  const failed=new Image();const failure=new Promise(resolve=>failed.onerror=resolve);failed.src='data:image/png;base64,broken';await failure;terrainImages.plain=failed;renderer.terrain(c,0,0,'plain',0);const fallback=canvas.toDataURL(),opaque=c.getImageData(28,28,1,1).data[3];
  renderer.paintGround();terrainImages.plain=image;renderer.paintGround();return{preserved,different:fallback!==textured,opaque,desert:terrainMinimapColor('plain','desert'),green:terrainMinimapColor('plain','river')};
 });assert.ok(lifecycle.preserved);assert.ok(lifecycle.different);assert.equal(lifecycle.opaque,255);assert.notEqual(lifecycle.desert,lifecycle.green);
 console.log('OK renderização sem alterar sementes, caminhos, efeitos ou regras; falha real de imagem usa alternativa');
 for(const map of ['river','desert','mountain','random'])for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  await page.setViewportSize(viewport);await page.evaluate(map=>{newOperation(map,'normal',17);setSelection(game.units.filter(u=>u.owner==='blue'&&u.type==='infantry').map(u=>u.id));renderer.draw(0);},map);
  await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,map+'/'+device);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('OK quatro mapas em desktop/celular, sem erros JavaScript ou rede');
 }
 // --- helicópteros ---
 {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});await page.context().setOffline(true);
 await page.goto(pathToFileURL(path.join(root,'public','index.html')).href);await page.locator('#titlePlay').click();await page.getByRole('button',{name:'Iniciar operação'}).click();await page.waitForFunction(()=>heliAtlas.complete&&heliAtlas.naturalWidth===384);assert.equal(await page.evaluate(()=>heliAtlas.naturalHeight),256);
 const helis=['helicopter','helicopterGround','helicopterAir'],draw=()=>page.evaluate(helis=>['blue','red'].flatMap(owner=>helis.map(type=>{const c=document.createElement('canvas');c.width=c.height=96;const p=c.getContext('2d');unitIcon(p,type,48,48,TEAM[owner]);const normal=c.toDataURL(),alpha=p.getImageData(0,0,96,96).data.filter((v,i)=>i%4===3&&v>0).length;p.clearRect(0,0,96,96);unitIcon(p,type,48,48,TEAM[owner],1,Math.PI/2);const rotated=c.toDataURL();p.clearRect(0,0,96,96);unitIcon(p,type,48,48,TEAM[owner],1,0,0,true);return{normal,rotated,firing:c.toDataURL(),alpha};})),helis);
 const art=await draw();assert.equal(new Set(art.map(a=>a.normal)).size,6);for(const a of art){assert.ok(a.alpha>600);assert.notEqual(a.normal,a.rotated);assert.notEqual(a.normal,a.firing);}
 // Renderizar e carregar arte não consome o RNG da partida.
 const rng=await page.evaluate(()=>{newOperation('desert','normal',23,'rts');paused=true;game.aiEnabled=false;for(const [i,t] of ['helicopter','helicopterGround','helicopterAir'].entries())game.add('blue',t,4+i,ROWS-6);game.updateVision();sprites.clear();renderer.rebuild();renderer.draw(.1);renderer.drawMini();setSelection(game.units.filter(u=>AIR(u)).map(u=>u.id));updateUI();return game.rng()===new Game('desert','normal',23,'rts').rng();});assert.ok(rng,'RNG da partida intacto');
 console.log('OK atlas 3 × 2 de helicópteros: seis desenhos, rotação, disparo e RNG preservado');
 // Recrutamento e retrato compartilham o desenho.
 // O evento load chega depois de complete=true; espera o redesenho do recrutamento.
 // Mesmo desenho no recrutamento: diferença média < 5/255. O Chrome reamostra o atlas de outro jeito depois de um retrato em escala maior.
 await page.evaluate(()=>{window.sameIcon=b=>{const c=document.createElement('canvas');c.width=c.height=60;unitIcon(c.getContext('2d'),b.dataset.recruit,30,33,TEAM.blue,1);const a=c.getContext('2d').getImageData(0,0,60,60).data,d=b.querySelector('canvas').getContext('2d').getImageData(0,0,60,60).data;let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-d[i]);return sum/a.length<5;};});
 await page.waitForFunction(()=>recruitButtons.filter(b=>b.dataset.recruit.startsWith('helicopter')).every(sameIcon),null,{timeout:5000});
 // Botões de arma: só com helicóptero especializado; trocar não devolve a ação por turnos.
 await page.evaluate(()=>{newOperation('river','normal',31);game.aiEnabled=false;game.units=game.units.filter(u=>u.owner==='blue');game.rng=()=>.2;for(let x=0;x<COLS;x++)game.terrain[KEY(x,ROWS-5)]='plain';renderer.rebuild();const h=game.add('blue','helicopterGround',6,ROWS-5),t=game.add('red','lightTank',7,ROWS-5);game.updateVision();centerCamera(6,ROWS-5);setSelection([h.id]);});
 assert.equal(await page.locator('#weapons').isVisible(),true);assert.equal(await page.locator('#weaponMissile').textContent(),'Míssil ar-terra');assert.equal(await page.locator('#weaponAuto').getAttribute('aria-pressed'),'true');assert.match(await page.locator('#unitInfo').textContent(),/Arma: Auto · Metralhadora 3 casas, 1 s · Míssil ar-terra 5 casas, 3 s/);
 await page.locator('#weaponGun').click();assert.equal(await page.evaluate(()=>selectedUnits()[0].weaponMode),'gun');assert.equal(await page.locator('#weaponGun').getAttribute('aria-pressed'),'true');
 const enemy=await page.evaluate(()=>{const r=renderer.canvas.getBoundingClientRect(),t=game.units.find(u=>u.type==='lightTank'&&u.owner==='red');return{x:r.left+((t.x+.5)*CELL-cam.x)*cam.zoom,y:r.top+((t.y+.5)*CELL-cam.y)*cam.zoom};});
 await page.mouse.click(enemy.x,enemy.y,{button:'right'});await page.waitForFunction(()=>!game.busy);assert.equal(await page.evaluate(()=>{const t=game.units.find(u=>u.type==='lightTank'&&u.owner==='red');return t.maxHp-t.hp;}),7,'Metralhadora escolhida: 20 × 0,35');
 await page.locator('#weaponMissile').click();assert.equal(await page.evaluate(()=>[selectedUnits()[0].weaponMode,selectedUnits()[0].actionLeft].join()),'agm,false','Trocar arma não devolve a ação');
 await page.evaluate(()=>setSelection([game.add('blue','helicopter',9,ROWS-5).id]));assert.equal(await page.locator('#weapons').isHidden(),true,'Padrão só tem metralhadora');
 console.log('OK botões Auto/Metralhadora/Míssil, arma ativa, alcance, recarga e ação única por turno');
 // Mesma casa: clique alterna entre as camadas; caixa seleciona as duas; ordem mira o inimigo que a seleção atinge.
 const stack=await page.evaluate(()=>{newOperation('river','normal',31);game.aiEnabled=false;const x=8,y=ROWS-6;for(let i=0;i<COLS;i++)game.terrain[KEY(i,y)]='plain';renderer.rebuild();const h=game.add('blue','helicopterAir',x,y),t=game.add('blue','tank',x,y),eh=game.add('red','helicopter',x+2,y),et=game.add('red','tank',x+2,y);game.updateVision();centerCamera(x,y);setSelection([]);const r=renderer.canvas.getBoundingClientRect(),at=(cx,cy)=>({x:r.left+((cx+.5)*CELL-cam.x)*cam.zoom,y:r.top+((cy+.5)*CELL-cam.y)*cam.zoom});return{h:h.id,t:t.id,eh:eh.id,et:et.id,own:at(x,y),foe:at(x+2,y),corner:at(x-1,y-1),far:at(x+1,y+1)};});
 const picked=async()=>{await page.mouse.click(stack.own.x,stack.own.y);return page.evaluate(()=>[...selection][0]);};
 assert.equal(await picked(),stack.h,'Aeronave primeiro');assert.match(await page.locator('#hint').textContent(),/1\/2 nesta casa/);assert.equal(await picked(),stack.t);assert.equal(await picked(),stack.h);
 await page.mouse.move(stack.corner.x,stack.corner.y);await page.mouse.down();await page.mouse.move(stack.far.x,stack.far.y,{steps:5});await page.mouse.up();assert.deepEqual(await page.evaluate(()=>[...selection].sort()),[stack.h,stack.t].sort());
 await page.evaluate(id=>setSelection([id]),stack.t);await page.mouse.click(stack.foe.x,stack.foe.y,{button:'right'});assert.equal(await page.evaluate(id=>game.get(id).order.targetId,stack.t),stack.et,'Tanque mira o tanque, não a aeronave');assert.match(await page.locator('#hint').textContent(),/alvo: Tanque médio/);
 await page.waitForFunction(()=>!game.busy);await page.evaluate(id=>setSelection([id]),stack.h);await page.mouse.click(stack.foe.x,stack.foe.y,{button:'right'});assert.equal(await page.evaluate(id=>game.get(id).order.targetId,stack.h),stack.eh,'Ar-ar mira a aeronave');
 console.log('OK seleção nas duas camadas, clique alternado, caixa e alvo compatível no empilhamento');
 // Pausa tática congela voo, disparos, produção e reparo.
 await page.evaluate(()=>{newOperation('river','normal',37,'rts');game.aiEnabled=false;paused=false;game.credits.blue=1000;const y=ROWS-6;for(let x=0;x<COLS;x++)game.terrain[KEY(x,y)]=game.terrain[KEY(x,y-2)]='plain';renderer.rebuild();const h=game.add('blue','helicopter',5,y),base=game.add('blue','post',9,y),hurt=game.add('blue','helicopterAir',10,y),foe=game.add('red','tank',8,y-2);hurt.hp=40;game.updateVision();game.order(h,'move',{x:14,y});game.order(hurt,'service',{targetId:base.id});game.enqueue('blue','helicopterGround');});
 await page.waitForFunction(()=>game.units.some(u=>u.type==='helicopter'&&u.segment)&&game.shotsFired>0);await page.locator('#pause').click();
 const frozen=()=>page.evaluate(()=>JSON.stringify({time:game.time,units:game.units.map(u=>[u.id,u.x,u.y,u.hp,u.cooldown,u.work]),projectiles:game.projectiles,queue:game.hq('blue').queue,shots:game.shotsFired}));const before=await frozen();await page.waitForTimeout(300);assert.equal(await frozen(),before);
 await page.locator('#pause').click();await page.waitForFunction(()=>game.units.find(u=>u.type==='helicopterAir').hp>40);console.log('OK pausa congela voo, disparos, produção e reparo; retomar continua');
 // Falha real do atlas: desenhos alternativos distintos por modelo e equipe, recrutamento atualizado.
 await page.evaluate(()=>{heliAtlas.src='data:image/png;base64,AA==';});await page.waitForFunction(()=>heliAtlas.complete&&!heliAtlas.naturalWidth);
 const fallback=await draw();assert.equal(new Set(fallback.map(a=>a.normal)).size,6);fallback.forEach((a,i)=>{assert.notEqual(a.normal,art[i].normal);assert.ok(a.alpha>600);});
 await page.waitForFunction(()=>recruitButtons.every(sameIcon),null,{timeout:5000});
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('OK falha do atlas de helicópteros com seis alternativas; file:// sem rede e sem erros');
 await page.close();
 }
 // --- barra de comando ---
 {
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(root,'public','index.html')).href);await page.locator('#titlePlay').click();await page.getByRole('button',{name:'Iniciar operação'}).click();await page.mouse.move(1,1);
 assert.equal(await page.locator('#balloon').count(),0,'Sem balões');assert.equal(await page.locator('#commandBar').isHidden(),true,'Sem seleção, sem barra');
 const fix=await page.evaluate(()=>{newOperation('desert','normal',19);paused=true;game.aiEnabled=false;game.terrain.fill('plain');renderer.rebuild();const t=game.units.find(u=>u.owner==='blue'&&u.type==='tank');t.x=12;t.y=12;game.updateVision();centerCamera(12,12);return t.id;});
 const unitAt=()=>page.evaluate(id=>{const u=game.get(id),r=renderer.canvas.getBoundingClientRect();return{x:r.left+((u.x+.5)*CELL-cam.x)*cam.zoom,y:r.top+((u.y+.5)*CELL-cam.y)*cam.zoom};},fix);
 const rects=()=>page.evaluate(()=>{const r=e=>document.querySelector(e).getBoundingClientRect().toJSON();return{bar:r('#commandBar'),left:r('.hud-left'),right:r('.hud-right'),canvas:r('#battlefield')};});
 let at=await unitAt();await page.mouse.click(at.x,at.y);let k=await rects();
 assert.equal(await page.locator('#ordersPanel').isVisible(),true);assert.equal(await page.locator('#productionPanel').isVisible(),false);assert.equal(await page.locator('#details').isHidden(),true,'Detalhes começam fechados');
 assert.ok(k.bar.bottom<=k.canvas.bottom&&k.bar.bottom>k.canvas.bottom-40,'Barra na base do campo');assert.ok(k.bar.left>=k.left.right&&k.bar.right<=k.right.left,'Entre grupos/registro e minimapa');assert.ok(k.bar.height<=80,'Barra compacta: '+k.bar.height);
 assert.ok(at.y<k.bar.top-28,'Barra não cobre a tropa selecionada');
 // A câmera não move a barra (posição fixa na base).
 await page.evaluate(()=>{cam.x+=112;clampCamera();});await page.waitForTimeout(120);assert.equal(JSON.stringify((await rects()).bar),JSON.stringify(k.bar));
 // (i) mostra papel e detalhes acima da barra.
 await page.locator('#infoToggle').click();assert.equal(await page.locator('#details').isVisible(),true);assert.match(await page.locator('#unitInfo').textContent(),/170 \/ 170 HP/);const d=await page.locator('#details').boundingBox();assert.ok(d.y+d.height<=k.bar.top+1,'Detalhes acima da barra');await page.locator('#infoToggle').click();assert.equal(await page.locator('#details').isHidden(),true);
 // Botão direito sobre a barra vira ordem no ponto do mapa por baixo.
 const under=await page.evaluate(()=>{const b=document.querySelector('#commandBar').getBoundingClientRect();return{x:b.left+b.width-20,y:b.top+6};});await page.mouse.click(under.x,under.y,{button:'right'});assert.equal(await page.evaluate(id=>game.get(id).order.type,fix),'move');
 // × limpa a seleção; botão QG mostra a produção na mesma barra.
 await page.locator('#closeSelection').click();assert.equal(await page.evaluate(()=>selection.size),0);assert.equal(await page.locator('#commandBar').isHidden(),true);
 await page.locator('#hqButton').click();assert.equal(await page.locator('#productionPanel').isVisible(),true);assert.equal(await page.locator('#ordersPanel').isVisible(),false);assert.ok((await rects()).bar.height<=190,'Recrutamento em duas fileiras com radar e resumo da reserva aérea');
 // Registro recolhe e expande, lembrando a escolha.
 assert.equal(await page.locator('#log').isHidden(),true);assert.notEqual(await page.locator('#logLast').textContent(),'');await page.locator('#logToggle').click();assert.equal(await page.locator('#log').isVisible(),true);assert.equal(await page.locator('#logToggle').getAttribute('aria-expanded'),'true');
 await page.reload();await page.locator('#titlePlay').click();await page.getByRole('button',{name:'Iniciar operação'}).click();assert.equal(await page.locator('#log').isVisible(),true,'Escolha do registro lembrada');await page.locator('#logToggle').click();
 console.log('OK barra de comando: base do campo entre os cantos, compacta, não cobre a tropa, detalhes (i), × e QG; registro recolhível');
 // Celular: barra em largura total; os cantos somem enquanto ela está aberta e voltam ao fechar.
 await page.setViewportSize({width:390,height:844});await page.mouse.move(1,1);
 const phone=await page.evaluate(()=>{newOperation('river','normal',23);paused=true;game.aiEnabled=false;const t=game.units.find(u=>u.owner==='blue'&&u.type==='tank');centerCamera(t.x,t.y);setSelection([t.id]);const r=e=>document.querySelector(e).getBoundingClientRect(),b=r('#commandBar'),c=r('#battlefield'),y=c.top+((t.y+.5)*CELL-cam.y)*cam.zoom;return{wide:b.width>c.width-20,inside:b.left>=c.left&&b.right<=c.right&&b.bottom<=c.bottom,cornersHidden:!r('.hud-left').width&&!r('.hud-right').width,unitClear:y<b.top};});
 assert.deepEqual(phone,{wide:true,inside:true,cornersHidden:true,unitClear:true});
 await page.locator('#closeSelection').click();assert.equal(await page.locator('.hud-right').isVisible(),true,'Cantos voltam ao fechar');
 assert.deepEqual(errors,[]);console.log('OK celular: barra em largura total, cantos ocultos enquanto aberta, tropa visível');
 await page.close();
 }
 // --- campanha no mapa-múndi ---
 {
 const context=await browser.newContext({viewport:{width:1440,height:900}});await context.setOffline(true);const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await page.goto(pathToFileURL(path.join(root,'public','index.html')).href);await page.evaluate(()=>terrainReady);
 await page.locator('#titleCampaign').click();assert.equal(await page.locator('#campaign').evaluate(e=>e.open),true);assert.equal(await page.locator('#titleScreen').evaluate(e=>e.open),false);
 assert.match(await page.locator('#campaignStats').textContent(),/^1 suas · 1 inimigas/);
 const land=await page.evaluate(()=>{const c=document.querySelector('#worldMap'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i+1]>d[i+2])n++;return n/(d.length/4);});assert.ok(land>.15,'Terra desenhada: '+land);
 const pts=await page.evaluate(()=>{const w=campaign.world,c=document.querySelector('#worldMap'),r=c.getBoundingClientRect();
  const at=reg=>{let best=null;for(let k=0;k<worldView.ids.length;k++)if(worldView.ids[k]===reg.id){const px=k%c.width,py=Math.floor(k/c.width),d=Math.hypot(px-reg.x/w.w*c.width,py-reg.y/w.h*c.height);if(!best||d<best.d)best={px,py,d};}return{x:r.left+(best.px+.5)*r.width/c.width,y:r.top+(best.py+.5)*r.height/c.height,id:reg.id,name:reg.name};};
  return{ok:at(w.regions.find(g=>canAttack(campaign,g.id))),far:at(w.regions.find(g=>!canAttack(campaign,g.id)&&g.id!==w.homes.blue))};});
 await page.mouse.click(pts.far.x,pts.far.y);assert.equal(await page.locator('#regionName').textContent(),pts.far.name);assert.equal(await page.locator('#attackRegion').isDisabled(),true,'Sem fronteira azul');
 await page.mouse.click(pts.ok.x,pts.ok.y);assert.equal(await page.locator('#regionName').textContent(),pts.ok.name);assert.equal(await page.locator('#attackRegion').isEnabled(),true);
 const expected=await page.evaluate(id=>battleFor(campaign,id),pts.ok.id);await page.locator('#attackRegion').click();assert.equal(await page.locator('#campaign').evaluate(e=>e.open),false);
 const state=await page.evaluate(()=>({map:game.map,seed:game.seed,difficulty:game.difficulty,title:document.querySelector('#mapTitle').textContent}));
 assert.equal(state.map,expected.map);assert.equal(state.seed,expected.seed);assert.equal(state.difficulty,expected.difficulty);assert.match(state.title,new RegExp(pts.ok.name));
 await page.evaluate(()=>{game.winner='blue';updateUI();});assert.equal(await page.locator('#backToWorld').isVisible(),true);await page.locator('#backToWorld').click();
 assert.equal(await page.locator('#campaign').evaluate(e=>e.open),true);assert.equal(await page.evaluate(id=>campaign.owners[id],pts.ok.id),'blue');assert.match(await page.locator('#campaignEvents').textContent(),/conquistada/);
 await page.reload();await page.evaluate(()=>terrainReady);await page.locator('#titleCampaign').click();assert.equal(await page.evaluate(id=>campaign.owners[id],pts.ok.id),'blue','Progresso salvo no navegador');
 await page.locator('#closeCampaign').click();assert.equal(await page.locator('#titleScreen').evaluate(e=>e.open),true,'Sem partida, Voltar leva ao menu inicial');await page.locator('#titlePlay').click();
 await page.getByRole('button',{name:'Iniciar operação'}).click();await page.locator('#worldButton').click();assert.equal(await page.locator('#campaign').evaluate(e=>e.open),true,'Botão Mapa-múndi do topo abre a campanha');await page.locator('#closeCampaign').click();assert.equal(await page.evaluate(()=>paused),false,'Voltar da campanha restaura o estado anterior da partida');await page.evaluate(()=>{game.winner='red';updateUI();});assert.equal(await page.locator('#backToWorld').isHidden(),true,'Batalha rápida não volta ao mundo');
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('OK campanha: mapa-múndi, ataque só na fronteira, batalha pela região, vitória pinta de azul e progresso salvo');
 await context.close();
 const denied=await browser.newContext();await denied.addInitScript(()=>{Storage.prototype.getItem=Storage.prototype.setItem=()=>{throw new Error('Storage blocked');};});const blocked=await denied.newPage(),deniedErrors=[];blocked.on('pageerror',e=>deniedErrors.push(e.message));
 await blocked.goto(pathToFileURL(path.join(root,'public','index.html')).href);await blocked.locator('#titleCampaign').click();assert.equal(await blocked.locator('#campaign').evaluate(e=>e.open),true);await blocked.locator('#newCampaign').click();
 assert.deepEqual(deniedErrors,[]);console.log('OK campanha sem armazenamento: funciona na sessão, sem erros');await denied.close();
 }
 // --- menu inicial e configurações ---
 {
 const context=await browser.newContext({viewport:{width:1440,height:900}});await context.setOffline(true);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const open=id=>page.evaluate(id=>document.querySelector('#'+id).open,id);
 await page.goto(pathToFileURL(path.join(root,'public','index.html')).href);await page.evaluate(()=>terrainReady);
 assert.equal(await open('titleScreen'),true,'Abre no menu inicial');assert.equal(await page.locator('#titleResume').isHidden(),true,'Continuar só com partida');
 await page.locator('#titlePlay').click();assert.equal(await open('setup'),true);assert.equal(await open('titleScreen'),false);
 await page.locator('#cancelSetup').click();assert.equal(await open('titleScreen'),true,'Voltar leva ao título');
 await page.locator('#titlePlay').click();await page.getByRole('button',{name:'Iniciar operação'}).click();await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>paused),false,'Partida começa rodando');
 await page.locator('#menuButton').click();assert.equal(await open('titleScreen'),true);assert.equal(await page.evaluate(()=>paused),true,'Menu pausa a partida');assert.equal(await page.locator('#titleResume').isVisible(),true,'Continuar com partida');
 await page.locator('#titleHelp').click();assert.equal(await open('manual'),true);await page.locator('#closeHelp').click();assert.equal(await open('titleScreen'),true,'Como jogar volta ao título');
 await page.locator('#titleSettings').click();assert.equal(await open('settings'),true);await page.locator('#setGrid').check();await page.locator('#setDifficulty').selectOption('veteran');await page.locator('#setSpeed').selectOption('2');await page.locator('#settingsBack').click();assert.equal(await open('titleScreen'),true);
 await page.reload();await page.evaluate(()=>terrainReady);
 await page.locator('#titleSettings').click();assert.equal(await page.locator('#setGrid').isChecked(),true,'Grade persiste');assert.equal(await page.locator('#setDifficulty').inputValue(),'veteran','Dificuldade persiste');assert.equal(await page.locator('#setSpeed').inputValue(),'2','Velocidade persiste');await page.locator('#settingsBack').click();
 await page.locator('#titlePlay').click();assert.equal(await page.locator('#difficulty').inputValue(),'veteran','Nova operação usa o padrão das configurações');
 await page.keyboard.press('Escape');assert.equal(await open('titleScreen'),true,'Esc volta ao título');
 await page.locator('#titleCampaign').click();assert.equal(await open('campaign'),true);await page.locator('#closeCampaign').click();assert.equal(await open('titleScreen'),true,'Campanha volta ao título');
 await page.keyboard.press('ArrowDown');assert.notEqual(await page.evaluate(()=>document.activeElement.id),'titlePlay','Setas movem o foco');
 await page.locator('#titlePlay').click();await page.getByRole('button',{name:'Iniciar operação'}).click();await page.waitForTimeout(150);await page.locator('#menuButton').click();await page.keyboard.press('Escape');assert.equal(await open('titleScreen'),false,'Esc com partida fecha o menu');assert.equal(await page.evaluate(()=>paused),false,'Retoma a pausa anterior');
 assert.deepEqual(errors,[]);console.log('OK menu inicial e configurações: fluxo de voltar, pausa pelo Menu, persistência e atalhos');
 await context.close();
 }
 // --- perfil, conquistas, backup em arquivo e sincronização (cliente Neon falso, sem rede)
 {
 const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});await context.setOffline(true);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const open=id=>page.evaluate(id=>document.querySelector('#'+id).open,id);
 await page.goto(pathToFileURL(path.join(root,'public','index.html')).href);await page.evaluate(()=>terrainReady);
 assert.match(await page.locator('#titleProfileInfo').textContent(),/^0\/15 conquistas/);
 await page.locator('#titlePlay').click();await page.getByRole('button',{name:'Iniciar operação'}).click();
 await page.evaluate(()=>{game.stats.blue.kills.helicopter=2;game.winner='blue';});await page.waitForFunction(()=>document.querySelector('#result').open);
 assert.match(await page.locator('#resultText').textContent(),/Conquista desbloqueada: .*Primeira vitória/);
 await page.locator('#review').click();await page.locator('#menuButton').click();await page.locator('#titleProfile').click();assert.equal(await open('profile'),true);
 assert.match(await page.locator('#achievementCount').textContent(),/^\d+ de 15$/);assert.equal(await page.locator('#achievementList li.done').first().locator('b').textContent(),'Primeira vitória');
 await page.getByRole('tab',{name:'Histórico'}).click();assert.equal(await page.locator('#historyBody tr').count(),1);assert.match(await page.locator('#historyBody tr').textContent(),/Vitória.*2 \/ 0/);
 await page.getByRole('tab',{name:'Estatísticas'}).click();assert.match(await page.locator('#statList').textContent(),/Aeronaves abatidas2/);
 await page.getByRole('tab',{name:'Conta e save'}).click();assert.match(await page.locator('#accountStatus').textContent(),/file:\/\/|não configurada/);assert.equal(await page.locator('#accountForm').isVisible(),false,'Por file://, sem formulário de login');
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#exportSave').click()]);const saved=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 assert.equal(saved.version,1);assert.equal(saved.profile.stats.wins,1);assert.ok(saved.profile.achievements.firstWin);
 await page.locator('#closeProfile').click();assert.equal(await open('titleScreen'),true,'Voltar leva ao título');
 // Outro navegador: sem nada salvo, importa o arquivo e recupera o progresso.
 await page.evaluate(()=>localStorage.clear());await page.reload();await page.evaluate(()=>terrainReady);assert.match(await page.locator('#titleProfileInfo').textContent(),/^0\/15/);
 await page.locator('#titleProfile').click();await page.getByRole('tab',{name:'Conta e save'}).click();
 await page.locator('#importSave').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":9}')});await page.waitForFunction(()=>document.querySelector('#accountStatus').textContent.includes('Arquivo inválido'));assert.match(await page.locator('#accountStatus').textContent(),/inválido/);
 await page.locator('#importSave').setInputFiles(await download.path());await page.waitForFunction(()=>profile.stats.wins===1);assert.match(await page.locator('#accountStatus').textContent(),/Save importado: 1 vitória/);
 await page.locator('#closeProfile').click();assert.match(await page.locator('#titleProfileInfo').textContent(),/^[1-9]\d*\/15/,'Título mostra o progresso importado');
 // Nuvem: offline fica pendente; ao voltar a conexão, baixa, mescla e envia.
 await page.evaluate(()=>{window.fakeStore={row:{data:{version:1,profile:{...newProfile(),achievements:{hardWin:5}},campaign:null,settings:{}}}};
  cloud.client={auth:{signOut:async()=>({})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:fakeStore.row,error:null})})}),upsert:async row=>{fakeStore.row={data:JSON.parse(JSON.stringify(row.data))};fakeStore.user=row.user_id;return {error:null};}})};
  cloud.user={id:'u1',email:'piloto@exemplo.com'};});
 await page.evaluate(()=>cloudSync());assert.equal(await page.evaluate(()=>cloud.pending),true,'Offline: pendente');
 await context.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForFunction(()=>!cloud.pending&&!cloud.busy&&cloud.at>0);
 const store=await page.evaluate(()=>fakeStore);assert.equal(store.user,'u1');assert.ok(store.row.data.profile.achievements.hardWin&&store.row.data.profile.achievements.firstWin,'Nuvem recebe a união');
 assert.equal(await page.evaluate(()=>!!profile.achievements.hardWin),true,'Conquista da nuvem chega ao navegador');assert.match(await page.locator('#titleProfileInfo').textContent(),/na nuvem/);
 assert.deepEqual(errors,[]);console.log('OK perfil: conquistas no resultado, estatísticas, histórico, exportar/importar e sincronização com a nuvem');
 await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
