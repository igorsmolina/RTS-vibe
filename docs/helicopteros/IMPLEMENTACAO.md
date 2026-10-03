# Prompt para implementar helicópteros no War Grid

Atue como desenvolvedor sênior de jogos 2D em JavaScript ES6 e HTML5 Canvas. Implemente três unidades de helicóptero no projeto existente War Grid, nos modos por turnos e RTS. A arte já foi entregue em assets/Helicopteros/. Inspecione a versão atual antes de editar: existem alterações locais que devem ser preservadas. Não faça commit, push, reset ou descarte de alterações sem autorização explícita para aquela operação.

## Arquitetura e assets

O projeto roda offline e por file://, com arquivos separados. Reutilize js/engine.js, js/render.js, js/ui.js e js/assets.js, o carregamento atual de atlas, o cache de sprites e os controles existentes. Não redesenhe o layout geral, não adicione dependências de execução ou assets externos. Leia os scripts e testes reais; não presuma que o motor ainda esteja dentro do HTML.

Use os tipos helicopter, helicopterGround e helicopterAir, identificados como unidades aéreas por uma propriedade explícita air:true. O atlas assets/Helicopteros/helicopters-atlas.png tem 384 × 256: colunas 0/1/2 = padrão/ar-terra/ar-ar; linhas 0/1 = aliados verde-oliva/inimigos vermelhos. Cada frame mede 128 × 128 e aponta para o norte. Os seis PNGs individuais e as fontes estão documentados no README da pasta. Incorpore o atlas como data URL em js/assets.js para funcionar sem rede. Use rotação e dimensionamento proporcionais; mantenha o rotor estático do sprite, sem recortar sua extensão. Recrutamento, retrato e campo devem compartilhar o mesmo desenho. Implemente um desenho Canvas alternativo que diferencie os três modelos e as equipes se o atlas falhar.

## Valores iniciais provisórios

Estes valores são uma base de implementação, NÃO balanceamento validado. Registre os resultados dos testes e peça aprovação antes de alterar os números acordados.

| Tipo | HP | Movimento por turno | Velocidade RTS | Visão | Custo | Produção turnos / RTS |
|---|---:|---:|---:|---:|---:|---:|
| helicopter | 120 | 6 | 2,2 células/s | 6 | 150 | 3 / 30 s |
| helicopterGround | 120 | 6 | 2,2 células/s | 6 | 230 | 4 / 40 s |
| helicopterAir | 120 | 6 | 2,2 células/s | 6 | 240 | 4 / 40 s |

Use recompensa de 50 créditos por helicóptero destruído; preserve promoção, aura, experiência, renda e regras existentes para todas as classes. Todos possuem metralhadora frontal. Somente os especializados possuem arma secundária.

| Arma | Dano base | Alcance | Precisão base | Recarga RTS |
|---|---:|---:|---:|---:|
| Metralhadora | 20 | 3 casas | 85% | 1 s |
| Míssil ar-terra | 65 | 5 casas | 85% | 3 s |
| Míssil ar-ar | 70 | 6 casas | 90% | 3 s |

Alcance mínimo zero. Use a métrica de distância já adotada pelo motor. Aplique os modificadores atuais de precisão, aura e veterania uma única vez, mantendo os limites atuais. O dano de cada arma é individual, sem rajada ou área.

## Voo e ocupação

Helicópteros atravessam todos os terrenos, inclusive água e montanhas. O custo aéreo é sempre 1 por célula: não recebem bônus de estrada, penalidade de floresta, cobertura de terreno nem aumento de visão ou alcance nas montanhas. Minas e explosões terrestres não afetam a camada aérea.

Separe ocupação e reservas por camada. Uma unidade aérea e uma terrestre podem compartilhar casa, inclusive sobre estruturas; duas unidades aéreas não podem ocupar ou reservar a mesma casa. Preserve reservas da origem e destino dos segmentos para impedir sobreposição ou troca simultânea inválida. A* deve considerar as restrições da camada solicitante, e grupos mistos devem distribuir destinos por camada. A saída de produção aérea só é bloqueada por aeronaves; uma produção pronta espera uma casa aérea válida, sem nova cobrança nem duplicação. Não altere as regras de saída das unidades terrestres.

Atualize seleção, identificação do alvo e ordens para que ambas as camadas possam ser selecionadas quando compartilham casa. Use clique repetido para alternar entre unidades na mesma casa, com indicação do alvo atual; a seleção em caixa inclui aliados das duas camadas. Preserve ordens no celular, grupos, minimapa, contornos e pausa tática. Não revele unidades inimigas fora da visão atual.

## Armas e alvos

Metralhadoras de helicóptero atingem unidades terrestres, estruturas inimigas e helicópteros. Multiplique seu dano por 0,35 contra veículos TERRESTRES e 0,5 contra estruturas; use dano normal contra helicópteros e tropas a pé.

Mísseis ar-terra atingem somente alvos terrestres: dano ×1,5 contra veículos terrestres, ×0,5 contra tropas a pé e ×1 contra estruturas. Mísseis ar-ar atingem EXCLUSIVAMENTE helicópteros inimigos. Nunca aceite ataques contra aliados, alvos neutros, mortos ou fora da visão. O primeiro disparo pode usar a arma selecionada se a recarga comum estiver livre.

Nas variantes especializadas, ofereça botões acessíveis para Auto, Metralhadora e seu respectivo Míssil, mostrando arma ativa, alcance e recarga. O modo inicial é Auto. Nesse modo, ar-terra prioriza míssil contra veículos/estruturas terrestres e metralhadora contra os demais alvos; ar-ar prioriza míssil contra helicópteros e metralhadora contra o solo. A escolha manual deve ser respeitada; rejeite alvos incompatíveis sem consumir ação ou créditos. A aproximação para atacar deve usar o alcance da arma realmente escolhida.

Em turnos, disparar qualquer arma gasta a única ação. Alternar arma não devolve a ação. Preserve o movimento restante permitido pelo modo por turnos. No RTS, as duas armas compartilham um único temporizador: o disparo estabelece 1 s ou 3 s conforme a arma; alternar arma não zera o tempo nem permite dois disparos simultâneos. O projétil guarda o tipo de arma, dano e alvo do disparo, mesmo que a seleção seja alterada antes do impacto. Dano ocorre no impacto; alvo destruído anteriormente não gera dano ou recompensa duplicada. Mísseis não causam AoE ou fogo amigo.

Infantaria e metralhadores podem atacar helicópteros usando suas armas, atributos e cadências existentes. Tanques, antitanque, artilharia, batedores, engenheiros, comandantes e demais classes terrestres não podem atacá-los. A restrição deve valer para ataque manual, automático, IA, validação e impacto. Engenheiros podem REPARAR helicópteros aliados dentro da distância de reparo existente (até uma casa, inclusive compartilhando a casa), preservando o valor e a duração de reparo de cada modo. Helicópteros não capturam postos, constroem, transportam unidades ou usam combustível.

## Produção, IA e efeitos

Inclua os três modelos no recrutamento do QG, fila, progresso, informações e manual. Preserve desconto único, fila serial, bloqueio de saída e pausa completa. A IA pode recrutar padrão para apoio/reconhecimento, ar-terra contra forças terrestres mecanizadas e ar-ar contra helicópteros inimigos visíveis; não use conhecimento de unidades ocultas para escolher alvos. Reutilize orçamento e retirada atuais. Na microgestão, respeite a prioridade de armas Auto e a recarga comum.

Desenhe aeronaves acima das tropas terrestres e mantenha HP, seleção, ordens e fog legíveis. Use efeitos e áudio sintetizado existentes: traçantes para metralhadora, mísseis visíveis para armas secundárias, explosão e registro de dano/destruição. A destruição aérea não causa dano de queda ao solo. Nenhuma mecânica de pouso, altitude variável, munição limitada, combustível ou transporte nesta versão.

## Testes e entrega

Execute os testes existentes do motor e navegador nos dois modos. Acrescente testes comportamentais para: travessia de água/montanha e custo constante; ocupação solo/ar e reservas aéreas concorrentes; grupos mistos; produção com saída aérea bloqueada; matriz de alvos de todas as armas; modificadores de dano; ação única por turno; recarga comum sem exploração por troca de arma; munição em voo preservando o disparo; reparo; imunidade a minas/AoE terrestre; seleção nas duas camadas; névoa; IA; pausa congelando voo, disparos, produção e reparo; fallback do atlas e operação por file:// sem rede.

Confira as seis artes em campo, recrutamento e retrato, nos quatro terrenos e em desktop/celular. Entregue os arquivos alterados, descrição das regras implementadas e evidências dos testes. Diferencie cobertura automatizada de avaliação visual e de balanceamento de partidas completas. Não afirme que os atributos estão equilibrados sem esse último teste. Preserve a geração procedural e a sequência aleatória em renderizações e carregamentos. Finalize com as alterações locais disponíveis para revisão, sem commit ou push.
