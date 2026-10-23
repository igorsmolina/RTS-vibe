# Roxo (transporte pesado): balanceamento e especialidade (22/10/2026)

Método: o mesmo da França. `scripts/faction-balance.cjs` com mesmo orçamento de 900 dos dois lados, preço pela ficha de cada facção, lados trocados e várias sementes; `--pairs PV,PR,PF,VR` mede Roxo×Verde, Roxo×Vermelho, Roxo×França e o controle Verde×Vermelho; `--out reports/roxo-2026-10-22` grava aqui. Cada célula é a vitória da primeira facção e, entre parênteses, o valor restante (% do investimento) de cada lado. Terreno plano, sem IA de alto nível: serve para comparar os times entre si, não para prever partidas. Aviões e transporte têm relatórios próprios (`relatorio-avioes.md`, `relatorio-transporte.md`).

A medição inicial ("antes") usou os valores de partida: ficha base Verde com sensores (+1 de visão nos tanques, no antiaéreo e no batedor) e vida um pouco menor (leve 100, médio 160, pesado 265, antiaéreo 65, batedor 70), preços iguais aos do Verde. O ajuste ("depois") foi feito pelo simulador, em 78 rodadas de um parâmetro por vez (`rodadas-solo.md`, e as rodadas de aviões em `relatorio-avioes.md`).

## Antes e depois (6 sementes × 2 lados = 12 duelos por célula)

| Composição | Antes (P×V / P×R / P×F) | Depois (P×V / P×R / P×F) | Meta |
|---|---|---|---|
| Infantaria | 50% / 50% / 33% | 50% / 50% / 33% | 45–60% contra Verde e Vermelho: **atingida**; contra a França 33%: **não atingida** (ver abaixo) |
| Tanques | 58% / 17% / 25% | 58% / 42% / 33% | 45–60% contra o Verde, 35–50% contra o Vermelho: **atingidas** |
| Exército misto | 50% / 67% / 33% | 50% / 42% / 42% | — |
| Apoio (artilharia, antiaéreo) | 67% / 54% / 33% | 67% / 42% / 67% | — |
| Reconhecimento | 58% / 83% / 58% | 50% / 75% / 58% | — |
| Blindados leves | 25% / 0% / 75% | 75% / 0% / 100% | — |
| Helicópteros | 50% / 8% / 67% | 50% / 8% / 67% | podem ser os mais fracos |
| Antitanque | 50% / 50% / 17% | 50% / 50% / 17% | — |
| Infantaria no convertiplano | 95% / 95% / 15% | 95% / 95% / 15% | ≥ 55% contra Verde e Vermelho, ≤ ~75% contra a França: **atingida** |

Controle: Verde×Vermelho nas mesmas composições não mudou (infantaria 50%, tanques 17%, misto 67%, apoio 50%, reconhecimento 83%, antitanque 50%, nas duas tabelas). Verde e Vermelho não foram tocados: o `diff` do `engine.js` contra a cópia anterior ao balanceamento mostra só linhas do Roxo (`PURPLE`, os quatro `*Roxo` de `PLANE_MODELS` e as curvas deles em `planeTurnRate`).

## O que mudou (só ficha roxa, `PURPLE` e aviões roxos em `public/js/engine.js`)

- **Tanques:** leve vida 100 → 140; médio vida 160 → 195. Medido: com a ficha inicial a composição de tanques roxos vencia o Vermelho em só 17% (o Verde também: 17%); com leve 140 e médio 195 sobe para 42%, dentro da meta de 35–50%, e contra o Verde fica em 58% (meta 45–60%).
- **Artilharia:** vida 100 → 90 (ficha de apoio abaixo da Verde). Efeito medido no apoio: 54% → 42% contra o Vermelho.
- **Batedor:** vida 70 → 65. Efeito medido no reconhecimento: 83% → 75% contra o Vermelho, 58% → 50% contra o Verde.
- **Aviões** (detalhe em `relatorio-avioes.md`): caça vida 145 → 165 e curva 115 → 100°/s; multifunção vida 175 → 165 e curva 115 → 105°/s; furtivo curva 120 → 102°/s; bombardeiro vida 260 → 195. Os custos não mudaram (615 / 800 / 990 / 1276, todos dentro de ±10% do Verde).
- **Sem mudança nas habilidades nem nos transportes**: convertiplano (280, 10 vagas, vel. 4, Mov 12) e cargueiro a jato (16 vagas, vel. 5,5, taxa 220) ficaram como no ponto de partida.
- **Habilidades exclusivas (código, Tarefa 3):** remuniciar a bordo e desembarque rápido (ver `unidades.md`).

## O que não ficou como planejado

- **Infantaria contra a França: 33%.** A meta "45–60% contra os outros" é inviável contra a França sem tornar o Roxo mais forte que o Verde e o Vermelho: a infantaria francesa (dano 40, 69% contra Verde e Vermelho no relatório da França) é a especialidade dela. Priorizei Verde e Vermelho, como o plano previa. Contra a França o Roxo fica abaixo de 50% em infantaria (33%), tanques (33%), misto (42%) e antitanque (17%).
- **Caça contra o Vermelho: 0,10 (meta 0,85–1,05).** No simulador o caça vermelho vence o verde (eficácia por crédito do Verde sobre o Vermelho: 0,11; comportamento anterior a este trabalho, já descrito no relatório da França). "Abaixo do Verde e perto do Vermelho" não pode valer ao mesmo tempo para o caça: um caça perto do vermelho estaria muito acima do verde. Priorizei "abaixo do Verde" (Roxo/Verde 0,46). Multifunção (0,95), furtivo (0,91) e bombardeiro (0,92) ficaram na faixa do Vermelho.
- **Convertiplano 95% contra Verde e Vermelho.** Está longe dos 55% mínimos, mas é a especialidade do time (cargo); a meta de ≤ ~75% vale só contra a França (15%, cumprida). Ver limites no relatório de transporte.
- **Meta "Verde acima do Vermelho nos aviões" não aparece no simulador** (o caça vermelho vence o verde; já era assim antes).

## Limites da medição

- **Medido** (simulador, determinístico, sem IA nem terreno): vitórias e valor restante por composição; índice analítico e duelos 1×1 dos aviões; bombardeiro contra defesa antiaérea terrestre.
- **Suposto, não medido:** o efeito das duas habilidades do Roxo (remuniciar a bordo, desembarque rápido): o duelo as ignora (as tropas já saem com o máximo de mísseis e o script manda parar antes de desembarcar). O **cargueiro a jato não é simulado**: comparado só por custo por vaga da taxa de lançamento (Verde 150/12 = 12,5, França 150/10 = 15, Roxo 220/16 = 13,75). Se 220 "paga" a capacidade extra é uma suposição.
- O convertiplano compra 8 tropas a 900 de orçamento, não 10: as 10 vagas só aparecem com mais dinheiro.
- Mudar a defesa antiaérea do teste do bombardeiro (agora a média inclui defensores roxos) muda o V/R do bombardeiro de 1,15 (relatório da França, defesas Verde/Vermelho/França) para 0,97: não é uma mudança no Verde nem no Vermelho.
- O bombardeiro vermelho tem casco 100 e 48 bombas por 1164 créditos (dano esperado por crédito 3,0 contra 0,73 do roxo e 0,72 do verde). Parece engano de digitação e não foi mexido.
- Seis sementes por célula: variações de ±6 pontos entre rodadas são ruído. A dificuldade percebida só se confirma com partidas humanas.
- Partidas de IA de 150 s com o Roxo contra cada time, em três mapas, estão em `ia.json` (sem exceção; é teste de robustez, não de equilíbrio).

## Partidas de IA com o Roxo (`tests/roxo-ai-sim.cjs`, resultado em `ia.json`)

18 partidas RTS de 150 s: três mapas (river, desert, mountain) × três adversários (Verde, Vermelho, França) × Roxo como IA (lado vermelho) e Roxo como lado azul parado, com a IA vermelha contra ele. Resultado: **18/18 sem exceção**; toda unidade do lado roxo tem a facção roxa, os aviões comprados são roxos e a IA tomou entre 900 e 1160 decisões por partida.

Limites: o lado humano não joga, então a IA roxa faz exatamente o mesmo contra os três adversários (mesma composição inicial: comandante, engenheiros, antitanque, metralhador, lançador, drone e 1 a 2 infantarias) e nenhuma partida acabou em 150 s. Nesse tempo a IA ainda não comprou aviões nem transportes (créditos restantes 49 a 75); a compra de aviões roxos é testada à parte em `tests/roxo.test.cjs` (20 mil créditos e um aeroporto). Isto é teste de robustez, não de qualidade da IA.
