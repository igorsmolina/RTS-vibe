# Terrenos ilustrados naturais

As 11 peças foram geradas com a ferramenta integrada **ImageGen**, em vista ortográfica de cima, luz suave do canto superior esquerdo e paleta moderada. `prompts.json` registra a especificação de cada peça; `source/redesign/` guarda as fontes em alta resolução.

| Peça | Camada e uso |
|---|---|
| `plain.png`, `sand.png` | Solo contínuo: grama e areia |
| `forest.png`, `forest-desert.png` | Copas e arbustos, com alpha entre as formas |
| `mountain.png`, `mountain-desert.png` | Relevo rochoso, com alpha entre as formas |
| `water.png` | Superfície contínua de água, sem margens embutidas |
| `bank.png`, `bank-desert.png` | Material de solo das margens, recortado pelo Canvas |
| `road.png` | Material de terra compactada, recortado em caminhos conectados |
| `bridge.png` | Tablado vertical e corrimãos, com alpha ao redor |

## Composição

O solo se repete em coordenadas do mundo, sem reiniciar a textura a cada célula. Floresta e montanha são sobrepostas ao solo e suavizadas nas bordas; regiões do mesmo tipo compartilham o material. A vizinhança de oito direções define bordas e cantos convexos/côncavos. Água e ponte compartilham a mesma superfície; margens aparecem somente nas bordas externas. As 16 conexões cardinais de estrada cobrem segmentos, curvas, cruzamentos e pontas.

A variação decorativa usa um hash da semente e das coordenadas, sem chamar `game.rng()`. Transições e decorações ficam dentro da própria célula. Na vizinhança de casas desconhecidas, uma composição neutra cobre a faixa de transição; o ocultamento também cobre pixels das bordas em câmera fracionária. Assim, conexões não revelam terrenos sob a névoa.

A grade e os contornos de interação são camadas separadas. `Grade` / `G` salva sua preferência na chave `wargrid.grid.v1`, tolerando armazenamento bloqueado. A grade começa desligada em um navegador sem preferência anterior.

## Preparação e funcionamento offline

Execute `npm run prepare:terrain` para reduzir as fontes a **128 × 128** com o Canvas do Chrome, preservando alpha, e sincronizar a cópia em data URL no bloco `TERRAIN_ASSETS` de `js/assets.js`. Requer Node.js, Playwright Core e Google Chrome. `PLAYWRIGHT_MODULE` pode indicar uma instalação local existente.

Os bancos de margem agora são materiais de solo completos; não são mais faixas estreitas. O recorte da margem é responsabilidade do compositor. A aplicação abre por `file://` e não depende de servidores ou assets externos.

`terrainTopology(g,x,y)`, `terrainTile(g,x,y)` e `renderTerrain(ctx,g)` recebem o mapa explicitamente. A prévia do gerador usa a mesma composição. O minimapa usa cores simplificadas. O chão é armazenado em um Canvas; mudar a grade ou mover a câmera não o reconstrói. O cache de células tem limite de 1.024 entradas. Se uma imagem falhar, formas nativas mantêm o terreno opaco e o jogo funcionando.

## Verificação

- `npm test`: regras existentes dos modos turnos/RTS, geração, caminhos e classes de tanque.
- `npm run test:browser`: controles, câmera, mapas, texturas, fallback e funcionamento offline.
- `npm run test:terrain`: grade/persistência, composição determinística, alpha, água sem margens internas, névoa e armazenamento bloqueado.

A revisão visual usa cenários com células isoladas, regiões densas, diagonais, três terrenos juntos e pontes horizontais/verticais; inclui zoom 0,35×/1×/1,5× e celular.
