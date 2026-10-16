# Unidades do jogo

Written for: você, como referência de consulta e balanceamento.

Fonte: `public/js/engine.js` (`TYPES`, `PLANE_MODELS`, `WEAPONS`, `HELICOPTER_*`). Os valores são os do código neste momento; se forem alterados, este arquivo precisa ser atualizado.

## Legenda

| Campo | Significado |
|---|---|
| Custo | Créditos para comprar. Aviões: casco + munição, calculado no código. |
| Treino | Valor `train` usado em `trainDuration`: × 10 no tempo real, × 1 por turnos. Maior = mais lento de produzir. |
| HP | Pontos de vida. |
| Vel. | Velocidade no modo tempo real. |
| Mov. | Movimento. |
| Alcance | Alcance do ataque principal, em casas. |
| Mín. | Alcance mínimo (não atira mais perto que isso). |
| Dano | Dano por disparo. |
| Precisão | Chance de acerto base. |
| Recarga | Tempo entre disparos, em segundos no tempo real. |
| Visão | Casas de visão. |
| Recompensa | Créditos ganhos ao destruir a unidade (`reward`). Quando não definida, aviões ganham 120. |

## Tropas a pé

| Unidade | Custo | Treino | HP | Vel. | Mov. | Alcance | Mín. | Dano | Precisão | Recarga | Visão | Recompensa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Infantaria | 50 | 1 | 100 | 1.35 | 3 | 3 | 0 | 35 | 90% | 0.8 | 4 | 20 |
| Engenheiro | 65 | 2 | 85 | 1.25 | 3 | 1.15 | 0 | 20 | 90% | 1.2 | 4 | 25 |
| Metralhador | 90 | 2 | 110 | 1.05 | 2 | 3 | 0 | 18 | 75% | 0.3 | 4 | 30 |
| Antitanque | 110 | 2 | 90 | 1.05 | 3 | 7 | 0 | 40 | 85% | 3 | 4 | 35 |
| Soldado lançador | 90 | 2 | 80 | 1.25 | 3 | 10 | 0 | 40 | 70% | 3 | 4 | 30 |

- **Infantaria**: captura postos e constrói. Fuzil de alcance 3.
- **Engenheiro**: repara +24 HP por ação. Alcance 1.15.
- **Metralhador**: fogo rápido contra tropas a pé, alcance 3, menos preciso que a infantaria.
- **Antitanque**: míssil de alcance 7 contra veículos e estruturas (4 mísseis). Contra tropas usa fuzil de alcance 3.
- **Soldado lançador**: mísseis só contra aeronaves, alcance 10. Fácil de despistar (precisão 70%).

## Veículos terrestres

| Unidade | Custo | Treino | HP | Vel. | Mov. | Alcance | Mín. | Dano | Precisão | Recarga | Visão | Recompensa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Caminhão de transporte | 100 | 2 | 90 | 2.4 | 7 | — | — | — | — | — | 4 | 30 |
| Batedor | 75 | 1 | 75 | 2.25 | 5 | 2 | 0 | 24 | 90% | 1.1 | 7 | 25 |
| Tanque leve | 100 | 2 | 110 | 2 | 6 | 4 | 0 | 35 | 75% | 2 | 5 | 35 |
| Tanque médio | 150 | 3 | 170 | 1.7 | 5 | 5 | 0 | 60 | 75% | 2.5 | 5 | 50 |
| Tanque pesado | 240 | 4 | 280 | 1.5 | 4 | 7 | 0 | 80 | 85% | 3.5 | 5 | 80 |
| Artilharia | 180 | 4 | 100 | 1.2 | 3 | 16 | 2 | 85 | 85% | 5 | 3 | 40 |
| Artilharia de mísseis | 240 | 4 | 90 | 0.85 | 2 | 30 | 3 | 20 × 4 mísseis | 80% | 10 | 3 | 60 |
| Veículo antiaéreo | 160 | 3 | 70 | 2.25 | 5 | 30 | 0 | 80 | 80% | 3.5 | 6 | 45 |

- **Caminhão de transporte**: leva 4 tropas a pé. Sem armas.
- **Batedor**: reconhecimento rápido, visão 7. Veículo, mas com arma leve (alcance 2).
- **Tanque leve**: o mais rápido dos tanques. Não perfura tanques pesados.
- **Tanque médio**: alcance 5. Precisão cai após 3 casas.
- **Tanque pesado**: maior dano e precisão dos tanques. Tem Trophy: 3 cargas interceptam mísseis antitanque vindos de mais de 3 casas. Exige reconhecimento distante.
- **Artilharia**: cerco de longo alcance, área 3×3, fogo amigo. Não atira a menos de 2 casas.
- **Artilharia de mísseis**: bombardeia área 3×3 com 4 mísseis. Dobra o dano contra estruturas (×2). Não atira a menos de 3 casas. Equilíbrio provisório, ainda não validado em partidas (comentário no código).
- **Veículo antiaéreo**: mísseis de alcance 30 contra aeronaves, radar global. Exige escolta.

## Helicópteros

Os quatro helicópteros têm o mesmo casco: HP 120 (transporte: 150), velocidade 3.2 (transporte: 3.4), movimento 8 (transporte: 10), visão 6, recompensa 50 (transporte: 60).

| Unidade | Custo | Treino | Armas | Dano por arma | Alcance | Recarga |
|---|---|---|---|---|---|---|
| Helicóptero (minigun) | 150 | 3 | Minigun | 4 × 5 tiros, 85% | 3 | 0.2 |
| Helicóptero ar-terra | 230 | 4 | Canhão + míssil ar-terra | Canhão 20 · míssil 65 | 3 · 5 | 1 · 3 |
| Helicóptero ar-ar | 180 | 4 | Canhão + míssil ar-ar | Canhão 20 · míssil 70 | 3 · 6 | 1 · 3 |
| Helicóptero de transporte | 220 | 4 | Nenhuma (transporte) | — | — | — |

Multiplicadores de dano:

| Arma | Contra infantaria | Contra veículos | Contra estruturas |
|---|---|---|---|
| Minigun | ×3 | ×0.25 | ×0.5 |
| Canhão (ar-terra e ar-ar) | ×0.6 | ×1.5 (ar-ar: ×1.25) | ×0.5 |

- **Minigun**: alta cadência contra infantaria. Fraco contra veículos.
- **Ar-terra**: canhão perfurante e mísseis contra solo.
- **Ar-ar**: canhão perfurante e mísseis contra aeronaves (míssil com bônus de evasão 0.2).
- **Transporte**: leva 6 tropas a pé.
  - Aliado: embarca em altitude baixa e pode pendurar 1 tanque leve. Em altitude alta fica 50% mais rápido, enxerga através de floresta e colina, e os flares são mais eficazes.
  - Inimigo: dispara rajada de mísseis 3×3 (alcance 10 em baixa altitude, 30 em alta), 2 salvas, parado durante o lançamento.

## Drones

| Unidade | Custo | Treino | HP | Vel. | Mov. | Alcance | Dano | Precisão | Recarga | Visão | Recompensa |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Drone de reconhecimento | 90 | 2 | 60 | 2.4 | 7 | — | sem armas | — | — | 12 | 30 |
| Drone furtivo | 160 | 3 | 50 | 2.2 | 6 | 8 | 35 (2 mísseis) | 85% | 3 | 12 | 45 |

- Ambos voam sempre em altitude alta e enxergam através do terreno (visão 12).
- **Drone furtivo**: invisível ao radar. Exige reconhecimento atual para ser atacado. Só dispara por ordem.

## Aviões

Custo = casco + munição. Evasão e flares são os valores da ficha.

| Unidade | Custo | Treino | HP | Vel. | Evasão | Flares | Alcance máx. | Recompensa | Radar |
|---|---|---|---|---|---|---|---|---|---|
| Avião de transporte | 0 | — | 240 | 4.5 | 0% | 300 | — | 90 | — |
| Caça aliado | 610 | 3 | 150 | 6 | 20% | 60 | 30 | 120 | sim |
| Caça inimigo | 610 | 3 | 160 | 5.4 | 30% | 60 | 30 | 120 | sim |
| Caça furtivo aliado | 1000 | 5 | 180 | 6.2 | 30% | 60 | 30 | 140 | sim, furtivo ao radar |
| Caça furtivo inimigo | 1030 | 5 | 190 | 5.8 | 35% | 60 | 30 | 140 | sim, furtivo ao radar |
| Multifunção aliado | 750 | 4 | 180 | 5.6 | 30% | 60 | 30 | 120 | não |
| Multifunção inimigo | 920 | 4 | 200 | 4.8 | 20% | 80 | 30 | 120 | não |
| Bombardeiro furtivo aliado | 1296 | 6 | 240 | 3.5 | 10% | 100 | 67 | 120 | furtivo ao radar |
| Bombardeiro pesado inimigo | 1164 | 8 | 340 | 3.8 | 10% | 120 | 67 | 180 | detectável |

Munição de cada avião (quantidade de disparos):

| Unidade | Munição |
|---|---|
| Avião de transporte | Nenhuma. Leva 12 vagas de tropas e veículos. Pousa na pista, embarca tropas próximas e lança em linha por paraquedas. |
| Caça aliado / inimigo | Ar-ar ×4, antirradiação ×2, metralhadora ×80 |
| Caça furtivo aliado / inimigo | Ar-ar ×6, antirradiação ×2, metralhadora ×80 |
| Multifunção aliado | Ar-ar ×2, antiblindado ×4, antirradiação ×2, metralhadora ×80 |
| Multifunção inimigo | Ar-ar ×2, antiblindado ×5, antirradiação ×3, metralhadora ×80 |
| Bombardeiro furtivo aliado | Bomba comum ×4, fragmentação ×4, incendiária ×4, cruzeiro ×2 |
| Bombardeiro pesado inimigo | Bomba comum ×16, fragmentação ×16, incendiária ×16, cruzeiro ×6 |

- **Caça**: interceptação. Caça inimigo tem mais evasão, caça aliado é mais rápido.
- **Multifunção**: ar e solo. Aliado é mais rápido e manobrável. Inimigo tem mais HP, mais mísseis antiblindados e antirradiação, e mais flares.
- **Bombardeiro furtivo aliado**: 12 bombas e 2 cruzeiros. Sem metralhadora.
- **Bombardeiro pesado inimigo**: 48 bombas e 6 cruzeiros. Sem metralhadora. Detectável por radar.

## Comandante e estruturas

| Unidade | Custo | HP | Vel. | Mov. | Alcance | Dano | Precisão | Recarga | Visão | Recompensa | Tamanho |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Comandante | — (não comprado) | 140 | 1.35 | 3 | 2 | 40 | 90% | 1.5 | 5 | 70 | — |
| Quartel-general | — | 300 | 0 | 0 | 0 | 0 | — | — | 5 | 100 | 3×3 |
| Posto avançado | — | 90 | 0 | 0 | 0 | 0 | — | — | 8 | 30 | 2×2 |
| Aeroporto de terra | — | 350 | 0 | 0 | 0 | 0 | — | — | 5 | 70 | 6×2 |
| Aeroporto de concreto | — | 500 | 0 | 0 | 0 | 0 | — | — | 5 | 90 | 8×3 |
| Canteiro de aeroporto | — | 150 | 0 | 0 | 0 | 0 | — | — | 2 | 25 | 6×2 |

- **Comandante**: aura de comando, raio 2. Não tem custo na ficha, então não é comprado.
- **Posto avançado**: reconhecimento e recrutamento. Só infantaria, metralhador, antitanque, soldado lançador e comandante podem capturá-lo.
- **Aeroportos**: pista para aviões. Dirt ou concreto, com 4 vagas de pouso.

## Armas

| Arma | Dano | Alcance | Precisão | Recarga | Observação |
|---|---|---|---|---|---|
| Minigun | 4 | 3 | 85% | 0.2 | 5 tiros por salva |
| Canhão (helicóptero) | 20 | 3 | 85% | 1 | Perfurante |
| Míssil ar-terra | 65 | 5 | 85% | 3 | |
| Míssil ar-ar | 70 | 6 | 90% | 3 | Velocidade 4, bônus de evasão 0.2 |
| Míssil furtivo | 35 | 8 | 85% | 3 | Drone furtivo |
| Míssil antitanque | 40 | 7 | 85% | 3 | Antitanque |
| Fuzil | 35 | 3 | 90% | 0.8 | Tropas a pé |
| Salva de mísseis | 20 | 30 | 80% | 10 | Artilharia de mísseis, 4 mísseis |
| Metralhadora (avião) | 6 | 4 | 85% | 0.06 | |
| Míssil ar-ar (avião) | 70 | 30 | 90% | 0.6 | Velocidade 10 |
| Míssil antirradiação | 80 | 40 | 80% | 0.6 | Velocidade 14 |
| Míssil antiblindado (avião) | 75 | 15 | 85% | 0.6 | Velocidade 10 |
| Míssil de cruzeiro | 160 | 67 | 100% | 6 | Velocidade 8 |
| Bomba comum | 120 | 0 | 80% | 0.1 | |
| Bomba fragmentação | 70 | 0 | 80% | 0.1 | |
| Bomba incendiária | 40 | 0 | 80% | 0.1 | |

## Diferenças principais

**Tanques terrestres.** Leve, médio e pesado são uma escada de custo e força.
- Custo: 100 / 150 / 240.
- HP: 110 / 170 / 280.
- Dano: 35 / 60 / 80.
- Alcance: 4 / 5 / 7.
- Velocidade: 2 / 1.7 / 1.5.
- Movimento: 6 / 5 / 4.

O leve é o mais rápido e barato. O pesado é o mais forte e lento, e é o único com Trophy.

**Artilharia.** As duas são de longo alcance, mas servem a papéis diferentes.
- Artilharia: alcance 16, mínimo 2, um disparo de 85 em área 3×3, recarga 5 s.
- Artilharia de mísseis: alcance 30, mínimo 3, 4 mísseis de 20 (×2 contra estruturas), recarga 10 s. Custa mais (240 contra 180).

**Anti-infantaria contra anti-veículo.**
- Metralhador: alcance 3, fogo rápido contra tropas a pé.
- Antitanque: alcance 7, míssil contra veículos e estruturas.
- Soldado lançador: alcance 10, só contra aeronaves.

**Helicópteros.** Mesmo casco, armas diferentes.
- Minigun (150): especialista em infantaria, fraco contra veículos.
- Ar-terra (230): canhão e míssil de 65 contra solo. É o mais caro.
- Ar-ar (180): canhão e míssil de 70 contra aeronaves. Mais barato que o ar-terra.

**Transporte.** Aliado e inimigo têm papéis opostos.
- Aliado: transporta tropas e pode pendurar 1 tanque leve. Em altitude alta é mais rápido e enxerga mais.
- Inimigo: transporta tropas e dispara rajada de mísseis 3×3.

**Drones.** Reconhecimento (90, sem armas) contra furtivo (160, 2 mísseis, invisível ao radar).

**Caças.** Aliado e inimigo diferem na ficha.
- Caça: aliado tem mais velocidade (6 contra 5.4) e menos evasão (20% contra 30%). Ambos custam 610.
- Caça furtivo: inimigo tem mais HP, mais evasão e custa 30 a mais.
- Multifunção: inimigo tem mais HP e mais flares, mas é mais lento e tem menos evasão. Custa 170 a mais (casco 600 contra 480, e mais munição).

**Bombardeiros.** Papel de ataque pesado.
- Aliado: furtivo ao radar, 240 HP, 12 bombas, 2 cruzeiros.
- Inimigo: detectável, 340 HP, 48 bombas, 6 cruzeiros. Dá 180 de recompensa.

**Tropas terrestres.** Verde e vermelho têm os mesmos atributos, e só muda a arte (verde/oliva para aliados, vermelho para inimigos). A França (azul) tem fichas próprias: veja a seção **Time azul (França)**.

## Time azul (França)

Terceira facção, escolhida em **Suas unidades** (e, para a IA, em **Unidades da IA**). Tropas a pé e comandante não mudam: usam a ficha verde. Os valores abaixo vêm de `FR` em `public/js/engine.js`; o que não aparece é igual ao verde. Setas mostram verde → azul. Os 19 sprites estão em `assets/NovosTimes/azul/`.

Doutrina: rápida, sobre rodas e precisa, com pouca blindagem. A força aérea é a parte mais forte, e o time não tem Trophy.

| Unidade | Custo | HP | Vel. / Mov. | Alcance | Dano | Recarga | Visão |
|---|---|---|---|---|---|---|---|
| Tanque leve (AMX-10 RC) | 100 | 110 → **95** | 2 → **2,3** / 6 → **7** | 4 | 35 → **40** | 2 → **2,2** | 5 → **6** |
| Tanque médio (Leclerc) | 150 → **155** | 170 → **155** | 1,7 / 5 | 5 | 60 → **55** | 2,5 → **2,1** | 5 |
| Tanque pesado (Leclerc blindado) | 240 | 280 → **300** | 1,5 → **1,4** / 4 | 7 → **6** | 80 → **75** | 3,5 | 5 |
| Artilharia (CAESAR) | 180 | 100 → **80** | 1,2 → **1,7** / 3 → **4** | 16 → **14** | 85 → **80** | 5 | 3 |
| Batedor (VBL) | 75 | 75 → **65** | 2,25 → **2,4** / 5 → **6** | 2 | 24 → **20** | 1,1 → **1** | 7 |
| Veículo antiaéreo (Mistral) | 160 → **145** | 70 → **85** | 2,25 / 5 | 30 → **20** | 80 → **60** | 3,5 → **2,5** | 6 |
| Artilharia de mísseis (LRU) | 240 → **250** | 90 → **115** | 0,85 → **0,95** / 2 | 30 → **24** | 20 → **14** | 10 → **11** | 3 |
| Caminhão (TRM 10000) | 100 → **115** | 90 → **100** | 2,4 → **2,2** / 7 → **6** | 0 | 0 | 1 | 4 |

Helicópteros e drones:

| Unidade | Custo | HP | Vel. / Mov. | Alcance | Dano | Recarga | Visão |
|---|---|---|---|---|---|---|---|
| Helicóptero padrão (Gazelle) | 150 → **140** | 120 → **100** | 3,2 → **3,6** / 8 → **9** | 3 | 4 × 5 → **6 × 4** | 0,2 → **0,25** | 6 → **7** |
| Helicóptero ar-terra (Tigre) | 230 → **245** | 120 → **110** | 3,2 / 8 | 3 (canhão) | 20 → **22** | 1 → **1,2** | 6 |
| Helicóptero ar-ar (Panther) | 180 → **175** | 120 → **140** | 3,2 → **3** / 8 | 6 (míssil) | 70 → **60** | 3 → **2,2** | 6 |
| Helicóptero de transporte (NH90) | 220 → **230** | 150 → **160** | 3,4 → **3,2** / 10 → **9** | 0 | 0 | 1 | 6 |
| Drone de reconhecimento (Patroller) | 90 → **95** | 60 → **70** | 2,4 → **2** / 7 → **6** | 0 | 0 | 1 | 12 → **14** |
| Drone furtivo (nEUROn) | 160 → **170** | 50 → **55** | 2,2 / 6 | 8 → **5** | 35 → **50** | 3 | 12 |

Aviões (custo = casco + munição):

| Avião | Custo | HP | Vel. | Evasão | Flares | Munição |
|---|---|---|---|---|---|---|
| Caça (Mirage 2000) | 610 → **605** | 150 → **140** | 6 → **6,3** | 20% → **25%** | 60 → **60** | MG ×100, AA ×4, ARM ×1 |
| Multifunção (Rafale) | 750 → **760** | 180 → **185** | 5,6 → **5,3** | 30% → **25%** | 60 → **70** | MG ×80, AA ×2, AB ×3, ARM ×1, cruzeiro ×1 |
| Caça furtivo (FCAS) | 1000 → **990** | 180 → **175** | 6,2 → **6** | 30% → **35%** | 60 → **60** | MG ×80, AA ×4, ARM ×2 |
| Bombardeiro (Mirage IV) | 1296 → **1296** | 240 → **200** | 3,5 → **5** | 10% → **20%** | 100 → **80** | comum ×6, frag. ×6, cruzeiro ×3 |

**Mecânicas próprias**
- **GALIX (tanque pesado):** 2 cargas. Ao ser atingido, solta fumaça por 3 s (1 turno): −40% de precisão contra ele, de qualquer atacante. Não intercepta mísseis como o Trophy. Recarrega como o Trophy, em QG/posto.
- **Silhueta pequena (VBL):** −10% de precisão contra ele.
- **Leclerc:** a precisão só começa a cair após 4 casas (verde: 3).
- **Atira e foge (CAESAR):** depois de atirar, +1 Mov no turno (RTS: +30% de velocidade por 3 s).
- **LRU:** salva de 6 foguetes de 14 (84 no total, verde: 4 × 20 = 80). Continua ×2 contra estruturas e com alcance mínimo 3.
- **Tigre:** terceira arma, foguetes em área 3×3: 4 foguetes de 12, 2 salvas, alcance 4, recarga 8 s, ×1,5 contra infantaria e ×0,5 contra veículos e estruturas. Míssil ar-terra: 60, alcance 6, recarga 3,5.
- **Panther:** só míssil ar-ar (sem canhão); **não ataca alvos no solo**.
- **NH90:** 8 vagas a pé, ou 1 batedor (5 vagas) + 3 tropas, dentro da rampa. Não sobe à altitude alta (sem bônus de visão, velocidade ou flares) e não tem armas.
- **A400M:** 10 vagas (verde: 12) e pista curta: pouso e decolagem 30% mais rápidos.
- **nEUROn:** 2 bombas guiadas de 50, 90% de precisão, alcance 5, ×1,5 contra estruturas.
- **Rafale:** leva 1 míssil de cruzeiro SCALP (alcance 67) além da metralhadora.
- **FCAS:** rede de sensores revela drones e aviões furtivos inimigos a até 8 casas dele, em voo.
- **Mirage IV:** supersônico e detectável por radar; 6 bombas comuns, 6 de fragmentação, 3 cruzeiros.

**Eficiência (HP × dano por segundo ÷ custo, contra o verde).** Tanque leve −10%, médio −4%, pesado 0%, CAESAR −25%, VBL −21%, LRU −22%, Gazelle −14%, Tigre −21% (compensam com mobilidade, visão ou foguetes). Acima do verde: Mistral +41%, Panther +20% e nEUROn +48%, em troca de alcance menor ou de não atacar o solo. Equilíbrio provisório, ainda não validado em partidas.
