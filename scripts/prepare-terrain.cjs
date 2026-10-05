// Otimiza as imagens preparadas com ImageGen e sincroniza a cópia em public/js/assets.js.
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
   c.drawImage(image,0,0,128,128);
   return canvas.toDataURL('image/png');
  },{name,input});
  assert.ok(output.startsWith('data:image/png;base64,'));data[name]=output;fs.writeFileSync(path.join(dir,name+'.png'),Buffer.from(output.split(',')[1],'base64'));
 }
 const file=path.join(root,'public','js','assets.js'),js=fs.readFileSync(file,'utf8'),block='// TERRAIN_ASSETS_BEGIN\nconst terrainData='+JSON.stringify(data)+';\n// TERRAIN_ASSETS_END';
 assert.ok(js.includes('// TERRAIN_ASSETS_BEGIN'),'Missing terrain asset markers');
 fs.writeFileSync(file,js.replace(/\/\/ TERRAIN_ASSETS_BEGIN[\s\S]*?\/\/ TERRAIN_ASSETS_END/,block));console.log('OK '+Object.keys(data).length+' texturas 128x128 otimizadas e copiadas para public/js/assets.js');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
