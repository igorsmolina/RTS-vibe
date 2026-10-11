// Prepara os dois assets gerados e incorpora PNGs para abertura offline.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const root=path.join(__dirname,'..'),dir=path.join(root,'assets','Aeroportos'),asset=path.join(root,'public','js','assets.js');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{const page=await browser.newPage(),sprites={};
for(const [type,name,width,height]of [['airportDirt','airport-dirt',1008,336],['airportAsphalt','airport-concrete',1344,504]]){
 const src='data:image/png;base64,'+fs.readFileSync(path.join(dir,'sources',name+'.png')).toString('base64');
 const result=await page.evaluate(async({src,width,height})=>{const im=new Image();im.src=src;await im.decode();const cv=document.createElement('canvas');cv.width=width;cv.height=height;const c=cv.getContext('2d');c.imageSmoothingQuality='high';c.drawImage(im,0,0,width,height);const d=c.getImageData(0,0,width,height).data;let clear=0,solid=0;for(let i=3;i<d.length;i+=4){if(d[i]===0)clear++;if(d[i]>200)solid++;}return {src:cv.toDataURL(),corner:d[3],clear,solid};},{src,width,height});
 assert.equal(result.corner,0);assert.ok(result.clear>width*height*.01,'transparencia real');assert.ok(result.solid>width*height*.4,'asset visivel');sprites[type]=result.src;fs.writeFileSync(path.join(dir,name+'.png'),Buffer.from(result.src.split(',')[1],'base64'));console.log('OK '+name+' '+width+'x'+height+' transparente.');
}
const block='// AIRPORT_ASSETS_BEGIN\nconst airportSpriteData='+JSON.stringify(sprites)+';\n// AIRPORT_ASSETS_END',old=fs.readFileSync(asset,'utf8');fs.writeFileSync(asset,old.includes('// AIRPORT_ASSETS_BEGIN')?old.replace(/\/\/ AIRPORT_ASSETS_BEGIN[\s\S]*?\/\/ AIRPORT_ASSETS_END/,()=>block):old.trimEnd()+'\n'+block+'\n');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
