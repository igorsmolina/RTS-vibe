# Multiplayer com 4 jogadores, sem travamentos: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O multiplayer passa de 2–3 para 2–4 jogadores, todos contra todos, sem travar quando a rede ou um navegador ficam lentos.

**Architecture:**
- **Quarto lado.** Entra o lado `'gold'` (Amarelo). O motor e o mapa procedural já usam a simetria central, então a 4ª base fica no canto superior esquerdo, espelhando a base verde. O núcleo do multiplayer passa a aceitar 4 lados.
- **Travamento.** A causa mais provável é a fila sem limite de estados no caminho anfitrião → convidado. Cada estado é completo (snapshot), então só o mais recente importa. Na saída, um estado ainda não enviado é substituído pelo seguinte quando o canal está cheio. Na chegada, só o último estado de uma rajada é aplicado. Mensagens que não são estado nunca são descartadas e mantêm a ordem.

**Tech Stack:** JavaScript puro. Testes Node com `assert` (`tests/*.test.cjs`) e Playwright com o Chrome do sistema (`tests/*.browser.integration.cjs`).

**Spec:** pedido do usuário: "pode fazer com que o modo multiplayer consiga ser jogado com 4 jogadores ao mesmo tempo, e que não cause um travamentos".

## Medição de partida (24/10/2026, `createCore` em Node, combate RTS, 50 unidades por jogador)

| Jogadores | Tick p50 | Tick p95 | Tick máx. | Estado por jogador | Banda por jogador |
|---|---:|---:|---:|---:|---:|
| 2 | 1,0 ms | 1,9 ms | 6,2 ms | ~34 KB | 337 KB/s (10 estados/s, sem compressão) |
| 3 | 2,0 ms | 3,3 ms | 7,7 ms | 33,6 KB (unidades 24 KB, máscaras de visão 8 KB) | 336 KB/s |

A CPU do anfitrião sobra. O risco está na fila de envio: o anfitrião no navegador (`public/js/p2p.js`, `wrap`) encadeia `deflate` + `channel.send` numa promessa por convidado, sem olhar `bufferedAmount`. O convidado encadeia `inflate` + aplicação na mesma fila sem limite. Com 3 convidados, uma rede lenta faz a fila crescer e o jogo mostra estados cada vez mais velhos: é o "travamento".

## Global Constraints

- **Ids e cores do lado novo.** O id é `'gold'`. Nome em português: `Amarelo` no saguão (`SIDE_NAME`), `Amarela` na equipe do motor (`SIDE`), `amarela` em `SIDE_TEAM`. Cor `#f2cf3a` em `TEAM.gold` (`public/js/ui.js:34`) e no cartão do saguão (`.mp-slot[data-side=gold]`).
- **Ordem e facção.** A ordem dos lados é `['blue','red','green','gold']`. A facção padrão do lado amarelo é `'roxo'`: `DEFAULT_FACTION={blue:'blue',red:'red',green:'franca',gold:'roxo'}`.
- **Tamanho da sala.** De 2 a 4 jogadores. O 5º recebe `room_full`. Com 3 ou 4 lados não há aeroportos neutros (regra atual `if(!three)`, que passa a valer para `sides.length>2`).
- **Partidas de 2 ou 3 lados.** Ficam idênticas às de hoje: mesmo terreno, mesmas posições e mesmo resultado para a mesma semente.
- **Mensagens de estado.** O núcleo serializa estados com `JSON.stringify({type:'state',...})`, então todo texto de estado começa com `{"type":"state"`. É por esse prefixo que transporte e cliente reconhecem um estado. Nenhuma mensagem que não é estado (`room`, `ack`, `error`, `result`, `joined`, `authenticated`) pode ser descartada ou reordenada.
- **Limites de envio.** Um canal WebRTC com `bufferedAmount` acima de `256 * 1024` bytes não recebe estado novo até cair abaixo de `64 * 1024` (`bufferedAmountLowThreshold`). No WebSocket do servidor Node, o estado é pulado quando `ws.bufferedAmount > 1024 * 1024`.
- **Desempenho com 4 jogadores × 50 unidades em combate RTS (Node):** tick p95 ≤ 10 ms, tick máximo ≤ 60 ms, estado por jogador ≤ 45 KB, ≤ 450 KB/s por jogador sem compressão.
- **Escopo e testes.**
  - Só desktop.
  - Os ids, `<select>` e testes existentes continuam; contagens de "3 jogadores" são atualizadas para 4.
  - Textos da interface em português.
  - Sem dependências novas.
  - Commit e push só se o usuário pedir (a pasta local não é repositório git; o branch remoto é `claude/sweet-cannon-qugemw`).

## Review Focus

1. **Convidado lento ou rede lenta.** O jogo dele mostra o estado mais recente com atraso limitado, nunca uma fila de estados velhos, e o anfitrião não acumula memória. Teste na Tarefa 4 (`saída mantém no máximo um estado pendente`).
2. **Ordem de mensagens.** Um `ack` ou `room` enviado depois de um estado chega depois dele, mesmo quando estados intermediários são descartados. Teste na Tarefa 4.
3. **Revanche com 4 jogadores.** Os lados giram azul → vermelho → verde → amarelo → azul; com 3 que ficam, giram entre os 3 primeiros lados, como hoje. Teste na Tarefa 2.
4. **Jogador eliminado ou desconectado com 4.** A partida segue com 3, e depois com 2. O último vivo vence. Teste na Tarefa 2.
5. **Mapa de 4 lados em todos os mapas** (`river`, `desert`, `mountain`, `random`, com várias sementes). Cada QG tem caminho por terra até o centro, o exército inicial cabe ao lado do QG e o terreno de 2 e 3 lados não muda. Teste na Tarefa 1.

---

### Tarefa 1: Quarto lado no motor (mapa, QG, exército inicial)

**Files:**
- Modify: `public/js/engine.js:8` (`SIDE.gold='Amarela'`), `:235` (`cleanFactions` aceita `gold`), `:247` (`initialArmies.gold`), `:676-884` (geração: `three` → `sides.length>2`, base, comandante e posições do lado `gold`)
- Create: `tests/multiplayer-four.test.cjs`
- Modify: `package.json` (`"test"`: acrescentar `&& node tests/multiplayer-four.test.cjs`)

**Interfaces:**
- Produces:
  - `new Game(map,diff,seed,mode,options,doctrines,armies,privateRandom,{blue,red,green,gold})` cria 4 lados; `game.sides` é `['blue','red','green','gold']`.
  - `cleanFactions({...,gold:x})` devolve `gold`: `x` se for facção válida, senão `'roxo'`.

- [ ] **Step 1: Escrever os testes (falham).** Arquivo `tests/multiplayer-four.test.cjs`, com o cabeçalho de `tests/factions.test.cjs` e `names` incluindo `Game,ROWS,COLS,TILE,KEY,DIST,STANDARD_FACTIONS`.
  - `quatro lados: QG, comandante e exército em cada canto`. Para cada mapa em `['river','desert','mountain','random']` e sementes `[1,7,123]`, com `{blue:'blue',red:'red',green:'franca',gold:'roxo'}`:
    - `g.sides` é igual a `['blue','red','green','gold']`;
    - cada lado tem exatamente 1 `hq`;
    - o QG `gold` fica em `x<COLS/2` e `y<ROWS/2`;
    - toda unidade inicial de cada lado está a ≤ 12 casas do seu QG (`DIST`);
    - as unidades `gold` têm `faction==='roxo'`.
  - `quatro lados: cada QG chega ao centro por terra`. Busca em largura sobre casas com `Number.isFinite(g.cost({type:'infantry'},x,y))`, saindo de uma casa vizinha livre de cada QG, alcança `{x:COLS/2,y:ROWS/2}` ou alguma casa a ≤ 3 dela, nos mesmos mapas e sementes.
  - `dois e três lados não mudam`. `JSON.stringify(g.terrain)` e as posições dos QGs para `{blue,red}` e `{blue,red,green}`, sementes `[1,7,123]`, iguais ao que o motor produz hoje. Grave a referência uma vez no próprio teste, antes da mudança, com um script ad hoc (hash SHA-256 por caso).
  - `facção inválida no lado amarelo vira roxo`. `cleanFactions({blue:'blue',red:'red',gold:'x'}).gold==='roxo'`.
- [ ] **Step 2: Conferir que falham.**
  ```bash
  node tests/multiplayer-four.test.cjs
  ```
  Esperado: FALHA nos testes de quatro lados. O teste de 2 e 3 lados passa.
- [ ] **Step 3: Implementar.**
  - `three` passa a ser `this.sides.length>2`. O bloco que limpa o canto (`:806`) e o `carve(exit3,center)` já espelham o canto oposto, porque `set` escreve nas duas casas simétricas.
  - Defina `goldHome=mirror(greenHome)` e `exit4=mirror(exit3)`. Com 4 lados, crie `hq` e `commander` do `gold` nesses pontos, como o `green` em `:874`.
  - Na distribuição do exército inicial (`:883`), o lado `gold` usa `{x:p.x,y:ROWS-1-p.y}`.
  - `cleanFactions` cria `sides.gold` quando a chave existe, com padrão `ROXO`.
  - `initialArmies.gold` segue o modelo de `green`.
- [ ] **Step 4: Rodar.**
  ```bash
  node tests/multiplayer-four.test.cjs && node tests/factions.test.cjs && node tests/maps.test.cjs && node tests/multiplayer-core.test.cjs && node tests/engine-scaling.test.cjs
  ```
  Esperado: os novos testes passam; os outros mantêm o resultado da linha de base (`engine-scaling` passava).

### Tarefa 2: Núcleo do multiplayer com 4 jogadores

**Files:**
- Modify: `public/js/multiplayer-core.js:8-9` (`SIDES`, `DEFAULT_FACTION`, comentário "Até quatro jogadores") e a função `broadcast` (estado pulado quando `p.ws.bufferedAmount > 1024 * 1024`)
- Modify: `tests/multiplayer-core.test.cjs` (o teste "a sala comporta três jogadores" passa a 4, e o 5º recebe `room_full`)
- Test: `tests/multiplayer-four.test.cjs`

**Interfaces:**
- Consumes: 4 lados no motor (Tarefa 1).
- Produces:
  - `createCore` aceita 4 jogadores.
  - `joinRoom` dá o lado `gold` ao 4º.
  - `broadcast` respeita `socket.bufferedAmount` quando o socket o expõe.

- [ ] **Step 1: Escrever os testes.** Em `tests/multiplayer-four.test.cjs`, use sockets falsos como em `tests/multiplayer-core.test.cjs` (o socket falso aceita `bufferedAmount`).
  - `sala de quatro`:
    - 4 entram com lados `blue`, `red`, `green`, `gold`;
    - o 5º recebe `error.code==='room_full'` e o socket é fechado;
    - com todos prontos, `start` cria jogo com `factions` `{blue:'blue',red:'red',green:'franca',gold:'roxo'}`;
    - cada jogador recebe um `state` com `playerSide` próprio e sem unidades inimigas fora da visão.
  - `eliminação com quatro`:
    - `surrender` do `gold` → `room.status==='playing'` e `game.out` contém `gold`;
    - depois o `green` → segue `playing`;
    - depois o `red` → `room.result.winner==='blue'`.
  - `revanche gira os quatro lados`. Depois de `finish`, os 4 pedem `rematch` → lados `red`, `green`, `gold`, `blue` (na ordem de quem era `blue`, `red`, `green`, `gold`).
  - `estado pulado com fila cheia`. Com `bufferedAmount` igual a `2 * 1024 * 1024` no socket do `red`, três `core.tick()` com `tickNumber%3===0` não enviam `state` ao `red` e enviam aos outros. Com `bufferedAmount=0`, volta a receber.
  - `desempenho com quatro`. Repita o método da medição de partida (50 unidades por lado em `attackMove` até o centro, 600 ticks):
    - tick p95 ≤ 10 ms e máximo ≤ 60 ms;
    - estado do `blue` ≤ 45 KB;
    - bytes enviados ao `blue` ÷ 20 s ≤ 450 KB/s.
    
    Imprima os números.
- [ ] **Step 2: Conferir que falham.**
  ```bash
  node tests/multiplayer-four.test.cjs
  ```
- [ ] **Step 3: Implementar** os valores das Global Constraints. O limite de banda vai como constante `STATE_BACKLOG=1024*1024` no topo de `createCore`.
- [ ] **Step 4: Rodar.**
  ```bash
  node tests/multiplayer-four.test.cjs && node tests/multiplayer-core.test.cjs && node tests/multiplayer-limits.test.cjs
  ```
  ```bash
  node tests/multiplayer-server.integration.cjs
  ```
  ```bash
  node tests/multiplayer-rate.integration.cjs
  ```
  Esperado: tudo OK.

### Tarefa 3: Saguão, nomes e cores do 4º jogador

**Files:**
- Modify: `public/js/ui.js:34` (`TEAM.gold='#f2cf3a'`)
- Modify: `public/js/multiplayer.js:5-6` (comentário; `SIDE_NAME.gold='Amarelo'`, `SIDE_TEAM.gold='amarela'`, `SIDE_FACTION.gold=ROXO`), `:88` (`settings.army==='enemy'` para `gold` → `'red'`), `:137` (`gridColumn` com a ordem dos 4 lados)
- Modify: `public/css/menus-campaign.css:129,132` (`repeat(4,…)`, `.mp-slot[data-side=gold]{--slot:#f2cf3a}`)
- Modify: `public/index.html:422` ("Partida privada · 2 a 4 jogadores" e o texto da dica), `README.md` (multiplayer: 2 a 4 jogadores; com 4, as bases ficam nos quatro cantos)
- Rename: `tests/multiplayer-three.browser.integration.cjs` → `tests/multiplayer-four.browser.integration.cjs`, com 4 clientes que entram e um 5º recusado (`package.json`, script `test:multiplayer:integration`)

**Interfaces:**
- Consumes: lado `gold` (Tarefas 1 e 2).

- [ ] **Step 1: Atualizar o teste de navegador (falha).** Partindo do arquivo de 3 jogadores:
  - 4 páginas entram (`Anfitrião`, `Segundo`, `Terceiro`, `Quarto`) e uma 5ª recebe a mensagem de sala cheia;
  - os 4 ficam prontos e o anfitrião inicia;
  - cada página vê `Multiplayer.session.side` igual a `blue`, `red`, `green` e `gold`, e `game.sides.length===4`;
  - o saguão mostra 4 `.mp-slot` numa linha, com o 4º `data-side="gold"`;
  - desistências seguem até o último vivo, como no teste atual.

  Salve as capturas em `test-output/multiplayer/` como hoje.
- [ ] **Step 2: Conferir que falha.**
  ```bash
  node tests/multiplayer-four.browser.integration.cjs
  ```
- [ ] **Step 3: Implementar** os Files acima.
- [ ] **Step 4: Rodar.**
  ```bash
  node tests/multiplayer-four.browser.integration.cjs && node tests/menus-social.browser.test.cjs && node tests/p2p.browser.test.cjs
  ```
  Esperado: OK. Abra a captura do saguão e de uma partida de 4. O amarelo tem de se distinguir dos postos neutros (`#e0c992`) no mapa e no minimapa; se não se distinguir, escureça o amarelo e registre a cor final.

### Tarefa 4: Transporte sem fila: só o estado mais recente

**Files:**
- Modify: `public/js/p2p.js` (`wrap`: saída com estado único pendente e espera por `bufferedamountlow`; entrada e soquete local do anfitrião com `coalesce`; expor `P2P.wrap` e `P2P.coalesce` para teste)
- Create: `tests/p2p-backpressure.test.cjs`
- Modify: `package.json` (`"test"`: acrescentar `&& node tests/p2p-backpressure.test.cjs`)

**Interfaces:**
- Produces:
  - `P2P.coalesce(deliver: (text:string)=>void) -> (text:string)=>void`.
    - Estado (texto que começa com `{"type":"state"`): fica guardado e é entregue por `setTimeout(…,0)`; se outro estado chega antes, o anterior é descartado.
    - Qualquer outra mensagem: entrega primeiro o estado guardado, se houver, e depois a mensagem, na hora.
  - `P2P.wrap(channel)`: a interface atual (`channel`, `onText`, `open`, `send`). Muda só o comportamento de `send`:
    - mensagens são enviadas em ordem;
    - um estado ainda não enviado é substituído pelo estado novo quando é o último da fila;
    - antes de enviar um estado com `channel.bufferedAmount > 256*1024`, espera o evento `bufferedamountlow` (com `channel.bufferedAmountLowThreshold = 64*1024`).
    
    A entrada (`onText`) passa por `coalesce`. O soquete local do anfitrião (`sinks.get('local').text`) também passa por `coalesce`.

- [ ] **Step 1: Escrever os testes (falham).** O arquivo carrega `public/js/p2p.js` num `vm` com `window={}`, `location={protocol:'http:'}` e os globais do Node (`Blob`, `Response`, `CompressionStream`, `DecompressionStream`, `MessageEvent`, `EventTarget`, `setTimeout`, `btoa`, `atob`). Canal falso: `readyState:'open'`, `bufferedAmount` controlável, `sent:[]`, `addEventListener` e `dispatch(type)`.
  - `saída mantém no máximo um estado pendente`. Com `bufferedAmount=300*1024`, envia `state#1..state#50` e depois `{"type":"ack","seq":1}`. Nada sai. Com `bufferedAmount=0` e `dispatch('bufferedamountlow')`, saem exatamente 2 mensagens (depois de `inflate` quando binárias): `state#50` e o `ack`, nessa ordem.
  - `saída não descarta mensagens que não são estado`. 20 `ack` intercalados com 20 estados, com o canal livre: os 20 `ack` saem em ordem, e cada `ack` sai depois do estado que o antecedia.
  - `entrada aplica só o último estado de uma rajada`. `coalesce(deliver)` recebe 30 estados no mesmo tique e depois um `room`. `deliver` é chamado com o 30º estado e depois com o `room`, só 2 chamadas.
  - `entrada entrega mensagem isolada na hora`. Um `error` sozinho chama `deliver` de forma síncrona.
- [ ] **Step 2: Conferir que falham.**
  ```bash
  node tests/p2p-backpressure.test.cjs
  ```
- [ ] **Step 3: Implementar.** A fila de saída de `wrap` vira um array de textos mais uma flag "enviando". `send` empurra o texto, ou substitui o último item quando os dois são estados e o último ainda não começou a ser comprimido. Um laço `async` drena a fila. A compressão continua como hoje (textos > 1024 caracteres vão com `deflate`).
- [ ] **Step 4: Rodar.**
  ```bash
  node tests/p2p-backpressure.test.cjs && node tests/p2p.browser.test.cjs && node tests/multiplayer.browser.integration.cjs
  ```
  Esperado: OK.

### Tarefa 5: Carga com 4 jogadores no navegador e documentação

**Files:**
- Modify: `tests/multiplayer-load.browser.integration.cjs`. Passa a 4 clientes WebSocket com 50 unidades por lado (respeitando `UNIT_CAP`). Mede tick do servidor, tamanho dos estados e quadros do cliente com `Multiplayer.applyState`, nas mesmas condições de hoje (atraso de 150 ms e 5% dos estados descartados). Acrescenta uma rajada de 30 estados atrasados entregues de uma vez, que o cliente tem de absorver sem quadro acima de 100 ms (`longTaskMax`).
- Modify: `README.md` e o manual (`public/index.html`, seção multiplayer), com 2 a 4 jogadores, a cor amarela e "quem tem conexão lenta vê o estado mais recente, sem fila"
- Create: `reports/multiplayer-4-2026-10-24/relatorio.md` (antes e depois: tick, KB por estado, KB/s por jogador, quadro do cliente p95/máx., com 2, 3 e 4 jogadores; limites da medição)

- [ ] **Step 1: Medir antes.** Rode a medição com a linha de base do teste de carga (2 clientes) e com 3 jogadores (script da medição de partida). Guarde os números no relatório.
- [ ] **Step 2: Medir depois.**
  ```bash
  node tests/multiplayer-load.browser.integration.cjs
  ```
  Esperado: dentro do `perf-budget.json` (p95 de quadro ≤ 50 ms, longTask ≤ 100 ms, tick ≤ 50 ms) e das metas de 4 jogadores das Global Constraints.
- [ ] **Step 3: Suíte completa e partida real.**
  - Rode a suíte Node (laço por arquivo, comparando com a linha de base, como no plano do Roxo) e os testes de multiplayer de navegador.
  - Abra 4 abas com o servidor local (`npm run start:multiplayer`), jogue 2 minutos com 4 jogadores e registre no relatório o tick do `/health` (`load.tickRate` perto de 30 e `load.cpu`).
- [ ] **Step 4: Escrever o relatório e atualizar a documentação.** O relatório separa medido de suposto. A WebRTC real entre máquinas diferentes não é testada aqui: o teste usa servidor local e o caminho P2P é exercitado pelo teste de unidade e pelo `p2p.browser.test.cjs` na mesma máquina.
