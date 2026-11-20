# rtsvibe — visão geral do jogo e histórico do desenvolvimento

Repositório: https://github.com/igorsmolina/RTS-vibe
Branch com todas as mudanças descritas aqui: `claude/sweet-cannon-qugemw`
Para jogar: baixe o ZIP do branch (https://github.com/igorsmolina/RTS-vibe/archive/refs/heads/claude/sweet-cannon-qugemw.zip), descompacte e abra `public/index.html` no navegador.

---------------------------------------------------------------------
## 1. O que é este jogo

rtsvibe ("Fronteiras") é um jogo de estratégia militar que roda no navegador, em JavaScript puro, sem servidor obrigatório. A interface é em português. Dá para jogar:

- **Por turnos** (cada tropa tem movimento e uma ação por turno) ou **em tempo real com pausa tática** (RTS).
- Contra a **IA**, em cinco níveis de comportamento (Fácil a Veterano), ou em **multiplayer** de até 3 jogadores, todos contra todos.
- Em **mapas fixos** (Vale dos Rios, Deserto Aberto, Passe de Montanha), em **mapas procedurais** (Fronteira procedural, com paisagens Continente, Lagos, Ilhas e Serras) ou na **campanha** num mapa-múndi gerado por semente (regiões, biomas, conquista e contra-ataque, além de uma campanha com história e personagens).

Conteúdo principal:

- **Times (exércitos):** Verde (os melhores aviões), Vermelho (os melhores tanques) e Azul/França (infantaria e transporte de infantaria). Cada time tem ficha própria de unidades, com preços, vida, dano e alcance diferentes.
- **Unidades:** infantaria, engenheiro, metralhador, antitanque, soldado lançador, batedor, tanques leve/médio/pesado, artilharia, artilharia de mísseis, veículo antiaéreo, helicópteros (básico, ar-terra, ar-ar, transporte), drones (reconhecimento e furtivo), caminhão de transporte, comandante, aviões (caça, multifunção, caça furtivo, bombardeiro, transporte) e estruturas (QG, posto avançado, aeroportos).
- **Sistemas:** névoa de guerra e radar, aviação com pista de pouso e decolagem, munição limitada de mísseis (com aviso de "Pouca munição" e "Munição acabou"), transporte e lançamento de tropas por paraquedas, doutrinas, experiência (Veterano e Elite), economia com renda por QG e postos.
- **Multiplayer:** salas por código; a partida roda no servidor ou no navegador do anfitrião (WebRTC). Posições: Azul no canto inferior esquerdo, Vermelho no superior direito, Verde no inferior direito.

Estrutura de código (resumo):
- `public/index.html`: toda a interface (diálogos `<dialog>`).
- `public/js/engine.js`: motor do jogo (sem DOM), gerador de mapas, regras, IA.
- `public/js/ui.js`, `render.js`, `campaign.js`, `world.js`, `multiplayer*.js`, `menu-kit.js` etc.: interface e desenho.
- `public/css/`: `style.css` (base) e `menus*.css` (menus táticos).
- `tests/`: testes em Node (`*.test.cjs`) e de navegador (`*.browser.test.cjs`, com Playwright).
- `scripts/`: preparação de arte e simuladores de balanceamento (`faction-balance.cjs`, `faction-air-balance.cjs`).
- `unidades.md`: fichas de todas as unidades por time. `README.md`: manual do projeto.

---------------------------------------------------------------------
## 2. Resumo do que foi feito na conversa (em ordem)

### 2.1 Tabela de unidades e planilha
- Pedido: uma tabela com todas as unidades, danos, alcances etc., depois um arquivo editável, separado por time (Verde, Vermelho, Azul/França), incluindo aviões e o dano dos mísseis.
- Você editou a planilha (`unidades.xlsx`) e pediu para aplicar os valores ao jogo.

### 2.2 Planilha aplicada ao jogo, mísseis e zoom
- Fichas separadas por time no motor (`RED`, `FR`, `SPEC`/`UT`), aura/reparo/Trophy por time, armas por time (terrestres, helicópteros, drones) e dos aviões por modelo.
- Mísseis antitanque vermelhos, fuzil do lançador azul, metralhadora do caminhão vermelho.
- Imagens de míssil em todas as unidades que usam mísseis; munição total ("xN"), contador na tela e avisos "Pouca munição" / "Munição acabou".
- Zoom out até enxergar o mapa inteiro.
- Executado com subagentes nas tarefas de balanceamento e inline nas demais, com revisão final (que achou e corrigiu uma falha que travava o multiplayer com aviões inimigos sem munição).

### 2.3 Pista, decolagem/pouso e cronômetros
- Animação contínua de pista com giro suave e fumaça de pneu no toque.
- Barras e cronômetros na tela para captura, manutenção, treino, obra e outros processos.

### 2.4 Mapas procedurais
- Novas paisagens: Lagos, Ilhas (com pontes) e Serras (maciços, planaltos e passagens), com opção de paisagem no menu, no multiplayer e na campanha.
- Correção do "bug" dos controles de Água e Relevo, que só valiam na paisagem Continente; agora valem em todas.
- Melhoria completa para mapas mais naturais em todos os mapas: relevo gradual com colinas ao redor das serras, rios que descem em curvas e alargam, lagos de margem irregular, oásis no deserto, matas mais densas perto da água com clareiras, lavouras de formas orgânicas (menos "xadrez") e estradas que contornam o relevo. Testes novos (`tests/maps.test.cjs`) mediram isso; a geração ficou em cerca de 70 ms por mapa.
- Ajuste de um teste de IA (`ai-outposts`) que pressupunha pontes só no rio central.

### 2.5 Time Azul (França): especialidade e balanceamento
- Identidade: infantaria e transporte de infantaria (Verde: aviões; Vermelho: tanques).
- Habilidades exclusivas: desembarque de assalto (+20% de precisão e +25% de velocidade por 6 s ao sair de transporte azul), captura e obra 30% mais rápidas, evacuação blindada (tropa sai viva com metade da vida se o caminhão TRM ou o NH90 for destruído).
- Simulador de balanceamento com orçamento igual (`scripts/faction-balance.cjs`) e outro para aviões. Resultado: infantaria ~69% contra os dois times; infantaria embarcada ~100%; tanques ~56% contra o Verde e ~38% contra o Vermelho; helicópteros os mais fracos (como pedido).
- Valores alterados: infantaria dano 40; antitanque 100; metralhador 85; lançador 80; TRM 100; NH90 210; tanque leve vida 100; médio 150 de custo e 160 de vida; pesado com alcance 7 e 3 mísseis antitanque; VBL vida 75; Tigre 235; Mirage IV 200 de vida e 100 flares; Rafale curva 105°/s.
- Limites conhecidos: no simulador o caça e o furtivo vermelhos já vencem os verdes (ordem "Verde melhor em aviões" não aparece e não foi alterada); o bombardeiro vermelho (casco 100) parece erro de digitação; o exército misto da França ainda ganha 75% do Verde.
- Relatórios em `reports/franca-2026-10-22/`.

### 2.6 Reformulação de todos os menus
- Estilo militar tático, só tema escuro, apenas desktop (celular não foi redesenhado).
- Tela inicial: mapa vivo em tela cheia com paralaxe, menu em blocos com ícone.
- Nova operação em abas Teatro / Regras / Forças, prévia grande do mapa, cartões com miniaturas dos mapas, paisagens, sprites dos times, doutrinas e dificuldades.
- Campanha (dossiê da região, diário em linha do tempo, retrato da missão), multiplayer (entrada em cartões, código com botão copiar, três vagas com lâmpada de "pronto"), configurações, nação (bandeira com ondulação), perfil (medalhas e estatísticas), editor de exército e manual (fichas por time).
- Sons de interface; animações desligam com "reduzir movimento" do sistema e com o perfil gráfico "Desempenho".
- Testes novos: `menus`, `menus-setup`, `menus-social`, `menus-system`. Falhas que já existiam antes dos menus: `browser.test`, `carta`, `identity`, `radar-panel`, `visual-v2`.

### 2.7 Conversas de ideias e um prompt
- Sugestões de novidades (navios, missões nos mapas, evolução do comandante); você escolheu olhar campanha e multiplayer; expliquei o multiplayer de 3 jogadores e as posições das bases.
- Prompt reutilizável para criar o time **Roxo** (especialidade: transporte pesado, com um helicóptero tipo V-22 Osprey e um avião de transporte a jato com mais carga), no mesmo método da França.
- Pergunta sobre remover fundo de imagens: possível com Python (Pillow/rembg) ou com o conector do Canva, quando disponível.

---------------------------------------------------------------------
### 2.8 Trabalho feito fora desta conversa (já no branch)
Três commits chegaram ao branch vindos de outra sessão, depois do que está descrito acima, e eu não os revisei: time Roxo de transporte pesado (`ee8584d`), multiplayer com quatro jogadores e transporte sem fila (`c470e88`) e barra de comandos em blocos com sprites dos times sem corte (`67385e8`). Por isso, as seções 1 e 2 (por exemplo, "3 times" e "até 3 jogadores") descrevem o estado desta conversa; o branch agora tem mais coisas.

---------------------------------------------------------------------
## 3. Como testar e onde estão os relatórios

- Testes de motor: `node tests/<arquivo>.test.cjs` (ex.: `node tests/franca.test.cjs`, `node tests/maps.test.cjs`).
- Testes de navegador usam Playwright e Chromium; veja `package.json` (`npm run test:browser`).
- Simuladores de balanceamento: `npm run balance:franca` e `node scripts/faction-air-balance.cjs`.
- Relatórios de balanceamento: `reports/franca-2026-10-22/`.
- Fichas de unidades por time: `unidades.md`.

## 4. Pendências e ideias em aberto
- Time Roxo: o prompt foi escrito nesta conversa e, depois, o time foi implementado em outra sessão (commit `ee8584d`, com arte, balanceamento e testes). Não revisei esse trabalho.
- Menus em celular (ignorados de propósito).
- Testes que já falhavam antes e dependem de ambiente (`carta`, `identity`, `radar-panel`, `visual-v2`, `browser.test`, `dialogs-in-battle`).
- Campanha compartilhada em sala de multiplayer, campanha com evolução do comandante, navios e missões nos mapas (ideias discutidas, não implementadas).
- Valores de balanceamento são provisórios; a dificuldade percebida só se confirma jogando.
