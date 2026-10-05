// Preparação mecânica: recorte pelo alfa e redução. A arte é criada pelo ImageGen.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const dir=__dirname,names=['rocket-artillery-ally','rocket-artillery-enemy','recon-drone-ally','recon-drone-enemy'];
const data=file=>'data:image/png;base64,'+fs.readFileSync(file).toString('base64');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),inputs=names.map(name=>({name,input:data(path.join(dir,'sources',name+'.png'))}));
 const terrains=['plain','forest','mountain','sand'].map(name=>({name,input:data(path.join(dir,'..','terrain',name+'.png'))}));
 const result=await page.evaluate(async({inputs,terrains})=>{
  const load=async src=>{const i=new Image();i.src=src;await i.decode();return i;},tiles=[],checks=[];
  for(const {name,input}of inputs){
   const image=await load(input),probe=document.createElement('canvas');probe.width=image.width;probe.height=image.height;const p=probe.getContext('2d');p.drawImage(image,0,0);const rgba=p.getImageData(0,0,image.width,image.height).data;
   let left=image.width,top=image.height,right=-1,bottom=-1,transparent=0;
   for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const a=rgba[(y*image.width+x)*4+3];if(a===0)transparent++;if(a>8){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}}
   if(transparent<image.width*image.height*.15||right<left)throw Error(name+': transparência real ausente');
   const tile=document.createElement('canvas');tile.width=tile.height=128;const c=tile.getContext('2d'),w=right-left+1,h=bottom-top+1,scale=116/Math.max(w,h);c.imageSmoothingQuality='high';c.drawImage(image,left,top,w,h,(128-w*scale)/2,(128-h*scale)/2,w*scale,h*scale);
   const pixels=c.getImageData(0,0,128,128).data;let clear=0,opaque=0,partial=0;for(let k=3;k<pixels.length;k+=4){if(pixels[k]===0)clear++;else if(pixels[k]===255)opaque++;else partial++;}
   const cornerAlpha=[3,(127*4)+3,(127*128*4)+3,pixels.length-1].map(k=>pixels[k]);if(cornerAlpha.some(a=>a!==0))throw Error(name+': cantos sem transparência');
   tiles.push({name,canvas:tile,data:tile.toDataURL()});checks.push({name,source:{width:image.width,height:image.height,transparentPixels:transparent},output:{width:128,height:128,transparentPixels:clear,opaquePixels:opaque,partialAlphaPixels:partial,cornerAlpha},bounds:{left,top,right,bottom}});
  }
  const preview=document.createElement('canvas');preview.width=880;preview.height=590;const c=preview.getContext('2d');c.fillStyle='#F4F5EF';c.fillRect(0,0,880,590);c.fillStyle='#2D1D1A';c.font='bold 22px system-ui';c.fillText('rtsvibe · novas tropas',24,32);c.font='14px system-ui';c.fillText('PNG transparente 128 × 128 · abaixo, leitura em 56 × 56',24,58);
  const labels=['Artilharia aliada','Artilharia inimiga','Drone aliado','Drone inimigo'];
  tiles.forEach((t,i)=>{const x=172+i*172;for(let y=80;y<208;y+=8)for(let xx=x;xx<x+128;xx+=8){c.fillStyle=((xx-x)/8+(y-80)/8)%2?'#E0E1DB':'#FFFFFF';c.fillRect(xx,y,8,8);}c.drawImage(t.canvas,x,80);c.fillStyle='#2D1D1A';c.font='13px system-ui';c.fillText(labels[i],x,232);});
  const ground=await load(terrains[0].input);
  for(let row=0;row<terrains.length;row++){const terrain=terrains[row],image=await load(terrain.input),y=258+row*78;c.fillStyle='#2D1D1A';c.font='15px system-ui';c.fillText(['Grama','Floresta','Montanha','Deserto'][row],24,y+40);tiles.forEach((t,i)=>{const x=172+i*172;c.drawImage(ground,x,y,128,64);c.drawImage(image,x,y,128,64);c.imageSmoothingQuality='high';c.drawImage(t.canvas,x+36,y+4,56,56);});}
  return{tiles:tiles.map(({name,data})=>({name,data})),checks,preview:preview.toDataURL()};
 },{inputs,terrains});
 assert.equal(result.tiles.length,4);for(const t of result.tiles)fs.writeFileSync(path.join(dir,t.name+'.png'),Buffer.from(t.data.split(',')[1],'base64'));
 const qa=path.join(dir,'..','..','test-output','novas-tropas');fs.mkdirSync(qa,{recursive:true});
 fs.writeFileSync(path.join(qa,'preview.png'),Buffer.from(result.preview.split(',')[1],'base64'));
 fs.writeFileSync(path.join(qa,'validation.json'),JSON.stringify({method:'Canvas: recorte pelo alfa, redução e inspeção dos pixels',tiles:result.checks},null,2)+'\n');
 console.log('OK quatro PNGs 128 × 128 com alfa real, originais preservados e prévia nos quatro terrenos.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
