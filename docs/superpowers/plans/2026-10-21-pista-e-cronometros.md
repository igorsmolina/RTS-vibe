# Decolagem/pouso mais suaves e cronômetros na tela — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar a decolagem e o pouso dos aviões contínuos (sem trancos de velocidade nem giros instantâneos, com fumaça no toque da roda) e mostrar barra + cronômetro para todo processo com duração: captura de posto, construção, reparo, desminagem, manutenção de unidades, manutenção de aviões, treinamento e obra de aeroporto.

**Architecture:** O motor (`public/js/engine.js`) continua dono do tempo: as fases da pista guardam velocidade inicial/final e a posição segue uma curva de Hermite com as **mesmas durações** de hoje; o giro passa a ter taxa máxima. Para os cronômetros, o motor ganha `timerFor(u)` → `{label,progress,left}|null` e `serviceEta(u)`; o renderizador só desenha o que essas funções devolvem.

**Tech Stack:** JavaScript puro no navegador; testes Node `.cjs` (motor via `new Function`, como `tests/team-sheet.test.cjs`); testes de navegador com Playwright (neste ambiente: `NODE_PATH=/opt/node-tools/node_modules node -r <scratchpad>/pw-preload.cjs tests/<nome>.browser.test.cjs`).

**Spec:** pedido do usuário nesta sessão: "melhora na animação da decolagem e pouso" e "uma barra, ou cronômetro para o tempo, como o tempo de dominação dos postos avançados, manutenção das unidades, e etc".

## Global Constraints

- Durações das fases da pista **não mudam** (taxiOut 1,2 s; takeoffRoll 1,8 s; climb 1 s; landing 1,5 s; landingRoll 2 s; taxiIn 1,5 s; ×`SHORT_RUNWAY` para pista curta). Ponto final de cada fase também não muda. Só a curva de posição, o giro e efeitos visuais mudam.
- Durações de jogo não mudam: captura 2 s, construção 3 s, reparo/desminagem 1 s, manutenção +1 item a cada 3 s (antiaéreo: +1 fumaça a cada 10 s), cura 24 HP/s no solo e 8 HP/s no helicóptero, manutenção de avião 10 s (concreto) / 20 s (terra), treino `train×10` s.
- Cronômetro só no modo RTS e só para unidades e estruturas do jogador local (`owner===localPlayerSide()`); no modo por turnos as barras existentes ficam como estão.
- Formato do texto: `<Rótulo> <s,d> s` com uma casa decimal e vírgula (ex.: `Capturando 1,4 s`), fonte `bold 10px Segoe UI`, sobre fundo `#0b2028cc`.
- Rótulos: `Capturando`, `Construindo`, `Reparando`, `Desminando`, `Manutenção`, `Treinando`, `Obra`.
- Cores das barras: trabalho `#efd094`, manutenção `#a4e7bb`, treino `#edd098` (existentes).
- `prefers-reduced-motion`/`reducedMotion`: sem fumaça de pneu nem poeira extra.
- Sem dependências novas; nenhum teste existente apagado ou pulado.

## Review Focus

1. **Multiplayer:** unidades inimigas chegam ao cliente só com campos visuais (`multiplayer-core.js` ~:31), sem `job`, `work`, `serviceProgress`. `timerFor` e o desenho não podem lançar exceção com esses campos ausentes (foi exatamente o bug do contador de mísseis). Teste na Task 3.
2. **Manutenção sem crédito do helicóptero:** a cura do helicóptero para quando acaba o crédito; `serviceEta` não pode prometer um tempo que nunca termina — com crédito 0 ele ignora o HP (conta só munição/flares) e o texto não fica preso. Teste na Task 3.
3. **Fase interrompida:** pouso redirecionado (aeroporto destruído/capturado durante `landing`) ou pausa tática no meio da decolagem: a curva nova não pode deixar o avião parado no ar nem pular de posição. Teste na Task 1.
4. **Pista curta (A400M, `shortRunway`):** durações ×0,7 — as velocidades de entrada/saída têm de ser recalculadas com a duração efetiva, senão o avião passa do ponto final. Teste na Task 1.
5. **Zoom mínimo (~0,13):** barras e textos ficam ilegíveis e poluem a visão do mapa inteiro; abaixo de `cam.zoom<.3` desenhe só a barra (sem texto). Coberto na Task 4.

---

### Task 1: Pista com velocidade contínua e giro suave

**Files:**
- Modify: `public/js/engine.js:471-488` (`runwayPoints`, `runwayPhase`, avanço das fases), `:479` (fim do `approach`: hoje força `u.facing=Math.PI/2`)
- Create: `tests/runway-motion.test.cjs` (e incluir no script `test` do `package.json`, depois de `tests/airport-runway.test.cjs`)

**Interfaces:**
- Produces:
  - `runwayPhase(u,phase,goal,duration,level,v0=0,v1=0)` — guarda `r.v0`, `r.v1` (casas/s) além do que já guarda.
  - Avanço: com `T=r.duration`, `D=distância(from,goal)`, `p=elapsed/T`, a posição ao longo do segmento é Hermite cúbica `s(p)=h00·0 + h10·(v0·T) + h01·D + h11·(v1·T)` (h = bases de Hermite), limitada a `[0,D]`.
  - Velocidades por fase (`vRot = 2·comprimento da corrida / duração efetiva da corrida`, igual à velocidade final de hoje): taxiOut 0→0; takeoffRoll 0→vRot; climb vRot→`UT(u).speed`; landing `UT(u).speed`→vTouch (`vTouch = 0,6·UT(u).speed`); landingRoll vTouch→0; taxiIn 0→0.
  - `turnToward(u,heading,dt,rate=3)` (método de `Game`): gira `u.facing` no máximo `rate·dt` rad por chamada, pelo menor ângulo. Usado em todas as fases da pista no lugar da atribuição direta, e no fim do `approach` no lugar de `u.facing=Math.PI/2`.
  - No `landing`→`landingRoll` (toque da roda): `this.event('touchdown',u)`.

- [ ] **Step 1: Escrever os testes que falham** em `tests/runway-motion.test.cjs` (esqueleto de `tests/airport-runway.test.cjs`: `field()`, `g.add('blue','airportAsphalt',20,20)`, avião `fighterBlue` com `order(...,'takeoff')`/`'land'`, avanço com `g.update(1/30)`):
  - `decolagem sem tranco`: amostra a velocidade (distância/dt) a cada quadro de `taxiOut` até o fim do `climb`; nenhuma variação entre quadros consecutivos maior que `0,6` casa/s (hoje o salto roll→climb passa disso).
  - `pouso sem tranco`: idem de `landing` até o fim de `taxiIn`.
  - `giro com taxa máxima`: em todas as fases da pista, `|Δfacing| ≤ 3·dt + 1e-6` por quadro (menor ângulo).
  - `durações preservadas`: tempo de `waitRunway`→`approach` = 4,0 s ± 1 quadro; `landing`→fim do `taxiIn` (estado `service` ou `grounded`) = 5,0 s ± 1 quadro; com `transportPlane` França (`shortRunway`) os mesmos totais ×0,7 e o avião termina exatamente nos pontos de `runwayPoints` (± 1e-6).
  - `toque da roda`: um pouso completo gera exatamente 1 evento `touchdown`.
  - `pouso interrompido`: destrua o aeroporto durante `landing`; em até 2 s o avião volta a `approach`/voo sem ficar com a mesma posição por 30 quadros seguidos.
- [ ] **Step 2: Rodar e ver falhar.** `node tests/runway-motion.test.cjs` → FAIL em `decolagem sem tranco`.
- [ ] **Step 3: Implementar** conforme Interfaces. Os chamadores atuais de `runwayPhase` passam `v0/v1` da tabela; `level` continua com a curva suave atual.
- [ ] **Step 4: Rodar.** `node tests/runway-motion.test.cjs && node tests/airport-runway.test.cjs && node tests/aviation.test.cjs && node tests/franca.test.cjs && node tests/air-movement.test.cjs`. Expected: os novos passam; os demais com o mesmo resultado de antes (`aviation` e `airport-runway` já falham no commit base — compare a assinatura da falha com um worktree do commit base).
- [ ] **Step 5: Commit** `feat: decolagem e pouso com velocidade contínua e giro suave`.

### Task 2: Fumaça no toque da roda

**Files:**
- Modify: `public/js/render.js:428-437` (tratamento de eventos: novo `e.kind==='touchdown'`), `:485` (poeira hoje só no aeroporto de terra)
- Test: `tests/visual-v2.browser.test.cjs` ou `tests/airport-runway.browser.test.cjs` (o que já percorre as fases da pista)

**Interfaces:**
- Consumes: evento `touchdown` (Task 1).
- Produces: no `touchdown`, 6 partículas cinza-claras (`#d9dcd6`) nas duas rodas (±10 px perpendicular ao rumo), vida 0,9 s, como as partículas de fumaça existentes; em aeroporto de terra a poeira atual continua no `takeoffRoll`/`landingRoll`; em concreto, só a fumaça do toque. Nada com `reducedMotion`.

- [ ] **Step 1: Teste que falha:** no teste de navegador que já pousa um avião, conte `renderer.particles` criadas no quadro do evento `touchdown`: `>=6`; com `reducedMotion=true`: `0`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** no tratador de eventos.
- [ ] **Step 4: Rodar** o teste e `tests/battlefield-fx.test.cjs`; capturar uma tela do pouso para o relatório.
- [ ] **Step 5: Commit** `feat: fumaça de pneu no pouso`.

### Task 3: `timerFor` e `serviceEta` no motor

**Files:**
- Modify: `public/js/engine.js` (métodos novos perto de `missileLoad`; o ponto onde o trabalho RTS de `service` começa grava `job.serviceTotal`)
- Create: `tests/timers.test.cjs` (incluir no script `test`)

**Interfaces:**
- Produces:
  - `serviceEta(u)` → segundos restantes da manutenção RTS em base: o maior entre (a) HP: solo `(maxHp-hp)/24`; helicóptero `ceil((maxHp-hp)/HELI_REPAIR)-healClock`, ignorado se `credits[owner]<HELI_REPAIR_COST`; (b) itens de 3 s: `3·maxFaltando - serviceClock`, onde `maxFaltando` é o maior entre mísseis antitanque (`atMax`), Trophy (`trophyMax`), flares (até 3), salvas (`HELI_SALVOS`) e mísseis (`UT(u).missiles`) que faltam; (c) antiaéreo: `10·(2-smokeCharges) - serviceClock`. Nunca negativo.
  - `timerFor(u)` → `{label,progress,left}` ou `null`; `null` fora do RTS, sem `job`/campos (multiplayer) e quando nada corre. Casos, nesta ordem:
    - trabalho (`u.job` em `capture|build|repair|demine` e `u.work>0`): duração 2/3/1/1 s; `progress=work/duração`, `left=duração-work`; rótulos `Capturando/Construindo/Reparando/Desminando`.
    - manutenção de unidade (`u.job?.type==='service'` no local): `left=serviceEta(u)`, `progress=1-left/max(job.serviceTotal,left)`; rótulo `Manutenção`.
    - manutenção de avião (`flightState==='service'`): duração 10 s (concreto) / 20 s (terra), `progress=serviceProgress/duração`; rótulo `Manutenção`.
    - estrutura com fila (`u.queue?.length`): `Treinando`, `left=trainDuration-progress` do primeiro da fila.
    - canteiro de aeroporto: `Obra`, `left=airportDuration-work`.

- [ ] **Step 1: Testes que falham** em `tests/timers.test.cjs`:
  - `captura mostra 2 s`: infantaria capturando posto, após 0,5 s → `{label:'Capturando',progress:.25,left:1.5}` (±1e-6).
  - `manutenção do antitanque`: antitanque com 1/4 mísseis e HP cheio em serviço no QG → `left` = 9 s no início e cai 1 s por segundo simulado; termina (job encerra) quando `left` chega a 0 (±1 quadro).
  - `helicóptero sem crédito`: `credits.blue=0`, HP baixo, munição cheia → `serviceEta` = 0 (não fica preso).
  - `antiaéreo`: 0 cargas de fumaça → `left`=20.
  - `avião em manutenção`: concreto → `left` 10 no início; terra → 20.
  - `treino e obra`: fila com `tank` (30 s) → `Treinando`; canteiro → `Obra`.
  - `campos ausentes`: unidade com só `{id,type,owner,x,y,hp,maxHp}` (sem `job`, `work`, `queue`) → `null` sem exceção; modo por turnos → `null`.
- [ ] **Step 2: Rodar e ver falhar.** `node tests/timers.test.cjs` → `g.timerFor is not a function`.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** `node tests/timers.test.cjs && node tests/team-sheet.test.cjs && node tests/airport-runway.test.cjs`.
- [ ] **Step 5: Commit** `feat: cronômetro de captura, manutenção, treino e obra no motor`.

### Task 4: Barra e cronômetro na tela

**Files:**
- Modify: `public/js/render.js:439` (novo `timerBadge`, perto de `bar`/`ammoBadge`), `:473-475` (estruturas: fila e obra passam a usar `timerFor`), `:498-500` (unidades)
- Test: `tests/timers.browser.test.cjs` (novo; incluir em `test:browser` do `package.json`)

**Interfaces:**
- Consumes: `game.timerFor(u)` (Task 3).
- Produces: `timerBadge(x,y,u)` no renderizador: se `u.owner!==localPlayerSide()` sai antes de qualquer outra leitura; senão desenha a barra (cor por rótulo, Global Constraints) e, com `cam.zoom>=.3`, o texto `<Rótulo> <s,d> s` acima dela. Nas unidades fica acima da unidade (y−34, sem colidir com o `ALTA`/estrelas: se houver `ALTA`, sobe 14 px); nas estruturas substitui as barras atuais de fila e obra, no mesmo lugar.

- [ ] **Step 1: Teste que falha** (navegador): partida RTS, infantaria capturando posto; após 0,5 s de jogo, `renderer.draw(0)` e leia o texto desenhado (intercepte `ctx.fillText`): contém `Capturando 1,5 s`. Unidade inimiga capturando: nenhum texto. Unidade sem `job` (simule campos de cliente): `draw` sem exceção. Com `cam.zoom=.2`: nenhum texto de cronômetro.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** o teste novo, `tests/zoom.browser.test.cjs`, `tests/heli-service.browser.test.cjs` e uma captura de tela com captura de posto + antitanque em manutenção + avião em manutenção para o relatório.
- [ ] **Step 5: Atualizar o manual** (`public/index.html`, tópico de controles/RTS): uma frase dizendo que processos com tempo mostram barra e cronômetro acima da unidade. Commit `feat: barra e cronômetro na tela para captura, manutenção, treino e obra`.
