'use strict';
// Paisagens do mapa procedural: Continente, Lagos, Ilhas e Serras (o determinismo está em tests/maps.test.cjs).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const E=new Function(fs.readFileSync(path.join(__dirname,'..','public','js','engine.js'),'utf8')+'\nreturn {Game,COLS,ROWS,KEY,landscapeOf,LANDSCAPE_LIST};')();
const {Game,COLS,ROWS,KEY,landscapeOf,LANDSCAPE_LIST}=E;
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const make=(landscape,seed,o={})=>new Game('random','normal',seed,'turns',{landscape,...o});
const share=(g,t)=>g.terrain.filter(v=>v===t).length/g.terrain.length;
// Componentes 4-conectados das casas com pred(terreno); devolve os tamanhos e se cada um toca a borda do mapa.
function components(g,pred){const seen=new Uint8Array(COLS*ROWS),out=[];for(let k=0;k<COLS*ROWS;k++){if(seen[k]||!pred(g.terrain[k]))continue;let n=0,edge=false;const stack=[k];seen[k]=1;while(stack.length){const c=stack.pop(),x=c%COLS,y=(c-x)/COLS;n++;if(x===0||y===0||x===COLS-1||y===ROWS-1)edge=true;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;const n2=KEY(nx,ny);if(!seen[n2]&&pred(g.terrain[n2])){seen[n2]=1;stack.push(n2);}}}out.push({size:n,edge});}return out;}
// Bases ligadas por tanque, todo posto alcançável por alguma casa do seu perímetro (o espelho do posto abre pelo lado oposto) e mapa simétrico por ponto (mesmas garantias de engine.test.cjs).
function connected(g,label){g.units=[];const tank={type:'tank',owner:'blue',x:4,y:ROWS-2};assert.ok(g.findPath(tank,{x:COLS-5,y:1}),'bases desconectadas '+label);for(const p of g.structures.filter(s=>s.type==='post')){const ring=[];for(let i=-1;i<=p.width;i++)for(let j=-1;j<=p.height;j++)if(i<0||j<0||i>=p.width||j>=p.height)ring.push({x:p.x+i,y:p.y+j});assert.ok(ring.some(c=>g.findPath(tank,c)),'posto inalcançável '+label+' '+p.x+','+p.y);}for(let k=0;k<COLS*ROWS;k++)assert.equal(g.terrain[k],g.terrain[COLS*ROWS-1-k],'assimetria '+label);}

test('auto sorteia as quatro paisagens pela semente',()=>{const count={};for(let seed=1;seed<=60;seed++){const l=landscapeOf(seed,'auto');count[l]=(count[l]||0)+1;assert.equal(landscapeOf(seed,'auto'),l);}for(const l of LANDSCAPE_LIST)assert.ok(count[l]>=8,l+' '+count[l]);assert.equal(make('auto',7).landscape,landscapeOf(7,'auto'));});
test('opção inválida vira continente e mapas fixos ignoram a paisagem',()=>{assert.equal(make('vulcão',5).landscape,'continent');assert.equal(make(undefined,5).landscape,'continent');assert.equal(new Game('river','normal',5,'turns',{landscape:'islands'}).landscape,'continent');});
test('lagos: água, lagos grandes, ilhas, conexão e minas',()=>{let withIsland=0;for(let seed=1;seed<=30;seed++)for(const o of [{},{forest:1,farmland:1,posts:12}]){const g=make('lakes',seed,o),label='lakes/'+seed;
 const w=share(g,'river');assert.ok(w>=.12&&w<=.28,label+' água '+w.toFixed(3));assert.ok(share(g,'mountain')<=.04,label+' montanha');
 assert.ok(components(g,t=>t==='river').filter(c=>c.size>=40).length>=4,label+' lagos grandes');
 if(!Object.keys(o).length&&components(g,t=>t!=='river').some(c=>c.size>=4&&c.size<=150&&!c.edge))withIsland++;
 connected(g,label);assert.equal(g.mines.length,8,label+' minas');assert.equal(g.structures.filter(s=>s.type==='post').length,o.posts||24,label+' postos');}
 assert.ok(withIsland>=15,'ilha em '+withIsland+'/30 sementes');});
test('ilhas: mar, massas de terra, pontes, conexão, aeroportos e minas',()=>{let withAirport=0;for(let seed=1;seed<=30;seed++){const g=make('islands',seed),label='islands/'+seed;
 const w=share(g,'river');assert.ok(w>=.30&&w<=.50,label+' água '+w.toFixed(3));assert.ok(share(g,'mountain')<=.04,label+' montanha');
 assert.ok(components(g,t=>t!=='river'&&t!=='bridge').filter(c=>c.size>=150).length>=3,label+' massas de terra');
 assert.ok(g.terrain.includes('bridge'),label+' sem ponte');connected(g,label);assert.equal(g.mines.length,8,label+' minas');
 const tank={type:'tank',owner:'blue',x:4,y:ROWS-2};for(const a of g.structures.filter(s=>s.type==='airportAsphalt'&&s.owner==='neutral')){withAirport++;for(let y=a.y;y<a.y+a.height;y++)for(let x=a.x;x<a.x+a.width;x++)assert.notEqual(g.terrain[KEY(x,y)],'river',label+' aeroporto na água');
  const ring=[];for(let i=-1;i<=a.width;i++)for(let j=-1;j<=a.height;j++)if(i<0||j<0||i>=a.width||j>=a.height)ring.push({x:a.x+i,y:a.y+j});assert.ok(ring.some(c=>g.findPath(tank,c)),label+' aeroporto inalcançável');}}
 assert.ok(withAirport>0,'nenhum aeroporto neutro gerado nas 30 sementes');});
test('serras: montanha, planalto, passagens, conexão e minas',()=>{for(let seed=1;seed<=30;seed++){const g=make('highlands',seed),label='highlands/'+seed,at=(x,y)=>x<0||y<0||x>=COLS||y>=ROWS?undefined:g.terrain[KEY(x,y)];
 const m=share(g,'mountain');assert.ok(m>=.12&&m<=.24,label+' montanha '+m.toFixed(3));assert.ok(share(g,'hill')>=.18,label+' colina');assert.ok(share(g,'river')<=.08,label+' água');
 let gaps=0;for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){if(at(x,y)==='mountain')continue;const side=(dx,dy)=>[1,2].some(k=>at(x+dx*k,y+dy*k)==='mountain');if(side(1,0)&&side(-1,0)||side(0,1)&&side(0,-1))gaps++;}
 assert.ok(gaps>=6,label+' passagens '+gaps);connected(g,label);assert.equal(g.mines.length,8,label+' minas');}});
module.exports={make,share,components,connected,test,tests};
if(require.main===module){for(const [name,fn] of tests){fn();console.log('OK '+name);}console.log(tests.length+' verificações de paisagem passaram.');}
