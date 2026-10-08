# Implementação da aviação
Spec: ../specs/2026-10-08-aviacao-design.md

Executar no projeto indicado pelo usuário, mantendo suas alterações. O usuário autorizou commit e envio ao GitHub ao concluir.
1. [x] Dados e regras compartilhadas: seis modelos, economia, mapa, ocupação e produção de aeroportos.
2. [x] Voo, investidas, mísseis, radar, bombas, defesa e reserva externa.
3. [x] Construção, manutenção e IA.
4. [x] Interface, sprites offline, mapa por viewport e manual.
5. [x] Testes do motor e navegador, regressões e revisão final.

Ruling: implementar no checkout indicado — autorização explícita do usuário para este projeto; preservar mudanças existentes.
Pre-flight: voo/seleção usam posição real; aeronaves pousadas usam a camada terrestre; aeroportos têm perímetro multicélula; todos os novos custos são validados antes da cobrança.

Concluído: `npm test` e `npm run test:browser` aprovados. Cobertura e medições em [aviacao-verificacao.md](../../aviacao-verificacao.md).
