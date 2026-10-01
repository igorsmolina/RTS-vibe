# War Grid — Fronteiras RTS

Jogo de estratégia militar em tempo real para um jogador contra a IA. Capture postos, proteja seu comandante e destrua o QG inimigo.

## Como jogar

Abra o **`index.html`** no navegador (Chrome, Edge ou Firefox). Não precisa instalar nada nem estar conectado à internet: o jogo inteiro está nesse arquivo.

Ao abrir, escolha o mapa, a dificuldade e, se quiser, uma semente para repetir o mesmo terreno. O jogo começa em velocidade 0,5×, e o botão de velocidade alterna entre 0,25×, 0,5×, 1× e 2×.

### Controles

| Ação | Como fazer |
|---|---|
| Selecionar | Clique esquerdo; arraste para selecionar várias tropas; **Shift** adiciona ou remove da seleção |
| Ordem contextual | Botão direito: mover no chão, atacar inimigo, capturar posto (infantaria), reparar aliado (engenheiro) |
| Atacar-mover | **A** e clique no destino: a tropa enfrenta inimigos no caminho |
| Mover / Parar / Reparar | **M** / **S** / **R** |
| Grupos | **Ctrl + 1–5** guarda a seleção; **1–5** seleciona o grupo |
| Pausa tática | **P** congela a batalha; dá para dar ordens e comprar tropas enquanto pausado |

No celular, use os botões do painel de ordens e toque no destino. O botão **Manual**, no jogo, explica todas as regras.

### Regras principais

- **Vitória:** destrua o QG inimigo, ou elimine todas as tropas inimigas quando ele não tiver mais reforços na fila.
- **Economia:** o QG rende 15 créditos e cada posto rende 8, a cada 3 segundos. O QG treina até 5 tropas em fila.
- **Terreno:** a água bloqueia a passagem (use as pontes); só a infantaria sobe montanhas; a floresta dá cobertura; a estrada dobra a velocidade.
- **Tropas:** infantaria (captura e constrói postos), batedor (rápido, enxerga longe), engenheiro (repara e desarma minas), artilharia (fogo em área 3×3, inclusive sobre aliados) e tanque.
- **Comandante:** dá bônus de dano e precisão às tropas próximas. Se ele morrer, você perde metade dos créditos.

## Arquivos

```
index.html               o jogo completo (HTML, CSS, lógica e sons)
tests/engine.test.cjs    testes das regras do jogo, sem navegador
tests/browser.test.cjs   testes dos controles no Google Chrome
package.json             comandos para rodar os testes
```

## Para desenvolvedores

O código fica todo em `index.html`. O bloco `<script id="engine">` é o motor do jogo, sem nenhuma dependência do DOM. Os testes carregam esse bloco diretamente. O segundo `<script>` cuida do desenho no canvas, da interface e do áudio.

Rodar os testes exige o [Node.js](https://nodejs.org) 18 ou mais recente:

```sh
npm test                 # regras do motor: caminhos, combate, economia, IA, névoa
npm install              # só necessário para o teste no navegador
npm run test:browser     # controles, pausa e layout em cinco larguras; requer o Google Chrome instalado
```

Os testes verificam as regras, não o equilíbrio do jogo. Custos e tempos de recarga ainda precisam ser ajustados com partidas de verdade.
