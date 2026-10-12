# Balanceamento — revisão implementada em 11/10/2026

## Estado

Sete ajustes do relatório da conversa aplicados localmente. Este documento substitui a revisão anterior, que tinha alcances de tanques, compatibilidades aéreas e probabilidades desatualizadas. As tabelas CSV e os cenários JSON foram recalculados a partir do motor vigente.

## Mudanças aplicadas

| Campo | Antes → agora | Efeito e risco |
|---|---|---|
| Helicóptero básico: custo | 140 → 150 | +7,1%; quatro continuam cabendo em 600. Preço não altera um duelo isolado. |
| Caça vermelho: casco / completo / concreto | 380 → 400 / 590 → 610 / 472 → 488 | Nenhum caça cabe na formação 600. Formação antiga acima do orçamento usa o fallback existente. |
| Canhão ar-ar: multiplicador contra veículos | 1,5 → 1,25 | Dano normal 30 → 25; esperado próximo 26,435 → 22,015. Ar-terra mantém 30. |
| Posto: HP | 80 → 90 | Sobrevive a cruzeiro periférico normal de 80; central de 160 ainda destrói. Captura mantém duração. |
| Posto: renda | 8 → 7 por ciclo | QG+4: 47 → 43; QG+12: 111 → 99. Retorno nominal de posto criado: 137,5 → 157,1 s. Pode atrasar aviação e prolongar partidas. |
| AAM de helicóptero ar-ar contra bombardeiros em voo | Bloqueado → permitido | Novo contra-jogo aéreo; conserva alcance, recarga, velocidade, flares e evasão. Canhões continuam incompatíveis com aviões. |
| IA normal: limite aéreo | 3 → 4 | Permite caça, multifunção, furtivo e bombardeiro, com caixa e infraestrutura. Pode aumentar dificuldade. |

Pesado conserva recarga 3,5 s e alcance 7. Antirradiação conserva interceptação 15%; cruzeiro, 75%. Doutrinas, drones e preços dos bombardeiros seguem a revisão aprovada. Manual e painel refletem os ajustes.

## Mapeamento e interpretação

Custo determina oportunidade de compra e formação. HP determina resistência e limiares de abate. Dano depende de compatibilidade, precisão, crítico, cobertura e multiplicadores; recarga determina cadência RTS. Alcance exige visão aliada: pesado alcança 7, mas tem visão base 5. Velocidade, terreno e orçamento de movimento determinam acesso a alvos. Treino depende de filas por produtor; unidades iguais compartilham lote e podem sair juntas.

Economia: saldo 150, orçamento de formação 600, padrão 565; renda 15 por QG + 7 por posto a cada 10 s RTS ou início do turno próprio a partir da rodada 2. Criar posto custa 60 e consome infantaria 50; capturar neutro evita esse investimento. Aeroporto custa 400, dois engenheiros e 30–60 s de obra; concreto oferece desconto integral de 20% e serviço 10 s, contra 20 s na terra. Munição aérea faltante é paga no rearmamento; drone furtivo tem dois tiros sem reposição.

Cobertura: colina 20%, sebe 25%, floresta 30%, montanha 50%; trincheira +25%, até 75%, removida ao receber dano. Supressão reduz precisão em 25 pontos. Médio perde 10 pontos por casa além de 3; leve não atinge pesado. Canhão/AGM/antitanque e cerco ameaçam blindados, que não respondem ao ar. Reconhecimento habilita armas de longo alcance e tem valor além do dano.

Veterania nos abates 1/3 melhora dano, precisão e HP, cura e acrescenta recompensas econômicas. Comandante fornece aura a duas casas; sua perda corta saldo atual pela metade. Doutrinas alteram renda/dano/vida de tropas; estruturas não recebem bônus de vida defensivo. Vitória exige eliminar o último QG ou posto; aeroporto sozinho não sustenta a facção.

## Evidências reproduzíveis

- [unidades.csv](unidades.csv): custos, HP/crédito, treino, visão, dano e munição das 26 classes/variantes.
- [confrontos.csv](confrontos.csv): 1.014 comparações, arma/compatibilidade, flare e alcance máximo.
- [armas.csv](armas.csv): 120 combinações de arma/alvo válidas.
- [cobertura.csv](cobertura.csv): terreno/trincheira, com arredondamento por impacto.
- [evidencias.json](evidencias.json): hash, constantes, oito combinações mapa/modo e 16 grupos de cenários.
- Reprodução: node reports/balanceamento-2026-10-11/calcular.cjs.

O cálculo registra disparos incompatíveis como ausência de dano. Não força canhão de helicóptero contra avião. IA confirma quatro modelos nos dois modos; formação confirma ambos os caças acima de 600.

Básico contra dois lançadores: defesa eliminou o helicóptero em 2/12 sementes; contra uma AA, em 11/12. Campo aberto, início próximo, 20 s RTS, sem micro/escolta. Preço não altera esse duelo; não é taxa de vitória competitiva. Uma salva central de quatro foguetes destrói posto aberto de 90 HP com probabilidade 81,92%, sem bônus; antes eram 97,28%.

## Verificação

Passaram: seis grupos de regressão em balance-revision.test.cjs; regras aéreas; oito verificações de postos/doutrinas; onze de implantação; integração de partida (ciclo, 456 verificações econômicas, 580 de combate e preços/painel); 1.114 verificações de helicópteros; manual desktop/celular. Integrações Chrome offline cobrem quatro mapas, RTS/turnos e ambos os lados conforme o escopo de cada suíte.

npm.cmd test NÃO passou: engine.test.cjs:16 espera 0,5 de movimento restante, motor retorna 1,5. Mesma falha executada antes da edição. aviation.test.cjs:28 falha em aiAirportPlan; reproduzida em memória revertendo os sete ajustes. Falhas existentes não foram mascaradas nem tratadas como aprovação geral. Não houve validação multiplayer nesta implementação.

## Hipóteses abertas

Nenhuma unidade demonstrada dominante ou inútil em partidas completas. Ganhos de tempo, taxas de vitória e equilíbrio competitivo não medidos. Validar com partidas espelhadas na mesma semente, registrando primeira captura, perdas por custo, renda acumulada e duração, nos dois modos. Isolar efeito da renda, preço dos helicópteros e bombardeiro da IA. Uma partida detecta problemas, não confirma equilíbrio; ampliar depois sementes, cobertura, escolta e mapas.

## Métricas atuais

Nível 1, equilibrada, aberto, sem supressão/aura (comandante recebe sua própria aura), sem contramedidas. Dano esperado inclui precisão, crítico e arredondamento. DPS é limite da arma sem movimento/giro; aviões têm munição finita, não é dano sustentado em partida. Ação é da arma de referência, não toda a missão. Alcance é da arma de referência; canhão de helicóptero é 3. Treino RTS em segundos; turnos = segundos/10.

Motor SHA-256: acb1e44c20c35957a52d35facf802eb26fa04513d4ea66ed7dfd9fa9755567ec

| Unidade | Custo | HP | Alvo | Dano/ação | DPS limite | Alcance | Visão | Treino RTS |
|---|---:|---:|---|---:|---:|---:|---:|---:|
| Infantaria | 50 | 100 | infantry | 32.58 | 40.73 | 1.15 | 4 | 10 |
| Tanque leve | 100 | 110 | infantry | 27.15 | 13.58 | 3 | 5 | 20 |
| Tanque médio | 150 | 170 | infantry | 46.58 | 18.63 | 5 | 5 | 30 |
| Tanque pesado | 240 | 280 | infantry | 70.38 | 20.11 | 7 | 5 | 40 |
| Artilharia | 180 | 100 | infantry | 74.80 | 14.96 | 16 | 3 | 40 |
| Batedor | 75 | 75 | infantry | 33.57 | 30.52 | 2 | 7 | 10 |
| Engenheiro | 65 | 85 | infantry | 18.63 | 15.53 | 1.15 | 4 | 20 |
| Antitanque | 110 | 90 | tank | 79.22 | 26.41 | 3 | 4 | 20 |
| Metralhador | 90 | 110 | infantry | 63.10 | 52.58 | 2.5 | 4 | 20 |
| Veículo antiaéreo | 160 | 70 | helicopter | 66.24 | 18.93 | 30 | 6 | 30 |
| Soldado lançador | 90 | 80 | helicopter | 31.05 | 10.35 | 3 | 4 | 20 |
| Helicóptero | 150 | 120 | infantry | 52.70 | 52.70 | 3 | 6 | 30 |
| Helicóptero ar-terra | 230 | 120 | tank | 86.19 | 28.73 | 5 | 6 | 40 |
| Helicóptero ar-ar | 180 | 120 | helicopter | 65.25 | 21.75 | 6 | 6 | 40 |
| Artilharia de mísseis | 240 | 90 | tank | 64.00 | 6.40 | 30 | 3 | 40 |
| Drone de reconhecimento | 90 | 60 | infantry | 0.00 | 0.00 | 0 | 12 | 20 |
| Drone furtivo | 160 | 50 | antiAirVehicle | 34.39 | 11.46 | 8 | 12 | 30 |
| Comandante | Inicial | 140 | infantry | 49.20 | 32.80 | 2 | 5 | — |
| Caça aliado | 610 | 150 | bomberRed | 61.52 | 102.54 | 14 | 12 | 30 |
| Caça inimigo | 610 | 160 | bomberBlue | 61.86 | 103.10 | 14 | 12 | 30 |
| Multifunção aliado | 750 | 180 | tank | 99.37 | 165.61 | 10 | 12 | 40 |
| Multifunção inimigo | 920 | 200 | tank | 125.73 | 209.55 | 12 | 12 | 40 |
| Caça furtivo aliado | 1000 | 180 | bomberRed | 61.52 | 102.54 | 14 | 12 | 50 |
| Caça furtivo inimigo | 1030 | 190 | bomberBlue | 61.86 | 103.10 | 14 | 12 | 50 |
| Bombardeiro furtivo aliado | 1296 | 240 | hq | 160.00 | 26.67 | 40 | 12 | 60 |
| Bombardeiro pesado inimigo | 2224 | 340 | hq | 160.00 | 26.67 | 40 | 12 | 80 |
