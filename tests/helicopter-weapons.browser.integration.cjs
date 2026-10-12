'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
// Functional simulation-clock checks only: no FPS, stress or resource measurements.
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.context().setOffline(true);await page.goto(pathToFileURL(path.join(__dirname,'../public/index.html')).href);await page.evaluate(()=>{paused=true;started=false;});
  const failures=[],results=[];
  for(const map of ['river','desert','mountain','random'])for(const mode of ['rts','turns'])for(const owner of ['blue','red']){
   results.push(...await page.evaluate(({map,mode,owner})=>{
    const checks=[],check=(name,ok,detail)=>checks.push({name:[map,mode,owner,name].join(' '),ok:!!ok,detail}),foe=owner==='blue'?'red':'blue';
    const fresh=()=>{const g=new Game(map,'normal',176,mode);g.aiEnabled=false;g.multiplayer=true;g.turn=owner;g.units=[];g.mines=[];g.projectiles=[];g.events=[];g.terrain.fill('plain');g.rng=()=>.25;return g;};
    const advance=(g,n)=>{for(let i=0;i<n;i++)g.update(STEP);};
    const pair=(g,type,targetType='heavyTank')=>{const u=g.add(owner,type,50,40),t=g.add(foe,targetType,52,40);t.cooldown=100;u.weaponMode='gun';g.updateVision();return{u,t};};
    for(const [type,values]of [['helicopter',[12,1,1,1,2,4,4,1,1]],['helicopterGround',[12,30,30,30,10,20,20,7,30]],['helicopterAir',[12,25,25,25,10,20,20,0,0]]]){
     for(const [i,targetType]of ['infantry','recon','tank','heavyTank','post','helicopter','reconDrone','fighterRed','fighterBlue'].entries()){
      const g=fresh(),{u,t}=pair(g,type,targetType);if(PLANE(t)){t.flightState=i===8?'grounded':'patrol';t.flightJob=null;t.runway=null;}g.updateVision();const hp=t.hp;
      if(PLANE(t)){check(type+' cannot fire gun at '+targetType,!g.canFire(u,t)&&g.shoot(u,t,'gun')===false&&g.projectiles.length===0);continue;}
      check(type+' can fire gun at '+targetType+' '+t.flightState,g.canFire(u,t));g.shoot(u,t,'gun');const p=g.projectiles.at(-1);if(!p){check(type+' projectile exists',false);continue;}g.impact(p);
      check(type+' damage '+targetType+' '+t.flightState,hp-t.hp===values[i],{want:values[i],got:hp-t.hp});
     }
     const g=fresh(),{u,t}=pair(g,type);g.credits[owner]=1000;const price=type==='helicopter'?150:type==='helicopterGround'?230:180;check(type+' purchase and existing attributes',g.enqueue(owner,type,g.hq(owner))&&g.credits[owner]===1000-price&&u.hp===120&&TYPES[type].speed===3.2&&g.trainDuration(type)===(mode==='rts'?(type==='helicopter'?30:40):(type==='helicopter'?3:4)));t.hp=t.maxHp=1000;check(type+' order accepted',g.command([u.id],'attack',{targetId:t.id},owner)===1);const times=[];let shots=0;
     for(let i=0;i<45;i++){g.update(STEP);if(g.shotsFired>shots){times.push(g.time);shots=g.shotsFired;}}
     const interval=type==='helicopter'?.2:1;
     check(type+' cadence',times.length===(mode==='turns'?(type==='helicopter'?5:1):(type==='helicopter'?8:2))&&times.slice(1).every((time,i)=>Math.abs(time-times[i]-interval)<STEP+.00001),times);
     if(mode==='turns')check(type+' one action only',!u.actionLeft&&!u.pending&&!g.busy&&g.command([u.id],'attack',{targetId:t.id},owner)===0);
     const h=fresh(),p=pair(h,type);h.shoot(p.u,p.t,'gun');const projectile=h.projectiles.at(-1),hp=p.t.hp;h.hurt(p.u,999,null);h.units=h.units.filter(v=>v.hp>0);h.impact(projectile);check(type+' posthumous projectile',hp-p.t.hp===(type==='helicopter'?1:type==='helicopterAir'?25:30));
    }
    if(mode==='turns')for(const reason of ['range','hidden','dead']){
     const g=fresh(),{u,t}=pair(g,'helicopter'),other=g.add(foe,'infantry',51,41);g.updateVision();g.command([u.id],'attack',{targetId:t.id},owner);advance(g,3);const shots=g.shotsFired;
     if(reason==='range')t.x=54;if(reason==='hidden'){u.altitude='high';g.terrain[KEY(t.x,t.y)]='forest';t.revealed=0;}if(reason==='dead')g.hurt(t,999,null);g.updateVision();advance(g,40);
     check('burst stops on '+reason+' without retarget',shots===1&&g.shotsFired===1&&!g.busy&&!u.pending&&!u.actionLeft&&other.hp===100,{shots:g.shotsFired});
    }
    if(mode==='turns'){
     const g=fresh(),{u,t}=pair(g,'helicopter');let rolls=0;g.rng=()=>rolls++%2? .5:([.1,.95,.1,.95,.1][Math.floor((rolls-1)/2)]??.5);g.command([u.id],'attack',{targetId:t.id},owner);advance(g,45);
     check('five independent hit rolls',rolls===10&&g.shotsFired===5&&t.hp===277,{rolls,shots:g.shotsFired,hp:t.hp});
    }
    const g=fresh(),{u,t}=pair(g,'helicopterGround');u.weaponMode='auto';check('ground auto missile armored',g.weapon(u,t)==='agm');g.setWeapon(u,'gun');check('manual cannon armor',g.weapon(u,t)==='gun');g.setWeapon(u,'agm');g.shoot(u,t);check('ground missile preserved',g.projectiles.at(-1).power===65&&u.cooldown===3);const a=g.add(owner,'helicopterAir',50,43),drone=g.add(foe,'reconDrone',52,43);g.updateVision();check('air auto missile',g.weapon(a,drone)==='aam');g.shoot(a,drone);check('air missile preserved',g.projectiles.at(-1).power===70&&a.cooldown===3);
    return checks;
   },{map,mode,owner}));
  }
  results.push(...await page.evaluate(()=>{
   const checks=[],check=(name,ok,detail)=>checks.push({name,ok:!!ok,detail});for(const d of document.querySelectorAll('dialog[open]'))d.close();started=true;paused=true;game=new Game('desert','normal',176,'rts');game.aiEnabled=false;game.units=[];game.structures=[];game.mines=[];game.terrain.fill('plain');game.add('blue','hq',4,4);game.add('red','hq',110,80);game.rng=()=>.25;
   const mini=game.add('blue','helicopter',50,40),cannon=game.add('blue','helicopterGround',50,42),target=game.add('red','heavyTank',52,41);target.cooldown=100;target.hp=target.maxHp=1000;game.updateVision();renderer.rebuild();cam.zoom=1;centerCamera(51,41);renderer.draw(0);
   for(const u of [mini,cannon]){setSelection([u.id]);game.setWeapon(u,'gun');updateUI();const info=$('unitInfo').textContent;check(u.type+' UI weapon values',info.includes(u===mini?'Minigun':'Canhão')&&info.includes(u===mini?'0,2 s':'1 s')&&info.includes(u===mini?'12 infantaria / 1 veículos / 2 estruturas':'12 infantaria / 30 veículos / 10 estruturas')&&info.includes('85%'),info);if(u===cannon)check('selector cannon label',$('weaponGun').textContent==='Canhão');}
   for(const profile of ['performance','balanced','cinematic']){
    settings.graphics=profile;renderer.fx.reset();game.events=[];game.projectiles=[];game.shoot(mini,target,'gun');game.shoot(cannon,target,'gun');renderer.consume();const glows=renderer.fx.particles.filter(p=>p.kind==='glow');check(profile+' small minigun and distinct cannon flashes',glows.length===2&&glows[0].size===5&&glows[1].size===11&&glows[0].life<glows[1].life,glows);
    const rectangles=[],fill=renderer.ctx.fillRect;renderer.ctx.fillRect=function(...a){if(this.fillStyle==='#fff0b1'||this.fillStyle==='#ffe2a0')rectangles.push(a);return fill.apply(this,a);};try{renderer.draw(0);}finally{renderer.ctx.fillRect=fill;}check(profile+' short minigun tracer and cannon tracer',rectangles.some(a=>a[2]===7&&a[3]===2)&&rectangles.some(a=>a[2]===15&&a[3]===3));
    const frozen=JSON.stringify(renderer.fx.particles);renderer.draw(0);check(profile+' paused effects frozen',JSON.stringify(renderer.fx.particles)===frozen);
    renderer.fx.reset();const enemy=game.add('red','helicopter',55,46);game.updateVision();renderer.fx.consume({kind:'shot',id:enemy.id,x:enemy.x,y:enemy.y,air:true,sourceType:enemy.type,weapon:'machinegun',visible:true});check(profile+' hidden muzzle absent on camera',!game.isVisible('blue',enemy)&&renderer.fx.screen((enemy.x+.5)*CELL,(enemy.y+.5)*CELL)&&renderer.fx.particles.length===0);game.units=game.units.filter(u=>u!==enemy);
    game.projectiles=[];game.events=[];game.shoot(mini,target,'gun');renderer.consume();renderer.draw(0);renderer.fx.advance(1);check(profile+' flash expires',renderer.fx.particles.length===0&&renderer.fx.particles.length<=renderer.fx.profile().particles);
   }
   game.projectiles=[];game.events=[];game.command([mini.id],'attack',{targetId:target.id});renderer.draw(0);return checks;
  }));
  const pausedBefore=await page.evaluate(()=>JSON.stringify({time:game.time,shots:game.shotsFired,projectiles:game.projectiles,particles:renderer.fx.particles}));await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>JSON.stringify({time:game.time,shots:game.shotsFired,projectiles:game.projectiles,particles:renderer.fx.particles})),pausedBefore,'real browser pause freezes simulation and effects');
  const before=await page.evaluate(()=>game.shotsFired);await page.evaluate(()=>{paused=false;});await page.waitForFunction(n=>game.shotsFired>=n+2,before);await page.evaluate(()=>{paused=true;});
  await page.screenshot({path:path.join(__dirname,'artifacts','helicopter-weapons.png')});
  for(const r of results)if(!r.ok)failures.push(r);for(const r of failures)console.error(JSON.stringify(r));assert.equal(failures.length,0);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('OK '+results.length+' helicopter integration checks: four maps, RTS/turns, both sides, damage, cadence, bursts, missiles, posthumous hits, UI, three FX profiles, visibility and pause; offline Chrome.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
