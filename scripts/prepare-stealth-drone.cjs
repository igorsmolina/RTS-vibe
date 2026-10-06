// Recorta o drone furtivo pelo alfa, reduz a 128 × 128 e incorpora em public/js/assets.js (uso offline). A arte é do ImageGen.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.join(__dirname,'..'),dir=path.join(root,'assets','DroneFurtivo'),file=path.join(root,'public','js','assets.js');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),input='data:image/png;base64,'+fs.readFileSync(path.join(dir,'sources','drone-furtivo.png')).toString('base64');
 // O brilho em volta da asa é semitransparente: só pixels com alfa > 96 contam para o recorte, e o halo abaixo de 96 é removido.
 const output=await page.evaluate(async input=>{
  const image=new Image();image.src=input;await image.decode();const probe=document.createElement('canvas');probe.width=image.width;probe.height=image.height;const p=probe.getContext('2d');p.drawImage(image,0,0);
  const pixels=p.getImageData(0,0,image.width,image.height),d=pixels.data;let left=image.width,top=image.height,right=-1,bottom=-1;
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const k=(y*image.width+x)*4+3;if(d[k]<=96)d[k]=0;else{left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}}
  p.putImageData(pixels,0,0);const tile=document.createElement('canvas');tile.width=tile.height=128;const c=tile.getContext('2d'),w=right-left+1,h=bottom-top+1,fit=120/Math.max(w,h);
  c.imageSmoothingQuality='high';c.drawImage(probe,left,top,w,h,(128-w*fit)/2,(128-h*fit)/2,w*fit,h*fit);return tile.toDataURL();
 },input);
 assert.ok(output.startsWith('data:image/png;base64,'));fs.writeFileSync(path.join(dir,'stealth-drone.png'),Buffer.from(output.split(',')[1],'base64'));
 const js=fs.readFileSync(file,'utf8'),block='// STEALTH_DRONE_ASSETS_BEGIN\n// Drone furtivo: arte única para as duas equipes, frente para cima.\nconst stealthDroneData='+JSON.stringify(output)+';\n// STEALTH_DRONE_ASSETS_END';
 fs.writeFileSync(file,js.includes('// STEALTH_DRONE_ASSETS_BEGIN')?js.replace(/\/\/ STEALTH_DRONE_ASSETS_BEGIN[\s\S]*?\/\/ STEALTH_DRONE_ASSETS_END/,()=>block):js.trimEnd()+'\n'+block+'\n');
 console.log(`OK drone furtivo 128 × 128 (${Math.round(output.length/1024)} KB) incorporado em public/js/assets.js.`);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
