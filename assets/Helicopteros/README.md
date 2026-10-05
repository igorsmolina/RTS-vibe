# Helicópteros — pacote de arte

Arte criada com **ImageGen integrado**, em perspectiva ortográfica superior, com alpha real. Este pacote contém somente sprites e documentação; a integração jogável está descrita em [IMPLEMENTACAO.md](../../docs/helicopteros/IMPLEMENTACAO.md).

| Arquivo | Modelo | Equipe | Coluna / linha do atlas |
|---|---|---|---|
| standard-blue.png | Padrão; metralhadora, sem mísseis | Aliada, verde/oliva | 0 / 0 |
| air-ground-blue.png | Ar-terra; seis mísseis curtos robustos | Aliada, verde/oliva | 1 / 0 |
| air-air-blue.png | Ar-ar; quatro mísseis longos com aletas | Aliada, verde/oliva | 2 / 0 |
| standard-red.png | Padrão | Inimiga, vermelha | 0 / 1 |
| air-ground-red.png | Ar-terra | Inimiga, vermelha | 1 / 1 |
| air-air-red.png | Ar-ar | Inimiga, vermelha | 2 / 1 |

O sufixo blue corresponde ao lado aliado do motor; a pintura verde/oliva acompanha os tanques existentes. Cada PNG preparado mede **128 × 128**. helicopters-atlas.png mede **384 × 256**, com três colunas e duas linhas. Todos os modelos apontam para o norte, têm metralhadora frontal e rotor estático incluído. As imagens não contêm fundo, quadriculado, texto ou sombra sobre terreno.

source/*-imagegen.png preserva as seis fontes originais em alta resolução. prompts.json registra os prompts completos, as referências de edição, os nomes dos arquivos e a posição de cada frame. O modelo padrão aliado serviu de base para as variantes e cores; a versão inimiga de cada especialização foi editada a partir da correspondente aliada.

## Preparação

Com Node.js, Google Chrome e Playwright do projeto, execute a partir da raiz:

    node assets/Helicopteros/prepare.cjs

PLAYWRIGHT_MODULE pode indicar uma instalação local de Playwright existente. O script calcula um **recorte normalizado comum às seis fontes**, reduz proporcionalmente para a área de até 116 × 116 dentro de cada frame e conserva alpha parcial nas bordas. Não altera js/assets.js, o motor ou outros arquivos do jogo. Escreve somente neste pacote e em docs/helicopteros/.

O script também monta pranchas sobre a composição real dos terrenos do projeto. Em uma pasta temporária, WAR_GRID_PROJECT pode indicar a raiz do jogo para essa revisão. Não regenera arte; regeneração exige ImageGen.

## Revisão

`node assets/Helicopteros/prepare.cjs` grava a prancha dos seis modelos, a leitura sobre terrenos em 48/60 px e as medidas de alpha, dimensões e escala em `test-output/helicopteros/` (fora do git).

As pranchas de revisão possuem fundo para comparar o contraste; os PNGs individuais e o atlas têm alpha transparente.

## Integração

O atlas está incorporado como data URL no bloco `HELI_ASSETS` de `js/assets.js` e é usado por campo, recrutamento e retrato (`heliAtlas` em `js/render.js`). Se ele falhar, um desenho em Canvas diferencia os três modelos (casulos de foguetes no ar-terra, mísseis longos no ar-ar) e as equipes. Após trocar a arte, reexecute a preparação e substitua o conteúdo entre `// HELI_ASSETS_BEGIN` e `// HELI_ASSETS_END` pelo novo `helicopters-atlas.png` em base64.
