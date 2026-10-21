// Mapas: simetria, conexão, identidade dos mapas fixos, controles do procedural, determinismo e métricas de naturalidade.
// Verificações movidas de tests/engine.test.cjs (que aborta antes de chegar nelas) e novas. node tests/maps.test.cjs [--metrics]
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync(path.join(__dirname,'..','public','js','engine.js'),'utf8')+'\nObject.assign(this,{Game,COLS,ROWS,KEY,MAPS,landscapeOf,LANDSCAPE_LIST});',ctx);
const {Game,COLS,ROWS,KEY,MAPS,LANDSCAPE_LIST}=ctx;
const NEIGH=[[1,0],[-1,0],[0,1],[0,-1]],SIZE=COLS*ROWS;
// --- métricas (exportadas; usadas pelos testes de cada etapa) ---
const share=(g,...t)=>g.terrain.filter(v=>t.includes(v)).length/SIZE;
function components(g,pred){const seen=new Uint8Array(SIZE),out=[];for(let k=0;k<SIZE;k++){if(seen[k]||!pred(g.terrain[k]))continue;const cells=[],stack=[k];seen[k]=1;while(stack.length){const c=stack.pop(),x=c%COLS,y=(c-x)/COLS;cells.push(c);for(const [dx,dy] of NEIGH){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;const n=ny*COLS+nx;if(!seen[n]&&pred(g.terrain[n])){seen[n]=1;stack.push(n);}}}out.push(cells);}return out;}
// Fração das casas de `type` que estão numa reta (linha ou coluna) de 8+ casas seguidas: mede o "xadrez" de sebes.
function straightShare(g,type,min=8){const total=g.terrain.filter(v=>v===type).length;if(!total)return 0;const hit=new Set();for(let y=0;y<ROWS;y++){let run=[];for(let x=0;x<=COLS;x++){if(x<COLS&&g.terrain[y*COLS+x]===type)run.push(y*COLS+x);else{if(run.length>=min)run.forEach(k=>hit.add(k));run=[];}}}for(let x=0;x<COLS;x++){let run=[];for(let y=0;y<=ROWS;y++){if(y<ROWS&&g.terrain[y*COLS+x]===type)run.push(y*COLS+x);else{if(run.length>=min)run.forEach(k=>hit.add(k));run=[];}}}return hit.size/total;}
const isRoad=t=>t==='road'||t==='bridge';
// Estrada em escada: casas de grau 2 que viram e cujas duas vizinhas também viram, sobre as casas de grau 2. Também devolve o comprimento médio das retas.
function roadShape(g){let deg2=0,stair=0,runs=[],turn=new Map();const nb=k=>{const x=k%COLS,y=(k-x)/COLS,out=[];for(const [dx,dy] of NEIGH){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<COLS&&ny<ROWS&&isRoad(g.terrain[ny*COLS+nx]))out.push(ny*COLS+nx);}return out;};
 const cells=[];for(let k=0;k<SIZE;k++)if(isRoad(g.terrain[k])){const n=nb(k);if(n.length===2){deg2++;const [a,b]=n,collinear=(a%COLS===b%COLS)||(Math.floor(a/COLS)===Math.floor(b/COLS));turn.set(k,!collinear);cells.push(k);}}
 for(const k of cells)if(turn.get(k)&&nb(k).every(n=>turn.get(n)))stair++;
 let run=0;for(const k of cells){if(turn.get(k)){if(run)runs.push(run);run=0;}else run++;}if(run)runs.push(run);
 return {deg2,stair:deg2?stair/deg2:0,meanRun:runs.length?runs.reduce((a,b)=>a+b,0)/runs.length:0};}
// Irregularidade da borda das matas grandes: perímetro/√área (círculo ≈ 3,5; quadrado = 4; borda recortada, mais).
function forestEdge(g,minSize=30){const out=[];for(const cells of components(g,t=>t==='forest')){if(cells.length<minSize)continue;const set=new Set(cells);let per=0;for(const k of cells){const x=k%COLS,y=(k-x)/COLS;for(const [dx,dy] of NEIGH){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=COLS||ny>=ROWS||!set.has(ny*COLS+nx))per++;}}out.push(per/Math.sqrt(cells.length));}return out.length?out.reduce((a,b)=>a+b,0)/out.length:0;}
// Fração dos vizinhos não-montanha de uma montanha que são colina, estrada, ponte ou rio (relevo gradual).
function foothills(g){let n=0,ok=0;for(let k=0;k<SIZE;k++){if(g.terrain[k]!=='mountain')continue;const x=k%COLS,y=(k-x)/COLS;for(const [dx,dy] of NEIGH){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;const t=g.terrain[ny*COLS+nx];if(t==='mountain')continue;n++;if(['hill','road','bridge','river'].includes(t))ok++;}}return n?ok/n:1;}
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const configs=[...Object.keys(MAPS).filter(m=>m!=='random').map(m=>({map:m})),...LANDSCAPE_LIST.map(l=>({map:'random',options:{landscape:l}}))];
const make=(c,seed)=>new Game(c.map,'normal',seed,'turns',c.options);
module.exports={share,components,straightShare,roadShape,forestEdge,foothills,configs,make,mean};
{
let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
const count=(g,...t)=>g.terrain.filter(v=>t.includes(v)).length;
const parts=(g,type)=>{const seen=new Set();let n=0;for(let k=0;k<COLS*ROWS;k++){if(g.terrain[k]!==type||seen.has(k))continue;n++;const st=[k];seen.add(k);while(st.length){const c=st.pop(),x=c%COLS,y=(c-x)/COLS;for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,nk=ny*COLS+nx;if(nx<0||ny<0||nx>=COLS||ny>=ROWS||seen.has(nk)||g.terrain[nk]!==type)continue;seen.add(nk);st.push(nk);}}}return n;};
check('Quatro mapas × 12 sementes: simétricos, determinísticos, bases ligadas e todo posto sobre estrada ligada por tanque',()=>{
 for(const map of Object.keys(MAPS))for(let seed=1;seed<=12;seed++){const g=new Game(map,'normal',seed);g.units=[];const tank={type:'tank',owner:'blue',x:4,y:ROWS-2};
  for(let k=0;k<COLS*ROWS;k++)assert.equal(g.terrain[k],g.terrain[COLS*ROWS-1-k],map+'/'+seed);
  assert.ok(g.findPath(tank,{x:COLS-5,y:1}),map+'/'+seed+' bases');const posts=g.structures.filter(s=>s.type==='post');assert.equal(posts.length,24,map+'/'+seed);
  for(const p of posts){const ring=[];for(let i=-1;i<=p.width;i++)for(let j=-1;j<=p.height;j++)if(i<0||j<0||i>=p.width||j>=p.height)ring.push({x:p.x+i,y:p.y+j});assert.ok(ring.some(c=>c.x>=0&&c.y>=0&&c.x<COLS&&c.y<ROWS&&['road','bridge'].includes(g.terrain[KEY(c.x,c.y)])&&g.findPath(tank,c)),map+'/'+seed+' posto '+p.x+','+p.y);}// o posto ocupa planície; a estrada passa ao lado (perímetro), e o espelho abre pelo lado oposto
  assert.equal(JSON.stringify(new Game(map,'normal',seed).terrain),JSON.stringify(g.terrain));}
});
check('Vale dos Rios: rio central de borda a borda, ≥ 3 pontes, campos, sebes e colinas',()=>{
 for(let seed=1;seed<=12;seed++){const g=new Game('river','normal',seed),mid=COLS/2;
  for(let y=0;y<ROWS;y++)assert.ok([...Array(13).keys()].some(i=>['river','bridge'].includes(g.terrain[KEY(mid-7+i,y)])),'Rio na linha '+y+' / '+seed);
  assert.ok(parts(g,'bridge')>=3,'pontes '+seed);assert.ok(count(g,'field')>120&&count(g,'hedge')>40&&count(g,'hill')>20,seed+': '+[count(g,'field'),count(g,'hedge'),count(g,'hill')]);}
});
check('Deserto Aberto: dunas (colinas), quase sem vegetação, sem sebes e estradas longas',()=>{
 for(let seed=1;seed<=12;seed++){const g=new Game('desert','normal',seed),n=COLS*ROWS;assert.ok(count(g,'hill')>n*.12,'dunas '+seed);assert.equal(count(g,'hedge'),0);assert.ok(count(g,'forest')<n*.05&&count(g,'field')<n*.08,'vegetação '+seed);assert.ok(count(g,'road','bridge')>40,'estradas '+seed);}
});
check('Passe de Montanha: serra central atravessada por ≥ 2 passagens',()=>{
 for(let seed=1;seed<=12;seed++){const g=new Game('mountain','normal',seed),mid=COLS/2;assert.ok(count(g,'mountain')>40,'serra '+seed);
  const open=[...Array(ROWS).keys()].filter(y=>[...Array(8).keys()].every(i=>g.terrain[KEY(mid-4+i,y)]!=='mountain'));assert.ok(open.length>=2,seed+': '+open);}
});
check('Fronteira procedural: água, floresta, relevo e campos seguem os controles',()=>{
 for(let seed=1;seed<=10;seed++){
  const flat=new Game('random','normal',seed,'turns',{water:0,forest:0,relief:0,farmland:0});assert.equal(count(flat,'river','bridge','forest','hill','mountain','field','hedge'),0,'liso '+seed);
  const farm=new Game('random','normal',seed,'turns',{water:0,forest:0,relief:0,farmland:1});assert.ok(count(farm,'field')>150&&count(farm,'hedge')>40,'campos '+seed);
  const rough=new Game('random','normal',seed,'turns',{water:0,forest:0,relief:1,farmland:0});assert.ok(count(rough,'hill')>100&&count(rough,'mountain')>0,'relevo '+seed);
  assert.equal(new Game('random','normal',seed,'turns',{mountain:0}).options.relief,0,'mountain continua aceito como relevo');}
});
console.log(checks+' verificações de mapas concluídas.');
}
// --- T3: relevo gradual ---
{let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
check('Relevo gradual: serra cercada de colina, rio ou estrada; nem mata nem campo colados na montanha',()=>{for(const c of configs){const sopes=[];for(let seed=1;seed<=8;seed++){const g=make(c,seed);sopes.push(foothills(g));
 for(let k=0;k<SIZE;k++){if(!['forest','field'].includes(g.terrain[k]))continue;const x=k%COLS,y=(k-x)/COLS;for(const [dx,dy] of NEIGH){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<COLS&&ny<ROWS)assert.notEqual(g.terrain[ny*COLS+nx],'mountain',JSON.stringify(c)+' '+seed+' mata/campo na serra '+x+','+y);}}}
 assert.ok(mean(sopes)>=.9,JSON.stringify(c)+' sopé '+mean(sopes).toFixed(2));}});
console.log(checks+' verificações de relevo concluídas.');}
// --- T4: rios e lagos realistas ---
{let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
const lakeShape=g=>{const out=[];for(const cells of components(g,t=>t==='river')){if(cells.length<40||cells.length>600)continue;const set=new Set(cells);let per=0;for(const k of cells){const x=k%COLS,y=(k-x)/COLS;for(const [dx,dy] of NEIGH){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=COLS||ny>=ROWS||!set.has(ny*COLS+nx))per++;}}out.push(per/(2*Math.sqrt(Math.PI*cells.length)));}return out;};
check('Rios: meandram, alargam rio abaixo e descem o relevo',()=>{let n=0;const drop=[];for(const c of [{map:'river'},{map:'random',options:{landscape:'continent'}},{map:'random',options:{landscape:'highlands',water:.9}}])for(let seed=1;seed<=10;seed++){const g=make(c,seed);assert.ok(Array.isArray(g._rivers)&&g._rivers.length>0,JSON.stringify(c)+' '+seed+' sem rios registrados');
  for(const r of g._rivers){n++;assert.ok(r.width.end>=r.width.start+1,JSON.stringify(c)+' '+seed+' largura '+r.width.start+'→'+r.width.end);const a=r.path[0],b=r.path.at(-1),chord=Math.hypot(a.x-b.x,a.y-b.y)||1,sin=(r.path.length-1)/chord;assert.ok(sin>=1.2&&sin<=2.5,JSON.stringify(c)+' '+seed+' sinuosidade '+sin.toFixed(2));
   let run=1,maxRun=1;for(let i=2;i<r.path.length;i++){const same=(r.path[i].x-r.path[i-1].x===r.path[i-1].x-r.path[i-2].x)&&(r.path[i].y-r.path[i-1].y===r.path[i-1].y-r.path[i-2].y);run=same?run+1:1;maxRun=Math.max(maxRun,run);}assert.ok(maxRun<=12,JSON.stringify(c)+' '+seed+' reta de '+maxRun);drop.push(r.elev.start-r.elev.end);}}
 assert.ok(n>=30,'poucos rios '+n);assert.ok(mean(drop)>0,'rios devem descer em média: '+mean(drop).toFixed(3));});
check('Lagos grandes têm margem irregular (perímetro/círculo ≥ 1,3 em média)',()=>{const v=[];for(const c of [{map:'random',options:{landscape:'lakes'}},{map:'random',options:{landscape:'continent',water:.8}}])for(let seed=1;seed<=10;seed++)v.push(...lakeShape(make(c,seed)));assert.ok(v.length>=20,'poucos lagos '+v.length);assert.ok(mean(v)>=1.3,'margem '+mean(v).toFixed(2));});
check('Deserto: oásis (≥ 2 corpos d\'água, cada um com campo irrigado a até 3 casas)',()=>{for(let seed=1;seed<=10;seed++){const g=make({map:'desert'},seed),oases=components(g,t=>t==='river').filter(c=>c.length>=6&&c.some(k=>{const x=k%COLS,y=(k-x)/COLS;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(x+dx>=0&&y+dy>=0&&x+dx<COLS&&y+dy<ROWS&&g.terrain[(y+dy)*COLS+x+dx]==='field')return true;return false;}));assert.ok(oases.length>=2,'oásis '+seed+': '+oases.length);}});
console.log(checks+' verificações de água concluídas.');}
// --- T5: matas naturais ---
{let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
const forestCfgs=[{map:'river'},{map:'mountain'},{map:'random',options:{landscape:'continent'}},{map:'random',options:{landscape:'lakes'}}];
check('Mata ribeirinha: mais mata perto do rio que no mapa todo (≥ 1,8×)',()=>{let near=0,nearForest=0,land=0,landForest=0;for(const c of forestCfgs)for(let seed=1;seed<=10;seed++){const g=make(c,seed);for(let k=0;k<SIZE;k++){const t=g.terrain[k];if(t==='river'||t==='bridge')continue;land++;if(t==='forest')landForest++;const x=k%COLS,y=(k-x)/COLS;let close=false;for(let dy=-2;dy<=2&&!close;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&y+dy>=0&&x+dx<COLS&&y+dy<ROWS&&g.terrain[(y+dy)*COLS+x+dx]==='river'){close=true;break;}if(close){near++;if(t==='forest')nearForest++;}}}
 const ratio=(nearForest/near)/(landForest/land);assert.ok(ratio>=1.8,'razão ribeirinha '+ratio.toFixed(2));});
check('Matas grandes têm clareiras e borda irregular',()=>{let forests=0,clearings=0,edge=[];for(const c of forestCfgs)for(let seed=1;seed<=10;seed++){const g=make(c,seed);forests+=components(g,t=>t==='forest').filter(cells=>cells.length>=150).length;
  for(const cells of components(g,t=>t!=='forest')){if(cells.length<2||cells.length>40)continue;const set=new Set(cells);let enclosed=true;for(const k of cells){const x=k%COLS,y=(k-x)/COLS;for(const [dx,dy] of NEIGH){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=COLS||ny>=ROWS){enclosed=false;continue;}const n=ny*COLS+nx;if(!set.has(n)&&g.terrain[n]!=='forest')enclosed=false;}}if(enclosed)clearings++;}edge.push(forestEdge(g));}
 assert.ok(forests>=10,'poucas matas grandes '+forests);assert.ok(clearings>=forests/2,'clareiras '+clearings+' para '+forests+' matas');assert.ok(mean(edge)>=5.5,'borda '+mean(edge).toFixed(2));});
console.log(checks+' verificações de mata concluídas.');}
// --- T6: lavouras orgânicas ---
{let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
check('Lavouras sem xadrez: sebes raramente em reta, campo aberto e lotes de tamanhos variados',()=>{const farm=[{map:'river'},{map:'mountain'},{map:'random',options:{landscape:'continent'}},{map:'random',options:{landscape:'lakes'}}];const hedge=[],sizes=[],plain=[];
 for(const c of farm)for(let seed=1;seed<=10;seed++){const g=make(c,seed);if(g.terrain.includes('hedge'))hedge.push(straightShare(g,'hedge'));for(const cells of components(g,t=>t==='field'))if(cells.length>=10)sizes.push(cells.length);if(c.map==='random'&&c.options.landscape==='continent')plain.push(share(g,'plain'));}
 assert.ok(mean(hedge)<=.25,'sebes em reta '+mean(hedge).toFixed(2));assert.ok(mean(plain)>=.30,'planície no Continente '+mean(plain).toFixed(2));
 const m=mean(sizes),cv=Math.sqrt(mean(sizes.map(v=>(v-m)**2)))/m;assert.ok(cv>=.4,'variação dos lotes '+cv.toFixed(2));});
console.log(checks+' verificações de lavoura concluídas.');}
// --- determinismo: mesma semente e opções geram o mesmo terreno, minas e estruturas ---
{let checks=0;function check(name,fn){fn();checks++;console.log('OK '+name);}
check('Determinismo: 8 configurações × 5 sementes geram terreno, minas e estruturas idênticos',()=>{for(const c of configs)for(let seed=1;seed<=5;seed++){const a=make(c,seed),b=make(c,seed),key=g=>JSON.stringify([g.terrain,g.mines.map(m=>[m.x,m.y]),g.structures.map(s=>[s.type,s.x,s.y,s.owner])]);assert.equal(key(a),key(b),JSON.stringify(c)+' '+seed);}});
console.log(checks+' verificações de determinismo concluídas.');}
if(process.argv.includes('--metrics')){console.log('configuração'.padEnd(44),'xadrez escada reta borda sopé planície água colina montanha');for(const c of configs){const rows=[];for(let seed=1;seed<=8;seed++){const g=make(c,seed),r=roadShape(g);rows.push([straightShare(g,'hedge'),r.stair,r.meanRun,forestEdge(g),foothills(g),share(g,'plain'),share(g,'river','bridge'),share(g,'hill'),share(g,'mountain')]);}
 console.log(JSON.stringify(c).padEnd(44),rows[0].map((_,i)=>mean(rows.map(r=>r[i])).toFixed(2).padStart(6)).join(' '));}}
