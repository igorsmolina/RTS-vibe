# Prompt — Drone Furtivo

Crie uma unidade chamada **Drone Furtivo**, com aparência de asa voadora triangular inspirada na imagem de referência e no arquivo `drone-furtivo.png`: sem cauda, fuselagem cinza-escura, camuflagem geométrica discreta e dois mísseis alojados internamente.

**Voo:** permanece sempre em altitude alta, sem opção de descer.

**Armamento:** possui um estoque total de **dois mísseis**, disparados individualmente. Cada ataque consome um míssil e alcança até **2 casas**, podendo atingir alvos terrestres e aéreos. Dano base sugerido: **20 por míssil**, sujeito a balanceamento. No RTS, intervalo de **3 segundos** entre disparos; por turnos, cada disparo consome **uma ação**. Não existe reposição de munição. Após o segundo disparo, continua apenas como unidade de reconhecimento. Não possui armamento secundário.

**Furtividade:** radares antiaéreos não detectam o drone. Ele pode ser descoberto quando entra no alcance de visão de uma tropa inimiga, incluindo outras aeronaves. A visão própria de uma tropa antiaérea também pode descobri-lo. Disparar não remove a furtividade automaticamente: a descoberta exige contato visual inimigo.

**Revelação permanente:** após o primeiro contato visual, sua posição atual fica visível para toda a equipe inimiga até ser destruído, mesmo que saia do alcance de visão. A posição acompanha seus movimentos; não é apenas um marcador da última localização conhecida. Não recupera a furtividade. Essa visibilidade permite ataques que respeitem alcance e compatibilidade da arma. A revelação permanente vale para o mapa; o drone continua sem gerar contato pelo radar.

**Contramedidas:** não possui flares, interferência eletrônica ou outros recursos defensivos.

Os valores de dano e intervalo entre disparos são iniciais e não representam balanceamento validado em partidas completas. Vida, visão, movimento, velocidade, preço e tempo de fabricação ainda precisam ser definidos antes de uma futura implementação.

A unidade está no jogo (`stealthDrone` em `public/js/engine.js`) com vida 50, visão 12 (como o drone de reconhecimento), sem disparo automático, movimento 6, 2,2 casas/s, custo 160 e treino 3 turnos / 30 s. A fonte fica em `sources/drone-furtivo.png`; `npm run prepare:stealth-drone` gera `stealth-drone.png` (128 × 128) e o incorpora em `public/js/assets.js`.
