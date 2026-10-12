'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.context().setOffline(true);await page.goto(pathToFileURL(path.join(__dirname,'../public/index.html')).href);
  const results=await page.evaluate(()=>{
   paused=true;started=false;const checks=[],check=(name,ok,detail)=>checks.push({name,ok:!!ok,detail});
   const fixture=(mode,map='river')=>{const g=new Game(map,'normal',173,mode);g.aiEnabled=false;g.units=[];g.structures=[];g.mines=[];g.terrain.fill('plain');g.add('blue','hq',4,4);g.add('red','hq',110,80);g.rng=()=>.25;return g;};
   const hit=(type,targetType,weapon)=>{const g=fixture('turns'),u=g.add('blue',type,40,40),v=g.add('red',targetType,42,40);if(PLANE(u))u.ammo.jetGun=0;if(PLANE(v))v.ammo.jetGun=0;v.flares=0;g.updateVision();const before=v.hp;g.shoot(u,v,weapon);for(let i=0;i<90&&g.projectiles.length;i++)g.update(STEP);return {damage:before-v.hp,alive:v.hp>0};};
   check('revisão: preços, posto e limite aéreo',TYPES.helicopter.cost===150&&TYPES.fighterRed.cost===610&&TYPES.post.hp===90&&PLAN.normal.planes===4);
   const recon=hit('recon','infantry');check('batedor preserva função de reconhecimento',recon.damage<=40&&recon.damage>0,recon);
   const missile=hit('missileInfantry','helicopter');check('lançador é defesa aérea acessível',missile.damage>=40&&missile.alive,missile);
   const aa=hit('antiAirVehicle','helicopter');check('antiaérea forte sem abate automático',aa.damage>=70&&aa.alive,aa);check('antiaérea suporta fogo leve',TYPES.antiAirVehicle.hp>=65);
   const jet=hit('fighterBlue','bomberRed','jetAam');check('míssil ar-ar usa dano e resistência',jet.damage>=70&&jet.damage<150&&jet.alive,jet);
   const stealth=hit('stealthDrone','antiAirVehicle');check('furtivo tem duas munições úteis',stealth.damage>=30&&stealth.alive,stealth);
   check('apoio aéreo paga por mobilidade e metralhadora',TYPES.helicopter.cost>=TYPES.tank.cost*.85);
   check('artilharia exige investimento de cerco',TYPES.artillery.cost>TYPES.tank.cost&&TYPES.artillery.hp<TYPES.tank.hp&&TYPES.artillery.cooldown>=5);
   check('formação padrão continua válida',armyCost(STARTING_DEFAULT)<=STARTING_BUDGET);
   for(const map of Object.keys(MAPS))for(const mode of ['rts','turns'])for(const owner of ['blue','red']){
    const g=fixture(mode,map),enemy=owner==='blue'?'red':'blue',label=map+' '+mode+' '+owner;g.turn=owner;
    const light=g.add(owner,'lightTank',40,30),medium=g.add(owner,'tank',40,40),heavy=g.add(owner,'heavyTank',40,50),target=g.add(enemy,'heavyTank',42,30);target.cooldown=1000;
    const near=(a,b)=>Math.abs(a-b)<1e-8;
    check(label+' escala de velocidade e movimento',TYPES.lightTank.speed>TYPES.tank.speed&&TYPES.tank.speed>TYPES.heavyTank.speed&&['infantry','engineer','antitank','machinegun','missileInfantry','commander'].every(t=>TYPES.heavyTank.speed>TYPES[t].speed&&TYPES.heavyTank.move>TYPES[t].move));
    check(label+' alcance e visão base',g.range(light)===3&&g.range(medium)===5&&g.range(heavy)===7&&[light,medium,heavy].every(u=>g.sight(u)===5));
    g.updateVision();const before=JSON.stringify([light.order,light.actionLeft,light.moveLeft,g.shotsFired]);
    check(label+' leve recusa pesado sem gastar ação',g.weapon(light,target)===null&&!g.canFire(light,target)&&g.command([light.id],'attack',{targetId:target.id},owner)===0&&JSON.stringify([light.order,light.actionLeft,light.moveLeft,g.shotsFired])===before);
    check(label+' disparo explícito também recusa pesado',g.shoot(light,target,'lightTank')===false&&g.projectiles.length===0);
    const hp=target.hp;g.impact({type:'lightTank',weapon:'lightTank',attackerId:light.id,targetId:target.id,owner,tx:target.x,ty:target.y,power:999,hit:true,critical:true});check(label+' projétil antigo do leve não penetra pesado',target.hp===hp);
    target.type='tank';target.hp=target.maxHp=TYPES.tank.hp;g.updateVision();check(label+' leve continua perfurando médio',g.weapon(light,target)==='lightTank'&&g.canFire(light,target));g.shoot(light,target);const lightShot=g.projectiles.pop();g.impact(lightShot);check(label+' leve causa dano no médio',target.hp===TYPES.tank.hp-35);
    const aim=g.add(enemy,'infantry',43,40);for(const [distance,accuracy]of [[3,.75],[3.5,.70],[4,.65],[5,.55]]){aim.x=medium.x+distance;check(label+' precisão médio a '+distance,near(g.accuracy(medium,aim),accuracy));}
    aim.x=44;medium.level=2;aim.level=2;medium.suppressed=1;g.add(owner,'commander',40,41);check(label+' perda por distância combina com nível aura supressão',near(g.accuracy(medium,aim),.55));
    medium.level=3;aim.level=1;aim.x=43;medium.suppressed=0;check(label+' precisão mantém limite superior',g.accuracy(medium,aim)===.99);
    medium.level=1;aim.level=3;aim.x=46;medium.suppressed=1;g.terrain[KEY(40,40)]='hill';g.units.find(u=>u.type==='commander').y=44;check(label+' precisão mantém limite inferior',g.accuracy(medium,aim)===.1);
    aim.level=1;check(label+' leve e pesado mantêm suas precisões',near(g.accuracy(light,aim),.75)&&near(g.accuracy(heavy,aim),.85));
    const intel=fixture(mode,map);intel.turn=owner;const gun=intel.add(owner,'heavyTank',40,40),hidden=intel.add(enemy,'infantry',47,40);hidden.cooldown=1000;intel.updateVision();
    check(label+' pesado não atira sem reconhecimento',!intel.isVisible(owner,hidden)&&!intel.canFire(gun,hidden)&&intel.command([gun.id],'attack',{targetId:hidden.id},owner)===0);
    intel.add(owner,'recon',46,42);intel.updateVision();check(label+' aliado revela alvo a sete casas',intel.isVisible(owner,hidden)&&intel.canFire(gun,hidden)&&intel.acquire(gun)?.id===hidden.id);
    check(label+' disparo remoto aceito',intel.command([gun.id],'attack',{targetId:hidden.id},owner)===1);for(let i=0;i<20;i++)intel.update(STEP);check(label+' tiro remoto real sem aproximação',hidden.hp===20&&gun.x===40&&gun.y===40);
    hidden.x=48;intel.updateVision();check(label+' além do alcance base bloqueia',!intel.canFire(gun,hidden));intel.terrain[KEY(40,40)]='hill';intel.updateVision();check(label+' colina preserva bônus de alcance e visão',intel.range(gun)===8&&intel.sight(gun)===7&&intel.canFire(gun,hidden));
   }
   for(const map of Object.keys(MAPS))for(const mode of ['rts','turns'])for(const owner of ['blue','red']){
    const g=fixture(mode,map),fighter=g.add(owner,owner==='blue'?'fighterBlue':'fighterRed',40,40),enemy=g.add(owner==='blue'?'red':'blue','helicopter',54,40);enemy.altitude='high';g.updateVision();const label=map+' '+mode+' '+owner,unchanged=JSON.stringify([g.credits,fighter.actionLeft,fighter.moveLeft,g.time]);
    check(label+' radar do caça ativo por padrão',g.radarContact(owner,enemy)&&!g.sky[owner][KEY(enemy.x,enemy.y)]);
    check(label+' radar desligado retira contato remoto',g.setRadar(fighter,false)&&!g.radarContact(owner,enemy)&&!g.isVisible(owner,enemy));
    check(label+' radar religado recupera contato sem custo ou ação',g.setRadar(fighter,true)&&g.radarContact(owner,enemy)&&JSON.stringify([g.credits,fighter.actionLeft,fighter.moveLeft,g.time])===unchanged);
   }
   for(const mode of ['rts','turns'])for(const [type,t]of Object.entries(TYPES))if(t.cost){
    const owner=t.team||'blue',g=fixture(mode);g.turn=owner;g.credits[owner]=5000;const base=t.plane?g.add(owner,'airportAsphalt',20,20):g.hq(owner),before=g.credits[owner],cost=g.recruitCost(type,base);
    check(mode+' compra '+type,g.enqueue(owner,type,base)&&g.credits[owner]===before-cost);g.production(owner,g.trainDuration(type));const u=g.units.find(v=>v.type===type);
    check(mode+' implantação '+type,!!u&&u.hp===u.maxHp&&u.maxHp===g.baseHp(owner,type)&&!base.queue.length&&(AIR(u)||PLANE(u)||!g.structureAt(u.x,u.y)),{queue:base.queue.length});
    if(t.plane)check(mode+' desconto integral '+type,cost===Math.round(t.cost*.8)&&u.flightState==='grounded'&&Object.keys(t.ammo).every(w=>u.ammo[w]===t.ammo[w]));
   }
   game=fixture('rts');game.credits.blue=5000;started=true;paused=true;setSelection([game.hq('blue').id]);updateUI();
   check('interface mostra preços balanceados',recruitButtons.filter(b=>!b.hidden).every(b=>b.querySelector('strong').textContent===game.recruitCost(b.dataset.recruit,game.hq('blue'))+' créditos'));
   const airHeli=game.add('blue','helicopterAir',40,40);setSelection([airHeli.id]);updateUI();check('painel canhão ar-ar mostra 25 contra veículos e imunidade dos aviões',$('unitInfo').textContent.includes('25 veículos')&&$('unitInfo').textContent.includes('sem dano contra aviões'));
   const plane=game.add('blue','fighterBlue',40,40);setSelection([plane.id]);updateUI();check('painel ar-ar informa dano sem prometer abate imediato',$('unitInfo').textContent.includes('dano base '+game.planeWeapon(plane,'jetAam').damage)&&!$('unitInfo').textContent.includes('fatal'));
   const topic=label=>[...$('manual').querySelectorAll('details.topic')].find(e=>e.querySelector('summary').textContent===label)?.textContent||'';
   for(const [type,precision]of [['lightTank','75%'],['tank','75% até 3'],['heavyTank','85%']]){const u=game.add('blue',type,50,50);setSelection([u.id]);updateUI();check('painel informa nova precisão '+type,$('unitInfo').textContent.includes(precision)&&$('unitInfo').textContent.includes('Visão base 5'));}
   check('manual explica precisão e penetração dos tanques',topic('Tanques').includes('65% a 4')&&topic('Tanques').includes('55% a 5')&&topic('Tanques').includes('não perfura o pesado'));
   check('manual atualiza artilharia',topic('Artilharia').includes('dano '+TYPES.artillery.damage+' no alcance mínimo')&&topic('Artilharia').includes(TYPES.artillery.hp+' HP')&&topic('Artilharia').includes('recarga '+TYPES.artillery.cooldown+' s'));
   check('manual atualiza defesa aérea',topic('Defesa antiaérea').includes('Veículo antiaéreo: '+TYPES.antiAirVehicle.hp+' HP, dano '+TYPES.antiAirVehicle.damage)&&topic('Defesa antiaérea').includes('Soldado lançador: '+TYPES.missileInfantry.hp+' HP, dano '+TYPES.missileInfantry.damage));
   check('manual atualiza preço do helicóptero',topic('Helicópteros').includes('Básico ('+TYPES.helicopter.cost+','));
   check('manual atualiza dano furtivo',topic('Drone furtivo').includes('causa '+WEAPONS.stealthMissile.damage+' de dano'));
   check('manual ar-ar preserva dano e resistência',topic('Armas dos aviões').includes('dano normal')&&!topic('Armas dos aviões').includes('destroem qualquer alvo'));
   const airport=game.add('blue','airportDirt',70,70);check('bombardeiro aliado comprado no aeroporto',game.enqueue('blue','bomberBlue',airport)&&game.credits.blue===5000-TYPES.bomberBlue.cost);
   return checks;
  });
  const failures=results.filter(r=>!r.ok);for(const f of failures)console.error(JSON.stringify(f));assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);console.log('OK funções de combate, produção de todas as classes, preços/UI, desconto integral e bombardeiro no aeroporto.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
