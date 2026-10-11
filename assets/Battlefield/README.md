# Campo de batalha

Nove assets gerados em 10/10/2026 com a ferramenta integrada `image_gen`, usando `transparent_background: true`. Luz natural do canto superior esquerdo; materiais militares neutros. Não há identificação de equipe pintada nas imagens.

- `hq.png` e `post.png`: 512 × 512, revisados em 10/10/2026. QG com prédio de comando, antenas e pátio para 3 × 3 casas; posto fortificado com rádio, sacos de areia e pátio para 2 × 2 casas. Miniaturas e prévias continuam usando os assets legados.
- `cloud-soft.png`, `cloud-long.png` e `cloud-wisps.png`: 384 × 192, com margens transparentes e bordas semitransparentes.
- `forest.png`, `forest-desert.png`, `mountain.png` e `mountain-desert.png`: 128 × 128. Materiais de copas e rochas com alfa nos vãos para sobrepor ao solo existente.
- `sources/`: os nove PNGs originais preservados.

Execute `node scripts/prepare-battlefield.cjs` para redimensionar via Canvas no Chrome já usado pelo projeto, conferir alfa e incorporar `battlefieldData` no bloco `BATTLEFIELD_ASSETS` de `public/js/assets.js`. Não são usadas dependências novas. O preparo apenas redimensiona as imagens e ajusta o enquadramento das nuvens; não altera a arte nem redesenha pixels.

O bloco separado preserva os dados antigos e permite abrir o jogo por duplo clique, sem rede. Os materiais têm distribuição repetível de detalhes; o renderer pode variar rotação/espelhamento pela semente para disfarçar repetição. Os PNGs não prometem bordas matematicamente idênticas.
