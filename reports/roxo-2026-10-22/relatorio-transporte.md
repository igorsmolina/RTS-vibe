# Roxo: infantaria embarcada contra Verde, Vermelho e França (22/10/2026)

Comando: `node scripts/faction-balance.cjs --transport --pairs PV,PR,PF,VR --seeds 10 --label transporte-antes --out reports/roxo-2026-10-22` (e `transporte-depois`). 20 duelos por célula, orçamento 900 já com os veículos, lados trocados.
Cada lado compra tropas a pé em ciclo (fuzileiro, antitanque, fuzileiro, metralhador, fuzileiro) enquanto tropas + veículos (`ceil(n/capacidade)`) couberem em 900. A infantaria começa embarcada, os veículos andam até ~8 casas do inimigo, param, desembarcam e todos lutam. Mesmo script e mesmo cenário do relatório da França (`reports/franca-2026-10-22/relatorio-transporte.md`).

| Cenário | Roxo×Verde | Roxo×Vermelho | Roxo×França | Verde×Vermelho (controle) |
|---|---|---|---|---|
| Caminhão roxo (custo 100, 4 vagas, igual ao Verde), antes | 50% (valor restante 14/14) | 50% (13/11) | 0% (4/59) | 50% (13/11) |
| Caminhão roxo, depois | igual: nenhum ajuste necessário | igual | igual | igual |
| Convertiplano (custo 280, 10 vagas, vel. 4, Mov 12), antes | 95% (48/25) | 95% (48/25) | 15% (34/40) | 50% (44/44) |
| Convertiplano, depois | igual: nenhum ajuste necessário | igual | igual | igual |

Metas: infantaria embarcada no Roxo melhor que nos outros transportes por causa da capacidade (≥ 55% contra Verde e Vermelho) e sem passar de ~75% contra a França. **Atingidas sem mexer em `PURPLE.transportHelicopter`**: 95% contra Verde e Vermelho, 15% contra a França.

## Composição dos exércitos (convertiplano)

Medido com a mesma regra de compra do script (calculado a partir das fichas, orçamento 900):

| Time | Veículo | Tropas a pé embarcadas | Veículos | Gasto |
|---|---|---:|---:|---:|
| Verde | 6 vagas, 220 | 6 | 1 | 620 |
| Vermelho | 6 vagas, 220 | 6 | 1 | 620 |
| França | 8 vagas, 210 | 8 | 1 | 745 |
| Roxo | 10 vagas, 280 | 8 | 1 | 840 |

Ou seja, a vantagem do convertiplano sobre Verde e Vermelho vem de levar **8 tropas contra 6** num único veículo. **As 10 vagas nunca são usadas inteiras a 900 de orçamento**: a 9ª tropa não cabe na verba depois de pagar 280 pelo veículo. A capacidade de 10 só aparece com orçamentos maiores ou em partidas reais (resgates, batedor + 5 tropas). Isso é um limite desta medição, não um defeito do convertiplano.

## Observações

- A França continua a melhor com infantaria embarcada (100% contra Verde e Vermelho no relatório dela; aqui 85% contra o Roxo): sua vantagem vem do dano 40 da infantaria e do assalto, e o Roxo não passa dela.
- O caminhão roxo não tem mais vagas que o Verde (4); por isso empata com Verde e Vermelho (50%). A capacidade extra só existe no convertiplano e no cargueiro a jato.
- **O que a medição não cobre.** As duas habilidades do Roxo (remuniciar a bordo e desembarque rápido) não aparecem neste cenário: as tropas já saem com o máximo de mísseis e o script manda o veículo parar antes de desembarcar. O **cargueiro a jato não é simulado** (o cenário não inclui lançamento por paraquedas). Para o jato, a comparação é por custo por vaga da taxa fixa de lançamento: Verde 150/12 = 12,5, França 150/10 = 15, Roxo 220/16 = 13,75 (o Roxo paga um pouco mais por vaga que o Verde e menos que a França; mais as tropas, que custam o mesmo da ficha). Medido: capacidade e preço pela própria ficha (`tests/roxo.test.cjs`). Suposto: que 220 de taxa "paga" a vaga extra; não foi validado em partida.
- Verde×Vermelho dá 50% por ser espelho (mesmas fichas), como na França.
