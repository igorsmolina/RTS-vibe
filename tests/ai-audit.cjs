'use strict';
// Executa cada suíte isolada para que uma falha anterior não esconda as seguintes.
const fs=require('node:fs'),{spawnSync}=require('node:child_process');
const files=JSON.parse(fs.readFileSync('package.json','utf8')).scripts.test.match(/tests\/[\w.-]+\.cjs/g).filter(f=>!['tests/ai-strategy.test.cjs','tests/ai-air-economy.test.cjs','tests/ai-matrix.test.cjs'].includes(f));
const results=[];
for(const source of process.env.RTS_AI_AUDIT_CURRENT?['public/js/engine.js']:[process.env.RTS_AI_AUDIT_BASELINE||'test-output/ai-engine-before.js','public/js/engine.js'])for(const file of files){
 const script="const fs=require('node:fs'),read=fs.readFileSync;fs.readFileSync=function(p,...a){return /[\\\\/]public[\\\\/]js[\\\\/]engine\\.js$/.test(String(p))?read.call(this,process.env.RTS_AI_ENGINE,...a):read.call(this,p,...a);};require('./'+process.argv[1]);";
 const r=spawnSync(process.execPath,['-e',script,file],{encoding:'utf8',env:{...process.env,RTS_AI_ENGINE:source},timeout:180000});
 const sourceHash=require('node:crypto').createHash('sha256').update(fs.readFileSync(source)).digest('hex'),entry={source,sourceHash,file,code:r.status,error:r.error?.message,stdout:r.stdout,stderr:r.stderr};results.push(entry);console.log(source,file,r.status);fs.writeFileSync(process.env.RTS_AI_AUDIT_RESULT||(process.env.RTS_AI_AUDIT_CURRENT?'reports/ia-2026-10-11/suites-final.json':'reports/ia-2026-10-11/suites.json'),JSON.stringify(results,null,2));
}
process.exitCode=results.some(r=>r.code!==0)?1:0;
