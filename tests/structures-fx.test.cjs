'use strict';
// Efeitos das estruturas: estágios de dano, bandeira, antena, destroços e fumaça. Tudo visual, determinístico e sem RNG do motor.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let canvases=0;
function context(){return{ops:[],stack:[],globalAlpha:1,globalCompositeOperation:'source-over',save(){this.stack.push([this.globalAlpha,this.globalCompositeOperation]);},restore(){[this.globalAlpha,this.globalCompositeOperation]=this.stack.pop()||[1,'source-over'];},translate(x,y){this.ops.push(['translate',x,y]);},rotate(a){this.ops.push(['rotate',a]);},scale(x,y){this.ops.push(['scale',x,y]);},
 drawImage(...a){this.ops.push(['image',this.globalAlpha,this.globalCompositeOperation,...a]);},beginPath(){},closePath(){},moveTo(x,y){this.ops.push(['move',x,y]);},lineTo(x,y){this.ops.push(['line',x,y]);},ellipse(){},arc(){},fill(){},stroke(){},fillRect(){},setLineDash(){},
 createRadialGradient(){return{addColorStop(){}};},createLinearGradient(){return{addColorStop(){}};}};}
const ctx=vm.createContext({console,document:{createElement(){canvases++;const c=context();return{width:0,height:0,getContext:()=>c};}}});
vm.runInContext(fs.readFileSync('public/js/engine.js','utf8')+`
const CELL=56;
let game,settings={graphics:'balanced'},reducedMotion=false;
const GRAPHICS={performance:{clouds:0,particles:80,interval:.22,alpha:0},balanced:{clouds:32,visibleClouds:6,particles:200,interval:.12,alpha:.13},cinematic:{clouds:64,visibleClouds:12,particles:400,interval:.08,alpha:.2}};
const cam={x:0,y:0,zoom:1},renderer={canvas:{clientWidth:1000,clientHeight:800}};
function localPlayerSide(){return 'blue';}
function visualUnit(u){return u;}
function flightPose(u){const level=AIR(u)?flightLevel(u):0;return{x:u.x,y:u.y-18*level/CELL,scale:1+.12*level,level};}
Object.assign(this,{Game,TYPES,AIR,PLANE,cam,renderer});
this.fixture=()=>{game=new Game('river','normal',13,'rts',{posts:2});game.units=[];game.structures=[];game.projectiles=[];game.actions=[];game.animation=null;game.terrain.fill('plain');game.visible.blue.fill(true);game.sky.blue.fill(true);game.aiEnabled=false;settings.graphics='balanced';reducedMotion=false;return game;};
this.graphics=p=>settings.graphics=p;this.reduce=v=>reducedMotion=v;
`,ctx);
vm.runInContext(fs.readFileSync('public/js/battlefield-fx.js','utf8')+'\nthis.BattlefieldFX=BattlefieldFX;',ctx);
const {BattlefieldFX,fixture,graphics,reduce,renderer}=ctx;
const art={complete:true,naturalWidth:512};
function setup(profile='balanced'){const g=fixture();graphics(profile);return{g,fx:new BattlefieldFX(renderer),c:context()};}
const structure=(g,type='post',hp=1,x=5,y=5,owner='blue')=>{const s=g.add(owner,type,x,y);s.hp=Math.max(1,Math.round(s.maxHp*hp));return s;};
const wreckEvent=(x=5,y=5,type='post',width=2,height=2)=>({kind:'blast',x:x+width/2,y:y+height/2,visible:true,wreck:{type,x,y,width,height}});

// Estágios de dano: limites exatos e reparo.
{
 const {g,fx}=setup(),s=structure(g,'hq');
 for(const [ratio,stage] of [[1,0],[.76,0],[.75,0],[.7499,1],[.5,1],[.4999,2],[.25,2],[.2499,3],[.01,3]]){s.hp=s.maxHp*ratio;assert.equal(fx.damageStage(s),stage,'hp '+ratio);}
 s.hp=s.maxHp*.2;assert.equal(fx.damageStage(s),3);s.hp=s.maxHp;assert.equal(fx.damageStage(s),0,'reparo reduz o estágio sozinho');
}
console.log('OK estágios de dano nos limites e função pura para reparo.');

// Bandeira e antena dependem só do relógio visual: pausa, tempo igual e pose fixa.
{
 const {g,fx}=setup('cinematic'),hq=structure(g,'hq',1,5,5),post=structure(g,'post',1,10,5);
 const record=(draw)=>{const c=context();draw(c);return JSON.stringify(c.ops);};
 const flag=still=>record(c=>fx.flag(c,100,10,'#77c8e2',hq.id,still)),antenna=(s,still)=>record(c=>fx.antenna(c,s,still));
 const f0=flag(false),a0=antenna(hq,false);
 assert.equal(flag(false),f0,'mesmo tempo, mesma bandeira');assert.equal(antenna(hq,false),a0,'mesmo tempo, mesma antena');
 fx.advance(0);fx.advance(NaN);assert.equal(flag(false),f0,'pausa congela a bandeira');assert.equal(antenna(hq,false),a0,'pausa congela a antena');
 fx.time+=.4;assert.notEqual(flag(false),f0,'a bandeira ondula com o relógio');assert.notEqual(antenna(hq,false),a0,'a antena gira com o relógio');
 const still0=flag(true),stillA=antenna(hq,true);fx.time+=3;assert.equal(flag(true),still0,'pose fixa independe do relógio');assert.equal(antenna(hq,true),stillA);
 assert.notEqual(record(c=>fx.flag(c,100,10,'#77c8e2',hq.id+1,true)),still0,'cada estrutura tem fase própria');
 assert.equal(antenna({...hq,type:'airportDirt'},false),'[]','aeroportos não têm antena giratória');
 assert.ok(antenna(post,false).includes('rotate'),'o posto tem antena');
 const rotations=JSON.parse(antenna(hq,false)).filter(o=>o[0]==='rotate').length;assert.equal(rotations,1,'uma rotação por antena');
}
console.log('OK bandeira e antena: relógio visual, pausa, pose fixa e fases por estrutura.');

// Sobreposição de dano: só com estágio, arte pronta e estrutura real; um canvas por (tipo, estágio).
{
 const {g,fx}=setup(),c=context(),hq=structure(g,'hq',.2,5,5),post=structure(g,'post',.6,10,5),site=g.add('blue','airportSite',20,5);site.hp=1;
 fx.drawDamage(c,structure(g,'post',1,30,5),false,art);assert.equal(c.ops.length,0,'estrutura inteira não tem sobreposição');
 const preparedArt=Object.keys(fx.art).length;fx.drawDamage(c,post,false,{complete:false,naturalWidth:0});assert.equal(c.ops.length,0,'sem arte pronta, nada é desenhado nem guardado');assert.equal(Object.keys(fx.art).length,preparedArt);
 fx.drawDamage(c,site,false,art);assert.equal(c.ops.length,0,'canteiro de obra não mostra dano');
 const before=canvases;fx.drawDamage(c,hq,false,art);fx.drawDamage(c,hq,false,art);fx.drawDamage(c,hq,true,art);
 assert.equal(canvases-before,1,'a sobreposição de (hq, estágio 3) é criada uma vez');
 assert.ok(c.ops.some(o=>o[0]==='image'&&o[2]==='lighter'),'estágio 3 acrescenta brilho de fogo (só animado)');
 const lighter=c.ops.filter(o=>o[0]==='image'&&o[2]==='lighter').length;fx.drawDamage(c,hq,true,art);assert.equal(c.ops.filter(o=>o[0]==='image'&&o[2]==='lighter').length,lighter,'pose fixa não pisca');
 for(const type of ['hq','post','airportDirt','airportAsphalt'])for(const ratio of [.7,.4,.1]){fx.drawDamage(c,structure(g,type,ratio,40,5),false,art);}
 assert.ok(Object.keys(fx.art).filter(k=>k.startsWith('damage:')).length<=12,'no máximo 4 tipos × 3 estágios');
 assert.equal(Object.keys(fx.cache).length,Object.keys(setup().fx.cache).length,'o cache fixo de efeitos não ganha entradas');
}
console.log('OK dano progressivo: estágios, arte pronta, canteiro excluído, cache limitado e brilho só animado.');

// Destroços: registrados só pelo evento visível com metadados, limitados, expiram pelo relógio visual e respeitam a pausa.
{
 const {g,fx,c}=setup('cinematic');
 fx.consume({kind:'blast',x:5,y:5,visible:true});assert.equal(fx.wrecks.length,0,'impacto comum não deixa destroço');
 fx.consume({...wreckEvent(),visible:false});assert.equal(fx.wrecks.length,0,'evento invisível não revela destroço');
 fx.consume(wreckEvent(5,5));assert.equal(fx.wrecks.length,1);
 const frozen=JSON.stringify(fx.wrecks);fx.advance(0);fx.advance(NaN);assert.equal(JSON.stringify(fx.wrecks),frozen,'pausa preserva os destroços');
 fx.ground(c);assert.ok(c.ops.some(o=>o[0]==='image'&&o[1]>0),'destroço é desenhado em ground()');
 const rubble=fx.rubble(fx.wrecks[0]),full=c.ops.filter(o=>o[0]==='image'&&o[3]===rubble).at(-1)[1];assert.ok(Math.abs(full-.92)<1e-9,'opacidade plena enquanto novo');
 fx.advance(25);c.ops=[];fx.ground(c);const fading=c.ops.filter(o=>o[0]==='image'&&o[3]===rubble).at(-1)[1];assert.ok(fading<full&&fading>0,'desvanece nos últimos segundos');
 fx.advance(6);assert.equal(fx.wrecks.length,0,'expira após 30 s visuais');
 for(let i=0;i<20;i++)fx.consume(wreckEvent(i*3%40,i%20));assert.equal(fx.wrecks.length,16,'no máximo 16 destroços');
 fx.reset();assert.equal(fx.wrecks.length,0,'reconstrução limpa os destroços');
 // Destroço fora da câmera é guardado, mas não desenhado.
 fx.consume(wreckEvent(5,5));ctx.cam.x=9000;c.ops=[];fx.ground(c);assert.equal(c.ops.length,0,'fora da câmera não desenha');ctx.cam.x=0;
 const art2=Object.keys(fx.art).filter(k=>k.startsWith('wreck:'));assert.ok(art2.length<=8);
}
console.log('OK destroços: só metadados visíveis, limite de 16, 30 s visuais, pausa e câmera.');

// Fumaça: estruturas muito danificadas e destroços recentes, nunca em Desempenho, movimento reduzido ou fora da visão.
{
 for(const profile of ['balanced','cinematic','performance']){
  const {g,fx}=setup(profile),s=structure(g,'hq',.3,5,5);
  for(let i=0;i<60;i++)fx.advance(1/30);
  const smoke=fx.particles.filter(p=>p.kind==='smoke'&&p.continuous);
  if(profile==='performance')assert.equal(smoke.length,0,'Desempenho não emite');else assert.ok(smoke.length>0&&smoke.length<=fx.profile().particles,'estrutura em estágio 2+ solta fumaça no '+profile);
  s.hp=s.maxHp;fx.reset();for(let i=0;i<60;i++)fx.advance(1/30);assert.equal(fx.particles.length,0,'estrutura inteira não solta fumaça');
 }
 {const {g,fx}=setup('cinematic');structure(g,'hq',.3,5,5);structure(g,'post',.6,12,5);for(let i=0;i<60;i++)fx.advance(1/30);assert.ok(fx.particles.every(p=>p.y<5*56+3*56+10),'só a estrutura em estágio 2+');}
 {const {g,fx}=setup('cinematic');structure(g,'hq',.3,5,5,'red');g.visible.blue.fill(false);g.sky.blue.fill(false);for(let i=0;i<60;i++)fx.advance(1/30);assert.equal(fx.particles.length,0,'estrutura inimiga fora da visão não revela fumaça');}
 {const {g,fx}=setup('cinematic');structure(g,'hq',.3,5,5);reduce(true);for(let i=0;i<60;i++)fx.advance(1/30);assert.equal(fx.particles.length,0,'movimento reduzido remove emissões contínuas');}
 {const {g,fx}=setup('cinematic');fx.consume(wreckEvent(5,5));const n0=fx.particles.length;for(let i=0;i<60;i++)fx.advance(1/30);assert.ok(fx.particles.some(p=>p.kind==='smoke'),'destroço recente solta fumaça');fx.advance(6);for(let i=0;i<30;i++)fx.advance(1/30);assert.equal(fx.particles.length,0,'a fumaça acaba com o destroço');void n0;}
}
console.log('OK fumaça: estágio 2+, destroços recentes, Desempenho, movimento reduzido e névoa.');

// Independência do motor: nenhuma chamada ao RNG e nenhuma mudança no estado do jogo; mesma sequência é idêntica.
{
 const run=()=>{const {g,fx,c}=setup('cinematic'),hq=structure(g,'hq',.2,5,5);const state=JSON.stringify(g),rng=g.rng;let used=0;g.rng=()=>{used++;throw Error('visual não usa RNG');};
  fx.consume(wreckEvent(20,5));for(let i=0;i<90;i++){fx.advance(1/30);fx.ground(c);fx.draw(c);fx.flag(c,10,10,'#fff',hq.id,false);fx.antenna(c,hq,false);fx.drawDamage(c,hq,false,art);}
  g.rng=rng;assert.equal(used,0);assert.equal(JSON.stringify(g),state,'o jogo não muda');return JSON.stringify([fx.particles,fx.wrecks,c.ops.length]);};
 assert.equal(run(),run(),'sequência decorativa determinística');
}
console.log('OK efeitos das estruturas independentes do motor/RNG e determinísticos.');
