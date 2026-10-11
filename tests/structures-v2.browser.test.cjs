'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.context().setOffline(true);await page.goto(pathToFileURL(path.join(__dirname,'../public/index.html')).href);await page.evaluate(()=>terrainReady);
  const generated=await page.evaluate(()=>Object.keys(MAPS).flatMap(map=>['rts','turns'].flatMap(mode=>[172,23].map(seed=>{
   const g=new Game(map,'normal',seed,mode,{}, {},{blue:{infantry:12},red:{infantry:12}}),hq=g.hq('blue'),posts=g.structures.filter(s=>s.type==='post');
   const occupied=new Set(),overlap=[],invalid=[];
   for(const s of g.structures)for(let y=s.y;y<s.y+(s.height||1);y++)for(let x=s.x;x<s.x+(s.width||1);x++){
    const k=KEY(x,y);if(occupied.has(k))overlap.push(k);occupied.add(k);
    if(!INSIDE(x,y)||['river','mountain'].includes(g.terrain[k]))invalid.push({type:s.type,x,y});
   }
   const roads=g.structures.filter(s=>s.type==='hq'||s.type==='post').every(s=>{
    for(let y=s.y-1;y<=s.y+s.height;y++)for(let x=s.x-1;x<=s.x+s.width;x++)if(INSIDE(x,y)&&DIST(s,{x,y})===1&&['road','bridge'].includes(g.terrain[KEY(x,y)]))return true;
    return false;
   });
   return {map,mode,seed,hq:{width:hq.width,height:hq.height},posts:posts.map(s=>({width:s.width,height:s.height})),overlap,invalid,roads,initialInfantry:['blue','red'].map(owner=>g.units.filter(u=>u.owner===owner&&u.type==='infantry').length),
    symmetric:g.structures.every(s=>g.structures.some(t=>t.type===s.type&&t.x===COLS-s.x-(s.width||1)&&t.y===ROWS-s.y-(s.height||1))),
    deployment:g.units.every(u=>AIR(u)||!g.structureAt(u.x,u.y)&&!['river','mountain'].includes(g.terrain[KEY(u.x,u.y)]))};
  }))));
  for(const g of generated){const label=g.map+' '+g.mode+' '+g.seed;assert.deepEqual(g.hq,{width:3,height:3},label+' QG ocupa 3 × 3');assert.equal(g.posts.length,24,label+' quantidade de postos preservada');g.posts.forEach(s=>assert.deepEqual(s,{width:2,height:2}));assert.deepEqual(g.initialInfantry,[12,12],label+' implantação usa todo o orçamento normal');assert.deepEqual(g.overlap,[],label+' sem sobreposição');assert.deepEqual(g.invalid,[],label+' terreno e limites');assert.ok(g.symmetric,label+' simetria dos retângulos');assert.ok(g.deployment,label+' tropas iniciais fora das construções');assert.ok(g.roads,label+' estradas chegam ao perímetro');}
  const flows=await page.evaluate(()=>{
   const result=[];
   const fixture=mode=>{const g=new Game('river','normal',173,mode,{posts:2});g.aiEnabled=false;g.units=[];g.structures=[];g.mines=[];g.memory.blue.clear();g.projectiles=[];g.terrain.fill('plain');g.add('blue','hq',4,4);g.add('red','hq',100,80);return g;};
   const advance=(g,n=120)=>{for(let i=0;i<n;i++)g.update(STEP);};
   for(const mode of ['rts','turns']){
    // Recrutamento só tem passagem pela borda inferior/direita de cada retângulo.
    for(const type of ['hq','post']){
     const g=fixture(mode),base=type==='hq'?g.hq('blue'):g.add('blue','post',20,20),right={x:base.x+base.width,y:base.y+base.height-1},cells=g.spawnCells('blue','infantry',base);
     const sides=[cells.some(c=>c.x<base.x),cells.some(c=>c.x>=base.x+base.width),cells.some(c=>c.y<base.y),cells.some(c=>c.y>=base.y+base.height)];
     for(const p of cells)g.terrain[KEY(p.x,p.y)]='river';g.terrain[KEY(right.x,right.y)]='plain';g.credits.blue=1000;
     const accepted=g.enqueue('blue','infantry',base),debit=g.credits.blue;
     if(mode==='rts')advance(g,330);else g.beginTurn('blue');
     const unit=g.units.find(u=>u.type==='infantry'&&u.owner==='blue');result.push({kind:'recruit',mode,type,sides,accepted,debit,unit:unit&&TILE(unit),right,queue:base.queue.length});
    }
    // Captura adjacente ao canto oposto à âncora, seguida de reparo no mesmo lado.
    {
     const g=fixture(mode),post=g.add('neutral','post',20,20),inf=g.add('blue','infantry',22,21);g.updateVision();
     const accepted=g.order(inf,'capture',{targetId:post.id});advance(g);
     const captured=post.owner==='blue',memory=[...g.memory.blue.values()].find(s=>s.id===post.id);
     if(mode==='turns')g.beginTurn('blue');g.units=g.units.filter(u=>u!==inf);post.hp=post.maxHp-24;const engineer=g.add('blue','engineer',21,22),repair=g.order(engineer,'repair',{targetId:post.id});advance(g,80);
     result.push({kind:'captureRepair',mode,accepted,captured,repair,hp:post.hp,max:post.maxHp,memory:memory&&{width:memory.width,height:memory.height}});
    }
    // Caminho contorna o QG inteiro. A ordem nunca atravessa uma das nove casas.
    {
     const g=fixture(mode),base=g.add('blue','hq',20,20),u=g.add('blue','tank',19,21),goal={x:23,y:21},path=g.findPath(u,goal,true),crossed=[];
     for(let round=0;round<4&&DIST(u,goal)>0;round++){
      if(mode==='turns')g.beginTurn('blue');g.order(u,'move',goal);
      for(let i=0;i<180;i++){g.update(STEP);if(g.structureAt(Math.round(u.x),Math.round(u.y))===base)crossed.push(TILE(u));}
     }
     result.push({kind:'move',mode,path:path&&path.every(p=>g.structureAt(p.x,p.y)!==base),crossed,arrived:DIST(u,goal)===0});
    }
    // Um canhão a três casas da borda alcança o QG; dano e destruição seguem as regras atuais.
    {
     const g=fixture(mode),hq=g.structures.find(s=>s.owner==='red');hq.x=20;hq.y=20;const tank=g.add('blue','tank',25,21);g.rng=()=>0;g.updateVision();
     const accepted=g.order(tank,'attack',{targetId:hq.id});advance(g,65);const damaged=hq.hp<hq.maxHp;
     if(mode==='rts')g.order(tank,'stop');g.hurt(hq,hq.hp,tank);g.checkVictory();result.push({kind:'attack',mode,accepted,damaged,removed:!g.get(hq.id),winner:g.winner});
    }
    // Construção de posto exige terreno livre nas quatro casas, sem alterar o custo.
    {
     const g=fixture(mode),inf=g.add('blue','infantry',30,30);g.credits.blue=1000;g.terrain[KEY(31,31)]='river';const blocked=!g.order(inf,'build');g.terrain[KEY(31,31)]='plain';const accepted=g.order(inf,'build'),debit=g.credits.blue;advance(g,120);const post=g.structureAt(31,31);
     result.push({kind:'build',mode,blocked,accepted,debit,post:post&&{type:post.type,width:post.width,height:post.height},converted:!g.get(inf.id)});
    }
    // Revele apenas a última casa do posto destruído: o objetivo lembrado deve desaparecer.
    {
     const g=fixture(mode),post=g.add('red','post',30,30),inf=g.add('blue','infantry',35,31);g.updateVision();
     const anchor=g.visible.blue[KEY(30,30)],edge=g.visible.blue[KEY(31,31)],accepted=g.order(inf,'capture',{targetId:post.id});g.hurt(post,post.hp);
     const knownBeforeRefresh=g.knownObjective('blue',post.id,{x:30,y:30,width:2,height:2})===null;g.updateVision();
     const forgotten=![...g.memory.blue.values()].some(s=>s.id===post.id),target=g.captureTarget(inf);
     result.push({kind:'memory',mode,anchor,edge,accepted,knownBeforeRefresh,forgotten,cancelled:target===null&&!inf.captureIntent});
    }
    // Visão de estruturas espelhadas parte do centro, com alcance 5/8 preservado.
    {
     const g=fixture(mode);g.structures=[];const hq=g.add('blue','hq',1,92);g.add('red','hq',124,1);const post=g.add('blue','post',30,30);g.add('red','post',96,64);g.updateVision();
     result.push({kind:'vision',mode,symmetric:g.visible.blue.every((v,i)=>v===g.visible.red[KEY(COLS-1-i%COLS,ROWS-1-Math.floor(i/COLS))]),radii:[g.sight(hq),g.sight(post)],hqEdge:g.visible.blue[KEY(7,93)],postEdge:g.visible.blue[KEY(31,38)]});
    }
    // Projéteis reais atingem uma casa distante da âncora do QG 3×3.
    for(const weapon of ['artillery','rocket']){
     const g=fixture(mode),hq=g.structures.find(s=>s.owner==='red');hq.x=20;hq.y=20;const source=g.add('blue',weapon==='rocket'?'rocketArtillery':'artillery',22,24),corner={x:22,y:22};g.rng=()=>.5;
     if(weapon==='rocket')g.launch(source,corner);else g.shoot(source,{...hq,...corner,width:1,height:1});source.cooldown=100;
     advance(g,70);result.push({kind:'area',mode,weapon,damage:hq.maxHp-hq.hp,expected:weapon==='rocket'?40:TYPES.artillery.damage});
    }
   }return result;
  });
  console.log('Integração de bordas: '+JSON.stringify(flows.filter(f=>['memory','vision','area'].includes(f.kind))));
  for(const f of flows){const label=f.mode+' '+f.kind;if(f.kind==='recruit'){assert.ok(f.sides.every(Boolean),label+' perímetro completo');assert.ok(f.accepted);assert.equal(f.debit,950);assert.deepEqual(f.unit,f.right,label+' produz pela face direita');assert.equal(f.queue,0);}else if(f.kind==='captureRepair'){assert.ok(f.accepted&&f.captured&&f.repair,label);assert.equal(f.hp,f.max);assert.deepEqual(f.memory,{width:2,height:2});}else if(f.kind==='move'){assert.ok(f.path&&f.arrived,label);assert.deepEqual(f.crossed,[]);}else if(f.kind==='attack'){assert.ok(f.accepted&&f.damaged&&f.removed,label);assert.equal(f.winner,'blue');}else if(f.kind==='build'){assert.ok(f.blocked&&f.accepted&&f.converted,label);assert.equal(f.debit,940);assert.deepEqual(f.post,{type:'post',width:2,height:2});}else if(f.kind==='memory'){assert.equal(f.anchor,false);assert.equal(f.edge,true);assert.ok(f.accepted&&f.knownBeforeRefresh&&f.forgotten&&f.cancelled,label+' objetivo destruído ao revelar só a borda');}else if(f.kind==='vision'){assert.ok(f.symmetric&&f.hqEdge&&f.postEdge,label+' visão espelhada e centralizada');assert.deepEqual(f.radii,[5,8]);}else if(f.kind==='area'){assert.equal(f.damage,f.expected,label+' '+f.weapon+' atinge canto oposto à âncora');}}
  await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();newOperation('river','normal',172,'rts',{posts:2});paused=true;game.aiEnabled=false;game.units=[];game.structures=[];game.mines=[];game.terrain.fill('plain');game.add('blue','hq',20,20);game.add('blue','post',25,20);game.add('red','hq',100,80);game.updateVision();game.visible.blue.fill(true);game.explored.blue.fill(true);renderer.rebuild();cam.zoom=1;centerCamera(23,22);});
  const selectionCells=await page.evaluate(()=>game.structures.filter(s=>s.owner==='blue').flatMap(s=>Array.from({length:s.width*s.height},(_,i)=>({id:s.id,x:s.x+i%s.width,y:s.y+Math.floor(i/s.width)}))));
  for(const cell of selectionCells){const p=await page.evaluate(cell=>{const r=renderer.canvas.getBoundingClientRect();return {x:r.left+((cell.x+.5)*CELL-cam.x)*cam.zoom,y:r.top+((cell.y+.5)*CELL-cam.y)*cam.zoom};},cell);await page.mouse.click(p.x,p.y);assert.equal(await page.evaluate(()=>[...selection][0]),cell.id,'seleção por qualquer casa ocupada');}
  const mini=await page.evaluate(()=>{const calls=[],c=renderer.mini,fill=c.fillRect;c.fillRect=function(...args){calls.push(args);return fill.apply(this,args);};try{renderer.drawMini();}finally{c.fillRect=fill;}const s=miniTransform(c.canvas).s;return {hq:calls.some(a=>a[2]===3*s&&a[3]===3*s),post:calls.some(a=>a[2]===2*s&&a[3]===2*s)};});assert.deepEqual(mini,{hq:true,post:true});
  await page.locator('#hqButton').click();assert.equal(await page.evaluate(()=>[...selection][0]),await page.evaluate(()=>game.hq('blue').id));
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('OK integração: retângulos, geração simétrica, estradas, implantação, perímetro, recrutamento, captura/reparo, movimento, combate, construção, seleção, minimapa e file:// nos dois modos.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
