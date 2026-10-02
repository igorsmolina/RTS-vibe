# War Grid — Fronteiras

Jogo de estratégia militar para um jogador contra a IA. Capture postos, proteja seu comandante e destrua o QG inimigo. Escolha **Por turnos** ou **RTS com pausa tática** ao iniciar uma operação.

## Como jogar

Abra o **`index.html`** no Chrome, Edge ou Firefox. Funciona offline, sem instalação nem servidor; basta manter as pastas `css/`, `js/` e `assets/` ao lado do HTML. Ao iniciar uma operação o jogo entra em tela cheia (botão **Tela cheia** no topo alterna) e a página inteira vira o campo de batalha, sem rolagem.

As dez classes usam arte preparada com fundo transparente: aliados em verde/caqui e inimigos em vermelho. A mesma arte aparece no mapa, no retrato da seleção e no recrutamento, com rotação, movimento e efeito de disparo. Os atlas estão incorporados em `js/assets.js`; `assets/troops-atlas.png` guarda as tropas e `assets/Tanques/tanks-atlas.png` guarda os três tanques nas duas equipes. Versões preparadas com ImageGen e prompts ficam em `assets/Tanques/`.

Os quatro cenários usam terrenos ilustrados naturais em camadas: grama ou areia, árvores e rochas com transparência, água, margens, estradas e pontes. A composição considera oito vizinhos para suavizar bordas e cantos; a paisagem é contínua, mantendo o centro de cada casa reconhecível. O Deserto Aberto tem versões arenosas.

**Grade** (ou **G**) liga/desliga as linhas das casas e salva a preferência neste navegador. Começa desligada; apontamento, seleção, ordens e impacto continuam destacados. A grade é desenhada separadamente do chão e não altera movimento ou alcance.

As 11 imagens de 128 × 128 pixels estão em `assets/terrain/` e incorporadas em `js/assets.js`. A arte foi gerada com o ImageGen integrado; fontes em alta resolução e prompts ficam em `assets/terrain/source/redesign/` e `assets/terrain/prompts.json`. A preparação está descrita em [assets/terrain/README.md](assets/terrain/README.md), e a revisão visual e o desempenho em [docs/terrain/README.md](docs/terrain/README.md).

### Gerador procedural

Escolha **Fronteira procedural** no diálogo de nova operação para ajustar **Água** (rios contínuos de borda a borda e lagos), **Floresta**, **Montanha** e o número de **Postos** (4–12). A prévia mostra o mapa da semente atual e muda junto com os controles; **Gerar outro** sorteia uma nova semente. O mapa é sempre simétrico para os dois lados e as estradas com pontes garantem que todo o mapa seja alcançável. A prévia também funciona para os três mapas fixos.

Escolha modo, mapa, dificuldade e, se quiser, uma semente. **Por turnos** é o padrão: você joga primeiro, sem limite de tempo. Selecione suas tropas, mova e execute ações. Clique em **Encerrar turno** (ou **Enter**) quando terminar; a IA joga e devolve o controle na próxima rodada.

No **RTS**, tropas e IA agem simultaneamente. Clique em **Pausar** (ou **P**), selecione grupos e dê ordens. Movimento, combate, projéteis, produção, IA e tarefas ficam congelados. Clique em **Continuar** (ou **P**) para executar as ordens. Pode substituir ordens durante a pausa ou em movimento; a tropa termina a travessia até a próxima casa antes de seguir a nova rota.

### Controles

Todo o jogo funciona só com o mouse; os atalhos de teclado continuam como alternativa.

| Ação | Mouse | Teclado |
|---|---|---|
| Selecionar | Clique esquerdo ou arraste uma caixa | — |
| Somar à seleção | Botão **+ Somar** e depois cliques/caixas | **Shift** + clique |
| Ordem contextual | Botão direito: no chão move; no inimigo ataca; no posto captura com infantaria; no aliado ferido repara com engenheiro | — |
| Atacar / Mover / Reparar | Botões **Atacar**, **Mover**, **Reparar** e clique no alvo; clicar de novo cancela | **A** / **M** / **R**; **Esc** cancela |
| Aguardar / Parar | Botão **Aguardar** (turnos) ou **Parar** (RTS) | **S** |
| Encerrar turno | Botão acima do mapa, somente por turnos | **Enter** |
| Grupos | Botão direito em **1–5** atribui; clique seleciona | **Ctrl + 1–5** / **1–5** |
| Câmera | Encostar o mouse na borda do campo; arrastar com o botão do meio, ou com o esquerdo após ativar **✋ Câmera** (clique simples continua selecionando); roda aproxima/afasta; clique ou arraste no minimapa | — |
| Pausar / Continuar | Botão no topo | **P** |
| Velocidade | Botão **0,25× / 0,5× / 1× / 2×**: animações por turnos; toda a simulação no RTS | — |
| Grade das casas | Botão Grade | **G** |
| Tela cheia | Botão no topo; ativada ao iniciar a operação | **Esc** sai |

No celular, use os botões de ordem e toque no destino, inclusive durante a pausa tática; toque ou arraste no minimapa para mover a câmera. Por turnos, aguarde a ordem terminar antes de emitir outra. Menus preservam a pausa anterior ao fechar; sair da aba pausa a operação. O **Manual** detalha as regras.

### Tropas e produção

Por turnos, cada tropa recebe seus pontos de movimento e **uma ação** no início do próprio turno. Uma ação pode atacar, reparar, capturar, construir ou desarmar uma mina, conforme a especialidade. Pode dividir o movimento em várias ordens e usar pontos restantes após atacar, exceto com artilharia.

No RTS não há orçamento de movimento nem ação por turno. A velocidade depende da classe e do terreno; tropas paradas disparam automaticamente contra inimigos visíveis ao alcance, respeitando o intervalo da arma. Ordenar ataque permite perseguir o alvo. A artilharia pode mover e depois disparar parada; o metralhador dispara a cada 0,4 segundo.

| Tropa | Movimento por turno | Créditos | Treinamento por turnos / RTS | Função |
|---|---:|---:|---:|---|
| Infantaria | 3 | 50 | 1 turno / 10 s | Captura/construção de postos e acesso às montanhas |
| Batedor | 5 | 75 | 1 turno / 10 s | Reconhecimento e visão ampliada |
| Engenheiro | 3 | 65 | 2 turnos / 20 s | Reparo de até 24 HP por ação ou por segundo no RTS; remoção de minas |
| Antitanque | 3 | 110 | 2 turnos / 20 s | Foguete: dano base 90 contra veículos, 20 contra tropas a pé |
| Metralhador | 2 | 90 | 2 turnos / 20 s | Rajada por ação; fogo contínuo no RTS, eficaz contra tropas a pé |
| Tanque leve | 5 | 100 | 2 turnos / 20 s | Mobilidade, visão 5 e menor custo |
| Tanque médio | 4 | 150 | 3 turnos / 30 s | Equilíbrio; conserva os atributos do tanque original |
| Tanque pesado | 3 | 240 | 4 turnos / 40 s | Mais vida e dano por tiro; menor velocidade e cadência |
| Artilharia | 2 | 100 | 3 turnos / 30 s | Move **ou** dispara por turno; explosão 3×3 com fogo amigo |
| Comandante | 3 | — | — | Aura de dano/precisão em raio 2; unidade inicial |

Os custos de treinamento são descontados ao comprar. A fila serial aceita 5 tropas e avança no início do turno do dono, a partir da segunda rodada, ou continuamente no RTS. Uma saída ocupada mantém a unidade pronta até o próximo turno com espaço livre ou até liberar espaço no RTS.

Os três tanques estão disponíveis no QG do jogador e da IA, com um médio inicial por lado. O batedor causa 40% do dano contra qualquer tanque; o antitanque mantém o multiplicador 2,25 contra veículos. O pesado usa vida adicional, sem outro sistema de blindagem. A IA prioriza infantaria e especialistas antes de ampliar os tanques, buscando a proporção leve:médio:pesado de 1:2:1; pode poupar créditos para a classe desejada. [Atributos, comparação por sementes e capturas](docs/tanks/README.md).

### Outras regras

- **Economia:** QG +15 e posto +8 créditos por turno a partir da segunda rodada, ou a cada 10 segundos no RTS. A IA recebe −20% no fácil e +20% no difícil.
- **Terreno:** água bloqueada; use pontes. Cada célula custa 1 ponto, estrada custa 0,5 e floresta custa 2 para veículos. No RTS os custos alteram o tempo de travessia. Apenas infantaria atravessa montanhas.
- **Cobertura:** floresta +30% de defesa; montanha +50%; trincheira +25%. Tropas ociosas se entrincheiram ao passar o turno ou após 3 segundos no RTS.
- **Postos:** capturar usa uma ação da infantaria adjacente ou 2 segundos no RTS. Construir custa 60 e uma ação ou 3 segundos no RTS, convertendo a infantaria em guarnição. Cancelar devolve a reserva uma vez.
- **Engenharia no RTS:** reparo de até 24 HP por segundo até completar a vida; desarme de mina em 1 segundo. As tarefas avançam somente com a simulação ativa.
- **Névoa:** inimigos fora da visão atual ficam ocultos, mesmo em terreno explorado. Artilharia depende do reconhecimento aliado.
- **Comandante:** +20% dano e +15 pontos de precisão no raio 2. Sua morte remove metade dos créditos.
- **Vitória:** destrua o QG inimigo ou elimine as tropas inimigas sem reforços pendentes.

## Desenvolvimento e verificação

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Marcação da página e diálogos |
| `css/style.css` | Estilos do jogo e layout em tela cheia |
| `css/tailwind.css` | Saída gerada do Tailwind; não há fonte para regenerar, então edite `style.css` |
| `js/engine.js` | Motor independente do DOM: mapas, gerador procedural, tropas, combate, economia, IA e névoa |
| `js/assets.js` | Texturas e atlas em data URL; atualizado pelos scripts `prepare:terrain` e `prepare:tanks` |
| `js/render.js` | Sprites, texturas de terreno, câmera, `Renderer` (Canvas e minimapa) e prévia do mapa |
| `js/ui.js` | Som, estado da partida, painel, comandos de mouse e teclado, loop e inicialização |
| `tests/` | `engine.test.cjs` (motor: turnos, RTS, tanques, gerador) e `browser.test.cjs` (Chrome: controles, câmera, gerador, tanques, terreno) |
| `scripts/` | Preparação de texturas e tanques; comparação de confrontos |
| `assets/` | Atlas, texturas e fontes de alta resolução com prompts |
| `docs/` | `NOTAS.md` (evolução e ideias) e `tanks/README.md` (atributos e confrontos) |

Os scripts são clássicos, sem `import`, para o jogo abrir via `file://`, e carregam nessa ordem. As imagens ficam em data URL porque o Canvas recusa ler pixels de PNGs locais carregados por caminho. `Game(map, difficulty, seed, mode, options)` aceita `turns` (padrão) ou `rts`; `options` (`water`, `forest`, `mountain` de 0 a 1 e `posts`) controla o gerador procedural; `trainDuration(type)` fornece turnos ou segundos. O loop subdivide o tempo de simulação em passos curtos. No planejamento por turnos, tempo decorrido não gera renda, treino ou decisões da IA; no RTS, tudo avança enquanto a operação estiver ativa.

```sh
npm test                 # motor: turnos, RTS, tanques, mapas conectados e simétricos, gerador
npm install              # dependência de desenvolvimento para o teste no navegador
npm run test:browser     # Chrome offline: controles, câmera, gerador, layouts, tanques e terreno
npm run prepare:terrain  # exporta as peças 128x128 e sincroniza js/assets.js
npm run prepare:tanks    # seis PNGs transparentes 128x128 e atlas offline
npm run compare:tanks    # 1.400 confrontos por sementes e lados alternados; docs/tanks/balance-results.json
```

Os testes requerem Node.js 18+ e usam o código real de `js/` e o próprio `index.html`. `PLAYWRIGHT_MODULE` permite indicar uma instalação local de Playwright. O teste de navegador bloqueia a rede e verifica ambos os modos, pausa com ordens e projéteis ativos, menus, grupos, reinício, velocidade e computador/celular.

`docs/NOTAS.md` descreve as melhorias e sugestões futuras. Testes automáticos verificam regras e controles; o equilíbrio das tropas ainda deve ser avaliado em partidas completas.

Verificações específicas do redesign: `npm run test:terrain` (grade, persistência, camadas alpha, água contínua, névoa, RNG e armazenamento bloqueado).
