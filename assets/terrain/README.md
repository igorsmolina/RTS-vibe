# Texturas do War Grid

As seis imagens do usuário foram adaptadas com o ImageGen integrado, preservando a ilustração vista de cima. Os prompts completos e a associação dos arquivos estão em `prompts.json`.

| Arquivos preparados | Uso |
|---|---|
| `plain.png`, `forest.png`, `mountain.png` | Terrenos verdes |
| `sand.png`, `forest-desert.png`, `mountain-desert.png` | Terrenos arenosos |
| `water.png` | Água contínua, sem margens embutidas |
| `road.png` | Material da estrada; as 16 conexões são compostas e armazenadas no Canvas |
| `bridge.png` | Piso transparente, orientado pelos acessos |
| `bank.png`, `bank-desert.png` | Margens transparentes dos dois biomas |

Todas as peças têm 128 × 128 pixels. Margens ocupam uma faixa no topo da peça, permitindo rotação nos quatro lados. Estrada e ponte têm transparência ao redor do piso. As margens só aparecem junto a terrenos terrestres; a água também continua sob as pontes.

`source/original-*.jpg` preserva as seis imagens recebidas. Os demais arquivos de `source/` são as versões preparadas com ImageGen, em alta resolução.

Para reconstruir as peças e sua cópia em `js/assets.js`, execute `npm run prepare:terrain` na raiz. O jogo usa essa cópia em data URL porque, aberto via `file://`, o Canvas não lê pixels de PNGs carregados por caminho. Requer Node.js, a dependência de desenvolvimento Playwright Core e Chrome. `PLAYWRIGHT_MODULE` pode indicar uma instalação local existente. O script reduz as imagens com o Canvas do navegador, preserva alpha e alinha a margem ao topo.

O jogo usa cache de terreno e desenhos alternativos enquanto as imagens carregam ou se a decodificação falhar. O carregamento das texturas redesenha apenas o chão e o minimapa. Não modifica o motor, as sementes, os caminhos ou os efeitos da partida.

Validação: `npm test` e `npm run test:browser` (o teste de navegador cobre texturas, conexões, biomas e falha de imagem).
