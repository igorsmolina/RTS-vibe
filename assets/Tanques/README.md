# Arte dos tanques

A partir dos seis sprites fornecidos (JPGs removidos do repositório após a preparação), o ImageGen integrado editou cada modelo separadamente: removeu fundos quadriculados/pretos, corrigiu a perspectiva para vista ortográfica superior, alinhou o canhão ao norte e reforçou contraste e contornos. Aliados mantêm verde/oliva; inimigos, vermelho. Não foi usado o fallback CLI.

- `light-blue.png`, `light-red.png`: tanque leve.
- `medium-blue.png`, `medium-red.png`: tanque médio (`tank`).
- `heavy-blue.png`, `heavy-red.png`: tanque pesado.
- `tanks-atlas.png`: 384 × 256, três colunas leve/médio/pesado; linha 0 aliados, linha 1 inimigos.
- `source/*-imagegen.png`: seis saídas em alta resolução com alpha original.
- `prompts.json`: prompt completo, fonte e posição no atlas.

Os PNGs preparados têm 128 × 128 e transparência real. A preparação recorta o limite do alpha e ajusta proporcionalmente dentro de 116 × 116, sem deformar o modelo nem cortar o canhão. Bordas suavizadas mantêm alpha parcial; cantos e fundo têm alpha zero. O atlas é incorporado como data URL em `js/assets.js`; a execução offline não depende de carregar esses PNGs por caminho.

```sh
npm run prepare:tanks
```

Requer Chrome e a dependência de desenvolvimento Playwright já usada no projeto. `PLAYWRIGHT_MODULE` permite apontar para uma instalação existente. O script apenas redimensiona e monta o atlas; não regenera arte. Para trocar a arte, prepare a nova versão com ImageGen e atualize a fonte em `prompts.json`.

O campo usa tamanhos relativos de 48/54/60 antes da escala de desenho 0,86. Recrutamento e seleção usam a mesma função de desenho, rotação, deslocamento de disparo e cache. Se o atlas falhar, os três tamanhos recebem o desenho alternativo de tanque nas respectivas cores.

Veja [atributos e resultados](../../docs/tanks/README.md).
