# Mísseis do RTS Vibe

Seis imagens criadas com ImageGen, com transparência real, vista de cima e ponta para cima. Originais em `sources/`, sprites de uso em 128×128. Fumaça e chama pertencem à animação do jogo.

| Sprite | Unidade |
|---|---|
| [Antiaéreo](anti-air.png) | Veículo antiaéreo e interceptores |
| [Ar-terra](air-ground.png) | Helicóptero ar-terra |
| [Ar-ar](air-air.png) | Helicóptero ar-ar e aviões com ar-ar |
| [Foguete](artillery-rocket.png) | Artilharia de mísseis |
| [Drone](drone-missile.png) | Drone furtivo |
| [Cruzeiro](cruise.png) | Bombardeiros |

`node scripts/prepare-missiles.cjs` exporta e incorpora os seis PNGs em `public/js/assets.js` para funcionamento offline. O renderizador orienta pela trajetória; falha de imagem usa o desenho anterior.

Regras e validação: [mísseis, drones e bombardeiros](../../docs/misseis-drones-bombardeiros.md).
