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
   const recon=hit('recon','infantry');check('batedor preserva função de reconhecimento',recon.damage<=40&&recon.damage>0,recon);
   const missile=hit('missileInfantry','helicopter');check('lançador é defesa aérea acessível',missile.damage>=40&&missile.alive,missile);
   const aa=hit('antiAirVehicle','helicopter');check('antiaérea forte sem abate automático',aa.damage>=70&&aa.alive,aa);check('antiaérea suporta fogo leve',TYPES.antiAirVehicle.hp>=65);
   const jet=hit('fighterBlue','bomberRed','jetAam');check('míssil ar-ar usa dano e resistência',jet.damage>=70&&jet.damage<150&&jet.alive,jet);
   const stealth=hit('stealthDrone','antiAirVehicle');check('furtivo tem duas munições úteis',stealth.damage>=30&&stealth.alive,stealth);
   check('apoio aéreo paga por mobilidade e metralhadora',TYPES.helicopter.cost>=TYPES.tank.cost*.85);
   check('artilharia exige investimento de cerco',TYPES.artillery.cost>TYPES.tank.cost&&TYPES.artillery.hp<TYPES.tank.hp&&TYPES.artillery.cooldown>=5);
   check('formação padrão continua válida',armyCost(STARTING_DEFAULT)<=STARTING_BUDGET);
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
   const plane=game.add('blue','fighterBlue',40,40);setSelection([plane.id]);updateUI();check('painel ar-ar informa dano sem prometer abate imediato',$('unitInfo').textContent.includes('dano base '+game.planeWeapon(plane,'jetAam').damage)&&!$('unitInfo').textContent.includes('fatal'));
   const topic=label=>[...$('manual').querySelectorAll('details.topic')].find(e=>e.querySelector('summary').textContent===label)?.textContent||'';
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
