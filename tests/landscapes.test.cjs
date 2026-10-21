'use strict';
// Paisagens do mapa procedural: Continente (idêntico ao gerador antigo), Lagos, Ilhas e Serras.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const E=new Function(fs.readFileSync(path.join(__dirname,'..','public','js','engine.js'),'utf8')+'\nreturn {Game,COLS,ROWS,KEY,landscapeOf,LANDSCAPE_LIST};')();
const {Game,COLS,ROWS,KEY,landscapeOf,LANDSCAPE_LIST}=E;
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h;};
const make=(landscape,seed,o={})=>new Game('random','normal',seed,'turns',{landscape,...o});
const share=(g,t)=>g.terrain.filter(v=>v===t).length/g.terrain.length;
// Componentes 4-conectados das casas com pred(terreno); devolve os tamanhos e se cada um toca a borda do mapa.
function components(g,pred){const seen=new Uint8Array(COLS*ROWS),out=[];for(let k=0;k<COLS*ROWS;k++){if(seen[k]||!pred(g.terrain[k]))continue;let n=0,edge=false;const stack=[k];seen[k]=1;while(stack.length){const c=stack.pop(),x=c%COLS,y=(c-x)/COLS;n++;if(x===0||y===0||x===COLS-1||y===ROWS-1)edge=true;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;const n2=KEY(nx,ny);if(!seen[n2]&&pred(g.terrain[n2])){seen[n2]=1;stack.push(n2);}}}out.push({size:n,edge});}return out;}
// Bases ligadas por tanque, todo posto alcançável e mapa simétrico por ponto (mesmas garantias de engine.test.cjs).
function connected(g,label){g.units=[];const tank={type:'tank',owner:'blue',x:4,y:ROWS-2};assert.ok(g.findPath(tank,{x:COLS-5,y:1}),'bases desconectadas '+label);for(const p of g.structures.filter(s=>s.type==='post'))assert.ok([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>g.findPath(tank,{x:p.x+dx,y:p.y+dy})),'posto inalcançável '+label);for(let k=0;k<COLS*ROWS;k++)assert.equal(g.terrain[k],g.terrain[COLS*ROWS-1-k],'assimetria '+label);}

test('continente idêntico ao gerador anterior',()=>{const ref=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','continent-terrain.json'),'utf8'));assert.equal(ref.length,60);for(const {seed,options,hash} of ref){assert.equal(fnv(new Game('random','normal',seed,'turns',options).terrain.join(',')),hash,'sem opção '+seed);assert.equal(fnv(new Game('random','normal',seed,'turns',{...options,landscape:'continent'}).terrain.join(',')),hash,'continent '+seed);}});
test('auto sorteia as quatro paisagens pela semente',()=>{const count={};for(let seed=1;seed<=60;seed++){const l=landscapeOf(seed,'auto');count[l]=(count[l]||0)+1;assert.equal(landscapeOf(seed,'auto'),l);}for(const l of LANDSCAPE_LIST)assert.ok(count[l]>=8,l+' '+count[l]);assert.equal(make('auto',7).landscape,landscapeOf(7,'auto'));});
test('opção inválida vira continente e mapas fixos ignoram a paisagem',()=>{assert.equal(make('vulcão',5).landscape,'continent');assert.equal(make(undefined,5).landscape,'continent');assert.equal(new Game('river','normal',5,'turns',{landscape:'islands'}).landscape,'continent');});
module.exports={make,share,components,connected,test,tests};
if(require.main===module){for(const [name,fn] of tests){fn();console.log('OK '+name);}console.log(tests.length+' verificações de paisagem passaram.');}
