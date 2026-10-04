// Somente recorte pelo alfa, redução e atlas; a criação da arte é feita pelo ImageGen.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.join(__dirname,'..'),dir=path.join(root,'assets','Antiaereas');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),inputs=JSON.parse(fs.readFileSync(path.join(dir,'prompts.json'),'utf8')).map(j=>({...j,input:'data:image/png;base64,'+fs.readFileSync(path.join(dir,j.source)).toString('base64')}));
 const result=await page.evaluate(async inputs=>{
  const atlas=document.createElement('canvas');atlas.width=atlas.height=256;const a=atlas.getContext('2d'),tiles=[];
  for(const {name,column,row,input}of inputs){
   const image=new Image();image.src=input;await image.decode();const probe=document.createElement('canvas');probe.width=image.width;probe.height=image.height;const p=probe.getContext('2d');p.drawImage(image,0,0);const data=p.getImageData(0,0,image.width,image.height).data;
   let left=image.width,top=image.height,right=-1,bottom=-1,transparent=0;
   for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const alpha=data[(y*image.width+x)*4+3];if(!alpha)transparent++;if(alpha>8){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}}
   if(transparent<image.width*image.height*.15||right<left)throw Error(name+': alfa transparente ausente');
   const tile=document.createElement('canvas');tile.width=tile.height=128;const c=tile.getContext('2d'),w=right-left+1,h=bottom-top+1,fit=116/Math.max(w,h);c.imageSmoothingQuality='high';c.drawImage(image,left,top,w,h,(128-w*fit)/2,(128-h*fit)/2,w*fit,h*fit);if(name!=='clouds')a.drawImage(tile,(name.startsWith('vehicle')?0:1)*128,(name.endsWith('ally')?0:1)*128);tiles.push({name,data:tile.toDataURL(),transparent});
  }return{atlas:atlas.toDataURL(),tiles};
 },inputs);
 assert.equal(result.tiles.length,5);
 for(const t of result.tiles)fs.writeFileSync(path.join(dir,t.name+'.png'),Buffer.from(t.data.split(',')[1],'base64'));
 fs.writeFileSync(path.join(dir,'anti-air-atlas.png'),Buffer.from(result.atlas.split(',')[1],'base64'));
 const cloud=result.tiles.find(t=>t.name==='clouds').data,file=path.join(root,'js','assets.js'),js=fs.readFileSync(file,'utf8'),block='// AIR_DEFENSE_ASSETS_BEGIN\nconst antiAirAtlasData='+JSON.stringify(result.atlas)+';\nconst highCloudData='+JSON.stringify(cloud)+';\n// AIR_DEFENSE_ASSETS_END';
 fs.writeFileSync(file,js.includes('// AIR_DEFENSE_ASSETS_BEGIN')?js.replace(/\/\/ AIR_DEFENSE_ASSETS_BEGIN[\s\S]*?\/\/ AIR_DEFENSE_ASSETS_END/,block):js+'\n'+block+'\n');
 console.log('OK quatro sprites RGBA 128x128, atlas 2x2 e nuvens incorporados offline.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
