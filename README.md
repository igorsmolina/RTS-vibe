# War Grid — Fronteiras por Turnos

Jogo de estratégia militar para um jogador contra a IA. Capture postos, proteja seu comandante e destrua o QG inimigo. Agora o combate e a movimentação funcionam em **turnos alternados**, sem limite de tempo para decidir.

## Como jogar

Abra o **`index.html`** no Chrome, Edge ou Firefox. O jogo inteiro está nesse arquivo e funciona offline, sem instalação nem assets externos.

Escolha mapa, dificuldade e, se quiser, uma semente. Você joga primeiro. Selecione suas tropas, mova e execute ações. Clique em **Encerrar turno** ou pressione **Enter** quando terminar. A IA executa seu turno e devolve o controle na próxima rodada.

### Controles

| Ação | Controle |
|---|---|
| Selecionar | Clique esquerdo ou arraste; **Shift** adiciona/remove |
| Ordem contextual | Botão direito no chão move; no inimigo ataca; no posto captura com infantaria; no aliado ferido repara com engenheiro |
| Atacar | **A** e clique no inimigo |
| Mover / Reparar | **M** / **R** e clique no destino/alvo |
| Aguardar | **S** encerra movimento e ação da tropa, ativando trincheira |
| Encerrar turno | **Enter** ou botão acima do mapa |
| Grupos | **Ctrl + 1–5** atribui; **1–5** seleciona |
| Pausar animações | **P**; a velocidade altera somente as animações |

No celular, use os botões de ordem e toque no destino. Aguarde a ordem terminar antes de emitir outra. O **Manual** do jogo detalha as regras.

### Tropas e produção

Cada tropa recebe seus pontos de movimento e **uma ação** no início do próprio turno. Uma ação pode atacar, reparar, capturar, construir ou desarmar uma mina, conforme a especialidade. Pode dividir o movimento em várias ordens e usar pontos restantes após atacar, exceto com artilharia.

| Tropa | Movimento | Créditos | Treinamento | Função |
|---|---:|---:|---:|---|
| Infantaria | 3 | 50 | 1 turno | Captura/construção de postos e acesso às montanhas |
| Batedor | 5 | 75 | 1 turno | Reconhecimento e visão ampliada |
| Engenheiro | 3 | 65 | 2 turnos | Reparo de até 24 HP por ação e remoção de minas |
| Antitanque | 3 | 110 | 2 turnos | Foguete: dano base 90 contra veículos, 20 contra tropas a pé |
| Metralhador | 2 | 90 | 2 turnos | Rajada de até 3 tiros por ação, eficaz contra tropas a pé |
| Tanque | 4 | 150 | 3 turnos | Blindagem e canhão sujeito a erro |
| Artilharia | 2 | 100 | 3 turnos | Move **ou** dispara no turno; explosão 3×3 com fogo amigo |
| Comandante | 3 | — | — | Aura de dano/precisão em raio 2; unidade inicial |

Os custos de treinamento são descontados ao comprar. A fila serial aceita 5 tropas e avança no início do turno do dono, a partir da segunda rodada. Uma saída ocupada mantém a unidade pronta na fila até um próximo turno com espaço livre.

### Outras regras

- **Economia:** QG +15 e cada posto +8 créditos por turno, a partir da segunda rodada. A IA recebe −20% no fácil e +20% no difícil.
- **Terreno:** água bloqueada; use pontes. Cada célula custa 1 ponto, estrada custa 0,5 e floresta custa 2 para veículos. Apenas infantaria atravessa montanhas.
- **Cobertura:** floresta +30% de defesa; montanha +50%; trincheira +25%. Tropas ociosas também se entrincheiram ao passar o turno.
- **Postos:** capturar usa uma ação da infantaria adjacente. Construir custa 60 e uma ação, convertendo a infantaria em guarnição.
- **Névoa:** inimigos fora da visão atual ficam ocultos, mesmo em terreno explorado. Artilharia depende do reconhecimento aliado.
- **Comandante:** +20% dano e +15 pontos de precisão no raio 2. Sua morte remove metade dos créditos.
- **Vitória:** destrua o QG inimigo ou elimine as tropas inimigas sem reforços pendentes.

## Desenvolvimento e verificação

O motor, independente do DOM, está no `<script id="engine">` do `index.html`. O segundo script cuida do Canvas, interface e Web Audio. `requestAnimationFrame` anima somente as ordens autorizadas; tempo decorrido não gera renda, treino ou decisões da IA durante o planejamento.

```sh
npm test                 # regras do motor, caminhos, turnos, combate, economia, IA e névoa
npm install              # dependência de desenvolvimento para o teste no navegador
npm run test:browser     # controles e layouts; requer Google Chrome instalado
```

Os testes requerem Node.js 18+ e usam o código real incorporado ao HTML. `PLAYWRIGHT_MODULE` permite indicar uma instalação local de Playwright. O teste de navegador bloqueia a rede e verifica controles, treinamento, ações, pausa, troca de turnos, reinício e cinco tamanhos de tela.

A pasta `docs` contém registros da evolução do projeto. Os comentários ao final de `index.html` descrevem as melhorias e sugestões futuras. Testes automáticos verificam regras e controles; o equilíbrio das tropas ainda deve ser avaliado em partidas completas.
