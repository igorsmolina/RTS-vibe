# Aviação por investidas — proposta de design
Data: 08/10/2026
Estado: proposta aprovada e implementada. Verificações em [aviacao-verificacao.md](../../aviacao-verificacao.md).

## 1. Objetivo e decisões confirmadas

Adicionar seis modelos fictícios de avião às batalhas padrão e de campanha, preservando RTS, turnos, pausa tática e abertura offline por duplo clique. Usar as seis artes já geradas: três aliadas e três inimigas com geometrias diferentes.

- Aviões permanentes patrulham e nunca param enquanto estão voando. Podem parar pousados.
- Cada ordem executa uma investida e depois retorna à patrulha. Sem repetição automática de ataques do jogador.
- Caças e multifunção permitem escolher um ou dois mísseis por ordem. Combustível ilimitado; munição limitada.
- No RTS, o deslocamento é contínuo. Em turnos, o avião se move durante a execução da ação e fica congelado no planejamento.
- Exceção: o bombardeiro aliado vem de fora, lança a carga mista em uma passagem e sai. Se sobreviver, conserva identidade/experiência e a próxima missão cobra somente as armas. Reparo gratuito com espera. Se destruído, comprar casco novamente.
- Bombardeiro aliado: mais bombas e tipos, mais caro, mais lento e menos manobrável que o inimigo; detecção por radar probabilística. Precisa apenas de QG vivo para ser chamado.
- Caça aliado: mais velocidade e precisão distante, menos manobrabilidade que o inimigo. Ambos têm o mesmo estoque de mísseis ar-ar e antirradiação; radar detecta helicópteros baixos.
- Multifunção aliado: mais velocidade e manobrabilidade; inimigo tem mísseis melhores, estoque um pouco maior e preço superior.
- Manobrabilidade afeta evasão de mísseis e precisão contra alvos terrestres. Experiência melhora evasão; todos os aviões têm mais contramedidas que os helicópteros.
- Antirradiação acompanha emissões de radar dentro do alcance, mesmo sem visão terrestre. Desligar o radar faz o míssil seguir à última posição conhecida. Antiaéreas recebem fumaça defensiva e podem interceptar esses mísseis, com baixa chance.
- Em turnos, cada veículo antiaéreo tem uma reação por turno inimigo: atacar aeronave ou interceptar míssil.
- Mapa de 128 × 96 casas; 1.200 créditos iniciais por equipe; renda triplicada.
- Aeroportos asfaltados neutros podem aparecer nos cantos e devem ser capturados. Pelo menos dois engenheiros constroem pistas de terra. Todas as aeronaves permanentes podem usar ambos; asfalto acelera manutenção.

Os números e regras operacionais abaixo são propostas iniciais para completar o desenho. Não representam equilíbrio validado em partidas completas.

## 2. Modelos, armas e investidas

### Modelos propostos
Velocidade em casas por segundo no RTS e nas animações de voo. Evasão é a chance básica de escapar de um míssil que, de outra forma, acertaria. Casco exclui o preço das armas; a compra inicial inclui uma carga completa. Contramedidas iniciais estão incluídas.

| Modelo | Vida | Velocidade | Evasão | Contramedidas | Carga padrão | Casco |
|---|---:|---:|---:|---:|---|---:|
| Caça aliado | 150 | 6,0 | 20% | 6 | 4 ar-ar + 2 antirradiação | 400 |
| Caça inimigo | 160 | 5,4 | 30% | 6 | 4 ar-ar + 2 antirradiação | 380 |
| Multifunção aliado | 180 | 5,6 | 30% | 6 | 2 ar-ar + 4 antiblindados + 2 antirradiação | 480 |
| Multifunção inimigo | 200 | 4,8 | 20% | 8 | 2 ar-ar + 5 antiblindados + 3 antirradiação | 600 |
| Bombardeiro aliado | 240 | 3,5 | 10% | 10 | 12 bombas: padrão 4 comuns + 4 fragmentação + 4 incendiárias | 1.000 |
| Bombardeiro inimigo | 220 | 4,5 | 20% | 8 | 8 bombas: 4 comuns + 4 fragmentação | 700 |

Manter dois mísseis ar-ar nos multifunção é um padrão proposto para preservar o papel ar/solo definido inicialmente. O jogador pode alterar a mistura das 12 bombas aliadas, respeitando estoque total e créditos, antes de preparar cada missão.

### Armas propostas
Distância continua usando a contagem atual em casas. Armas dos novos aviões têm seus próprios atributos; não recebem automaticamente o bônus de altitude dos helicópteros.

| Arma | Alcance | Dano base | Preço por unidade | Velocidade do projétil |
|---|---:|---:|---:|---:|
| Ar-ar do caça aliado / inimigo | 14 | 70 / 75 | 20 | 10 casas/s |
| Ar-ar do multifunção aliado / inimigo | 12 | 65 / 80 | 20 | 10 casas/s |
| Antirradiação aliado / inimigo | 12 | 80 / 90 | 25 | 14 casas/s |
| Antiblindados aliado / inimigo | 10 / 12 | 75 / 90 | 25 | 10 casas/s |
| Bomba comum | Sobrevoo | 80 | 12 | Queda em 0,6 s |
| Fragmentação | Sobrevoo | 45 | 14 | Queda em 0,6 s |
| Incendiária | Sobrevoo | 20 + incêndio | 18 | Queda em 0,6 s |

- Ar-ar somente contra aeronaves em voo. Antirradiação somente contra emissores antiaéreos ativos, incluindo posteriormente a última posição de uma emissão interrompida. Antiblindados atinge veículos e estruturas; dano ×1,5 contra veículos. Bombas atingem solo, com fogo amigo.
- Caças ar-ar: precisão interpolada pela distância, de 95% a 85% no aliado e de 90% a 70% no inimigo. Multifunção ar-ar: 85% a 75% aliado; 90% a 80% inimigo.
- Ataques terrestres: precisão base de 70%, acrescida de metade da evasão básica do modelo em pontos percentuais. Armas do multifunção inimigo recebem mais 10 pontos; teto de 95% antes de contramedidas. Modificadores existentes de doutrina, comando e veterania continuam aplicáveis sem duplicar bônus.
- Veterano e Elite acrescentam 5 e 10 pontos percentuais à evasão básica. Para aviões, esse cálculo substitui a redução genérica de precisão recebida por nível; não acumula as duas proteções.
- Contramedidas automáticas: uma carga por míssil recebido, intervalo de 8 s no RTS e uma ativação entre dois inícios de turno próprio em turnos, inclusive contra reações antiaéreas durante a própria investida. Reduzem pela metade a chance de acerto restante após evasão. Evasão não gasta carga. Bombas e disparos não guiados não são afetados.

### Execução das ordens
- Sempre em altitude alta durante o voo; pousado é um estado próprio. Visão terrestre/aérea base de 12 casas para todos; em floresta, sebe, colina e montanha, observação terrestre própria limitada a 1 casa. Visão compartilhada e revelação por disparos continuam válidas.
- Patrulha: circuito de raio 4 em torno do ponto escolhido, ajustado para caber no mapa. Movimento modifica a posição real, usada por visão, radar, seleção e projéteis. Aviões em voo podem cruzar outras aeronaves sem disputar ocupação de uma casa.
- Investida com mísseis: escolher alvo, arma e salva de 1 ou 2. Aproximar, alinhar a proa dentro de 30 graus e disparar ao entrar no alcance. Intervalo de 0,6 s entre os dois disparos. Segundo disparo exige alvo vivo, identificado, compatível, no alcance e ainda à frente. Consumir munição somente no disparo efetivo.
- Após a janela de ataque, seguir mais 4 casas e retomar patrulha. Sem girar parado ou perseguir indefinidamente para garantir uma segunda tentativa. Cancelar ou perder alvo antes do disparo retorna à patrulha sem gasto.
- Bombardeio: indicar início e fim de uma linha de 4 a 12 casas sobre terreno explorado. Distribuir os pontos de impacto ao longo dela, seguindo a ordem de bombas exibida no painel. Prévia mostra a faixa e o risco de fogo amigo. Toda a carga preparada é lançada em uma passagem, salvo destruição/cancelamento.
- Bombas comuns: área 3 × 3, dano integral na casa central e metade nas demais. Fragmentação: área 3 × 3, ×1,5 contra tropas a pé e ×0,25 contra veículos/estruturas. Incendiárias: área 3 × 3, dano inicial mais 5 de dano por segundo durante 6 s no RTS, ou 15 em cada um dos dois próximos inícios de turno do proprietário do alvo; incêndios sobrepostos não acumulam dano. Afetam tropas terrestres e estruturas; veículos/estruturas recebem metade do dano de incêndio. Não modificam permanentemente terreno.
- Em turnos, uma investida completa consome uma ação e o movimento daquela unidade. Transferir patrulha ou pousar também consome a ação; encerra na posição final da animação. Um avião sem ordem que não executou ação naquele turno avança um circuito ao encerrar o turno do proprietário, sem atacar. Uma investida ou transferência já executada não concede esse movimento adicional. Não se desloca durante o planejamento nem nas animações de outras unidades.
- Pausa congela movimento, mísseis, radar, incêndios e manutenção. A mesma regra vale para jogador e IA.

### Bombardeiro aliado externo
Uma reserva por equipe aliada, com no máximo uma missão ativa. Compra do casco e carga padrão: 1.176 créditos. Sobrevivente paga somente a nova carga; padrão de 176 créditos.

Preparação inicial ou após destruição: 60 s / 6 turnos próprios. Após sobreviver, reparo gratuito e preparação seguinte também duram 60 s / 6 turnos próprios; novo armamento é cobrado uma vez ao preparar essa missão. Vida restaurada e contramedidas repostas; ID, XP e nível preservados.

Entrada pela borda mais próxima do QG aliado, passagem pela linha escolhida e saída pela borda mais próxima depois do fim da linha. Não pode patrulhar, pousar nem receber nova investida no meio da missão. Cancelamento após entrada manda sair e preserva armas ainda não lançadas. Abater reposição por tipo: quantidade cobrada = máximo entre zero e carga nova menos sobras daquele tipo. Não converter sobras em créditos nem em outros tipos. Se a nova mistura exigir descartar sobras, mostrar quantidades e exigir a ação explícita de descartar antes de preparar a missão.

Reserva fora do mapa não fornece visão, não recebe ataques e não impede derrota por ausência de forças. Bombas já lançadas continuam causando dano e atribuindo abates/XP ao avião mesmo depois de sua saída. QG destruído mantém a derrota existente.

## 3. Radar, defesa aérea e aeroportos

### Radar e reação
- Radar dos caças: raio de 18 casas, detectando aeronaves altas ou baixas; contato compartilhado permite que outras unidades ataquem respeitando sua compatibilidade e alcance. Sem radar de busca nos multifunção/bombardeiros nesta versão. Drone furtivo continua imune a todo radar.
- Veículos antiaéreos mantêm seu alcance atual de radar e mísseis. A restrição de detectar apenas altitude alta pertence ao emissor terrestre; não pode impedir o consumo de um contato baixo fornecido por caça.
- Bombardeiro aliado: se houver cobertura de radar, tentativa de detecção de 35% a cada 4 s de simulação; sucesso mantém contato por 8 s e outro sucesso renova esse prazo. Em turnos, uma tentativa por investida na primeira entrada em cobertura válida, contato válido até seu término. Sair de toda cobertura ou desligar o último emissor válido remove o contato; reentrar durante a mesma investida não concede novo sorteio. Sorteio por semente e relógio próprios, nunca por desenho de tela ou chamada de atualização de visão. Desativar o último emissor válido remove o contato; visão de tropas continua suficiente. Falhas podem fazer perder contato, conforme a escolha do usuário.
- Antirradiação identifica emissão ativa dentro do seu alcance sem revelar outras tropas ou terreno. Desligar a emissão interrompe o acompanhamento: o míssil não recupera a perseguição e pode acertar apenas na última casa marcada. Assim, desligar e mover é uma defesa útil.
- Fumaça da antiaérea: duas cargas, ativação automática contra antirradiação, 60% de chance de desviar cada míssil que chegar durante 3 s; recarga de 12 s. Em turnos, uma ativação por turno inimigo, cobrindo a investida que a acionou. Representa uma contramedida do jogo, sem criar ocultação geral de terreno. Reposição no QG/posto aliado adjacente: uma carga por 10 s / ação de manutenção.
- Interceptação: veículos antiaéreos podem tentar atingir antirradiação a até 6 casas, com 20% de acerto, sem bônus de precisão. Usa a recarga normal de 3,5 s. Priorizar míssil mirando a própria unidade, depois um mirando outra antiaérea aliada, depois aeronaves. Intercepção resolve antes de dano do míssil; uma arma não pode interceptar e atacar avião usando a mesma disponibilidade.
- Em turnos, cada antiaérea recebe uma reação no início do turno adversário; fumaça usa sua carga defensiva separada. Reações não consomem a próxima ação normal. Observar movimento → atualizar identificação → decidir reação → avançar impactos; evitar que o bombardeiro atravesse todo o mapa sem possibilidade de defesa.

### Aeroportos
- Pista ocupa efetivamente 6 × 2 casas; seleção, colisão terrestre, captura, alcance de ataque e dano consideram toda a estrutura. Aeronaves em voo podem sobrevoar. Vida: terra 350, asfalto 500.
- Sorteio de 50%, por semente da batalha, para criar um par de aeroportos asfaltados neutros em cantos espelhados livres, fora das bases iniciais. Reservar toda a área e conectá-la à malha de estradas. Não refazer sorteio ao reabrir preparação.
- Construção de terra: 400 créditos, 30 s / 3 turnos próprios, no mínimo dois engenheiros trabalhando adjacentes à área. Região dos cantos: as primeiras/últimas 16 linhas e colunas. Exigir terreno plano/campo/estrada, sem água, montanha, minas, estruturas ou unidades no retângulo.
- Validar área, propriedade, trabalhadores e créditos antes de cobrar uma única vez. Engenheiros não são consumidos. Menos de dois trabalhadores pausa e conserva progresso; mais de dois não acelera. Em turnos, cada etapa consome a ação de ambos e cada canteiro avança no máximo uma etapa por turno próprio, mesmo após trocar trabalhadores. Cada engenheiro participa de apenas um canteiro por vez. Canteiro tem 150 de vida; destruído perde investimento.
- Infantaria captura tanto terra quanto asfalto: 2 s no RTS ou uma ação em turnos, adjacente ao perímetro, usando as interrupções atuais de captura.
- Aeroportos só produzem os aviões permanentes da equipe proprietária, com fila serial de 3 incluindo produção ativa. QG/postos não fabricam novos aviões. Prazos: caças 30 s / 3 turnos, multifunção 40 s / 4 turnos, bombardeiro inimigo 60 s / 6 turnos.
- Cada pista comporta quatro aviões pousados, contando prontos e em manutenção. Produção pronta aguarda vaga sem nova cobrança; retorno para aeroporto cheio aguarda em circuito. Aviões novos começam pousados e recebem comando de decolagem/patrulha.
- Manutenção completa: terra 20 s / 2 turnos, asfalto 10 s / 1 turno. Restaura vida e contramedidas gratuitamente; cobra apenas armas faltantes antes do rearmamento. Sem créditos, permite reparar sem repor armas. Conservar XP e respeitar vida modificada por doutrina/veterania.
- Captura ou destruição elimina fila sem reembolso e destrói aviões pousados; não transfere aeronaves ao captor. Em voo, aviões continuam e podem usar outra pista aliada. Sem pista disponível, permanecem patrulhando. Aeronaves pousadas são alvos terrestres, sem radar/disparos/contramedidas ativos.
- Sem munição compatível, sugerir retorno; sem qualquer munição, retorno automático para pista aliada mais próxima com serviço possível. Ordem manual de patrulha pode cancelar esse retorno.

## 4. Mapa, economia e integração

### Operações extensas
- Todas as novas batalhas locais e de campanha usam 128 × 96. Mapa-múndi da campanha permanece como está. Saves atuais guardam progresso/configurações, não batalha ativa; sementes antigas continuam aceitas, mas o novo terreno não será idêntico.
- Créditos iniciais confirmados: 150 → 1.200. Renda do QG: 15 → 45; posto: 8 → 24, por turno ou a cada 10 s. Aplicar dificuldade e doutrina antes do arredondamento final. Aeroportos não geram renda. Preços existentes e recompensas de abate permanecem iguais.
- Proposta para densidade: 24 postos por padrão, opção procedural de 2 a 32 em números pares. Preservar bases espelhadas, conectividade, tipos de terreno e regras de minas.
- Proposta para a IA no mapa ampliado: limites de exército 40/48/56/64 e de encomendas 4/4/6/6 por dificuldade. Contar tropas, aviões pousados/em voo e filas de todas as estruturas; compras continuam na cadência atual. Limites de aviões dentro desses totais: 2/3/4/5.
- IA conquista asfalto acessível ou reserva 400 créditos e dois engenheiros para terra; nunca espera indefinidamente por um aeroporto inexistente. Antes da pista, mantém compras defensivas. Escolhe armas/alvos compatíveis, evita emissões ameaçadoras, usa manutenção e respeita munição/custo. Aviões recebem ordens próprias, sem entrar na lógica terrestre de ficar parado no ponto de reunião.
- Proposta de salvas da IA: duas munições apenas se disponíveis e alvo sobreviveria a um acerto normal; caso contrário uma. Sem compras, visão ou reposição gratuitas.

### Mudanças mínimas de interface e implementação
- Em public/js/engine.js, separar capacidades de avião, helicóptero, drone e aeronave pousada. Acrescentar carga por arma, fases de voo, salvas e reserva externa; reutilizar dano, doutrina, XP, eventos e projéteis existentes. Não alterar globalmente armas dos helicópteros para implementar variantes dos aviões.
- Ampliar produção/captura/manutenção com catálogo específico do aeroporto. Não conceder renda de posto a toda nova estrutura produtora. Filas de aeroporto e aeronaves pousadas contam para derrota por ausência de tropas; reserva externa fora do mapa não conta.
- Em public/js/render.js, desenhar terreno, névoa e grade apenas na região visível usando o desenho de casas existente. Evitar bitmap único de 7.168 × 5.376 pixels, aproximadamente 147 MiB só para RGBA. Ajustar minimapa/previews para 4:3 e usar a mesma transformação no desenho e nos cliques.
- Limitar candidatos de busca de alcance à região necessária, reutilizando grades da chamada e A* existente. Medir antes de introduzir escalonadores/caches adicionais. Aviões usam trajetórias contínuas próprias, sem disputar caminhos da malha.
- Painéis: Patrulhar, Investida, arma, salva 1/2, Retornar e Decolar; cancelamento volta à patrulha. Exibir munição por tipo, evasão atual, contramedidas, estado e radar. Aeroporto mostra produção 0/3 e ocupação 0/4. QG mostra reserva e configuração da missão de bombardeio, custos e tempo restante.
- Prévia de bombardeio e comandos acessíveis por teclado/toque; seleção múltipla mantém pedidos existentes para unidades comuns. Não mostrar controles de altitude de helicóptero para aviões.
- Integrar as seis artes confirmadas como sprites separados, com os recursos embutidos no formato offline já utilizado. Reutilizar a arte inimiga compacta como bombardeiro tático fictício; não alegar que reproduz características reais de um avião específico.
- Atualizar manual e descrições. Não adicionar servidor, dependências de execução ou modo naval.

## 5. Verificação e limites

Testes automatizados a acrescentar:
- Movimento real contínuo, curvas/bordas, pausa, uma passagem por ordem, cancelamento, alvo perdido/destruído e salva de dois sem gastar o segundo míssil indevidamente.
- Turnos: uma ação por investida, planejamento parado, patrulha ao encerrar turno e no máximo uma reação por antiaérea no turno adversário.
- Munição, preços, compra sem saldo, reparo, XP/doutrina, aeroporto cheio e perda de fila/aviões pousados em captura/destruição.
- Obra cooperativa: dois engenheiros, cobrança única, pausa/retomada, perímetro completo, locais inválidos e destruição do canteiro.
- Radar de caça encontra helicóptero baixo; furtivo permanece imune; sorteios reproduzíveis independem da frequência de desenho. Antirradiação, radar desligado, fumaça, interceptação e ordem dos impactos.
- Bombas por tipo, área, fogo amigo, incêndio sem acumulação e dano em aviões pousados. Saída do bombardeiro preserva atribuição de XP/abates; reutilização paga apenas reposição; destruição cobra casco.
- Geração simétrica/conectada de 128 × 96 com e sem asfalto, ocupação multicélula e diferentes sementes. IA consegue construir pista, operar e repor aeronaves sem ultrapassar orçamento/limites.
- Interface pequena, minimapa alinhado, teclado/toque, carga mista, salvo 1/2, importação de configurações antigas, campanha e abertura por file:// sem rede.
- Executar npm test e npm run test:browser. Medir geração, busca de caminhos e atualização/renderização no navegador, incluindo muitas unidades; relatar ambiente e medições reais, sem declarar FPS garantido.

Evidência da etapa original de desenho: leitura do motor/UI/render, confirmação das duas folhas de sprites no cache local e geração de um mapa 128 × 96 em memória, com 12.288 casas e QGs válidos. Não houve mudança de código do jogo, teste completo das novas regras, medição de FPS ou validação de equilíbrio.
