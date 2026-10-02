# Tanques leves, médios e pesados

Implementação local em 01/10/2026, disponível ao jogador e à IA em turnos e RTS. O identificador `tank` continua sendo o tanque médio e mantém seus atributos; `lightTank` e `heavyTank` ampliam as opções. Cada lado começa com um médio. O batedor continua como unidade própria. O QG oferece nove opções recrutáveis.

| Atributo base | Leve | Médio | Pesado |
|---|---:|---:|---:|
| Vida | 110 | 170 | 280 |
| Dano | 35 | 60 | 80 |
| Precisão | 75% | 70% | 70% |
| Alcance | 2 | 3 | 3 |
| Visão | 5 | 4 | 4 |
| Movimento por turno | 5 | 4 | 3 |
| Velocidade RTS, casas/s na planície | 2,00 | 1,55 | 1,05 |
| Intervalo RTS | 2 s | 2,5 s | 3,5 s |
| Créditos | 100 | 150 | 240 |
| Treinamento | 2 turnos / 20 s | 3 turnos / 30 s | 4 turnos / 40 s |
| Recompensa | 35 | 50 | 80 |

Leve favorece deslocamento, exploração e custo. Médio combina alcance, mobilidade e cadência. Pesado absorve mais dano e bate mais forte por disparo, mas leva mais tempo para chegar, treinar e recarregar. A resistência adicional é somente vida. Todos usam veículos, cobertura, reparo e veterania existentes. O batedor causa 40% do dano contra qualquer tanque; antitanque causa 2,25 vezes seu dano base contra veículos.

A IA mantém prioridades de infantaria, engenheiro, batedor, metralhador, antitanque e artilharia. Depois amplia as três classes, contando unidades e fila, com proporção alvo 1 leve : 2 médios : 1 pesado. Quando não consegue pagar a classe desejada, espera acumular créditos; os limites de fila e exército permanecem.

## Comparação reproduzível

`npm run compare:tanks` usa o motor real e salva `docs/tanks/balance-results.json` (gerado, fora do repositório), incluindo atributos, sementes, lado inicial, vencedor, sobreviventes e vida final de cada confronto. São 50 sementes × 2 lados × 7 cenários × 2 modos = **1.400 confrontos**. O relatório é determinístico; não impõe taxa artificial de vitória.

Planície, unidades inicialmente nível 1, sem comandante ou minas e sem compras durante a batalha. Cada unidade persegue o inimigo visível mais próximo. Mantêm-se precisão, críticos, veterania e cobertura de tropas ociosas. Formação em até três linhas, distância horizontal inicial de três casas; grupos maiores ocupam uma segunda coluna. Em turnos o azul age primeiro; alternar os lados compensa essa vantagem. Limites: 80 meios-turnos ou 200 s de simulação RTS.

Vitórias do grupo da esquerda / direita, em 100 confrontos por linha; nenhum empate nesta execução:

| Cenário | Custo esquerda / direita | Turnos | RTS |
|---|---:|---:|---:|
| Leve × médio | 100 / 150 | 2 / 98 | 4 / 96 |
| Leve × pesado | 100 / 240 | 0 / 100 | 0 / 100 |
| Médio × pesado | 150 / 240 | 7 / 93 | 27 / 73 |
| 3 leves × 2 médios | 300 / 300 | 18 / 82 | 20 / 80 |
| 5 leves × 2 pesados | 500 / 480 | 23 / 77 | 84 / 16 |
| 3 médios × 2 pesados | 450 / 480 | 43 / 57 | 79 / 21 |
| 2 antitanques × pesado | 220 / 240 | 83 / 17 | 91 / 9 |

O pesado domina duelos individuais, mas sua cadência permite que grupos maiores o superem no RTS. O antitanque permanece um contra-ataque eficaz. O leve perde confrontos frontais contra médios de custo semelhante; sua função depende de mobilidade e visão. Esses resultados sustentam funções diferentes, sem concluir que partidas completas estão equilibradas. Ainda é necessário avaliar captura, economia, terreno, controle e exércitos mistos em partidas completas; os atributos aprovados não foram alterados para forçar igualdade nos duelos.

## Arte

As [seis imagens e prompts](../../assets/Tanques/README.md) preservam os modelos fornecidos e estão incorporadas no jogo offline. Se o atlas falhar, os tanques usam desenhos alternativos.

## Verificação

```sh
npm test
npm run test:browser
npm run compare:tanks
```

O motor cobre movimento, custos de terreno, cadência, treino, produção bloqueada sem cobrança duplicada, redução do batedor, bônus antitanque, reparo, recompensa, veterania, médio inicial e recrutamento da IA nos dois modos. O Chrome com a rede bloqueada verifica seis PNGs transparentes 128 × 128, atlas 3 × 2, rotação, disparo, nove compras, retratos, manual sem corte lateral, pausa e falha real do atlas. Os layouts incluem 1440 × 1000, 768 × 1024, 390 × 844 e 375 × 667; são emulações de viewport, não testes em aparelhos físicos.
