// Mapa-múndi e regras da campanha (public/js/world.js) no motor real, sem navegador: node tests/world.test.cjs
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console}),load=f=>fs.readFileSync(path.join(__dirname,'..','public','js',f),'utf8');
vm.runInContext(load('engine.js')+'\n'+load('world.js')+'\nObject.assign(this,{Game,MAPS,BIOMES,generateWorld,newCampaign,canAttack,battleFor,applyResult,campaignOver,serializeCampaign,deserializeCampaign});',ctx);
const {Game,MAPS,BIOMES,generateWorld,newCampaign,canAttack,battleFor,applyResult,campaignOver,serializeCampaign,deserializeCampaign}=ctx;
let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
const hopsFrom=(w,start)=>{const hops=new Array(w.regions.length).fill(Infinity),queue=[start];hops[start]=0;while(queue.length){const c=queue.shift();for(const n of w.regions[c].neighbors)if(hops[n]===Infinity){hops[n]=hops[c]+1;queue.push(n);}}return hops;};
const seeds=Array.from({length:25},(_,i)=>i*7919+3);

check('Mundo determinístico por semente; sementes diferentes geram mundos diferentes',()=>{
 const shape=w=>JSON.stringify({regions:w.regions,lanes:w.lanes,homes:w.homes,cells:Array.from(w.cells)});
 assert.equal(shape(generateWorld(42)),shape(generateWorld(42)));assert.notEqual(shape(generateWorld(42)),shape(generateWorld(43)));
});
check('25 sementes: oceano em volta, 35–70% de terra, ≥ 14 regiões, grafo conexo e simétrico, QGs distantes',()=>{
 for(const seed of seeds){const w=generateWorld(seed),landCells=Array.from(w.cells).filter(id=>id>=0).length/w.cells.length;
  assert.ok(landCells>.3&&landCells<.7,seed+': terra '+landCells.toFixed(2));assert.ok(w.regions.length>=14,seed+': regiões '+w.regions.length);
  for(let x=0;x<w.w;x++)assert.ok(w.cells[x]<0&&w.cells[(w.h-1)*w.w+x]<0,seed+': borda norte/sul é oceano');
  for(const r of w.regions){assert.ok(w.land(r.x,r.y));assert.ok(BIOMES[r.biome],r.biome);for(const n of r.neighbors)assert.ok(w.regions[n].neighbors.includes(r.id),'Vizinhança simétrica');}
  const hops=hopsFrom(w,w.homes.blue);assert.ok(hops.every(Number.isFinite),seed+': grafo conexo');assert.notEqual(w.homes.blue,w.homes.red);assert.ok(hops[w.homes.red]>=3,seed+': QGs a '+hops[w.homes.red]+' saltos');
  assert.equal(new Set(w.regions.map(r=>r.name)).size,w.regions.length,'Nomes únicos');}
});
check('Biomas variados e cada um vira uma batalha válida (mapa, opções, semente)',()=>{
 const seen=new Set();for(const seed of seeds)for(const r of generateWorld(seed).regions)seen.add(r.biome);assert.ok(seen.size>=4,[...seen].join());
 const c=newCampaign(77);for(const r of c.world.regions){const b=battleFor(c,r.id);assert.ok(MAPS[b.map],b.map);assert.ok(b.seed>0);assert.match(b.title,new RegExp(r.name));const g=new Game(b.map,b.difficulty,b.seed,b.mode,b.options);assert.equal(g.map,b.map);}
 const red=c.world.homes.red;assert.equal(battleFor(c,red).difficulty,'hard','Território vermelho é um nível mais difícil');assert.equal(battleFor(c,c.world.regions.find(r=>c.owners[r.id]==='neutral').id).difficulty,'normal');
});
check('Campanha: começa com um QG por lado; só ataca vizinhas do território azul',()=>{
 const c=newCampaign(2024),w=c.world;assert.equal(c.owners.filter(o=>o==='blue').length,1);assert.equal(c.owners.filter(o=>o==='red').length,1);
 for(const r of w.regions)assert.equal(canAttack(c,r.id),c.owners[r.id]!=='blue'&&r.neighbors.some(n=>c.owners[n]==='blue'),r.name);
 assert.equal(canAttack(c,w.homes.blue),false);assert.ok(w.regions.some(r=>canAttack(c,r.id)));
});
check('Resultado: vitória conquista; derrota permite contra-ataque; o inimigo avança sobre neutras; fim de campanha',()=>{
 const c=newCampaign(2024),w=c.world,target=w.regions.find(r=>canAttack(c,r.id)).id,redBefore=c.owners.filter(o=>o==='red').length;
 const ev=applyResult(c,target,true);assert.equal(c.owners[target],'blue');assert.equal(c.battles,1);assert.match(ev[0],/conquistada/);assert.ok(c.owners.filter(o=>o==='red').length>=redBefore,'Inimigo também avança');
 // Derrota com território azul encostado no vermelho: o vermelho toma uma região azul que não é o QG.
 const d=newCampaign(2024),front=d.world.regions.find(r=>r.id!==d.world.homes.blue&&r.id!==d.world.homes.red&&r.neighbors.includes(d.world.homes.red));
 if(front){d.owners[front.id]='blue';applyResult(d,d.world.homes.red===front.id?front.id:d.world.regions.find(r=>canAttack(d,r.id)).id,false);assert.equal(d.owners[front.id],'red','Contra-ataque toma a frente azul');assert.equal(d.owners[d.world.homes.blue],'blue','QG azul preservado enquanto há outra região');}
 const win=newCampaign(5);win.owners[win.world.homes.red]='blue';assert.equal(campaignOver(win),'blue');assert.equal(canAttack(win,win.world.regions.find(r=>win.owners[r.id]!=='blue').id),false);
 const lose=newCampaign(5);lose.owners[lose.world.homes.blue]='red';assert.equal(campaignOver(lose),'red');
});
check('Salvar e carregar: ida e volta fiel; texto inválido ou incompatível é recusado',()=>{
 const c=newCampaign(31337,'hard','rts'),t=c.world.regions.find(r=>canAttack(c,r.id)).id;c.current=t;applyResult(c,t,true);c.current=t;
 const back=deserializeCampaign(serializeCampaign(c));assert.equal(JSON.stringify(back.owners),JSON.stringify(c.owners));assert.equal(back.battles,1);assert.equal(back.difficulty,'hard');assert.equal(back.mode,'rts');assert.equal(back.current,t);assert.equal(JSON.stringify(back.events),JSON.stringify(c.events));
 for(const bad of ['','{','null','{"version":2}',JSON.stringify({version:1,seed:31337,owners:['blue']})])assert.equal(deserializeCampaign(bad),null,bad);
});
console.log(checks+' verificações do mapa-múndi concluídas.');
