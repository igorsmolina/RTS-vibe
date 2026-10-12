'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');

// Functional simulation only: normal armies, four real maps, no timing or resource measurements.
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),errors=[],requests=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(path.join(__dirname,'../public/index.html')).href);
  await page.evaluate(()=>{paused=true;started=false;});
  for(const map of ['river','desert','mountain','random'])for(const mode of ['rts','turns']){
   results.push(...await page.evaluate(({map,mode})=>{
    const checks=[],prefix=map+' '+mode;
    const check=(name,ok,detail)=>checks.push({name:prefix+' '+name,ok:!!ok,detail:detail===undefined?undefined:structuredClone(detail)});
    const scenario=(name,fn)=>{try{fn();}catch(e){check(name,false,e.message);}};
    const fresh=()=>{const g=new Game(map,'normal',175,mode);g.aiEnabled=false;return g;};
    const advance=(g,n)=>{for(let i=0;i<n;i++)g.update(STEP);};
    const nextBlue=g=>{const round=g.round;if(!g.endTurn())throw Error('endTurn rejected');for(let i=0;i<900&&(g.turn!=='blue'||g.round===round||g.busy);i++)g.update(STEP);if(g.turn!=='blue'||g.round===round||g.busy)throw Error('next blue turn did not finish');};
    const perimeter=(g,s)=>g.spawnCells(s.owner,'infantry',s).filter(p=>DIST(s,p)===1&&!g.occupied(p.x,p.y,null,false));
    const station=(g,u,s)=>{const p=perimeter(g,s)[0];if(!p)throw Error('no free perimeter');Object.assign(u,p);u.moveLeft=TYPES[u.type].move;u.actionLeft=true;g.updateVision();};
    const post=g=>g.structures.find(s=>s.type==='post'&&s.owner==='neutral'&&g.spawnCells('blue','infantry',{...s,owner:'blue'}).length)||g.structures.find(s=>s.type==='post'&&s.owner==='neutral');
    const freeAirportSite=(g,type)=>{const t=TYPES[type];for(let y=10;y<ROWS-t.height-10;y++)for(let x=10;x<COLS-t.width-10;x++){
     const box={x,y,width:t.width,height:t.height};
     if(g.structures.some(s=>DIST(box,s)<2)||g.units.some(u=>DIST(box,u)<2)||g.mines.some(m=>DIST(box,m)<2))continue;
     let valid=true;for(let yy=y;yy<y+t.height;yy++)for(let xx=x;xx<x+t.width;xx++)if(['river','mountain'].includes(g.terrain[KEY(xx,yy)]))valid=false;
     if(valid)return{x,y};
    }throw Error('no clear airport fixture site');};

    scenario('purchase and rejection',()=>{
     const g=fresh(),base=g.hq('blue'),cost=g.recruitCost('infantry',base),count=g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').length;
     g.credits.blue=cost-1;const unchanged=JSON.stringify(base.queue);
     check('insufficient funds keeps money and queue',!g.enqueue('blue','infantry',base)&&g.credits.blue===cost-1&&JSON.stringify(base.queue)===unchanged);
     check('enemy producer rejects purchase',!g.enqueue('blue','infantry',g.hq('red'))&&g.credits.blue===cost-1);
     g.credits.blue=cost;
     check('exact balance charged once',g.enqueue('blue','infantry',base)&&g.credits.blue===0&&base.queue.length===1);
     check('second purchase with no funds rejected',!g.enqueue('blue','infantry',base)&&g.credits.blue===0&&base.queue.length===1);
     const income=g.income('blue');if(mode==='rts')advance(g,300);else nextBlue(g);
     check('completion and actual income cycle',g.credits.blue===income&&base.queue.length===0&&g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').length===count+1,{credits:g.credits.blue,income,queue:base.queue.length});
     if(mode==='turns'){g.turn='red';const before=g.credits.blue;check('wrong turn rejects without debit',!g.enqueue('blue','infantry',base)&&g.credits.blue===before);}
    });

    scenario('blocked production',()=>{
     const g=fresh(),p=post(g);if(!p)throw Error('no post');g.captureStructure(p,g.units.find(u=>u.owner==='blue'&&u.type==='infantry'));g.credits.blue=1000;
     const types=['infantry','tank','infantry','recon','engineer'],money=g.credits.blue;
     check('five mixed purchases accepted',types.every(type=>g.enqueue('blue',type,p))&&p.queue.length===5);
     const paid=money-types.reduce((n,type)=>n+g.recruitCost(type,p),0);
     check('individual costs and full queue rejection',g.credits.blue===paid&&!g.enqueue('blue','infantry',p)&&g.credits.blue===paid&&p.queue.length===5);
     const cells=g.spawnCells('blue','infantry',p),blockers=[];
     for(const cell of cells)if(!g.occupied(cell.x,cell.y,null,false))blockers.push(g.add('blue','tank',cell.x,cell.y));
     if(!blockers.length)throw Error('fixture has no removable exit');
     const count=g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').length,duration=g.trainDuration('infantry');
     g.production('blue',duration);g.production('blue',duration);
     check('blocked batch remains ready and serial',p.queue.length===5&&p.queue.filter(q=>q.type==='infantry').every(q=>q.progress===duration)&&p.queue.find(q=>q.type==='tank').progress===0&&g.credits.blue===paid&&g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').length===count);
     g.units=g.units.filter(u=>u!==blockers[0]);g.production('blue',0);
     check('one opening resumes exactly one unit',p.queue.length===4&&g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').length===count+1&&g.credits.blue===paid);
     const completedBatch=p.queue.find(q=>q.type==='infantry').batch;
     check('new batch cannot inherit completed blocked batch',g.enqueue('blue','infantry',p)&&p.queue.at(-1).batch!==completedBatch&&p.queue.at(-1).progress===0);
     g.production('blue',duration);
     check('following type cannot bypass blocked first batch',p.queue.find(q=>q.type==='tank').progress===0&&g.credits.blue===paid-g.recruitCost('infantry',p),{queue:p.queue,credits:g.credits.blue,paid,cost:g.recruitCost('infantry',p)});
     g.units=g.units.filter(u=>!blockers.includes(u));g.production('blue',0);
     check('all openings drain ready batch without repeat debit',p.queue[0].type==='tank'&&p.queue[0].progress===0&&g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').length===count+2&&g.credits.blue===paid-g.recruitCost('infantry',p),{queue:p.queue,credits:g.credits.blue,count:g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').length,startCount:count});
     const tankCount=g.units.filter(u=>u.owner==='blue'&&u.type==='tank').length,tankDuration=g.trainDuration('tank');g.production('blue',tankDuration/2);
     check('next batch needs its own full duration',p.queue[0].type==='tank'&&p.queue[0].progress===tankDuration/2&&g.units.filter(u=>u.owner==='blue'&&u.type==='tank').length===tankCount&&g.credits.blue===paid-g.recruitCost('infantry',p));
     g.production('blue',tankDuration/2);
     check('next batch completes after its own duration',p.queue[0].type==='recon'&&p.queue[0].progress===0&&g.units.filter(u=>u.owner==='blue'&&u.type==='tank').length===tankCount+1&&g.credits.blue===paid-g.recruitCost('infantry',p),{queue:p.queue});
    });

    scenario('capture and destruction',()=>{
     const g=fresh(),p=post(g),inf=g.units.find(u=>u.owner==='blue'&&u.type==='infantry');if(!p)throw Error('no post');p.owner='red';g.credits.red=1000;g.turn='red';
     check('old owner pays queued units',g.enqueue('red','tank',p)&&g.enqueue('red','infantry',p));
     const redPaid=g.credits.red,blueMoney=g.credits.blue,redCount=g.units.filter(u=>u.owner==='red').length;
     g.production('red',g.trainDuration('tank')*.1);g.turn='blue';station(g,inf,p);const blueIncome=g.income('blue'),redIncome=g.income('red');
     check('capture order accepted',g.command([inf.id],'capture',{targetId:p.id})===1);advance(g,90);
     check('capture replaces owner and discards paid queue',p.owner==='blue'&&p.queue.length===0&&g.credits.red===redPaid&&g.credits.blue===blueMoney&&g.units.filter(u=>u.owner==='red').length===redCount,{owner:p.owner,queue:p.queue.length});
     check('income transfers with captured post',g.income('blue')===blueIncome+7&&g.income('red')===redIncome-7);
     const denied=g.credits.red;check('former owner cannot enqueue',!g.enqueue('red','infantry',p)&&g.credits.red===denied);
     g.credits.blue=1000;const before=g.credits.blue,count=g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').length;
     check('new owner starts fresh paid queue',g.enqueue('blue','infantry',p)&&p.queue[0].progress===0&&g.credits.blue===before-g.recruitCost('infantry',p));
     g.production('blue',g.trainDuration('infantry'));
     check('new owner production has correct ownership',g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').length===count+1&&p.queue.length===0);
     check('queue before destruction is nonempty',g.enqueue('blue','tank',p)&&p.queue.length===1);g.production('blue',g.trainDuration('tank')*.1);
     const paid=g.credits.blue,units=g.units.length;g.hurt(p,p.hp,null);g.production('blue',g.trainDuration('tank'));
     check('destroyed producer drops queue without refund or spawn',!g.get(p.id)&&p.queue.length===0&&g.credits.blue===paid&&g.units.length===units);
     check('stale producer cannot charge a purchase',!g.enqueue('blue','infantry',p)&&g.credits.blue===paid);
    });

    scenario('HQ loss and last post',()=>{
     const g=fresh(),p=post(g),hq=g.hq('blue');if(!p)throw Error('no post');g.captureStructure(p,g.units.find(u=>u.owner==='blue'&&u.type==='infantry'));g.credits.blue=1000;
     check('queues before HQ loss',g.enqueue('blue','infantry',p)&&g.enqueue('blue','tank',hq));
     const paid=g.credits.blue,count=g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').length;g.hurt(hq,hq.hp,null);g.update(STEP);
     check('HQ loss preserves post faction and its income',!g.winner&&!g.hq('blue')&&g.income('blue')===7&&hq.queue.length===0&&p.queue.length===1&&g.credits.blue===paid);
     if(mode==='rts')advance(g,299);else nextBlue(g);
     check('surviving post still produces and pays income',!g.winner&&p.queue.length===0&&g.credits.blue===paid+7&&g.units.filter(u=>u.owner==='blue'&&u.type==='infantry').length===count+1);
     const location=freeAirportSite(g,'airportDirt'),airport=g.add('blue','airportDirt',location.x,location.y);g.credits.blue=2000;g.enqueue('blue','fighterBlue',airport);g.enqueue('blue','tank',p);
     g.hurt(p,p.hp,null);g.update(STEP);const frozen=JSON.stringify({credits:g.credits,time:g.time,queue:airport.queue,units:g.units.length});advance(g,300);
     check('last post loss ends despite airport and queue',g.winner==='red'&&g.income('blue')===0&&g.producer('blue',airport)&&JSON.stringify({credits:g.credits,time:g.time,queue:airport.queue,units:g.units.length})===frozen);
     const terminalMoney=g.credits.blue;check('terminal purchase rejected without charge',!g.enqueue('blue','fighterBlue',airport)&&g.credits.blue===terminalMoney);
    });

    scenario('commander loss',()=>{
     const g=fresh(),commander=g.units.find(u=>u.owner==='blue'&&u.type==='commander'),attacker=g.units.find(u=>u.owner==='red'&&u.type==='infantry');g.credits.blue=101;const redMoney=g.credits.red;
     g.hurt(commander,commander.hp,attacker);g.hurt(commander,commander.maxHp,attacker);
     check('commander halves odd balance only once',g.credits.blue===50&&!g.get(commander.id)&&g.stats.blue.losses.commander===1);
     check('kill reward and stats occur only once',g.credits.red===redMoney+TYPES.commander.reward&&g.stats.red.kills.commander===1);
    });

    scenario('repair economics',()=>{
     const g=fresh(),hq=g.hq('blue'),engineer=g.units.find(u=>u.owner==='blue'&&u.type==='engineer');station(g,engineer,hq);hq.hp=hq.maxHp-30;const before=g.credits.blue;
     check('repair command accepted',g.command([engineer.id],'repair',{targetId:hq.id})===1);advance(g,90);
     check('repair heals within max HP without debit',hq.hp===(mode==='rts'?hq.maxHp:hq.maxHp-6)&&g.credits.blue===before&&!engineer.pending);
     if(mode==='turns'){check('repair cannot consume a second turn action',g.command([engineer.id],'repair',{targetId:hq.id})===0&&hq.hp===hq.maxHp-6);nextBlue(g);const money=g.credits.blue;check('next turn repair accepted',g.command([engineer.id],'repair',{targetId:hq.id})===1);advance(g,90);check('last repair clamps HP without debit',hq.hp===hq.maxHp&&g.credits.blue===money);}
     check('full health repair rejects',g.command([engineer.id],'repair',{targetId:hq.id})===0);
    });

    for(const type of ['airportDirt','airportAsphalt'])scenario(type+' capacity and ownership',()=>{
     const g=fresh(),location=freeAirportSite(g,type),base=g.add('blue',type,location.x,location.y),cost=g.recruitCost('fighterBlue',base);g.credits.blue=10000;
     check(type+' correct aircraft price',cost===(type==='airportAsphalt'?Math.round(TYPES.fighterBlue.cost*.8):TYPES.fighterBlue.cost));
     check(type+' five aircraft charged once',Array.from({length:5},()=>g.enqueue('blue','fighterBlue',base)).every(Boolean)&&g.credits.blue===10000-5*cost);
     const paid=g.credits.blue;g.production('blue',g.trainDuration('fighterBlue'));
     check(type+' four docks retain fifth ready',g.docked(base).length===4&&base.queue.length===1&&base.queue[0].progress===g.trainDuration('fighterBlue')&&g.credits.blue===paid);
     const departing=g.docked(base)[0];check(type+' takeoff accepted',g.command([departing.id],'takeoff')===1);advance(g,135);g.production('blue',0);
     check(type+' takeoff frees capacity and resumes queue',AIR(departing)&&g.docked(base).length===4&&base.queue.length===0&&g.credits.blue===paid);
     if(mode==='turns')check(type+' busy takeoff rejects purchase without debit',g.busy&&!g.enqueue('blue','fighterBlue',base)&&g.credits.blue===paid&&base.queue.length===0);
     for(let i=0;i<900&&departing.pending;i++)g.update(STEP);
     check(type+' takeoff action completes before next purchase',AIR(departing)&&!departing.pending&&(mode==='rts'||!g.busy));
     check(type+' queued aircraft before capture',g.enqueue('blue','fighterBlue',base),{busy:g.busy,queue:base.queue});const bluePaid=g.credits.blue,enemy=g.units.find(u=>u.owner==='red'&&u.type==='infantry'),ground=g.docked(base).map(u=>u.id);
     g.captureStructure(base,enemy);g.production('blue',g.trainDuration('fighterBlue'));
     check(type+' capture discards queue and grounded aircraft',base.owner==='red'&&base.queue.length===0&&ground.every(id=>!g.get(id))&&g.get(departing.id)===departing&&g.credits.blue===bluePaid);
     g.turn='red';const redCost=g.recruitCost('fighterRed',base);g.credits.red=redCost;
     check(type+' new owner aircraft purchase uses its catalog',!g.enqueue('red','fighterBlue',base)&&g.enqueue('red','fighterRed',base)&&g.credits.red===0&&base.queue.length===1);
     g.hurt(base,base.hp,null);g.production('red',g.trainDuration('fighterRed'));
     check(type+' destruction cancels new owner queue',!g.get(base.id)&&base.queue.length===0&&g.credits.red===0&&!g.units.some(u=>u.owner==='red'&&u.airportId===base.id));
    });
    return checks;
   },{map,mode}));
  }
  const failures=results.filter(r=>!r.ok);for(const failure of failures)console.error(JSON.stringify(failure));
  assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('OK '+results.length+' functional economy checks: four maps, RTS/turns, purchase rejections, paid batches, blocked exits, ownership, HQ/commander loss, repair and airport capacity.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
