# 003-mariana-trench: pre-production package (issue #97)

**Phase: PRE-PRODUCTION. Final render NOT authorised.** No final MP4 has been rendered. Nothing was published, merged or paid for.

| Item | Where |
|---|---|
| Research and source list | `RESEARCH.md` |
| Timed beat table (generated from the measured narration; rule check PASS) | `BEAT_TABLE.md`, `beat_table.json` |
| Visual reference and asset board, with provenance | `ASSET_BOARD.md`, `../references/` (registry, metadata, previews) |
| Voiceover for review | `work/preproduction/mariana_voiceover_bm_george_review.wav` (local, git-ignored) |
| Animatic (270×480, 8 fps, watermarked "ANIMATIC · NOT FINAL") and contact sheet | `work/animatic/270x480_8fps/` (local, git-ignored) |
| Reference board image | `work/preproduction/visual_reference_board.jpg` (local, git-ignored) |

## Branch

- Base: `claude/visual-reference-v1` at `fddb328413f449c4258ea2f087dccb63c030f0b9`, verified unchanged before starting and never modified.
- Pilot branch: `experiment/mariana-trench-pilot`.

## Voiceover (pending owner approval)

| Setting | Value |
|---|---|
| Engine | Kokoro-82M, ONNX, local CPU (`kokoro-v1.0.onnx` + `voices-v1.0.bin`), Apache-2.0. Zero cost, no network at synthesis time |
| Voice / language / speed | `bm_george` / `en-gb` / 1.0 (same as the shark and Tunguska pilots) |
| Pronunciation override | "hadal" → `hˈeɪdəl` (HAY-dl). The model's default G2P said `hˈadəl` (HAD-l). Applied through `narration.pronunciations` at the phoneme level, so captions and script text are unchanged |
| Alignment | faster-whisper `base.en`: 127/127 script words matched, 0 interpolated |
| Synthesis time | 13–18 s for all eight lines (stage time, 4-vCPU container) |
| Narration durations (s) | b1 3.14 · b2 6.25 · b3 9.91 · b4 5.61 · b5 5.56 · b6 6.06 · b7 8.14 · b8 7.12 = **51.8 s of speech** |
| Timeline | first word 0.60 s, last word ends 55.58 s, narrated beats end 56.92 s; **total with end card 59.50 s** (target 40–62 s). The issue's draft estimate was ~45 s; the actual read is longer |
| Review WAV | 48 kHz mono, 59.5 s, −21.7 LUFS, −3.9 dBFS peak (unmastered: the final mix is normalised to −14 LUFS) |
| Determinism | regenerating the narration produced an identical file (MD5 `3dcf5578…`) |

ASR re-check of the audio: every line reads correctly. Whisper writes the numbers as digits (10,935 / 8,336 / 6,000), as expected. It hears "hadal" as "handle" at 4% confidence, which is no evidence either way, so **please judge "hadal" by ear.**

## Engine additions (reused, opt-in, backward compatible)

| Addition | Purpose |
|---|---|
| `uses_timeline` scene flag (`engine/stages/visuals.py`) | One world module renders every beat at global time, so the camera never cuts in space or time. Fingerprints include the timeline. |
| `editorial_rules` (`engine/editorial_rules.py`) and the `voices` overlay field | Enforces phrase-once (a title that restates narration must declare the phrase, and the burned-in captions then hide exactly those words), one hero per beat, and no two titles at once. Checked by the captions stage and by `python -m engine beats`. |
| Beat table generator (`python -m engine beats`) | Times come from the measured timeline, never typed by hand. |
| Animatic (`python -m engine animatic`) | Low-res, low-fps preview with narration, captions and watermark, plus a contact sheet. Writes only under `work/animatic/`. |
| `narration.pronunciations` (Kokoro) | Per-word IPA overrides. |
| Aligner | Hyphenated compounds heard as separate words now align ("near-freezing", "pitch-dark"). |
| `engine/three/lib/ocean.js` (new file) | Size-aware renderer, depth-graded water, sea surface, particles, bathymetric contour material, light cones, sediment texture. Existing libraries are untouched, so existing scene fingerprints are unchanged. |
| Captions | `size` on big titles. QC now checks the captions that are actually burned in. Output for projects without `voices`/`size` is byte-identical to the base commit (tested). |

## Render plan and expected cost (not executed)

- Settings: 1080×1920, 24 fps, H.264 High; master CRF 18, delivery CRF 23; −14 LUFS; QC thresholds unchanged.
- Dependencies: node + three.js r170 (pinned), Chromium SwiftShader (software WebGL), FFmpeg, Python engine. No new paid or cloud dependency. New Python/npm packages: **none**.
- Determinism: scene code uses no `Math.random`. Particles, swarm and fish are seeded or driven by the clock, and the narration is deterministic.
- Measured (this container, 4 vCPU, no GPU):
  - Animatic: 477 frames at 270×480 in **59.7 s** of rendering (~0.13 s/frame), plus mux and contact sheet ≈ 63 s total.
  - Full-resolution stills: **~0.3–0.6 s/frame** at 1080×1920 (1.0–1.8 s per 3 frames after scene setup).
  - Peak memory of the largest child process: 174 MB.
- **Expected final render:** ~1,370 world frames + end card ≈ 7–14 min of frame rendering, plus ~1–2 min of setup per beat, assembly and QC. **Roughly 15–25 min** on this machine with `--jobs 2`. Cost 0.
  - Caveat: the full render will need more geometry and lighting detail to reach the "realistic-looking" brief (see the asset board), which will raise per-frame cost, plausibly 2–5×.

## Changes from the draft plan in the issue (need approval)

1. **b8 camera**: after touchdown the camera slowly pulls back and rises, so the lander's pool of light becomes a small island in the dark. The draft said "barely perceptible forward drift"; a forward drift looked into unlit black.
2. **b7 title**: "8,336 m · Izu-Ogasawara Trench" replaces the spoken "eight thousand three hundred thirty-six metres, in another Pacific trench" in the captions (phrase-once). The title names that other trench.
3. **b5 title**: "> 1,000× / sea-level pressure" replaces "under pressure more than a thousand times the air at sea level".
4. **b2 title**: "≈ 11 KM DOWN" (the ≈ keeps the spoken "nearly").
5. **Duration**: 59.5 s instead of ~45 s, because the approved script reads longer at natural pace.

## Outstanding decisions for the owner

1. Approve the **voiceover recording** (bm_george, "hadal" pronunciation), or ask for a different local voice or speed.
2. Approve the **final timings and beat table** (`BEAT_TABLE.md`), including changes 1–5 above.
3. Approve the **references and assets** (`ASSET_BOARD.md`). The credit line for ref_03 is still to be confirmed.
4. **Wording risk** in b8, "At the bottom, our maps are still incomplete": true for the seafloor in general, but Challenger Deep itself has high-resolution multibeam maps. Keep, or reword (the script is content-locked, so this is your call).
5. **Visual realism**: the animatic shows the direction and choreography but is stylised. Decide whether the full render should push realism further (sea surface, lander detail, amphipod legs and antennae, snailfish skin, cyan backscatter), at a higher render cost, before final rendering.
6. Depicting the record fish inside a Mariana-world shot: the title names the Izu-Ogasawara Trench, and the fish stays ~2.6 km above the floor. Acceptable, or should the fish appear in a visually separated inset?
