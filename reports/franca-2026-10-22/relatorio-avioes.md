> **Nota da integração.** Dos ajustes propostos neste relatório foram adotados só os que não põem a França acima do Verde: Mirage IV com 200 de vida e 100 flares, e curva do Rafale em 105°/s. O caça Mirage 2000 (140 de vida) e o furtivo FCAS (175) ficaram como antes, porque o relatório mostra que subir a vida deles deixaria a França muito acima do Verde (F/V 6,8 no caça). A inversão Verde < Vermelho no caça e no furtivo já existia e fica como pendência: o Verde não é o melhor em caças neste simulador.

# Equilíbrio dos aviões: França (Azul) × Verde × Vermelho

Medido por `scripts/faction-air-balance.cjs` (150 sementes × 2 lados por par; `node scripts/faction-air-balance.cjs --seeds 150 --md saida.md`).
Para medir outra versão do motor: `--engine caminho/engine.js`; para testar uma ficha sem editar o motor: `--set fighterFr.hp=190`.

## Resumo

Meta: Verde > Vermelho ≥ França, com a França a no máximo 15% do Vermelho em eficácia por crédito (razão França/Vermelho entre 0,85 e 1,05; o alvo é "um pouco abaixo", ~0,9).

| Papel | França/Vermelho antes | França/Vermelho depois | Mudança na França |
|---|---:|---:|---|
| Caça (Mirage 2000) | 0,09 | **0,89** | vida 140 → 175; curva fechada 115 → 130°/s (igual ao caça vermelho) |
| Multifunção (Rafale) | 1,30 | **0,89** | curva 125 → 105°/s (o multifunção vermelho tem 100°/s); vida igual (185) |
| Caça furtivo (FCAS) | 0,71 | **0,88** | vida 175 → 225 |
| Bombardeiro (Mirage IV) | 1,56 | **0,97** | vida 260 → 200 (flares 100 e 4 cruzeiros de alcance 75 mantidos) |

Custos não mudaram (630 / 785 / 990 / 1356), todos dentro de ±10% do equivalente Verde (a mudança é só vida e curva). Verde e Vermelho, e as demais unidades, ficaram intactos.

## Valores finais dos aviões franceses

| Modelo | Custo | Vida | Vel. | Evasão | Flares | Curva (°/s) | Munição |
|---|---:|---:|---:|---:|---:|---:|---|
| fighterFr | 630 | 175 | 6,5 | 25% | 60 | 130 | ar-ar ×4, antirradiação ×2, MG ×100 |
| multiroleFr | 785 | 185 | 6 | 25% | 70 | 105 | ar-ar ×2, antiblindado ×3, antirradiação ×2, cruzeiro ×1 |
| stealthFighterFr | 990 | 225 | 5,7 | 35% | 60 | 120 | ar-ar ×4, antirradiação ×2 |
| bomberFr | 1356 | 200 | 5 | 20% | 100 | 75 | comum ×6, frag. ×6, cruzeiro ×4 (alcance 75) |

A curva (`planeTurnRate`, tabela por modelo em `public/js/engine.js`) é o que decide os duelos de curva: o caça vermelho (130°/s) vence o verde (100°/s) em 96% dos duelos mesmo com o verde melhor em mísseis. Só vida e velocidade não bastavam para aproximar o Mirage 2000 do caça vermelho sem derrubar a velocidade (6,5) ou levar a vida a ~220; por isso a curva foi usada, que é uma propriedade dos próprios modelos franceses.

## Como a eficácia é medida

- **Análise analítica** (por avião): custo, vida, dano esperado por crédito (dano da arma em `planeWeapon` × precisão em `accuracy`), vida por crédito, vida efetiva (vida ÷ (1 − evasão)) por crédito e um índice √(dano × vida efetiva)/custo.
- **Duelos 1×1** (caça, multifunção, furtivo): dois aviões a 11 casas, ordens `attack` com salva de 2 reemitidas enquanto o avião estiver livre; 60 s; lados trocados. Eficácia = √(vitórias por crédito × troca de valor), onde troca = (fração de vida perdida × custo do oponente) ÷ (o mesmo para si). 1 = equivalentes por crédito.
- **Multifunção**: o Vermelho paga por munição ar-solo que o duelo aéreo não usa; por isso a eficácia final é √(eficácia aérea × razão de dano ao solo por crédito).
- **Bombardeiro**: cruzeiros primeiro (fora do alcance da defesa), depois uma passada de bombas sobre o grupo antiaéreo (veículos antiaéreos + soldados lançadores da facção defensora; metade do orçamento em cada). Orçamento da defesa = 100%, 50% e 25% do custo do bombardeiro. "Retorno por crédito" = 1 + (valor destruído − valor perdido) ÷ custo. O veredito usa a defesa de 50%, porque contra a de custo igual todos os bombardeiros morrem (retorno ≈ 0,02–0,04) e a diferença some.

## Pontos de atenção (fora do escopo, não alterados)

- **Caça e furtivo Verde < Vermelho.** O caça verde perde 96% dos duelos para o vermelho (curva 100 contra 130°/s) e o furtivo verde 70%. A ordem Verde > Vermelho só vale no multifunção e no bombardeiro. Como a França foi calibrada pelo Vermelho, o caça francês ficou muito acima do caça verde (F/V 6,8). Para a ordem completa seria preciso mexer no Verde (por exemplo curva do caça verde 100 → 130).
- **Bombardeiro vermelho** tem casco 100 (custo 1164 com 48 bombas e 6 cruzeiros): 3,0 de dano esperado por crédito, contra 0,72 do verde e 1,05 do francês. Parece erro de digitação (casco 1000?). A medição por defesa antiaérea quase não mostra isso porque todos morrem antes de largar a carga; no uso real o Vermelho é muito mais eficaz. A França não alcança isso dentro de ±10% de custo do Verde.
- Os duelos são caóticos perto de velocidades iguais (por exemplo furtivo francês a 5,8, igual ao vermelho, mudava a taxa de vitória em dezenas de pontos); por isso a velocidade não foi usada como alavanca e as medições finais usam 150 sementes.
- Os valores de "Antes" já incluem o ajuste do Mirage IV (vida 260, flares 100, 4 cruzeiros) do commit 5a020d2.

---

# Medição antes

Base 9cc8d62, sem as mudanças deste relatório.

## Análise analítica (funções do motor: dano de `planeWeapon`, precisão de `accuracy`, evasão-padrão 0.25)

Dano esperado = soma por arma de munição × dano × precisão (antiar-ar contra caça com evasão 0.25; antirradiação contra antiaéreo; antiblindado ×1,5 contra tanque; cruzeiro e bombas contra tanque). Índice = √(dano × (vida/(1−evasão)))/custo × 100.

| Modelo | Facção | Custo | Vida | Vel. | Evasão | Flares | Dano ar-ar | Dano solo | Dano/crédito | Vida/crédito | Vida efet./crédito | Índice |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fighterBlue | verde | 660 | 150 | 6 | 0.2 | 60 | 243.0 | 256.0 | 0.756 | 0.227 | 0.284 | 46.3 |
| fighterRed | vermelho | 610 | 160 | 5.4 | 0.3 | 60 | 180.0 | 153.0 | 0.546 | 0.262 | 0.375 | 45.2 |
| fighterFr | franca | 630 | 140 | 6.5 | 0.25 | 60 | 189.0 | 132.0 | 0.510 | 0.222 | 0.296 | 38.9 |
| multiroleBlue | verde | 850 | 180 | 5.6 | 0.3 | 60 | 108.0 | 884.0 | 1.167 | 0.212 | 0.303 | 59.4 |
| multiroleRed | vermelho | 895 | 200 | 4.8 | 0.2 | 80 | 102.0 | 729.0 | 0.928 | 0.223 | 0.279 | 50.9 |
| multiroleFr | franca | 785 | 185 | 6 | 0.25 | 70 | 78.0 | 542.4 | 0.790 | 0.236 | 0.314 | 49.8 |
| stealthFighterBlue | verde | 1000 | 180 | 6.2 | 0.3 | 60 | 364.5 | 128.0 | 0.492 | 0.180 | 0.257 | 35.6 |
| stealthFighterRed | vermelho | 1030 | 190 | 5.8 | 0.35 | 60 | 270.0 | 153.0 | 0.411 | 0.184 | 0.284 | 34.1 |
| stealthFighterFr | franca | 990 | 175 | 5.7 | 0.35 | 60 | 189.0 | 132.0 | 0.324 | 0.177 | 0.272 | 29.7 |
| bomberBlue | verde | 1296 | 240 | 3.5 | 0.1 | 100 | 0.0 | 930.0 | 0.718 | 0.185 | 0.206 | 38.4 |
| bomberRed | vermelho | 1164 | 340 | 3 | 0.1 | 120 | 0.0 | 3480.0 | 2.990 | 0.292 | 0.325 | 98.5 |
| bomberFr | franca | 1356 | 260 | 5 | 0.2 | 100 | 0.0 | 1424.0 | 1.050 | 0.192 | 0.240 | 50.2 |

Razão do índice analítico por papel (alvo: Verde > Vermelho ≥ França, França ≥ 0,85 × Vermelho):

| Papel | Verde/Vermelho | França/Vermelho | França/Verde | Custo FR/Verde |
|---|---:|---:|---:|---:|
| Caça | 1.02 | 0.86 | 0.84 | 0.95 |
| Multifunção | 1.17 | 0.98 | 0.84 | 0.92 |
| Caça furtivo | 1.04 | 0.87 | 0.83 | 0.99 |
| Bombardeiro | 0.39 | 0.51 | 1.31 | 1.05 |

## Duelos 1×1 no ar (caça, multifunção, furtivo), 150 sementes × 2 lados = 300 duelos por par

Vitória = 1 se só o oponente cai, 0,5 se ambos vivos/mortos. Troca = valor em créditos destruído no oponente (fração de vida perdida × custo) ÷ valor perdido por si. Vit./crédito = razão de vitórias normalizada pelo custo. Eficácia = √(vit./crédito × troca); > 1 favorece o primeiro, 1 = equivalentes por crédito.

| Papel | Par (1º × 2º) | Custos | Vitória 1º | Troca 1º/2º | Eficácia 1º/2º |
|---|---|---|---:|---:|---:|
| Caça | verde × vermelho | 660 × 610 | 4% | 0.24 | 0.10 |
| Caça | franca × verde | 630 × 660 | 85% | 3.83 | 4.80 |
| Caça | franca × vermelho | 630 × 610 | 3% | 0.26 | 0.09 |
| Multifunção | verde × vermelho | 850 × 895 | 77% | 1.85 | 2.53 |
| Multifunção | franca × verde | 785 × 850 | 48% | 1.15 | 1.07 |
| Multifunção | franca × vermelho | 785 × 895 | 68% | 1.61 | 1.99 |
| Caça furtivo | verde × vermelho | 1000 × 1030 | 30% | 0.82 | 0.60 |
| Caça furtivo | franca × verde | 990 × 1000 | 42% | 0.77 | 0.75 |
| Caça furtivo | franca × vermelho | 990 × 1030 | 39% | 0.76 | 0.71 |

## Bombardeiro contra defesa antiaérea terrestre

Cada bombardeiro lança primeiro os mísseis de cruzeiro (fora do alcance da defesa) e depois uma passada de bombas sobre o grupo. Defesa = veículos antiaéreos + soldados lançadores da facção defensora, orçamento = fração do custo do bombardeiro (100% = custo igual). Líquido/crédito = (valor destruído − valor perdido do bombardeiro) ÷ custo do bombardeiro; vitória = líquido > 0.

| Bombardeiro | Defesa | Orçamento | Sobrevive | Munição gasta | Valor destruído | Líquido/crédito | Vitória |
|---|---|---:|---:|---:|---:|---:|---:|
| bomberBlue | verde | 100% | 0% | 18% | 27 | -0.98 | 0% |
| bomberBlue | vermelho | 100% | 0% | 20% | 33 | -0.97 | 0% |
| bomberBlue | franca | 100% | 0% | 17% | 24 | -0.98 | 0% |
| bomberRed | verde | 100% | 0% | 12% | 36 | -0.97 | 0% |
| bomberRed | vermelho | 100% | 0% | 12% | 33 | -0.97 | 0% |
| bomberRed | franca | 100% | 0% | 12% | 31 | -0.97 | 0% |
| bomberFr | verde | 100% | 0% | 33% | 66 | -0.95 | 0% |
| bomberFr | vermelho | 100% | 0% | 31% | 50 | -0.96 | 0% |
| bomberFr | franca | 100% | 0% | 29% | 43 | -0.97 | 0% |
| bomberBlue | verde | 50% | 22% | 68% | 212 | -0.77 | 1% |
| bomberBlue | vermelho | 50% | 34% | 78% | 250 | -0.71 | 3% |
| bomberBlue | franca | 50% | 26% | 65% | 211 | -0.75 | 2% |
| bomberRed | verde | 50% | 24% | 66% | 215 | -0.76 | 1% |
| bomberRed | vermelho | 50% | 29% | 55% | 188 | -0.78 | 0% |
| bomberRed | franca | 50% | 7% | 49% | 178 | -0.83 | 1% |
| bomberFr | verde | 50% | 47% | 85% | 273 | -0.64 | 1% |
| bomberFr | vermelho | 50% | 39% | 84% | 269 | -0.69 | 2% |
| bomberFr | franca | 50% | 32% | 74% | 240 | -0.70 | 3% |
| bomberBlue | verde | 25% | 98% | 100% | 147 | -0.25 | 23% |
| bomberBlue | vermelho | 25% | 99% | 100% | 147 | -0.19 | 29% |
| bomberBlue | franca | 25% | 93% | 98% | 146 | -0.34 | 21% |
| bomberRed | verde | 25% | 88% | 95% | 174 | -0.47 | 2% |
| bomberRed | vermelho | 25% | 81% | 89% | 163 | -0.57 | 1% |
| bomberRed | franca | 25% | 77% | 92% | 166 | -0.52 | 8% |
| bomberFr | verde | 25% | 90% | 99% | 149 | -0.47 | 7% |
| bomberFr | vermelho | 25% | 81% | 97% | 145 | -0.61 | 1% |
| bomberFr | franca | 25% | 82% | 95% | 147 | -0.52 | 7% |

Retorno por crédito = 1 + líquido/crédito (valor destruído + o que sobra do bombardeiro, ÷ custo), média contra as três defesas:

| Bombardeiro | Defesa 100% | Defesa 50% | Defesa 25% |
|---|---:|---:|---:|
| bomberBlue | 0.02 | 0.26 | 0.74 |
| bomberRed | 0.03 | 0.21 | 0.48 |
| bomberFr | 0.04 | 0.33 | 0.47 |

## Veredito

Eficácia por crédito (razão): V/R = Verde ÷ Vermelho, F/R = França ÷ Vermelho, F/V = França ÷ Verde. Meta: V/R > 1, 0,85 ≤ F/R ≤ 1,05, F/V < 1.

| Papel | Medida | V/R | F/R | F/V | Verde > Vermelho | França ≤ 1,05 × Vermelho | França ≥ 0,85 × Vermelho |
|---|---|---:|---:|---:|---|---|---|
| Caça | eficácia do duelo | 0.10 | 0.09 | 4.80 | NÃO | sim | NÃO |
| Multifunção | √(eficácia aérea × dano solo/crédito) | 1.80 | 1.30 | 0.84 | sim | NÃO | sim |
| Caça furtivo | eficácia do duelo | 0.60 | 0.71 | 0.75 | NÃO | sim | NÃO |
| Bombardeiro | retorno por crédito (defesa 50%) | 1.23 | 1.56 | 1.27 | sim | NÃO | sim |

---

# Medição depois

Com as mudanças deste relatório.

## Análise analítica (funções do motor: dano de `planeWeapon`, precisão de `accuracy`, evasão-padrão 0.25)

Dano esperado = soma por arma de munição × dano × precisão (antiar-ar contra caça com evasão 0.25; antirradiação contra antiaéreo; antiblindado ×1,5 contra tanque; cruzeiro e bombas contra tanque). Índice = √(dano × (vida/(1−evasão)))/custo × 100.

| Modelo | Facção | Custo | Vida | Vel. | Evasão | Flares | Dano ar-ar | Dano solo | Dano/crédito | Vida/crédito | Vida efet./crédito | Índice |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fighterBlue | verde | 660 | 150 | 6 | 0.2 | 60 | 243.0 | 256.0 | 0.756 | 0.227 | 0.284 | 46.3 |
| fighterRed | vermelho | 610 | 160 | 5.4 | 0.3 | 60 | 180.0 | 153.0 | 0.546 | 0.262 | 0.375 | 45.2 |
| fighterFr | franca | 630 | 175 | 6.5 | 0.25 | 60 | 189.0 | 132.0 | 0.510 | 0.278 | 0.370 | 43.4 |
| multiroleBlue | verde | 850 | 180 | 5.6 | 0.3 | 60 | 108.0 | 884.0 | 1.167 | 0.212 | 0.303 | 59.4 |
| multiroleRed | vermelho | 895 | 200 | 4.8 | 0.2 | 80 | 102.0 | 729.0 | 0.928 | 0.223 | 0.279 | 50.9 |
| multiroleFr | franca | 785 | 185 | 6 | 0.25 | 70 | 78.0 | 542.4 | 0.790 | 0.236 | 0.314 | 49.8 |
| stealthFighterBlue | verde | 1000 | 180 | 6.2 | 0.3 | 60 | 364.5 | 128.0 | 0.492 | 0.180 | 0.257 | 35.6 |
| stealthFighterRed | vermelho | 1030 | 190 | 5.8 | 0.35 | 60 | 270.0 | 153.0 | 0.411 | 0.184 | 0.284 | 34.1 |
| stealthFighterFr | franca | 990 | 225 | 5.7 | 0.35 | 60 | 189.0 | 132.0 | 0.324 | 0.227 | 0.350 | 33.7 |
| bomberBlue | verde | 1296 | 240 | 3.5 | 0.1 | 100 | 0.0 | 930.0 | 0.718 | 0.185 | 0.206 | 38.4 |
| bomberRed | vermelho | 1164 | 340 | 3 | 0.1 | 120 | 0.0 | 3480.0 | 2.990 | 0.292 | 0.325 | 98.5 |
| bomberFr | franca | 1356 | 200 | 5 | 0.2 | 100 | 0.0 | 1424.0 | 1.050 | 0.147 | 0.184 | 44.0 |

Razão do índice analítico por papel (alvo: Verde > Vermelho ≥ França, França ≥ 0,85 × Vermelho):

| Papel | Verde/Vermelho | França/Vermelho | França/Verde | Custo FR/Verde |
|---|---:|---:|---:|---:|
| Caça | 1.02 | 0.96 | 0.94 | 0.95 |
| Multifunção | 1.17 | 0.98 | 0.84 | 0.92 |
| Caça furtivo | 1.04 | 0.99 | 0.95 | 0.99 |
| Bombardeiro | 0.39 | 0.45 | 1.15 | 1.05 |

## Duelos 1×1 no ar (caça, multifunção, furtivo), 150 sementes × 2 lados = 300 duelos por par

Vitória = 1 se só o oponente cai, 0,5 se ambos vivos/mortos. Troca = valor em créditos destruído no oponente (fração de vida perdida × custo) ÷ valor perdido por si. Vit./crédito = razão de vitórias normalizada pelo custo. Eficácia = √(vit./crédito × troca); > 1 favorece o primeiro, 1 = equivalentes por crédito.

| Papel | Par (1º × 2º) | Custos | Vitória 1º | Troca 1º/2º | Eficácia 1º/2º |
|---|---|---|---:|---:|---:|
| Caça | verde × vermelho | 660 × 610 | 4% | 0.24 | 0.10 |
| Caça | franca × verde | 630 × 660 | 90% | 5.03 | 6.76 |
| Caça | franca × vermelho | 630 × 610 | 48% | 0.88 | 0.89 |
| Multifunção | verde × vermelho | 850 × 895 | 77% | 1.85 | 2.53 |
| Multifunção | franca × verde | 785 × 850 | 22% | 0.70 | 0.46 |
| Multifunção | franca × vermelho | 785 × 895 | 42% | 1.06 | 0.94 |
| Caça furtivo | verde × vermelho | 1000 × 1030 | 30% | 0.82 | 0.60 |
| Caça furtivo | franca × verde | 990 × 1000 | 56% | 1.00 | 1.13 |
| Caça furtivo | franca × vermelho | 990 × 1030 | 44% | 0.95 | 0.88 |

## Bombardeiro contra defesa antiaérea terrestre

Cada bombardeiro lança primeiro os mísseis de cruzeiro (fora do alcance da defesa) e depois uma passada de bombas sobre o grupo. Defesa = veículos antiaéreos + soldados lançadores da facção defensora, orçamento = fração do custo do bombardeiro (100% = custo igual). Líquido/crédito = (valor destruído − valor perdido do bombardeiro) ÷ custo do bombardeiro; vitória = líquido > 0.

| Bombardeiro | Defesa | Orçamento | Sobrevive | Munição gasta | Valor destruído | Líquido/crédito | Vitória |
|---|---|---:|---:|---:|---:|---:|---:|
| bomberBlue | verde | 100% | 0% | 18% | 27 | -0.98 | 0% |
| bomberBlue | vermelho | 100% | 0% | 20% | 33 | -0.97 | 0% |
| bomberBlue | franca | 100% | 0% | 17% | 24 | -0.98 | 0% |
| bomberRed | verde | 100% | 0% | 12% | 36 | -0.97 | 0% |
| bomberRed | vermelho | 100% | 0% | 12% | 33 | -0.97 | 0% |
| bomberRed | franca | 100% | 0% | 12% | 31 | -0.97 | 0% |
| bomberFr | verde | 100% | 0% | 28% | 39 | -0.97 | 0% |
| bomberFr | vermelho | 100% | 0% | 27% | 32 | -0.98 | 0% |
| bomberFr | franca | 100% | 0% | 27% | 28 | -0.98 | 0% |
| bomberBlue | verde | 50% | 22% | 68% | 212 | -0.77 | 1% |
| bomberBlue | vermelho | 50% | 34% | 78% | 250 | -0.71 | 3% |
| bomberBlue | franca | 50% | 26% | 65% | 211 | -0.75 | 2% |
| bomberRed | verde | 50% | 24% | 66% | 215 | -0.76 | 1% |
| bomberRed | vermelho | 50% | 29% | 55% | 188 | -0.78 | 0% |
| bomberRed | franca | 50% | 7% | 49% | 178 | -0.83 | 1% |
| bomberFr | verde | 50% | 25% | 68% | 210 | -0.78 | 1% |
| bomberFr | vermelho | 50% | 17% | 64% | 201 | -0.80 | 2% |
| bomberFr | franca | 50% | 16% | 54% | 165 | -0.82 | 2% |
| bomberBlue | verde | 25% | 98% | 100% | 147 | -0.25 | 23% |
| bomberBlue | vermelho | 25% | 99% | 100% | 147 | -0.19 | 29% |
| bomberBlue | franca | 25% | 93% | 98% | 146 | -0.34 | 21% |
| bomberRed | verde | 25% | 88% | 95% | 174 | -0.47 | 2% |
| bomberRed | vermelho | 25% | 81% | 89% | 163 | -0.57 | 1% |
| bomberRed | franca | 25% | 77% | 92% | 166 | -0.52 | 8% |
| bomberFr | verde | 25% | 67% | 89% | 125 | -0.62 | 5% |
| bomberFr | vermelho | 25% | 53% | 88% | 125 | -0.76 | 1% |
| bomberFr | franca | 25% | 51% | 80% | 117 | -0.67 | 7% |

Retorno por crédito = 1 + líquido/crédito (valor destruído + o que sobra do bombardeiro, ÷ custo), média contra as três defesas:

| Bombardeiro | Defesa 100% | Defesa 50% | Defesa 25% |
|---|---:|---:|---:|
| bomberBlue | 0.02 | 0.26 | 0.74 |
| bomberRed | 0.03 | 0.21 | 0.48 |
| bomberFr | 0.02 | 0.20 | 0.32 |

## Veredito

Eficácia por crédito (razão): V/R = Verde ÷ Vermelho, F/R = França ÷ Vermelho, F/V = França ÷ Verde. Meta: V/R > 1, 0,85 ≤ F/R ≤ 1,05, F/V < 1.

| Papel | Medida | V/R | F/R | F/V | Verde > Vermelho | França ≤ 1,05 × Vermelho | França ≥ 0,85 × Vermelho |
|---|---|---:|---:|---:|---|---|---|
| Caça | eficácia do duelo | 0.10 | 0.89 | 6.76 | NÃO | sim | sim |
| Multifunção | √(eficácia aérea × dano solo/crédito) | 1.80 | 0.89 | 0.55 | sim | sim | sim |
| Caça furtivo | eficácia do duelo | 0.60 | 0.88 | 1.13 | NÃO | sim | sim |
| Bombardeiro | retorno por crédito (defesa 50%) | 1.23 | 0.97 | 0.79 | sim | sim | sim |
