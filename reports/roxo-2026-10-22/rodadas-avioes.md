# Rodadas de ajuste dos aviões roxos (saída bruta do simulador, linha "== rodada" = variante testada)

Cada bloco repete as linhas de veredito e os retornos do bombardeiro da rodada. Os nomes das rodadas seguem as pastas em `rodadas-solo.md` quando há ficha terrestre; os de avião (bh = vida do bombardeiro, bt = turn rate do bombardeiro, fc = caça, ff, fb, mu = multifunção, st = furtivo) mudam um parâmetro por vez em relação ao ponto de partida.

## r-fc
```
== fc100h155
| Caça | roxo × verde | 615 × 660 | 33% | 0.55 | 0.54 |
| Caça | roxo × vermelho | 615 × 610 | 3% | 0.24 | 0.09 |
| Caça | eficácia do duelo | NaN | 0.09 | 0.54 | NÃO | sim | NÃO |
== fc100h165
| Caça | roxo × verde | 615 × 660 | 40% | 0.62 | 0.67 |
| Caça | roxo × vermelho | 615 × 610 | 3% | 0.30 | 0.10 |
| Caça | eficácia do duelo | NaN | 0.10 | 0.67 | NÃO | sim | NÃO |
```

## r-ff
```
== ff680
| Caça | roxo × verde | 680 × 660 | 29% | 0.43 | 0.42 |
| Caça | roxo × vermelho | 680 × 610 | 3% | 0.28 | 0.09 |
| Caça | eficácia do duelo | NaN | 0.09 | 0.42 | NÃO | sim | NÃO |
```

## r-mu
```
== mu105
| Multifunção | roxo × verde | 800 × 850 | 33% | 0.70 | 0.60 |
| Multifunção | roxo × vermelho | 800 × 895 | 44% | 1.06 | 0.97 |
| Multifunção | √(eficácia aérea × dano solo/crédito) | NaN | 1.01 | 0.70 | NÃO | sim | sim |
== mu105h165
| Multifunção | roxo × verde | 800 × 850 | 31% | 0.66 | 0.56 |
| Multifunção | roxo × vermelho | 800 × 895 | 39% | 1.01 | 0.85 |
| Multifunção | √(eficácia aérea × dano solo/crédito) | NaN | 0.95 | 0.68 | NÃO | sim | sim |
```

## r-st
```
== st105h155
| Caça furtivo | roxo × verde | 990 × 1000 | 38% | 0.72 | 0.67 |
| Caça furtivo | roxo × vermelho | 990 × 1030 | 50% | 1.44 | 1.23 |
| Caça furtivo | eficácia do duelo | NaN | 1.23 | 0.67 | NÃO | NÃO | sim |
== st105h165
| Caça furtivo | roxo × verde | 990 × 1000 | 38% | 0.77 | 0.69 |
| Caça furtivo | roxo × vermelho | 990 × 1030 | 50% | 1.47 | 1.24 |
| Caça furtivo | eficácia do duelo | NaN | 1.24 | 0.69 | NÃO | NÃO | sim |
== st100
| Caça furtivo | roxo × verde | 990 × 1000 | 20% | 0.43 | 0.33 |
| Caça furtivo | roxo × vermelho | 990 × 1030 | 40% | 1.12 | 0.88 |
| Caça furtivo | eficácia do duelo | NaN | 0.88 | 0.33 | NÃO | sim | sim |
```

## r-st2
```
== st100
| Caça furtivo | roxo × verde | 990 × 1000 | 23% | 0.52 | 0.40 |
| Caça furtivo | roxo × vermelho | 990 × 1030 | 37% | 1.00 | 0.78 |
| Caça furtivo | eficácia do duelo | NaN | 0.78 | 0.40 | NÃO | sim | NÃO |
== st100h185
| Caça furtivo | roxo × verde | 990 × 1000 | 23% | 0.52 | 0.40 |
| Caça furtivo | roxo × vermelho | 990 × 1030 | 37% | 1.00 | 0.78 |
| Caça furtivo | eficácia do duelo | NaN | 0.78 | 0.40 | NÃO | sim | NÃO |
```

## r-fb
```
== fb185
== fb190
== fb195
```

## r-bomb
```
== cur
| Bombardeiro | retorno por crédito (defesa 50%) | 1.26 | 1.98 | 1.58 | sim | NÃO | sim |
| bomberBlue | 0.00 | 0.27 | 0.71 |
| bomberRed | 0.02 | 0.21 | 0.46 |
| bomberRoxo | -0.00 | 0.42 | 0.77 |
== bh200
| Bombardeiro | retorno por crédito (defesa 50%) | 1.26 | 1.40 | 1.11 | sim | NÃO | sim |
| bomberBlue | 0.00 | 0.27 | 0.71 |
| bomberRed | 0.02 | 0.21 | 0.46 |
| bomberRoxo | -0.00 | 0.30 | 0.63 |
== bh220
| Bombardeiro | retorno por crédito (defesa 50%) | 1.26 | 1.61 | 1.28 | sim | NÃO | sim |
| bomberBlue | 0.00 | 0.27 | 0.71 |
| bomberRed | 0.02 | 0.21 | 0.46 |
| bomberRoxo | -0.00 | 0.34 | 0.69 |
== bh240
| Bombardeiro | retorno por crédito (defesa 50%) | 1.26 | 1.77 | 1.41 | sim | NÃO | sim |
| bomberBlue | 0.00 | 0.27 | 0.71 |
| bomberRed | 0.02 | 0.21 | 0.46 |
| bomberRoxo | -0.00 | 0.38 | 0.73 |
== bt60
| Bombardeiro | retorno por crédito (defesa 50%) | 1.26 | 1.98 | 1.58 | sim | NÃO | sim |
| bomberBlue | 0.00 | 0.27 | 0.71 |
| bomberRed | 0.02 | 0.21 | 0.46 |
| bomberRoxo | -0.00 | 0.42 | 0.77 |
== bt80
| Bombardeiro | retorno por crédito (defesa 50%) | 1.26 | 1.98 | 1.58 | sim | NÃO | sim |
| bomberBlue | 0.00 | 0.27 | 0.71 |
| bomberRed | 0.02 | 0.21 | 0.46 |
| bomberRoxo | -0.00 | 0.42 | 0.77 |
```

## r-b2
```
== bh160
| Bombardeiro | retorno por crédito (defesa 50%) | 1.16 | 0.74 | 0.64 | sim | sim | NÃO |
| bomberBlue | 0.01 | 0.25 | 0.71 |
| bomberRed | 0.02 | 0.22 | 0.46 |
| bomberRoxo | -0.00 | 0.16 | 0.51 |
== bh180
| Bombardeiro | retorno por crédito (defesa 50%) | 1.16 | 0.91 | 0.78 | sim | sim | sim |
| bomberBlue | 0.01 | 0.25 | 0.71 |
| bomberRed | 0.02 | 0.22 | 0.46 |
| bomberRoxo | -0.00 | 0.20 | 0.57 |
== bh200
| Bombardeiro | retorno por crédito (defesa 50%) | 1.16 | 1.25 | 1.08 | sim | NÃO | sim |
| bomberBlue | 0.01 | 0.25 | 0.71 |
| bomberRed | 0.02 | 0.22 | 0.46 |
| bomberRoxo | -0.00 | 0.27 | 0.64 |
== bh200c
| Bombardeiro | retorno por crédito (defesa 50%) | 1.16 | 1.20 | 1.03 | sim | NÃO | sim |
| bomberBlue | 0.01 | 0.25 | 0.71 |
| bomberRed | 0.02 | 0.22 | 0.46 |
| bomberRoxo | -0.00 | 0.26 | 0.63 |
== bc1396
| Bombardeiro | retorno por crédito (defesa 50%) | 1.16 | 1.82 | 1.57 | sim | NÃO | sim |
| bomberBlue | 0.01 | 0.25 | 0.71 |
| bomberRed | 0.02 | 0.22 | 0.46 |
| bomberRoxo | 0.00 | 0.39 | 0.76 |
```

## Rodadas finais do bombardeiro (vida 185, 190, 195, 200; 60 sementes; defesa 50%)

| Vida | Roxo/Vermelho | Roxo/Verde | Resultado |
|---:|---:|---:|---|
| 185 | 0.79 | 0.82 | abaixo de 0,85 do Vermelho (rejeitada) |
| 190 | 0.83 | 0.86 | abaixo de 0,85 do Vermelho (rejeitada) |
| 195 | 0.92 | 0.96 | escolhida: dentro da faixa do Vermelho e abaixo do Verde |
| 200 | 0.99 | 1.03 | acima do Verde (rejeitada) |
