# Mapas procedurais mais variados (lagos, ilhas, serras) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O mapa "Fronteira procedural" passa a sortear (ou deixar escolher) uma entre quatro paisagens bem diferentes — **Continente** (a atual), **Lagos**, **Ilhas** e **Serras** — sempre simétricas, jogáveis e com as bases ligadas por terra.

**Objetivo verificável (para usar com `/goal`):**
> `node tests/landscapes.test.cjs` passa, `node tests/engine.test.cjs` mantém o mesmo resultado do commit base, e o menu de partida e o de multiplayer têm o seletor "Paisagem" com as opções Aleatória, Continente, Lagos, Ilhas e Serras.

**Architecture:** Tudo continua em `Game.generate()` (`public/js/engine.js:642`), que já faz o mapa simétrico por ponto com `set()`, garante estradas com `carve()` (rio vira ponte, serra vira passagem) e posiciona postos. Uma nova opção `landscape` escolhe qual etapa de **relevo e água** roda; as etapas seguintes (floresta, campos, base limpa, postos, estradas, aeroportos, minas) continuam as mesmas para todas as paisagens. "Continente" executa exatamente o código de hoje.

**Tech Stack:** JavaScript puro; testes Node `.cjs` (motor via `new Function`, como `tests/engine.test.cjs`); testes de navegador com Playwright (neste ambiente: `NODE_PATH=/opt/node-tools/node_modules node -r <scratchpad>/pw-preload.cjs tests/<nome>.browser.test.cjs`).

**Spec:** pedido do usuário nesta sessão: "melhora na geração dos mapas gerados proceduralmente, fazendo que tenha uma diversidade maior de mapas, com lagos, ilhas, terrenos muito elevados, e etc".

## Global Constraints

- Tipos de terreno não mudam (`TERRAIN` em `engine.js:25`). Água = `river`; ilha = terra cercada de `river`; terreno muito elevado = `mountain` (bloqueia veículos, só infantaria atravessa) cercado de `hill`.
- Todo mapa continua simétrico por ponto (usar sempre `set()`), com a área da base limpa e o QG de cada lado alcançável por tanque a partir do outro (`g.findPath`), e todo posto alcançável por tanque em ao menos uma casa vizinha. São as mesmas garantias de `tests/engine.test.cjs:38`.
- Valores de `landscape`: `'auto'` (Aleatória), `'continent'` (Continente), `'lakes'` (Lagos), `'islands'` (Ilhas), `'highlands'` (Serras). Sem a opção (`undefined`) vale `'continent'`. Isso mantém todo mapa e teste antigo idêntico.
- `'auto'` escolhe a paisagem pela semente, de forma determinística: `LANDSCAPE_LIST[seeded(seed^0x2f6b1d37)()*4|0]`, sem consumir `this.rng`.
- Faixas por paisagem, medidas no mapa inteiro. Elas são os critérios dos testes:

| Paisagem | Água (`river`) | Montanha | Colina | Outro |
|---|---|---|---|---|
| Continente | igual ao gerador atual | igual | igual | terreno idêntico ao de hoje para as mesmas semente e opções |
| Lagos | 12%–28% | ≤ 4% | — | ≥ 4 corpos d'água com ≥ 40 casas cada; ilha (terra cercada de água, ≥ 4 casas) em ≥ 50% das sementes |
| Ilhas | 30%–50% | ≤ 4% | — | ≥ 3 massas de terra (sem contar `bridge`) com ≥ 150 casas cada; QGs ligados por ponte |
| Serras | ≤ 8% | 12%–24% | ≥ 18% | ≥ 2 passagens (estradas atravessando a serra central) |

- Os controles "Floresta", "Campos e sebes" e "Postos" continuam valendo em todas as paisagens. "Água" e "Relevo" só valem em Continente; nas outras, a paisagem manda (o `title` dos dois controles avisa isso).
- Tempo de geração: média ≤ 150 ms por mapa em Node (hoje ≈ 75 ms).
- Multiplayer: `landscape` viaja em `config.options` e é validado contra a lista (string), sem quebrar a validação numérica das outras opções.
- Sem dependências novas; nenhum teste existente apagado ou pulado.

## Review Focus

1. **Base cercada de água ou serra:** a área da base é limpa depois do relevo (etapa 5 atual), mas o caminho de saída pode cair numa ilha isolada. O `carve()` só cria ponte onde passa estrada; o teste de conectividade por tanque com 30 sementes por paisagem pega isso (Tasks 2–4).
2. **Postos em ilhas sem ponte:** os candidatos a posto exigem `reach` (alcance a partir da saída, sem serra) e não excluem água como passagem. Em Ilhas, um posto pode ficar numa ilha que só se alcança atravessando rio. O teste "todo posto alcançável por tanque" em cada paisagem cobre isso (Task 3).
3. **Aeroportos neutros** (`generateAirports`, 50% das sementes) nos cantos `(4,4)/(4,8)/(8,4)`: em Ilhas ou Lagos podem cair sobre água. É preciso garantir a pista sobre terra (a função já recusa áreas inválidas) e que o aeroporto, se criado, seja alcançável. Teste na Task 3.
4. **Multiplayer e saves antigos:** sala criada sem `landscape` e save antigo devem gerar o mesmo mapa de antes (Continente); um valor desconhecido vindo de cliente é recusado com "Opção de terreno inválida." Teste na Task 5.
5. **Minas** (etapa 9) sorteadas no centro: em Lagos/Ilhas o centro pode ser quase todo água. Precisam continuar 4 pares fora da água, ou o mapa tem menos minas. O teste exige `g.mines.length===8` em todas as paisagens (Task 2).

---

### Task 1: Opção `landscape`, sorteio e Continente idêntico

**Files:**
- Modify: `public/js/engine.js:26` (`PROCEDURAL` ganha `landscape:'continent'`), `:226` (sanear `options.landscape`), `:642-663` (despachar o passo de relevo e água)
- Create: `tests/landscapes.test.cjs` (incluir no script `test` do `package.json`, depois de `tests/engine.test.cjs`)
- Create: `tests/fixtures/continent-terrain.json` (gerado **antes** de mexer no gerador)

**Interfaces:**
- Produces:
  - `const LANDSCAPE_LIST=['continent','lakes','islands','highlands']` e `const LANDSCAPE_NAMES={auto:'Aleatória',continent:'Continente',lakes:'Lagos',islands:'Ilhas',highlands:'Serras'}` (top-level, junto de `MAPS`).
  - `landscapeOf(seed,options)` → uma das 4 da lista (resolve `'auto'` como em Global Constraints; `undefined`/inválido → `'continent'`).
  - `this.landscape` no `Game` (o valor resolvido), disponível depois de `generate()`.
  - Dentro de `generate()`, o relevo e a água atuais (comentários "1. Relevo" e "2. Água") viram o caso `continent` de um despacho: `({continent,lakes,islands,highlands})[this.landscape]()`. Os outros três chamam por enquanto o mesmo código de `continent` (implementados nas Tasks 2–4).
- Ferramentas de teste em `tests/landscapes.test.cjs`, usadas por todas as tasks seguintes:
  - `share(g,t)`: fração do mapa com o terreno `t`.
  - `components(g,pred)`: lista de tamanhos dos componentes 4-conectados das casas com `pred(terreno)`.
  - `connected(g)`: QG azul e vermelho ligados por tanque e todo posto alcançável (mesma lógica de `engine.test.cjs:38`).

- [ ] **Step 1: Gerar a referência do Continente com o código atual.** Script de uso único: para `seed` 1..20 e as opções `{}`, `{water:1,forest:1,mountain:1,posts:12}` e `{water:0,forest:0,mountain:0,posts:4}`, salve `{seed,options,hash}` em `tests/fixtures/continent-terrain.json`, sendo `hash` o FNV-1a de `g.terrain.join(',')`. Commit da referência junto com o teste.
- [ ] **Step 2: Testes que falham**
  - `continente idêntico ao gerador anterior`: cada entrada da referência gera o mesmo `hash`, com `options` sem `landscape` e com `landscape:'continent'`.
  - `auto sorteia as quatro`: para `seed` 1..60, `landscapeOf(seed,{landscape:'auto'})` cobre as 4 paisagens com ≥ 8 cada, e é determinístico (duas chamadas iguais).
  - `opção inválida vira continente`: `new Game('random','normal',5,'rts',{landscape:'vulcão'}).landscape==='continent'`.
- [ ] **Step 3: Rodar e ver falhar.** `node tests/landscapes.test.cjs` → `landscapeOf is not defined`.
- [ ] **Step 4: Implementar** conforme Interfaces. O sorteio usa `seeded`, que já existe no motor.
- [ ] **Step 5: Rodar** `node tests/landscapes.test.cjs && node tests/engine.test.cjs` (`engine.test` já falha no commit base: compare a assinatura da falha com um worktree do base).
- [ ] **Step 6: Commit** `feat: opção de paisagem nos mapas procedurais (continente idêntico)`.

### Task 2: Lagos

**Files:**
- Modify: `public/js/engine.js` (caso `lakes` do despacho)
- Test: `tests/landscapes.test.cjs`

**Interfaces:**
- Consumes: despacho e ferramentas de teste (Task 1).
- Produces: caso `lakes`. Relevo de colinas suave, com `relief` fixo em `.25` e sem serra. Lagos são manchas arredondadas e irregulares: de 3 a 5 centros por meia malha, sorteados com `rng`, com raio de 4 a 9 casas, formato deformado por `wobble`. Um lago grande (raio ≥ 7) tem 50% de chance de ganhar uma ilha central (raio 1 a 3) de `plain`/`forest`. Há um riacho estreito ligando dois lagos, como os rios de hoje. A água nunca entra na área da base (as 6×5 casas da base mais 2 casas de folga).

- [ ] **Step 1: Testes que falham** (`landscape:'lakes'`, `seed` 1..30, com opções padrão e com `{forest:1,farmland:1,posts:12}`):
  - `share(g,'river')` entre `.12` e `.28`; `share(g,'mountain')<=.04`.
  - `components(g,t=>t==='river').filter(n=>n>=40).length>=4`.
  - Ilha em ≥ 50% das sementes: componente de terra (não `river`) com 4 a 150 casas que não toca a borda do mapa.
  - `connected(g)`; simetria por ponto; `g.mines.length===8`; `g.structures` com o número de postos pedido.
- [ ] **Step 2: Rodar e ver falhar** (o caso ainda chama Continente: água abaixo de 12%).
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** `node tests/landscapes.test.cjs`; medir o tempo médio de geração (≤ 150 ms).
- [ ] **Step 5: Commit** `feat: paisagem Lagos com ilhas nos lagos grandes`.

### Task 3: Ilhas (arquipélago)

**Files:**
- Modify: `public/js/engine.js` (caso `islands`; nos candidatos a posto, a etapa 6 passa a exigir terra alcançável **por terra ou ponte planejada**, conforme abaixo; `generateAirports` só aceita área sem `river`)
- Test: `tests/landscapes.test.cjs`

**Interfaces:**
- Consumes: Task 1.
- Produces: caso `islands`. O mar é a parte baixa de um ruído de escala grande (`noise(16)`), com o limiar escolhido por quantil (`cut`) para dar 38% de água na meia malha. Depois, as massas de terra com menos de 150 casas viram água, e a área da base e um raio de 6 casas em volta dela são forçados a terra. Ilhas são ligadas por `carve()`: as estradas atuais já transformam `river` em `bridge`. Também é feita uma ligação extra de cada massa de terra grande à massa mais próxima que tem estrada, com `carve` entre os centros das duas massas. Os postos ficam só em massas de terra que tenham estrada.

- [ ] **Step 1: Testes que falham** (`landscape:'islands'`, `seed` 1..30):
  - `share(g,'river')` entre `.30` e `.50`; `share(g,'mountain')<=.04`.
  - Massas de terra: `components(g,t=>t!=='river'&&t!=='bridge').filter(n=>n>=150).length>=3`.
  - `connected(g)` (por ponte); `g.terrain.includes('bridge')`; simetria; `g.mines.length===8`.
  - Aeroportos: todo `airportDirt`/`airportAsphalt` neutro gerado fica sobre terra e tem ao menos uma casa vizinha alcançável por tanque.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** `node tests/landscapes.test.cjs && node tests/airport-runway.test.cjs` (compare com o base); medir o tempo médio de geração.
- [ ] **Step 5: Commit** `feat: paisagem Ilhas com pontes entre as massas de terra`.

### Task 4: Serras (terreno muito elevado)

**Files:**
- Modify: `public/js/engine.js` (caso `highlands`)
- Test: `tests/landscapes.test.cjs`

**Interfaces:**
- Consumes: Task 1.
- Produces: caso `highlands`. Dois ou três maciços de `mountain` por meia malha, feitos de "cordilheiras": linhas de 10 a 20 casas sorteadas com `rng` e engrossadas para 2 a 3 casas com `wobble`. Em volta de cada maciço há um planalto de `hill` com 3 a 5 casas de largura, e alguns picos isolados (`mountain` 1×1 a 2×2) nas colinas. A água é só um riacho (como Continente com `water=.15`). As passagens vêm do `carve()` atual, que já abre a serra com custo 8 quando ela isola os pontos. Além disso, há duas passagens garantidas na serra central: duas faixas horizontais em `y≈ROWS*.25` e `y≈ROWS*.5`, com a mesma técnica do perfil "Passe" (`engine.js` `P.pass`).

- [ ] **Step 1: Testes que falham** (`landscape:'highlands'`, `seed` 1..30):
  - `share(g,'mountain')` entre `.12` e `.24`; `share(g,'hill')>=.18`; `share(g,'river')<=.08`.
  - `connected(g)`; simetria; `g.mines.length===8`.
  - Ao menos 2 casas de estrada (`road`) com montanha nos dois lados horizontais ou verticais (passagem): `g.terrain` tem ≥ 2 `road` em que `mountain` aparece a 2 casas para os dois lados do mesmo eixo.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** `node tests/landscapes.test.cjs`, o teste de IA mais curto que usa mapa aleatório (`tests/ai-strategy.test.cjs`, comparado com o base) e o tempo médio de geração.
- [ ] **Step 5: Commit** `feat: paisagem Serras com maciços, planaltos e passagens`.

### Task 5: Escolha na interface, multiplayer e campanha

**Files:**
- Modify: `public/index.html:161` (seletor `genLandscape` antes do controle "Água"), `public/js/ui.js:415` (`setupOptions` inclui `landscape`), `public/js/multiplayer.js:98,117` (seletor `mpLandscape` na sala), `public/js/multiplayer-core.js:22` (validação: `landscape` precisa estar em `['auto',...LANDSCAPE_LIST]`; as outras chaves continuam numéricas), `public/js/world.js:8` (bioma "Terras alagadas" usa `landscape:'lakes'`)
- Test: `tests/multiplayer-core.test.cjs` (validação) e `tests/landscapes.browser.test.cjs` (novo; incluir em `test:browser`)

**Interfaces:**
- Consumes: `LANDSCAPE_LIST`, `LANDSCAPE_NAMES`, `g.landscape` (Task 1).
- Produces: seletor "Paisagem" com Aleatória (padrão no menu), Continente, Lagos, Ilhas e Serras. Os `title` de "Água" e "Relevo" passam a dizer "Só na paisagem Continente". A prévia do mapa (`drawPreview`) já mostra o terreno, nada a mudar.

- [ ] **Step 1: Testes que falham**
  - `multiplayer-core`: `config({options:{landscape:'islands'}})` aceita; `config({options:{landscape:'vulcão'}})` lança `Opção de terreno inválida.`; `config({options:{water:.5}})` continua aceito.
  - Navegador: o menu tem `#genLandscape` com 5 opções; escolher "Ilhas" e iniciar a operação deixa `game.landscape==='islands'`; "Aleatória" gera uma das quatro. Capture uma tela do mapa inteiro (zoom mínimo) de cada paisagem para o relatório.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** `node tests/multiplayer-core.test.cjs && node tests/world.test.cjs && node tests/missions.test.cjs && node tests/landscapes.test.cjs` e o teste de navegador novo.
- [ ] **Step 5: Atualizar o manual** (`public/index.html`, tópico do mapa procedural) e o README com as quatro paisagens. Commit `feat: escolha de paisagem no menu, multiplayer e campanha`.
