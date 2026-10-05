# War Grid — Fronteiras

Jogo de estratégia militar para um jogador contra a IA. Capture postos, proteja seu comandante e destrua o QG inimigo. Escolha **Por turnos** ou **RTS com pausa tática** ao iniciar uma operação.

## Menu inicial e configurações

Ao abrir o jogo, o **menu inicial** em tela cheia reúne: **Continuar partida** (quando há uma partida em andamento), **Jogar** (batalha rápida), **Campanha** (mapa-múndi; mostra o progresso salvo), **Configurações** e **Como jogar**. O botão **Menu** no topo leva de volta a ele e pausa a partida; **Esc** volta ao jogo. Setas navegam os botões e Enter escolhe.

**Configurações** são salvas neste navegador: perfil gráfico, som, grade de casas, tela cheia ao iniciar operação, velocidade padrão, dificuldade padrão e modo padrão (turnos ou RTS). A primeira operação usa esses padrões; as seguintes repetem o modo e a dificuldade da partida anterior.

**Perfil gráfico** muda durante a partida: **Desempenho** remove a decoração animada; **Equilibrado** (padrão) adiciona nuvens translúcidas, sombras, reflexos na água, vegetação ao vento e poeira; **Cinematográfico** aumenta a densidade com limite de partículas. Mísseis, flares e indicação de altitude continuam em todos os perfis. A pausa congela os efeitos; movimento reduzido mantém a decoração estática. Os perfis não alteram o combate nem sua sequência aleatória.

**Altitude aérea:** subir ou descer leva **1 segundo de simulação** nos dois modos. Em turnos consome uma ação; no RTS termina a casa em curso e permanece sem mover/atirar durante a transição. A altitude anterior e seus bônus valem até concluir; parar ou substituir a ordem no RTS cancela e retorna o desenho suavemente. Alta eleva o desenho 18 px e aumenta a escala em 12%, com sombra afastada, marcador na casa e **ALTA**; a transição mostra **SUBINDO/DESCENDO** e progresso. Clique na aeronave elevada ou na casa ocupada para selecioná-la.

Fontes ImageGen, prompts e três nuvens RGBA otimizadas estão em `assets/Atmosfera/`, incorporadas em `public/js/assets.js`.

### Níveis da IA

| Nível | Renda inimiga | Preparo antes do ataque | Margem | Exército máximo |
|---|---:|---|---:|---:|
| Fácil | −20% | 5 turnos / 150 s | 1,6 | 14 |
| Normal | normal | 3 turnos / 90 s | 1,15 | 16 |
| Difícil | +20% | 2 turnos / 60 s | 1,05 | 18 |
| Veterano | +35% | 2 turnos / 60 s, onda de 5 e volta mais rápida | 1,0 | 20 |

A IA não investe no começo: se prepara, reúne o exército no ponto de encontro e ataca em grupo quando a força reunida supera o que ela viu do seu exército. Nos níveis Normal e acima, reforça a onda em andamento. Compra por **doutrina de exército variado**: antiaéreas, helicópteros, pesados, helicópteros ar-terra e ar-ar, antitanques e tanques entram em ordem de prioridade, e um cronograma garante pelo menos uma unidade de cada uma dessas classes a partir de certa rodada (antiaérea na 4ª, helicóptero na 1ª, pesado na 6ª, ar-terra na 10ª, ar-ar na 14ª; no RTS, ×30 s). Poupa pelo tipo que quer até poder pagá-lo. Mira abates prováveis e tropas de maior valor; artilharia escolhe o ponto com mais inimigos e nenhum aliado; unidades caras feridas recuam. Os valores são provisórios e ainda não foram validados em partidas completas.

## Perfil, conquistas e progresso na nuvem

**Perfil e conquistas**, no menu inicial, mostra:

- **15 conquistas**, por exemplo primeira vitória, vencer no Veterano, Blitz e Cartógrafo.
- **Estatísticas de carreira:** vitórias por dificuldade, abates e perdas por tipo, regiões conquistadas.
- **Histórico** das últimas 30 operações.

O progresso fica salvo neste navegador, inclusive quando o jogo é aberto pelo `public/index.html`. A aba **Conta e save** permite:

- **Exportar/Importar save:** gera o arquivo `wargrid-save.json`, que leva o perfil, a campanha e as configurações para outro navegador ou PC.
- **Entrar na nuvem (Neon):** a cada mudança, o progresso é mesclado e enviado para o seu banco Neon. Em outro computador, basta entrar com a mesma conta. As conquistas se somam e os contadores ficam com o maior valor. Vale a campanha e as configurações salvas por último.

### Progresso na nuvem (Neon)

O login do Neon não funciona com a página aberta como arquivo (`file://`). Para sincronizar, abra o jogo por **`Jogar online.bat`** ou `npm start`, que servem o jogo em `http://localhost:5173`. Os dois precisam do Node.js.

1. Crie um projeto em [console.neon.tech](https://console.neon.tech).
2. Em **Auth**, ative o Neon Auth com login por e-mail e senha. O endereço `localhost` já é aceito; para publicar em um site, adicione o domínio `https://…` em *Domains*.
3. Em **Data API**, ative a API no branch principal, usando o Neon Auth como provedor.
4. No **SQL Editor**, rode [`db/schema.sql`](db/schema.sql). Ele cria a tabela `profiles` com RLS, de modo que cada conta só lê e grava a própria linha.
5. Copie a *Auth URL* e a *API URL* para [`public/js/neon-config.js`](public/js/neon-config.js).

Esses dois endereços são públicos. Nunca coloque no jogo a connection string `postgresql://…`.

### Publicar no Vercel

O Vercel publica só a pasta `public/` (configurada em `vercel.json`); testes, scripts, arte original e `db/` ficam de fora. Não há etapa de build.

1. Envie o projeto para um repositório no GitHub e importe-o em [vercel.com/new](https://vercel.com/new). Em *Framework Preset*, deixe **Other**; não precisa de comando de build.
2. Depois do deploy, adicione o endereço `https://<seu-projeto>.vercel.app` em **Neon → Auth → Configuration → Domains**. Sem isso, o login do Neon não funciona no site.
3. Os endereços do Neon em `public/js/neon-config.js` são públicos e vão junto com o site. Nunca coloque ali a connection string `postgresql://…`.

## Como jogar

Abra o **`public/index.html`** no Chrome, Edge ou Firefox. Funciona offline, sem instalação nem servidor; basta manter as pastas `css/` e `js/` ao lado do HTML (a pasta `assets/` só guarda as fontes da arte e não é necessária para jogar). Ao iniciar uma operação o jogo entra em tela cheia (botão **Tela cheia** no topo alterna) e a página inteira vira o campo de batalha, sem rolagem.

As treze classes usam arte preparada com fundo transparente: aliados em verde/caqui e inimigos em vermelho. A mesma arte aparece no mapa, no retrato da seleção e no recrutamento, com rotação, movimento e efeito de disparo. Os atlas estão incorporados em `js/assets.js`; `assets/troops-atlas.png` guarda as tropas e `assets/Tanques/tanks-atlas.png` guarda os três tanques nas duas equipes. Versões preparadas com ImageGen e prompts ficam em `assets/Tanques/`.

Os quatro cenários foram redesenhados no estilo de Broken Arrow, sempre simétricos para os dois lados:

- **Vale dos Rios:** bocage temperado — lotes de cultivo cercados por sebes, rio central sinuoso de borda a borda com três ou mais pontes, colinas suaves.
- **Deserto Aberto:** solo de areia, dunas (colinas), poucos oásis com cultivo irrigado, estradas longas.
- **Passe de Montanha:** serra central intransitável para veículos, cortada por três passagens, com encostas e vales cultivados.
- **Fronteira procedural:** controles de água, floresta, relevo, campos e postos.

Os postos ficam em pontos estratégicos (colinas, cabeceiras de rio, meio do mapa) e uma malha de estradas traçada pelo terreno liga QGs, postos e centro, com pontes onde cruza a água. Os terrenos usam as texturas ilustradas em camadas (grama ou areia, árvores, rochas, água, margens, estradas e pontes); campos, sebes e colinas são desenhados em Canvas sobre elas, com cor e fileiras por lote. A composição considera oito vizinhos para suavizar bordas e cantos, sem revelar terreno desconhecido sob a névoa.

**Grade** (ou **G**) liga/desliga as linhas das casas e salva a preferência neste navegador. Começa desligada; apontamento, seleção, ordens e impacto continuam destacados. A grade é desenhada separadamente do chão e não altera movimento ou alcance.

As 11 imagens de 128 × 128 pixels estão em `assets/terrain/` e incorporadas em `public/js/assets.js`. A arte foi gerada com o ImageGen integrado; fontes em alta resolução e prompts ficam em `assets/terrain/source/redesign/` e `assets/terrain/prompts.json`. A preparação está descrita em [assets/terrain/README.md](assets/terrain/README.md), e a revisão visual e o desempenho em [docs/terrain/README.md](docs/terrain/README.md).

### Gerador procedural

Escolha **Fronteira procedural** no diálogo de nova operação para ajustar **Água** (rios contínuos de borda a borda e lagos), **Floresta**, **Relevo** (colinas; acima de 55% surgem serras), **Campos e sebes** e o número de **Postos** (4–12). A prévia mostra o mapa da semente atual e muda junto com os controles; **Gerar outro** sorteia uma nova semente. O mapa é sempre simétrico para os dois lados e as estradas com pontes garantem que todo o mapa seja alcançável. A prévia também funciona para os três mapas fixos.

### Campanha no mapa-múndi

**Campanha (mapa-múndi)**, no diálogo de nova operação, abre um mundo gerado por semente: continentes, ilhas e oceano, cerca de 15–30 regiões com nome e bioma (planície temperada, deserto, planalto montanhoso, terras alagadas, floresta densa) e rotas marítimas ligando as massas de terra. Seu QG fica a oeste e o inimigo na região mais distante. Ataque regiões vizinhas do seu território (contorno dourado): a batalha é gerada com o campo do bioma (Vale dos Rios, Deserto Aberto, Passe de Montanha ou Fronteira procedural ajustada) e semente própria; território inimigo é um nível mais difícil. Vencer pinta a região de azul; perder abre um contra-ataque, e após cada batalha o inimigo ocupa uma região neutra vizinha. A campanha termina quando um QG cai. O progresso fica salvo neste navegador (`wargrid.campaign.v1`); sem armazenamento, vale só para a sessão.

Escolha modo, mapa, dificuldade e, se quiser, uma semente. **Por turnos** é o padrão: você joga primeiro, sem limite de tempo. Selecione suas tropas, mova e execute ações. Clique em **Encerrar turno** (ou **Enter**) quando terminar; a IA joga e devolve o controle na próxima rodada.

No **RTS**, tropas e IA agem simultaneamente. Clique em **Pausar** (ou **P**), selecione grupos e dê ordens. Movimento, combate, projéteis, produção, IA e tarefas ficam congelados. Clique em **Continuar** (ou **P**) para executar as ordens. Pode substituir ordens durante a pausa ou em movimento; a tropa termina a travessia até a próxima casa antes de seguir a nova rota.

### Controles

Todo o jogo funciona só com o mouse; os atalhos de teclado continuam como alternativa.

| Ação | Mouse | Teclado |
|---|---|---|
| Selecionar | Clique esquerdo ou arraste uma caixa; abre a barra de comando na base do campo | — |
| Produção | Clique no QG ou no botão **QG** do canto inferior esquerdo; a barra de comando mostra o recrutamento | — |
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

Não há painel fixo: com seleção, uma barra de comando fina aparece na base do campo, entre os grupos/registro e o minimapa, com nome, vida e ordens (armas e altitude nos helicópteros; recrutamento quando o QG está selecionado); o botão **i** abre os detalhes. Nada cobre a área em volta da tropa. Em telas estreitas a barra ocupa uma linha própria acima dos cantos. Use os botões de ordem e toque no destino, inclusive durante a pausa tática; toque ou arraste no minimapa para mover a câmera. Por turnos, aguarde a ordem terminar antes de emitir outra. Menus preservam a pausa anterior ao fechar; sair da aba pausa a operação. O **Manual** detalha as regras.

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
| Helicóptero | 6 | 150 | 3 turnos / 30 s | Metralhadora; apoio e reconhecimento aéreo |
| Helicóptero ar-terra | 6 | 230 | 4 turnos / 40 s | Metralhadora e mísseis contra alvos terrestres |
| Helicóptero ar-ar | 6 | 240 | 4 turnos / 40 s | Metralhadora e mísseis contra helicópteros |
| Comandante | 3 | — | — | Aura de dano/precisão em raio 2; unidade inicial |

Os custos de treinamento são descontados ao comprar. A fila serial aceita 5 tropas e avança no início do turno do dono, a partir da segunda rodada, ou continuamente no RTS. Uma saída ocupada mantém a unidade pronta até o próximo turno com espaço livre ou até liberar espaço no RTS.

Os três tanques estão disponíveis no QG do jogador e da IA, com um médio inicial por lado. O batedor causa 40% do dano contra qualquer tanque; o antitanque mantém o multiplicador 2,25 contra veículos. O pesado usa vida adicional, sem outro sistema de blindagem. A IA prioriza infantaria e especialistas antes de ampliar os tanques, buscando a proporção leve:médio:pesado de 1:2:1; pode poupar créditos para a classe desejada. [Atributos, comparação por sementes e capturas](docs/tanks/README.md).

### Outras regras

- **Economia:** QG +15 e posto +8 créditos por turno a partir da segunda rodada, ou a cada 10 segundos no RTS. A IA recebe −20% no fácil e +20% no difícil.
- **Terreno:** água bloqueada; use pontes. Cada célula custa 1 ponto, estrada custa 0,5, floresta custa 2 para veículos, colina e sebe custam 1,5 para veículos. No RTS os custos alteram o tempo de travessia. Apenas infantaria atravessa serras (montanhas).
- **Relevo e vegetação (valores provisórios):** colina dá +20% defesa, +2 visão e +1 alcance de tiro direto; sebe dá +25% defesa e esconde quem está nela como a floresta (vista só a até 2 casas; batedor 3); campo é livre como a planície e aceita postos.
- **Cobertura:** floresta +30% de defesa; montanha +50%; trincheira +25%. Tropas ociosas se entrincheiram ao passar o turno ou após 3 segundos no RTS.
- **Postos:** capturar usa uma ação da infantaria adjacente ou 2 segundos no RTS. Construir custa 60 e uma ação ou 3 segundos no RTS, convertendo a infantaria em guarnição. Cancelar devolve a reserva uma vez.
- **Engenharia no RTS:** reparo de até 24 HP por segundo até completar a vida; desarme de mina em 1 segundo. As tarefas avançam somente com a simulação ativa.
- **Névoa:** inimigos fora da visão atual ficam ocultos, mesmo em terreno explorado. Artilharia depende do reconhecimento aliado.
- **Floresta:** tropas na floresta só são vistas a até 2 casas de um observador (batedor: 3). Disparar revela a posição por 2 s no RTS ou até o próximo turno.
- **Helicópteros** (`air:true`): 120 HP, 2,2 casas/s no RTS, visão 6, recompensa 50. Voam sobre água e montanhas com custo 1 por casa, sem bônus de estrada, penalidade de floresta, cobertura ou bônus de montanha; a floresta não os esconde. Dividem casa com tropas terrestres e estruturas, nunca com outra aeronave; a saída aérea do QG só é bloqueada por aeronaves. Minas, a explosão da artilharia e a queda de uma aeronave não atingem a outra camada. Infantaria e metralhadores os atacam com dano reduzido (infantaria −75%, metralhador −35%, caindo até a metade no alcance máximo do disparo); engenheiros os reparam. Não capturam, constroem nem transportam.
- **Armas aéreas:** metralhadora 20 de dano, alcance 3, 85%, recarga 1 s (×0,35 contra veículos terrestres, ×0,5 contra estruturas); míssil ar-terra 65, alcance 5, 85%, 3 s (só alvos terrestres; ×1,5 contra veículos, ×0,5 contra tropas a pé); míssil ar-ar 70, alcance 6, 90%, 3 s (só helicópteros). Auto escolhe o míssil contra veículo/estrutura (ar-terra) ou helicóptero (ar-ar) e a metralhadora no resto; os botões Auto, Metralhadora e Míssil fixam a arma. Por turnos um disparo gasta a ação, e trocar de arma não a devolve; no RTS as duas armas dividem a recarga do último disparo. O projétil guarda arma, dano e alvo do momento do disparo. Clique de novo na mesma casa para alternar entre a aeronave e a tropa abaixo dela.
- **Supressão:** tropa que leva dano e sobrevive perde 25 pontos de precisão por 3 s no RTS ou durante o próprio turno seguinte; novo dano renova sem acumular. Estruturas não são suprimidas.
- **Comandante:** +20% dano e +15 pontos de precisão no raio 2. Sua morte remove metade dos créditos.
- **Vitória:** destrua o QG inimigo ou elimine as tropas inimigas sem reforços pendentes.

## Desenvolvimento e verificação

`npm start` serve o jogo em `http://localhost:5173`. `tests/profile.test.cjs` cobre o perfil: conquistas, mescla e validação de dados de fora.

O veículo antiaéreo tem **alcance ilimitado somente contra aeronaves visíveis à equipe** e conserva visão local de 6 casas. Seu radar começa ligado e detecta globalmente aeronaves inimigas em altitude alta, por identidade, sem explorar terreno ou revelar tropas terrestres. Use **Radar: ligado/desligado** na barra da seleção; em grupos controla só as antiaéreas, mostra estado misto e informa os contatos da equipe. Alternar é gratuito e funciona durante a pausa. Quadrados verdes acompanham a aeronave elevada e aparecem no minimapa. Jogador e IA usam as mesmas regras; a IA mantém seus radares ligados.

Mísseis do veículo levam `max(0,45 s, distância/6)`, sem limite máximo. Precisam manter contato compartilhado: se ele desaparecer, a última posição é congelada e a guiagem é perdida definitivamente, sem dano mesmo após recuperar contato. Descer ou desligar/destruir um radar só quebra a guiagem se não houver outro observador. Os demais mísseis mantêm seus alcances e o limite de voo de 1,2 s; precisão, flares e dano no impacto são preservados. Na pausa, radar atualiza os contatos imediatamente e os projéteis só processam a mudança ao retomar. [Testes, capturas e gravação](docs/radar/README.md).

O **radar circular** no canto inferior esquerdo aparece com qualquer antiaérea aliada viva e ligada. Mostra todas as aeronaves inimigas visíveis à equipe, inclusive baixas observadas normalmente, com quadrados verdes e contagem imediata. Norte fica para cima; a escala fixa cobre a diagonal do mapa. A referência é a antiaérea selecionada de menor id, mesmo desligada; sem seleção válida, usa a ativa de menor id. O painel só informa: selecione e ataque pelo campo ou pelos controles existentes.

Use **Radar · N contatos** para recolher/expandir (Enter ou Espaço também funciona). O círculo mede 176 px no computador e 112 px em telas pequenas ou janelas baixas (até 500 px de altura); começa recolhido se o campo tiver menos de 360 px de altura. A escolha dura só a operação. A varredura leva 4 segundos de simulação, acompanha a velocidade e congela na pausa, menus e saída da aba; movimento reduzido deixa a linha estática. Comandos e detalhes ganham rolagem quando o espaço real do campo exige. [Capturas e gravação do painel](docs/radar-panel/README.md).

| Arquivo | Conteúdo |
|---|---|
| `public/index.html` | Marcação da página e diálogos |
| `public/css/style.css` | Estilos do jogo e layout em tela cheia |
| `public/css/tailwind.css` | Saída gerada do Tailwind; não há fonte para regenerar, então edite `style.css` |
| `public/js/engine.js` | Motor independente do DOM: perfis dos mapas, gerador (relevo, água, vegetação, campos e sebes, postos, estradas), tropas, combate, economia, IA e névoa |
| `public/js/world.js` | Mapa-múndi da campanha sem DOM: continentes, biomas, regiões, rotas marítimas e regras de conquista/salvamento |
| `public/js/campaign.js` | Tela da campanha: desenho do mundo, escolha de região, batalha pelo bioma e progresso no navegador |
| `public/js/assets.js` | Texturas e atlas em data URL; atualizado pelos scripts `prepare:terrain` e `prepare:tanks`; o bloco `HELI_ASSETS` traz `assets/Helicopteros/helicopters-atlas.png` |
| `public/js/render.js` | Sprites, texturas de terreno, câmera, `Renderer` (Canvas e minimapa) e prévia do mapa |
| `public/js/ui.js` | Som, estado da partida, barra de comando e painéis da base, comandos de mouse e teclado, loop e inicialização |
| `tests/` | `engine.test.cjs` (motor: turnos, RTS, tanques, mapas e terrenos), `world.test.cjs` (mapa-múndi e campanha) e `browser.test.cjs` (Chrome: controles, câmera, gerador, campanha, tanques, terreno) |
| `scripts/` | Preparação de texturas e tanques; comparação de confrontos; servidor local (`serve.cjs`) |
| `assets/` | Atlas, texturas e fontes de alta resolução com prompts |
| `db/` | `schema.sql`: tabela do perfil no Neon |
| `vercel.json` | Publica só a pasta `public/` no Vercel |

Os scripts são clássicos, sem `import`, para o jogo abrir via `file://`, e carregam nessa ordem. As imagens ficam em data URL porque o Canvas recusa ler pixels de PNGs locais carregados por caminho. `Game(map, difficulty, seed, mode, options)` aceita `turns` (padrão) ou `rts`; `options` (`water`, `forest`, `mountain` de 0 a 1 e `posts`) controla o gerador procedural; `trainDuration(type)` fornece turnos ou segundos. O loop subdivide o tempo de simulação em passos curtos. No planejamento por turnos, tempo decorrido não gera renda, treino ou decisões da IA; no RTS, tudo avança enquanto a operação estiver ativa.

```sh
npm test                 # motor (turnos, RTS, tanques, mapas e terrenos), mapa-múndi/campanha e defesa aérea
npm install              # dependência de desenvolvimento para o teste no navegador
npm run test:browser     # Chrome offline: controles, câmera, gerador, layouts, tanques e terreno
npm run prepare:terrain  # exporta as peças 128x128 e sincroniza public/js/assets.js
npm run prepare:tanks    # seis PNGs transparentes 128x128 e atlas offline
npm run compare:tanks    # 1.400 confrontos por sementes e lados alternados; test-output/tanks/balance-results.json
```

Os testes requerem Node.js 18+ e usam o código real de `public/js/` e o próprio `public/index.html`; capturas e relatórios gerados ficam em `test-output/` (fora do Git). `PLAYWRIGHT_MODULE` permite indicar uma instalação local de Playwright. O teste de navegador bloqueia a rede e verifica ambos os modos, pausa com ordens e projéteis ativos, menus, grupos, reinício, velocidade e computador/celular.

Testes automáticos verificam regras e controles; o equilíbrio das tropas ainda deve ser avaliado em partidas completas.

Verificações específicas do redesign: `npm run test:terrain` (grade, persistência, camadas alpha, água contínua, névoa, RNG e armazenamento bloqueado).
