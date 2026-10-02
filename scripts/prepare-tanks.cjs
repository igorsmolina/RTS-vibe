// Redimensionamento e atlas; a extração dos fundos é feita pelo ImageGen.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.join(__dirname,'..'),dir=path.join(root,'assets','Tanques');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),inputs=JSON.parse(fs.readFileSync(path.join(dir,'prompts.json'),'utf8')).map(job=>({...job,input:'data:image/png;base64,'+fs.readFileSync(path.join(dir,job.source)).toString('base64')}));
 const output=await page.evaluate(async inputs=>{
  const atlas=document.createElement('canvas');atlas.width=384;atlas.height=256;const a=atlas.getContext('2d'),tiles=[];
  for(const {name,column,row,input} of inputs){
   const image=new Image();image.src=input;await image.decode();const probe=document.createElement('canvas');probe.width=image.width;probe.height=image.height;const p=probe.getContext('2d');p.drawImage(image,0,0);const pixels=p.getImageData(0,0,image.width,image.height).data;
   let left=image.width,top=image.height,right=-1,bottom=-1,transparent=0;
   for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const alpha=pixels[(y*image.width+x)*4+3];if(alpha===0)transparent++;if(alpha>8){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}}
   if(transparent<image.width*image.height*.15||right<left)throw Error(name+': transparência real ausente');
   const tile=document.createElement('canvas');tile.width=tile.height=128;const c=tile.getContext('2d'),w=right-left+1,h=bottom-top+1,fit=116/Math.max(w,h);c.imageSmoothingQuality='high';c.drawImage(image,left,top,w,h,(128-w*fit)/2,(128-h*fit)/2,w*fit,h*fit);a.drawImage(tile,column*128,row*128);tiles.push({name,data:tile.toDataURL('image/png'),bounds:{left,top,right,bottom},transparent});
  }
  return {atlas:atlas.toDataURL('image/png'),tiles};
 },inputs);
 for(const tile of output.tiles)fs.writeFileSync(path.join(dir,tile.name+'.png'),Buffer.from(tile.data.split(',')[1],'base64'));
 fs.writeFileSync(path.join(dir,'tanks-atlas.png'),Buffer.from(output.atlas.split(',')[1],'base64'));
 const file=path.join(root,'js','assets.js'),js=fs.readFileSync(file,'utf8'),block='// TANK_ASSETS_BEGIN\nconst tankAtlasData='+JSON.stringify(output.atlas)+';\n// TANK_ASSETS_END';
 assert.equal(output.tiles.length,6);fs.writeFileSync(file,js.includes('// TANK_ASSETS_BEGIN')?js.replace(/\/\/ TANK_ASSETS_BEGIN[\s\S]*?\/\/ TANK_ASSETS_END/,block):js+'\n'+block+'\n');
 console.log('OK seis PNGs transparentes 128x128 e atlas 384x256 incorporado em js/assets.js');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
