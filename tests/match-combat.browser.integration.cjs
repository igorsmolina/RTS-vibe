'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');

// Offline functional checks on generated maps and normal armies; no resource measurements.
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),errors=[],requests=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.context().setOffline(true);await page.goto(pathToFileURL(path.join(__dirname,'../public/index.html')).href);
  await page.evaluate(()=>{paused=true;started=false;});
  for(const map of ['river','desert','mountain','random'])for(const mode of ['rts','turns']){
   results.push(...await page.evaluate(({map,mode})=>{
    const checks=[],prefix=map+' '+mode,check=(name,ok,detail)=>checks.push({name:prefix+' '+name,ok:!!ok,detail});
    const scenario=(name,fn)=>{try{fn();}catch(e){check(name,false,e.message);}};
    const fresh=()=>{const g=new Game(map,'normal',176,mode);g.aiEnabled=false;g.rng=()=>.25;return g;};
    const advance=(g,n)=>{for(let i=0;i<n;i++)g.update(STEP);};
    // Only the local test rectangle is cleared; generated terrain, bases and armies remain.
    const patch=g=>{for(let y=15;y<ROWS-20;y++)for(let x=15;x<COLS-45;x++){
     const box={x,y,width:12,height:8};if(g.all().some(u=>DIST(box,u)<3)||g.mines.some(m=>DIST(box,m)<3))continue;
     for(let yy=y;yy<y+8;yy++)for(let xx=x;xx<x+12;xx++)g.terrain[KEY(xx,yy)]='plain';return{x,y};
    }throw Error('no local test rectangle');};
    const perimeter=(g,s,d=1)=>{const cells=[];for(let y=s.y-d;y<s.y+(s.height||1)+d;y++)for(let x=s.x-d;x<s.x+(s.width||1)+d;x++)if(INSIDE(x,y)&&DIST(s,{x,y})===d&&!g.structureAt(x,y)&&!g.occupied(x,y,null,false)&&Number.isFinite(g.cost({type:'engineer'},x,y))&&!g.mines.some(m=>m.x===x&&m.y===y))cells.push({x,y});return cells;};
    const state=u=>JSON.stringify({x:u.x,y:u.y,moveLeft:u.moveLeft,actionLeft:u.actionLeft,pending:u.pending,order:u.order,path:u.path,job:u.job,airportSiteId:u.airportSiteId});

    scenario('ground terrain and structures',()=>{
     const g=fresh(),{x,y}=patch(g),u=g.add('blue','tank',x+2,y+3),goal={x:x+4,y:y+3};g.terrain[KEY(x+3,y+3)]='river';g.updateVision();
     const before=state(u);check('river destination rejects without changing unit',g.command([u.id],'move',{x:x+3,y:y+3})===0&&state(u)===before);
     const route=g.findPath(u,goal,true);check('ground route detours around river',route?.length===4&&route.every(p=>g.terrain[KEY(p.x,p.y)]!=='river'));
     check('detour command accepted',g.command([u.id],'move',goal)===1);advance(g,180);
     check('detour reaches goal without crossing blocked terrain',DIST(u,goal)===0&&!u.pending&&!u.segment,{x:u.x,y:u.y,pending:u.pending});
     g.terrain[KEY(x+5,y+3)]='mountain';const mountainBefore=state(u);check('tank rejects mountain',g.command([u.id],'move',{x:x+5,y:y+3})===0&&state(u)===mountainBefore);
     const inf=g.add('blue','infantry',x+5,y+2);check('infantry can traverse mountain',g.command([inf.id],'move',{x:x+5,y:y+3})===1);advance(g,60);check('infantry reaches mountain',inf.x===x+5&&inf.y===y+3&&!inf.pending);
     const s=g.add('blue','post',x+7,y+3),structureBefore=state(u);g.updateVision();
     check('structure interior rejects movement',g.command([u.id],'move',{x:s.x,y:s.y})===0&&state(u)===structureBefore);
     const around=g.findPath(u,{x:x+10,y:y+3},true);check('path respects whole structure footprint',!!around&&around.every(p=>!g.structureAt(p.x,p.y)&&Number.isFinite(g.cost(u,p.x,p.y))));
    });

    for(const armor of ['tank','heavyTank'])scenario(armor+' immunity',()=>{
     const g=fresh(),{x,y}=patch(g),target=g.add('red',armor,x+5,y+3),immune=['infantry','machinegun','recon','missileInfantry','engineer','commander'];
     const attackers=immune.map((type,i)=>g.add('blue',type,x+2+i%3,y+1+Math.floor(i/3)));target.cooldown=10;g.updateVision();
     for(const u of attackers){const before=state(u);check(armor+' rejects '+u.type,g.weapon(u,target)===null&&!g.canFire(u,target)&&g.command([u.id],'attack',{targetId:target.id})===0&&state(u)===before);}
     const hp=target.hp;advance(g,12);check(armor+' takes no damage from immune weapons',target.hp===hp&&!g.projectiles.some(p=>p.targetId===target.id));
     const h=g.add('blue','helicopterGround',x+8,y+3);g.setWeapon(h,'gun');check(armor+' accepts helicopter cannon',g.weapon(h,target)==='gun');g.setWeapon(h,'agm');check(armor+' accepts ground missile',g.weapon(h,target)==='agm');
    });
    scenario('compatible projectile',()=>{
     const g=fresh(),{x,y}=patch(g),u=g.add('blue','antitank',x+2,y+3),target=g.add('red','tank',x+4,y+3);g.updateVision();const hp=target.hp;
     check('compatible attack accepted',g.command([u.id],'attack',{targetId:target.id})===1);g.update(STEP);
     check('attack does not apply instant damage',target.hp===hp);advance(g,45);
     check('real projectile damages armored target',g.shotsFired>0&&target.hp<hp&&target.hp>=0,{shots:g.shotsFired,hp:target.hp});
     if(mode==='turns'){const after=target.hp;check('spent action rejects second attack',!u.actionLeft&&g.command([u.id],'attack',{targetId:target.id})===0);advance(g,30);check('turn attack does not repeat damage',target.hp===after);}
    });

    scenario('air compatibility and range',()=>{
     const g=fresh(),{x,y}=patch(g),air=g.add('red','reconDrone',x+5,y+3),launcher=g.add('blue','missileInfantry',x+2,y+3),ground=g.add('red','recon',x+5,y+5),aa=g.add('blue','antiAirVehicle',x+2,y+5);g.updateVision();
     check('missile launcher uses air 10 and has no ground target',g.range(launcher,air)===10&&g.range(launcher,ground)===0&&g.canFire(launcher,air)&&!g.canFire(launcher,ground));
     air.x=x+13;g.updateVision();check('missile launcher cannot fire at air beyond 10',g.isVisible('blue',air)&&!g.canFire(launcher,air));air.x=x+5;
     for(const [type,dx,dy]of [['tank',3,2],['antitank',3,4],['engineer',4,4],['recon',4,2]]){const u=g.add('blue',type,x+dx,y+dy);g.updateVision();check(type+' rejects airborne attack',g.weapon(u,air)===null&&g.command([u.id],'attack',{targetId:air.id})===0);}
     const inf=g.add('blue','infantry',x+4,y+3),gun=g.add('blue','machinegun',x+5,y+1);g.updateVision();
     check('infantry and machinegun can engage air',g.canFire(inf,air)&&g.canFire(gun,air));
     check('antiair rejects ground target',g.weapon(aa,ground)===null&&g.command([aa.id],'attack',{targetId:ground.id})===0);
     air.x=aa.x+30;air.y=aa.y;g.updateVision();check('antiair fires exactly at range 30',g.isVisible('blue',air)&&g.canFire(aa,air));air.x++;g.updateVision();check('antiair rejects range 31 despite radar contact',g.isVisible('blue',air)&&!g.canFire(aa,air));
    });
    scenario('airborne projectile damage',()=>{
     const g=fresh(),{x,y}=patch(g),u=g.add('blue','missileInfantry',x+2,y+3),target=g.add('red','reconDrone',x+5,y+3);g.updateVision();const hp=target.hp;
     check('airborne attack accepted',g.command([u.id],'attack',{targetId:target.id})===1);advance(g,30);
     check('missile damages visible airborne target',target.hp<hp&&target.hp>0,{hp:target.hp,shots:g.shotsFired});
    });

    scenario('capture ownership and perimeter',()=>{
     const g=fresh(),p=g.structures.find(s=>s.type==='post'&&s.owner==='neutral'&&perimeter(g,s,2).length),u=g.units.find(v=>v.owner==='blue'&&v.type==='infantry'),engineer=g.units.find(v=>v.owner==='blue'&&v.type==='engineer');if(!p)throw Error('no accessible neutral post');
     Object.assign(u,perimeter(g,p,2)[0]);Object.assign(engineer,perimeter(g,p)[0]);g.updateVision();const money=g.credits.blue;
     check('engineer cannot capture post',g.command([engineer.id],'capture',{targetId:p.id})===0);
     check('HQ cannot be captured',g.command([u.id],'capture',{targetId:g.hq('red').id})===0);
     check('capture approaches perimeter from distance 2',DIST(u,p)===2&&g.command([u.id],'capture',{targetId:p.id})===1);advance(g,150);
     check('capture changes owner from outside footprint',p.owner==='blue'&&DIST(u,p)===1&&!g.structureAt(u.x,u.y)&&g.credits.blue===money&&!u.pending,{owner:p.owner,distance:DIST(u,p),pending:u.pending});
     check('friendly capture rejects',g.command([u.id],'capture',{targetId:p.id})===0);if(mode==='turns')check('capture consumes action once',!u.actionLeft);
    });
    scenario('repair ownership and perimeter',()=>{
     const g=fresh(),{x,y}=patch(g),base=g.add('blue','post',x+4,y+3),u=g.add('blue','engineer',x+2,y+3);base.hp-=30;g.updateVision();const hp=base.hp,money=g.credits.blue;
     check('repair approaches friendly perimeter',DIST(u,base)===2&&g.command([u.id],'repair',{targetId:base.id})===1);advance(g,150);
     check('repair heals outside footprint without debit',base.hp>hp&&base.hp<=base.maxHp&&DIST(u,base)===1&&!g.structureAt(u.x,u.y)&&!u.pending&&g.credits.blue===money,{hp:base.hp,distance:DIST(u,base),pending:u.pending});
     if(mode==='turns'){const after=base.hp;check('repair consumes action once',!u.actionLeft&&g.command([u.id],'repair',{targetId:base.id})===0);advance(g,30);check('repair does not heal again without next turn',base.hp===after);}
     u.actionLeft=true;const enemy=g.hq('red');enemy.hp-=20;const self=u.hp;u.hp-=10;const air=g.add('blue','reconDrone',u.x,u.y);air.hp-=10;const before=state(u);
     check('repair rejects enemy, air and self',g.command([u.id],'repair',{targetId:enemy.id})===0&&g.command([u.id],'repair',{targetId:air.id})===0&&g.command([u.id],'repair',{targetId:u.id})===0&&state(u)===before);u.hp=self;base.hp=base.maxHp;check('repair rejects full health',g.command([u.id],'repair',{targetId:base.id})===0);
    });
    scenario('repair target ownership changes',()=>{
     const g=fresh(),{x,y}=patch(g),u=g.add('blue','engineer',x+2,y+3),target=g.add('blue','tank',x+3,y+3);target.hp-=20;g.updateVision();const hp=target.hp;
     check('repair accepted before target capture',g.command([u.id],'repair',{targetId:target.id})===1);target.owner='red';g.updateVision();advance(g,45);
     check('ownership change cancels repair without healing enemy',target.hp===hp&&!u.pending,{hp:target.hp,pending:u.pending});
    });

    for(const type of ['move','attack','repair'])scenario('invalid '+type+' preserves airport work',()=>{
     const g=fresh(),{x,y}=patch(g),site=g.add('blue','airportSite',x+3,y+3),u=g.add('blue','engineer',x+2,y+3),other=g.add('blue','engineer',x+2,y+4),enemy=g.add('red','infantry',x+8,y+3);site.work=0;enemy.hp-=10;g.updateVision();
     check(type+' airport work assigned',g.assignAirportWorkers(site,[u.id,other.id])&&u.airportSiteId===site.id&&u.job?.type==='airportWork'&&!u.pending);
     const before=state(u),args=type==='move'?{x:-1,y:-1}:{targetId:type==='attack'?other.id:enemy.id},accepted=g.command([u.id],type,args);
     check('invalid '+type+' rejects without cancelling airport assignment',accepted===0&&state(u)===before,{accepted,airportSiteId:u.airportSiteId,job:u.job?.type,order:u.order.type});
     g.progressAirports('blue',.2);check('airport continues after rejected '+type,site.work===.2&&u.airportSiteId===site.id&&other.airportSiteId===site.id,{work:site.work,workers:site.workers});
    });
    for(const type of ['stop','move'])scenario('accepted '+type+' cancels airport work',()=>{
     const g=fresh(),{x,y}=patch(g),site=g.add('blue','airportSite',x+3,y+3),u=g.add('blue','engineer',x+2,y+3),other=g.add('blue','engineer',x+2,y+4);site.work=0;g.assignAirportWorkers(site,[u.id,other.id]);
     check('accepted '+type+' releases assigned worker',g.command([u.id],type,{x:x+1,y:y+3})===1&&!u.airportSiteId&&u.job?.type!=='airportWork'&&u.order.type===type);g.progressAirports('blue',.2);check('one remaining worker cannot advance airport after '+type,site.work===0);
    });

    scenario('HQ loss and last base',()=>{
     const g=fresh(),p=g.structures.find(s=>s.type==='post'&&s.owner==='neutral'),u=g.units.find(v=>v.owner==='blue'&&v.type==='infantry');g.captureStructure(p,u);const units=g.units.filter(v=>v.owner==='blue').length;
     g.hurt(g.hq('blue'),g.hq('blue').hp,null);g.update(STEP);check('post keeps faction alive without HQ',!g.winner&&!g.hq('blue')&&p.owner==='blue');
     g.hurt(p,p.hp,null);g.update(STEP);check('last base loss defeats surviving army',g.winner==='red'&&g.units.filter(v=>v.owner==='blue').length===units&&units>0);
     const frozen=JSON.stringify({time:g.time,credits:g.credits,units:g.units,structures:g.structures});advance(g,60);check('terminal result freezes match',JSON.stringify({time:g.time,credits:g.credits,units:g.units,structures:g.structures})===frozen&&g.command([u.id],'move',{x:u.x+1,y:u.y})===0);
    });
    scenario('mutual base loss',()=>{
     const g=fresh(),units=g.units.length;for(const s of [...g.structures])if(['blue','red'].includes(s.owner))g.hurt(s,s.hp,null);g.update(STEP);
     check('no bases on both sides draws despite units',g.winner==='draw'&&g.units.length===units&&units>0);
    });
    return checks;
   },{map,mode}));
  }
  const failures=results.filter(r=>!r.ok);for(const failure of failures)console.error(JSON.stringify(failure));
  console.log(results.length+' functional combat checks; '+failures.length+' failures.');
  assert.equal(failures.length,0,'Functional checks failed; see scenario details above.');assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('OK combat, blocked terrain/structures, armor, air restrictions/ranges, capture/repair perimeter and ownership, airport order rejection, HQ/post victory: four maps, RTS/turns, offline Chrome.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
