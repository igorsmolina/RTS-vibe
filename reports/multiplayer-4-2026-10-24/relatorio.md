# Multiplayer com 4 jogadores e transporte sem fila (24/10/2026)

## O que mudou

- **Quarto lado, Amarelo (`'gold'`).** A base fica no canto superior esquerdo (a verde espelhada no centro); o terreno de 3 lados já deixava esse canto limpo e ligado, então o mapa de 2 e 3 lados não mudou (hash de terreno, estruturas e unidades idêntico ao motor anterior em 4 mapas × 3 sementes). A facção padrão do amarelo é a roxa.
- **Sala de 2 a 4 jogadores** (`multiplayer-core.js`): o 5º recebe `room_full`; eliminação, vitória e revanche (os lados giram) funcionam com 4.
- **Saguão:** 4 cartões, cor amarela (`#f2cf3a`), textos "2 a 4 jogadores".
- **Sem fila de estados:**
  - **Servidor:** não manda estado novo a um jogador com mais de 1 MB parado no envio (`STATE_BACKLOG`). O estado é completo, então o próximo já traz tudo. Mensagens que não são estado nunca são puladas.
  - **Transporte P2P** (`p2p.js`): fila de saída própria; um estado ainda não enviado é trocado pelo mais novo; com o canal cheio (`bufferedAmount` acima de 256 KB) o estado espera `bufferedamountlow` (64 KB). Na entrada, de uma rajada de estados só o último é aplicado. A troca preserva o terreno do estado descartado (o núcleo só o manda quando muda). Os eventos visuais e sons do estado descartado se perdem de propósito.

## Medido

Núcleo do multiplayer (`createCore`, Node), 50 unidades por jogador em combate RTS, 600 ticks:

| Jogadores | Unidades | Tick p50 | Tick p95 | Tick máx. | Estado por jogador | Banda por jogador (sem compressão) |
|---|---:|---:|---:|---:|---:|---:|
| 2 | 116 | 1,1 ms | 2,1 ms | 6,1 ms | ~34 KB | 337 KB/s |
| 3 | 174 | 2,1 ms | 3,8 ms | 8,0 ms | ~34 KB | 336 KB/s |
| 4 | 232 | 3,8 ms | 6,2 ms | 10,8 ms | ~34 KB | 337 KB/s |

Estresse com servidor WebSocket real, clientes reais e 300 unidades em combate (`tests/multiplayer-load.browser.integration.cjs`, cliente no Chrome com CPU 4× mais lenta). O limite real é 50 tropas por jogador, então 300 unidades é o dobro do uso normal:

| | Antes (2 jogadores) | Depois (4 jogadores) |
|---|---:|---:|
| Unidades | 307 | 325 |
| Tick p95 / máx. | 12,8 / 25 ms | 16,2 / 41,3 ms |
| Estado p50 | 91,8 KB | 56,5 KB |
| Banda por jogador (descomprimida) | 926 KB/s | 587 KB/s |
| Quadro do cliente p95 / maior tarefa | 83,4 / 140 ms | 69,4 / 145 ms |
| Rajada de 30 estados atrasados (tempo bloqueado em `applyState`) | — | 56 ms sem coalescer, 2 ms com |

Com 4 jogadores cada um vê menos unidades dos outros por causa da névoa, então o estado de cada um é menor que com 2 jogadores e o mesmo número de unidades.

Testes novos: `tests/multiplayer-four.test.cjs` (9 verificações: 4 lados em 4 mapas × 3 sementes, caminho por terra de cada QG ao centro, 2 e 3 lados inalterados, sala de 4, eliminação, revanche, estado pulado com fila cheia, desempenho), `tests/p2p-backpressure.test.cjs` (9) e `tests/multiplayer-four.browser.integration.cjs` (4 navegadores, 5º recusado, compra, 3 desistências, vitória, revanche).

## Limites da medição

- **A causa do travamento foi inferida, não reproduzida.** Li o código e medi: a CPU do servidor sobra (tick p95 de 6 ms com 4 jogadores), mas o transporte P2P tinha fila sem limite nos dois lados. Não consegui reproduzir uma rede lenta real. O comportamento novo foi verificado com um canal falso (cheio, esvaziando, rajada), não com uma rede de verdade.
- **WebRTC entre máquinas diferentes não foi testado.** `p2p.browser.test.cjs` conecta duas abas na mesma máquina e passa; uma partida de 4 pessoas em computadores diferentes precisa ser confirmada por jogadores.
- **Eventos perdidos.** Quando um estado é descartado (rede lenta), os efeitos e sons dele não chegam. É só visual; o terreno e o estado do jogo não se perdem.
- **Quadros do cliente.** Com CPU 4× mais lenta e 300 unidades, o quadro p95 é 69 ms (meta de travada: 50). Isso vem do custo de desenhar, já era pior antes (83 ms) e não foi alterado aqui. Os avisos "METAS DE TRAVADA NÃO ATINGIDAS" do teste de carga continuam aparecendo.
- **Banda:** os valores são descomprimidos; o servidor WebSocket usa `permessage-deflate` (nível 1) e o canal P2P usa `deflate-raw` para textos acima de 1 KB, então o tráfego real é bem menor.
- **Cor amarela:** conferida só em captura de tela; fica distinta do bege dos postos neutros, mas é a mais próxima dele entre as cores de time.
