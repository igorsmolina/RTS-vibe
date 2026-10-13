# Revisão da IA: transportes e apoio

Alterações locais em `public/js/engine.js`. Valores de combate, renda, limites de população e dificuldades foram preservados.

## Comportamentos corrigidos

- Coleta: o transporte procura reforços além de 12 casas, verifica acesso e reserva cada passageiro para um único veículo. Tropas em captura, manutenção, reparo, combate ou construção não entram nessa seleção.
- Compra: duas tropas livres já justificam um transporte, mantendo a reserva mínima de dinheiro e os limites existentes.
- Entrega: passageiros recebem o objetivo da missão. Após desembarcar, tentam capturar ou avançar, em vez de simplesmente voltar ao ponto de reunião. Missões expiram, respeitam objetivos já capturados e sobrevivem ao save.
- Segurança: a rota considera armas inimigas atualmente visíveis e perdas anteriores. Desembarque sem espaço provoca uma tentativa de reposicionamento próximo.
- Helicóptero: coleta e entrega precedem bombardeios quando há uma missão de transporte; manutenção continua prioritária quando está vazio e debilitado.
- Paraquedistas: o grupo combina infantaria e reconhecimento com antitanques, lançadores ou metralhadores conforme as ameaças vistas; recebe uma missão após a descida.
- Apoio: comandante e antiaéreas acompanham a frente terrestre. Antitanques vazios buscam bases para repor mísseis.
- Artilharia: rejeita alvos com aliados na área de explosão, não usa as ordens genéricas de ataque para contornar essa seleção e se aproxima do objetivo com distância de tiro.

## Verificação

- `node tests/ai-logistics.test.cjs`: 19 cenários passaram, incluindo coleta, reserva, missão, abastecimento, neblina, save e viagens reais de caminhão/helicóptero/avião seguidas de captura. As viagens completas são cenários RTS controlados; decisões de transporte, captura e apoio também foram verificadas por turnos.
- `tests/ai-strategy.test.cjs`, `tests/ai-air-economy.test.cjs`, `tests/balance-logistics.test.cjs` e `tests/transports.test.cjs`: passaram.
- `tests/ai-offline.browser.test.cjs`: quatro mapas, RTS e turnos, via `file://`, sem erros de página.
- `tests/transports.browser.test.cjs`: comandos, compra, paraquedas, save, manual e tela móvel passaram.
- `tests/transports-multiplayer.integration.cjs`: RTS e turnos passaram, incluindo propriedade, carga privada e sequência duplicada.
- `tests/turns-ai.test.cjs`: turnos com 200 e 400 unidades terminaram e passaram os limites do teste. Não foi feita uma comparação isolada de desempenho antes/depois.
- `tests/ai-matrix.test.cjs`: passaram as 32 combinações de quatro mapas, dois modos e quatro dificuldades, com semente 44. A versão final do motor corresponde ao hash registrado em `matrix-final.json`. São simulações de 180 segundos RTS ou até 48 rodadas, sem um jogador humano comandando o azul; não são 32 partidas competitivas completas.
- Na matriz, houve embarque e entrega espontâneos em 29/32 cenários: 106 embarques e 87 desembarques registrados. Houve 12 missões de paraquedistas em seis cenários. Esses números contam ações; não representam tropas únicas nem uma comparação antes/depois. A travessia de helicóptero foi comprovada separadamente no cenário controlado.
- Todos os 38 arquivos da suíte de motor, incluindo o novo teste, foram executados individualmente para não interromper a verificação na primeira falha: 30 passaram; 8 falharam também com a cópia do motor anterior a esta revisão, com a mesma primeira asserção.

## Falhas preexistentes reproduzidas

| Arquivo | Primeira divergência, antes e depois |
| --- | --- |
| `balance-revision.test.cjs` | Compra sequencial de aeronaves: `undefined` em vez de `multiroleRed` |
| `engine.test.cjs` | `1.5` em vez de `0.5` |
| `air-defense.test.cjs` | `70` em vez de `40` |
| `radar.test.cjs` | `40` em vez de `20` |
| `aviation.test.cjs` | `9` em vez de `8` |
| `operations.test.cjs` | Ordem de captura rejeitada |
| `artillery-upgrade.test.cjs` | `100` em vez de `120` |
| `airport-runway.test.cjs` | Semente `river/1`: `plain` em vez de `road` |

`npm test` continua interrompendo em `balance-revision.test.cjs`; a suíte completa não está verde. Os testes acima não foram enfraquecidos nem tiveram suas expectativas alteradas.

Evidências detalhadas: `test-output/ai-logistics/`, incluindo logs por arquivo, `suite.json`, `failures-before-after.json`, a cópia anterior do motor e resultados de navegador. A dificuldade contra um jogador humano não foi medida; não há estimativa de ganho de desempenho ou taxa de vitória.
