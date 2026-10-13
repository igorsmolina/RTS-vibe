'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});
for(const file of ['engine.js','story.js','world.js'])if(fs.existsSync('public/js/'+file))vm.runInContext(fs.readFileSync('public/js/'+file,'utf8'),ctx);
assert.equal(vm.runInContext('typeof Story',ctx),'object','módulo narrativo ausente');
vm.runInContext('Object.assign(this,{Story,newCampaign,canAttack,applyResult,serializeCampaign,deserializeCampaign})',ctx);
const {Story,newCampaign,canAttack,applyResult,serializeCampaign,deserializeCampaign}=ctx;
const c=newCampaign(2024,'normal','rts','story');
assert.equal(c.kind,'story');assert.equal(Story.next(c),null);
const first=c.world.regions.find(r=>canAttack(c,r.id)).id;
applyResult(c,first,true);assert.equal(Story.next(c),1);
applyResult(c,first,true);assert.equal(c.story.seen.length,1,'reconquista não avança história');
assert.equal(canAttack(c,c.world.homes.red),false,'QG reservado');
assert.ok(Story.marker(c));
assert.equal(Story.choose(c,'secondary','records'),true);
assert.equal(Story.choose(c,'secondary','convoy'),false,'escolha imutável');
const mark=Story.marker(c),a=Story.begin(c,mark.chapter,mark.region);
assert.ok(a.id);assert.equal(Story.resolve(c,a,{won:true,records:true}),true);
const n=c.battles;assert.equal(Story.resolve(c,a,{won:true,records:true}),false);assert.equal(c.battles,n);
assert.ok(c.story.evidence.includes('records'));
const back=deserializeCampaign(serializeCampaign(c));assert.equal(JSON.stringify(back.story),JSON.stringify(c.story));
const old=JSON.parse(serializeCampaign(newCampaign(7)));delete old.kind;delete old.story;assert.equal(deserializeCampaign(JSON.stringify(old)).kind,'free');
const bad=JSON.parse(serializeCampaign(c));bad.story.choices.ivo='garbage';assert.equal(deserializeCampaign(JSON.stringify(bad)),null);
const journalBad=JSON.parse(serializeCampaign(c));journalBad.story.journal=[{type:'choice',key:'missing',value:'missing'}];assert.ok(deserializeCampaign(JSON.stringify(journalBad))===null,'diário inválido recusado');
for(const [scene,index]of [['before3',4],['after1',3],['covered',4],['defeat',4]]){const d=newCampaign(12,'normal','rts','story');d.story.choices.ivo='protect';d.story.rewards.recon=true;d.story.scene={id:scene,index,action:null};assert.ok(deserializeCampaign(serializeCampaign(d)),'cena variável retoma: '+scene);}
for(let bits=0;bits<16;bits++){
 const d=newCampaign(8,'normal','turns','story');d.story.evidence=['contracts','authorization'];
 if(bits&1)d.story.evidence.push('records');if(bits&2)d.story.evidence.push('testimony');if(bits&4)d.story.evidence.push('civil');
 assert.equal(Story.ending(d,!!(bits&8)),bits&8?(bits&4&&bits&3?'exposed':'covered'):'defeat');
}
for(let seed=1;seed<=25;seed++){
 const d=newCampaign(seed,'normal','turns','story'),seen=new Set([d.world.homes.blue]),queue=[d.world.homes.blue];
 for(const id of queue)for(const x of d.world.regions[id].neighbors)if(x!==d.world.homes.red&&!seen.has(x)){seen.add(x);queue.push(x);}
 assert.ok(seen.size>=8,'sete regiões acessíveis antes do QG: '+seed);
}
console.log('OK história: progressão, decisões, resultados únicos, saves e finais');
