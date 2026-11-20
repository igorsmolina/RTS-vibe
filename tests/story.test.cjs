'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console});
for(const file of ['engine.js','story.js','story-scenes.js','world.js'])if(fs.existsSync('public/js/'+file))vm.runInContext(fs.readFileSync('public/js/'+file,'utf8'),ctx);
assert.equal(vm.runInContext('typeof Story',ctx),'object','módulo narrativo ausente');
vm.runInContext('Object.assign(this,{Story,newCampaign,canAttack,applyResult,serializeCampaign,deserializeCampaign})',ctx);
const {Story,newCampaign,canAttack,applyResult,serializeCampaign,deserializeCampaign}=ctx;
const c=newCampaign(2024,'normal','rts','story');
assert.equal(c.kind,'story');assert.equal(Story.next(c),1);
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
assert.ok(c.story.evidence.includes('records'));assert.ok(c.story.evidence.includes('stationCopy'));
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

// Cenas ilustradas mantêm o save e as decisões existentes.
for(const id of ['opening','before2','after2']){
 const d=newCampaign(12,'normal','rts','story');
 d.story.choices.secondary='records';d.story.evidence=['records'];
 d.story.scene={id,index:1,action:'prepareMission'};
 const migrated=deserializeCampaign(serializeCampaign(d));
 assert.equal(migrated.story.scene.index,0,'reinicia fala da revisão antiga: '+id);
 assert.equal(migrated.story.scene.revision,4);
 assert.equal(migrated.story.scene.action,'prepareMission');
 assert.equal(JSON.stringify(migrated.story.choices),JSON.stringify(d.story.choices));assert.equal(JSON.stringify(migrated.story.evidence),JSON.stringify(d.story.evidence));
 migrated.story.scene.index=1;
 assert.equal(deserializeCampaign(serializeCampaign(migrated)).story.scene.index,1,'revisão atual retoma fala');
 const scene=Story.scene(d,id);
 assert.equal(scene.shots.length,scene.lines.length,'cada fala tem um plano: '+id);
 for(const shot of scene.shots)assert.ok(fs.existsSync('public/assets/story/'+shot.background+'.svg'));
}

assert.equal(Story.scene(c,'after2').choice,'ivo');

const future=newCampaign(12,'normal','rts','story');future.story.scene={id:'opening',index:0,revision:99};assert.equal(deserializeCampaign(serializeCampaign(future)),null,'revisão desconhecida recusada');

const scenes=['opening',...Array.from({length:8},(_,i)=>['before'+(i+1),'after'+(i+1)]).flat(),'choice-secondary','choice-channel','exposed','covered','defeat','retreat'];
for(const id of scenes){const d=newCampaign(31,'normal','rts','story'),scene=Story.scene(d,id);assert.ok(scene.shots?.length===scene.lines.length,'planos da campanha: '+id);d.story.scene={id,index:Math.min(1,scene.lines.length-1),revision:2,action:'launch'};const restored=deserializeCampaign(serializeCampaign(d));assert.equal(restored.story.scene.revision,4,'migração da segunda etapa: '+id);assert.equal(restored.story.scene.index,0);assert.equal(restored.story.scene.action,'launch');restored.story.scene.index=Math.min(1,scene.lines.length-1);assert.equal(deserializeCampaign(serializeCampaign(restored)).story.scene.index,restored.story.scene.index);}

console.log('OK história: progressão, decisões, saves, migração de cenas, planos e finais');

for(const custody of ['protect','hand']){
 const d=newCampaign(31,'normal','rts','story');
 Object.assign(d.story,{completed:[1,2,3,4,5,6,7,8],choices:{secondary:'records',ivo:custody,contracts:'publish',channel:'civil'},evidence:['records','stationCopy','contracts','manifest','civil','authorization',...(custody==='protect'?['testimony']:[])]});
 for(const id of scenes){
  const {lines,shots,choice}=Story.scene(d,id);
  assert.ok(lines.length&&lines.length===shots.length,id);
  if(choice)assert.ok(Story.options[choice]?.length,id);
  if(/^(before|after)[1-8]$/.test(id))assert.ok(lines.flatMap(l=>l.text.split(/\s+/)).length>=460,id+' cena principal');
  for(const [index,line] of lines.entries()){
   const {cast,background,document}=shots[index],character=Story.characters[line.speaker];
   assert.ok(line.text.trim(),id+' fala vazia');
   if(character){
    assert.ok(character.expressions.includes(line.expression),id+' expressão inválida');
    assert.ok(fs.existsSync('public/assets/characters/'+line.speaker+'-'+line.expression+'.webp'),id+' retrato ausente');
   }else assert.ok(['radio','soldier','narrator'].includes(line.speaker),id+' personagem desconhecido');
   assert.ok(cast.every(speaker=>Story.characters[speaker]),id+' elenco inválido');
   assert.ok(fs.existsSync('public/assets/story/'+background+'.webp'),id+' cenário ausente');
   if(document)assert.ok(Story.proofs[document]?.details.length,id+' prova ausente');
   if(custody==='hand'&&!['before2','after2'].includes(id))assert.ok(line.speaker!=='ivo'&&!cast.includes('ivo'),id+' Ivo apareceu após transferência');
  }
 }
}

// Oito capítulos em sequência, conquistas controladas e decisões remapeadas.
for(let seed=1;seed<=5;seed++){
 const d=newCampaign(seed,'normal','turns','story');
 assert.equal(d.story.version,2);assert.equal(Story.chapters.length,9);
 for(let chapter=1;chapter<=8;chapter++){
  while(Story.next(d)!==chapter||!Story.marker(d)){
   const region=d.world.regions.find(r=>canAttack(d,r.id)&&r.id!==d.world.homes.red);assert.ok(region,'fronteira disponível '+chapter);applyResult(d,region.id,true);
  }
  if(chapter===1)Story.choose(d,'secondary','records');
  if(chapter===3){assert.equal(Story.pending(d),'ivo');Story.choose(d,'ivo','protect');}
  if(chapter===5){assert.equal(Story.pending(d),'contracts');Story.choose(d,'contracts','publish');}
  if(chapter===7)Story.choose(d,'channel',seed%2?'civil':'military');
  if(chapter<8)assert.equal(canAttack(d,d.world.homes.red),false);
  const marker=Story.marker(d),a=Story.begin(d,chapter,marker.region);assert.ok(a);const owners=JSON.stringify(d.owners);
  Story.resolve(d,a,{won:true,records:true,terminalRecon:true});
  if(!Story.chapters[chapter].conquest)assert.equal(JSON.stringify(d.owners),owners,'apoio não altera territórios');
  assert.equal(d.story.completed.length,chapter);
 }
 assert.equal(d.story.ending,seed%2?'exposed':'covered');assert.ok(d.story.evidence.includes(seed%2?'civil':'military'));assert.equal(d.story.rewards.terminalRecon,true);
 assert.ok(d.story.evidence.includes('manifest'));
 assert.ok(deserializeCampaign(serializeCampaign(d)));
}
const legacy=JSON.parse(serializeCampaign(c));legacy.story.version=1;legacy.story.completed=[1,2,3,4,5];legacy.battles=50;
const reset=deserializeCampaign(JSON.stringify(legacy));assert.equal(reset.legacyReset,true);assert.equal(reset.battles,0);assert.equal(reset.story.completed.length,0);assert.equal(reset.story.evidence.length,0);assert.equal(reset.story.discoveries.length,0);assert.equal(reset.owners.filter(x=>x==='blue').length,1);assert.equal(JSON.parse(serializeCampaign(reset)).legacyReset,undefined);
const budget=newCampaign(9,'normal','rts','story');budget.story.choices={ivo:'protect',contracts:'publish',channel:'military'};assert.equal(Story.budget(budget,3),150);assert.equal(Story.budget(budget,4),100);assert.equal(Story.budget(budget,7),250);

const retry=newCampaign(55,'normal','rts','story');retry.story.completed=[1,2];retry.story.choices={secondary:'records',ivo:'protect'};retry.story.seen=retry.world.regions.filter(r=>r.id!==retry.world.homes.blue&&r.id!==retry.world.homes.red).slice(0,3).map(r=>r.id);for(const id of retry.story.seen)retry.owners[id]='blue';
const retryMarker=Story.marker(retry),failedAttempt=Story.begin(retry,3,retryMarker.region);Story.resolve(retry,failedAttempt,{won:false});assert.equal(retry.story.completed.length,2);const retryNext=Story.marker(retry);assert.ok(Story.begin(retry,3,retryNext.region).id!==failedAttempt.id);
console.log('OK oito capítulos, migração limpa, fronteiras e nova tentativa');

const inspected=newCampaign(66,'normal','rts','story');assert.equal(Story.inspect(inspected,'records','route'),false);Story.proof(inspected,'records');Story.choose(inspected,'secondary','records');const inspectMarker=Story.marker(inspected),inspectAttempt=Story.begin(inspected,1,inspectMarker.region);assert.equal(Story.inspect(inspected,'records','route'),true);assert.equal(Story.inspect(inspected,'records','route'),false);assert.equal(Story.inspect(inspected,'records','missing'),false);assert.equal(inspectAttempt.discoveries.length,0,'pista examinada depois não muda tentativa iniciada');assert.equal(inspected.story.discoveries.length,1);assert.ok(deserializeCampaign(serializeCampaign(inspected)));inspected.story.discoveries.push('records:missing');assert.equal(deserializeCampaign(serializeCampaign(inspected)),null);
