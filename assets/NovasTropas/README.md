# Novas tropas — imagens

Imagens da artilharia de mísseis e do drone de reconhecimento. As duas unidades estão integradas ao jogo (`rocketArtillery` e `reconDrone` em `public/js/engine.js`); `npm run prepare:new-troops` incorpora estes PNGs em `public/js/assets.js` para uso offline.

Arquivos finais em PNG RGBA de 128 × 128 pixels, com transparência real e frente voltada para cima:

| Unidade | Aliada verde/oliva | Inimiga vermelha |
|---|---|---|
| Artilharia de mísseis | [Verde/oliva](rocket-artillery-ally.png) | [Vermelha](rocket-artillery-enemy.png) |
| Drone de reconhecimento | [Verde/oliva](recon-drone-ally.png) | [Vermelha](recon-drone-enemy.png) |

Os originais gerados com ImageGen ficam em `sources/`, com os mesmos nomes. Os prompts de criação e edição ficam em `prompts.json`.

A exportação grava em `test-output/novas-tropas/` (fora do git) uma prévia das quatro imagens, com leitura em 56 × 56 pixels sobre grama, floresta, montanha e deserto, e `validation.json` com dimensões, transparência e limites do recorte. O quadriculado está somente na prévia de conferência; não faz parte dos sprites.

A exportação recorta pelo alfa e reduz a imagem proporcionalmente, com margem transparente. Não altera a arte. Para refazer a exportação com o Chrome e o `playwright-core` já disponíveis no projeto, execute `node assets/NovasTropas/prepare.cjs` na raiz.

Conferência visual concluída em 56 × 56 nos quatro terrenos: frente para cima, cores de equipe distintas, artilharia com seis rodas e dois módulos, e drone sem armamento. O contorno do drone foi reforçado com ImageGen após a primeira revisão para melhorar a leitura sobre floresta e montanha. Detalhes menores, como o sensor, aparecem melhor na versão de 128 × 128.

Os comportamentos das duas unidades estão descritos no Manual de campo; o equilíbrio continua provisório.

## Animação dos lançadores

Transporte → transição → elevado durante a salva → transição → transporte. Subida e recolhimento levam 0,35 s de simulação cada, com o caminhão parado; pausa e velocidade controlam o progresso. Cancelar no RTS interrompe os mísseis restantes e recolhe antes de cumprir a próxima ordem. Movimento reduzido mostra somente o estado estático; falha de uma imagem retorna à arte de transporte.

| Quadro | Aliado | Inimigo |
|---|---|---|
| Transição | [PNG](rocket-artillery-ally-launch-transition.png) | [PNG](rocket-artillery-enemy-launch-transition.png) |
| Elevado | [PNG](rocket-artillery-ally-launch-ready.png) | [PNG](rocket-artillery-enemy-launch-ready.png) |

Fontes em alta resolução e prompts foram preservados. A exportação dos novos quadros usa a mesma escala e enquadramento do quadro aliado elevado. Execute `node tests/rocket-animation.browser.test.cjs` para verificar os quadros, pausa, grupos, velocidade, modos, falhas e captura dos quatro mapas em computador e celular. Capturas ficam em `test-output/rocket-animation/`.
