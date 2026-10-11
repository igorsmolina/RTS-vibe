// Prepara assets gerados e incorpora PNGs do campo de batalha para abertura offline.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const root=path.join(__dirname,'..'),dir=path.join(root,'assets','Battlefield'),asset=path.join(root,'public','js','assets.js');
const specs=[['hq',512,512],['post',512,512],['cloud-soft',384,192],['cloud-long',384,192],['cloud-wisps',384,192],['forest',128,128],['forest-desert',128,128],['mountain',128,128],['mountain-desert',128,128]];
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{const page=await browser.newPage(),sprites={},stats=[];
for(const [name,width,height]of specs){
 const src='data:image/png;base64,'+fs.readFileSync(path.join(dir,'sources',name+'.png')).toString('base64');
 const result=await page.evaluate(async({src,name,width,height})=>{const im=new Image();im.src=src;await im.decode();const cv=document.createElement('canvas');cv.width=width;cv.height=height;const c=cv.getContext('2d');c.imageSmoothingQuality='high';
 if(name.startsWith('cloud-')){const pad=4,scale=Math.min((width-pad*2)/im.width,(height-pad*2)/im.height),w=im.width*scale,h=im.height*scale;c.drawImage(im,(width-w)/2,(height-h)/2,w,h);}else c.drawImage(im,0,0,width,height);
 const d=c.getImageData(0,0,width,height).data;let clear=0,solid=0,soft=0,visible=0;for(let i=3;i<d.length;i+=4){if(d[i]===0)clear++;else if(d[i]<255)soft++;if(d[i]>200)solid++;if(d[i]>15)visible++;}return {src:cv.toDataURL('image/png'),clear,solid,soft,visible};},{src,name,width,height});
 assert.ok(result.clear>width*height*.015,name+' transparencia real');assert.ok(result.visible>width*height*.1,name+' asset visivel');if(name.startsWith('cloud-'))assert.ok(result.soft>width*height*.015,name+' borda semitransparente');sprites[name]=result.src;fs.writeFileSync(path.join(dir,name+'.png'),Buffer.from(result.src.split(',')[1],'base64'));stats.push({name,width,height,clear:result.clear,solid:result.solid,soft:result.soft,visible:result.visible});console.log('OK '+name+' '+width+'x'+height+' alfa real.');
}
const data={hq:sprites.hq,post:sprites.post,clouds:['cloud-soft','cloud-long','cloud-wisps'].map(name=>sprites[name]),terrain:Object.fromEntries(['forest','forest-desert','mountain','mountain-desert'].map(name=>[name,sprites[name]]))};
const block='// BATTLEFIELD_ASSETS_BEGIN\nconst battlefieldData='+JSON.stringify(data)+';\n// BATTLEFIELD_ASSETS_END',old=fs.readFileSync(asset,'utf8');fs.writeFileSync(asset,old.includes('// BATTLEFIELD_ASSETS_BEGIN')?old.replace(/\/\/ BATTLEFIELD_ASSETS_BEGIN[\s\S]*?\/\/ BATTLEFIELD_ASSETS_END/,()=>block):old.trimEnd()+'\n'+block+'\n');fs.writeFileSync(path.join(dir,'validation.json'),JSON.stringify(stats,null,2)+'\n');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
