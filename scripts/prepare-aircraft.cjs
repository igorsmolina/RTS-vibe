// Recorta as seis artes existentes por alfa e incorpora os PNGs para abertura offline.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const root=path.join(__dirname,'..'),dir=path.join(root,'assets','Avioes'),asset=path.join(root,'public','js','assets.js');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{const page=await browser.newPage(),sprites={};
for(const team of ['Blue','Red']){
const source='data:image/png;base64,'+fs.readFileSync(path.join(dir,'sources',team.toLowerCase()+'.png')).toString('base64');
const outputs=await page.evaluate(async src=>{const im=new Image();im.src=src;await im.decode();const cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height;const c=cv.getContext('2d');c.drawImage(im,0,0);const pixels=c.getImageData(0,0,im.width,im.height),d=pixels.data,columns=[];
for(let x=0;x<im.width;x++){let n=0;for(let y=0;y<im.height;y++)if(d[(y*im.width+x)*4+3]>96)n++;columns[x]=n>2;}
const spans=[];let begin=null;for(let x=0;x<=im.width;x++){if(columns[x]&&begin===null)begin=x;if(!columns[x]&&begin!==null){if(x-begin>50)spans.push([begin,x-1]);begin=null;}}
return spans.map(([left,right])=>{let top=im.height,bottom=0;for(let y=0;y<im.height;y++)for(let x=left;x<=right;x++)if(d[(y*im.width+x)*4+3]>96){top=Math.min(top,y);bottom=Math.max(bottom,y);}const out=document.createElement('canvas');out.width=out.height=256;const oc=out.getContext('2d'),w=right-left+1,h=bottom-top+1,fit=240/Math.max(w,h);oc.imageSmoothingQuality='high';oc.drawImage(cv,left,top,w,h,(256-w*fit)/2,(256-h*fit)/2,w*fit,h*fit);return out.toDataURL();});},source);
assert.equal(outputs.length,3,'três silhuetas completas por equipe');outputs.forEach((src,i)=>{const type=['fighter','multirole','bomber'][i]+team;sprites[type]=src;fs.writeFileSync(path.join(dir,type+'.png'),Buffer.from(src.split(',')[1],'base64'));});
}
const block='// AIRCRAFT_ASSETS_BEGIN\nconst planeSpriteData='+JSON.stringify(sprites)+';\n// AIRCRAFT_ASSETS_END',old=fs.readFileSync(asset,'utf8');fs.writeFileSync(asset,old.includes('// AIRCRAFT_ASSETS_BEGIN')?old.replace(/\/\/ AIRCRAFT_ASSETS_BEGIN[\s\S]*?\/\/ AIRCRAFT_ASSETS_END/,()=>block):old.trimEnd()+'\n'+block+'\n');console.log('OK seis sprites 256 × 256, transparentes e incorporados.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
