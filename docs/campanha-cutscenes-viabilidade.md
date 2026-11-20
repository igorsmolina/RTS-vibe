# Cutscenes de Véu de Cinzas: viabilidade

Parecer de 9 de novembro de 2026. Escopo: proposta e verificação do projeto atual. Nenhuma cutscene nova foi implementada.

As sete sequências propostas no [roteiro](campanha-roteiro-proposta.md) são viáveis como cenas 2D com retratos, fundos ilustrados, enquadramentos e transições. O jogo já tem o fluxo narrativo necessário. A primeira entrega pode usar imagens estáticas e avanço manual, mantendo as decisões e as missões atuais.

## O que o projeto já oferece

| Recurso | Evidência no código | Consequência para o roteiro |
|---|---|---|
| Quatro personagens e três expressões por personagem | `public/js/story.js:5`; 12 arquivos em `public/assets/characters/` | Helena, Reis, Ivo e Vilar podem aparecer sem produzir novos retratos. |
| Cena em tela cheia com dois retratos, destaque de quem fala e texto acessível | `public/index.html:445`; `public/js/story-ui.js:31`; `public/css/style.css:202` | A base é uma apresentação de diálogos. Ainda não há troca de cenários ou sequência de planos. |
| Abertura, preparação, pós-missão e finais | `public/js/story-ui.js:16`, `:53`, `:59`; `public/js/story.js:72` | É possível colocar as sete sequências nos eventos atuais. |
| Pular sem decidir pelo jogador | `public/js/story-ui.js:43`, `:91` | As escolhas permanecem obrigatórias. O botão leva à decisão quando ela existe. |
| Suspender e retomar a fala | `public/js/story-ui.js:26`, `:46`, `:52`; `public/js/story.js:69` | O save guarda `scene.id`, `scene.index` e a ação seguinte. |
| Pausa de combate e bloqueio de comandos enquanto há diálogo | `public/js/ui.js:107`, `:402`, `:452`; `public/js/story-ui.js:25` | A encenação pode rodar fora do relógio da simulação. |
| Histórico e documentos | `public/js/story-ui.js:84` | Falas e provas continuam consultáveis. O diário é textual; não reproduz uma animação. |
| Som sintetizado e configuração de áudio | `public/js/ui.js:2` | Há infraestrutura para efeitos curtos. Dublagem e trilha específica ainda precisam de arquivos e integração. |
| Movimento reduzido | `public/css/style.css:199`; `public/js/ui.js:35` | Transições CSS já são desativadas. Movimentos novos em JavaScript terão de respeitar a preferência explicitamente. |
| Operação offline | Caminhos relativos em `public/index.html` e `public/js/story-ui.js:40` | Imagens locais funcionam sem serviço externo. A publicação deve incluir os arquivos em `public/`, conforme `vercel.json`. |

Os 12 WebP atuais somam 925.324 bytes, aproximadamente 904 KiB. Isso mede apenas os retratos existentes. Fundos e áudio novos ainda não têm tamanho medido.

## Encaixe das sete sequências

Os códigos C00 a C06 organizam o roteiro; não precisam virar novos identificadores de save.

| Sequência | Gatilho existente | Execução proposta | Situação |
|---|---|---|---|
| C00, Posto Seis | `opening` ao abrir a campanha pela primeira vez | Rádio, quadro do posto e entrada de Vilar/Helena | Texto e retratos já suportados; fundo e efeitos são novos. |
| C01, estação | `before1`, `after1` e `choice-secondary` | Registro com horários, mapa simples e reação ao objetivo secundário | Preservar a escolha e consultar o resultado real do comboio/registros. |
| C02, Ivo | `before2`, `after2` | Retrato, interior sugerido de transporte e decisão de custódia | Não exige animar o caminhão no motor. |
| C03, contratos | `before3`, `after3` | Arquivo, sobreposição de documento e decisão de publicação | Os documentos já existem como texto; arte de papel pode ser decorativa. |
| C04, transmissão | `before4`, `after4` e `choice-channel` | Preparação da defesa e recibo condicionado ao canal | A transmissão continua decidida pela missão, não pelo tempo da cena. |
| C05, autorização | `before5`, `after5` | Arquivo protegido, documento e confirmação de saída | Evitar mostrar rendição de guarnição como mecânica: ela não é implementada. |
| C06, encerramento | `exposed`, `covered` ou `defeat` | Quadros finais com falas compatíveis com provas e custódia de Ivo | Usar `Story.ending`, sem criar outro cálculo de final. |

Não é necessário interromper o combate para executar essa versão. Os acontecimentos de campo podem continuar no HUD e no registro da missão. Transformá-los em cenas automáticas seria uma etapa separada, com estado persistente para impedir disparos repetidos.

## Implementação mínima recomendada

1. Associar um plano visual opcional a cada fala em `Story.scene`, mantendo os IDs existentes. Usar chaves locais de cenário e enquadramento; não aceitar URLs vindas de saves. Uma fala sem plano continua usando os retratos atuais.
2. Acrescentar uma camada de fundo em `.story-stage` e atualizá-la em `renderStoryScene`. Fazer aproximação e deslocamento dentro da imagem com CSS. Para uma primeira versão, basta corte ou fade curto. Não é preciso biblioteca, editor de timeline ou motor 3D.
3. Manter `Avançar`, `Pular conversa`, `Suspender`, `Histórico` e as escolhas. Os tempos do storyboard orientam a direção; não devem obrigar o leitor a esperar nem avançar o texto sozinho. Ao retomar, reconstruir o plano da fala salva desde o início.
4. Carregar apenas o cenário atual e, se necessário, o seguinte. Se uma imagem falhar, conservar texto, retratos e controles. Usar arquivos em `public/assets/story/`; os retratos atuais permanecem na pasta existente.
5. Entregar áudio como complemento. A abertura atual não chama `audio.unlock()` diretamente; eventual som precisa de uma interação válida do usuário e deve tolerar bloqueio de reprodução. Interromper o áudio ao pular, suspender, trocar cena ou abrir o diário.

O avanço manual permite usar o mesmo `scene.index` como posição narrativa e visual, evitando um segundo relógio persistido. Zoom e fade são efeitos de apresentação; não podem chamar `game.update`, conceder provas ou resolver missões.

## Pontos que precisam de cuidado

**Saves de cenas antigas.** `Story.validate` compara o índice salvo com a quantidade atual de falas (`public/js/story.js:69`). Encurtar uma cena pode invalidar um save. Reordenar suas falas pode retomar em um ponto errado mesmo com índice válido. A adoção do roteiro deve definir uma versão de conteúdo e migrar explicitamente cenas em andamento, por exemplo reiniciando apenas a conversa correspondente, conservando escolhas e ações pendentes. Apenas mudar os diálogos não garante compatibilidade.

**Diário.** O histórico guarda o ID da cena, e `showStoryDiary` regenera suas falas com o estado atual (`public/js/story-ui.js:88`). Uma reação dependente de uma escolha posterior pode aparecer numa conversa antiga. Para a primeira versão, escrever variantes com condições que já estejam definidas naquele momento e permaneçam estáveis. Se houver promessa de transcrição histórica exata entre versões do roteiro, será necessário guardar a variante ou o texto concluído e migrar o save.

**Pausa.** Existem duas variáveis relacionadas, `paused` na interface e `game.paused` no motor. As funções atuais coordenam diálogos e pausas anteriores. A camada visual deve usar esse fluxo, incluindo o caso de abrir o diário sobre a cena. Não atribuir `paused=false` ao terminar uma animação. A ação final da conversa precisa ocorrer uma única vez, inclusive com cliques rápidos.

**Escolhas e provas.** Preservar `Story.choose`, `Story.resolve` e `Story.ending` (`public/js/story.js:40`, `:49`, `:56`). As cenas não acrescentam recompensas. O final de exposição exige contratos, autorização, recibo civil e registros ou depoimento. Proteger Ivo e recuperar os registros são caminhos alternativos para essa última condição.

**Relação entre texto e missão.** O capítulo 1 não possui temporizador de apagamento de registros; sua cópia usa progresso de 60 segundos ativos ou duas rodadas e depende do objetivo secundário terminar. Não mostrar uma contagem regressiva de destruição sem criar a regra correspondente. No capítulo 5, embarque dos documentos, reserva inimiga e extração existem; rendição coletiva não existe (`public/js/missions.js:36`).

**Acessibilidade e telas pequenas.** Manter texto como HTML, nome do falante, foco visível, teclado e controles acessíveis. Não incorporar falas à arte. Fundos não devem reduzir contraste nem esconder escolhas. A cena já tem adaptação abaixo de 600 px (`public/css/style.css:206`); cenas com documento precisam também funcionar em 390 × 844. Movimento reduzido deve mostrar o quadro final estático, sem exigir término de animação para liberar os botões.

**Áudio.** O objeto `Sound` atual não é um player de dublagem com controle de faixas narrativas. Sons agendados e efeitos contínuos exigiriam cancelamento explícito. A versão inicial pode funcionar inteiramente silenciosa. Não há sincronização labial, gravações de voz ou trilha narrativa verificadas neste parecer.

## Alternativas de maior custo

| Formato | Avaliação |
|---|---|
| Retratos, ilustrações e pequenos movimentos | Recomendado. Reaproveita a interface e cobre o roteiro proposto. |
| Câmera sobre o campo com unidades em cena | Possível, mas exige controlar câmera, visão, entrada, pausa e restauração. `centerCamera` existe em `public/js/render.js:345`; não é um sistema de direção cinematográfica. O mapa procedural também impede garantir composição fixa. |
| Vídeos locais | Possível com elemento de vídeo, legendas e tratamento de carregamento/erro. Exige produzir vídeos, verificar tamanho e formatos, além de manter decisões em HTML. Não é necessário para esta campanha. |
| Cutscenes 3D com personagens animados | Não há base correspondente verificada neste projeto Canvas 2D. Exigiria outro pipeline de arte e animação. |

## Verificação e critérios de aceite

A análise dos recursos e das lacunas foi feita por leitura do código. Os comandos abaixo verificam o sistema atual; não validam cutscenes ainda não construídas:

- `node tests/story.test.cjs`: passou. Progressão, decisões, resultados únicos, saves e finais.
- `node tests/missions.test.cjs`: passou nos modos RTS e turnos. Objetivos, pausa e carga.
- `node tests/story.browser.test.cjs`: passou no Chrome headless, offline, com cenas, decisões, save e layouts 1280 × 720, 1920 × 1080 e 390 × 844.
- `node tests/story-flow.browser.test.cjs`: passou em RTS e turnos. Percurso dos cinco capítulos, decisões, save com Ivo embarcado e final de exposição.

O percurso de campanha usa combate controlado, incluindo remoção de inimigos e posicionamento de unidades. Ele verifica o fluxo e não comprova dificuldade, equilíbrio ou ritmo em uma partida completa.

Antes de integrar as novas cenas, acrescentar aos testes existentes estes casos: pular cada plano preserva a decisão; suspender e recarregar retoma a fala correta; saves anteriores migram sem perder provas; revisão do diário não aplica recompensas; áudio e animação param ao fechar; imagem ausente mantém controles; movimento reduzido funciona sem callbacks de animação; tempo, ondas e progresso da missão ficam parados durante a cena. Executar o percurso dos cinco capítulos nos dois modos e revisar visualmente as cenas com as artes definitivas.

A primeira implementação deve ser C00, seguida de C02 com a decisão sobre Ivo. Esses dois trechos cobrem abertura, retratos, cenários, suspensão e escolha. Depois de validar esse fluxo, aplicar o mesmo mecanismo às demais sequências.
