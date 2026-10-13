'use strict';
// Escala e WebP com alpha nativo; nenhuma alteração da arte gerada.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright-core');
const names=['helena-focused','helena-suspicious','helena-determined','reis-attentive','reis-worried','reis-relieved','ivo-anxious','ivo-explaining','ivo-exhausted','vilar-controlled','vilar-stern','vilar-pressured'];
(async()=>{const inputs=names.filter(name=>fs.existsSync('assets/Personagens/'+name+'.png')).map(name=>({name,src:'data:image/png;base64,'+fs.readFileSync('assets/Personagens/'+name+'.png').toString('base64')}));if(inputs.length!==12)throw Error('São necessários os 12 originais PNG.');
 const browser=await chromium.launch({channel:'chrome',headless:true});try{const page=await browser.newPage();const result=await page.evaluate(async inputs=>{
  const preview=document.createElement('canvas');preview.width=1536;preview.height=1080;const pc=preview.getContext('2d');pc.fillStyle='#142319';pc.fillRect(0,0,preview.width,preview.height);const out=[];
  for(const [i,{name,src}]of inputs.entries()){const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.width=512;c.height=768;const ctx=c.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(im,0,0,512,768);const p=ctx.getImageData(0,0,512,768).data;let clear=0,opaque=0;for(let n=3;n<p.length;n+=4){if(p[n]===0)clear++;if(p[n]>=200)opaque++;}
   if(clear<512*768*.1||opaque<512*768*.1)throw Error(name+': alpha insuficiente ('+clear+' pixels vazios)');
   const webp=c.toDataURL('image/webp',.9);if(!webp.startsWith('data:image/webp'))throw Error('WebP não suportado.');const x=(i%6)*256,y=Math.floor(i/6)*540;pc.fillStyle=i%2?'#e0e6d5':'#21362a';pc.fillRect(x,y,256,500);pc.drawImage(c,x,y+65,256,384);pc.fillStyle=i%2?'#142319':'#f0ead7';pc.font='16px sans-serif';pc.fillText(name,x+10,y+475);out.push({name,webp,clear,opaque,width:512,height:768});
  }return{out,preview:preview.toDataURL()};
 },inputs);fs.mkdirSync('public/assets/characters',{recursive:true});fs.mkdirSync('test-output/story',{recursive:true});for(const x of result.out)fs.writeFileSync('public/assets/characters/'+x.name+'.webp',Buffer.from(x.webp.split(',')[1],'base64'));
 fs.writeFileSync('test-output/story/portraits.png',Buffer.from(result.preview.split(',')[1],'base64'));fs.writeFileSync('test-output/story/portrait-validation.json',JSON.stringify(result.out.map(({webp,...x})=>x),null,2));console.log('OK '+result.out.length+'/12 retratos 512×768 com transparência.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
