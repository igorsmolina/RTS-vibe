// Incorpora os PNGs de assets/NovasTropas (já recortados em 128 × 128 por assets/NovasTropas/prepare.cjs) para uso offline.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),dir=path.join(root,'assets','NovasTropas'),file=path.join(root,'public','js','assets.js');
const png=name=>'data:image/png;base64,'+fs.readFileSync(path.join(dir,name+'.png')).toString('base64');
const data={rocketArtillery:[png('rocket-artillery-ally'),png('rocket-artillery-enemy')],reconDrone:[png('recon-drone-ally'),png('recon-drone-enemy')]};
const poses=['ally','enemy'].map(team=>['transition','ready'].map(state=>png('rocket-artillery-'+team+'-launch-'+state)));
const block='// NEW_TROOP_ASSETS_BEGIN\n// Artilharia de mísseis e drone: [aliado, inimigo], frente para cima.\nconst newTroopData='+JSON.stringify(data)+';\n// Lançadores: [aliado, inimigo], [transição, elevado].\nconst rocketLauncherData='+JSON.stringify(poses)+';\n// NEW_TROOP_ASSETS_END';
const js=fs.readFileSync(file,'utf8');
fs.writeFileSync(file,js.includes('// NEW_TROOP_ASSETS_BEGIN')?js.replace(/\/\/ NEW_TROOP_ASSETS_BEGIN[\s\S]*?\/\/ NEW_TROOP_ASSETS_END/,block):js.trimEnd()+'\n'+block+'\n');
console.log('OK artilharia de mísseis e drone incorporados em public/js/assets.js.');
