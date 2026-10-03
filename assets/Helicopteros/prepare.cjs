// Prepara somente este pacote de arte e suas pranchas de revisão. Não altera o jogo.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const dir=__dirname,root=process.env.WAR_GRID_PROJECT||path.resolve(dir,'../..'),docs=path.resolve(dir,'../../docs/helicopteros');
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext();await context.setOffline(true);const page=await context.newPage();
 const jobs=JSON.parse(fs.readFileSync(path.join(dir,'prompts.json'),'utf8'));assert.equal(jobs.length,6);
 assert.deepEqual(jobs.map(j=>j.row+':'+j.column).sort(),['0:0','0:1','0:2','1:0','1:1','1:2']);
 const inputs=jobs.map(j=>({...j,input:'data:image/png;base64,'+fs.readFileSync(path.join(dir,j.source)).toString('base64')}));
 const pack=await page.evaluate(async inputs=>{
  const images=[];let left=1,top=1,right=0,bottom=0;
  for(const job of inputs){const image=new Image();image.src=job.input;await image.decode();if(image.width!==image.height)throw Error(job.name+': fonte deve ser quadrada');
   const probe=document.createElement('canvas');probe.width=image.width;probe.height=image.height;const ctx=probe.getContext('2d');ctx.drawImage(image,0,0);const p=ctx.getImageData(0,0,image.width,image.height).data;
   let x0=image.width,y0=image.height,x1=-1,y1=-1,transparent=0;
   for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const a=p[(y*image.width+x)*4+3];if(a===0)transparent++;if(a>8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
   if(x1<x0||transparent/(image.width*image.height)<.15)throw Error(job.name+': alpha real ausente');
   if(x0===0||y0===0||x1===image.width-1||y1===image.height-1)throw Error(job.name+': fonte cortada no limite');
   // Um recorte normalizado comum mantém exatamente a mesma escala entre variantes/equipes.
   left=Math.min(left,Math.max(0,(x0-2)/image.width));top=Math.min(top,Math.max(0,(y0-2)/image.height));right=Math.max(right,Math.min(1,(x1+3)/image.width));bottom=Math.max(bottom,Math.min(1,(y1+3)/image.height));
   images.push({job,image,sourceSize:[image.width,image.height],sourceBounds:{left:x0,top:y0,right:x1,bottom:y1},sourceTransparentFraction:transparent/(image.width*image.height)});
  }
  const w=right-left,h=bottom-top,scale=116/Math.max(w,h),dw=w*scale,dh=h*scale,dx=(128-dw)/2,dy=(128-dh)/2;
  const atlas=document.createElement('canvas');atlas.width=384;atlas.height=256;const a=atlas.getContext('2d'),tiles=[];
  for(const {job,image,...sourceStats}of images){const tile=document.createElement('canvas');tile.width=tile.height=128;const c=tile.getContext('2d');c.imageSmoothingQuality='high';c.drawImage(image,left*image.width,top*image.height,w*image.width,h*image.height,dx,dy,dw,dh);
   const p=c.getImageData(0,0,128,128).data;let transparent=0,partial=0,opaque=0,l=128,t=128,r=-1,b=-1;
   for(let y=0;y<128;y++)for(let x=0;x<128;x++){const alpha=p[(y*128+x)*4+3];if(alpha===0)transparent++;else{if(alpha===255)opaque++;else partial++;l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}}
   if(l<5||t<5||r>122||b>122)throw Error(job.name+': margem insuficiente');
   a.drawImage(tile,job.column*128,job.row*128);tiles.push({name:job.name,column:job.column,row:job.row,data:tile.toDataURL('image/png'),stats:{...sourceStats,width:128,height:128,bounds:{left:l,top:t,right:r,bottom:b},transparent,partial,opaque}});
  }
  return{atlas:atlas.toDataURL('image/png'),tiles,crop:{left,top,right,bottom,width:dw,height:dh}};
 },inputs);
 fs.mkdirSync(docs,{recursive:true});const outputHashes=[];
 for(const tile of pack.tiles){const buffer=Buffer.from(tile.data.split(',')[1],'base64');fs.writeFileSync(path.join(dir,tile.name+'.png'),buffer);outputHashes.push(hash(buffer));}
 assert.equal(new Set(outputHashes).size,6,'Os seis sprites devem ser distintos');
 fs.writeFileSync(path.join(dir,'helicopters-atlas.png'),Buffer.from(pack.atlas.split(',')[1],'base64'));
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.evaluate(()=>terrainReady);
 const qa=await page.evaluate(async tiles=>{
  const sprites=await Promise.all(tiles.map(async tile=>{const image=new Image();image.src=tile.data;await image.decode();return{...tile,image};}));
  const names=['Padrão','Ar-terra','Ar-ar'];
  const board=document.createElement('canvas');board.width=960;board.height=410;const q=board.getContext('2d');q.fillStyle='#182832';q.fillRect(0,0,960,410);q.fillStyle='#f0e8d5';q.font='bold 24px sans-serif';q.fillText('WAR GRID · HELICÓPTEROS',26,36);q.font='15px sans-serif';q.fillStyle='#adc2c8';q.fillText('Três variantes · duas equipes · fontes com alpha real',26,62);
  for(const s of sprites){const x=60+s.column*294,y=88+s.row*154;q.fillStyle='#263d47';q.fillRect(x,y,252,140);q.drawImage(s.image,x+60,y+4,128,128);q.fillStyle='#e9e2cc';q.font='14px sans-serif';q.fillText(names[s.column]+' · '+(s.row?'Inimigo':'Aliado'),x+10,y+130);}
  const terrainBoard=document.createElement('canvas');terrainBoard.width=1248;terrainBoard.height=610;const c=terrainBoard.getContext('2d');c.fillStyle='#172831';c.fillRect(0,0,1248,610);c.fillStyle='#eee8d8';c.font='bold 22px sans-serif';c.fillText('Leitura sobre os terrenos do jogo',24,32);c.font='15px sans-serif';c.fillStyle='#b8c8ca';c.fillText('48 px na primeira linha · 60 px na segunda · composição real do Canvas',24,59);
  const terrains=[{name:'Planície',type:'plain',map:'river'},{name:'Floresta',type:'forest',map:'river'},{name:'Água',type:'river',map:'river'},{name:'Deserto',type:'plain',map:'desert'}];
  for(const [line,size]of [[0,48],[1,60]])for(let ti=0;ti<4;ti++){const t=terrains[ti],g=new Game(t.map,'normal',83);g.terrain.fill(t.type);const px=24+ti*306,py=88+line*255;c.save();c.beginPath();c.rect(px,py,288,210);c.clip();c.translate(px,py);for(let y=0;y<4;y++)for(let x=0;x<6;x++)c.drawImage(terrainTile(g,x,y),x*56,y*56);for(const s of sprites){const cx=48+s.column*96,cy=55+s.row*100;c.drawImage(s.image,cx-size/2,cy-size/2,size,size);if(line===1&&s.row===0&&s.column===1){c.strokeStyle='#8de4ef';c.lineWidth=1.5;c.beginPath();c.ellipse(cx,cy+4,25,20,0,0,Math.PI*2);c.stroke();c.fillStyle='#172d34';c.fillRect(cx-20,cy-36,40,4);c.fillStyle='#b2e3ab';c.fillRect(cx-20,cy-36,31,4);}}c.restore();c.fillStyle='#e5dfcf';c.font='15px sans-serif';c.fillText(t.name+' · '+size+' px',px,py+233);}
  return{preview:board.toDataURL('image/png'),terrain:terrainBoard.toDataURL('image/jpeg',.88)};
 },pack.tiles);
 fs.writeFileSync(path.join(docs,'sprites-preview.png'),Buffer.from(qa.preview.split(',')[1],'base64'));fs.writeFileSync(path.join(docs,'terrain-preview.jpg'),Buffer.from(qa.terrain.split(',')[1],'base64'));
 const report={generator:'built-in image_gen',preparationWritesRuntimeFiles:false,atlas:{width:384,height:256,columns:['standard','air-ground','air-air'],rows:['blue (olive)','red']},sharedCrop:pack.crop,tiles:pack.tiles.map(({name,column,row,stats},i)=>({name,column,row,...stats,sha256:outputHashes[i]})),qa:{terrains:['plain','forest','water','desert'],screenSizes:[48,60],visualReview:'pending'}};
 fs.writeFileSync(path.join(docs,'validation.json'),JSON.stringify(report,null,2)+'\n');console.log('OK seis PNGs RGBA 128x128, atlas 384x256, recorte/escala comuns e pranchas de terreno offline.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
