'use strict';
// Piores casos de rota: 100 ordens no mesmo tick, destino inalcançável (A* completo) e labirinto de rios com uma ponte por faixa.
const {engine,battle,ticks,tickStats,quantiles,suite}=require('./perf-kit.cjs');
const {Game,KEY,COLS,ROWS}=engine(),S=suite('pathfinding-worst');
const time=f=>{const t=performance.now(),r=f();return[performance.now()-t,r];};
const empty=()=>{const g=new Game('river','normal',3,'rts');g.units=[];g.structures=[];g.mines=[];g.terrain.fill('plain');g.aiEnabled=false;g.add('blue','hq',0,0);g.add('red','hq',125,93);g.updateVision();return g;};

// 1. Cem ordens de movimento de uma vez, de um lado ao outro do mapa.
{const g=battle({blue:100,red:0,attack:false});const blue=g.units.filter(u=>u.owner==='blue'&&u.type!=='commander').slice(0,100);
 const [orderMs]=time(()=>{for(const [i,u] of blue.entries())g.order(u,'move',{x:110+i%10,y:10+Math.floor(i/10)*7},true);});
 const t=ticks(g,60);S.budget('100 ordens no mesmo tick',{orders:blue.length,orderMs:Math.round(orderMs*10)/10,firstTick:Math.round(t[0]*10)/10,...tickStats(t)});}

// 2. Destino inalcançável: um anel de rio isola o alvo; o A* explora o mapa inteiro.
{const g=empty();for(let y=40;y<=50;y++)for(let x=90;x<=100;x++)if(y===40||y===50||x===90||x===100)g.terrain[KEY(x,y)]='river';
 const tanks=[];for(let i=0;i<20;i++)tanks.push(g.add('blue','tank',4+i%5*2,10+Math.floor(i/5)*2));g.updateVision();
 const each=tanks.map(u=>time(()=>g.findPath(u,{x:95,y:45},false))[0]),q=quantiles(each);
 S.budget('destino inalcançável',{findPathMean:q.mean,findPathMax:q.max});
 const [orders]=time(()=>{for(const u of tanks)g.order(u,'move',{x:95,y:45},true);});const t=ticks(g,30);
 S.budget('20 ordens inalcançáveis no mesmo tick',{orderMs:Math.round(orders*10)/10,firstTick:Math.round(t[0]*10)/10,...tickStats(t)});}

// 3. Labirinto: faixas de rio de lado a lado com uma ponte alternando entre as bordas.
{const g=empty();for(let y=8;y<ROWS-4;y+=6){const gap=(y/6|0)%2?3:COLS-4;for(let x=0;x<COLS;x++)g.terrain[KEY(x,y)]=x===gap?'bridge':'river';}
 const units=['infantry','tank','recon','artillery','engineer'].map((type,i)=>g.add('blue',type,10+i*3,2));g.updateVision();
 const each=units.map(u=>time(()=>g.findPath(u,{x:60,y:ROWS-2},false))),q=quantiles(each.map(e=>e[0]));
 S.expect(each.every(e=>e[1]&&e[1].length>COLS),'o labirinto deve ter rota longa: '+each.map(e=>e[1]?.length).join(','));
 S.budget('labirinto de rios',{findPathMean:q.mean,findPathMax:q.max,routeLength:each[0][1]?.length||0});}

S.finish('piores casos de rota medidos.');
