# Minigun e canhões dos helicópteros

Implementação local do plano aprovado. Custos 140 / 230 / 180, vida, mobilidade, treinamento e mísseis preservados. Identificadores dos modelos e arma `gun` preservados; o servidor usa o mesmo motor, sem alteração do protocolo de ordens.

| Arma | Infantaria | Veículos terrestres e tanques | Estruturas | Helicópteros/drones | Aviões em voo | RTS | Turnos |
|---|---:|---:|---:|---:|---:|---|---|
| Minigun do básico | 12 | 1 | 2 | 4 | 1 | 0,20 s entre tiros | Cinco tiros por ação, separados por 0,20 s |
| Canhão dos especializados | 12 | 30 | 10 | 20 | 7 | 1 s entre tiros | Um tiro por ação |

Valores por acerto antes de cobertura, doutrina, veterania, aura e críticos. Alcance 3 casas, precisão básica 85%. Aeronaves no solo contam como veículos terrestres; em voo usam o modificador aéreo. A proteção dos tanques contra outras armas comuns continua ativa.

Cada tiro da rajada sorteia seu próprio acerto. A ação mantém o alvo e a arma originais e termina se o alvo morrer, ficar oculto ou sair do alcance. O projétil conserva potência e modelo do disparo mesmo após a destruição do atirador. A recarga elimina resíduos numéricos próximos de zero para manter o intervalo de 0,20 s em passos de 1/30 s.

Traçante curto e clarão pequeno para Minigun; traçante e clarão mais marcados para Canhão. Impactos compactos, sem grandes explosões por bala. Efeitos reutilizam os limites, pausa e visibilidade atuais. Interface e manual informam a arma por modelo, sem reposicionar controles ou alterar miniaturas. Só a referência do texto autorizado do manual foi atualizada; demais referências visuais permanecem.

## Integrações explícitas

- `npm.cmd run test:integration:helicopters`: Chrome offline; quatro mapas, RTS/turnos, duas equipes, dano por categoria, cadência pelo relógio da simulação, rajada, sorteios individuais, interrupção, mísseis, compras, projétil após destruição, interface, três perfis, visibilidade e pausa real do navegador.
- `npm.cmd run test:multiplayer:integration`: servidor HTTP/WebSocket real e dois navegadores isolados. Inclui armas principais dos três helicópteros, duas equipes, quatro mapas, RTS/turnos e ordens duplicadas.
- `npm.cmd run test:integration` e `npm.cmd run test:integration:match`: regressões de bases, aeroportos, produção, terreno, comandos, combate, economia, vitória, menus e gráficos.

Não executar `npm test`, `test:browser`, `test:perf` ou outros agregados com desempenho/estresse. Não há benchmarks nem medições de FPS ou memória nesta revisão. Balanceamento competitivo depende de partidas humanas; multiplayer permanece validado localmente, sem publicação nesta tarefa.

## Registro

- Teste novo falhou com os valores antigos, imunidade dos tanques e ausência da rajada.
- Motor, interface, efeitos e documentação implementados com os valores aprovados.
- `test:integration:all` concluiu com código 0: 1.210 verificações específicas de helicópteros, regressões de bases/gráficos/aeroportos/produção/operações/partida/economia/combate/balanceamento e multiplayer com dois navegadores. Nenhum teste de desempenho executado.
- Revisão final independente identificou mudança indevida da aparência do projétil próprio após morte do atirador no multiplayer. Reproduzida em integração antes da correção; o servidor agora conserva o tipo próprio, mantendo o mascaramento de inimigos. As integrações do servidor e dos dois navegadores foram repetidas e passaram após a correção, nos quatro mapas e dois modos, para ambos os lados.
- Falhas durante a implementação: expectativas novas de dano/cadência/rajada contra o motor antigo; referência de texto do manual autorizada a mudar; regressão visual multiplayer acima. Todas resolvidas. Nenhuma falha preexistente apareceu nas suítes de integração executadas.
- Alterações anteriores preservadas no diretório de trabalho, sem commits ou publicação.
