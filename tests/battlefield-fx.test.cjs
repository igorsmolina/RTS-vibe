'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let canvases=0,gradients=0;
function context(){return{ops:[],save(){this.ops.push(['save']);},restore(){this.ops.push(['restore']);},translate(x,y){this.ops.push(['translate',x,y]);},rotate(a){this.ops.push(['rotate',a]);},scale(x,y){this.ops.push(['scale',x,y]);},drawImage(...args){this.ops.push(['image',...args]);},beginPath(){},moveTo(){},lineTo(){},ellipse(){},arc(){},fill(){},stroke(){},fillRect(){},setLineDash(){},createRadialGradient(){gradients++;return{addColorStop(){}};},createLinearGradient(){gradients++;return{addColorStop(){}};}};}
const ctx=vm.createContext({console,document:{createElement(){canvases++;const c=context();return{width:0,height:0,getContext:()=>c};}}});
vm.runInContext(fs.readFileSync('public/js/engine.js','utf8')+`
const CELL=56;
let game,settings={graphics:'balanced'},reducedMotion=false;
const GRAPHICS={performance:{clouds:0,particles:80,interval:.22,alpha:0},balanced:{clouds:32,visibleClouds:6,particles:200,interval:.12,alpha:.13},cinematic:{clouds:64,visibleClouds:12,particles:400,interval:.08,alpha:.2}};
const cam={x:0,y:0,zoom:1},renderer={canvas:{clientWidth:1000,clientHeight:800}};
function flightPose(u){const level=AIR(u)?flightLevel(u):0;return{x:u.x,y:u.y-18*level/CELL,scale:1+.12*level,level};}
function viewCells(){return{x0:0,y0:0,x1:18,y1:15};}
Object.assign(this,{Game,TYPES,AIR,PLANE,cam,renderer});
this.fixture=()=>{game=new Game('river','normal',13,'rts',{posts:2});game.units=[];game.structures=[];game.projectiles=[];game.actions=[];game.animation=null;game.terrain.fill('plain');game.visible.blue.fill(true);game.sky.blue.fill(true);game.aiEnabled=false;settings.graphics='balanced';reducedMotion=false;return game;};
this.graphics=p=>settings.graphics=p;this.reduce=v=>reducedMotion=v;this.getSettings=()=>settings;
`,ctx);
vm.runInContext(fs.readFileSync('public/js/battlefield-fx.js','utf8')+'\nthis.BattlefieldFX=BattlefieldFX;',ctx);
const {BattlefieldFX,fixture,graphics,reduce,renderer,AIR}=ctx;
function setup(profile='balanced'){const g=fixture();graphics(profile);return{g,fx:new BattlefieldFX(renderer),c:context()};}
function move(fx,u,seconds,dx=.12){for(let n=0;n<Math.ceil(seconds*30);n++){u.x+=dx;fx.advance(1/30);}}
for(const [name,particles,clouds,points,life,marks]of [['performance',80,0,0,0,0],['balanced',200,6,10,.45,64],['cinematic',400,12,18,.75,128]]){
 const {g,fx}=setup(name),p=g.add('blue','fighterBlue',5,5);p.flightState='patrol';
 const profile=fx.profile();assert.equal(profile.particles,particles);assert.equal(profile.clouds,clouds);assert.equal(profile.trailPoints,points);assert.equal(profile.trailLife,life);assert.equal(profile.marks,marks);
 move(fx,p,1);const trail=fx.trails.get(p.id);assert.ok((trail?.length||0)<=points);if(points){assert.ok(trail.length>0);assert.ok(trail.every(t=>fx.time-t.time<=life+1e-8));}
 for(let n=0;n<200;n++)fx.consume({kind:'blast',x:4,y:4,heavy:true,visible:true});assert.ok(fx.particles.length>0&&fx.particles.length<=particles);
 const frozen=JSON.stringify({time:fx.time,particles:fx.particles,trails:[...fx.trails],marks:fx.marks});fx.advance(0);fx.advance(NaN);assert.equal(JSON.stringify({time:fx.time,particles:fx.particles,trails:[...fx.trails],marks:fx.marks}),frozen,'Pausa preserva o estado decorativo');
 fx.advance(12);assert.equal(fx.particles.length,0,'Partículas expiradas não ficam armazenadas');
}
console.log('OK perfis, limites, duração dos rastros e pausa.');
{
 const {g,fx}=setup('cinematic');g.mode='turns';fx.consume({kind:'blast',x:5,y:5,visible:true});const frozen=JSON.stringify(fx.particles);fx.advance(.5);assert.equal(fx.time,0);assert.equal(JSON.stringify(fx.particles),frozen,'Planejamento por turnos congela efeitos');g.actions.push({type:'move'});fx.advance(.1);assert.equal(fx.time,.1);g.actions=[];fx.advance(.5);assert.equal(fx.time,.1);
}
console.log('OK relógio dos efeitos só avança durante execução por turnos.');
{
 const {g,fx,c}=setup('cinematic'),p=g.add('red','fighterRed',5,5);p.flightState='patrol';move(fx,p,.2);assert.ok(fx.trails.get(p.id)?.length);g.visible.blue.fill(false);g.sky.blue.fill(false);fx.advance(0);assert.equal(fx.trails.has(p.id),false,'Contato perdido apaga rastro mesmo durante pausa');fx.exhaust(c,p);assert.equal(c.ops.length,0);
 g.visible.blue.fill(true);g.sky.blue.fill(true);p.flightState='grounded';fx.advance(.1);assert.equal(fx.trails.has(p.id),false);fx.exhaust(c,p);assert.equal(c.ops.length,0,'Avião estacionado não tem chama');
 p.flightState='takeoffRoll';p.facing=Math.PI/2;fx.exhaust(c,p);assert.ok(c.ops.some(o=>o[0]==='image'),'Pós-combustão começa na corrida, antes de AIR=true');assert.ok(c.ops.some(o=>o[0]==='rotate'&&o[1]===Math.PI/2));
 c.ops=[];p.flightState='taxiOut';fx.exhaust(c,p);assert.equal(c.ops.length,0);p.flightState='landingRoll';fx.exhaust(c,p);assert.equal(c.ops.length,0);
 p.flightState='patrol';ctx.cam.x=5000;fx.exhaust(c,p);assert.equal(c.ops.length,0,'Aeronave fora da câmera não desenha escape');ctx.cam.x=0;
 const bomber=g.add('blue','bomberBlue',5,5);bomber.flightState='patrol';fx.exhaust(c,bomber);assert.ok(c.ops.some(o=>o[0]==='image'),'Bombardeiro recebe escape discreto');
}
console.log('OK contato lógico, câmera, taxiamento, corrida de decolagem e bombardeiro.');
{
 const {g,fx,c}=setup('cinematic');g.visible.blue.fill(false);g.sky.blue.fill(false);fx.consume({kind:'blast',x:5,y:5,flightLevel:1,air:true,contactId:999,visible:true});assert.equal(fx.particles.length,0,'Impacto privado fora da visão continua oculto');fx.consume({kind:'blast',x:5,y:5,flightLevel:1,air:true,publicMissile:true,visible:true,interception:true});assert.ok(fx.particles.length>0,'Interceptação pública conserva sinal visual mesmo fora da visão');fx.draw(c);assert.ok(c.ops.some(o=>o[0]==='image'));
}
console.log('OK impacto público de míssil/interceptação preservado sem revelar efeitos privados.');
for(const profile of ['performance','balanced','cinematic']){
 const {fx}=setup(profile),cap=fx.profile().particles;
 for(let n=0;n<cap;n++)fx.push({kind:'dust',x:308,y:308,vx:0,vy:0,size:2,life:1,continuous:true});fx.consume({kind:'shot',id:400,x:5,y:5,sourceType:'tank',facing:0,weapon:'tank',visible:true});assert.equal(fx.particles.length,cap);assert.ok(fx.particles.some(p=>p.signal),'Disparo substitui decoração quando o limite está cheio');fx.consume({kind:'blast',x:5,y:5,visible:true});assert.ok(fx.particles.filter(p=>p.signal).length>=2,'Impacto novo também preserva seu sinal');
 fx.reset();for(let n=0;n<cap;n++)fx.push({kind:'glow',x:308,y:308,vx:0,vy:0,size:2,life:1,signal:true,tag:n});fx.push({kind:'glow',x:308,y:308,vx:0,vy:0,size:2,life:1,signal:true,tag:'novo'});assert.equal(fx.particles.length,cap);assert.ok(fx.particles.some(p=>p.tag==='novo'));assert.ok(!fx.particles.some(p=>p.tag===0));const signals=JSON.stringify(fx.particles);fx.push({kind:'dust',x:308,y:308,vx:0,vy:0,size:2,life:1,continuous:true});assert.equal(JSON.stringify(fx.particles),signals,'Poeira não elimina sinal visual para entrar no limite');
}
console.log('OK sinal de tiro/impacto tem prioridade sobre decoração no limite de partículas.');
{
 const {g,fx}=setup('cinematic'),tank=g.add('blue','tank',5,5),id=tank.id;g.units=[];
 fx.consume({kind:'shot',id,x:5,y:5,sourceType:'tank',facing:Math.PI/2,weapon:'tank',visible:true});assert.ok(fx.particles.some(p=>p.kind==='glow'));assert.ok(fx.particles.some(p=>p.kind==='dust'));assert.ok(fx.particles.some(p=>p.kind==='smoke'));assert.ok(fx.particles.filter(p=>p.kind==='smoke').every(p=>p.vx>0),'Fumaça sai na direção registrada do canhão');const recoil=fx.recoil({...tank,facing:Math.PI/2});assert.ok(recoil.x<0&&Math.abs(recoil.y)<1e-8);
 fx.reset();g.terrain[5*128+5]='river';fx.consume({kind:'blast',x:5,y:5,visible:true,heavy:true});assert.ok(fx.particles.some(p=>p.kind==='splash'));assert.ok(!fx.particles.some(p=>p.kind==='dust'),'Impacto na água não levanta terra');
 fx.reset();fx.consume({kind:'shot',x:5,y:5,sourceType:'bomberBlue',weapon:'artillery',visible:true});assert.equal(fx.particles.length,0,'Bombas não geram poeira de um canhão terrestre');
}
console.log('OK metadados preservados, recuo visual, fumaça direcional e respingos.');
{
 const {g,fx}=setup('cinematic'),tank=g.add('blue','tank',5,5);tank.segment={to:{x:15,y:5}};for(let n=0;n<360;n++){tank.x=5+(n%240)/60;fx.advance(1/30);}assert.ok(fx.marks.length>0&&fx.marks.length<=128);assert.ok(fx.particles.length<=400);
 tank.segment=null;fx.advance(11);assert.equal(fx.marks.length,0);assert.equal(fx.particles.length,0);g.units=[];fx.advance(.1);assert.equal(fx.positions.size,0,'Estado por unidade é removido após destruição');
 const p=g.add('blue','fighterBlue',5,5);p.flightState='patrol';move(fx,p,.2);reduce(true);fx.advance(0);assert.equal(fx.particles.length,0);assert.equal(fx.trails.size,0);const c=context(),count=gradients;fx.exhaust(c,p);fx.exhaust(c,p);assert.equal(gradients,count,'Escape reutiliza sprites sem criar gradientes por quadro');assert.equal(fx.recoil(tank).x,0);assert.equal(fx.recoil(tank).y,0);
}
console.log('OK esteiras limitadas e temporárias, limpeza de unidades e movimento reduzido.');
{
 const {g,fx}=setup('cinematic');reduce(true);fx.consume({kind:'shot',id:500,x:5,y:5,sourceType:'tank',facing:0,weapon:'tank',visible:true});fx.consume({kind:'blast',x:5,y:5,visible:true,heavy:true});assert.equal(fx.particles.length,2,'Movimento reduzido conserva dois sinais compactos de tiro e impacto');assert.ok(fx.particles.every(p=>p.vx===0&&p.vy===0&&p.kind!=='glow'));const positions=fx.particles.map(p=>[p.x,p.y]);fx.advance(.1);assert.equal(JSON.stringify(fx.particles.map(p=>[p.x,p.y])),JSON.stringify(positions));assert.equal(fx.particles.length,2);fx.advance(.5);assert.equal(fx.particles.length,0);
}
console.log('OK tiro e impacto compactos e estáticos continuam visíveis com movimento reduzido.');
for(const profile of ['performance','balanced','cinematic']){
 const {g,fx}=setup(profile);g.map='desert';const foot=g.add('blue','infantry',5,5);foot.segment={to:{x:11,y:5}};fx.advance(.01);move(fx,foot,.6,.02);
 if(profile==='performance')assert.equal(fx.particles.length,0);else{assert.ok(fx.particles.some(p=>p.kind==='dust'),'Infantaria em solo desértico levanta poeira discreta');assert.ok(fx.particles.every(p=>p.size<=3&&p.life>=1&&p.alpha<=.1));fx.advance(.8);assert.ok(fx.particles.length>0,'Poeira da tropa se dissipa gradualmente');reduce(true);fx.advance(0);assert.equal(fx.particles.length,0,'Movimento reduzido apaga emissões contínuas de tropas');}
}
console.log('OK poeira discreta das tropas terrestres no Equilibrado e Cinematográfico.');
{
 const {fx}=setup('cinematic'),saved=JSON.stringify(ctx.getSettings());
 for(let n=0;n<100;n++)fx.observe(2,1/20);assert.equal(fx.profile().factor,1,'Custo do motor não reduz qualidade visual');
 for(let n=0;n<59;n++)fx.observe(12,1/30);assert.equal(fx.profile().factor,1);fx.observe(12,1/30);assert.equal(fx.profile().factor,.7);assert.equal(fx.profile().particles,280);
 for(let n=0;n<60;n++)fx.observe(12,1/30);assert.equal(fx.profile().factor,.45);assert.equal(fx.profile().particles,180);
 for(let n=0;n<240;n++)fx.observe(3,1/60);assert.equal(fx.profile().factor,.45,'Quatro segundos bons ainda não recuperam');
 for(let n=0;n<240;n++)fx.observe(3,1/60);assert.equal(fx.profile().factor,.7);for(let n=0;n<480;n++)fx.observe(3,1/60);assert.equal(fx.profile().factor,1);assert.equal(JSON.stringify(ctx.getSettings()),saved);
 fx.observe(30,0);fx.observe(NaN,1/30);assert.equal(fx.profile().factor,1);
}
console.log('OK redução por custo da renderização, três níveis e recuperação sem alterar configuração.');
for(const [seconds,frames,renderMs]of [[.2,10,120],[.5,4,300]]){
 const {fx}=setup('cinematic');for(let n=0;n<frames-1;n++)fx.observe(renderMs,seconds);assert.equal(fx.profile().factor,1);fx.observe(renderMs,seconds);assert.equal(fx.profile().factor,.7,'Dois segundos reais reduzem qualidade mesmo em '+Math.round(1/seconds)+' FPS');
 fx.observe(900,1.5);assert.equal(fx.profile().factor,.7,'Intervalo longo de aba inativa não conta como quadro lento');for(let n=0;n<479;n++)fx.observe(3,1/60);assert.equal(fx.profile().factor,.7);fx.observe(3,1/60);assert.equal(fx.profile().factor,1,'Recuperação usa oito segundos reais de quadros estáveis');
}
console.log('OK histerese conta segundos reais a 5/2 FPS e ignora intervalo de aba inativa.');
{
 const a=setup('cinematic'),b=setup('cinematic');const before=JSON.stringify(b.g);const rngExpected=b.g.rng;const samples=[];b.g.rng=()=>{samples.push(1);throw Error('O visual não pode usar RNG do combate');};
 const cacheCount=canvases,gradientCount=gradients;b.fx.consume({kind:'blast',x:5,y:5,visible:true,heavy:true});b.fx.advance(.1);b.fx.ground(b.c);b.fx.draw(b.c);assert.equal(samples.length,0);assert.equal(canvases,cacheCount);assert.equal(gradients,gradientCount);b.g.rng=rngExpected;assert.equal(JSON.stringify(b.g),before);
 a.fx.consume({kind:'blast',x:5,y:5,visible:true,heavy:true});a.fx.advance(.1);assert.equal(JSON.stringify(a.fx.particles),JSON.stringify(b.fx.particles),'Mesma sequência decorativa é determinística');
}
console.log('OK efeitos independentes do motor/RNG e caches preparados uma vez.');
