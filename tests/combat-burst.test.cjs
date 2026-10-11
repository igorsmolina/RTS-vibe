'use strict';
// Rajada de combate: duas linhas de 75 tropas, artilharia e antiaéreos a curta distância. Mede o pico de projéteis e incêndios,
// o p99 do tick durante a rajada e confirma que os projéteis voltam a zero.
const {engine,ticks,tickStats,suite}=require('./perf-kit.cjs');
const {Game}=engine(),S=suite('combat-burst');
const g=new Game('desert','normal',9,'rts');g.aiEnabled=false;g.units=g.units.filter(u=>u.type==='commander');
const kinds=['tank','artillery','rocketArtillery','antitank','machinegun','missileInfantry','infantry','heavyTank'];
for(let i=0;i<75;i++){try{g.add('blue',kinds[i%kinds.length],50+i%5,10+Math.floor(i/5)*4);}catch{}try{g.add('red',kinds[i%kinds.length],58+i%5,10+Math.floor(i/5)*4);}catch{}}
for(let i=0;i<10;i++){try{g.add('blue',i%2?'helicopter':'antiAirVehicle',46,12+i*6);}catch{}try{g.add('red',i%2?'helicopter':'antiAirVehicle',66,12+i*6);}catch{}}
g.updateVision();for(const u of g.units)if(u.owner==='blue')g.order(u,'attackMove',{x:62,y:40},true);else if(u.owner==='red')g.order(u,'attackMove',{x:52,y:40},true);
let peak=0,fires=0;const burst=ticks(g,30*20,undefined,()=>{peak=Math.max(peak,g.projectiles.length);fires=Math.max(fires,g.fires.length);});
for(const u of g.units)if(u.type!=='commander')u.hp=0;g.units=g.units.filter(u=>u.hp>0);
const settle=ticks(g,30*10);
S.budget('rajada de 20 s',{...tickStats(burst),peakProjectiles:peak,peakFires:fires,projectilesAfter:g.projectiles.length});
S.expect(peak>=20,`rajada fraca demais: pico de ${peak} projéteis`);S.expect(g.projectiles.length===0,`${g.projectiles.length} projéteis presos após o combate`);
S.expect(Math.max(...settle)<=50,`tick depois do combate: ${Math.max(...settle).toFixed(1)} ms`);
S.finish('rajada de combate medida; projéteis voltam a zero.');
