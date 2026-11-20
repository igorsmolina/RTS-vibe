# Transporte francês: infantaria desembarcada contra Verde e Vermelho (T4)

Comando: `node scripts/faction-balance.cjs --transport --label transporte --seeds 10` (20 duelos por célula, orçamento 900 já com os veículos, lados trocados).
Cada lado compra tropas a pé em ciclo (fuzileiro, antitanque, fuzileiro, metralhadora, fuzileiro) enquanto tropas + veículos (ceil(n/capacidade)) couberem em 900.
A infantaria começa embarcada, os veículos andam até ~8 casas do inimigo, param, desembarcam e todos lutam.

| Cenário | França×Verde | França×Vermelho | Verde×Vermelho (controle) |
|---|---|---|---|
| Caminhão, antes (custo 100, 100 PV, vel. 2,2, 5 vagas) | 100% (valor restante 59/4) | 100% (58/4) | 50% (13/11) |
| Caminhão, depois | igual: nenhum ajuste necessário | igual | igual |
| NH90, antes (custo 210, 160 PV, vel. 3,2, 8 vagas) | 100% (65/35) | 100% (65/35) | 50% (44/44) |
| NH90, depois | igual: nenhum ajuste necessário | igual | igual |

Meta (França >= 65% contra os dois) atingida sem mexer em `FR.transportTruck` nem `FR.transportHelicopter`.

Composição dos exércitos (caminhão): França 10 tropas + 2 caminhões (870) contra 8 tropas + 2 caminhões (760) das outras facções; o 5º lugar do caminhão francês e o preço de infantaria mais barato entram no orçamento.

## Observações
- Controle de assalto: com `startAssault` desligado (sem +20% de precisão e +25% de velocidade) a França ainda vence 100% (valor 56/12), então a vantagem vem sobretudo da infantaria (dano 40, 5 vagas por caminhão = 10 tropas por 900) e não só do desembarque de assalto.
- Verde×Vermelho dá 50% por ser espelho (mesmas fichas; só o lado decide). Sementes alteram pouco o resultado, o duelo é quase determinístico.
- Para desembarcar, o veículo precisa estar parado (`canTransport` exige `!pending`): o script manda `stop` e só então `disembark`.
- A ordem `move` para a casa exata de um inimigo falha (casa ocupada); o novo modo tenta casas vizinhas (`advance`). O modo padrão do script não foi alterado.
- `tests/franca.test.cjs` falha só em valores de tanque antigos (lightTank 95, tank 155/custo 155, recon 65); nada de caminhão/NH90. `tests/transports.test.cjs` passa (15 verificações).
