'use strict';
// Todo míssil do motor tem imagem em render.js (missileArt) e todo sprite citado existe em assets/Misseis.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(path.join(__dirname,'..','public','js',f),'utf8');
const missiles=JSON.parse(read('engine.js').match(/const MISSILE=w=>(\[[^\]]+\])/)[1].replace(/'/g,'"'));
const art=Function('return '+read('render.js').match(/const missileArt=(\{[^;]+\});/)[1])();
for(const w of missiles)assert.ok(art[w],'míssil sem imagem: '+w);
for(const [w,[sprite]] of Object.entries(art))assert.ok(fs.existsSync(path.join(__dirname,'..','assets','Misseis',sprite+'.png')),'sprite inexistente para '+w+': '+sprite);
console.log('OK '+missiles.length+' mísseis com imagem');
