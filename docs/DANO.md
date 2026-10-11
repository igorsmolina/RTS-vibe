# Tabela de dano — War Grid

Dano por disparo que acerta, com tropa de nível 1, sem bônus de aura, doutrina equilibrada e em terreno aberto (o comandante recebe a própria aura no jogo).
Fonte: `public/js/engine.js` (`TYPES`, `WEAPONS`, `weapon`, `impact`). "—" = não pode atirar naquele alvo.

| Atacante | Tropa a pé | Veículo | Tanque médio/pesado | Aeronave | Estrutura |
|---|---|---|---|---|---|
| Infantaria | 35 | 35 | — | 8,8 → 4,4 ¹ | 35 |
| Engenheiro | 20 | 20 | — | — | 20 |
| Comandante | 40 | 40 | — | — | 40 |
| Metralhador | 23,4 | 4,5 | — | 11,7 → 5,9 ¹ | 9 |
| Antitanque | 20 | **90** | **90** | — | 40 |
| Soldado lançador | 40 | 40 | — | 40 | 40 |
| Batedor | **36** | 24 (tanque leve: 9,6) | — | — | 24 |
| Tanque leve | 35 | 35 | 35 | — | 35 |
| Tanque médio | 60 | 60 | 60 | — | 60 |
| Tanque pesado | 80 | 80 | 80 | — | 80 |
| Artilharia ² | 85 → 68 | 85 → 68 | 85 → 68 | — | 85 → 68 |
| Artilharia de mísseis ³ | 20 / 10 | 20 / 10 | 20 / 10 | — | **40 / 20** |
| Veículo antiaéreo | — | — | — | **80** | — |
| Helicóptero básico (Minigun) | 12 | 1 | 1 | 4 (avião em voo: 1) | 2 |
| Helicópteros especializados (Canhão) | 12 | 30 | 30 | 20 (avião em voo: 7) | 10 |
| Helicóptero ar-terra (míssil) | 32,5 | **97,5** | **97,5** | — | 65 |
| Helicóptero ar-ar (míssil) | — | — | — | 70 | — |
| Drone de reconhecimento | — | — | — | — | — |
| Drone furtivo ⁴ | 35 | 35 | — | 35 | 35 |
| Bombardeiros (cruzeiro, centro / vizinhas) | 160 / 80 | 160 / 80 | 160 / 80 | Só pousada: 160 / 80 | 160 / 80 |

Cruzeiro: alcance 40, área 3×3 fixa, fogo amigo, uma aplicação por estrutura. Os dois bombardeiros levam 2 cruzeiros e suas bombas; não usam metralhadora ou outros mísseis. Interceptação antiaérea: 75% por tentativa. [Regras de mísseis e drones](misseis-drones-bombardeiros.md).

Tanque médio e tanque pesado resistem a armas comuns; antitanque, tanques, artilharias, canhões de helicópteros, mísseis ar-terra e bombas são as contramedidas. A Minigun do helicóptero básico também os atinge, com dano mínimo.
Quartel-general e posto avançado não atacam (dano 0).

## Categorias de alvo

- **Tropa a pé:** infantaria, engenheiro, comandante, metralhador, antitanque, soldado lançador.
- **Veículo:** tanque leve, artilharias, batedor, veículo antiaéreo e aviões no solo.
- **Tanque médio/pesado:** blindados protegidos contra armas comuns, com exceção das armas principais dos helicópteros.
- **Aeronave:** helicópteros, drones e aviões em voo; depende da arma compatível, da visão e do alcance. Aeronaves no solo usam a camada terrestre.
- **Estrutura:** quartel-general, posto avançado, aeroportos e canteiros.

## Notas

1. Contra aeronave, o dano cai de 100% para 50% conforme a distância chega ao alcance máximo do disparo.
2. Artilharia: 85 a 2 casas, 68 a 16 casas. Tropas ao redor (área 3×3) levam metade, inclusive as suas (fogo amigo).
3. Artilharia de mísseis: por míssil com impacto efetivo (80% de chance), casa central / oito vizinhas; 4 mísseis por salva, alcance 3–30, sem queda pela distância. Atinge as suas tropas e não atinge aeronaves em voo. Bombardear escolhe a área; atacar um inimigo visível mira a casa dele. Equilíbrio provisório.
4. Drone furtivo: 2 mísseis no total, sem reposição, alcance 8, um por ação (RTS: 3 s entre disparos). Nunca dispara automaticamente, só contra alvos escolhidos pelo jogador ou pela IA. Equilíbrio provisório.

## O que muda o número final

- **Cobertura do alvo:** −20% (colina), −25% (sebe), −30% (floresta), −50% (montanha); trincheira soma −25% (máx. 75%).
- **Nível:** +10% de dano por nível acima do 1.
- **Aura do comandante (raio 2):** +20% de dano.
- **Crítico:** ×1,35.
- **Mínimo:** 1 por tiro.
- **Drone:** antiaérea e soldado lançador têm +10 pontos de precisão contra ele (99% e 95% sem outros modificadores).
- **Precisão:** erro não causa dano. Contra mísseis, flares do helicóptero cortam a chance de acerto pela metade.

## Vida das tropas

| Tropa | Vida |
|---|---|
| Infantaria | 100 |
| Engenheiro | 85 |
| Comandante | 140 |
| Metralhador | 110 |
| Antitanque | 90 |
| Soldado lançador | 80 |
| Batedor | 75 |
| Tanque leve | 110 |
| Tanque médio | 170 |
| Tanque pesado | 280 |
| Artilharia | 100 |
| Artilharia de mísseis | 90 |
| Veículo antiaéreo | 70 |
| Helicópteros | 120 |
| Drone de reconhecimento | 60 |
| Drone furtivo | 50 |
| Quartel-general | 300 |
| Posto avançado | 80 |

## Preços

| Tropa | Preço |
|---|---|
| Helicóptero padrão | 140 |
| Helicóptero ar-terra | 230 |
| Helicóptero ar-ar | 180 |
| Artilharia de mísseis | 240 |
| Drone de reconhecimento | 90 |
| Drone furtivo | 160 |

O veículo antiaéreo anda tão rápido quanto o batedor (5 casas por turno; velocidade 2,25 no RTS).

Mísseis ar-ar aplicam dano normal; não há abate automático.
