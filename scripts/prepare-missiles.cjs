'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const root=path.join(__dirname,'..'),dir=path.join(root,'assets/Misseis'),assetFile=path.join(root,'public/js/assets.js');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),specs=JSON.parse(fs.readFileSync(path.join(dir,'prompts.json'),'utf8')),data={},stats=[];
 fs.mkdirSync(path.join(dir,'sources'),{recursive:true});
 for(const spec of specs){const source=path.join(dir,'sources',spec.name+'.png');if(!fs.existsSync(source))fs.copyFileSync(spec.source,source);
  const input='data:image/png;base64,'+fs.readFileSync(source).toString('base64');
  const out=await page.evaluate(async input=>{const img=new Image();img.src=input;await img.decode();const probe=document.createElement('canvas');probe.width=img.width;probe.height=img.height;const c=probe.getContext('2d');c.drawImage(img,0,0);const pixels=c.getImageData(0,0,img.width,img.height).data;let left=img.width,top=img.height,right=-1,bottom=-1,transparent=0;
   for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){const alpha=pixels[(y*img.width+x)*4+3];if(!alpha)transparent++;else if(alpha>32){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}}
   if(!transparent||right<left)throw Error('PNG needs real transparency and visible art');const tile=document.createElement('canvas');tile.width=tile.height=128;const ctx=tile.getContext('2d'),w=right-left+1,h=bottom-top+1,fit=120/Math.max(w,h);ctx.imageSmoothingQuality='high';ctx.drawImage(probe,left,top,w,h,(128-w*fit)/2,(128-h*fit)/2,w*fit,h*fit);return{png:tile.toDataURL(),width:img.width,height:img.height,transparent,bounds:{left,top,right,bottom}};
  },input);
  assert.ok(out.transparent>0);data[spec.name]=out.png;stats.push({name:spec.name,...out,png:undefined});fs.writeFileSync(path.join(dir,spec.name+'.png'),Buffer.from(out.png.split(',')[1],'base64'));
 }
 const block='// MISSILE_ASSETS_BEGIN\n// ImageGen projectile sprites, north-facing, 128 x 128, embedded for offline play.\nconst missileSpriteData='+JSON.stringify(data)+';\n// MISSILE_ASSETS_END';
 const js=fs.readFileSync(assetFile,'utf8');fs.writeFileSync(assetFile,js.includes('// MISSILE_ASSETS_BEGIN')?js.replace(/\/\/ MISSILE_ASSETS_BEGIN[\s\S]*?\/\/ MISSILE_ASSETS_END/,()=>block):js.trimEnd()+'\n'+block+'\n');
 const preview=await page.evaluate(async data=>{const canvas=document.createElement('canvas');canvas.width=960;canvas.height=350;const c=canvas.getContext('2d');c.fillStyle='#17251f';c.fillRect(0,0,960,350);let col=0;for(const [name,png]of Object.entries(data)){const img=new Image();img.src=png;await img.decode();const x=col++*160;c.fillStyle='#dde6cf';c.font='14px sans-serif';c.textAlign='center';c.fillText(name,x+80,26);c.drawImage(img,x+16,42,128,128);for(const [i,bg]of ['#77816a','#4b6654','#9b9a63'].entries()){c.fillStyle=bg;c.fillRect(x+4,195+i*45,152,40);c.drawImage(img,x+62,199+i*45,32,32);}}return canvas.toDataURL();},data);
 fs.writeFileSync(path.join(dir,'preview.png'),Buffer.from(preview.split(',')[1],'base64'));fs.writeFileSync(path.join(dir,'validation.json'),JSON.stringify(stats,null,2)+'\n');console.log('OK 6 transparent sprites, 128 x 128, offline data and preview.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
