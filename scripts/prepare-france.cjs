// Incorpora a arte do time azul (França) de assets/NovosTimes/azul/sources para uso offline em public/js/assets.js.
// Recorte pelo alfa e redução por média (128 px; aviões 256 px), em Node puro: sem navegador.
'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),dir=path.join(root,'assets','NovosTimes','azul'),file=path.join(root,'public','js','assets.js');
const PLANES=['fighterFr','multiroleFr','bomberFr','stealthFighterFr'];
const GROUND=['lightTank','tank','heavyTank','artillery','recon','antiAirVehicle','rocketArtillery','transportTruck','transportHelicopter','transportPlane','helicopter','helicopterGround','helicopterAir','transportTruck','reconDrone','stealthDrone'];
const LAUNCH=['rocketArtillery-launch-transition','rocketArtillery-launch-ready'];
function decode(buf){
 assert.equal(buf.subarray(1,4).toString(),'PNG');let pos=8,w,h,idat=[];
 while(pos<buf.length){const len=buf.readUInt32BE(pos),type=buf.toString('latin1',pos+4,pos+8),body=buf.subarray(pos+8,pos+8+len);pos+=12+len;
  if(type==='IHDR'){w=body.readUInt32BE(0);h=body.readUInt32BE(4);assert.ok(body[8]===8&&body[9]===6&&body[12]===0,'PNG precisa ser RGBA 8 bits sem entrelaçamento');}
  else if(type==='IDAT')idat.push(body);}
 const raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*4,out=Buffer.alloc(h*stride);
 for(let y=0;y<h;y++){const f=raw[y*(stride+1)],src=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)),row=out.subarray(y*stride,(y+1)*stride),prev=y?out.subarray((y-1)*stride,y*stride):null;
  for(let x=0;x<stride;x++){const a=x>=4?row[x-4]:0,b=prev?prev[x]:0,c=prev&&x>=4?prev[x-4]:0;let p=0;
   if(f===1)p=a;else if(f===2)p=b;else if(f===3)p=(a+b)>>1;else if(f===4){const q=a+b-c,pa=Math.abs(q-a),pb=Math.abs(q-b),pc=Math.abs(q-c);p=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
   row[x]=(src[x]+p)&255;}}
 return{w,h,data:out};
}
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=b=>{let c=~0;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return ~c>>>0;};
function encode(w,h,data){
 const raw=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;data.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}
 const chunk=(type,body)=>{const b=Buffer.alloc(12+body.length);b.writeUInt32BE(body.length,0);b.write(type,4,'latin1');body.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,8+body.length)),8+body.length);return b;};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
function tile(name,size,fill){
 const img=decode(fs.readFileSync(path.join(dir,'sources',name+'.png')));let l=img.w,t=img.h,r=-1,b=-1,clear=0;
 for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++){const a=img.data[(y*img.w+x)*4+3];if(!a)clear++;if(a>8){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}}
 assert.ok(r>=l&&clear>img.w*img.h*.05,name+': transparência real ausente');
 const w=r-l+1,h=b-t+1,s=fill/Math.max(w,h),ow=Math.round(w*s),oh=Math.round(h*s),ox=Math.floor((size-ow)/2),oy=Math.floor((size-oh)/2),out=Buffer.alloc(size*size*4);
 for(let y=0;y<oh;y++)for(let x=0;x<ow;x++){
  const x0=l+x/s,x1=l+(x+1)/s,y0=t+y/s,y1=t+(y+1)/s;let R=0,G=0,B=0,A=0,n=0;
  for(let yy=Math.floor(y0);yy<Math.min(img.h,Math.ceil(y1));yy++)for(let xx=Math.floor(x0);xx<Math.min(img.w,Math.ceil(x1));xx++){const k=(yy*img.w+xx)*4,a=img.data[k+3];R+=img.data[k]*a;G+=img.data[k+1]*a;B+=img.data[k+2]*a;A+=a;n++;}
  const k=((oy+y)*size+ox+x)*4;if(A){out[k]=Math.round(R/A);out[k+1]=Math.round(G/A);out[k+2]=Math.round(B/A);out[k+3]=Math.round(A/n);}
 }
 const png=encode(size,size,out);fs.writeFileSync(path.join(dir,name+'.png'),png);
 return'data:image/png;base64,'+png.toString('base64');
}
const planes={},ground={};
for(const n of PLANES)planes[n]=tile(n,256,244);
for(const n of new Set(GROUND))ground[n]=tile(n,128,116);
const launch=LAUNCH.map(n=>tile(n,128,116));
const block='// FRANCE_ASSETS_BEGIN\n// Time azul (França): aviões entram em planeSpriteData; o resto é por tipo, frente para cima; lançador: [transição, elevado].\nObject.assign(planeSpriteData,'+JSON.stringify(planes)+');\nconst franceSpriteData='+JSON.stringify(ground)+';\nconst franceLaunchData='+JSON.stringify(launch)+';\n// FRANCE_ASSETS_END';
const js=fs.readFileSync(file,'utf8');
fs.writeFileSync(file,js.includes('// FRANCE_ASSETS_BEGIN')?js.replace(/\/\/ FRANCE_ASSETS_BEGIN[\s\S]*?\/\/ FRANCE_ASSETS_END/,()=>block):js.trimEnd()+'\n'+block+'\n');
console.log('OK '+Object.keys(planes).length+' aviões e '+Object.keys(ground).length+' unidades terrestres/aéreas da França incorporados em public/js/assets.js.');
