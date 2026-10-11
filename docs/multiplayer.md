# Multiplayer por código

Implementação do plano aprovado: servidor autoritativo, dois jogadores, RTS e turnos, apelido e sala privada. Nenhuma conta Neon ou migração de banco é necessária.

## Executar localmente

1. Na pasta do projeto, execute `npm.cmd install --ignore-scripts`.
2. Execute `npm.cmd run start:multiplayer`.
3. Abra o endereço mostrado pelo servidor e escolha **Multiplayer**.
4. Crie uma sala e compartilhe seu código. O outro jogador entra na mesma versão online com apelido e código.
5. Ambos escolhem suas formações e doutrinas, confirmam que estão prontos e o anfitrião inicia.

O servidor usa `PORT` quando fornecida pela hospedagem e aceita conexões externas. Expor um endereço local à internet exige configuração de rede; o fluxo recomendado é a publicação abaixo.

## Publicar gratuitamente no Render

O arquivo `render.yaml` prepara um único **Web Service**, plano **Free**, com jogo e WebSocket na mesma origem.

1. Disponibilize esta versão do projeto em seu repositório conectado ao Render.
2. No Render, crie um Blueprint usando esse repositório e confira que o serviço está no plano Free. Também é possível criar manualmente um Web Service.
3. Build: `npm install --omit=dev --ignore-scripts --no-audit --no-fund`.
4. Start: `npm run start:multiplayer`. Health check: `/health`.
5. Compartilhe a URL HTTPS publicada; o cliente usa WSS automaticamente.
6. Para encaminhar jogadores da versão Vercel ou offline, configure o endereço público conforme abaixo.

O serviço gratuito pode adormecer após 15 minutos sem tráfego e levar aproximadamente um minuto para despertar. Salas ficam apenas em memória: reinício, nova publicação ou suspensão do serviço encerra partidas. O plano gratuito possui limites mensais, portanto não representa hospedagem ilimitada. Fontes: [Render Free](https://render.com/docs/free), [WebSockets](https://render.com/docs/websocket).

## Endereço público e regras

Na cópia estática ou offline, a linha inicial de `public/js/multiplayer.js` permite definir `window.RTS_MULTIPLAYER_URL`. Troque a string vazia pela URL HTTPS publicada, por exemplo `https://seu-servico.onrender.com`. Também é possível definir essa variável em um script anterior. Essa informação é pública; não coloque credenciais nela. No próprio servidor multiplayer, o botão detecta `/health` e usa a mesma origem automaticamente.

O anfitrião começa de azul e o convidado de vermelho. Ambos confirmam sua formação e doutrina; qualquer alteração na preparação cancela a confirmação. A revanche troca as equipes e restaura a formação sugerida, que pode ser editada antes da nova partida.

Equipes mantêm seus catálogos distintos, com quatro modelos de avião para cada lado: caça, multifunção, caça furtivo e bombardeiro. Os bombardeiros são produzidos apenas nos aeroportos; o azul é furtivo ao radar e o vermelho tem carga pesada. O lado vermelho também controla sua produção e seus turnos; não há comandante de IA. Ordens, saldo, combate e quantidade de bombas são validados no servidor. Cada cliente recebe apenas a visão permitida da sua equipe.

No RTS online, pausa e velocidade ficam indisponíveis. Menus e mudança de aba não suspendem a partida. Uma desconexão congela a simulação para ambos por até dois minutos. Ao expirar, quem continua conectado vence por abandono; se ambos estiverem desconectados, a partida é cancelada. Desistir encerra imediatamente em favor do adversário.

## Validação

- Comando exclusivo: `npm.cmd run test:multiplayer:integration`.
- Regressões permitidas: `npm.cmd run test:integration:all`.
- Esses comandos devem listar somente integrações funcionais. Não usar `npm test`, `test:browser` ou `test:perf`, pois os comandos antigos incluem desempenho ou estresse.
- Dois contextos de navegador locais comprovam integração cliente/servidor; a verificação em dois computadores pela internet depende da URL publicada e deve ser registrada separadamente.

## Registro de execução

- Plano aprovado na conversa, implementado localmente; sem commits ou publicação automática.
- Contrato: HTTP para criar/entrar; WebSocket autenticado para sala, ordens e estados filtrados por equipe. Motor atual reutilizado.
- Teste inicial confirmou a ausência do módulo de servidor antes da implementação.
- Revisão independente encontrou dois defeitos, ambos corrigidos com integração: cancelamento de ação aérea por turnos bloqueado pelo transporte e metadados internos de radar enviados em aeronaves próprias.
- Referências antigas de integração foram ajustadas: dano de artilharia já balanceado em 85 e hash do manual atualizado após confirmar que a interface anterior e a atual produzem o mesmo manual. A comparação do menu inicial ignora somente o botão Multiplayer autorizado; as demais referências visuais permanecem.
- `npm.cmd run test:integration:all`: saída 0; seis suítes anteriores de integração, ciclo de partida, balanceamento e multiplayer. Nenhum comando agregado de desempenho foi executado.
- `npm.cmd run test:multiplayer:integration`: saída 0 na verificação final, incluindo os novos casos de reinício real durante partida ativa, retorno à entrada sem recarregar e fallback offline sem requisições remotas.
- Servidor: quatro mapas × dois modos; turnos humanos, produção, movimento, captura, reparo, combate, resultados, validação, privacidade e duplicação de comandos. Cobertura adicional de dois engenheiros construindo pista de terra, preços dos dois aeroportos, catálogos distintos, bombardeiros e caças furtivos, salvas de 6/12/24/48 e fases completas de voo/manutenção.
- Navegador: dois contextos Chrome independentes nos oito cenários, controle do vermelho, compra, movimento, turnos, reconexão, revanche com troca de lado e preservação da carreira solo.
- Publicação não realizada. Não há URL de multiplayer disponível pela internet nesta entrega; a verificação em dois computadores externos permanece pendente após implantação.
