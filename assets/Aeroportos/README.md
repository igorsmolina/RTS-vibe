# Aeroportos

Assets gerados com a ferramenta integrada imagegen em 10/10/2026. PNGs com alfa real, incorporados em `public/js/assets.js` para abertura offline.

- `airport-dirt.png`: 1008 × 336; aeroporto construído de 6 × 2 casas.
- `airport-concrete.png`: 1344 × 504; aeroporto capturável de 8 × 3 casas.
- `sources/`: saídas originais preservadas. `npm run prepare:airports` prepara e incorpora as duas imagens usando a ferramenta já instalada de navegador.

As cores de equipe são desenhadas pelo jogo. Os dois pedidos usaram `transparent_background: true` na ferramenta integrada.

## Prompt da terra

```text
Use case: stylized-concept. Generate ONE production PNG asset for a 2D military RTS: a compact dirt airfield, directly overhead orthographic view, zero perspective, fully transparent outside rectangular footprint. Footprint 3:1 horizontal (6 by 2 game tiles). Runway runs horizontally from left to right centered at 50 percent height, straight uninterrupted packed tan dirt strip, subtle tire tracks and edge markings. One small olive drab metal hangar and simple service sheds placed along TOP edge only. Bottom edge is an empty narrow parking apron with room for four aircraft but NO aircraft painted anywhere. Crisp hand-painted semi-realistic military game sprite, muted olive gray tan palette, restrained details readable at 336x112 pixels. Entire footprint visible with small transparent outer margin. No background scenery, no text, no logos, no people, no vehicles, no aircraft, no isometric angle. Save this generated project asset for later copying into assets/Aeroportos/airport-dirt.png.
```

## Prompt do concreto

```text
Use case: stylized-concept. ONE production PNG sprite for a 2D military RTS: a large concrete airport, strict directly overhead orthographic top-down view, zero isometric perspective. Transparent background outside the entire rectangular facility. Wide footprint 8:3 horizontal aspect ratio. A straight horizontal concrete runway across center at 50 percent height with pale centerline and threshold markings at both ends, unobstructed. Top strip contains two restrained olive-gray hangars and a small control tower, with military utilitarian roof details. Bottom strip is concrete apron with four EMPTY parking bays and short taxiway connections to runway. Whole rectangle visible with small transparent outer margin. Hand-painted semi-realistic game asset, crisp readable at 448x168 pixels, muted olive green gray concrete palette, subtle surface weathering and small roof shadows. No aircraft, no vehicles, no people, no decorative scenery, no text, no logos, no watermark, no background landscape. Concrete airport visibly more developed than a dirt airfield. This will become assets/Aeroportos/airport-concrete.png.
```
