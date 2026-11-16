# Reproducing the Reference Frames in the Existing ODDLIGHT Engine

These notes map each reference image to the **actual architecture** in this repo — no new engine required. Everything below uses helpers that already exist in `engine/three/lib/` (`core.js`, `nature.js`) and `productions/002-tunguska/scenes/lib/world.js`, plus the per-scene module pattern (`build({dur}) -> { renderer, render(t) }`) consumed by `engine/three/render.mjs`.

## 0. One format caveat (important)

The engine renders **9:16 vertical (1080×1920)** per `core.js` (`W=1080, H=1920`) and `project.json`. The references are **16:9** per the reference-pack spec. Use them as guidance for **lighting, materials, atmosphere and depth layering**, and re-stage the composition vertically: keep the layer order and light logic, stack fore/mid/background along the vertical axis, and let skies/foregrounds extend. Do **not** letterbox. If a 16:9 master format is ever wanted, only `W/H` in `core.js`, the camera aspect in each scene, and `project.json → format` need to change — nothing else in the pipeline assumes the aspect.

## 1. Shared recipe (all frames)

- **Scene bootstrap:** `world({ renderer, skyEl, skyAz, fog, fogColor, snow, scorch })` from `scenes/lib/world.js` — gives procedural `Sky`, PMREM `skyEnvironment` ambient, `FogExp2`, and FBM terrain coloured by `terrainColor(snow, scorch)`.
- **Forests:** `treesIn({...})` windows + `makeForest(...)` instancing (`nature.js`). Near forest casts shadows; far forest (`spacing: 7, scale: [13,22]`) doesn't — exactly the `s1_dawn_fireball.js` split. Tree states (standing / falling / stripped) come free from `coniferGeometry({stripped})` + `update(stateFn)`.
- **The ODDLIGHT signature light:** one warm source per shot (sun, fireball, flash). Implement as a single `DirectionalLight` with shadows (the `fireLight` pattern in s1) or `sunLight()`; everything else is `HemisphereLight` + environment.
- **Atmosphere:** depth comes from fog density + fog-colour lerp toward the warm source (`scene.fog.color.lerp(...)`, s1 pattern) + `particles()` for mist/dust/smoke/ash.
- **Grade:** already enforced globally by `makeRenderer` (ACES) and `project.json → visual.grade` (grain 4, vignette, contrast 1.03, saturation 1.06, bloom 0.22). References were chosen to sit inside this grade — don't add per-scene colour hacks.

## 2. Per-frame mapping

Each `metadata/frame_XX_reference.json` carries the full breakdown (layers, palette, must-preserve, simplifications). Engine summary:

| Frame | Existing building blocks | New work needed |
|---|---|---|
| 01 wilderness | `world` + s1 forest split, s1 camera glide | river ribbon mesh (reflective ribbon along an fbm contour) |
| 02 cabin | `world`, forest `keep` clearing, homestead group in `scenes/lib/world.js` | richer log-stack cabin (stacked vertex-painted cylinders + shingle rows), rising-smoke `particles` preset (`fall` negative) |
| 03 flash | s1 `fireLight` shadow pattern, `glowTexture` sprite stacks, fog lerp | cool-stop glow palette; intensity ramp in `render(t)` |
| 04 fireball | `fireball(scene, {size, trail, smoke})` + path lerp — this IS s1's mechanism | widen FOV, bog-pool reflection plane (low-roughness plane + env) |
| 05 shockwave | `fallState(R)` + `makeForest.update` — this IS s4's mechanism | advancing dust-wall billboards tied to radius R; debris particle bursts |
| 06 flattened | `flatRadius` butterfly zone, `inFallZone`/`inStandZone`, `terrainColor(scorch)` — s6's data | bog-pool discs; overcast = drop the sun, hemisphere+env only |
| 07 aftermath | stripped instances with `fall:1` + dir jitter, scorch 0.8 | smoke-column particle preset; hero foreground wreck pieces (merged stripped geometry laid horizontal) |
| 08 expedition | frame 06 field reused | low-poly anonymous figure silhouettes (capsule-based, ~1.75 units, dark wool tones, no faces) — sufficient at <5% frame height; simple tripod primitives |

## 3. Suggested small library additions (reusable beyond Tunguska)

1. `nature.js → riverRibbon(heightFn, pathPoints, {width, roughness})` — frames 01/04, any future water.
2. `nature.js → smokeColumn(scene, {x, z, height, rate})` — thin wrapper over `particles` with negative fall; frames 02/07.
3. `nature.js → dustWall(scene, {radiusFn, arc, color})` — billboard ring segment for advancing fronts; frame 05.
4. `core.js → figureSilhouette({height, tone, pose})` — anonymous human staffage; frame 08 and every future historical reconstruction.

Each is ≤50 lines in the established style (deterministic `rng`, vertex colours, no textures from disk).

## 4. Quality gates when reproducing

Match the reference's **layer count** (every frame has 4+ depth layers), its **single-warm-light rule**, and its **palette** (see `dominant_colors` in each JSON — sampled from the actual generated images). The drained grade of frames 06–08 (no warm accent) is intentional narrative logic; don't "fix" it.
