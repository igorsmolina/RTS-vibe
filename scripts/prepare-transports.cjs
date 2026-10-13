'use strict';
// Somente recorte, escala e incorporação. A arte vem do ImageGen; os originais permanecem intactos.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright-core');
const root=path.join(__dirname,'..'),dir=path.join(root,'assets','Transportes'),qa=path.join(root,'test-output','transportes');
const names=['truck-blue','truck-red','helicopter-blue','helicopter-red','plane-blue','plane-red'];
const data=file=>'data:image/png;base64,'+fs.readFileSync(file).toString('base64');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage();const inputs=names.map(name=>({name,src:data(path.join(dir,'sources',name+'.png'))}));
 const terrain=['plain','forest','mountain','sand'].map(name=>data(path.join(root,'assets','terrain',name+'.png')));
 const result=await page.evaluate(async({inputs,terrain})=>{
  const load=async src=>{const i=new Image();i.src=src;await i.decode();return i;},tiles=[],checks=[];
  for(const {name,src}of inputs){const image=await load(src),probe=document.createElement('canvas');probe.width=image.width;probe.height=image.height;const p=probe.getContext('2d');p.drawImage(image,0,0);const pixels=p.getImageData(0,0,image.width,image.height).data;let left=image.width,top=image.height,right=-1,bottom=-1,clear=0;
   for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const a=pixels[(y*image.width+x)*4+3];if(a===0)clear++;if(a>8){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
   if(clear<image.width*image.height*.15||right<left)throw Error(name+': transparência ausente');
   const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d'),w=right-left+1,h=bottom-top+1,scale=116/Math.max(w,h);c.imageSmoothingQuality='high';c.drawImage(image,left,top,w,h,(128-w*scale)/2,(128-h*scale)/2,w*scale,h*scale);
   const rgba=c.getImageData(0,0,128,128).data;if([3,511,65027,65535].some(k=>rgba[k]!==0))throw Error(name+': cantos sem alpha');
   tiles.push({name,canvas,png:canvas.toDataURL()});checks.push({name,source:[image.width,image.height],output:[128,128],bounds:[left,top,right,bottom],transparent:clear});
  }
  const preview=document.createElement('canvas');preview.width=980;preview.height=600;const c=preview.getContext('2d');c.fillStyle='#edf0e4';c.fillRect(0,0,980,600);c.fillStyle='#20352c';c.font='bold 20px sans-serif';c.fillText('Transportes · sprites 128×128 e leitura no campo',20,30);
  for(let i=0;i<tiles.length;i++){const x=120+i*140;c.fillStyle='#fff';c.fillRect(x,55,128,128);c.drawImage(tiles[i].canvas,x,55);c.fillStyle='#20352c';c.font='12px sans-serif';c.fillText(tiles[i].name,x,201);}
  for(let row=0;row<terrain.length;row++){const ground=await load(terrain[row]),y=230+row*88;c.fillStyle='#20352c';c.fillText(['Grama','Floresta','Montanha','Deserto'][row],12,y+35);for(let i=0;i<tiles.length;i++){const x=120+i*140;c.drawImage(ground,x,y,128,82);const size=i<2?48:i<4?66:83;c.drawImage(tiles[i].canvas,x+(128-size)/2,y+(82-size)/2,size,size);}}
  return {tiles:tiles.map(({name,png})=>({name,png})),checks,preview:preview.toDataURL()};
 },{inputs,terrain});
 fs.mkdirSync(qa,{recursive:true});for(const t of result.tiles)fs.writeFileSync(path.join(dir,t.name+'.png'),Buffer.from(t.png.split(',')[1],'base64'));
 fs.writeFileSync(path.join(qa,'preview.png'),Buffer.from(result.preview.split(',')[1],'base64'));fs.writeFileSync(path.join(qa,'validation.json'),JSON.stringify(result.checks,null,2)+'\n');
 const pairs={transportTruck:['truck-blue','truck-red'],transportHelicopter:['helicopter-blue','helicopter-red'],transportPlane:['plane-blue','plane-red']},sprites=Object.fromEntries(Object.entries(pairs).map(([type,list])=>[type,list.map(name=>data(path.join(dir,name+'.png')))]));
 const file=path.join(root,'public','js','assets.js'),js=fs.readFileSync(file,'utf8'),block='// TRANSPORT_ASSETS_BEGIN\nconst transportSpriteData='+JSON.stringify(sprites)+';\n// TRANSPORT_ASSETS_END';
 fs.writeFileSync(file,js.includes('// TRANSPORT_ASSETS_BEGIN')?js.replace(/\/\/ TRANSPORT_ASSETS_BEGIN[\s\S]*?\/\/ TRANSPORT_ASSETS_END/,block):js.trimEnd()+'\n'+block+'\n');
 console.log('OK seis sprites 128×128 com alpha, fontes preservadas e incorporação offline.');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
