'use strict';
// Horário de corte do servidor hospedado no PC: quando exige autorização e qual é o próximo desligamento.
const assert=require('node:assert/strict');
const {nextCutoff,needsPermission,parse}=require('../scripts/host-local.cjs');
const at=(d,h,m=0)=>new Date(2026,9,d,h,m);
// antes do corte: liga sem perguntar e desliga hoje
assert.equal(needsPermission(at(15,0,1)),false);assert.equal(needsPermission(at(15,12,59)),false);
assert.deepEqual(nextCutoff(at(15,12,59)),at(15,13));
// do corte até a meia-noite: pede autorização e o próximo corte é amanhã
for(const [h,m] of [[13,0],[13,1],[18,30],[23,59]]){assert.equal(needsPermission(at(15,h,m)),true,h+':'+m);assert.deepEqual(nextCutoff(at(15,h,m)),at(16,13));}
// virada de mês e horário configurado
assert.deepEqual(nextCutoff(at(31,14)),new Date(2026,10,1,13));
assert.deepEqual(nextCutoff(at(15,9),'09:30'),at(15,9,30));assert.equal(needsPermission(at(15,9,30),'09:30'),true);
assert.throws(()=>parse('25:00'));assert.throws(()=>parse('1300'));
console.log('OK horário de corte: autorização depois das 13:00 e próximo desligamento');
