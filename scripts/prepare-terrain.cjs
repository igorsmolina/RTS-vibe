// Otimiza as imagens preparadas com ImageGen e sincroniza a cópia em js/assets.js.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.join(__dirname,'..'),dir=path.join(root,'assets','terrain');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),data={};
 for(const {name,source} of JSON.parse(fs.readFileSync(path.join(dir,'prompts.json'),'utf8'))){
  const input='data:image/png;base64,'+fs.readFileSync(path.join(dir,source)).toString('base64');
  const output=await page.evaluate(async({name,input})=>{
   const image=new Image();image.src=input;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');c.imageSmoothingQuality='high';
   if(name.startsWith('bank')){
    const probe=document.createElement('canvas');probe.width=probe.height=128;const p=probe.getContext('2d');p.drawImage(image,0,0,128,128);const pixels=p.getImageData(0,0,128,128).data;
    let top=128,bottom=-1;for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(pixels[(y*128+x)*4+3]>8){top=Math.min(top,y);bottom=Math.max(bottom,y);}
    if(bottom<top)throw Error('Empty bank image');c.drawImage(probe,0,top,128,bottom-top+1,0,0,128,18);
   }else c.drawImage(image,0,0,128,128);
   return canvas.toDataURL('image/png');
  },{name,input});
  assert.ok(output.startsWith('data:image/png;base64,'));data[name]=output;fs.writeFileSync(path.join(dir,name+'.png'),Buffer.from(output.split(',')[1],'base64'));
 }
 const file=path.join(root,'js','assets.js'),js=fs.readFileSync(file,'utf8'),block='// TERRAIN_ASSETS_BEGIN\nconst terrainData='+JSON.stringify(data)+';\n// TERRAIN_ASSETS_END';
 assert.ok(js.includes('// TERRAIN_ASSETS_BEGIN'),'Missing terrain asset markers');
 fs.writeFileSync(file,js.replace(/\/\/ TERRAIN_ASSETS_BEGIN[\s\S]*?\/\/ TERRAIN_ASSETS_END/,block));console.log('OK '+Object.keys(data).length+' texturas 128x128 otimizadas e copiadas para js/assets.js');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
