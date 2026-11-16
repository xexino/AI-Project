# ODDLIGHT — Tunguska Visual Reference Pack: Art Direction

Production: `productions/002-tunguska` — *The Explosion That Flattened 80 Million Trees*
Purpose: a consistent, reusable visual-reference standard for the procedural Three.js engine (`engine/three`), applicable to every future ODDLIGHT documentary.

## Visual identity

The pack targets a **premium historical science documentary** look — not a video game, not generic AI art.

1. **One warm light per shot.** This is the existing ODDLIGHT signature (see `project.json → visual.style`): fireball, lantern/cabin smoke-light, or a low sun. Everything else stays cool and restrained.
2. **Restrained cinematic contrast.** Shadows are cool and readable, highlights roll off softly (ACES tone mapping in `core.js makeRenderer` already matches this).
3. **Natural palette.** Forest greens `#3a3b2f`/`#2e3328`, earthy browns `#4d4030`/`#51483d`, cool atmospheric grays `#82868b`/`#acb1b9`, one warm accent `#9f7b64`→`#ffc890` where the signature light appears. No orange-and-teal grading, no oversaturation.
4. **Atmosphere carries depth.** Every frame uses mist, haze or smoke to separate foreground / midground / background (engine: `FogExp2` + fog-color lerp toward the warm light, as in `s1_dawn_fireball.js`).
5. **Scale through staffage.** Human-scale anchors (cabin, expedition figures) are small against enormous landscapes.
6. **Historical plausibility.** 1908 Siberia: hand-hewn timber, period clothing/equipment only, no modern objects, no fantasy elements, no Hollywood mushroom clouds, no impact crater (Tunguska was an airburst).

## Camera language

- Wide and very wide shots (approx. 21–40 mm full-frame equivalents), strong fore/mid/background layering, intentional negative space in the sky or horizon.
- Elevated or aerial perspectives for scale; ground-level only for reflective beats (Frame 07).
- Horizon generally in the upper or lower third, never centered.

## Shot-by-shot arc

| # | Frame | Beat | Signature warm light |
|---|-------|------|----------------------|
| 01 | Siberian wilderness | isolation, scale | low sun through clouds |
| 02 | Lonely cabin | human scale | chimney smoke in soft sun |
| 03 | Mysterious flash | first anomaly | distant white-blue flash (the one *cool* "warm slot") |
| 04 | Fireball | the event | fireball core + trail |
| 05 | Shockwave | force | dusty directional sunlight |
| 06 | Flattened forest | aftermath scale | none — overcast (deliberate absence) |
| 07 | Aftermath | reflection | faint smoke-filtered sky |
| 08 | Scientific reconstruction | investigation | overcast, neutral |

The warm accent fades out of the back half of the film deliberately: the world after the event is drained of it until the end card.

## Mandatory image specs

- 16:9 landscape, target ≥ 2048×1152 (Canva Magic Media sources are 2720×1536).
- No text, captions, watermarks, logos, borders; separate file per frame.
- Files: `frame_01…08_*.png` in this folder; small previews live in `metadata/previews/` (repo-safe); full-res PNGs stay out of Git (see `.gitignore` note in QUALITY_REPORT.md).
