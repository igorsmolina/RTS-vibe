# Revisão do redesign de terreno — 02/10/2026

Arte natural produzida com **ImageGen integrado**, com solo contínuo, vegetação/relevo em alpha, transições por oito vizinhos e grade opcional. As regras e o gerador em `js/engine.js` permanecem byte a byte idênticos à versão anterior.

## Imagens revisadas

[Mapa procedural, semente 83](procedural.jpg), [transições verdes](transitions-green.jpg), [transições desérticas](transitions-desert.jpg), [zoom mínimo](zoom-min.jpg), [zoom normal](zoom-normal.jpg), [zoom máximo](zoom-max.jpg) e [celular](mobile.jpg).

Os dois cenários de transição foram montados somente para revisão: incluem regiões densas, células isoladas, contato diagonal, reentrâncias, encontro de floresta/planície/estrada e pontes nas duas orientações. Não alteram os mapas do jogo. Foram conferidas continuidade, transparência, leitura das tropas e ausência da antiga grade embutida.

## Desempenho local

Chrome headless, 1440 × 1000, mapa procedural semente 83. Medianas do mesmo procedimento nas duas versões:

| Operação | Antes | Depois |
|---|---:|---:|
| Construir chão com cache vazio | 27,1 ms | 105,0 ms |
| Reconstruir chão com peças em cache | 3,1 ms | 3,6 ms |
| Desenhar quadro com chão em cache | 0,1 ms | 0,1 ms |
| Desenhar prévia | 0,2 ms | 4,1 ms |

A primeira composição custa mais por criar as máscaras e peças conectadas; isso ocorre ao preparar uma topologia ainda não armazenada. O quadro normal usa o chão já composto. A prévia agora desenha a arte completa. Os valores de 0,1 ms têm precisão limitada pelo relógio do navegador e não representam uma promessa de FPS em outras máquinas. Dados e amostras em [performance.json](performance.json).

## Verificações

`npm test`: 27 verificações por turnos, 14 de RTS e verificações das três classes de tanque nos dois modos.

`npm run test:browser`: controles, câmera, gerador, recrutas, atlas, texturas, fallback, quatro mapas e tamanhos desktop/celular, com a rede bloqueada.

`npm run test:terrain`: grade/persistência, composição determinística sem consumo de RNG, transparência, água contínua, preservação de células vizinhas, cinco tipos junto a terreno desconhecido com/sem imagens e armazenamento bloqueado.

O teste de câmera calcula o deslocamento limitado pelo tamanho atual do campo, evitando presumir que a câmera já esteja encostada no limite inferior.
