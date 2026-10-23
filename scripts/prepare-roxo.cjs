// Incorpora a arte do time roxo de assets/NovosTimes/roxo/sources para uso offline em public/js/assets.js.
// As fontes são PNG com paleta e fundo branco (sem alfa): o fundo é removido por preenchimento a partir das bordas, depois recorte pelo alfa e redução por média (128 px; aviões 256 px). Node puro, sem navegador.
'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),dir=path.join(root,'assets','NovosTimes','roxo'),src=path.join(dir,'sources'),file=path.join(root,'public','js','assets.js');
// tipo do jogo -> arquivo-fonte (o 19-caca-bombardeiro é um caça e não é usado)
const PLANES={fighterRoxo:'14-caca-delta-canard',multiroleRoxo:'15-caca-multifuncao',stealthFighterRoxo:'16-caca-quinta-geracao',bomberRoxo:'17-bombardeiro-asa-voadora'};
const GROUND={lightTank:'02-tanque-sensores-laterais',tank:'01-tanque-pesado',heavyTank:'03-tanque-assalto-pesado',artillery:'04-obuseiro-autopropulsado',recon:'05-blindado-6x6',antiAirVehicle:'06-caminhao-lancador-8x8',rocketArtillery:'07-lancador-fechado',transportTruck:'08-caminhao-transporte-6x6',helicopter:'09-helicoptero-ataque-4-pas',helicopterGround:'10-helicoptero-ataque-5-pas',helicopterAir:'11-helicoptero-reconhecimento',transportHelicopter:'12-convertiplano',transportPlane:'13-aviao-carga',reconDrone:'18-drone-reconhecimento'};
const LAUNCH=['lancamento/T1-transicao','lancamento/T2-aberto'];
const PLACEHOLDER={stealthDrone:path.join(root,'assets','NovosTimes','azul','stealthDrone.png')}; // sem arte roxa: azul recolorido
const WHITE=236,SOFT=200;
const BPP={2:3,3:1,6:4};
function decode(buf){
 assert.equal(buf.subarray(1,4).toString(),'PNG');let pos=8,w,h,depth,type,idat=[],plte=null,trns=null;
 while(pos<buf.length){const len=buf.readUInt32BE(pos),t=buf.toString('latin1',pos+4,pos+8),body=buf.subarray(pos+8,pos+8+len);pos+=12+len;
  if(t==='IHDR'){w=body.readUInt32BE(0);h=body.readUInt32BE(4);depth=body[8];type=body[9];assert.ok(depth===8&&BPP[type]&&body[12]===0,'PNG precisa ser de 8 bits, cor tipo 2, 3 ou 6, sem entrelaçamento');}
  else if(t==='PLTE')plte=body;else if(t==='tRNS')trns=body;else if(t==='IDAT')idat.push(body);}
 const bpp=BPP[type],raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*bpp,px=Buffer.alloc(h*stride);
 for(let y=0;y<h;y++){const f=raw[y*(stride+1)],s=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)),row=px.subarray(y*stride,(y+1)*stride),prev=y?px.subarray((y-1)*stride,y*stride):null;
  for(let x=0;x<stride;x++){const a=x>=bpp?row[x-bpp]:0,b=prev?prev[x]:0,c=prev&&x>=bpp?prev[x-bpp]:0;let p=0;
   if(f===1)p=a;else if(f===2)p=b;else if(f===3)p=(a+b)>>1;else if(f===4){const q=a+b-c,pa=Math.abs(q-a),pb=Math.abs(q-b),pc=Math.abs(q-c);p=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
   row[x]=(s[x]+p)&255;}}
 const data=Buffer.alloc(w*h*4);
 for(let i=0;i<w*h;i++){
  if(type===6){px.copy(data,i*4,i*3+i,i*3+i+4);}
  else if(type===2){data[i*4]=px[i*3];data[i*4+1]=px[i*3+1];data[i*4+2]=px[i*3+2];data[i*4+3]=255;}
  else{const k=px[i];data[i*4]=plte[k*3];data[i*4+1]=plte[k*3+1];data[i*4+2]=plte[k*3+2];data[i*4+3]=trns&&k<trns.length?trns[k]:255;}
 }
 return{w,h,data};
}
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=b=>{let c=~0;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return ~c>>>0;};
function encode(w,h,data){
 const raw=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;data.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}
 const chunk=(type,body)=>{const b=Buffer.alloc(12+body.length);b.writeUInt32BE(body.length,0);b.write(type,4,'latin1');body.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,8+body.length)),8+body.length);return b;};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
// Fundo branco: só os pixels brancos ligados às bordas viram transparentes (o lilás claro dentro do casco fica).
function removeBackground(img){
 const {w,h,data}=img,bg=new Uint8Array(w*h),stack=[],white=i=>data[i*4]>=WHITE&&data[i*4+1]>=WHITE&&data[i*4+2]>=WHITE;
 const push=i=>{if(!bg[i]&&white(i)){bg[i]=1;stack.push(i);}};
 for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}
 while(stack.length){const i=stack.pop(),x=i%w,y=(i-x)/w;if(x>0)push(i-1);if(x<w-1)push(i+1);if(y>0)push(i-w);if(y<h-1)push(i+w);}
 for(let i=0;i<w*h;i++)if(bg[i])data[i*4+3]=0;
 // borda suave: pixel claro encostado no fundo vira semitransparente, proporcional ao quanto é branco
 const soft=[];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(bg[i])continue;const m=Math.min(data[i*4],data[i*4+1],data[i*4+2]);if(m<SOFT)continue;
  let near=false;for(let dy=-1;dy<=1&&!near;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<w&&ny<h&&bg[ny*w+nx]){near=true;break;}}
  if(near)soft.push([i,Math.max(0,Math.min(255,Math.round(255*(255-m)/(255-SOFT))))]);}
 for(const [i,a] of soft)data[i*4+3]=Math.min(data[i*4+3],a);
 return img;
}
function bounds(img){let l=img.w,t=img.h,r=-1,b=-1,clear=0;
 for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++){const a=img.data[(y*img.w+x)*4+3];if(!a)clear++;if(a>8){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}}
 return{l,t,r,b,clear};}
// Recorte pelo alfa e redução por média ponderada pelo alfa.
function tile(img,size,fill,name){
 const {l,t,r,b,clear}=bounds(img);assert.ok(r>=l&&clear>img.w*img.h*.05,name+': transparência real ausente');
 const w=r-l+1,h=b-t+1,s=fill/Math.max(w,h),ow=Math.round(w*s),oh=Math.round(h*s),ox=Math.floor((size-ow)/2),oy=Math.floor((size-oh)/2),out=Buffer.alloc(size*size*4);
 for(let y=0;y<oh;y++)for(let x=0;x<ow;x++){
  const x0=l+x/s,x1=l+(x+1)/s,y0=t+y/s,y1=t+(y+1)/s;let R=0,G=0,B=0,A=0,n=0;
  for(let yy=Math.floor(y0);yy<Math.min(img.h,Math.ceil(y1));yy++)for(let xx=Math.floor(x0);xx<Math.min(img.w,Math.ceil(x1));xx++){const k=(yy*img.w+xx)*4,a=img.data[k+3];R+=img.data[k]*a;G+=img.data[k+1]*a;B+=img.data[k+2]*a;A+=a;n++;}
  const k=((oy+y)*size+ox+x)*4;if(A){out[k]=Math.round(R/A);out[k+1]=Math.round(G/A);out[k+2]=Math.round(B/A);out[k+3]=Math.round(A/n);}
 }
 return{size,data:out};
}
const fromSource=name=>removeBackground(decode(fs.readFileSync(path.join(src,name+'.png'))));
const save=(name,t)=>{const png=encode(t.size,t.size,t.data);fs.writeFileSync(path.join(dir,name.replace(/[\\/]/g,'-')+'.png'),png);return 'data:image/png;base64,'+png.toString('base64');};
// Placeholder: gira o matiz do sprite azul para violeta (mantém luminosidade e alfa).
function recolor(img,hue){
 for(let i=0;i<img.w*img.h;i++){const r=img.data[i*4]/255,g=img.data[i*4+1]/255,b=img.data[i*4+2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;if(!d)continue;
  const s=d/(1-Math.abs(2*l-1)),c=(1-Math.abs(2*l-1))*Math.min(1,s*1.15),hh=hue/60,x=c*(1-Math.abs(hh%2-1)),m=l-c/2;
  const [rr,gg,bb]=hh<1?[c,x,0]:hh<2?[x,c,0]:hh<3?[0,c,x]:hh<4?[0,x,c]:hh<5?[x,0,c]:[c,0,x];
  img.data[i*4]=Math.round((rr+m)*255);img.data[i*4+1]=Math.round((gg+m)*255);img.data[i*4+2]=Math.round((bb+m)*255);}
 return img;
}
const planes={},ground={},sheet=[];
for(const [type,name] of Object.entries(PLANES)){const t=tile(fromSource(name),256,244,name);planes[type]=save(type,t);sheet.push([type,t]);}
for(const [type,name] of Object.entries(GROUND)){const t=tile(fromSource(name),128,116,name);ground[type]=save(type,t);sheet.push([type,t]);}
let usedPlaceholder=false;
for(const [type,from] of Object.entries(PLACEHOLDER)){ // arte roxa real, se existir em sources/<tipo>.png; senão o azul recolorido
 const real=fs.existsSync(path.join(src,type+'.png')),t=tile(real?fromSource(type):recolor(decode(fs.readFileSync(from)),275),128,116,type);usedPlaceholder||=!real;ground[type]=save(type,t);sheet.push([type,t]);}
const launch=LAUNCH.map(n=>{const t=tile(fromSource(n),128,116,n);sheet.push([n,t]);return save(n,t);});
const block='// ROXO_ASSETS_BEGIN\n// Time roxo (transporte pesado): aviões entram em planeSpriteData; o resto é por tipo, frente para cima; lançador: [transição, elevado].\n'+(usedPlaceholder?'// placeholder: stealthDrone (azul recolorido, trocar quando chegar a arte roxa do drone furtivo)\n':'')+'Object.assign(planeSpriteData,'+JSON.stringify(planes)+');\nconst roxoSpriteData='+JSON.stringify(ground)+';\nconst roxoLaunchData='+JSON.stringify(launch)+';\n// ROXO_ASSETS_END';
const js=fs.readFileSync(file,'utf8');
fs.writeFileSync(file,js.includes('// ROXO_ASSETS_BEGIN')?js.replace(/\/\/ ROXO_ASSETS_BEGIN[\s\S]*?\/\/ ROXO_ASSETS_END/,()=>block):js.trimEnd()+'\n'+block+'\n');
// Folha de conferência sobre fundo de terreno: um halo branco ficaria visível.
{const cols=7,cell=132,rows=Math.ceil(sheet.length/cols),W=cols*cell,H=rows*cell,out=Buffer.alloc(W*H*4);
 for(let i=0;i<W*H;i++){out[i*4]=58;out[i*4+1]=86;out[i*4+2]=52;out[i*4+3]=255;}
 sheet.forEach(([,t],n)=>{const ox=(n%cols)*cell+2,oy=Math.floor(n/cols)*cell+2,k=t.size/128;
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){let R=0,G=0,B=0,A=0;for(let yy=0;yy<k;yy++)for(let xx=0;xx<k;xx++){const p=((Math.floor(y*k)+yy)*t.size+Math.floor(x*k)+xx)*4;R+=t.data[p];G+=t.data[p+1];B+=t.data[p+2];A+=t.data[p+3];}
   const a=A/(k*k)/255,o=((oy+y)*W+ox+x)*4;out[o]=Math.round(R/(k*k)*a+out[o]*(1-a));out[o+1]=Math.round(G/(k*k)*a+out[o+1]*(1-a));out[o+2]=Math.round(B/(k*k)*a+out[o+2]*(1-a));}});
 fs.writeFileSync(path.join(root,'reports','roxo-2026-10-22','folha-arte.png'),encode(W,H,out));}
console.log('OK '+Object.keys(planes).length+' aviões e '+Object.keys(ground).length+' unidades terrestres/aéreas e '+launch.length+' quadros do lançador do Roxo incorporados em public/js/assets.js.');
