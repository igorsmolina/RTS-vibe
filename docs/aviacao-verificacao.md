# Verificação da aviação

Data: 08/10/2026. Implementação da [proposta aprovada](superpowers/specs/2026-10-08-aviacao-design.md).

## Escopo entregue

Seis modelos com sprites individuais, voo e investidas, salvas, munição, defesa aérea, bombas e reserva externa. Aeroportos de 6 × 2 com construção cooperativa, captura, produção, pouso e manutenção. Integração da IA, mapa 128 × 96, economia, comandos, minimapa e manual. Scripts clássicos e recursos embutidos preservam abertura por arquivo.

## Verificação

- `npm test`: aprovado, incluindo 33 verificações novas de aviação e as regressões do motor, terreno, IA, campanha, perfil, doutrinas, helicópteros e drones.
- `npm run test:browser`: aprovado na execução completa, incluindo o teste de vídeo do radar.
- Chrome real em modo headless, `file://`, rede desligada; nenhum erro JavaScript ou requisição HTTP no teste de aviação.
- Desktop e telas móveis, incluindo 390 × 844 e 375 × 667; configuração de bombas recolhível e controles acessíveis. Sprites transparentes distintos e minimapa com transformação compartilhada.
- Revisão independente: bloqueios de aproximação/pouso por turnos e substituição da missão externa corrigidos; 33 testes confirmados pelo revisor.

## Medições reais

Windows, Chrome headless 154, viewport 1440 × 1000. Cena com 72 unidades: 64 tanques e 8 aviões; terreno plano, ordens da IA ativadas no último conjunto. Valores da execução completa final em milissegundos:

| Operação | Mediana | Máximo | Amostras |
|---|---:|---:|---:|
| Geração | 34,0 | 37,5 | 3 |
| Caminho longo | 6,7 | 10,9 | 5 |
| Atualização sem IA | 0,6 | 1,7 | 30 |
| Desenho | 1,8 | 5,4 | 20 |
| Atualização com decisões da IA | 6,4 | 85,4 | 5 |

A mesma cena apresentou pico de aproximadamente 915 ms antes de ajustar o limite inferior de custo das buscas. Não há garantia de FPS; decisões simultâneas ainda podem causar picos. `tests/aviation.browser.test.cjs` reproduz as medições e gera JSON e capturas em `tests/artifacts/`, ignorado pelo Git.

## Limites

Os números de equilíbrio são os valores iniciais aprovados, sem validação em partidas humanas completas. Sincronização/login das regressões usam serviço simulado: esta entrega não declara validação de um serviço conectado.
