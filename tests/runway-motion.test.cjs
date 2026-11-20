'use strict';
// Decolagem e pouso: velocidade contínua, giro com taxa máxima, durações preservadas e toque da roda.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/js/engine.js'),'utf8')+'\nObject.assign(this,{Game,AIR,DIST,SHORT_RUNWAY});',ctx);
const {Game,AIR,DIST,SHORT_RUNWAY}=ctx;
const tests=[],test=(name,fn)=>tests.push([name,fn]),DT=1/30;
function field(factions){const g=new Game('river','normal',123,'rts',{posts:2},{},{},null,factions);g.terrain.fill('plain');g.units=[];g.structures=[];g.mines=[];g.projectiles=[];g.actions=[];g.animation=null;g.aiEnabled=false;g.add('blue','hq',1,94);g.add('red','hq',126,1);g.updateVision();return g;}
const turn=(a,b)=>{let d=(b-a)%(2*Math.PI);if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;return d;};
const RUNWAY=['taxiOut','takeoffRoll','climb','landing','landingRoll','taxiIn'];
// Roda o motor e devolve, por quadro, estado, velocidade (casas/s) e giro (rad) enquanto o avião está nas fases da pista.
function trace(g,p,stop,max=1500){const rows=[];let prev={x:p.x,y:p.y,f:p.facing||0},touchdowns=0;for(let n=0;n<max;n++){g.update(DT);touchdowns+=g.events.filter(e=>e.kind==='touchdown').length;g.events=[];
 if(RUNWAY.includes(p.flightState)||rows.length&&stop(p))rows.push({state:p.flightState,v:DIST(prev,p)/DT,turn:turn(prev.f,p.facing||0)});prev={x:p.x,y:p.y,f:p.facing||0};if(stop(p))break;}return {rows,touchdowns};}
const jumps=rows=>Math.max(0,...rows.slice(1).map((r,i)=>Math.abs(r.v-rows[i].v)));
function takeoff(g){const a=g.add('blue','airportAsphalt',20,20),p=g.add('blue','fighterBlue',21,22);p.flightState='grounded';p.airportId=a.id;assert.ok(g.order(p,'takeoff'));return {a,p};}
function landing(g){const a=g.add('blue','airportAsphalt',20,20),p=g.add('blue','fighterBlue',10,21);p.facing=Math.PI/2;assert.ok(g.order(p,'return',{targetId:a.id}));return {a,p};}

test('decolagem sem tranco de velocidade',()=>{const g=field(),{p}=takeoff(g),{rows}=trace(g,p,p=>p.flightState==='approach'||p.flightState==='patrol'||!p.runway&&AIR(p));assert.ok(rows.length>60);assert.ok(jumps(rows)<.6,'salto de velocidade '+jumps(rows));});
test('pouso sem tranco de velocidade',()=>{const g=field(),{p}=landing(g);let n=0;while(p.flightState!=='landing'&&n++<900)g.update(DT);g.events=[];assert.equal(p.flightState,'landing');const {rows}=trace(g,p,p=>p.flightState==='service'||p.flightState==='grounded');assert.ok(rows.length>100);assert.ok(jumps(rows)<.6,'salto de velocidade '+jumps(rows));});
test('giro com taxa máxima em todas as fases da pista',()=>{for(const make of [takeoff,landing]){const g=field(),{p}=make(g);if(make===landing){let n=0;while(p.flightState!=='landing'&&n++<900)g.update(DT);g.events=[];}const {rows}=trace(g,p,p=>['approach','patrol','service','grounded'].includes(p.flightState)&&make===takeoff?!p.runway:['service','grounded'].includes(p.flightState));assert.ok(rows.every(r=>Math.abs(r.turn)<=3*DT+1e-6),'giro acima de 3 rad/s: '+Math.max(...rows.map(r=>Math.abs(r.turn))));}});
test('durações das fases preservadas e pista curta ×0,7',()=>{const g=field(),{p}=takeoff(g);let t=0;while(p.runway&&p.runway.phase!=='climb'&&t<10){g.update(DT);t+=DT;}let climb=0;while(p.runway&&climb<10){g.update(DT);climb+=DT;}assert.ok(Math.abs(t+climb-4)<=2*DT,'decolagem '+(t+climb));
 const f=field({blue:'franca',red:'red'}),q=f.add('blue','transportPlane',21,22);q.runway={type:'takeoff',phase:'wait',baseId:0,level:0,elapsed:0};q.x=21;q.y=22;f.runwayPhase(q,'takeoffRoll',{x:27,y:22},1.8,0);assert.ok(Math.abs(q.runway.duration-1.8*SHORT_RUNWAY)<1e-9);assert.ok(Math.abs(q.runway.v1-2*6/(1.8*SHORT_RUNWAY))<1e-9);});
test('toque da roda gera um único evento touchdown',()=>{const g=field(),{p}=landing(g),{touchdowns}=trace(g,p,p=>p.flightState==='service'||p.flightState==='grounded');assert.equal(touchdowns,1);});
test('pouso interrompido não deixa o avião parado no ar',()=>{const g=field(),{a,p}=landing(g);let n=0;while(p.flightState!=='landing'&&n++<900)g.update(DT);g.hurt(a,99999,g.add('red','infantry',19,20));let still=0,last=[p.x,p.y];for(let i=0;i<60;i++){g.update(DT);if(p.x===last[0]&&p.y===last[1])still++;else still=0;last=[p.x,p.y];assert.ok(still<30,'avião parado por 30 quadros');}});
for(const [name,fn] of tests){fn();console.log('OK '+name);}
console.log(tests.length+' verificações de pista passaram.');
