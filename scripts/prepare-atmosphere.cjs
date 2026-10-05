// Redução e recorte por alfa de fontes criadas com ImageGen; nenhuma edição da arte.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.join(__dirname,'..'),dir=path.join(root,'assets','Atmosfera');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),inputs=JSON.parse(fs.readFileSync(path.join(dir,'prompts.json'),'utf8')).map(j=>({...j,input:'data:image/png;base64,'+fs.readFileSync(path.join(dir,j.source)).toString('base64')}));
 const tiles=await page.evaluate(async inputs=>{const result=[];for(const {name,input}of inputs){
  const i=new Image();i.src=input;await i.decode();const probe=document.createElement('canvas');probe.width=i.width;probe.height=i.height;const p=probe.getContext('2d');p.drawImage(i,0,0);const d=p.getImageData(0,0,i.width,i.height).data;
  let l=i.width,r=-1,t=i.height,b=-1,clear=0,soft=0;for(let y=0;y<i.height;y++)for(let x=0;x<i.width;x++){const a=d[(y*i.width+x)*4+3];if(!a)clear++;if(a>0&&a<255)soft++;if(a>8){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}}
  if(clear<i.width*i.height*.15||soft<100||r<l)throw Error(name+': transparência inválida');
  const c=document.createElement('canvas');c.width=384;c.height=192;const q=c.getContext('2d'),w=r-l+1,h=b-t+1,s=Math.min(368/w,176/h);q.imageSmoothingQuality='high';q.drawImage(i,l,t,w,h,(384-w*s)/2,(192-h*s)/2,w*s,h*s);result.push({name,data:c.toDataURL()});
 }return result;},inputs);assert.equal(tiles.length,3);
 for(const t of tiles)fs.writeFileSync(path.join(dir,t.name+'.png'),Buffer.from(t.data.split(',')[1],'base64'));
 const file=path.join(root,'public','js','assets.js'),js=fs.readFileSync(file,'utf8'),block='// ATMOSPHERE_ASSETS_BEGIN\nconst ambientCloudData='+JSON.stringify(tiles.map(t=>t.data))+';\n// ATMOSPHERE_ASSETS_END';
 fs.writeFileSync(file,js.includes('// ATMOSPHERE_ASSETS_BEGIN')?js.replace(/\/\/ ATMOSPHERE_ASSETS_BEGIN[\s\S]*?\/\/ ATMOSPHERE_ASSETS_END/,block):js+'\n'+block+'\n');console.log('OK três nuvens 384x192 RGBA com bordas semitransparentes incorporadas offline.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
