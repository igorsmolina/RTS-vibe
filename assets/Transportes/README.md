# Sprites de transporte

Seis imagens criadas com **ImageGen integrado**, preparadas como PNG RGBA de 128×128, transparência real, frente para o norte e vista superior ortográfica.

| Unidade | Aliado oliva | Inimigo vermelho |
|---|---|---|
| Caminhão militar 6×6 | [PNG](truck-blue.png) | [PNG](truck-red.png) |
| Helicóptero de transporte | [Chinook](helicopter-blue.png) | [Mi-8](helicopter-red.png) |
| Avião de reforço | [C-130](plane-blue.png) | [An-12](plane-red.png) |

Os originais em alta resolução permanecem em `sources/`. Os prompts de geração estão em [prompts.json](prompts.json). As imagens finais estão incorporadas em `public/js/assets.js` para funcionamento offline.

Execute `npm.cmd run prepare:transports` para recortar pelo alfa, reduzir proporcionalmente, validar os seis PNGs e atualizar a incorporação. Este comando apenas prepara a arte existente; não gera novas imagens. Usa Node, Chrome e Playwright já disponíveis no projeto.

Prancha de conferência em `test-output/transportes/preview.png`: sprites sobre grama, floresta, montanha e deserto. Medidas em `validation.json`. O fundo da prancha não pertence aos PNGs finais.

Comandos, capacidades, regras de carga e verificação: [implementação](../../docs/transportes/IMPLEMENTACAO.md).
