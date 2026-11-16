# Visual reference v1: assessment

Experiment: `002-tunguska-visual-reference-v1`, which re-renders scenes S1–S6 of `002-tunguska` with the reference-guided `reference_v1` look.
Status: **DELIVERY_READY (technical QC 24/24)**. **Human editorial acceptance is pending and has not been marked.**

The scores below are the engineer's own judgement from the comparison sheets in `scenes/` and `full_runtime/`. They are not a measurement of similarity to the references.

## What is identical to the original

| Item | Result |
|---|---|
| Narration, timeline, captions, durations | identical (`sound.audio_from` checks the timeline before reusing the soundtrack) |
| Soundtrack | bit-identical: audio MD5 `ae14e85f1e8737734c99bf0dbe0363ad` in the original, in experiment run 1 and in experiment run 2 |
| Format | 1080×1920, 24 fps, H.264 High, 59.292 s, −14.3 LUFS, −1.3 dBTP |
| S7–S10 and the end card | hard-linked from the original's frames (fingerprint match), not re-rendered |
| Original deliverables | unchanged; the original look path is pixel-identical (PSNR ∞ on sampled S1/S3/S4/S6 frames) |
| Reproducibility | Run 2 re-rendered S1–S6. S1–S3 came out bit-identical in the master to run 1. A re-render of an S5 frame was byte-identical to the stored frame. The master frames that differ from run 1 (15.75–29.83 s) are the intentionally changed S4 plus encoder propagation, which stops exactly at the next keyframe (29.875 s). |

## Reference → scene map

| Reference | Scenes | Image | Used for |
|---|---|---|---|
| frame_01 dawn over the taiga | s1 | present | cloud deck, valley mist, spruce silhouettes, palette |
| frame_02 the cabin | s3 | present | slender spruce, weathered grey log cabin, shingle roof |
| frame_03 the flash | s3 | present | cool white-blue flash palette, smoke wisps |
| frame_04 the fireball crossing | s1, s2 | present | larger fireball core/halo, sky texture |
| frame_05 the shock front | s4 | present | dust front, low warm haze |
| frame_06 the aerial butterfly | s6 | present | radial fallen forest, bog pools, root plates |
| frame_07 the telegraph-pole forest | s5 | present | standing stripped snags, root plates, overcast light |
| frame_08 the expedition | s6 | **missing** (never generated: quota) | metadata-only guidance; reported as a warning in QC `editorial.visual_references` |

## Scorecard (1–10, original → reference_v1)

Criteria: Comp = composition, Light = lighting, Mat = materials, Env = environmental realism, Depth = depth and atmosphere, Anim = animation, Cine = cinematic appearance, Hist = historical plausibility.

| Scene | Comp | Light | Mat | Env | Depth | Anim | Cine | Hist | Mean |
|---|---|---|---|---|---|---|---|---|---|
| S1 dawn / fireball | 6 → 6 | 5 → 6 | 4 → 4 | 4 → 5 | 5 → 6 | 6 → 6 | 5 → 6 | 6 → 6 | 5.1 → 5.6 |
| S2 river / fireball | 6 → 6 | 6 → 6 | 4 → 4 | 5 → 5 | 5 → 5 | 6 → 6 | 6 → 6 | 6 → 6 | 5.5 → 5.5 |
| S3 cabin / flash | 6 → 6 | 6 → 6 | 4 → 5 | 4 → 5 | 5 → 5 | 6 → 6 | 5 → 6 | 5 → 6 | 5.1 → 5.6 |
| S4 shock front | 6 → 6 | 5 → 5 | 4 → 4 | 4 → 5 | 5 → 6 | 6 → 5 | 5 → 5 | 5 → 5 | 5.0 → 5.1 |
| S5 telegraph-pole forest | 6 → 6 | 5 → 5 | 4 → 5 | 4 → 6 | 5 → 5 | 6 → 6 | 5 → 6 | 5 → 7 | 5.0 → 5.8 |
| S6 aerial butterfly | 6 → 6 | 5 → 5 | 4 → 4 | 5 → 5 | 5 → 5 | 6 → 6 | 6 → 6 | 6 → 6 | 5.4 → 5.4 |
| **All six** | | | | | | | | | **5.2 → 5.5** |

### Per-scene notes (improvements and regressions)

- **S1, small gain.** The textured cloud deck gives the sky structure and depth. The forest silhouettes are streaky, and the mist is subtle. The river and mist banks of frame_01 are still missing.
- **S2, mixed, net neutral.** The fireball streak is brighter and longer. *Regression:* the cloud deck reads as blurry, low-resolution smudges in parts of the shot. The reference's fireball core is much larger and more granular than ours.
- **S3, gain.** Slender spires and a grey shingle roof are closer to frame_02. The flash is now cool white-blue, as in frame_03. The logs are still lamp-orange, and the trees are still flat, dark silhouettes.
- **S4, roughly neutral.** Run 1's early frames showed the dust as an opaque white dome (a clear regression). The S4 fix removes that: the front now starts low and rises with the wave. Mid-shot it reads as a dust front. Remaining weaknesses: the early ring is puffy, the dust is a translucent veil rather than a volumetric wall, and nothing looks like frame_05's ground-level view (that reference is a close-up and the scene is aerial). Animation is scored lower because the soft billboard sprites drift slightly against the ring.
- **S5, clearest gain.** Standing stripped snags plus root plates resemble frame_07. Historically, the standing "telegraph-pole" trees at the epicentre are documented by Kulik's expedition. *Weaknesses:* the root plates read as dark cones or blobs, and the field is busy.
- **S6, no clear gain.** In the low shot the root plates are small; the top-down view is nearly identical apart from tiny blue bog pools. Nothing gained versus frame_06.

### Overall

reference_v1 is a **modest** improvement, mean **5.2 → 5.5**. The gains are in sky texture, tree silhouettes and devastation detail (S5). There is one scene-level regression in a sub-element (S2 clouds). The look remains stylized, low-poly procedural 3D and is **far from the photoreal reference frames**. Code-rendered WebGL on a CPU cannot close that gap; it would need either much heavier procedural work or a different rendering approach.

## Render cost

Original, run 1 and run 2 render times per scene are in `render_times.json`.

- **Run 1:** same `--jobs 2` setup as the original, with the earlier S4 version. S1–S6 took 6,523 s against 4,190 s for the original (**+56 %**). Per scene: ×1.85 S1, ×1.91 S2, ×1.10 S3, ×1.01 S4, ×1.77 S5, ×2.02 S6.
- **Run 2:** full S1–S6 re-render after the S4 fix, 12,186 s. The machine was about 2× slower per frame during this run, so these numbers are not comparable with the original's.

## Weaknesses and lessons

1. The references are photoreal and the renderer is stylized, so the similarity is in palette, composition and motifs, not realism.
2. frame_08 is missing; S6 uses metadata-only guidance for it.
3. **Lost cache on an aborted run.** When a scene's fingerprint changes, the visuals stage deletes the stale frames *before* rendering. An aborted run therefore loses the previous frames. Here, a brief edit to shared `cinema.js` (since reverted) cost a full S1–S6 re-render. A safer design would render into a staging directory and swap it in on success.
4. A change to a shared library such as `cinema.js` correctly invalidates every scene importing it. Scene-specific tuning should therefore live in the scene module, which is what the S4 fix now does.
5. Render time rises by about 56 %, up to ×2 for forest-heavy scenes.
6. The scores above are one reviewer's judgement; a human editor needs to confirm them.
