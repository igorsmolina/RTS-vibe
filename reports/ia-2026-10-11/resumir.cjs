'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const base='reports/ia-2026-10-11/',read=n=>JSON.parse(fs.readFileSync(base+n,'utf8'));
const matrix=read('matriz.json'),reg=read('regressoes.json'),before=read('estado-inicial-completo.json'),browser=read('offline-browser.json'),suites=read('suites-final.json'),oldSuites=read('suites.json');
const hash=crypto.createHash('sha256').update(fs.readFileSync('public/js/engine.js')).digest('hex');assert.equal(matrix.results.length,32);assert.equal(matrix.sourceHash,hash);assert.equal(reg.sourceHash,hash);assert.ok(reg.results.every(r=>r.ok));assert.ok(suites.every(r=>r.sourceHash===hash));
const natural=matrix.results,lines=[];
for(const map of ['river','desert','mountain','random'])for(const mode of ['rts','turns']){const r=natural.filter(x=>x.map===map&&x.mode===mode),range=key=>{const n=r.map(x=>x.final[key]);return Math.min(...n)+'–'+Math.max(...n);};lines.push(`| ${map} | ${mode} | ${range('posts')} | ${range('airports')} | ${range('planes')} | ${r.map(x=>x.aiDecisions).join('/')} |`);}
const failed=suites.filter(r=>r.code!==0).map(r=>{const b=oldSuites.find(x=>x.source==='test-output/ai-engine-before.js'&&x.file===r.file);const message=(r.stderr.match(/AssertionError[^]*?(?=\n\s+at )/)?.[0]||r.stderr.split('\n').find(s=>/Error:/.test(s))||r.error||'Ver log JSON').replaceAll('|','/').replace(/\s+/g,' ');return `| ${r.file} | ${b?.code!==0?'Falhava no estado inicial':'Nova falha nesta execução'} | ${message} |`;});
const manifest={date:'2026-10-11',node:process.version,engineHash:hash,initialEngineHash:before.sourceHash,regressions:reg.results.length,baselineFailures:before.results.filter(r=>!r.ok).length,naturalScenarios:natural.length,aviationScenarios:natural.filter(r=>r.aviation).length,browserScenarios:browser.results.length,suitePassed:suites.filter(r=>r.code===0).length,suiteFailed:failed.length};fs.writeFileSync(base+'manifesto.json',JSON.stringify(manifest,null,2));
fs.writeFileSync(base+'relatorio.md',`# IA: investigação, alterações e evidências — 11/10/2026

## Estado inicial e limites da comparação

O checkout já tinha alterações locais em balanceamento, interface e testes. Elas foram preservadas. A referência é a cópia do motor encontrado no início, em test-output/ai-engine-before.js, e não o HEAD do Git. SHA-256 inicial: ${before.sourceHash}. SHA-256 verificado: ${hash}. Node: ${process.version}.

Os primeiros 12 cenários registraram 11 falhas antes da implementação (estado-inicial.json). A bateria ampliada final registra ${before.results.filter(r=>!r.ok).length} falhas em ${before.results.length} cenários no motor inicial e ${reg.results.length}/${reg.results.length} aprovações no motor modificado. Os testes são determinísticos sobre o motor real. Nenhum resultado abaixo representa partidas humanas ou taxas de vitória.

## Fluxo rastreado no código existente

1. Game/generate cria river, desert, mountain ou random. O terreno é público: explored começa verdadeiro e os postos e pistas neutros são conhecidos. Rios bloqueiam solo; pontes dão acesso; montanhas bloqueiam veículos, mas permitem infantaria. Aviões usam o motor de voo; helicópteros e drones usam navegação aérea.
2. updateVision atualiza visão, radar e memória de estruturas. A IA registra as posições e a vida observadas das tropas azuis em intel. Essa informação alimenta compras, defesa e avaliação de objetivos.
3. planAI prepara o exército no rallyPoint, situado em uma casa acessível a tanque perto de 30% do caminho para o QG presumido. Depois monta uma onda, avança e reagrupa ao perder metade de sua força. Antes, só a preparação e as perdas tinham gatilhos de transição; não havia prazo de progresso da ofensiva.
4. objective escolhia a estrutura azul lembrada menos defendida, usando distância para desempatar; sem estrutura conhecida, presumiu o QG pela simetria do mapa. Não verificava a rota. A presunção continua uma hipótese sobre o mapa, sem ler o QG oculto.
5. aiAct trata aviões, drones, bombardeio de artilharia, serviço aéreo, retirada de feridos, reparos e minas conhecidas; depois combate imediato, defesa do QG/postos, avanço da onda, reconhecimento, captura e reunião. Antes, a coesão pela mediana podia manter a frente esperando por unidades sem acesso.
6. pathToRange/findPath usam A* e custos reais de terreno. moveToward divide o avanço em pernas. RTS processa decisões a cada 0,6 s, até oito unidades por atualização; unidades terrestres pendentes ficam fora da fila. routeRTS tenta recalcular a rota. Turnos usam moveLeft e actionLeft, resolvem ações e passam a vez automaticamente.
7. aiBuy compara déficit de classes, tropas próprias, filas e inimigos visíveis. enqueue/canRecruit/recruitCost validam catálogo, crédito, produtor, fila e preço. production aguarda tempo e vaga sem cobrar novamente. Diferenças preexistentes de renda e limites por dificuldade foram mantidas.
8. aiAirportPlan captura pistas ou constrói com dois engenheiros e 400 créditos. aiPlaneAct decide serviço, decolagem, retorno, ataque, cruzeiro, bombardeio e patrulha. O motor comum mantém vagas, exclusividade da pista, identificação, munição, contramedidas, retorno e duração do serviço.

## Causas e solução aplicada

| Causa identificada | Correção na arquitetura existente |
|---|---|
| Captura convertia rota null em lista vazia e aceitava a ordem. No RTS continuava pendente, fora da fila; em turnos repetia intenção sem avanço. | Rejeita captura sem acesso, distinguindo null de estar no alcance. |
| Objetivo escolhido por guarda/distância, sem acesso e sem registro da tentativa fracassada. | Compara rota, custo e força local observada; considera expansão, ataque, reconhecimento e flanco alcançável. |
| Preparação podia esperar indefinidamente pelo grupo mínimo; ofensiva e coesão não detectavam estagnação. | Prazo de preparação; mede deslocamento da coluna terrestre e dano observado ao objetivo. Após 30 s ou três rodadas sem progresso, evita o objetivo por 90 s/seis rodadas e escolhe outro. |
| Unidades pendentes, inclusive operários de pista, ficavam tentando rota bloqueada sem voltar a decidir. | Observa posição; após 12 s ou duas rodadas sem avanço, libera a ordem e aplica recusa local temporária. Não cancela combate com alvo ao alcance nem captura/obra já no local. |
| Aviões entravam no grupo terrestre e podiam distorcer concentração/coesão. | Aviões têm decisões próprias e não compõem a onda terrestre. Helicópteros não mascaram o progresso da coluna de solo. |
| Captura de pista podia ser substituída por posto mais próximo no próximo turno. | Mantém a missão de aeroporto entre turnos, preservando resposta a combate, ferimento e bloqueio. |
| Construção por turnos trocava o local quando um engenheiro não tinha movimento; RTS reassociava operários repetidamente. | Retém local alcançável e não reinicia a associação já válida. Operários bloqueados podem sair do impasse; obra incompleta não vira pista nem restitui o custo. |
| Compra aérea começava em caça e seguia um ciclo fixo; compras terrestres consumiam saldo antes de atingir o preço da aeronave. | Poupa para a oportunidade aérea com pista e vaga. Interceptação usa caça/furtivo; ameaça terrestre usa multifunção; concentração/estruturas podem justificar bombardeiro. Respeita limite e libera compras terrestres quando fila/pátio impedem aviação. |
| Serviço exigia carga completa mesmo sem dinheiro; metralhadora restante podia impedir retorno de avião sem armamento principal. | Decola com carga parcial útil e condições de saúde; espera orçamento quando sem carga útil. Retorna para rearmar armas principais e cobra munição pelo serviço comum. |
| Patrulha podia ser reordenada no mesmo centro; avaliação consultava desaparecimento/estado real de contatos ocultos. | Evita transferências redundantes; usa memória e prazo dos contatos (60 s/quatro rodadas). Rotas da IA usam estruturas vistas ou lembradas; morte/destruição oculta não atualiza inteligência. |

Não foram adicionados rede, servidor, dependências, recursos, visão ou unidades ao produto. A IA continua usando order, enqueue, buildAirport e servicePlane. Só os testes configuram forças e orçamento. Não há treino entre partidas: a memória de falhas é pequena (até oito objetivos) e expira.

A revisão independente encontrou uma falha adicional: um probe criado com alvo oculto não registrava o HP quando ele se tornava visível. A reprodução falhou antes da correção (revisao-red.log). Agora o primeiro HP observado inicializa a medição; danos posteriores renovam o prazo. A regressão passou e o revisor confirmou a correção.

## Cenários executados e resultados

Matriz natural: seed 44, estado normal de início, jogador azul sem ordens, 180 segundos no RTS ou 48 turnos azuis/vermelhos, quatro dificuldades. Cada linha abaixo agrega fácil/normal/difícil/veterana; decisões aparecem nessa ordem. Postos, pistas e aviões são contagens finais medidas, não metas de equilíbrio.

| Mapa | Modo | Postos próprios | Pistas próprias | Aviões próprios | Decisões por dificuldade |
|---|---|---|---|---|---|
${lines.join('\n')}

Além disso, as 32 combinações executam oportunidade aérea controlada: pista própria, saldo exatamente igual ao preço do multifunção, terreno local livre e blindado visível. O alvo tem 2.000 HP para permitir observação repetida; demais unidades não recebem ordens estratégicas nessa etapa. Compra deixou saldo zero, produção entregou avião pousado, decolagem e ataque consumiram AGM reais. O cenário não mede potência de combate ou sobrevivência contra defesa antiaérea. Detalhes por combinação, munição inicial/final, coordenadas, filas, decisões e tempos estão em matriz.json.

Na matriz natural, os planos observados foram expansão e reconhecimento; defesa, reagrupamento, flanco e seleção de alvo menos protegido foram exercitados nos cenários controlados. Isso não demonstra que todas essas respostas surgem com frequência adequada em partidas humanas.

Os ${reg.results.length} cenários curtos cobrem captura inacessível, ofensiva parada, outra ponte disponível, ponte única bloqueada, perda da onda, força inimiga local, neblina, compra/poupança/limite, serviço pago, carga parcial, retorno sem arma principal, persistência da captura de pista e obra bloqueada. Em reprodução de travessia, a tropa usa a segunda ponte e captura o posto nos dois modos. Na ponte única obstruída, a ordem pendente é liberada. Dano observado ao objetivo mantém a tentativa ativa; unidades apenas esperando não produzem progresso fictício.

Chrome real abriu public/index.html por file:// com rede desligada e executou ${browser.results.length} combinações de mapa/modo, planejamento e desenho da interface, sem pageerror. É um smoke test offline de integração; não é uma partida humana completa. Resultados em offline-browser.json.

## Suítes gerais e pendências reais

As 30 suítes preexistentes da sequência npm test foram executadas isoladamente para não ocultar verificações depois da primeira falha. Nesta execução final, ${suites.filter(r=>r.code===0).length} passaram e ${failed.length} falharam. A suíte geral não está verde. O estado inicial e os logs finais estão em suites.json e suites-final.json. Os novos cenários curtos também foram incluídos no comando npm test.

| Suíte com falha final | Comparação com início | Mensagem |
|---|---|---|
${failed.join('\n')}

As verificações de performance rodam na máquina compartilhada, com outros testes simultâneos; seus limites históricos e máximos de tick não demonstram ganho ou regressão isolada. Falhas de contrato/dados já existentes não foram reescritas para fabricar aprovação. A suíte aviation chega mais longe que no início. Fato no código da fixture: mantém memória do mapa anterior ao apagar estruturas. Hipótese para sua falha restante: esse estado artificial pode enviar a IA para uma pista lembrada inexistente. Os cenários novos limpam memória ao criar um campo artificial, e a matriz usa geração normal.

Ainda requer partidas humanas: ritmo da expansão/ataque, qualidade do flanco, prioridades de bombardeio sob antiaéreas, sobrevivência e custo de rearmamento em combate prolongado, mapas com outras sementes e qualidade de dificuldades. Os testes comprovam transições, execução e restrições nos cenários registrados; não comprovam aprendizado permanente, taxas de vitória ou superioridade estratégica geral.

## Reprodução

- npm.cmd run test:ai — cenários curtos no motor atual.
- npm.cmd run test:ai:matrix — 32 simulações naturais e 32 oportunidades aéreas.
- node tests/ai-offline.browser.test.cjs — Chrome offline nos quatro mapas e dois modos.
- RTS_AI_ENGINE=test-output/ai-engine-before.js e RTS_AI_RESULT=reports/ia-2026-10-11/estado-inicial-completo.json permitem executar os cenários no snapshot inicial (no PowerShell, definir via $env).
- $env:RTS_AI_AUDIT_CURRENT='1'; node tests/ai-audit.cjs — todas as suítes gerais isoladas.
- node reports/ia-2026-10-11/resumir.cjs — recompõe este relatório e valida hashes dos resultados.

As matrizes intermediárias foram preservadas em arquivos separados; apenas matriz.json usa a versão final identificada no manifesto. Alterações mantidas locais, sem commit ou envio.
`);
console.log(manifest);
