# Campanha ampliada: registro da implementação

Plano aprovado: oito capítulos, provas interativas opcionais, três civis recorrentes, quatro novos fundos e três expressões por personagem. Cenas principais com 3–5 minutos de leitura. A versão anterior deixa de ser selecionável; seus saves reiniciam no primeiro capítulo, preservando uma cópia de recuperação.

## Contratos entre as partes

- `Story` e `Missions`: progresso versão 2, capítulos 1–8, metadados de conquista e escolhas obrigatórias; descobertas no formato `documento:detalhe`, copiadas ao iniciar a missão.
- `StoryScenes`: texto, planos e provas. `shots[].document` contém um identificador, nunca HTML. Detalhes têm identificador, título, trecho, personagem e reação.
- Interface: inspeção opcional, diário, galeria isolada e retorno à fala anterior. Migração guarda o original antes de sobrescrever o armazenamento.

## Decisões

- Preservar a árvore de trabalho e as alterações anteriores nesta pasta; usar a ramificação local `codex/campanha-oito-capitulos` sem publicar ou criar commits.
- Reutilizar transporte e papel de informante para civis sem armas, sem criar um novo sistema de unidades.
- Exibir textos dos documentos como HTML. As imagens geradas contêm apenas cenário e personagens.
- As vantagens opcionais só afetam missões iniciadas depois da descoberta. Resultados e bônus são idempotentes.
- Novos retratos são gerados em folhas de três expressões, exportados em células separadas com transparência original.

## Verificação

- Os oito capítulos passaram pelo fluxo de navegador em RTS e por turnos, com combate controlado para isolar progressão e salvamento.
- Em verificações separadas com a IA ativa, as missões 3, 5 e 6 chegaram à vitória em RTS no Vale dos Rios, semente 55, dificuldade fácil, usando as ordens do motor para deslocar, capturar e embarcar. Essa amostra não mede o equilíbrio entre mapas e dificuldades.
- Capturas da Lia e da inspeção foram revisadas em 1920×1080, 1280×720, 390×844 e 844×390. Fundos e retratos foram exportados em WebP e funcionam offline.
