# Notas do projeto

## Comentários finais — estado do jogo

War Grid é um jogo de estratégia militar por turnos aberto direto pelo index.html,
offline, com Canvas, Tailwind compilado localmente e áudio sintetizado.
O jogador pensa sem limite de tempo; a IA age somente após Encerrar turno.
Cada tropa possui pontos de movimento e uma ação renovados no próprio turno.
Renda e produção avançam por turno. Animações, projéteis e efeitos usam rAF.

## Melhorias adicionadas

Turnos alternados, contador de rodada, botão Encerrar turno e atalho Enter.
Movimento limitado por terreno, ataque dirigido, reparo e captura por ação.
Artilharia escolhe entre mover e atirar; mantém área 3x3 e fogo amigo.
Antitanque contra veículos e metralhador com rajada de três tiros por ação.
Desenhos próprios para cada tropa, animações de movimento/disparo e seleção
individual/em grupo. Água bloqueada, pontes, A*, névoa dinâmica, minas,
trincheiras, aura, veterania, quatro mapas, minimapa e fila de treinamento.
Caches de sprites e atualizações de DOM apenas quando os valores mudam.

## Ideias para evoluir — ainda não implementadas

Prévia das casas alcançáveis, previsão de dano antes de confirmar o ataque,
salvar/carregar a operação e missões com objetivos variados. Ajustar o
balanceamento das tropas com partidas completas e feedback do jogador.
