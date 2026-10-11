# Relatório de balanceamento — War Grid

**Data:** 11/10/2026. **Estado:** propostas para aprovação; nenhum número do motor foi alterado nesta revisão.

Fonte: `public/js/engine.js`, SHA-256 `2475a58883285bf5b6cbc04efe247a2aedf842c3132aa989106a4c7d87dde00c`. Esta revisão já considera cruzeiros com **40 casas**, interceptação de antirradiação com **30%** e os ajustes anteriores de unidades. Não usa os preços antigos dos bombardeiros citados no pedido.

## 1. Resumo executivo — cinco problemas por impacto

1. **Formação inicial assimétrica:** o caça vermelho de 590 cabe no orçamento 600; o azul de 610 não. O vermelho pode começar voando sem construir aeroporto.
2. **Defesa barata contra o helicóptero básico é insuficiente no cenário próximo:** dois lançadores, custo 180, venceram o helicóptero de 140 em somente 2 dos 12 cenários RTS calculados; a antiaérea de 160 venceu em 11. Isso justifica reexaminar seu preço, sem desfazer os ajustes anteriores por intuição.
3. **Helicóptero ar-ar acumula funções:** custa 180, usa o mesmo canhão antiblindagem do ar-terra de 230 e ainda leva ar-ar. Contra pesado sem escolta, não recebe resposta.
4. **Postos têm limiares frágeis:** um cruzeiro periférico de 80 destrói o posto de 80 HP; uma salva de foguetes destrói o centro aberto com probabilidade 97,28%. Captura rápida e renda elevada amplificam a perda.
5. **IA normal exclui bombardeiros por regra:** limite de três aviões e ordem fixa de compras deixam o bombardeiro, quarto da lista, fora da composição nos dois modos.

Esses resultados provam propriedades do código e dos cenários descritos. Não provam uma estratégia vencedora em todas as partidas humanas.

## 2. Tabela de unidades e método

### Como os números foram calculados

- 26 classes/variantes não estruturais, incluindo comandante e os oito aviões; 39 perfis de alvo, incluindo os oito aviões pousados e cinco estruturas.
- Motor carregado com `node:vm`. Os impactos usam `shoot`, `launch`, `launchCruise`, `dropBomb` e `impact` do próprio motor. Não há fórmula de dano substituindo essas funções.
- Nível 1, doutrina equilibrada, terreno aberto, sem supressão, sem comandante próximo **exceto o comandante, que recebe a própria aura**. Referências aéreas sem flares, defesa/interceptação desativada para isolar a arma.
- Dano esperado por tiro = precisão real × (90% do dano normal arredondado + 10% do crítico arredondado). Cruzeiro, foguetes e bombas não têm crítico; artilharia convencional tem.
- Distância próxima válida: 1 casa, 2 na artilharia, 3 nos foguetes; cruzeiro central. Helicópteros em baixa, drones/aviões em alta. O CSV também calcula a extremidade do alcance e o primeiro míssil contra flares disponíveis.
- `DIST` usa distância Manhattan e distância ao retângulo das estruturas. Alcance 40 forma um losango; a trajetória do avião usa movimento contínuo. Não confundir alcance com raio circular.
- **D/cr** mostra dano esperado por crédito, primeiro por tiro, depois pela ação da arma de referência. Não soma danos em vários alvos da área.
- **DPS\*** é o limite da arma em fogo contínuo, sem deslocamento, giro, supressão ou reposição. Nos aviões é um limite de rajada com munição finita; não é DPS sustentado de uma partida. Artilharia de mísseis usa quatro tiros/10 s nominalmente; a cadência executada é menor, explicada abaixo.
- **D/ação\***: metralhador tem três tiros, minigun cinco, foguetes quatro; demais armas de referência, um tiro. Avião pode somar metralhadora ou escolher salva dupla; bombardeio tem 6–48 bombas por ordem. Os resultados completos de ordens aéreas aparecem em 3.3.
- Treino: turnos / segundos RTS; última medida é segundos de treino por crédito. Ela não mede qualidade: menor valor pode apenas refletir uma unidade cara. Lotes iguais treinam juntos; por isso não multiplicar o treino pelo número de unidades.
- Vereditos **forte/ok/fraca são interpretação situacional**, não uma medição de vitória humana. Uma classe sem dano pode valer pelo reconhecimento ou construção.

| Unidade / alvo de referência | Custo | HP/cr | D/cr: tiro / ação | DPS* | D/ação* | Treino T / s; s/cr | Alcance | Veredito e evidência |
|---|---:|---:|---:|---:|---:|---|---:|---|
| Infantaria / Infantaria | 50 | 2,00 | 0,65 / 0,65 | 40,73 | 32,58 | 1 / 10; 0,20 | 1.15 | ok: captura e HP/cr 2 |
| Tanque leve / Infantaria | 100 | 1,10 | 0,27 / 0,27 | 13,58 | 27,15 | 2 / 20; 0,20 | 2 | ok: mobilidade; sofre contra antitanque |
| Tanque médio / Infantaria | 150 | 1,13 | 0,29 / 0,29 | 17,39 | 43,47 | 3 / 30; 0,20 | 3 | ok: referência blindada |
| Tanque pesado / Infantaria | 240 | 1,17 | 0,24 / 0,24 | 16,56 | 57,96 | 4 / 40; 0,17 | 3 | fraca no RTS por crédito; ok em turnos |
| Artilharia / Infantaria | 180 | 0,56 | 0,42 / 0,42 | 14,96 | 74,80 | 4 / 40; 0,22 | 16 | forte em grupos; 16 casas e área |
| Batedor / Infantaria | 75 | 1,00 | 0,45 / 0,45 | 30,52 | 33,57 | 1 / 10; 0,13 | 2 | ok: visão 7; não substitui antitanque |
| Engenheiro / Infantaria | 65 | 1,31 | 0,29 / 0,29 | 15,53 | 18,63 | 2 / 20; 0,31 | 1.15 | ok: reparo e infraestrutura |
| Antitanque / Tanque médio | 110 | 0,82 | 0,72 / 0,72 | 26,41 | 79,22 | 2 / 20; 0,18 | 3 | forte contra veículos; fraca contra infantaria |
| Metralhador / Infantaria | 90 | 1,22 | 0,23 / 0,70 | 52,58 | 63,10 | 2 / 20; 0,22 | 2.5 | forte contra tropa a pé; três tiros por ação |
| Veículo antiaéreo / Helicóptero | 160 | 0,44 | 0,41 / 0,41 | 18,93 | 66,24 | 3 / 30; 0,19 | 30 | forte no ar; nenhum dano de solo |
| Soldado lançador / Helicóptero | 90 | 0,89 | 0,34 / 0,34 | 10,35 | 31,05 | 2 / 20; 0,22 | 3 | fraca isolada contra minigun; apoio/captura |
| Helicóptero / Infantaria | 140 | 0,86 | 0,08 / 0,38 | 52,70 | 52,70 | 3 / 30; 0,21 | 3 | forte: 52,70 DPS contra infantaria |
| Helicóptero ar-terra / Tanque médio | 230 | 0,52 | 0,37 / 0,37 | 28,73 | 86,19 | 4 / 40; 0,17 | 5 | ok: míssil 5/10 casas; AA custa menos |
| Helicóptero ar-ar / Helicóptero | 180 | 0,67 | 0,36 / 0,36 | 21,75 | 65,25 | 4 / 40; 0,22 | 6 | forte: canhão antiblindagem do ar-terra |
| Artilharia de mísseis / Tanque médio | 240 | 0,38 | 0,07 / 0,27 | 6,40 | 64,00 | 4 / 40; 0,17 | 30 | ok como cerco; fraca contra alvo isolado |
| Drone de reconhecimento / Infantaria | 90 | 0,67 | 0,00 / 0,00 | 0,00 | 0,00 | 2 / 20; 0,22 | 0 | forte em informação; sem dano |
| Drone furtivo / Veículo antiaéreo | 160 | 0,31 | 0,21 / 0,21 | 11,46 | 34,39 | 3 / 30; 0,19 | 8 | ok: informação e 2 tiros; 68,78 dano esperado total |
| Comandante / Infantaria | inicial | — | — / — | 32,80 | 49,20 | inicial | 2 | forte como aura; alto risco econômico |
| Caça aliado / Bombardeiro pesado inimigo | 610 | 0,25 | 0,10 / 0,10 | 102,54 | 61,52 | 3 / 30; 0,05 | 14 | ok: mais rápido; melhor precisão distante |
| Caça inimigo / Bombardeiro furtivo aliado | 590 | 0,27 | 0,10 / 0,10 | 103,10 | 61,86 | 3 / 30; 0,05 | 14 | forte: mais evasão/HP e cabe na formação |
| Multifunção aliado / Tanque médio | 750 | 0,24 | 0,13 / 0,13 | 165,61 | 99,37 | 4 / 40; 0,05 | 10 | ok: 4 AGM; míssil finito |
| Multifunção inimigo / Tanque médio | 920 | 0,22 | 0,14 / 0,14 | 209,55 | 125,73 | 4 / 40; 0,04 | 12 | forte em rajada; mais caro/lento |
| Caça furtivo aliado / Bombardeiro pesado inimigo | 1000 | 0,18 | 0,06 / 0,06 | 102,54 | 61,52 | 5 / 50; 0,05 | 14 | ok: paga pelo radar furtivo e 6 AAM |
| Caça furtivo inimigo / Bombardeiro furtivo aliado | 1030 | 0,18 | 0,06 / 0,06 | 103,10 | 61,86 | 5 / 50; 0,05 | 14 | ok: custo por dano inferior ao caça comum |
| Bombardeiro furtivo aliado / QG | 1296 | 0,19 | 0,12 / 0,12 | 26,67 | 160,00 | 6 / 60; 0,05 | 40 | forte no cerco remoto; só 2 cruzeiros |
| Bombardeiro pesado inimigo / QG | 2224 | 0,15 | 0,07 / 0,07 | 26,67 | 160,00 | 8 / 80; 0,04 | 40 | forte na carga; caro e detectável |

### Cobertura, alcance e munição

Cobertura: planície/campo/estrada 0%, colina 20%, sebe 25%, floresta 30%, montanha 50%; trincheira soma 25%, limitada a 75%. O arredondamento e o mínimo de 1 ocorrem por impacto. Não basta multiplicar a tabela inteira por 0,25 para prever um combate: **receber dano remove a trincheira**, e agir também a remove.

[cobertura.csv](cobertura.csv) calcula novamente cada arma de referência nos terrenos aplicáveis, com/sem trincheira para tropas terrestres, preservando o arredondamento por tiro. Não coloca tanques em montanha, não atribui trincheira a estrutura/aeronave e não desconta terreno de alvo em voo.

Exemplo executado: tanque médio acertando infantaria em montanha entrincheirada, sorteios 0,5, HP **100 → 85 → 55**. Primeiro impacto reduzido em 75%, segundo em 50%. A cobertura natural permanece. Em seguida a vítima tem −25 pontos de precisão por supressão; o DPS de resposta pode cair bastante.

Helicóptero ar-terra: AGM **5/10** casas em baixa/alta; ar-ar: AAM **6/11**. Canhões permanecem em 3. Altitude alta dá +10 pontos na precisão de mísseis enviados e recebidos, mas prejudica visão de tropas em cobertura. O drone não recebe +5 de alcance: furtivo permanece em **8**.

Armas terrestres, minigun, canhão e mísseis dos helicópteros têm munição ilimitada. Foguetes são **quatro por salva repetível**, não quatro no total. Drone furtivo tem **dois no total, sem reposição**. Aviões têm inventário e rearmam pagando apenas o que falta.

## 3. Confrontos, aviação, economia, doutrinas, estruturas e IA

### 3.1. Matriz de confrontos

Valores abaixo: **dano esperado da ação da arma selecionada automaticamente**, nas condições da seção 2. O bombardeiro usa cruzeiro por coordenada; foguetes usam a ordem de bombardear. `—` significa incompatibilidade ou ausência de arma, não um disparo que errou. **Negrito** marca os confrontos/limiares que merecem atenção.

| Atacante | Infantaria | Leve | Médio/pesado | Heli baixo | Caça vermelho¹ | Antiaérea | QG / posto |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Infantaria | 32,58 | 32,58 | — | 4,68 | 4,68 | 32,58 | 32,58 / 32,58 |
| Tanque leve | 27,15 | 27,15 | 27,15 | — | — | 27,15 | 27,15 / 27,15 |
| Tanque médio | 43,47 | 43,47 | 43,47 | — | — | 43,47 | 43,47 / 43,47 |
| Tanque pesado | 57,96 | 57,96 | 57,96 | — | — | 57,96 | 57,96 / 57,96 |
| Artilharia | 74,80 | 74,80 | 74,80 | — | — | 74,80 | 74,80 / 74,80 |
| Batedor | 33,57 | 9,27 | — | — | — | 22,32 | 22,32 / 22,32 |
| Engenheiro | 18,63 | 18,63 | — | — | — | 18,63 | 18,63 / 18,63 |
| Antitanque | 17,59 | 79,22 | 79,22 | — | — | 79,22 | 35,19 / 35,19 |
| Metralhador | 63,10 | 13,46 | — | 24,82 | 24,82 | 13,46 | 24,55 / 24,55 |
| Veículo antiaéreo | — | — | — | 66,24 | 52,16 | — | — / — |
| Soldado lançador | 31,05 | 31,05 | — | **31,05** | 24,63 | 31,05 | 31,05 / 31,05 |
| Helicóptero | **52,70** | 4,25 | 4,25 | 17,43 | 4,67 | 4,25 | 8,93 / 8,93 |
| Helicóptero ar-terra | 10,54 | 86,19 | 86,19 | 17,59 | 6,12 | 86,19 | 57,20 / 57,20 |
| Helicóptero ar-ar | 10,54 | 26,43 | **26,43** | 65,25 | 50,24 | 26,43 | 8,84 / 8,84 |
| Artilharia de mísseis | 64,00 | 64,00 | 64,00 | — | — | 64,00 | **128,00** / **128,00** |
| Drone de reconhecimento | — | — | — | — | — | — | — / — |
| Drone furtivo | 34,39 | 34,39 | — | 34,39 | 25,09 | 34,39 | 34,39 / 34,39 |
| Comandante | 49,20 | 49,20 | — | — | — | 49,20 | 49,20 / 49,20 |
| Caça aliado | 4,96 | 2,48 | — | 68,36 | 47,85 | 66,24 | — / — |
| Caça inimigo | 4,96 | 2,48 | — | 68,73 | 48,11 | 79,22 | — / — |
| Multifunção aliado | 4,96 | 99,36 | 99,36 | 56,64 | 39,65 | 99,36 | 65,96 / 65,96 |
| Multifunção inimigo | 4,96 | 125,73 | 125,73 | 73,83 | 51,68 | 125,73 | 83,88 / 83,88 |
| Caça furtivo aliado | 4,96 | 2,48 | — | 68,36 | 47,85 | 66,24 | — / — |
| Caça furtivo inimigo | 4,96 | 2,48 | — | 68,73 | 48,11 | 79,22 | — / — |
| Bombardeiro furtivo aliado | 160,00 | 160,00 | 160,00 | — | — | 160,00 | **160,00** / **160,00** |
| Bombardeiro pesado inimigo | 160,00 | 160,00 | 160,00 | — | — | 160,00 | **160,00** / **160,00** |


¹ O caça vermelho é um perfil de alvo com 30% de evasão. Linhas de aviões vermelhos contra esse perfil são comparação teórica entre modelos iguais: não são encontros possíveis entre equipes com recrutamento normal. O CSV marca isso em `teamLegal`. Outros alvos comuns não são exclusivos de uma equipe.

**Matriz completa:** [confrontos.csv](confrontos.csv), 1.014 células. Inclui engenheiro, batedor, lançador, demais helicópteros/drones, cada variante de avião em voo e pousada, aeroportos e canteiro; mostra dano normal acertado, esperado por tiro/ação, com flare novo, no alcance máximo e arma utilizada. Não encobre um zero de incompatibilidade com uma média de categoria.

**Leitura dos casos problemáticos:**

- Médios/pesados são imunes às armas comuns, mas **tanques leves também os atingem**. Minigun causa dano mínimo; canhão, AGM, antitanque, ambas as artilharias, bombas e cruzeiros os atingem. O enunciado original que limita a vulnerabilidade a algumas armas não descreve todas as exceções do motor.
- Pesado: HP/cr 1,167 contra 1,133 do médio, apenas +2,94%; DPS/cr **0,069 contra 0,116**, −40,5%. Mesmo alcance 3; velocidade menor. Em turnos recebe 57,96 contra 43,47 por ação, +33,3%, por custo +60%. Resistência individual, menor exposição e concentração de dano justificam parte do preço; não há prova de inutilidade universal.
- Canhão do ar-ar causa **30 ao acertar / 26,44 esperado por segundo** em blindado, igual ao canhão do ar-terra. No ar-terra o AGM automático dá 28,73 DPS esperado por 230; no ar-ar o canhão dá 26,44 por 180. O ar-terra conserva vantagem em alcance, dano por ação e ataque de alta altitude; portanto o ar-ar não o domina em todos os cenários, mas é generalista demais a curta distância.
- Lançador contra básico baixo: 31,05 por míssil sem flare; primeiro tiro com flare **15,53**. Helicóptero contra tropa a pé: 52,70 DPS antes de supressão. O papel do lançador é apoio, posicionamento e captura, não duelo isolado garantido.
- Cruzeiro: 160 no centro/80 ao redor. Foguete: 20/10, dobrado em estrutura; artilharia convencional cai até 68 no limite e aplica metade aos vizinhos. Todos esses ataques de área acertam aliados; foguetes/cruzeiros/bombas não acertam aeronaves em voo.

### 3.2. Cada classe tem um contra-ponto barato?

Um contra-ponto aqui é uma ameaça compatível que explora uma vulnerabilidade clara. **Não significa vitória automática sem respeitar visão, alcance, aproximação, cobertura e escolta.**

| Unidade/classe | Contra-ponto de custo equivalente ou menor | Limite importante |
|---|---|---|
| Infantaria 50 | Infantaria 50; outros especialistas custam mais | Não existe uma classe especializada mais barata; espelho não é um contra-ponto duro |
| Engenheiro 65 | Infantaria 50 | Fica exposto enquanto trabalha; valor de reparo não está no dano |
| Batedor 75 | Infantaria 50 quando encosta | Batedor tem alcance/mobilidade superiores; contra-ponto depende de acesso |
| Leve 100 | Duas infantarias 100 a curta distância | Uma infantaria parada a duas casas não responde; o tanque explora alcance 2 |
| Médio 150 | Antitanque 110; helicóptero básico 140 apenas como desgaste | Antitanque sozinho pode perder sob fogo direto; tanques não respondem ao ar |
| Pesado 240 | Dois antitanques 220; ar-ar 180 ou ar-terra 230 | Dois antitanques venceram o pesado no cenário RTS de semente 173; ar-ar o matou sem receber dano |
| Antitanque 110 | Infantaria 50 ou metralhador 90 | Dano reduzido contra tropas a pé |
| Metralhador 90 | Batedor 75 explora sua condição de veículo; infantaria em cobertura | Nenhum duelo universal demonstrado; alcance 2,5 favorece metralhador contra infantaria aberta |
| Antiaérea 160 | Batedor 75, infantaria 50, antitanque 110, tanques | Não responde a nenhum ataque de solo; requer escolta |
| Lançador 90 | Infantaria 50, metralhador 90, batedor 75 | Contra solo só atira a uma casa |
| Básico 140 | **Não há defesa aérea dura individual mais barata demonstrada** | AA 160 é o contra-ponto mais claro; dois lançadores 180 venceram só 2/12 cenários próximos |
| Ar-terra 230 / ar-ar 180 | Antiaérea 160 | Flares e antiaérea suprimida reduzem acerto; alta altitude e visão compartilhada importam |
| Artilharia 180 | Ar-ar 180; leve 100 ao atravessar o alcance mínimo | Alcance 16 exige aproximação/reconhecimento e permite escolta |
| Foguetes 240 | Ar-ar 180 / ar-terra 230; leve 100 ao encostar | Alcance 30, área e fogo amigo impedem tratar só DPS como valor |
| Drone de reconhecimento 90 | Lançador 90 | Precisa vê-lo e estar a 3 casas; AA custa mais e amplia cobertura |
| Drone furtivo 160 | AA 160; lançador 90 após descoberta | Furtivo não aparece no radar e precisa entrar em visão; depois fica descoberto permanentemente |
| Comandante inicial | Antitanque/infantaria ou unidades de área | Não tem preço de compra; perder saldo e aura é o custo |
| Caças azul/vermelho 610/590 | AA 160 com observação/escolta; ar-ar 180 próximo | Antirradiação elimina o defensor se smoke/interceptação falharem |
| Multifunção azul/vermelho 750/920 | AA 160; ar-ar 180 próximo | AGM e antirradiação ameaçam a própria defesa; precisar de várias peças não equivale a um avião ser imbatível |
| Furtivos azul/vermelho 1000/1030 | Ar-ar 180 ou caça comum 610/590 com visão direta | Radar sozinho não basta; depois de identificado usa a resistência/evasão normal do modelo |
| Bombardeiros azul/vermelho 1296/2224 | Caça comum 610/590 ou ar-ar 180 para abater; AA 160 para interceptar | AA protege a rota de cruzeiro, mas não atira no bombardeiro invisível distante; este não responde com ar-ar |

**Conclusão:** não foi demonstrada uma classe que “sempre vale mais” ou “nunca vale”. Foram encontrados papéis enfraquecidos e sobreposição situacional. O requisito de um contra-ponto duro, individual e mais barato **não é satisfeito claramente pelo helicóptero básico**, e a infantaria mais barata também exige combinações/espelho. Esse critério não deve ser confundido com exigir vitória de cada peça em um duelo parado.

### 3.3. Aviação: preços, assimetria e execução

| Modelo | Terra / concreto | HP; evasão; flares | Inventário ofensivo | Observação |
|---|---|---|---|---|
| Caça azul | 610 / 488 | 150; 20%; 6 | 4 AAM, 2 antirradiação, 80 tiros | Velocidade 6; radar 18; AAM 70, melhor precisão distante |
| Caça vermelho | 590 / 472 | 160; 30%; 6 | Mesma carga | Velocidade 5,4; AAM 75; mais resistente/evasivo e mais barato |
| Multifunção azul | 750 / 600 | 180; 30%; 6 | 2 AAM, 4 AGM, 2 antirradiação, 80 tiros | Velocidade 5,6; AAM 65, AGM 75; sem radar de caça |
| Multifunção vermelho | 920 / 736 | 200; 20%; 8 | 2 AAM, 5 AGM, 3 antirradiação, 80 tiros | Velocidade 4,8; AAM 80, AGM 90; precisão própria maior no ataque de solo |
| Caça furtivo azul | 1000 / 800 | 180; 30%; 6 | 6 AAM, 2 antirradiação, 80 tiros | Velocidade 6,2; radar 18; armas/precisão do caça azul |
| Caça furtivo vermelho | 1030 / 824 | 190; 35%; 6 | Mesma carga | Velocidade 5,8; radar 18; armas/precisão do caça vermelho |
| Bombardeiro azul | 1296 / 1037 | 240; 10%; 10 | 4 de cada bomba, 2 cruzeiros | Furtivo ao radar; velocidade 3,5 |
| Bombardeiro vermelho | 2224 / 1779 | 340; 10%; 12 | 16 de cada bomba, 2 cruzeiros | Detectável; velocidade 3,8; quatro vezes a carga de bombas por 1,716× o preço |

Concreto dá 20% de desconto **no preço inteiro**, inclusive carga. Reparos e flares são repostos pelo serviço sem custo específico; munição faltante é paga integralmente. Serviço: **10 s/1 turno no concreto; 20 s/2 turnos na terra**, além de retorno, pista e vagas. Reduzir preço de munição também reduz compra inicial, não apenas rearmamento.

**Um caça de 610 equivale a quatro médios de 600?** Não são substitutos: **o caça não consegue danificar médio/pesado**, e os médios não atingem avião em voo. Os quatro médios têm 680 HP e aproximadamente 69,55 DPS terrestre somados; o caça fornece controle do ar, radar e antirradiação. O multifunção azul dispõe de cerca de **397,46 de dano esperado contra blindado em quatro AGM**, antes de cobertura e sem somar alvos: não elimina garantidamente quatro médios de 680 HP. Rearmar muda o valor ao longo da partida e exige investimento/tempo.

**Cargas finitas:** AAM de cada caça comum entrega aproximadamente 246–247 de dano esperado somado contra bombardeiro sem flares próximo; furtivo, 369–371. Flares, evasão, alvo móvel e alcance mudam isso. A metralhadora tem 80 tiros: dez por rajada e intervalo próprio de 2 s entre início de rajadas, não 16,67 tiros/s contínuos. A tabela de armas individual está em [armas.csv](armas.csv).

Bombardeiros: somando apenas impactos centrais imediatos em alvos válidos distintos, sem cobertura/interceptação/tempo de retorno, a carga azul tem teto esperado **824 contra tropas a pé / 653 contra estruturas**; vermelha **2336 / 1652**, incluindo os dois cruzeiros. Isso dá **0,636 / 0,504 por crédito** no azul e **1,050 / 0,743** no vermelho. É potencial de inventário, não dano em um único alvo ou em uma única ordem: linha, sobrevivência e HP dos alvos limitam o resultado. Fragmentação aplica ×1,5 em tropa a pé, ×0,25 em veículo/estrutura; incendiária pode acrescentar até 30 de fogo em tropa a pé ou 15 em veículo/estrutura que permaneça seis segundos. Fogo sobreposto usa o maior valor por alvo, não soma todas as chamas.

**Execução de uma ordem real:** cenário plano, avião a dez casas de alvo estacionário com HP artificialmente ampliado para não encerrar a missão por abate; sem flares/escolta; sorteios fixos **0,5** (acertos sem críticos). Não é taxa de vitória nem DPS contra adversário humano.

| Modelo/alvo | Turnos: dano; munição; tempo de animação | RTS: dano; munição; tempo até encerrar |
|---|---|---|
| Caça azul / helicóptero | 180; 1 AAM + 10 tiros; 2,233 s | 1160; 4 AAM + 80 tiros; 29,433 s |
| Caça vermelho / helicóptero | 185; 1 AAM + 10 tiros; 2,467 s | 1180; 4 AAM + 80 tiros; 28,800 s |
| Furtivo azul / helicóptero | 180; 1 AAM + 10 tiros; 2,233 s | 1300; 6 AAM + 80 tiros; 31,033 s |
| Furtivo vermelho / helicóptero | 185; 1 AAM + 10 tiros; 2,333 s | 1330; 6 AAM + 80 tiros; 28,300 s |
| Multifunção azul / médio | 113; 1 AGM; 1,033 s | 113; 1 AGM; 1,000 s |
| Multifunção vermelho / médio | 135; 1 AGM; 1,033 s | 135; 1 AGM; 1,000 s |
| Ambos bombardeiros / QG | 160; 1 cruzeiro; 1,300 s | 160; 1 cruzeiro; 1,267 s |

A perseguição aérea se repete no RTS; no modo turnos uma investida gasta a ação e deixa intenção para o próximo turno. **O D/ação da arma primária não representa a ordem completa de caça.** Nenhum ajuste de dano foi proposto só a partir dos altos valores de DPS nominal.

**Defesa necessária:** AA custa 160, lançador 90, ar-ar 180. AA + infantaria de escolta = 210; duas AA + duas infantarias = 420, mas não são garantia universal. AA não atira no solo e sua precisão contra avião alto é reduzida pela evasão e, no primeiro míssil, dividida por flare. Contra caça azul: **72% sem flare / 36% com**, vermelho: **63% / 31,5%**; contra bombardeiro: **81% / 40,5%**, sem outros bônus. Flares têm intervalo RTS de 8 s ou um uso por turno próprio; a segunda salva rápida pode não ser protegida.

Cruzeiro: 75% por tentativa de interceptação; antirradiação: 30%. Hipótese ideal de duas tentativas independentes e válidas dá 93,75% de interceptação total do cruzeiro e 51% do antirradiação. No jogo real uma tentativa depende de trajetória/encontro, distância 6, recarga 3,5 s e reação por turno; compartilhar um defensor indisponível invalida a conta.

Para antirradiação azul contra AA aberta, enquanto fumaça e uma interceptação estiverem disponíveis: probabilidade aproximada de dano = **0,80 × 0,40 × 0,70 = 22,4%**. Vermelho do caça: **0,85 × 0,40 × 0,70 = 23,8%**. É conta condicional, não resultado medido em partida. Fumaça tem duas cargas; radar desligado quebra perseguição. O preço baixo da AA não resolve sozinho supressão das defesas por aviões.

### 3.4. Economia e ritmo nos quatro mapas

Saldo inicial **150**; orçamento de formação **600**, composição padrão **565**. O restante da formação não é transferido para o saldo. Renda base **15 + 8×postos**, a cada 10 s RTS ou começo do turno próprio a partir da rodada 2. Não há equivalência universal “um turno = dez segundos de combate”: essa conversão vale para produção/renda, não para todas as ações.

| Compra, com somente QG e sem gastar/abater | Primeiro pagamento RTS | Pronta RTS, produtor disponível | Receita/treino em turnos |
|---|---:|---:|---|
| Médio 150 | 0 s | 30 s | Imediato; 3 avanços de produção |
| Helicóptero 140 | 0 s | 30 s | Imediato; 3 avanços |
| AA 160 | 10 s | 40 s | Após 1 renda; mais 3 avanços |
| Artilharia 180 | 20 s | 60 s | Após 2 rendas; mais 4 avanços |
| Pesado/foguetes 240 | 60 s | 100 s | Após 6 rendas; mais 4 avanços |
| Caça azul 610, aeroporto de terra já disponível | 310 s | 340 s | Após 31 rendas; mais 3 avanços |
| Caça vermelho 590, aeroporto de terra já disponível | 300 s | 330 s | Após 30 rendas; mais 3 avanços |
| Caça azul 488, concreto já capturado | 230 s | 260 s | Após 23 rendas; mais 3 avanços |
| Multifunção azul 750, terra já disponível | 400 s | 440 s | Após 40 rendas; mais 4 avanços |
| Bombardeiro azul 1296, terra já disponível | 770 s | 830 s | Após 77 rendas; mais 6 avanços |
| Bombardeiro vermelho 2224, terra já disponível | 1390 s | 1470 s | Após 139 rendas; mais 8 avanços |

São limites de caixa/produção em isolamento, **não previsão do primeiro avião real**. Construindo aeroporto: dois engenheiros iniciais já estão disponíveis; 400 podem ser pagos em 170 s, construção leva 30–60 s mais acesso, e após pagar faltam 610 para o caça azul. Sem expandir/gastar: caça azul de terra pago em **580 s**, pronto em **610 s**, mais eventual fila/saída/pista. O vermelho pode ser comprado em 560 s e ficar pronto em 590 s. Comprar os dois engenheiros acrescentaria 130 ao investimento. Capturar concreto elimina o gasto 400 e acelera treino de caixa pelo desconto.

Os aeroportos de concreto são gerados em pares espelhados com probabilidade nominal **50%**, não estão garantidos em toda semente. Na semente 173 existiram dois nos quatro mapas. O modo não alterou a geração.

**Expansão:** criar posto custa 60 e consome infantaria de 50: investimento econômico 110, retorno nominal em **137,5 s ou 13,75 rendas** após começar a receber. Considerando somente o desembolso adicional de uma infantaria já existente: 75 s/7,5 rendas, mas a tropa deixa de lutar. Capturar posto neutro não consome a tropa nem cobra 60; retorno de caixa é imediato após a captura, embora deslocamento e defesa custem tempo.

| Controle | Renda equilibrada / 10 s | Tempo para juntar caça azul após saldo 150, sem gastos |
|---|---:|---:|
| Somente QG | 15 | 310 s |
| QG + 1 posto | 23 | 200 s |
| QG + 4 postos | 47 | 100 s |
| QG + 12 postos | 111 | 50 s |

Os tempos supõem postos já controlados no início do intervalo; não incluem tempo de expansão. Com doze de 24 postos e doutrina econômica: renda **128**, 8,53× o QG equilibrado isolado. Isso é um incentivo forte à disputa de território; não é evidência de vitória inevitável de expansão.

**Rotas nos mapas reais:** semente **173**, configurações padrão (24 postos), primeira infantaria azul, menor custo de rota até o perímetro de um posto neutro. RTS estima custo/speed + 2 s de captura; turnos mostra o limite inferior `ceil(custo/3)` de movimento, com ação de captura quando alcança o perímetro. Frações de movimento não aproveitadas, bloqueios e combate podem adicionar turnos.

| Mapa | Custo de rota | RTS sem combate, estimado | Movimentos de turno, mínimo | Floresta+sebe / casas do mapa |
|---|---:|---:|---:|---:|
| Vale dos Rios | 40,5 | 32,0 s | 14 | 33,3% |
| Deserto Aberto | 54,5 | 42,4 s | 19 | 1,4% |
| Passe de Montanha | 41,0 | 32,4 s | 14 | 20,3% |
| Fronteira procedural | 41,5 | 32,7 s | 14 | 26,9% |

Essa amostra mostra por que não trasladar cegamente o mesmo tempo de expansão do RTS para turnos. Não é média de sementes nem a melhor abertura possível usando todas as infantarias.

**Produção e ataque cedo:** filas aceitam cinco unidades; unidades iguais compartilham lote. Com 150 iniciais, três infantarias podem sair em **10 s**, enquanto um médio sai em 30 s; ambas as compras consomem 150. Múltiplos postos multiplicam renda e produtores. A massa de infantaria perde contra minigun/metralhador e não fere médios/pesados; blindados sem reconhecimento/escolta perdem contra antitanque e ar. Não foi provado rush universal.

**Turtle:** trincheira desaparece no primeiro dano, estruturas não recebem bônus de HP da doutrina defensiva e artilharia/cruzeiro atingem a distância. Aeronaves/filas/aeroportos não sustentam vitória sem QG ou posto. Não foi provada defesa estacionária invencível.

**Comandante:** corta somente saldo atual à metade, uma vez. Na simulação: saldo 1000, compra de pesado por 240, perda do comandante: **760 → 380**; fila do pesado e renda 15 preservadas. Gastar antes de arriscar o comandante reduz o saldo exposto; perder aura ainda prejudica o exército. Não foi sugerido alterar essa mecânica.

### 3.5. Doutrinas, veterania e informação

| Doutrina | Dano / HP de tropas / renda | Renda real com QG / +4 postos / +12 postos | Leitura |
|---|---|---|---|
| Equilibrada | 1 / 1 / 1 | 15 / 47 / 111 | Referência, nenhum custo indireto |
| Econômica | 0,9 / 1 / 1,15 | 17 / 54 / 128 | Mais produção futura, menos dano imediato; retorno precisa sobreviver |
| Ofensiva | 1,1 / 0,9 / 1 | 15 / 47 / 111 | Pode atingir limiares de abate; perde resistência |
| Defensiva | 1 / 1,15 / 0,9 | 14 / 42 / 100 | Melhor HP por compra; menos renda; não aumenta HP de estrutura |

Arredondamento importa: econômica com somente QG recebe +13,3%, defensiva perde só 6,7%; percentuais nominais não se realizam exatamente em quantidades pequenas. Pela conta agregada simplificada, econômica `0,9×1,15=1,035` e defensiva `1,15×0,9=1,035`; esse +3,5% não prova domínio, pois fila, sobrevivência, tempo, terreno e limiares de dano não são lineares. Ofensiva `1,1×0,9=0,99` na troca simplificada dano×vida, mas ganha iniciativa quando reduz tiros necessários. **Nenhuma doutrina demonstrada dominante; nenhum ajuste imediato recomendado.**

Nível máximo obtido normalmente: 3. Primeiro abate sobe ao 2; três abates ao 3. Dano +10%/nível, precisão +5 pontos/nível, vida máxima +10%/nível e cura na promoção. Abates também pagam recompensa em créditos. Isso cria bola de neve de experiência **e** economia, não só de dano.

Empilhamento máximo normal ofensivo: `1,2 nível × 1,2 aura × 1,1 doutrina × 1,35 crítico = 2,1384`. Antitanque contra veículo: 90 → **192** arredondados em crítico; AGM vermelho: 135 → **289**, suficiente para pesado básico aberto de 280. Só 10% dos tiros acertados são críticos; cobertura pode impedir o abate. Cruzeiro/foguete/bomba não entram nesse fator de crítico. Precisão é limitada, e adversário veterano reduz a precisão de armas comuns, exceto quando o alvo é avião.

Defensiva + elite dá aproximadamente 38% mais HP que a base, antes dos arredondamentos intermediários; pesado passa a **386 HP**. Não se deve balancear todos os disparos pelo maior empilhamento excepcional. Recomendo medir frequência de promoções e concentração de comandante antes de mexer nos bônus.

**Drones:** visão 12 é um losango com até **313 casas** num campo aberto distante das bordas, contra 113 do batedor de visão 7 e 85 do helicóptero baixo de visão 6. Ambos os drones revelam tropas através de floresta, sebe, colina e montanha; continuam sem detecção de minas e não removem a cobertura de dano. Somam mobilidade aérea e visão compartilhada a artilharias/aviões. O reconhecimento de 90 não é “inútil” por ter DPS zero.

Furtivo por 160 mantém esse reconhecimento e dois tiros com precisão de saída 95% em condição neutra: **68,78 de dano esperado total** contra AA sem fumaça/interceptação (o míssil furtivo não é antirradiação). AA tem 70 HP: dois acertos normais de 35 a destroem; expectativa não é garantia. Contra aeronave com flare/evasão o resultado cai. Ser visto uma vez o deixa permanentemente revelado; não é invisibilidade recuperável. Nenhuma redução de visão/alcance foi proposta sem partidas que meçam esse novo papel.

### 3.6. Estruturas, captura e cerco

| Estrutura | HP / investimento | Dano de cerco aberto | Implicação |
|---|---|---|---|
| Posto | 80; 60 + infantaria consumida | Cruzeiro 160 central ou 80 periférico | Um impacto efetivo destrói; dano periférico já basta |
| QG | 300; inicial | Dois cruzeiros centrais: **300 → 140 → 0** | Sem interceptação/cobertura, um bombardeiro tem carga para derrubá-lo remotamente |
| Terra | 350; 400 + dois engenheiros participantes | Três cruzeiros centrais de 160 | Dois não bastam; exige recarga ou segundo lançador |
| Concreto | 500; captura de estrutura neutra | Quatro cruzeiros centrais | Carga de dois bombardeiros ou rearmamento; desconto compensa disputa |
| Canteiro | 150; construção paga | Um cruzeiro central | Vulnerável enquanto prepara infraestrutura |

Esses números não incluem defesa de terreno, doutrina/veterania do atacante ou reparo. Cobertura usa o terreno da posição da estrutura, não média de toda a área; estruturas grandes recebem dano uma vez por impacto. Aeronaves pousadas podem ser atingidas e a perda/captura do aeroporto elimina aeronaves atracadas e descarta fila paga.

Foguetes por salva: esperado **128 central em estrutura / 64 periférico**, sem crítico. Posto central precisa de dois acertos em quatro sorteios de 80%: `1−0,2⁴−4×0,8×0,2³ = 97,28%`. QG aberto precisa de oito acertos de 40; somente **16,78%** de chance de destruir em duas salvas sem bônus (`0,8⁸`), não “duas salvas garantidas”. O valor de cerco vem de alcance 30 e área, não do DPS individual.

Cadência dos foguetes medida em RTS por 35 s, ordens repetidas após o término: primeiros tiros das salvas em **0,3667 / 11,4333 / 22,5000 / 33,5667 s**. Ciclo **11,067 s**, incluindo preparação/recolhimento e recarga após o último foguete. DPS central esperado executável nessa condição: aproximadamente **5,78**, estruturas 11,57, abaixo do limite nominal 6,40/12,80. Por turnos quatro tiros cabem em uma ação, ainda sujeitos ao deslocamento e à preparação.

Artilharia convencional: posto aberto perto pode cair num acerto de 85; a 16 casas o tiro normal dá 68 e precisa de dois, salvo crítico. QG necessita quatro impactos de 85 ou cinco de 68 sem crítico; área ajuda contra escolta, mas ameaça aliados. O ajuste anterior da artilharia permanece justificável pelo alcance/área: não proponho desfazê-lo.

Captura: posto aceita infantaria, lançador, metralhador, antitanque ou comandante; aeroportos, só infantaria. **Uma ação / 2 s** no perímetro, sem disputa de força ou desgaste proporcional a HP. Assim, elevar HP não torna captura mais demorada. Defender requer impedir o acesso, não só reparar. O QG não é capturável. Engenheiro repara **24 HP/ação ou por segundo RTS**; dano recebido pelo trabalhador/ordens e acesso importam. Defesa de aeroporto ainda precisa de infantaria e peças antiaéreas, não apenas de aeronaves.

### 3.7. IA: variedade e adaptação

- `DOCTRINE` contempla todas as 17 classes compráveis fora de aeroportos; mínimos fixos de infantaria, engenheiro, reconhecimento, artilharias, drones e especialistas evitam monoexército. As participações somam **1,17** e são normalizadas; não são porcentagens diretas do exército.
- Compras dão bônus de prioridade a AA/lançador/ar-ar quando veem aeronaves, a antitanque/ar-terra/pesado quando veem veículos e a metralhador quando veem tropas a pé. AA/lançador podem ser comprados antes do cronograma em emergência; `SCHEDULE` não é uma proibição absoluta.
- Cronograma mínimo: helicóptero 1, AA 4, pesado 6, ar-terra 10, ar-ar 14. Em RTS isso equivale a **30/120/180/300/420 s**, enquanto produção/renda usam ×10. Em turnos são essas rodadas. Essa diferença afeta o ritmo de composição e deve ser avaliada nos dois modos antes de igualar prazos.
- `PLAN.normal`: preparo 3 rodadas ou 90 s RTS, margem 1,15 sobre força conhecida, onda mínima 6, fila 4, exército 48, aviões 3, renda sem vantagem. `DEFENSE` permite fallback de infantaria/metralhador/antitanque/lançador/AA/leve, mas não helicóptero ou artilharia. Isso pode manter uma defesa barata sem explorar o ar-ar generalista detectado.
- Sem aeroporto, com dois engenheiros e sem ameaça vista, a IA poupa até 400 e pode suspender outras compras. Ela procura capturar concreto ou construir; ao perceber ar sem AA, interrompe essa poupança para defesa. O defeito potencial é oportunidade perdida durante uma ameaça ainda não vista, não omissão total de defesa aérea.
- Com aeroporto, a seleção fixa por número de aviões vivos/na fila prioriza `fighterRed → multiroleRed → stealthFighterRed → bomberRed`. Limite normal 3 impede chegar ao quarto. Cenário de caixa 10.000 e concreto confirmou **caça, multifunção, furtivo; depois infantaria**, tanto RTS como turnos. Fácil, limite 2, também exclui furtivo/bombardeiro; difícil/veterana permitem o quarto.
- Radar, flares, smoke e interceptação são usados pelo motor para ambos os lados. IA controla altitude, retorna para serviço quando ferida/sem flares e usa antirradiação contra emissores. Cruzeiro procura alvos vistos/lembrados e evita aliados na área. Drone de reconhecimento apoia foguetes; furtivo prioriza AA/lançador e depois explora.
- IA reage a unidades **vistas**, não composição oculta completa. A força para lançar onda usa custo×fração de HP, não a matriz de compatibilidade; pode valorizar muito uma peça cara sem munição ou armas úteis. Essa é uma limitação mensurável da heurística, mas não proponho uma mecânica nova ou um avaliador complexo nesta rodada.

## 4. Propostas para aprovação — sete, sem aplicação

Valores abaixo são **candidatos**, não números já validados. Prioridade 1–5: problemas concretos; 6–7: hipóteses para segunda etapa. Manter cruzeiro alcance 40/interceptação 75%, antirradiação interceptação 30%, drone alcance 8/visão 12 e todos os demais ajustes anteriores.

| Prioridade | Unidade / campo | Atual → proposto | Motivo calculado | Efeito colateral esperado | Testes e documentação que precisarão acompanhar |
|---|---|---|---|---|---|
| 1 | Caça vermelho, `PLANE_MODELS.fighterRed.hull` | **380 → 400**; total **590 → 610**; concreto **472 → 488** | Retira a exclusividade de caber na formação 600 sem ampliar orçamento | Primeiro pagamento só QG passa de 300 para 310 s; vermelho conserva evasão/HP e perde desconto de casco | `tests/unit-balance.browser.test.cjs`, formação/compra nos dois comandos de integração; manual/painel; `docs/partida-balanceamento.md` quando existente; tabela aérea do relatório de dano |
| 2 | Helicóptero básico, `TYPES.helicopter.cost` | **140 → 160** | Nenhum contra-ponto aéreo duro individual mais barato; dois lançadores 180 perderam 10/12 cenários próximos; AA 160 venceu 11/12 | Formação deixa de comportar quatro básicos (560 → 640); custa o mesmo que sua defesa dura; exige reavaliar aberturas, sem alterar arma | `tests/unit-balance.browser.test.cjs`, formação e compras; manual/painel; preços em `docs/DANO.md` e `docs/partida-balanceamento.md` |
| 3 | Ar-ar, `TYPES.helicopterAir.gun.vehicleMultiplier`, somente nesta variante | **1,5 → 1,25**; canhão em veículo **30 → 25** ao acertar | Reduz sobreposição com ar-terra; DPS antiblindagem **26,44 → 22,02**, preservando AAM, dano aéreo e preço | Ar-ar demora mais a eliminar tanque/AA terrestre; altera ataque a avião pousado; multiplicador compartilhado não deve ser alterado globalmente | `tests/unit-balance.browser.test.cjs`, confrontos/helicópteros nos dois comandos permitidos; coluna de dano em `docs/DANO.md`, balanceamento, manual/painel |
| 4 | IA normal, `PLAN.normal.planes` | **3 → 4** | Quarto modelo é impossível com limite atual | IA normal consegue bombardeiro e investe mais no ar; continua limitada por renda/produção, mas aproxima sua variedade da difícil | Compras/IA nos quatro mapas em ambos os comandos; descrição de dificuldade no manual/painel; `docs/partida-balanceamento.md`; dano das armas não muda |
| 5 | Posto, `TYPES.post.hp` | **80 → 90** | Remove abate por cruzeiro periférico normal de 80 e por dois foguetes centrais de 40 | Três acertos de foguete passam a ser necessários; chance de uma salva destruir cai **97,28% → 81,92%**; captura continua 2 s/ação; cruzeiro central ainda destrói | Estruturas/combate/captura e `unit-balance` nos comandos permitidos; vida em `docs/DANO.md`, balanceamento, manual/painel |
| 6, condicional | Pesado, `TYPES.heavyTank.cooldown` | **3,5 → 3,2 s** | DPS/cr no RTS −40,5% ante médio; aumenta cadência em 9,4% sem mudar dano/HP/alcance | DPS nominal **16,56 → 18,11**; facilita supressão contínua; turnos mantém um tiro/ação, sem ganho de dano direto | Confrontos RTS/turnos em `unit-balance` e integração; cadência em docs de balanceamento/manual/painel; dano por impacto de `docs/DANO.md` preservado |
| 7, condicional | Renda de posto em `income` | **8 → 7** por ciclo | QG+12 gera 111, 7,4× QG isolado; reduz aceleração econômica antes de mudar doutrinas | QG+12 passa a **99**; retorno do posto criado sobe 137,5 → 157,1 s; pode tornar avião tardio demais e aumentar vantagem de capturar concreto | Economia nos quatro mapas e dois modos via comandos permitidos; `docs/partida-balanceamento.md`, renda no manual/painel; não muda tabela de dano |

**Motivo novo para reabrir o básico:** a evidência é o confronto com as defesas atuais após a revisão de AA/lançador, não o preço antigo 110. As 12 sementes não provam equilíbrio humano; a alteração deve ser aprovada como experimento reversível, com atenção à abertura de quatro helicópteros. Não proponho refazer dano/vida/precisão de artilharia, batedor, AA, lançador, drone furtivo ou AAM dos aviões.

**Sequência sugerida após aprovação:** preço do caça e limite da IA; depois básico/ar-ar; depois HP do posto. Pesado e renda precisam de autorização separada baseada no comportamento observado, evitando aplicar todos os candidatos de uma vez. Não foram criadas unidades ou mecânicas novas.

Para validar qualquer alteração futura, usar exclusivamente **`npm.cmd run test:integration:match`** e **`npm.cmd run test:integration:all`**. Os testes citados são casos a acompanhar dentro desses comandos; não são instrução para executar agregados antigos. O arquivo `unit-balance` atual tem várias verificações por faixas, não números exatos: passar sozinho não comprova o novo balanceamento. Não atualizar expectativas para esconder uma regressão funcional.

## 5. Divergências e lacunas da documentação

| Fonte | Texto/valor encontrado | Motor atual | Situação |
|---|---|---|---|
| Pedido anexado | Bombardeiros **1176 / 884** | **1296 / 2224**; concreto **1037 / 1779**; só bombas e dois cruzeiros | Contexto anterior à integração de cruzeiros; não usar como baseline |
| Pedido anexado | Médios/pesados vulneráveis somente à lista resumida | Leve também atinge; minigun dá dano mínimo; cruzeiro e AGM de avião também atingem | Lista incompleta, não bug de imunidade |
| `docs/DANO.md`, “Drone” | AA/lançador com +10 pontos contra drone, **99% / 95%** sem outros modificadores | Bônus extra específico somente para **reconDrone**; furtivo alto recebe **90% / 85%** | Divergência concreta; altitude alta já adiciona +10 para ambos, reconhecimento recebe mais +10 |
| `docs/DANO.md`, aeronaves/munição | Linha do furtivo “35 contra aeronave” | Base 35, porém precisão recebe evasão/flares e só há dois tiros; incompatível com médios/pesados | Não é erro de base; falta detalhar eficácia/carga na leitura da tabela |
| `docs/DANO.md`, categorias terrestres | “Aviões no solo usam camada terrestre”; não há linhas de dano para os seis caças/multifunções/furtivos nem bombas | Metralhadora/AAM/AGM/antirradiação e cada tipo de bomba têm regras distintas | Lacuna: a tabela não é matriz completa; complementar após aprovação, sem fingir que linha “veículo” descreve toda aviação |
| `docs/DANO.md`, dano decimal | 23,4, 8,8 etc. em tabela intitulada dano acertado | `impact` arredonda e aplica mínimo por tiro, além da queda por distância contra ar | São valores nominais; explicitar arredondamento evita prometer dano fracionário observado |
| `docs/partida-balanceamento.md` | Na leitura inicial: preços das unidades/bombardeiros já atualizados; “quatro mísseis” na salva e “todos produzidos nos aeroportos” | Foguetes são repetíveis; formação personalizada pode começar com avião em voo | Precisava qualificar carga/produção como recrutamento, distinguindo formação inicial |
| `docs/partida-balanceamento.md` | Arquivo existia no início da coleta e deixou de existir durante esta revisão | Última inspeção da pasta confirmou ausência; hash do motor não mudou | **Pendência documental atual:** não foi restaurado nem tratado como fonte numérica vigente |
| Documentação anterior de balanceamento | Declaração histórica de integrações aprovadas | Esta revisão só executou cálculos e cenários isolados | Resultado histórico não comprova o estado atual completo; nenhuma declaração de suíte atual aprovada |

As descrições correntes de cruzeiro em `docs/DANO.md`, manual, painel e motor já usam **40**, e a interceptação corrente de antirradiação usa **30%**. A precisão nominal de armas de avião em `WEAPONS` não basta para auditá-las: `planeWeapon` e `accuracy` substituem valores conforme variante, distância e alvo.

## 6. Riscos, incertezas e evidência reproduzível

### O que está calculado ou executado

- Métricas das 26 classes/variantes e matriz de 1.014 células, calculadas pelos métodos atuais de ataque/impacto, com precisão e crítico.
- 126 combinações arma/alvo: [armas.csv](armas.csv); métricas sem arredondamento de apresentação: [unidades.csv](unidades.csv); efeitos de terreno/trincheira: [cobertura.csv](cobertura.csv).
- Geração/rotas nos quatro mapas × dois modos, semente **173**; configuração padrão, não todas as sementes/controles procedurais.
- Dezesseis grupos de cenários curtos, incluindo ordens reais das oito variantes aéreas nos dois modos, compras de IA, economia/doutrina, limiar de QG, perda de comandante, cobertura, drone, minigun e ciclo dos foguetes.
- Defesa aérea próxima: sementes **1–11 e 173**, duas unidades de lançador ou uma AA paradas em (30,40)/(30,41), helicóptero baixo em (32,40), plano aberto, 20 s RTS, sem micro/comandante/escolta; RNG do motor. As sementes consecutivas podem ter sequências correlacionadas: contagem 2/12 e 11/12 descreve esses cenários, não uma estimativa estatística representativa.
- Duelos de 30 s, semente **173**: dois antitanques venceram pesado; ar-ar venceu pesado sem poder receber resposta; dois lançadores perderam para básico; infantaria parada a duas casas perdeu para leve que podia disparar. Incluem supressão/críticos/promoções. Não traduzir cada resultado em “esta unidade sempre vence”.
- [evidencias.json](evidencias.json) conserva cenários, horários, inventários, constantes e hash; [calcular.cjs](calcular.cjs) os reproduz lendo o motor. Comando da análise: `node reports/balanceamento-2026-10-11/calcular.cjs`. Não é teste de desempenho nem validação de mudanças do produto.

### O que só mais simulação ou partidas humanas resolverão

1. Taxa de vitória e tempo de partida por equipe, doutrina, mapa/semente, formação inicial e modo. Não houve partidas humanas medidas nem torneio automatizado completo.
2. Valor de visão através de terreno, stealth e radar: converter informação em créditos exige medir decisões/abates evitados e reconhecimento útil. Não há um “DPS equivalente” defensável para drone de reconhecimento.
3. Quanto micro, distância de entrada, escolta, cobertura e foco de fogo alteram o confronto básico×lançadores. Os cenários próximos expõem um risco, não cobrem defesa em profundidade.
4. Frequência de críticos que abatem blindados de uma vez, promoções e permanência na aura. Os maiores empilhamentos são possíveis, mas sua ocorrência competitiva não foi medida.
5. Valor da carga de 48 bombas do vermelho frente à invisibilidade ao radar do azul. Somar todo o inventário pressupõe sobrevivência, geometria de linha e alvos ainda na área; não se justifica nerfar a carga só pela soma.
6. Retorno de voo, rearmamento, perdas no aeroporto e vagas congestionadas. Os limites de caixa excluem gastos militares e períodos sem acesso ao produtor.
7. Se reduzir renda de posto melhora disputa ou prolonga demais partidas; se acelerar pesado só no RTS prejudica a identidade entre modos. Por isso ambas são propostas condicionais.
8. Consistência multiplayer: servidor carrega o mesmo `engine.js` e fixa dificuldade normal; fórmulas compartilhadas não provam sincronização de toda partida. Após aprovação, a integração completa permitida inclui servidor real e interface, mas ainda não substitui partida entre humanos pela internet.

**Limite da revisão:** nenhum benchmark, estresse, FPS/memória, `npm test`, `test:browser` ou `test:perf` foi executado. Também não foram executadas suítes de integração nesta rodada, pois não houve mudança no produto. Criados apenas os artefatos deste relatório; aguardando aprovação antes de alterar motor, testes de produto, manual ou documentação existente.
