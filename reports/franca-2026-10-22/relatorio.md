# Azul (França): balanceamento e especialidade (22/10/2026)

Método: `scripts/faction-balance.cjs` (mesmo orçamento de 900 dos dois lados, preço pela ficha de cada facção, lados trocados). Cada célula é a vitória da primeira facção e, entre parênteses, o valor restante (% do investimento) de cada lado. Terreno plano, sem IA de alto nível: serve para comparar os times entre si, não para prever partidas.

## Antes e depois

| Composição | Antes (F×V / F×R) | Depois (F×V / F×R) | Meta |
|---|---|---|---|
| Infantaria | 100% / 100% | 69% / 69% | 60–80% |
| Antitanque + infantaria | 100% / 100% | 67% / 67% (3 sementes) | — |
| Infantaria embarcada (caminhão e NH90) | — | 100% / 100% | ≥ 65% |
| Tanques | 0% / 0% | 56% / 38% | 45–60% / 35–50% |
| Exército misto | 83% / 83% | 75% / 63% | 45–60% (ficou acima) |
| Apoio (artilharia, antiaéreo) | 67% / 50% | 56% / 38% | — |
| Blindados leves | 50% / 0% | 44% / 0% | — |
| Helicópteros | 50% / 17% | 31% / 13% | podem ser os mais fracos |
| Tigre sozinho | 0/6 (duelo) | 6% / 6% | tirar o 0 |

Controle: Verde×Vermelho nas mesmas composições não mudou além do ruído (infantaria 50%, tanques 31%).

## O que mudou (só ficha azul, `FR` em `public/js/engine.js`)

- **Infantaria:** dano 55 → 40; antitanque 60 → 100; metralhador 60 → 85; lançador 55 → 80.
- **Transporte:** TRM 115 → 100; NH90 230 → 210 (3 vagas a mais que o verde no TRM e 2 no NH90).
- **Tanques:** leve 95 → 100 de vida; médio 155 → 150 de custo e 155 → 160 de vida; pesado alcance 6 → 7, dano 75 e 3 mísseis antitanque (dano 45, alcance 10). VBL 65 → 75 de vida.
- **Tigre:** custo 245 → 235. Com 215 a França passava a vencer os helicópteros dos outros (88%), e como os helicópteros devem ficar os mais fracos o ajuste foi só esse.
- **Aviões:** Mirage IV 200 de vida e 100 flares (era 80); curva do Rafale 125 → 105°/s. Veja `relatorio-avioes.md`.
- **Habilidades novas:** desembarque de assalto, captura e obra 30% mais rápidas, evacuação blindada.

## Limites da medição

- O ordenamento "Verde melhor em aviões" não aparece no simulador: o caça e o furtivo vermelhos vencem os verdes. Isso já era assim antes e não foi alterado; a França ficou no nível do Verde no caça e no furtivo, e perto do Vermelho no multifunção e no bombardeiro (ver `relatorio-avioes.md`).
- O bombardeiro vermelho tem casco 100 e 48 bombas por 1164 créditos (dano esperado por crédito 3,0 contra 0,72 do verde). Parece engano de digitação e não foi mexido.
- O exército misto da França ainda vence 75% do Verde, acima da meta. Se quiser reduzir, o ajuste mais direto é subir o antitanque ou o pesado em ~10 créditos.
- O simulador não usa a IA nem o terreno real; a dificuldade percebida só se confirma com partidas humanas.
