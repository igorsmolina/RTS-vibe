# Unidades do jogo

Written for: você, como referência de consulta e balanceamento.

Fonte: `public/js/engine.js` (`TYPES` = ficha verde, `RED` e `FR` = diferenças do vermelho e da França, `PLANE_MODELS`, `WEAPONS`). As tabelas por time foram geradas a partir do código em 21/10/2026, depois da planilha de ajustes; se os valores forem alterados, este arquivo precisa ser atualizado.

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
| Mísseis | Tipo, dano, alcance e quantidade de cada míssil que a unidade lança. Alcance entre parênteses = altitude alta. |


## Fichas por time

Cada time tem ficha própria: **Verde** (Aliado, ficha base `TYPES`), **Vermelho** (Inimigo, `RED`) e **Azul** (França, `FR`). Dano e alcance dos mísseis estão na última coluna. Nos aviões, o custo é casco + munição. A coluna Dano das unidades que lançam míssil mostra a arma principal (fuzil, canhão ou minigun).

### Verde

| Unidade | Custo | Treino | HP | Vel. | Mov. | Alcance | Dano | Recarga | Visão | Recompensa | Mísseis |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Infantaria | 50 | 1 | 100 | 1,35 | 3 | 3 | 35 | 0,8 | 4 | 20 | — |
| Engenheiro | 65 | 2 | 85 | 1,25 | 3 | 1,15 | 20 | 1,2 | 4 | 25 | — |
| Metralhador | 90 | 2 | 110 | 1,05 | 2 | 3 | 18 | 0,3 | 4 | 30 | — |
| Antitanque | 110 | 2 | 90 | 1,05 | 3 | 7 | 40 | 3 | 4 | 35 | Antitanque 50 · alc. 7 · 4 mísseis |
| Soldado lançador | 90 | 2 | 80 | 1,25 | 3 | 10 | 55 | 3 | 4 | 30 | Míssil 55 · alc. 10 (só aeronaves) |
| Comandante | — | — | 140 | 1,35 | 3 | 2 | 40 | 1,5 | 5 | 70 | — |
| Batedor | 75 | 1 | 75 | 2,25 | 5 | 2 | 24 | 1,1 | 7 | 25 | — |
| Tanque leve | 100 | 2 | 110 | 2,2 | 6 | 4 | 35 | 2 | 6 | 35 | — |
| Tanque médio | 150 | 3 | 170 | 2 | 5 | 5 | 60 | 2,5 | 6 | 50 | — |
| Tanque pesado | 240 | 4 | 280 | 1,7 | 4 | 7 | 80 | 3,5 | 6 | 80 | — |
| Artilharia | 180 | 4 | 100 | 1,2 | 3 | 16 | 85 | 5 | 3 | 40 | — |
| Artilharia de mísseis | 240 | 4 | 90 | 0,85 | 2 | 30 | 20 | 10 | 3 | 60 | Foguete 20 × 4 · alc. 30 · ×2 contra estruturas |
| Veículo antiaéreo | 160 | 3 | 70 | 2,25 | 5 | 30 | 80 | 3,5 | 6 | 45 | Míssil 80 · alc. 30 (só aeronaves) |
| Caminhão de transporte | 100 | 2 | 90 | 2,4 | 7 | — | — | — | 4 | 30 | — |
| Helicóptero | 150 | 3 | 120 | 3,2 | 8 | 3 | 4 × 5 | 0,2 | 6 | 50 | — |
| Helicóptero ar-terra | 230 | 4 | 120 | 3,2 | 8 | 3 | 20 | 1 | 6 | 50 | Antiblindado 60 · alc. 7 (alta 20) · rec. 3 · 8 mísseis |
| Helicóptero ar-ar | 180 | 4 | 120 | 3,2 | 8 | 3 | 20 | 1 | 6 | 50 | Ar-ar 85 · alc. 17 · rec. 3 |
| Helicóptero de transporte | 220 | 4 | 150 | 3,4 | 10 | — | — | — | 6 | 60 | — |
| Drone de reconhecimento | 90 | 2 | 60 | 2,4 | 7 | — | — | — | 12 | 30 | — |
| Drone furtivo | 160 | 3 | 50 | 2,2 | 6 | 15 | 80 | 3 | 12 | 45 | Míssil furtivo 80 · alc. 15 · 2 mísseis |

Aviões de Verde

| Avião | Custo | Treino | HP | Vel. | Evasão | Flares | Recompensa | Munição (quantidade · dano · alcance) |
|---|---|---|---|---|---|---|---|---|
| Avião de transporte | — | — | 240 | 4,5 | 0% | 300 | 90 | Nenhuma |
| Caça aliado | 660 | 3 | 150 | 6 | 20% | 60 | 120 | ar-ar ×4 · 90 · alc. 30; antirradiação ×4 · 80 · alc. 40; MG ×80 |
| Multifunção aliado | 850 | 4 | 180 | 5,6 | 30% | 60 | 120 | ar-ar ×2 · 90 · alc. 30; antiblindado ×6 · 80 · alc. 15; antirradiação ×4 · 80 · alc. 40; MG ×80 |
| Caça furtivo aliado | 1000 | 5 | 180 | 6,2 | 30% | 60 | 140 | ar-ar ×6 · 90 · alc. 30; antirradiação ×2 · 80 · alc. 40; MG ×80 |
| Bombardeiro furtivo aliado | 1296 | 6 | 240 | 3,5 | 10% | 100 | 120 | bomba comum ×4 · 120; fragmentação ×4 · 70; incendiária ×4 · 40; cruzeiro ×2 · 160 · alc. 67 |

### Vermelho

| Unidade | Custo | Treino | HP | Vel. | Mov. | Alcance | Dano | Recarga | Visão | Recompensa | Mísseis |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Infantaria | 50 | 1 | 100 | 1,35 | 3 | 3 | 35 | 0,8 | 4 | 20 | — |
| Engenheiro | 65 | 2 | 85 | 1,25 | 3 | 1,15 | 20 | 1,2 | 4 | 25 | — |
| Metralhador | 90 | 2 | 110 | 1,05 | 2 | 3 | 18 | 0,3 | 4 | 30 | — |
| Antitanque | 110 | 2 | 90 | 1,05 | 3 | 7 | 40 | 3 | 4 | 35 | Antitanque 40 · alc. 7 · 6 mísseis |
| Soldado lançador | 90 | 2 | 80 | 1,25 | 3 | 15 | 45 | 3 | 4 | 30 | Míssil 45 · alc. 15 (só aeronaves) |
| Comandante | — | — | 140 | 1,35 | 3 | 2 | 40 | 1,5 | 5 | 70 | — |
| Batedor | 75 | 1 | 75 | 2,5 | 5 | 2 | 24 | 1,1 | 7 | 25 | — |
| Tanque leve | 100 | 2 | 110 | 1,9 | 6 | 4 | 35 | 2 | 5 | 35 | Antitanque 40 · alc. 7 · 4 mísseis |
| Tanque médio | 150 | 3 | 170 | 1,8 | 5 | 5 | 60 | 2,5 | 5 | 50 | — |
| Tanque pesado | 240 | 4 | 280 | 1,5 | 4 | 7 | 80 | 3,5 | 5 | 80 | Antitanque 50 · alc. 12 · 4 mísseis |
| Artilharia | 180 | 4 | 100 | 1,2 | 3 | 16 | 85 | 5 | 3 | 40 | — |
| Artilharia de mísseis | 240 | 4 | 90 | 0,85 | 2 | 30 | 20 | 10 | 3 | 60 | Foguete 20 × 4 · alc. 30 · ×2 contra estruturas |
| Veículo antiaéreo | 160 | 3 | 70 | 2,25 | 5 | 30 | 80 | 3,5 | 6 | 45 | Míssil 80 · alc. 30 (só aeronaves) |
| Caminhão de transporte | 100 | 2 | 90 | 2,4 | 7 | 3 | 20 | 1 | 4 | 30 | — |
| Helicóptero | 150 | 3 | 120 | 3,2 | 8 | 3 | 7 × 5 | 0,2 | 6 | 50 | — |
| Helicóptero ar-terra | 230 | 4 | 120 | 3,2 | 8 | 3 | 20 | 1 | 6 | 50 | Antiblindado 80 · alc. 7 (alta 23) · rec. 2,5 · 12 mísseis |
| Helicóptero ar-ar | 180 | 4 | 120 | 3,2 | 8 | 3 | 20 | 1 | 6 | 50 | Ar-ar 70 · alc. 15 · rec. 3 |
| Helicóptero de transporte | 220 | 4 | 150 | 3,4 | 10 | — | — | — | 6 | 60 | Foguete 20 · alc. 10 (alta 30) · 4 por salva · 2 salvas |
| Drone de reconhecimento | 90 | 2 | 60 | 2,4 | 7 | — | — | — | 12 | 30 | — |
| Drone furtivo | 160 | 3 | 50 | 2,2 | 6 | 10 | 50 | 3 | 12 | 45 | Míssil furtivo 50 · alc. 10 · 4 mísseis |

Aviões de Vermelho

| Avião | Custo | Treino | HP | Vel. | Evasão | Flares | Recompensa | Munição (quantidade · dano · alcance) |
|---|---|---|---|---|---|---|---|---|
| Avião de transporte | — | — | 240 | 4,5 | 0% | 300 | 90 | Nenhuma |
| Caça inimigo | 610 | 3 | 160 | 5,4 | 30% | 60 | 120 | ar-ar ×4 · 75 · alc. 30; antirradiação ×2 · 90 · alc. 40; MG ×80 |
| Multifunção inimigo | 895 | 4 | 200 | 4,8 | 20% | 80 | 120 | ar-ar ×2 · 80 · alc. 30; antiblindado ×4 · 90 · alc. 15; antirradiação ×3 · 90 · alc. 40; MG ×80 |
| Caça furtivo inimigo | 1030 | 5 | 190 | 5,8 | 35% | 60 | 140 | ar-ar ×6 · 75 · alc. 30; antirradiação ×2 · 90 · alc. 40; MG ×80 |
| Bombardeiro pesado inimigo | 1164 | 8 | 340 | 3 | 10% | 120 | 180 | bomba comum ×16 · 120; fragmentação ×16 · 70; incendiária ×16 · 40; cruzeiro ×6 · 160 · alc. 70 |

### Azul (França)

| Unidade | Custo | Treino | HP | Vel. | Mov. | Alcance | Dano | Recarga | Visão | Recompensa | Mísseis |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Infantaria | 50 | 1 | 100 | 1,35 | 3 | 3 | 55 | 0,8 | 4 | 20 | — |
| Engenheiro | 50 | 2 | 85 | 1,25 | 3 | 1,15 | 20 | 1,2 | 4 | 25 | — |
| Metralhador | 60 | 2 | 110 | 1,05 | 2 | 3 | 20 | 0,3 | 4 | 30 | — |
| Antitanque | 60 | 2 | 90 | 1,05 | 3 | 7 | 40 | 3 | 4 | 35 | Antitanque 50 · alc. 7 · 4 mísseis |
| Soldado lançador | 55 | 2 | 80 | 1,25 | 3 | 12 | 40 | 3 | 4 | 30 | Míssil 40 · alc. 12 (só aeronaves) · fuzil alc. 3 |
| Comandante | — | — | 140 | 1,35 | 3 | 2 | 40 | 1,5 | 5 | 70 | — |
| Batedor | 75 | 1 | 65 | 3 | 6 | 2 | 20 | 1 | 7 | 25 | — |
| Tanque leve | 100 | 2 | 95 | 2,5 | 7 | 4 | 40 | 2,2 | 6 | 35 | — |
| Tanque médio | 155 | 3 | 155 | 2 | 5 | 5 | 55 | 2,1 | 5 | 50 | — |
| Tanque pesado | 240 | 4 | 300 | 1,7 | 4 | 6 | 75 | 3,5 | 5 | 80 | — |
| Artilharia | 180 | 4 | 80 | 1,8 | 4 | 14 | 80 | 4 | 3 | 40 | — |
| Artilharia de mísseis | 250 | 4 | 115 | 1 | 2 | 25 | 20 | 11 | 3 | 60 | Foguete 20 × 6 · alc. 25 · ×2 contra estruturas |
| Veículo antiaéreo | 145 | 3 | 85 | 2,25 | 5 | 25 | 90 | 2,5 | 6 | 45 | Míssil 90 · alc. 25 (só aeronaves) |
| Caminhão de transporte | 115 | 2 | 100 | 2,2 | 6 | — | — | — | 4 | 30 | — |
| Helicóptero | 140 | 3 | 100 | 3,6 | 9 | 3 | 6 × 4 | 0,25 | 7 | 50 | — |
| Helicóptero ar-terra | 245 | 4 | 110 | 3,5 | 8 | 3 | 22 | 1,2 | 6 | 50 | Antiblindado 60 · alc. 6 (alta 11) · rec. 3,5 · sem limite · foguetes 12 × 4 · alc. 4 |
| Helicóptero ar-ar | 175 | 4 | 140 | 3,8 | 8 | 3 | 20 | 1 | 6 | 50 | Ar-ar 60 · alc. 6 · rec. 2,2 |
| Helicóptero de transporte | 230 | 4 | 160 | 3,2 | 9 | — | — | — | 6 | 60 | — |
| Drone de reconhecimento | 95 | 2 | 70 | 2 | 6 | — | — | — | 15 | 30 | — |
| Drone furtivo | 170 | 3 | 55 | 2,2 | 6 | 5 | 50 | 3 | 12 | 45 | Bomba guiada 50 · alc. 5 · 6 mísseis |

Aviões de Azul (França)

| Avião | Custo | Treino | HP | Vel. | Evasão | Flares | Recompensa | Munição (quantidade · dano · alcance) |
|---|---|---|---|---|---|---|---|---|
| Avião de transporte | — | — | 230 | 5 | 0% | 300 | 90 | Nenhuma |
| Caça azul | 630 | 3 | 140 | 6,5 | 25% | 60 | 120 | ar-ar ×4 · 70 · alc. 30; antirradiação ×2 · 80 · alc. 40; MG ×100 |
| Multifunção azul | 785 | 4 | 185 | 6 | 25% | 70 | 120 | ar-ar ×2 · 65 · alc. 30; antiblindado ×3 · 75 · alc. 15; antirradiação ×2 · 80 · alc. 40; cruzeiro ×1 · 160 · alc. 67; MG ×80 |
| Caça furtivo azul | 990 | 5 | 175 | 5,7 | 35% | 60 | 140 | ar-ar ×4 · 70 · alc. 30; antirradiação ×2 · 80 · alc. 40; MG ×80 |
| Bombardeiro azul | 1356 | 6 | 200 | 5 | 20% | 80 | 150 | bomba comum ×6 · 120; fragmentação ×6 · 70; cruzeiro ×4 · 160 · alc. 75 |

## Comandante e estruturas

| Unidade | Custo | HP | Vel. | Mov. | Alcance | Dano | Precisão | Recarga | Visão | Recompensa | Tamanho |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Comandante | — (não comprado) | 140 | 1.35 | 3 | 2 | 40 | 90% | 1.5 | 5 | 70 | — |
| Quartel-general | — | 300 | 0 | 0 | 0 | 0 | — | — | 5 | 100 | 3×3 |
| Posto avançado | — | 90 | 0 | 0 | 0 | 0 | — | — | 8 | 30 | 2×2 |
| Aeroporto de terra | — | 350 | 0 | 0 | 0 | 0 | — | — | 5 | 70 | 6×2 |
| Aeroporto de concreto | — | 500 | 0 | 0 | 0 | 0 | — | — | 5 | 90 | 8×3 |
| Canteiro de aeroporto | — | 150 | 0 | 0 | 0 | 0 | — | — | 2 | 25 | 6×2 |

- **Comandante**: aura de comando, raio 6 (verde e vermelho) ou 8 (França): +20% de dano e +15 pontos de precisão para as tropas dentro do raio. Não tem custo na ficha, então não é comprado.
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

Valores base de `WEAPONS`. Cada time pode ter dano e alcance próprios para o mesmo míssil (veja a coluna Mísseis nas fichas por time). Dano e alcance dos aviões também mudam por modelo.


## Diferenças entre os times

**Tropas a pé e engenheiro.**
- Engenheiro: repara +24 HP (verde e França) ou +30 HP (vermelho) por passo.
- Comandante: aura de raio 6 (verde e vermelho) e 8 (França).
- Antitanque: míssil de dano 50 e 4 mísseis (verde e França); 40 e 6 mísseis (vermelho).
- Soldado lançador: verde 55 de dano, alcance 10; vermelho 45, alcance 15; França 40, alcance 12 e fuzil de alcance 3 contra tropas a pé.

**Blindados.** Verde tem mais visão e velocidade; vermelho tem míssil antitanque nos tanques.
- Verde: leve 2,2 / médio 2 / pesado 1,7 de velocidade, visão 6. O pesado tem Trophy com 6 cargas.
- Vermelho: leve 1,9 / médio 1,8 / pesado 1,5, visão 5; o médio perde precisão só após 4 casas. Leve e pesado lançam míssil antitanque (4 mísseis; o do pesado tem dano 50 e alcance 12), e o leve consegue ferir o pesado enquanto tiver míssil. O pesado tem Trophy com 3 cargas.
- Azul (França): ver mecânicas próprias abaixo.

**Caminhão vermelho.** Além de transportar 4 tropas, tem uma metralhadora leve (dano 20, alcance 3) que não fere tanques médios nem pesados. A IA não o usa como tropa de combate.

**Helicópteros e drones.**
- Ar-terra: verde 60 de dano, alcance 7 (20 em altitude alta), 8 mísseis; vermelho 80, alcance 7 (23), 12 mísseis, recarga 2,5; França 60, alcance 6, sem limite de mísseis.
- Ar-ar: verde 85, alcance 17; vermelho 70, alcance 15; França 60, alcance 6.
- Minigun: dano 7 no vermelho, 4 no verde, 6 × 4 tiros na França.
- Drone furtivo: verde 80 de dano, alcance 15, 2 mísseis; vermelho 50, alcance 10, 4 mísseis; França: bombas guiadas 50, alcance 5, 6 bombas.

**Aviões.** Cada modelo tem a própria munição.
- Verde: ar-ar 90 de dano em todos os caças e no multifunção; multifunção com antiblindado 80 (×6). Caça com 4 antirradiação.
- Vermelho: dano base mais alto (ar-ar 75/80, antirradiação 90, antiblindado 90). Bombardeiro pesado mais lento (3) e cruzeiro com alcance 70.
- França: cruzeiro do Mirage IV com alcance 75 e 4 mísseis; Mirage 2000 e Rafale com 2 antirradiação.

**Munição de mísseis.** Antitanque, tanques vermelhos (leve e pesado), helicóptero ar-terra (verde e vermelho) e drone furtivo têm munição limitada. Ela recarrega na manutenção. A tela mostra `mísseis/máximo` sob a barra de vida das suas unidades e um aviso flutuante: "Pouca munição" quando restar 1/4 da carga e "Munição acabou" quando zerar. Com o helicóptero sem mísseis, o modo Auto usa o canhão.

**Mecânicas próprias da França**
- **GALIX (tanque pesado):** 2 cargas. Ao ser atingido, solta fumaça por 3 s (1 turno): −40% de precisão contra ele, de qualquer atacante. Não intercepta mísseis como o Trophy. Recarrega como o Trophy, em QG/posto.
- **Silhueta pequena (VBL):** −10% de precisão contra ele.
- **Leclerc:** a precisão só começa a cair após 4 casas (verde: 3). Sem Trophy; o pesado usa o GALIX.
- **Atira e foge (CAESAR):** depois de atirar, +1 Mov no turno (RTS: +30% de velocidade por 3 s).
- **LRU:** salva de 6 foguetes de 20, alcance 25 (verde: 4 × 20 = 80, alcance 30). Continua ×2 contra estruturas e com alcance mínimo 3.
- **Tigre:** terceira arma, foguetes em área 3×3: 4 foguetes de 12, 2 salvas, alcance 4, recarga 8 s, ×1,5 contra infantaria e ×0,5 contra veículos e estruturas. Míssil ar-terra: 60, alcance 6, recarga 3,5.
- **Panther:** só míssil ar-ar (sem canhão); **não ataca alvos no solo**.
- **NH90:** 8 vagas a pé, ou 1 batedor (5 vagas) + 3 tropas, dentro da rampa. Não sobe à altitude alta (sem bônus de visão, velocidade ou flares) e não tem armas.
- **A400M:** 10 vagas (verde: 12) e pista curta: pouso e decolagem 30% mais rápidos.
- **nEUROn:** 6 bombas guiadas de 50, 90% de precisão, alcance 5, ×1,5 contra estruturas.
- **Rafale:** leva 1 míssil de cruzeiro SCALP (alcance 67) além da metralhadora e 2 antirradiação.
- **FCAS:** rede de sensores revela drones e aviões furtivos inimigos a até 8 casas dele, em voo.
- **Mirage IV:** supersônico e detectável por radar; 6 bombas comuns, 6 de fragmentação, 4 cruzeiros de alcance 75.

Equilíbrio provisório, ainda não validado em partidas.
