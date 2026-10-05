// Reduz assets/troops-atlas.png (2172 × 724) à metade e sincroniza a cópia em data URL de public/js/assets.js.
// No jogo cada quadro aparece com até ~93 px (retrato) ou ~186 px em telas 2×; a metade (181 px de altura) basta.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.join(__dirname,'..'),source=path.join(root,'assets','troops-atlas.png'),file=path.join(root,'public','js','assets.js');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),input='data:image/png;base64,'+fs.readFileSync(source).toString('base64');
 const output=await page.evaluate(async input=>{const image=new Image();image.src=input;await image.decode();const c=document.createElement('canvas');c.width=Math.round(image.width/2);c.height=Math.round(image.height/2);const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(image,0,0,c.width,c.height);return c.toDataURL();},input);
 assert.ok(output.startsWith('data:image/png;base64,'));
 const js=fs.readFileSync(file,'utf8'),line=/const troopAtlasData='[^']*';/;assert.ok(line.test(js),'troopAtlasData ausente em assets.js');
 fs.writeFileSync(file,js.replace(line,()=>`const troopAtlasData='${output}';`));
 console.log(`OK atlas das tropas a pé reduzido para ${Math.round(output.length/1024)} KB em data URL.`);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
