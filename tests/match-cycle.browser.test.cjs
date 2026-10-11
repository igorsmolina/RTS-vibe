'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');

// Integração funcional, com exércitos normais. Nenhuma medição de desempenho.
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.context().setOffline(true);await page.goto(pathToFileURL(path.join(__dirname,'../public/index.html')).href);
  const results=await page.evaluate(()=>{
   paused=true;started=false;
   const checks=[],check=(name,ok,detail)=>checks.push({name,ok:!!ok,detail}),advance=(g,n)=>{for(let i=0;i<n;i++)g.update(STEP);},idle=g=>{for(let i=0;i<900&&g.busy;i++)g.update(STEP);};
   const perimeter=(g,s)=>{const cells=[];for(let y=s.y-1;y<=s.y+s.height;y++)for(let x=s.x-1;x<=s.x+s.width;x++)if(INSIDE(x,y)&&DIST(s,{x,y})===1&&!g.structureAt(x,y)&&!g.occupied(x,y,null,false)&&Number.isFinite(g.cost({type:'engineer'},x,y)))cells.push({x,y});return cells;};
   for(const map of Object.keys(MAPS))for(const mode of ['rts','turns']){
    const label=map+' '+mode,g=new Game(map,'normal',172,mode);g.aiEnabled=false;
    const occupied=new Set();let valid=true;
    for(const s of g.structures)for(let y=s.y;y<s.y+(s.height||1);y++)for(let x=s.x;x<s.x+(s.width||1);x++){const k=KEY(x,y);if(!INSIDE(x,y)||occupied.has(k)||['river','mountain'].includes(g.terrain[k]))valid=false;occupied.add(k);}
    check(label+' início',valid&&g.units.every(u=>AIR(u)||!g.structureAt(u.x,u.y)&&Number.isFinite(g.cost(u,u.x,u.y)))&&armyCost(g.initialArmies.blue)<=STARTING_BUDGET&&armyCost(g.initialArmies.red)<=STARTING_BUDGET);
    const base=g.hq('blue'),before=g.credits.blue,count=g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').length,cost=g.recruitCost('infantry',base),income=g.income('blue');
    check(label+' compra',g.enqueue('blue','infantry',base)&&g.credits.blue===before-cost);
    if(mode==='rts')advance(g,300);else{g.endTurn();for(let i=0;i<900&&(g.turn!=='blue'||g.round===1||g.busy);i++)g.update(STEP);}
    check(label+' renda e produção',g.credits.blue===before-cost+income&&g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').length===count+1&&!base.queue.length,{credits:g.credits.blue,expected:before-cost+income,queue:base.queue.length});
    const movable=g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').map(u=>({u,goal:DIRS.map(([dx,dy])=>({x:u.x+dx,y:u.y+dy})).find(p=>INSIDE(p.x,p.y)&&!g.structureAt(p.x,p.y)&&!g.occupied(p.x,p.y,u)&&Number.isFinite(g.cost(u,p.x,p.y)))})).find(v=>v.goal),recruit=movable.u,goal=movable.goal;
    check(label+' ordem de movimento',goal&&g.command([recruit.id],'move',goal)===1);advance(g,180);check(label+' movimento concluído',goal&&DIST(recruit,goal)===0&&!recruit.pending);
    const post=g.structures.find(s=>s.type==='post'&&s.owner==='neutral'),cell=perimeter(g,post)[0];Object.assign(recruit,cell);recruit.moveLeft=TYPES.infantry.move;recruit.actionLeft=true;g.updateVision();
    const oldIncome=g.income('blue');check(label+' ordem de captura',g.command([recruit.id],'capture',{targetId:post.id})===1);advance(g,90);
    check(label+' captura e renda',post.owner==='blue'&&post.queue.length===0&&g.income('blue')===oldIncome+8);
    const engineer=g.units.find(u=>u.owner==='blue'&&u.type==='engineer');Object.assign(engineer,perimeter(g,post)[0]);engineer.actionLeft=true;engineer.moveLeft=TYPES.engineer.move;post.hp-=30;const damaged=post.hp;g.updateVision();
    check(label+' ordem de reparo',g.command([engineer.id],'repair',{targetId:post.id})===1);advance(g,90);check(label+' reparo',post.hp>damaged&&post.hp<=post.maxHp);
    const x=60,y=46;for(let yy=y-2;yy<=y+2;yy++)for(let xx=x-2;xx<=x+4;xx++)g.terrain[KEY(xx,yy)]='plain';
    const gunner=g.add('blue','tank',x,y),enemy=g.add('red','lightTank',x+2,y);g.rng=()=>.5;g.updateVision();check(label+' ordem de combate',g.command([gunner.id],'attack',{targetId:enemy.id})===1);advance(g,90);check(label+' projétil e dano',g.shotsFired>0&&enemy.hp<enemy.maxHp);
    for(const s of [...g.structures])if(s.owner==='red')g.hurt(s,s.hp,gunner);g.update(STEP);check(label+' vitória',g.winner==='blue');const frozen=[g.time,g.credits.blue,g.credits.red];advance(g,60);check(label+' partida encerrada',JSON.stringify(frozen)===JSON.stringify([g.time,g.credits.blue,g.credits.red]));
    // Perder o QG não encerra uma equipe que ainda tem posto; a IA deve continuar.
    const f=new Game(map,'normal',173,mode);f.units=[];f.structures=[];f.mines=[];f.terrain.fill('plain');f.memory.blue.clear();f.memory.red.clear();f.add('blue','hq',10,10);const redHQ=f.add('red','hq',100,80),redPost=f.add('red','post',90,80),red=f.add('red','infantry',93,80),blue=f.add('blue','infantry',94,80);f.hurt(redHQ,redHQ.hp,blue);f.turn='red';f.credits.red=1000;f.updateVision();f.planAI();f.aiBuy();f.aiAct(red);f.checkVictory();
    check(label+' IA sem QG',!f.winner&&!!f.plan.rally&&redPost.queue.length>0&&red.order.type==='attack',{winner:f.winner,rally:f.plan.rally,queue:redPost.queue.length,order:red.order.type});
    const a=new Game(map,'normal',173,mode);a.units=[];a.structures=[];a.mines=[];a.terrain.fill('plain');a.add('blue','hq',10,10);a.add('red','post',90,80);const airport=a.add('neutral','airportAsphalt',100,65),capturer=a.add('red','infantry',99,65);a.turn='red';a.updateVision();
    check(label+' IA mantém plano de aeroporto sem QG',a.aiAirportPlan()&&capturer.order.type==='capture'&&capturer.order.targetId===airport.id);a.aiEnabled=false;advance(a,90);check(label+' IA captura aeroporto após perder QG',airport.owner==='red');
    f.hurt(redPost,redPost.hp,blue);f.update(STEP);check(label+' última base',f.winner==='blue');
    const d=new Game(map,'normal',174,mode);for(const s of [...d.structures])if(s.owner==='blue'||s.owner==='red')d.hurt(s,s.hp,null);d.update(STEP);check(label+' empate',d.winner==='draw');
    const loss=new Game(map,'normal',175,mode);for(const s of [...loss.structures])if(s.owner==='blue')loss.hurt(s,s.hp,null);loss.update(STEP);check(label+' derrota',loss.winner==='red');
   }
   newOperation('river','normal',172,'rts');paused=true;const first=game;game.winner='blue';updateUI();newOperation('desert','normal',173,'turns');paused=true;
   check('reinício pela interface',game!==first&&!game.winner&&game.round===1&&game.turn==='blue'&&!$('result').open&&selection.size===0);
   return checks;
  });
  const failures=results.filter(r=>!r.ok);for(const f of failures)console.error(JSON.stringify(f));assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('OK ciclo completo nos quatro mapas, RTS/turnos, IA após perda do QG, economia, produção, movimento, combate, captura, reparo e resultados.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
