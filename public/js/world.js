'use strict';
/* Mapa-múndi da campanha: continentes, biomas e regiões gerados por semente; regras de conquista. Sem DOM (testado em Node). */
const WORLD={w:96,h:48,cols:10,rows:5};
const BIOMES={
 temperate:{name:'Planície temperada',color:'#86a265',map:'river',terrain:'Bocage com rio central'},
 arid:{name:'Deserto',color:'#d4ba82',map:'desert',terrain:'Dunas, oásis e estradas longas'},
 highland:{name:'Planalto montanhoso',color:'#9b967d',map:'mountain',terrain:'Serra com passagens'},
 wetland:{name:'Terras alagadas',color:'#6f9e88',map:'random',options:{water:.8,forest:.35,relief:.2,farmland:.45,posts:8},terrain:'Rios, lagos e campos'},
 woodland:{name:'Floresta densa',color:'#5b7f56',map:'random',options:{water:.3,forest:.85,relief:.35,farmland:.25,posts:8},terrain:'Florestas e colinas'}
};
const HARDER={easy:'normal',normal:'hard',hard:'veteran',veteran:'veteran'};
// Ruído de valor contínuo (bilinear suavizado) sobre o retângulo do mundo.
function worldNoise(rng,scale){
 const w=Math.ceil(WORLD.w/scale)+2,h=Math.ceil(WORLD.h/scale)+2,g=Array.from({length:w*h},()=>rng()),s=t=>t*t*(3-2*t);
 return(x,y)=>{const fx=Math.max(0,x)/scale,fy=Math.max(0,y)/scale,ix=Math.floor(fx),iy=Math.floor(fy),tx=s(fx-ix),ty=s(fy-iy),v=(a,b)=>g[Math.min(h-1,iy+b)*w+Math.min(w-1,ix+a)];return(v(0,0)*(1-tx)+v(1,0)*tx)*(1-ty)+(v(0,1)*(1-tx)+v(1,1)*tx)*ty;};
}
function regionName(rng,used){
 const a=['Val','Mar','Bel','Cor','Dor','Fal','Gran','Lor','Mon','Nor','Ost','Pra','Ros','Sar','Ter','Vel','Alt','Bran','Cas','Esp','Lis','Tor'],b=['a','e','i','o','ar','en','or','il','an','ur'],c=['via','dor','mar','nia','lia','sto','vale','ria','gal','mont','rre','zia','lha','nde'];
 for(let i=0;;i++){const pick=list=>list[Math.floor(rng()*list.length)],n=pick(a)+pick(b)+pick(c),name=i<20?n:n+' '+(i-18);if(!used.has(name)){used.add(name);return name;}}
}
function generateWorld(seed){
 seed=seed>>>0||1;const rng=seeded(seed),{w,h,cols,rows}=WORLD;
 const continents=worldNoise(rng,16),detail=worldNoise(rng,6),moist=worldNoise(rng,12);
 // Elevação com queda nas bordas: o mundo fica cercado de oceano.
 const elevation=(x,y)=>{const edge=Math.min(1,Math.min(x,w-x)/(w*.12),Math.min(y,h-y)/(h*.16));return(continents(x,y)*.7+detail(x,y)*.3)*Math.sqrt(Math.max(0,edge));};
 const samples=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)samples.push(elevation(x+.5,y+.5));samples.sort((p,q)=>p-q);
 const points=[];for(let gy=0;gy<rows;gy++)for(let gx=0;gx<cols;gx++)points.push({x:(gx+.15+.7*rng())*w/cols,y:(gy+.15+.7*rng())*h/rows});
 // Mar no quantil de 50%; se sobrarem poucas regiões em terra, o nível do mar baixa.
 let sea,land,centers;for(let q=.5;q>=.2;q-=.05){sea=samples[Math.floor(samples.length*q)];land=(x,y)=>elevation(x,y)>sea;centers=points.filter(p=>land(p.x,p.y));if(centers.length>=14)break;}
 const used=new Set(),reach=Math.hypot(w/cols,h/rows)*1.2;
 const regions=centers.map((p,id)=>{const e=(elevation(p.x,p.y)-sea)/Math.max(1e-9,1-sea),lat=Math.abs(p.y/h-.5)*2,m=moist(p.x,p.y);
  const biome=e>.5?'highland':lat<.5&&m<.42?'arid':m>.66?(e<.18?'wetland':'woodland'):'temperate';return{id,x:p.x,y:p.y,biome,name:regionName(rng,used),neighbors:[]};});
 // Região de cada ponto do mapa: a mais próxima em terra (até um limite; ilhas soltas ficam sem região).
 const regionAt=(x,y)=>{if(!land(x,y))return -1;let best=-1,bd=reach;for(const r of regions){const d=Math.hypot(r.x-x,r.y-y);if(d<bd){bd=d;best=r.id;}}return best;};
 const cells=new Int16Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)cells[y*w+x]=regionAt(x+.5,y+.5);
 const link=(a,b)=>{if(a!==b&&!regions[a].neighbors.includes(b)){regions[a].neighbors.push(b);regions[b].neighbors.push(a);}};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=cells[y*w+x];if(a<0)continue;if(x+1<w&&cells[y*w+x+1]>=0)link(a,cells[y*w+x+1]);if(y+1<h&&cells[(y+1)*w+x]>=0)link(a,cells[(y+1)*w+x]);}
 // Rotas marítimas: ligam as massas de terra pelas regiões mais próximas até o grafo ficar conexo.
 const lanes=[],component=()=>{const id=new Array(regions.length).fill(-1);let n=0;for(const r of regions){if(id[r.id]>=0)continue;const stack=[r.id];id[r.id]=n;while(stack.length){const c=stack.pop();for(const m of regions[c].neighbors)if(id[m]<0){id[m]=n;stack.push(m);}}n++;}return id;};
 for(let comp=component();new Set(comp).size>1;comp=component()){let best=null;for(const a of regions)for(const b of regions)if(comp[a.id]===0&&comp[b.id]!==0){const d=Math.hypot(a.x-b.x,a.y-b.y);if(!best||d<best.d)best={a:a.id,b:b.id,d};}link(best.a,best.b);lanes.push([best.a,best.b]);}
 // QGs: o azul na região mais a oeste; o vermelho na mais distante em saltos pelo grafo.
 const blue=regions.slice().sort((p,q)=>p.x-q.x||p.y-q.y)[0].id,hops=new Array(regions.length).fill(Infinity),queue=[blue];hops[blue]=0;
 while(queue.length){const c=queue.shift();for(const m of regions[c].neighbors)if(hops[m]===Infinity){hops[m]=hops[c]+1;queue.push(m);}}
 const red=regions.slice().sort((p,q)=>hops[q.id]-hops[p.id]||q.x-p.x)[0].id;
 return{seed,w,h,regions,cells,lanes,homes:{blue,red},land,regionAt,elevation:(x,y)=>(elevation(x,y)-sea)/Math.max(1e-9,1-sea)};
}
function newCampaign(seed,difficulty='normal',mode='turns'){
 const world=generateWorld(seed);
 return{version:1,seed:world.seed,difficulty:HARDER[difficulty]?difficulty:'normal',mode:mode==='rts'?'rts':'turns',battles:0,current:null,events:[],world,owners:world.regions.map(r=>r.id===world.homes.blue?'blue':r.id===world.homes.red?'red':'neutral')};
}
function campaignOver(c){return c.owners[c.world.homes.red]==='blue'?'blue':c.owners[c.world.homes.blue]==='red'?'red':null;}
function canAttack(c,id){const r=c.world.regions[id];return !!r&&!campaignOver(c)&&c.owners[id]!=='blue'&&r.neighbors.some(n=>c.owners[n]==='blue');}
// Batalha da região: mapa e opções pelo bioma, semente derivada (muda a cada tentativa); território vermelho é um nível mais difícil.
function battleFor(c,id){
 const r=c.world.regions[id],b=BIOMES[r.biome];
 return{map:b.map,options:{...(b.options||{})},seed:((c.seed^Math.imul(id+1,2654435761)^Math.imul(c.battles+1,40503))>>>0)||1,difficulty:c.owners[id]==='red'?HARDER[c.difficulty]:c.difficulty,mode:c.mode,title:r.name+' · '+b.name};
}
// Resultado: vitória conquista a região; derrota abre um contra-ataque vermelho. Depois de cada batalha o vermelho ocupa uma região neutra vizinha.
function applyResult(c,id,won){
 const name=i=>c.world.regions[i].name,events=[];c.battles++;c.current=null;
 if(won){c.owners[id]='blue';events.push(`${name(id)} conquistada.`);}
 else{const targets=c.world.regions.filter(r=>c.owners[r.id]==='blue'&&r.neighbors.some(n=>c.owners[n]==='red')),pick=targets.find(r=>r.id!==c.world.homes.blue)||targets[0];
  events.push(`Ataque a ${name(id)} repelido.`);if(pick){c.owners[pick.id]='red';events.push(`Contra-ataque inimigo tomou ${name(pick.id)}.`);}}
 if(!campaignOver(c)){const neutral=c.world.regions.filter(r=>c.owners[r.id]==='neutral'&&r.neighbors.some(n=>c.owners[n]==='red'));if(neutral.length){const r=neutral[(c.seed+c.battles*7)%neutral.length];c.owners[r.id]='red';events.push(`O inimigo ocupou ${name(r.id)}.`);}}
 const over=campaignOver(c);if(over)events.push(over==='blue'?'Campanha vencida: o QG inimigo caiu.':'Campanha perdida: seu QG caiu.');
 c.events=events;return events;
}
function serializeCampaign(c){return JSON.stringify({version:1,seed:c.seed,difficulty:c.difficulty,mode:c.mode,battles:c.battles,current:c.current,events:c.events,owners:c.owners});}
function deserializeCampaign(text){
 try{const d=JSON.parse(text);if(d?.version!==1||!Number.isInteger(d.seed))return null;const c=newCampaign(d.seed,d.difficulty,d.mode);
  if(!Array.isArray(d.owners)||d.owners.length!==c.owners.length||!d.owners.every(o=>['blue','red','neutral'].includes(o)))return null;
  return Object.assign(c,{battles:Number(d.battles)||0,current:Number.isInteger(d.current)&&d.current>=0&&d.current<c.owners.length?d.current:null,events:Array.isArray(d.events)?d.events.map(String):[],owners:d.owners});
 }catch{return null;}
}
