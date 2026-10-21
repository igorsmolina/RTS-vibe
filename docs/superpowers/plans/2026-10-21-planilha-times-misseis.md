# Planilha por time + munição e imagens de mísseis — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar no jogo os valores que o usuário editou na planilha `unidades.xlsx` (separados por time: verde, vermelho e azul/França), dar munição limitada aos mísseis de helicóptero e drone, mostrar na tela quantos mísseis cada unidade carrega (com aviso "Pouca munição" e "Munição acabou") garantir que todo míssil tenha imagem e permitir afastar o zoom até enxergar o mapa inteiro.

**Architecture:** O kit é `KIT(u)` (`'blue'` = verdes, `'red'` = vermelhas, `'franca'` = azuis). Hoje só a França tem tabela de sobrescrita (`FR` → `FR_TYPES`). O plano cria `RED` → `RED_TYPES` no mesmo formato e faz `SPEC`/`UT` escolherem pela facção. A base `TYPES` passa a ser a ficha **verde**. Armas por kit usam o campo existente `arms` (já lido por `weaponStats`), agora também lido por `planeWeapon`, pelas armas terrestres (`atMissile`, `rifle`) e com `highRange` para altitude alta.

**Tech Stack:** JavaScript puro no navegador (`public/js/*.js`), testes Node com `assert` em `tests/*.test.cjs` (o motor é carregado com `new Function(...)`, como em `tests/franca.test.cjs`).

**Spec:** planilha do usuário `/root/.claude/uploads/380c955d-ddec-5907-8209-551d61660cba/6063502f-unidades.xlsx` (diferenças em relação à versão gerada estão transcritas nas tabelas abaixo) e respostas do usuário nesta sessão:
- "xN" = munição total, que recarrega na manutenção. Também pediu um indicador na tela de quantos mísseis a unidade carrega, e um texto sobre a unidade quando a munição está baixa e quando acaba.
- Aviões vermelhos: aplicar só as células alteradas. O resto continua com o valor do código (`planeWeapon`).
- Imagens: reusar os 6 sprites existentes para os mísseis sem imagem.

## Global Constraints

- Verde = kit `'blue'`, Vermelho = kit `'red'`, Azul = kit `'franca'` (`FRANCE`). Toda leitura de ficha passa por `UT(u)` / `SPEC(type,faction)`. Nada de `u.owner==='red'` para decidir ficha.
- `TYPES` = ficha verde. `RED` e `FR` guardam **só** o que difere da verde, no formato `{campo:valor}`. `RED_TYPES`/`FR_TYPES` = `{...TYPES[type],...override}`.
- Valores finais por time são exatamente os das tabelas A–D. Campos fora das tabelas não mudam.
- Textos de interface em português, como os existentes. Avisos flutuantes: `'Pouca munição'` (cor `'#ffdc92'`) e `'Munição acabou'` (cor `'#f26d5b'`).
- Limiar de "pouca munição": `have === Math.max(1, Math.floor(max/4))`, avisado só ao cruzar (no disparo que leva até ele).
- Zoom out: o limite mínimo deixa de ser `.35` fixo e passa a ser o zoom que enquadra o mapa inteiro (128 × 96 casas × `CELL`=56) na área útil do campo. O zoom máximo continua `1.5`.
- Sem dependências novas. Sem arte nova: os mísseis sem sprite reusam os PNGs de `assets/Misseis`.
- Nenhum teste existente é apagado ou pulado. Asserções que fixam valores antigos são atualizadas para os valores das tabelas.

### Tabela A — Ficha verde (base `TYPES`, `public/js/engine.js:38-64`)

| Tipo | Campos novos/alterados |
|---|---|
| lightTank | speed 2.2, vision 6 |
| tank | speed 2, vision 6 |
| heavyTank | speed 1.7, vision 6, `trophy: 6` |
| commander | `aura: 6` |
| engineer | `repair: 24` |
| antitank | `atMissiles: 4`, `arms:{atMissile:{...WEAPONS.atMissile,damage:50}}` |
| missileInfantry | damage 55 |
| helicopterGround | `missiles: 8`, `arms:{agm:{...WEAPONS.agm,damage:60,range:7,highRange:20,cooldown:3}}` |
| helicopterAir | `arms:{aam:{...WEAPONS.aam,damage:85,range:17}}` |
| stealthDrone | damage 80, range 15, `arms:{stealthMissile:{...WEAPONS.stealthMissile,damage:80,range:15}}` |

`arms` dos tipos base precisa de `WEAPONS`. Declare os `arms` da base num `Object.assign` logo depois de `WEAPONS` (linha 68), como o bloco dos aeroportos faz em `:99`.

### Tabela B — Sobrescrita vermelha (`RED`, novo, logo antes de `FR` em `:120`)

| Tipo | Override |
|---|---|
| lightTank | speed 1.9, vision 5, `atMissiles: 4` (míssil = `WEAPONS.atMissile`: 40, alcance 7) |
| tank | speed 1.8, vision 5, `falloff: 4` |
| heavyTank | speed 1.5, vision 5, `trophy: 3`, `atMissiles: 4`, `arms:{atMissile:{...WEAPONS.atMissile,damage:50,range:12}}` |
| engineer | `repair: 30` |
| antitank | `atMissiles: 6`, `arms:{atMissile:{...WEAPONS.atMissile,damage:40}}` |
| missileInfantry | damage 45, range 15 |
| recon | speed 2.5 |
| transportTruck | `unarmed:false`, damage 20, range 3, accuracy .75, cooldown 1 (metralhadora; não fere tank/heavyTank porque não está em `BREAKERS`) |
| helicopter | damage 7, `gun:{...HELICOPTER_MINIGUN,damage:7}` |
| helicopterGround | `missiles: 12`, `arms:{agm:{...WEAPONS.agm,damage:80,range:7,highRange:23,cooldown:2.5}}` |
| helicopterAir | `arms:{aam:{...WEAPONS.aam,damage:70,range:15}}` |
| stealthDrone | damage 50, range 10, `missiles: 4`, `arms:{stealthMissile:{...WEAPONS.stealthMissile,damage:50,range:10}}` |

### Tabela C — Acréscimos na França (`FR`, `:120-136`)

Campos a acrescentar ou alterar no objeto `FR` (o que já existe e não aparece aqui fica igual):

| Tipo | Override |
|---|---|
| infantry | damage 55 |
| engineer | cost 50 |
| machinegun | cost 60, damage 20 |
| antitank | cost 60 (míssil 50 herda da verde) |
| missileInfantry | cost 55, damage 40, range 12, `rifle: true` (fuzil alcance 3 contra tropas a pé) |
| commander | `aura: 8` |
| recon | speed 3 |
| lightTank | speed 2.5 |
| tank | speed 2, vision 5 |
| heavyTank | speed 1.7, vision 5 |
| artillery | speed 1.8, cooldown 4 |
| rocketArtillery | speed 1, damage 20, range 25 |
| antiAirVehicle | damage 90, range 25 |
| helicopterGround | speed 3.5, `missiles: undefined` (França continua sem limite no míssil, pois a planilha não pediu) |
| helicopterAir | speed 3.8 |
| reconDrone | vision 15 |
| stealthDrone | `missiles: 6` |
| transportPlane | speed 5 |

### Tabela D — Aviões (`PLANE_MODELS`, `:83-97`)

Novo campo opcional `arms:{arma:{campos}}`, aplicado por último em `planeWeapon`.

| Modelo | Alterações |
|---|---|
| fighterBlue | ammo.antiRadiation 4; `arms:{jetAam:{damage:90}}` |
| multiroleBlue | ammo.jetAgm 6, ammo.antiRadiation 4; `arms:{jetAam:{damage:90},jetAgm:{damage:80}}` |
| stealthFighterBlue | `arms:{jetAam:{damage:90}}` |
| multiroleRed | ammo.jetAgm 4 |
| bomberRed | speed 3; `arms:{cruiseMissile:{range:70}}` |
| fighterFr | speed 6.5, ammo.antiRadiation 2 |
| multiroleFr | speed 6, ammo.antiRadiation 2 |
| stealthFighterFr | speed 5.7 |
| bomberFr | ammo.cruiseMissile 4; `arms:{cruiseMissile:{range:75}}` |

O custo dos aviões continua derivado em `:98` (casco + munição × `AMMO_PRICE`). Não fixe custo à mão.

## Review Focus

1. **Tanque leve vermelho contra tanque pesado.** `weapon()` (`:773`) devolve `null` para `lightTank`→`heavyTank` antes de escolher arma. Com mísseis antitanque, o vermelho deve conseguir disparar o míssil contra o pesado. Sem mísseis, continua sem atacar. O teste fica na Task 5.
2. **Helicóptero sem mísseis.** Com `u.missiles===0`, o modo Auto deve cair para o canhão, e o modo manual `agm` deve devolver `null`, sem disparar munição negativa. O teste fica na Task 6.
3. **Facção ≠ dono.** Em multiplayer, o lado `blue` pode jogar com o kit `red` (`factions`). A ficha vem de `KIT(u)`/`factionOf`, não do dono. O teste com `factions={blue:'red',red:'blue'}` fica na Task 1.
4. **Caminhão vermelho armado e a IA.** A IA não deve tratar o caminhão como tropa de combate: `fighter()` (`:1306`) precisa excluir `transportTruck`. O caminhão também não fere tank/heavyTank. Teste na Task 5.
5. **Aviso de munição em rajadas.** Salvas de avião (`planeSalvo`) disparam vários mísseis seguidos. "Pouca munição" e "Munição acabou" saem uma vez cada no cruzamento, não a cada míssil. Teste na Task 6.

---

### Task 1: Kit vermelho e fichas por time (campos simples)

**Files:**
- Modify: `public/js/engine.js:38-64` (Tabela A, campos simples), `:120-139` (`RED`, `RED_TYPES`, `SPEC`, `UT`, Tabela C campos simples), `:83-98` (velocidade e munição da Tabela D), role strings dos tipos alterados
- Create: `tests/team-sheet.test.cjs`
- Modify: `package.json` (incluir `node tests/team-sheet.test.cjs` no script `test`, logo após `tests/franca.test.cjs`)

**Interfaces:**
- Produces: `RED` (objeto de overrides), `RED_TYPES`, `SPEC(type,faction)` → ficha do kit (`'red'` → `RED_TYPES`, `FRANCE` → `FR_TYPES`, senão `TYPES`), `UT(u)` = `SPEC(u.type,KIT(u))`. Os campos `aura`, `repair`, `trophy`, `atMissiles`, `missiles`, `arms`, `rifle` e `highRange` são declarados aqui, quando a tabela os traz; o uso vem nas tasks seguintes.

- [ ] **Step 1: Escrever o teste que falha**

Em `tests/team-sheet.test.cjs`, no mesmo esqueleto de `tests/franca.test.cjs` (carregar `engine.js` via `new Function`, `field(factions)`, lista `cases`), exporte também `RED_TYPES`. Escreva:

```js
test('ficha verde, vermelha e azul seguem a planilha',()=>{
 const v=t=>SPEC(t,'blue'),r=t=>SPEC(t,'red'),a=t=>SPEC(t,FRANCE);
 assert.deepEqual([v('lightTank').speed,v('lightTank').vision,r('lightTank').speed,r('lightTank').vision,a('lightTank').speed],[2.2,6,1.9,5,2.5]);
 assert.deepEqual([v('tank').speed,v('tank').vision,r('tank').speed,r('tank').falloff,a('tank').speed,a('tank').vision],[2,6,1.8,4,2,5]);
 assert.deepEqual([v('heavyTank').speed,v('heavyTank').vision,r('heavyTank').speed,r('heavyTank').vision,a('heavyTank').speed,a('heavyTank').vision],[1.7,6,1.5,5,1.7,5]);
 assert.equal(r('recon').speed,2.5);assert.equal(a('recon').speed,3);
 assert.deepEqual([a('infantry').damage,a('engineer').cost,a('machinegun').cost,a('machinegun').damage,a('antitank').cost,a('missileInfantry').cost],[55,50,60,20,60,55]);
 assert.deepEqual([v('missileInfantry').damage,r('missileInfantry').damage,r('missileInfantry').range,a('missileInfantry').damage,a('missileInfantry').range],[55,45,15,40,12]);
 assert.deepEqual([a('artillery').speed,a('artillery').cooldown,a('rocketArtillery').speed,a('rocketArtillery').damage,a('rocketArtillery').range],[1.8,4,1,20,25]);
 assert.deepEqual([a('antiAirVehicle').damage,a('antiAirVehicle').range,a('helicopterGround').speed,a('helicopterAir').speed,a('reconDrone').vision,a('transportPlane').speed],[90,25,3.5,3.8,15,5]);
 assert.deepEqual([SPEC('bomberRed','red').speed,SPEC('fighterFr',FRANCE).speed,SPEC('multiroleFr',FRANCE).speed,SPEC('stealthFighterFr',FRANCE).speed],[3,6.5,6,5.7]);
 assert.deepEqual([PLANE_MODELS.fighterBlue.ammo.antiRadiation,PLANE_MODELS.multiroleBlue.ammo.jetAgm,PLANE_MODELS.multiroleBlue.ammo.antiRadiation,PLANE_MODELS.multiroleRed.ammo.jetAgm,PLANE_MODELS.fighterFr.ammo.antiRadiation,PLANE_MODELS.multiroleFr.ammo.antiRadiation,PLANE_MODELS.bomberFr.ammo.cruiseMissile],[4,6,4,4,2,2,4]);
});
test('a ficha vem do kit, não do dono',()=>{
 const g=field({blue:'red',red:'blue'});const mine=g.add('blue','lightTank',10,80),theirs=g.add('red','lightTank',100,10);
 assert.equal(UT(mine).speed,1.9);assert.equal(UT(theirs).speed,2.2);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node tests/team-sheet.test.cjs`
Expected: FAIL, com `RED_TYPES is not defined` ou asserção em `lightTank.speed`.

- [ ] **Step 3: Implementar `RED`, `RED_TYPES` e os campos simples das tabelas A–D**

`const KIT_TYPES={red:RED_TYPES,[FRANCE]:FR_TYPES}; SPEC=(type,faction)=>KIT_TYPES[faction]?.[type]||TYPES[type]; UT=u=>u&&SPEC(u.type,KIT(u))`. Atualize as `role` dos tipos alterados para citar os novos números (ex.: tanque pesado verde "Trophy: 6 cargas"; caminhão vermelho "4 vagas · metralhadora leve, não fere tanques médios/pesados").

- [ ] **Step 4: Rodar o teste novo e a suíte da França**

Run: `node tests/team-sheet.test.cjs && node tests/franca.test.cjs && node tests/factions.test.cjs`
Expected: `team-sheet` passa. Asserções de `franca`/`factions` que fixam os valores antigos (ex.: `UT(red).speed,2` para tanque leve vermelho) recebem os valores das tabelas e passam.

- [ ] **Step 5: Commit**

```bash
git add public/js/engine.js tests/team-sheet.test.cjs tests/franca.test.cjs tests/factions.test.cjs package.json
git commit -m "feat: fichas separadas por time (verde, vermelho, França) conforme planilha"
```

### Task 2: Aura do comandante, reparo do engenheiro e Trophy por time

**Files:**
- Modify: `public/js/engine.js:812` (`hasAura`), `:1045` e `:1708` (reparo 24 fixo), `:141` (`trophyMax`), `public/js/render.js:569` (losango da aura), `public/js/ui.js:227` (`' · Trophy '+u.trophy+'/3'`)
- Test: `tests/team-sheet.test.cjs`

**Interfaces:**
- Consumes: `UT(u).aura`, `UT(u).repair`, `UT(u).trophy` (Task 1).
- Produces: `hasAura(u)` usa `DIST(u,c)<=UT(c).aura`; `trophyMax(u)` = `UT(u).galix?GALIX_CHARGES:(UT(u).trophy??TROPHY_CHARGES)`.

- [ ] **Step 1: Teste que falha**

```js
test('aura, reparo e Trophy dependem do time',()=>{
 for(const [kit,aura] of [['blue',6],['red',6],[FRANCE,8]]){const g=field({blue:kit,red:'red'});g.add('blue','commander',10,80);
  assert.equal(g.hasAura(g.add('blue','infantry',10+aura,80)),true,kit);assert.equal(g.hasAura(g.add('blue','infantry',11+aura,80)),false,kit);}
 const g=field({blue:'blue',red:'red'});
 assert.equal(trophyMax(g.add('blue','heavyTank',10,80)),6);assert.equal(trophyMax(g.add('red','heavyTank',100,10)),3);
 for(const [side,x,y,heal] of [['blue',20,80,24],['red',100,20,30]]){const e=g.add(side,'engineer',x,y),t=g.add(side,'infantry',x+1,y);t.hp=10;
  assert.ok(g.order(e,'repair',{targetId:t.id}));settle(g);assert.equal(t.hp,10+heal,side);}
});
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `node tests/team-sheet.test.cjs`. Expected: FAIL na aura (raio 2 hoje).
- [ ] **Step 3: Implementar.** Troque o `24` do reparo por `UT(u).repair` nos dois pontos. O losango de `render.js:569` passa a usar o raio `UT(u).aura` em casas a partir do centro (`(u.x+.5)*CELL`). Em `ui.js:227`, troque `/3` por `trophyMax(u)`. Se o engenheiro precisar de ação de turno no teste, use `run(g,…)` no modo RTS, como `franca.test.cjs`.
- [ ] **Step 4: Rodar.** Run: `node tests/team-sheet.test.cjs`. Expected: PASS.
- [ ] **Step 5: Commit** (`feat: aura, reparo e Trophy por time`).

### Task 3: Armas por time (terrestres, helicópteros, drones)

**Files:**
- Modify: `public/js/engine.js:766-768` (`weaponStats`, `weaponRange`, `range`), `:814` (`attackPower`), `:819` (`rawAccuracy`, ramo `GROUND_WEAPONS`)
- Test: `tests/team-sheet.test.cjs`

**Interfaces:**
- Consumes: `arms`, `gun`, `highRange` das tabelas A–C.
- Produces: `weaponStats(u,w)` passa a ser a única fonte de dano/alcance/precisão também para `atMissile` e `rifle`. `weaponRange(u,w,'high')` devolve `stats.highRange` quando existe, senão o `+5` atual.

- [ ] **Step 1: Teste que falha**

```js
test('mísseis e armas mudam por time',()=>{
 const g=field({blue:'blue',red:'red'}),pow=(u,w)=>g.attackPower(u,w)/NATION_DOCTRINES.balanced.damage;
 const vAt=g.add('blue','antitank',10,80),rAt=g.add('red','antitank',100,10);assert.equal(pow(vAt,'atMissile'),50);assert.equal(pow(rAt,'atMissile'),40);
 const vH=g.add('blue','helicopterGround',12,80),rH=g.add('red','helicopterGround',100,12);
 assert.deepEqual([pow(vH,'agm'),g.weaponRange(vH,'agm','low'),g.weaponRange(vH,'agm','high'),g.weaponStats(vH,'agm').cooldown],[60,7,20,3]);
 assert.deepEqual([pow(rH,'agm'),g.weaponRange(rH,'agm','low'),g.weaponRange(rH,'agm','high'),g.weaponStats(rH,'agm').cooldown],[80,7,23,2.5]);
 const vA=g.add('blue','helicopterAir',14,80),rA=g.add('red','helicopterAir',100,14);assert.deepEqual([pow(vA,'aam'),g.weaponRange(vA,'aam','low'),pow(rA,'aam'),g.weaponRange(rA,'aam','low')],[85,17,70,15]);
 assert.equal(pow(g.add('red','helicopter',100,16),'gun'),7);
 const vD=g.add('blue','stealthDrone',16,80),rD=g.add('red','stealthDrone',100,18);
 assert.deepEqual([pow(vD,'stealthMissile'),g.weaponRange(vD,'stealthMissile'),pow(rD,'stealthMissile'),g.weaponRange(rD,'stealthMissile'),rD.missiles],[80,15,50,10,4]);
});
```

Exporte `NATION_DOCTRINES` no cabeçalho do teste. Se algum alvo de `add` for ocupado, mude as coordenadas: o teste só confere números.

- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL em `pow(vAt,'atMissile')` (hoje 40).
- [ ] **Step 3: Implementar.** Em `attackPower` e `rawAccuracy`, troque `WEAPONS[w]` do ramo `GROUND_WEAPONS` por `this.weaponStats(u,w)`. Em `range()`, o ramo antitanque usa `this.weaponStats(u,w).range`. `missileInfantry`/`antiAirVehicle` já leem `t.range`/`t.damage`.
- [ ] **Step 4: Rodar.** Run: `node tests/team-sheet.test.cjs && node tests/missiles.test.cjs && node tests/stealth-drone.test.cjs`. Expected: PASS, com asserções de valores antigos atualizadas para as tabelas.
- [ ] **Step 5: Commit** (`feat: mísseis e armas por time`).

### Task 4: Armas e alcance dos aviões por modelo

**Files:**
- Modify: `public/js/engine.js:403` (`planeWeapon`), `:98` (`range` do cruzeiro), `public/js/render.js:582` (rótulo fixo `'alcance 67'`)
- Test: `tests/team-sheet.test.cjs`

**Interfaces:**
- Consumes: `PLANE_MODELS[m].arms` (Tabela D).
- Produces: `planeWeapon(u,w)` = `{...base,range,damage,...UT(u).arms?.[w]}`, mantendo os valores por time que já existem para o que a Tabela D não mexe. `TYPES[plane].range` usa `m.arms?.cruiseMissile?.range??67` quando há cruzeiro.

- [ ] **Step 1: Teste que falha**

```js
test('aviões: dano e alcance por modelo',()=>{
 const g=field({blue:'blue',red:'red'}),w=(type,side,weapon)=>g.planeWeapon(g.add(side,type,side==='blue'?10:100,side==='blue'?80:10),weapon);
 assert.equal(w('fighterBlue','blue','jetAam').damage,90);assert.equal(w('stealthFighterBlue','blue','jetAam').damage,90);
 assert.equal(w('multiroleBlue','blue','jetAam').damage,90);assert.equal(w('multiroleBlue','blue','jetAgm').damage,80);
 assert.equal(w('fighterRed','red','jetAam').damage,75,'célula vermelha não editada mantém o código');assert.equal(w('multiroleRed','red','jetAgm').damage,90);
 assert.equal(w('bomberRed','red','cruiseMissile').range,70);assert.equal(w('bomberBlue','blue','cruiseMissile').range,67);
 const fr=field({blue:FRANCE,red:'red'});assert.equal(fr.planeWeapon(fr.add('blue','bomberFr',10,80),'cruiseMissile').range,75);
 assert.equal(TYPES.bomberRed.range,70);
});
```

- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL em `fighterBlue jetAam` (hoje 70).
- [ ] **Step 3: Implementar** conforme Interfaces. Em `render.js:582`, troque `'alcance 67'` por `'alcance '+Math.max(...units.map(u=>game.weaponRange(u,'cruiseMissile')))`.
- [ ] **Step 4: Rodar.** Run: `node tests/team-sheet.test.cjs && node tests/aviation.test.cjs && node tests/air-combat-rules.test.cjs`. Expected: PASS.
- [ ] **Step 5: Commit** (`feat: armas dos aviões por modelo`).

### Task 5: Mísseis antitanque nos tanques vermelhos, fuzil do lançador azul e metralhadora do caminhão vermelho

**Files:**
- Modify: `public/js/engine.js:69` (`AT_MISSILES` deixa de ser lido diretamente), `:596`, `:606` (inicialização), `:768` (`range`), `:773` (`weapon`), `:775-779` (`pickWeapon`), `:824` (`canService`), `:971` (consumo), `:1047`, `:1556`, `:1686-1687` (recarga e IA), `:1306` (`fighter`), `public/js/render.js:593` (`look` do caminhão = `'machinegun'`), `public/js/ui.js:226` (texto `míssil 7 (x/4)` e `só aeronaves · 10`)
- Test: `tests/team-sheet.test.cjs`

**Interfaces:**
- Consumes: `UT(u).atMissiles`, `UT(u).rifle` (Task 1); `weaponStats` (Task 3).
- Produces: `const atMax=u=>UT(u)?.atMissiles||0` (top-level em `engine.js`, junto de `trophyMax`). Toda checagem `u.type==='antitank'` ligada a `u.atMissiles` vira `atMax(u)>0`, e toda `AT_MISSILES` vira `atMax(u)`.

- [ ] **Step 1: Teste que falha**

```js
test('tanques vermelhos lançam míssil antitanque; lançador azul tem fuzil; caminhão vermelho atira',()=>{
 const g=field({blue:'blue',red:'red'});
 const lt=g.add('red','lightTank',60,40),ht=g.add('red','heavyTank',60,44),vHeavy=g.add('blue','heavyTank',62,40),vInf=g.add('blue','infantry',62,44);
 assert.equal(lt.atMissiles,4);assert.equal(ht.atMissiles,4);assert.equal(g.add('red','antitank',60,48).atMissiles,6);assert.equal(g.add('blue','antitank',10,80).atMissiles,4);
 assert.equal(g.weapon(lt,vHeavy),'atMissile');assert.equal(g.weapon(ht,vHeavy),'atMissile');assert.equal(g.weapon(ht,vInf),'heavyTank');
 assert.equal(g.range(ht,vHeavy),12);lt.atMissiles=0;assert.equal(g.weapon(lt,vHeavy),null);
 assert.equal(g.weapon(g.add('blue','lightTank',10,84),vHeavy),null,'verde continua sem míssil');
 const fr=field({blue:FRANCE,red:'red'}),mi=fr.add('blue','missileInfantry',60,40);
 assert.equal(fr.weapon(mi,fr.add('red','infantry',62,40)),'rifle');assert.equal(fr.range(mi,fr.get(fr.units.at(-1).id)),3);
 assert.equal(fr.weapon(mi,fr.add('red','lightTank',62,44)),null);
 const truck=g.add('red','transportTruck',70,40);assert.equal(g.weapon(truck,vInf),'transportTruck');assert.equal(g.weapon(truck,vHeavy),null);
 assert.equal(g.fighter(truck),false,'IA não usa o caminhão como tropa de combate');
});
```

- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL em `lt.atMissiles` (undefined).
- [ ] **Step 3: Implementar.**
  - `pickWeapon`: antes do ramo terrestre, `if(atMax(a)&&!air&&(UT(b).vehicle||UT(b).structure)&&a.atMissiles>0)return 'atMissile'`. O antitanque sem míssil cai no `'rifle'`. `missileInfantry` devolve `air?a.type:t.rifle&&FOOT(b)?'rifle':null`.
  - `weapon`: o bloqueio `lightTank`→`heavyTank` só vale quando `pickWeapon` não devolveu `'atMissile'`.
  - `range`: com `atMax(u)>0` e arma `'atMissile'`, `weaponStats(u,'atMissile').range` + bônus de terreno. `missileInfantry` com arma `'rifle'` usa `weaponStats(u,'rifle').range` + terreno.
  - `fighter`: incluir `'transportTruck'` na lista de exclusão.
  - `ui.js:226`: os textos usam `UT(u).range`, `weaponRange`/`weaponStats(u,'atMissile').range` e `atMax(u)`. O texto do míssil antitanque aparece em qualquer unidade com `atMax(u)>0`.
- [ ] **Step 4: Rodar.** Run: `node tests/team-sheet.test.cjs && node tests/infantry-rebalance.test.cjs && node tests/new-troops.test.cjs && node tests/ai-strategy.test.cjs`. Expected: PASS.
- [ ] **Step 5: Commit** (`feat: mísseis antitanque vermelhos, fuzil do lançador azul, metralhadora do caminhão vermelho`).

### Task 6: Munição de mísseis do helicóptero/drone, contagem e avisos

**Files:**
- Modify: `public/js/engine.js:606` (`if(t.stealth){u.missiles=…}` → `if(t.missiles)u.missiles=t.missiles`, separado do bloco `spotted`), `:778` (Auto/manual do helicóptero respeitam `u.missiles`), `:971` e `:363` (consumo + aviso), `:824`, `:1047`, `:1686-1687` (recarga +2 por turno / +1 a cada 3 s, só para helicóptero, nunca acima de `UT(u).missiles`), `:1511` (garantir que a IA do drone furtivo continua só para `UT(u).stealth`)
- Test: `tests/team-sheet.test.cjs`

**Interfaces:**
- Consumes: `atMax` (Task 5), `UT(u).missiles` (Task 1).
- Produces:
  - `missileLoad(u)` → `{have:number,max:number}|null` (método de `Game`). `atMax(u)>0` → `{u.atMissiles,atMax(u)}`; `UT(u).missiles` → `{u.missiles,UT(u).missiles}`; avião → soma de `u.ammo[w]` e `UT(u).ammo[w]` para `w` com `MISSILE(w)`; senão `null`.
  - `ammoWarning(u)` (método de `Game`): chamado logo depois de cada consumo de míssil. Emite `this.event('text',u,{text:'Munição acabou',color:'#f26d5b'})` quando `have===0`, ou `'Pouca munição'`/`'#ffdc92'` quando `have===Math.max(1,Math.floor(max/4))`.

- [ ] **Step 1: Teste que falha**

```js
test('helicóptero ar-terra tem munição limitada e avisa',()=>{
 const g=field({blue:'blue',red:'red'}),h=g.add('blue','helicopterGround',60,40),tank=g.add('red','tank',63,40);
 assert.deepEqual(g.missileLoad(h),{have:8,max:8});assert.deepEqual(g.missileLoad(g.add('red','helicopterGround',100,10)),{have:12,max:12});
 h.missiles=3;g.events=[];g.ammoWarning(h);assert.equal(g.events.length,0,'3 de 8 ainda não é pouca');
 h.missiles=2;g.events=[];g.ammoWarning(h);assert.equal(g.events.at(-1).text,'Pouca munição');
 h.missiles=0;g.events=[];g.ammoWarning(h);assert.equal(g.events.at(-1).text,'Munição acabou');
 assert.equal(g.weapon(h,tank),'gun','sem mísseis, Auto cai para o canhão');h.weaponMode='agm';assert.equal(g.weapon(h,tank),null);
 const fr=field({blue:FRANCE,red:'red'});assert.equal(fr.missileLoad(fr.add('blue','helicopterGround',60,40)),null,'França sem limite');
 assert.deepEqual(fr.missileLoad(fr.add('blue','stealthDrone',60,44)),{have:6,max:6});
 assert.deepEqual(g.missileLoad(g.add('blue','fighterBlue',10,80)),{have:8,max:8});
});
test('salva de avião avisa uma vez',()=>{
 const g=field({blue:'blue',red:'red'}),p=g.add('blue','fighterBlue',10,80);
 p.ammo.jetAam=0;p.ammo.antiRadiation=3;g.events=[];g.ammoWarning(p);g.ammoWarning(p);
 assert.equal(g.events.filter(e=>e.text==='Pouca munição').length,0,'have=3 > limiar 2');
 p.ammo.antiRadiation=2;g.ammoWarning(p);p.ammo.antiRadiation=1;g.ammoWarning(p);
 assert.equal(g.events.filter(e=>e.text==='Pouca munição').length,1);
});
```

- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL, `g.missileLoad is not a function`.
- [ ] **Step 3: Implementar** `missileLoad`, `ammoWarning` e o consumo. No ponto de consumo (`:971`), `if(w==='agm'&&u.missiles!==undefined)u.missiles--` e depois `this.ammoWarning(u)` sempre que `MISSILE(w)`. Em `helicopterWeaponFits`, `agm` exige `u.missiles===undefined||u.missiles>0`.
- [ ] **Step 4: Teste de disparo real.** Acrescente um caso que dispara o `agm` de verdade (como `missiles.test.cjs` provoca tiros) até zerar e confira que `h.missiles` termina em 0 e que os eventos contêm uma vez `'Pouca munição'` e uma vez `'Munição acabou'`. Run: `node tests/team-sheet.test.cjs && node tests/missiles.test.cjs && node tests/stealth-drone.test.cjs`. Expected: PASS.
- [ ] **Step 5: Commit** (`feat: munição de mísseis do helicóptero e drone com avisos`).

### Task 7: Indicador de mísseis na tela, imagens de todos os mísseis e textos

**Files:**
- Modify: `public/js/render.js:29` (`missileArt`), `:467` e `:493` (desenhar contador ao lado da barra de vida), `public/js/ui.js:225-227` (painel: `Mísseis have/max` via `game.missileLoad`), `assets/Misseis/README.md` (tabela de uso dos sprites)
- Create: `tests/missile-art.test.cjs` (e incluir no script `test` do `package.json`)

**Interfaces:**
- Consumes: `game.missileLoad(u)` (Task 6), `MISSILE(w)` (`engine.js:154`).
- Produces: `missileArt` com uma entrada para todo nome em `MISSILE`. Acrescentar `atMissile:['air-ground',22]`, `missileInfantry:['anti-air',24]`, `jetAgm:['air-ground',28]`, `antiRadiation:['air-air',30]`. Também um método `ammoBadge(x,y,u)` no renderizador.

- [ ] **Step 1: Teste que falha (`tests/missile-art.test.cjs`)**

```js
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(path.join(__dirname,'..','public','js',f),'utf8');
const list=read('engine.js').match(/const MISSILE=w=>(\[[^\]]+\])/)[1],missiles=JSON.parse(list.replace(/'/g,'"'));
const art=Function('return '+read('render.js').match(/const missileArt=(\{[^;]+\});/)[1])();
for(const w of missiles)assert.ok(art[w],'míssil sem imagem: '+w);
console.log('OK',missiles.length,'mísseis com imagem');
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `node tests/missile-art.test.cjs`. Expected: FAIL, `míssil sem imagem: atMissile`.
- [ ] **Step 3: Implementar.**
  - `missileArt` conforme Interfaces.
  - `ammoBadge(x,y,u)` desenha `have/max` em fonte `bold 11px Segoe UI`, com um traço de míssil antes do número. A cor é `'#dde6cf'` no normal, `'#ffdc92'` com `have<=Math.max(1,Math.floor(max/4))` e `'#f26d5b'` com zero. Desenhe abaixo da barra de vida, para `u.owner===localPlayerSide()` com `game.missileLoad(u)` não nulo, e **sempre** (não só selecionada ou ferida).
  - No painel (`ui.js`), mostre `Mísseis have/max` para qualquer unidade com `missileLoad`.
  - No README dos mísseis, acrescente linhas para antitanque/tanques vermelhos (ar-terra), lançador (antiaéreo), antiblindado de avião (ar-terra) e antirradiação (ar-ar).
- [ ] **Step 4: Rodar.** Run: `node tests/missile-art.test.cjs && node tests/missiles.browser.test.cjs && node tests/rocket-animation.browser.test.cjs`. Expected: PASS. Se os testes de navegador não acharem o Chrome, rode com `executablePath:'/opt/pw-browsers/chromium'` conforme o ambiente e registre isso no relatório. Depois abra o jogo (`npm start`) e confira numa captura: um antitanque mostra `4/4` sob a vida, e o texto "Pouca munição" sobe ao chegar a 1.
- [ ] **Step 5: Commit** (`feat: contador de mísseis na tela e imagem para todo míssil`).

### Task 8: Zoom out até enxergar o mapa inteiro

**Files:**
- Modify: `public/js/render.js:344` (`clampCamera`, limite fixo `.35`) e `:342-343` (`cameraViewport`), `public/js/ui.js:294` (roda do mouse: `cam.zoom*=…` seguido de `clampCamera()`), `public/index.html:222` (texto do manual: citar que a roda afasta até o mapa inteiro)
- Test: `tests/zoom.browser.test.cjs`, `tests/camera-performance.browser.test.cjs` (acrescentar o novo zoom mínimo)

**Interfaces:**
- Produces: `const minZoom=()=>{const v=cameraViewport();return Math.min(v.width/(COLS*CELL),v.height/(ROWS*CELL));}` (top-level em `render.js`, junto de `cameraViewport`). `clampCamera` usa `Math.max(minZoom(),Math.min(1.5,cam.zoom))`. Em cada eixo cujo mapa cabe inteiro na janela (`cells*CELL*z<=size`), a câmera fica fixa de modo que o mapa fique centralizado, em vez do clamp atual por centro. `minZoom()` nunca passa de `1.5`, para janelas muito pequenas.

- [ ] **Step 1: Escrever o teste que falha**

Em `tests/zoom.browser.test.cjs` (mesmo esqueleto de Playwright e `newOperation(...)` já usado), antes do `assert.deepEqual(errors,[])` final, para cada viewport de `[{width:1440,height:1000},{width:1920,height:1080},{width:390,height:844}]`:

```js
const fit=await page.evaluate(async()=>{await renderer.groundReady;for(let i=0;i<60;i++){cam.zoom*=1/1.15;clampCamera();}
 const v=cameraViewport(),expected=Math.min(v.width/(COLS*CELL),v.height/(ROWS*CELL));renderer.draw(0);
 const c=viewCells();return{zoom:cam.zoom,expected,x0:c.x0,y0:c.y0,x1:c.x1,y1:c.y1,cols:COLS,rows:ROWS};});
assert.ok(Math.abs(fit.zoom-fit.expected)<1e-9,'zoom mínimo deve enquadrar o mapa inteiro');
assert.deepEqual([fit.x0,fit.y0,fit.x1,fit.y1],[0,0,fit.cols,fit.rows],'todas as casas do mapa visíveis');
```

e verifique também que `cam.zoom` nunca fica abaixo de `expected` (mais um `for` de zoom out depois do primeiro e uma asserção `>=`), e que um segundo `cam.zoom*=1.15; clampCamera();` volta a aproximar (`fit.zoom<cam.zoom`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `node tests/zoom.browser.test.cjs`
Expected: FAIL, `zoom mínimo deve enquadrar o mapa inteiro` (hoje o piso é `.35`; a 1440×1000 o enquadramento exige ≈ `.166`).

- [ ] **Step 3: Implementar `minZoom()`**

Atualize `clampCamera` conforme Interfaces. Ajuste o clamp de cada eixo: se o mapa cabe na janela, `cam[axis]=(cells*CELL)/2-size/z/2` (centralizado); senão mantém a fórmula atual. Verifique a lógica de zoom em `ui.js:294`: ela já chama `clampCamera()` duas vezes, então não precisa mudar além do piso. Confirme em `render.js` que nada mais assume `cam.zoom>=.35` (procure por `.35` e `cam.zoom<`): o seletor `cell>=6||label` das réguas (`:607-608`) já trata a densidade em zoom baixo.

- [ ] **Step 4: Rodar o teste novo e o desempenho**

Acrescente `.17` e o zoom mínimo calculado à lista `[1.5,1,.7]` de `tests/camera-performance.browser.test.cjs:31`, e `minZoom()` à lista `[1,.5,.35]` de `tests/zoom.browser.test.cjs`, com a mesma exigência de nenhuma textura recriada com a câmera parada e `terrainReads<cells*4`.
Run: `node tests/zoom.browser.test.cjs && node tests/camera-performance.browser.test.cjs && node tests/minimap-load.browser.test.cjs`
Expected: PASS. Se o desenho a `minZoom()` ultrapassar o orçamento de quadro dos testes, a correção fica em `Renderer.draw` (por exemplo, não desenhar sprites menores que 2 px ou usar só `groundOverviewImage()` abaixo de `.2`), nunca em afrouxar o teste. Registre o tempo medido por quadro no relatório.

- [ ] **Step 5: Atualizar o manual e fazer commit**

Troque no manual (`public/index.html:222`) "a roda aproxima e afasta" por "a roda aproxima e afasta, até enxergar o mapa inteiro".

```bash
git add public/js/render.js public/js/ui.js public/index.html tests/zoom.browser.test.cjs tests/camera-performance.browser.test.cjs
git commit -m "feat: zoom out até enquadrar o mapa inteiro"
```

### Task 9: Suíte completa e documentação das fichas

**Files:**
- Modify: `unidades.md` (valores por time), `public/js/ui.js` (manual: números citados que mudaram, como "Caminhão: 4 tropas", alcance do lançador e cargas do Trophy), testes existentes que ainda fixem valores antigos

- [ ] **Step 1: Rodar a suíte inteira.** Run: `npm test`. Expected: tudo passa. Cada falha que só fixa um valor antigo das tabelas recebe o valor novo. Falha de comportamento é bug da task correspondente e se corrige lá.
- [ ] **Step 2: Rodar os testes de navegador ligados a combate.** Run: `node tests/missiles.browser.test.cjs && node tests/franca.test.cjs && node tests/unit-balance.browser.test.cjs && node tests/zoom.browser.test.cjs`. Expected: PASS ou, em `unit-balance`, metas de equilíbrio que mudaram com a planilha. Nesse caso, não altere a planilha: relate quais metas mudaram para o usuário decidir.
- [ ] **Step 3: Atualizar `unidades.md` e o manual** com os números das tabelas A–D, por time.
- [ ] **Step 4: Commit** (`docs: fichas por time e testes atualizados`).
