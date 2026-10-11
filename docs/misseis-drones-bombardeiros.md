# Mísseis, drones e bombardeiros

Sprites criados com ImageGen e incorporados para jogo offline. PNGs de 128×128, transparência real, frente norte: antiaéreo, ar-terra, ar-ar compartilhado, foguete, drone furtivo e cruzeiro. Cruzeiro desenhado maior e míssil do drone menor. Rastros, fogo e direção permanecem separados da arte; falha de carregamento preserva o desenho anterior.

## Drones

Drone furtivo: alcance 8, dois mísseis, dano base 35, apenas por ordem. Ambos os drones veem tropas sobre todos os terrenos até 12 casas (distância do motor), inclusive florestas, sebes, colinas e montanhas. Não removem cobertura nem detectam minas. As demais regras de furtividade e radar continuam em vigor.

## Bombardeiros e cruzeiro

| Unidade | Carga | Preço completo / no concreto |
|---|---|---|
| Bombardeiro furtivo aliado | 4 bombas de cada tipo + 2 cruzeiros | 1296 / 1037 |
| Bombardeiro pesado inimigo | 16 bombas de cada tipo + 2 cruzeiros | 2224 / 1779 |

Ambos carregam exclusivamente bombas e cruzeiros. Cruzeiro custa 60 créditos, alcance 40, velocidade 8 casas/s, recarga RTS 6 s e um por ordem. `strikeCell` com `{x,y,weapon:'cruiseMissile'}` designa uma coordenada inteira do mapa, visível ou na névoa. Dentro do alcance, lança sem aproximar; fora dele, aproxima até 40 e volta à patrulha após disparar. Cancelar antes de disparar não consome munição; após lançado, segue mesmo sem o bombardeiro. Não segue tropas, não provoca revelação de alvos e não usa críticos, flares ou fumaça defensiva.

Área 3×3: dano base 160 na casa central, 80 nas oito vizinhas, antes de cobertura, doutrina, veterania e aura. Atinge aliados, veículos, estruturas e aeronaves pousadas; não atinge aeronaves em voo. Estruturas com várias casas recebem uma aplicação, pelo ponto mais próximo do centro. Acerta a coordenada se não for interceptado. Rearmamento cobra somente a munição faltante.

Antiaérea intercepta a até 6 casas: 75% contra cruzeiro, 30% contra antirradiação. Antirradiação conserva prioridade; recarga 3,5 s ou uma reação por turno inimigo. Interceptação bem-sucedida destrói o míssil sem dano de área terrestre. IA usa apenas posições vistas ou lembradas e evita aliados na explosão.

## Conferência

`node tests/missiles.test.cjs`: alcance/visão, carga/rearmamento, coordenadas, lançamento remoto, aproximação/cancelamento, intervalo, dano/fogo amigo/bordas, persistência após perda do lançador e limiares controlados de interceptação nos dois modos.

`node tests/missiles.browser.test.cjs`: carregamento offline, transparência, arte em voo, falha de imagem, área marcada, painel e entrada por clique em RTS/turnos, desktop/celular.

`node tests/multiplayer-server.integration.cjs`: comandos autenticados, validação e sincronização do servidor, incluindo cruzeiros e visão dos drones.

Balanceamento provisório: os testes conferem as regras; potência e alcance ainda precisam de partidas humanas.

As verificações desta entrega passaram no motor, no Chrome offline, na integração de aviação/helicópteros e no servidor via WebSocket. A suíte geral ainda contém falhas anteriores nos testes de planejamento de aeroporto (`aiAirportPlan`) e acesso rodoviário dos postos (`plain` versus `road`). Foram reproduzidas com as regras anteriores de drones/armamento restauradas apenas em memória; não alteram as regras novas de mísseis.
