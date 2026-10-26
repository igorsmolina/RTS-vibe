# Equilíbrio dos aviões: Roxo × Verde × Vermelho (22/10/2026)

Medido por `scripts/faction-air-balance.cjs --so-roxo` (60 sementes × 2 lados = 120 duelos por par). O modo `--so-roxo` mede o Roxo no lugar da França: pares Roxo×Verde e Roxo×Vermelho, veredito com colunas P/R e P/V. Para outra versão do motor: `--engine caminho/engine.js`; para uma ficha alternativa sem editar o motor: `--set bomberRoxo.hp=190`. Mesmo método do relatório da França (`reports/franca-2026-10-22/relatorio-avioes.md`): análise analítica por avião, duelos 1×1 e bombardeiro contra defesa antiaérea terrestre.

## Resumo

Meta: Roxo abaixo do Verde (P/V < 1) e perto do Vermelho (0,85 ≤ P/R ≤ 1,05).

| Papel | P/R antes | P/R depois | P/V antes | P/V depois | Mudança no Roxo |
|---|---:|---:|---:|---:|---|
| Caça | 0,07 | **0,10** | 2,95 | **0,46** | vida 145 → 165; curva 115 → 100°/s |
| Multifunção | 1,43 | **0,95** | 0,77 | **0,68** | vida 175 → 165; curva 115 → 105°/s |
| Caça furtivo | 2,38 | **0,91** | 0,98 | **0,51** | curva 120 → 102°/s |
| Bombardeiro | 1,62 | **0,92** | 1,68 | **0,96** | vida 260 → 195 |

A medição "antes" (valores de partida) punha o Roxo **acima do Verde** em dois dos quatro papéis (caça 2,95 e bombardeiro 1,68) e quase empatado no furtivo (0,98); isso foi corrigido antes de integrar. Custos não mudaram (615 / 800 / 990 / 1276), todos dentro de ±10% do equivalente Verde (660 / 850 / 1000 / 1296: 0,93 / 0,94 / 0,99 / 0,98).

- **Caça: P/R 0,10 fica fora da faixa de propósito.** No simulador o caça vermelho vence o verde (eficácia do Verde sobre o Vermelho: 0,11, comportamento anterior ao Roxo). Para ficar "perto do Vermelho" o caça roxo teria de ser muito mais forte que o verde. Prioridade: abaixo do Verde. Resultado: o caça roxo vence o verde em 29% dos duelos, o vermelho em 3%.
- **Controle Verde×Vermelho:** inalterado. Os modelos do Verde, do Vermelho e do Azul não foram editados (diff do `engine.js`: só linhas `*Roxo` e as curvas deles). O controle com a medição da França (`--so-franca`, sem Roxo) dá V/R = 0,11 / 2,07 / 0,82 / 1,15 (caça, multifunção, furtivo, bombardeiro). Na medição do Roxo o bombardeiro dá V/R = 0,97 porque a defesa antiaérea agora inclui defensores roxos (médias diferentes), e o V/R do duelo aéreo não é calculado em `--so-roxo` (mostra NaN).

## Valores finais dos aviões roxos

| Modelo | Custo | Vida | Vel. | Evasão | Flares | Curva (°/s) | Munição |
|---|---:|---:|---:|---:|---:|---:|---|
| fighterRoxo | 615 | 165 | 5,8 | 25% | 60 | 100 | ar-ar ×4 (dano 85), antirradiação ×3, MG ×80 |
| multiroleRoxo | 800 | 165 | 5,4 | 25% | 70 | 105 | ar-ar ×2 (85), antiblindado ×5 (80), antirradiação ×3 |
| stealthFighterRoxo | 990 | 175 | 6 | 30% | 60 | 102 | ar-ar ×5 (85), antirradiação ×2 |
| bomberRoxo | 1276 | 195 | 3,8 | 10% | 100 | 70 | comum ×4, frag. ×4, incend. ×4, cruzeiro ×2 (alcance 67) |

## Duelos 1×1 (depois)

| Papel | Par | Custos | Vitória 1º | Troca | Eficácia |
|---|---|---|---:|---:|---:|
| Caça | roxo × verde | 615 × 660 | 29% | 0,48 | 0,46 |
| Caça | roxo × vermelho | 615 × 610 | 3% | 0,31 | 0,10 |
| Multifunção | roxo × verde | 800 × 850 | 31% | 0,66 | 0,56 |
| Multifunção | roxo × vermelho | 800 × 895 | 39% | 1,01 | 0,85 |
| Caça furtivo | roxo × verde | 990 × 1000 | 30% | 0,60 | 0,51 |
| Caça furtivo | roxo × vermelho | 990 × 1030 | 42% | 1,12 | 0,91 |

## Bombardeiro (retorno por crédito, defesa de 50% do custo, média contra as três defesas)

| Bombardeiro | Antes | Depois |
|---|---:|---:|
| Verde | 0,22 | 0,22 |
| Vermelho | 0,23 | 0,23 |
| Roxo | 0,37 | 0,21 |

O Roxo com 260 de vida (valor inicial) rendia bem mais que o Verde. Rodadas finais da vida (60 sementes): 185 → P/R 0,79; 190 → 0,83; 195 → 0,92 (escolhida, P/V 0,96); 200 → 0,99 e P/V 1,03 (acima do Verde, rejeitada). Registro completo em `rodadas-avioes.md`; tabelas inteiras em `avioes-antes.md` e `avioes-depois.md`.

## Pontos de atenção (não alterados)

- O bombardeiro vermelho (casco 100, 48 bombas, 1164 créditos) rende 3,0 de dano esperado por crédito contra 0,73 do roxo e 0,72 do verde. Parece engano de digitação; não foi mexido, como no relatório da França.
- O simulador não usa terreno nem a IA de aviação; os duelos medem curva, vida e munição.
- A vida do bombardeiro roxo tem janela estreita: com 190 o P/R ainda é 0,83 e com 200 o P/V passa de 1; 195 é o valor testado que cumpre as duas metas. Qualquer mudança no bombardeiro verde ou vermelho exige remedir.
