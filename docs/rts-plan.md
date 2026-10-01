# Conversão RTS — 30/09/2026

Objetivo: converter War Grid para RTS offline em index.html, com Canvas e o CSS Tailwind já compilado no arquivo.

- [x] Motor: passo de simulação fixo a partir de delta time, A* ponderado e posições interpoladas; reservas de células evitam sobreposição. Água bloqueada; montanhas só infantaria.
- [x] Combate: cadências por unidade, projéteis e dano no impacto, artilharia com armação/desarmação de 1,5 s e área 3×3; cura 8 HP/s; captura 3 s; construção 5 s. Manter aura, XP e minas.
- [x] Economia: tick a cada 3 s, QG +15 e posto +8; fila serial de até cinco unidades, cobrança na entrada e espera se saída bloqueada.
- [x] IA: estados reunir/atacar/defender e decisão a cada 1,5 s, captura e retirada de feridos usando visão compartilhada e memória de estruturas.
- [x] Interface: clique/arrasto/Shift, ordens com botão direito, A/S e Ctrl+1–5; painel inferior fixo, minimapa, fila, ações, renda e log; pausa e menus seguros.
- [x] Validação: motor real sem DOM (rotas, colisões, delta time, cadência, canais, filas, fog, IA e reinício), controles no Chrome offline, desktop e móvel.

Execução direta no checkout atual. Reutilizar o gerador de terreno, desenhos vetoriais, sons sintetizados e CSS compilado. Código final de execução somente em index.html; testes nos arquivos existentes. Casos críticos: alvo some na névoa, grupo cruza ponte estreita, produção fica sem saída, ordem cancela construção, partida reinicia com projéteis em voo.

Otimização (30/09/2026): A* com heap e grades de ocupação, alcance por inundação única em approach/spawnNear/command, visão sem alocações; ícones e brilho em cache, névoa em lote, painel só grava o que mudou, canvas parado só redesenha após interação ou a cada 0,25 s, ruído de áudio reutilizado. Simulação idêntica (mesma impressão digital de estado em 16 partidas), passo médio 0,65 → 0,15 ms, pior passo 41 → 4 ms.

Validação concluída: 19 verificações do motor; controles no Chrome offline sem erros JavaScript ou requisições externas; cinco larguras de 320 a 1440 px e tela curta 320 × 700. Revisão independente corrigiu a prioridade de captura contextual de postos inimigos, coberta por regressão no navegador. Equilíbrio competitivo depende de partidas humanas.
