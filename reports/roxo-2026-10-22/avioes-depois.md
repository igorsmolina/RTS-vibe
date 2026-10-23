## Depois

### Análise analítica (funções do motor: dano de `planeWeapon`, precisão de `accuracy`, evasão-padrão 0.25)

Dano esperado = soma por arma de munição × dano × precisão (antiar-ar contra caça com evasão 0.25; antirradiação contra antiaéreo; antiblindado ×1,5 contra tanque; cruzeiro e bombas contra tanque). Índice = √(dano × (vida/(1−evasão)))/custo × 100.

| Modelo | Facção | Custo | Vida | Vel. | Evasão | Flares | Dano ar-ar | Dano solo | Dano/crédito | Vida/crédito | Vida efet./crédito | Índice |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fighterBlue | verde | 660 | 150 | 6 | 0.2 | 60 | 243.0 | 256.0 | 0.756 | 0.227 | 0.284 | 46.3 |
| fighterRed | vermelho | 610 | 160 | 5.4 | 0.3 | 60 | 180.0 | 153.0 | 0.546 | 0.262 | 0.375 | 45.2 |
| fighterRoxo | roxo | 615 | 165 | 5.8 | 0.25 | 60 | 229.5 | 198.0 | 0.695 | 0.268 | 0.358 | 49.9 |
| multiroleBlue | verde | 850 | 180 | 5.6 | 0.3 | 60 | 108.0 | 884.0 | 1.167 | 0.212 | 0.303 | 59.4 |
| multiroleRed | vermelho | 895 | 200 | 4.8 | 0.2 | 80 | 102.0 | 729.0 | 0.928 | 0.223 | 0.279 | 50.9 |
| multiroleRoxo | roxo | 800 | 165 | 5.4 | 0.25 | 70 | 102.0 | 693.0 | 0.994 | 0.206 | 0.275 | 52.3 |
| stealthFighterBlue | verde | 1000 | 180 | 6.2 | 0.3 | 60 | 364.5 | 128.0 | 0.492 | 0.180 | 0.257 | 35.6 |
| stealthFighterRed | vermelho | 1030 | 190 | 5.8 | 0.35 | 60 | 270.0 | 153.0 | 0.411 | 0.184 | 0.284 | 34.1 |
| stealthFighterRoxo | roxo | 990 | 175 | 6 | 0.3 | 60 | 286.9 | 132.0 | 0.423 | 0.177 | 0.253 | 32.7 |
| bomberBlue | verde | 1296 | 240 | 3.5 | 0.1 | 100 | 0.0 | 930.0 | 0.718 | 0.185 | 0.206 | 38.4 |
| bomberRed | vermelho | 1164 | 340 | 3 | 0.1 | 120 | 0.0 | 3480.0 | 2.990 | 0.292 | 0.325 | 98.5 |
| bomberRoxo | roxo | 1276 | 195 | 3.8 | 0.1 | 100 | 0.0 | 930.0 | 0.729 | 0.153 | 0.170 | 35.2 |

Razão do índice analítico por papel (alvo: Verde > Vermelho ≥ Roxo, Roxo ≥ 0,85 × Vermelho):

| Papel | Verde/Vermelho | Roxo/Vermelho | Roxo/Verde | Custo P/Verde |
|---|---:|---:|---:|---:|
| Caça | 1.02 | 1.10 | 1.08 | 0.93 |
| Multifunção | 1.17 | 1.03 | 0.88 | 0.94 |
| Caça furtivo | 1.04 | 0.96 | 0.92 | 0.99 |
| Bombardeiro | 0.39 | 0.36 | 0.92 | 0.98 |

### Duelos 1×1 no ar (caça, multifunção, furtivo), 60 sementes × 2 lados = 120 duelos por par

Vitória = 1 se só o oponente cai, 0,5 se ambos vivos/mortos. Troca = valor em créditos destruído no oponente (fração de vida perdida × custo) ÷ valor perdido por si. Vit./crédito = razão de vitórias normalizada pelo custo. Eficácia = √(vit./crédito × troca); > 1 favorece o primeiro, 1 = equivalentes por crédito.

| Papel | Par (1º × 2º) | Custos | Vitória 1º | Troca 1º/2º | Eficácia 1º/2º |
|---|---|---|---:|---:|---:|
| Caça | roxo × verde | 615 × 660 | 29% | 0.48 | 0.46 |
| Caça | roxo × vermelho | 615 × 610 | 3% | 0.31 | 0.10 |
| Multifunção | roxo × verde | 800 × 850 | 31% | 0.66 | 0.56 |
| Multifunção | roxo × vermelho | 800 × 895 | 39% | 1.01 | 0.85 |
| Caça furtivo | roxo × verde | 990 × 1000 | 30% | 0.60 | 0.51 |
| Caça furtivo | roxo × vermelho | 990 × 1030 | 42% | 1.12 | 0.91 |

### Bombardeiro contra defesa antiaérea terrestre

Cada bombardeiro lança primeiro os mísseis de cruzeiro (fora do alcance da defesa) e depois uma passada de bombas sobre o grupo. Defesa = veículos antiaéreos + soldados lançadores da facção defensora, orçamento = fração do custo do bombardeiro (100% = custo igual). Líquido/crédito = (valor destruído − valor perdido do bombardeiro) ÷ custo do bombardeiro; vitória = líquido > 0.

| Bombardeiro | Defesa | Orçamento | Sobrevive | Munição gasta | Valor destruído | Líquido/crédito | Vitória |
|---|---|---:|---:|---:|---:|---:|---:|
| bomberBlue | verde | 100% | 0% | 18% | 22 | -0.98 | 0% |
| bomberBlue | vermelho | 100% | 0% | 18% | 24 | -0.98 | 0% |
| bomberBlue | roxo | 100% | 0% | 18% | 21 | -0.98 | 0% |
| bomberRed | verde | 100% | 0% | 12% | 38 | -0.97 | 0% |
| bomberRed | vermelho | 100% | 0% | 12% | 32 | -0.97 | 0% |
| bomberRed | roxo | 100% | 0% | 12% | 37 | -0.97 | 0% |
| bomberRoxo | verde | 100% | 0% | 16% | 0 | -1.00 | 0% |
| bomberRoxo | vermelho | 100% | 0% | 15% | 2 | -1.00 | 0% |
| bomberRoxo | roxo | 100% | 0% | 16% | -1 | -1.00 | 0% |
| bomberBlue | verde | 50% | 15% | 64% | 205 | -0.78 | 3% |
| bomberBlue | vermelho | 50% | 33% | 75% | 241 | -0.73 | 2% |
| bomberBlue | roxo | 50% | 10% | 58% | 196 | -0.82 | 0% |
| bomberRed | verde | 50% | 25% | 71% | 228 | -0.76 | 0% |
| bomberRed | vermelho | 50% | 30% | 56% | 186 | -0.79 | 0% |
| bomberRed | roxo | 50% | 25% | 71% | 227 | -0.76 | 0% |
| bomberRoxo | verde | 50% | 28% | 50% | 150 | -0.77 | 3% |
| bomberRoxo | vermelho | 50% | 33% | 56% | 164 | -0.73 | 5% |
| bomberRoxo | roxo | 50% | 10% | 47% | 140 | -0.86 | 0% |
| bomberBlue | verde | 25% | 97% | 100% | 139 | -0.35 | 12% |
| bomberBlue | vermelho | 25% | 98% | 100% | 140 | -0.29 | 13% |
| bomberBlue | roxo | 25% | 97% | 99% | 135 | -0.35 | 10% |
| bomberRed | verde | 25% | 87% | 93% | 174 | -0.51 | 3% |
| bomberRed | vermelho | 25% | 77% | 85% | 156 | -0.61 | 2% |
| bomberRed | roxo | 25% | 87% | 93% | 174 | -0.51 | 3% |
| bomberRoxo | verde | 25% | 93% | 95% | 133 | -0.38 | 5% |
| bomberRoxo | vermelho | 25% | 98% | 99% | 139 | -0.32 | 12% |
| bomberRoxo | roxo | 25% | 88% | 93% | 127 | -0.48 | 5% |

Retorno por crédito = 1 + líquido/crédito (valor destruído + o que sobra do bombardeiro, ÷ custo), média contra as três defesas:

| Bombardeiro | Defesa 100% | Defesa 50% | Defesa 25% |
|---|---:|---:|---:|
| bomberBlue | 0.02 | 0.22 | 0.67 |
| bomberRed | 0.03 | 0.23 | 0.46 |
| bomberRoxo | 0.00 | 0.21 | 0.61 |

### Veredito

Eficácia por crédito (razão): V/R = Verde ÷ Vermelho, P/R = Roxo ÷ Vermelho, P/V = Roxo ÷ Verde. Meta: V/R > 1, 0,85 ≤ P/R ≤ 1,05, P/V < 1.

| Papel | Medida | V/R | P/R | P/V | Verde > Vermelho | Roxo ≤ 1,05 × Vermelho | Roxo ≥ 0,85 × Vermelho |
|---|---|---:|---:|---:|---|---|---|
| Caça | eficácia do duelo | NaN | 0.10 | 0.46 | NÃO | sim | NÃO |
| Multifunção | √(eficácia aérea × dano solo/crédito) | NaN | 0.95 | 0.68 | NÃO | sim | sim |
| Caça furtivo | eficácia do duelo | NaN | 0.91 | 0.51 | NÃO | sim | sim |
| Bombardeiro | retorno por crédito (defesa 50%) | 0.97 | 0.92 | 0.96 | NÃO | sim | sim |
