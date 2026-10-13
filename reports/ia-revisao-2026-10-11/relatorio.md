# Revisão da aviação da IA — 12/10/2026

## Estado inicial e investigação

Relato investigado: no deserto, aviões atacavam a antiaérea do jogador, destruíam uma unidade barata e eram perdidos. O relato foi tratado como sintoma. Não foi fornecido um replay da partida humana; as reproduções abaixo usam cenários controlados no motor real.

O checkout estava limpo no início desta revisão, no commit `d3d24cbf44ce0693fe9995b5ea4a116c0b794ffc`. A referência é `test-output/ai-air-before.js`, SHA-256 `d1d370d7c3bcf96d571f226830cf823957de887ddcb90e48c1d55f8c23ea0e77`. Ela já inclui a revisão geral anterior da IA. O [relatório anterior](../ia-2026-10-11/relatorio.md) registra o fluxo completo, as causas dos impasses terrestres e as mudanças de estratégia. Seus resultados históricos foram preservados.

Fluxo aéreo rastreado nesta revisão: a fila RTS chama `aiAct`/`aiPlaneAct`; esta função escolhe manutenção, decolagem, retorno, alvo ou patrulha; `order` valida a ação; `pickWeapon`/`planeWeapon` escolhem armamento e alcance; `stepPlane` resolve aproximação, disparos, saída, pista e serviço; `hurt` registra a perda. `aiBuy` decide reposição pelas filas e pelo orçamento reais.

| Causa confirmada no código | Consequência observada | Correção |
|---|---|---|
| Antiaérea com radar tinha prioridade sobre outros alvos, sem comparar valor e exposição. | Repetição de ataques caros contra defesa barata. | Compara valor nominal do alvo, custo de reposição e cobertura antiaérea conhecida; permite recusar a missão. |
| Armamento automático do multifunção usava AGM de alcance 12; havia antirradiação de alcance 40. AA tem alcance 30. | Aproximação entrava na defesa; o ataque automático também podia prosseguir para metralhadora de alcance 4. | Usa explicitamente antirradiação contra radar e planeja saída após o disparo, pelo motor de voo comum. |
| Ordens pendentes limitavam a reconsideração; voo de transferência não entrava na mesma reavaliação. | Cobertura recém-observada não interrompia a ofensiva adequadamente. | Reavalia voos RTS, retorna para serviço ou usa retirada aérea se não houver pista. Turnos continuam respeitando a resolução normal de ações. |
| Emissão identificável não era conservada como contato aéreo observado. | Ao sair do alcance do sensor, a IA podia esquecer a defesa e voltar à área. | Registra o contato na inteligência existente, com expiração normal de 60 segundos/quatro rodadas. |
| Perdas de aviões não alimentavam a memória da onda terrestre. | O próximo avião podia repetir a missão perdida. | Guarda até oito áreas de perdas por 600 segundos/30 rodadas; evita cada área por 120 segundos/seis rodadas, aumentando até três vezes se houver repetição. |
| Não havia resposta terrestre ligada à recusa de uma missão aérea. | Comprar outro avião podia manter a mesma ofensiva inadequada. | Prioriza artilharia de foguetes de 240 créditos, quando não houver exemplar/fila e o QG não estiver sob emergência. Usa compra e produção comuns; a posição observada entra nos alvos de bombardeio. |

Uma revisão independente identificou três casos adicionais, reproduzidos e corrigidos: retirada sem aeroporto conservava a ordem de ataque; uma morte distante após a missão podia ser atribuída à missão antiga; uma rota podia cruzar a AA no meio apesar de ter pontas seguras. A missão é encerrada ao voltar à patrulha, com tolerância curta e local para impactos atrasados. A avaliação usa o segmento inteiro da aproximação.

Não há treinamento entre partidas. O risco é uma heurística conservadora de decisão, não uma probabilidade medida de perder o avião. A aproximação considerada é reta; o código não procura corredores aéreos complexos. Emissão revela posição conforme a regra já existente, mas não revela HP oculto: a decisão usa HP nominal nesse caso. AA silenciosa oculta não participa da decisão.

## Duelos reproduzidos: antes e depois

Os dois motores executaram os mesmos 32 cenários em dificuldade normal: oito sementes por modo com um multifunção a distância 20 de uma AA; quatro sementes por modo e por tipo (caça/multifunção) a distância 35 de duas AAs. Sementes do primeiro grupo: 1, 2, 3, 4, 5, 9, 17 e 44; do segundo: 1, 2, 9 e 17. Base: mapa desértico, arena local livre, QGs, pista própria de concreto, avião já em voo, munição normal, saldo inicial zero e IA estratégica global desativada. `aiPlaneAct` decide; movimento, munição, contramedidas, projéteis, AA, renda e serviço são resolvidos pelo motor real. RTS: até 45 segundos; turnos: até seis ciclos. Projéteis já lançados continuam sendo resolvidos após a perda do avião.

| Medida nos mesmos 32 cenários | Antes | Depois |
|---|---:|---:|
| Aviões perdidos | 12 | 0 |
| Missões com avião perdido e AA principal destruída | 4 | 0 |
| Total de antiaéreas destruídas, incluindo a segunda AA | 28 | 10 |
| Valor de reposição dos aviões perdidos | 7.344 | 0 |
| Valor nominal das antiaéreas destruídas | 4.480 | 1.600 |

Os valores são contagens e preços de reposição das fixtures, não gastos reais de compra acumulados nem lucro líquido. Não incluem munição, recompensas ou tempo. Os aviões da fixture foram configurados diretamente para reproduzir o combate; no produto, a IA continua pagando e produzindo unidades normalmente.

As quatro trocas ruins anteriores foram exatamente por uma AA de 160 créditos: multifunção de reposição 736 no RTS, sementes 1 e 2; multifunção 736 em turnos, semente 2; caça 488 em turnos, semente 17. A outra AA sobreviveu em cada caso. A correção preservou aviões, mas também reduziu os abates nesta bateria. Isso demonstra maior cautela nesses cenários, não melhor taxa de vitória nem pressão ideal em qualquer partida.

Estados iniciais, ordens, tempos, munição, HP, perdas e preços de cada cenário estão em [baseline.json](baseline.json) e [duelos.json](duelos.json). As 16 verificações novas passaram no motor final. Elas cobrem armamento, recusa de troca, perda que altera a próxima missão, compra terrestre, sobrevivência, nova cobertura no RTS, bombardeiro, retirada sem pista, atribuição de perdas, aproximação em turnos e informações ocultas.

No teste adicional de apoio terrestre RTS, a IA tinha 1.000 créditos e um multifunção sem antirradiação. Comprou artilharia por 240, aguardou a produção normal e destruiu a AA aos 167,67 segundos; artilharia e avião sobreviveram. O saldo final foi 970, incluindo renda normal, rearmamento pago e recompensa do combate. Esse resultado não é uma simulação de 45 segundos nem uma compra gratuita. O teste da memória de perdas provoca a morte pela função real `hurt`; ele comprova a mudança de decisão, sem representar uma segunda batalha natural.

## Quatro mapas, dois modos e dificuldades

[matriz.json](matriz.json) registra 32 simulações naturais: river, desert, mountain e random; RTS e turnos; easy, normal, hard e veteran; semente 44. São 180 segundos RTS ou 48 ciclos em turnos, com jogador azul sem ordens. Todas terminaram com decisões da IA, recursos e munição não negativos e uma pista/um avião próprios. A tabela lista dificuldades na ordem fácil/normal/difícil/veterana.

| Mapa/modo | Postos próprios finais | Decisões |
|---|---|---|
| river / RTS | 11 / 11 / 15 / 15 | 808 / 839 / 461 / 488 |
| river / turnos | 9 / 9 / 9 / 9 | 483 / 509 / 532 / 550 |
| desert / RTS | 12 / 12 / 15 / 16 | 910 / 940 / 557 / 560 |
| desert / turnos | 14 / 12 / 12 / 12 | 513 / 534 / 563 / 588 |
| mountain / RTS | 12 / 12 / 14 / 14 | 797 / 814 / 500 / 506 |
| mountain / turnos | 11 / 9 / 9 / 9 | 481 / 489 / 507 / 517 |
| random / RTS | 11 / 11 / 13 / 13 | 504 / 538 / 323 / 348 |
| random / turnos | 11 / 10 / 10 / 9 | 510 / 529 / 552 / 578 |

Cada combinação também executou uma oportunidade aérea controlada com pista própria, preço exato do multifunção e blindado visível de HP ampliado. Houve compra, produção, decolagem e consumo de AGM nas 32 oportunidades. Esse alvo artificial mede execução da sequência, não equilíbrio de dano. A matriz natural não reproduz o jogador reposicionando AAs nem combate humano prolongado.

As 35 regressões gerais anteriores passaram novamente: captura inacessível, ofensiva sem progresso, segunda ponte, travessia única obstruída, defesa, flanco, reconhecimento, recursos, filas, limite de aviões, captura/construção de pistas, manutenção paga e neblina. Resultados em [legado.json](legado.json). No teste de emissão, a posição inicial do avião foi ajustada para alcance 39: dentro do sensor antirradiação e fora da AA; o antigo teste a distância cinco exigia uma exposição que agora é recusada.

Chrome abriu o jogo por `file://` com rede desativada nos oito pares de mapa/modo, executou IA e desenhou a interface, sem erro de página. [offline-browser.json](offline-browser.json) é um smoke test de seis segundos por caso, não uma partida completa. Não foram alterados preços, atributos de combate, regras de pista, munição ou rendimentos por dificuldade.

## Verificação geral e limites

As 30 suítes preexistentes foram executadas individualmente nos dois motores, para que uma falha não escondesse as seguintes. Antes: 17 passaram e 13 falharam. Depois: 18 passaram e 12 falharam. Nenhuma suíte que passava antes passou a falhar nesta execução. A suíte geral continua sem aprovação completa. Logs em [suites.json](suites.json); resumo final e hashes em [manifesto.json](manifesto.json).

| Suíte com falha final | Falha medida, também presente antes |
|---|---|
| balance-revision | Compra esperada `multiroleRed`, resultado `undefined`. |
| engine | Custo 1,5 versus expectativa 0,5. |
| air-defense | HP 70 versus expectativa 40. |
| radar | Alcance 40 versus expectativa 20. |
| aviation | Fixture não obteve aeroporto vermelho. |
| operations | Fixture esperava aceitar captura que foi rejeitada. |
| artillery-upgrade | Valor 100 versus expectativa 120. |
| airport-runway | `river/1`: terreno `plain` versus `road`. |
| battlefield-fx e structures-fx | `localPlayerSide` não definido na fixture. |
| engine-scaling | 400 unidades: tickP95 20 ms acima do limite histórico. |
| pathfinding-worst | 100 ordens: tickP99 25,5 ms acima do limite histórico. |

`vision-load` falhou por tempo no motor anterior e retornou código zero no final, mas seu próprio log ainda indica quatro passadas de visão num tick frente à meta de uma. Essa variação não demonstra ganho isolado. Medições de performance nesta máquina compartilhada não representam benchmark isolado. Falhas anteriores não foram ajustadas para fabricar uma suíte verde.

Ainda precisa de partidas humanas: frequência de recusa e retomada da ofensiva, uso conjunto de artilharia e aviação em combate prolongado, resposta a AAs móveis/silenciosas, rotas curvas, sustentabilidade da munição e dificuldades em outras sementes. As evidências demonstram os comportamentos nos cenários registrados. Não há replay humano, telemetria inventada, taxa de vitória ou garantia de que um avião nunca será perdido.

## Reproduzir nesta pasta

```powershell
$env:RTS_AI_RESULT='reports/ia-revisao-2026-10-11/duelos.json'
node tests/ai-air-economy.test.cjs
$env:RTS_AI_RESULT='reports/ia-revisao-2026-10-11/legado.json'
node tests/ai-strategy.test.cjs
$env:RTS_AI_MATRIX_RESULT='reports/ia-revisao-2026-10-11/matriz.json'
node tests/ai-matrix.test.cjs
$env:RTS_AI_BROWSER_RESULT='reports/ia-revisao-2026-10-11/offline-browser.json'
node tests/ai-offline.browser.test.cjs
$env:RTS_AI_AUDIT_BASELINE='test-output/ai-air-before.js'
$env:RTS_AI_AUDIT_RESULT='reports/ia-revisao-2026-10-11/suites.json'
node tests/ai-audit.cjs
node reports/ia-revisao-2026-10-11/resumir.cjs
```

Para comparar os duelos, definir `RTS_AI_ENGINE=test-output/ai-air-before.js` e `RTS_AI_RESULT=reports/ia-revisao-2026-10-11/baseline.json`. A execução anterior retorna falha de propósito; depois remover `RTS_AI_ENGINE` antes de testar o motor atual. `npm.cmd run test:ai:air` executa a nova bateria diretamente. O nome da pasta conserva a data de início da revisão; o fechamento foi em 12/10. Alterações locais, sem commit ou envio.
