# Tabela de dano — War Grid

Dano por disparo que acerta, com tropa de nível 1, sem comandante por perto e em terreno aberto.
Fonte: `public/js/engine.js` (`TYPES`, `WEAPONS`, `weapon`, `impact`). "—" = não pode atirar naquele alvo.

| Atacante | Tropa a pé | Veículo | Tanque médio/pesado | Aeronave | Estrutura |
|---|---|---|---|---|---|
| Infantaria | 35 | 35 | — | 8,8 → 4,4 ¹ | 35 |
| Engenheiro | 20 | 20 | — | — | 20 |
| Comandante | 40 | 40 | — | — | 40 |
| Metralhador | 23,4 | 4,5 | — | 11,7 → 5,9 ¹ | 9 |
| Antitanque | 20 | **90** | **90** | — | 40 |
| Soldado lançador | 30 | 30 | — | 30 | 30 |
| Batedor | **48** | 32 (tanque leve: 12,8) | — | — | 32 |
| Tanque leve | 35 | 35 | 35 | — | 35 |
| Tanque médio | 60 | 60 | 60 | — | 60 |
| Tanque pesado | 80 | 80 | 80 | — | 80 |
| Artilharia ² | 70 → 28 | 70 → 28 | 70 → 28 | — | 70 → 28 |
| Artilharia de mísseis ³ | 20 / 10 | 20 / 10 | 20 / 10 | — | **40 / 20** |
| Veículo antiaéreo | — | — | — | **100** | — |
| Helicóptero (metralhadora) | 20 | 7 | — | 20 | 10 |
| Helicóptero ar-terra (míssil) | 32,5 | **97,5** | **97,5** | — | 65 |
| Helicóptero ar-ar (míssil) | — | — | — | 70 | — |
| Drone de reconhecimento | — | — | — | — | — |
| Drone furtivo ⁴ | 20 | 20 | — | 20 | 20 |

Tanque médio e tanque pesado só levam dano de antitanque, tanques, artilharia e míssil ar-terra; as demais tropas não conseguem mirar neles.
Quartel-general e posto avançado não atacam (dano 0).

## Categorias de alvo

- **Tropa a pé:** infantaria, engenheiro, comandante, metralhador, antitanque, soldado lançador.
- **Veículo:** tanque leve, artilharia, batedor, veículo antiaéreo.
- **Tanque médio/pesado:** blindados que só armas antitanque ferem.
- **Aeronave:** helicópteros. Só infantaria, metralhador, soldado lançador, veículo antiaéreo e helicópteros alcançam.
- **Estrutura:** quartel-general, posto avançado.

## Notas

1. Contra aeronave, o dano cai de 100% para 50% conforme a distância chega ao alcance máximo do disparo.
2. Artilharia: 70 a 2 casas, 28 a 6 casas. Tropas ao redor (área 3×3) levam metade, inclusive as suas (fogo amigo).
3. Artilharia de mísseis: por míssil com impacto efetivo (80% de chance), casa central / oito vizinhas; 4 mísseis por salva, alcance 3–13, sem queda pela distância. Atinge as suas tropas e não atinge aeronaves. Só ataca pela ordem Bombardear área. Equilíbrio provisório.
4. Drone furtivo: 2 mísseis no total, sem reposição, alcance 2, um por ação (RTS: 3 s entre disparos). Nunca dispara automaticamente, só contra alvos escolhidos pelo jogador ou pela IA. Equilíbrio provisório.

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
| Artilharia | 80 |
| Artilharia de mísseis | 90 |
| Veículo antiaéreo | 40 |
| Helicópteros | 120 |
| Drone de reconhecimento | 60 |
| Drone furtivo | 50 |
| Quartel-general | 300 |
| Posto avançado | 80 |

## Preços

| Tropa | Preço |
|---|---|
| Helicóptero padrão | 110 |
| Helicóptero ar-terra | 230 |
| Helicóptero ar-ar | 180 |
| Artilharia de mísseis | 240 |
| Drone de reconhecimento | 90 |
| Drone furtivo | 160 |

O veículo antiaéreo anda tão rápido quanto o batedor (5 casas por turno; velocidade 2,25 no RTS).
