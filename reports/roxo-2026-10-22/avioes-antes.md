## Antes

### Análise analítica (funções do motor: dano de `planeWeapon`, precisão de `accuracy`, evasão-padrão 0.25)

Dano esperado = soma por arma de munição × dano × precisão (antiar-ar contra caça com evasão 0.25; antirradiação contra antiaéreo; antiblindado ×1,5 contra tanque; cruzeiro e bombas contra tanque). Índice = √(dano × (vida/(1−evasão)))/custo × 100.

| Modelo | Facção | Custo | Vida | Vel. | Evasão | Flares | Dano ar-ar | Dano solo | Dano/crédito | Vida/crédito | Vida efet./crédito | Índice |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fighterBlue | verde | 660 | 150 | 6 | 0.2 | 60 | 243.0 | 256.0 | 0.756 | 0.227 | 0.284 | 46.3 |
| fighterRed | vermelho | 610 | 160 | 5.4 | 0.3 | 60 | 180.0 | 153.0 | 0.546 | 0.262 | 0.375 | 45.2 |
| fighterRoxo | roxo | 615 | 145 | 5.8 | 0.25 | 60 | 229.5 | 198.0 | 0.695 | 0.236 | 0.314 | 46.7 |
| multiroleBlue | verde | 850 | 180 | 5.6 | 0.3 | 60 | 108.0 | 884.0 | 1.167 | 0.212 | 0.303 | 59.4 |
| multiroleRed | vermelho | 895 | 200 | 4.8 | 0.2 | 80 | 102.0 | 729.0 | 0.928 | 0.223 | 0.279 | 50.9 |
| multiroleRoxo | roxo | 800 | 175 | 5.4 | 0.25 | 70 | 102.0 | 693.0 | 0.994 | 0.219 | 0.292 | 53.8 |
| stealthFighterBlue | verde | 1000 | 180 | 6.2 | 0.3 | 60 | 364.5 | 128.0 | 0.492 | 0.180 | 0.257 | 35.6 |
| stealthFighterRed | vermelho | 1030 | 190 | 5.8 | 0.35 | 60 | 270.0 | 153.0 | 0.411 | 0.184 | 0.284 | 34.1 |
| stealthFighterRoxo | roxo | 990 | 175 | 6 | 0.3 | 60 | 286.9 | 132.0 | 0.423 | 0.177 | 0.253 | 32.7 |
| bomberBlue | verde | 1296 | 240 | 3.5 | 0.1 | 100 | 0.0 | 930.0 | 0.718 | 0.185 | 0.206 | 38.4 |
| bomberRed | vermelho | 1164 | 340 | 3 | 0.1 | 120 | 0.0 | 3480.0 | 2.990 | 0.292 | 0.325 | 98.5 |
| bomberRoxo | roxo | 1276 | 260 | 3.8 | 0.1 | 100 | 0.0 | 930.0 | 0.729 | 0.204 | 0.226 | 40.6 |

Razão do índice analítico por papel (alvo: Verde > Vermelho ≥ Roxo, Roxo ≥ 0,85 × Vermelho):

| Papel | Verde/Vermelho | Roxo/Vermelho | Roxo/Verde | Custo P/Verde |
|---|---:|---:|---:|---:|
| Caça | 1.02 | 1.03 | 1.01 | 0.93 |
| Multifunção | 1.17 | 1.06 | 0.91 | 0.94 |
| Caça furtivo | 1.04 | 0.96 | 0.92 | 0.99 |
| Bombardeiro | 0.39 | 0.41 | 1.06 | 0.98 |

### Duelos 1×1 no ar (caça, multifunção, furtivo), 60 sementes × 2 lados = 120 duelos por par

Vitória = 1 se só o oponente cai, 0,5 se ambos vivos/mortos. Troca = valor em créditos destruído no oponente (fração de vida perdida × custo) ÷ valor perdido por si. Vit./crédito = razão de vitórias normalizada pelo custo. Eficácia = √(vit./crédito × troca); > 1 favorece o primeiro, 1 = equivalentes por crédito.

| Papel | Par (1º × 2º) | Custos | Vitória 1º | Troca 1º/2º | Eficácia 1º/2º |
|---|---|---|---:|---:|---:|
| Caça | roxo × verde | 615 × 660 | 77% | 2.47 | 2.95 |
| Caça | roxo × vermelho | 615 × 610 | 2% | 0.23 | 0.07 |
| Multifunção | roxo × verde | 800 × 850 | 38% | 0.79 | 0.72 |
| Multifunção | roxo × vermelho | 800 × 895 | 65% | 1.75 | 1.91 |
| Caça furtivo | roxo × verde | 990 × 1000 | 49% | 0.99 | 0.98 |
| Caça furtivo | roxo × vermelho | 990 × 1030 | 68% | 2.52 | 2.38 |

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
| bomberRoxo | verde | 100% | 0% | 17% | 7 | -0.99 | 0% |
| bomberRoxo | vermelho | 100% | 0% | 22% | 31 | -0.98 | 0% |
| bomberRoxo | roxo | 100% | 0% | 17% | 7 | -0.99 | 0% |
| bomberBlue | verde | 50% | 15% | 64% | 205 | -0.78 | 3% |
| bomberBlue | vermelho | 50% | 33% | 75% | 241 | -0.73 | 2% |
| bomberBlue | roxo | 50% | 10% | 58% | 196 | -0.82 | 0% |
| bomberRed | verde | 50% | 25% | 71% | 228 | -0.76 | 0% |
| bomberRed | vermelho | 50% | 30% | 56% | 186 | -0.79 | 0% |
| bomberRed | roxo | 50% | 25% | 71% | 227 | -0.76 | 0% |
| bomberRoxo | verde | 50% | 47% | 74% | 225 | -0.61 | 5% |
| bomberRoxo | vermelho | 50% | 63% | 90% | 277 | -0.51 | 10% |
| bomberRoxo | roxo | 50% | 25% | 71% | 222 | -0.75 | 2% |
| bomberBlue | verde | 25% | 97% | 100% | 139 | -0.35 | 12% |
| bomberBlue | vermelho | 25% | 98% | 100% | 140 | -0.29 | 13% |
| bomberBlue | roxo | 25% | 97% | 99% | 135 | -0.35 | 10% |
| bomberRed | verde | 25% | 87% | 93% | 174 | -0.51 | 3% |
| bomberRed | vermelho | 25% | 77% | 85% | 156 | -0.61 | 2% |
| bomberRed | roxo | 25% | 87% | 93% | 174 | -0.51 | 3% |
| bomberRoxo | verde | 25% | 100% | 100% | 139 | -0.24 | 17% |
| bomberRoxo | vermelho | 25% | 100% | 100% | 139 | -0.20 | 18% |
| bomberRoxo | roxo | 25% | 98% | 100% | 135 | -0.32 | 12% |

Retorno por crédito = 1 + líquido/crédito (valor destruído + o que sobra do bombardeiro, ÷ custo), média contra as três defesas:

| Bombardeiro | Defesa 100% | Defesa 50% | Defesa 25% |
|---|---:|---:|---:|
| bomberBlue | 0.02 | 0.22 | 0.67 |
| bomberRed | 0.03 | 0.23 | 0.46 |
| bomberRoxo | 0.01 | 0.37 | 0.75 |

### Veredito

Eficácia por crédito (razão): V/R = Verde ÷ Vermelho, P/R = Roxo ÷ Vermelho, P/V = Roxo ÷ Verde. Meta: V/R > 1, 0,85 ≤ P/R ≤ 1,05, P/V < 1.

| Papel | Medida | V/R | P/R | P/V | Verde > Vermelho | Roxo ≤ 1,05 × Vermelho | Roxo ≥ 0,85 × Vermelho |
|---|---|---:|---:|---:|---|---|---|
| Caça | eficácia do duelo | NaN | 0.07 | 2.95 | NÃO | sim | NÃO |
| Multifunção | √(eficácia aérea × dano solo/crédito) | NaN | 1.43 | 0.77 | NÃO | NÃO | sim |
| Caça furtivo | eficácia do duelo | NaN | 2.38 | 0.98 | NÃO | NÃO | sim |
| Bombardeiro | retorno por crédito (defesa 50%) | 0.97 | 1.62 | 1.68 | NÃO | NÃO | sim |
