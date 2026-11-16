# Visual comparison: 001 Greenland shark (v1 benchmark) vs 002 Tunguska (v0.2 engine)

**Status: HUMAN REVIEW PENDING.** This is the production agent's assessment, not an approval. Please watch both videos in full.

## What is in this folder

| Item | File |
|---|---|
| Original video (unchanged v1 baseline, SHA-256 `a406be6a…`) | `videos/original_greenland_shark_v1.mp4` (git-ignored). Canonical copy: `productions/001-greenland-shark/baseline/` |
| New documentary | `videos/new_tunguska.mp4` (git-ignored). Canonical copy: `productions/002-tunguska/delivery/final_video.mp4` |
| Covers | `covers/original_shark_cover.jpg`, `covers/new_tunguska_cover.png`, `covers/covers_side_by_side.jpg`, plus 180 px thumbnails |
| Contact sheets (12 frames each, at the centre of 12 equal slices of the **full** runtime; not hand-picked) | `contact_sheet_original_shark_v1.jpg`, `contact_sheet_new_tunguska.jpg` |
| Side-by-side pairs at matching relative positions | `side_by_side/pair_00.jpg … pair_11.jpg` |
| QC reports | `qc/original_shark_v1_qc.json` (11 checks), `qc/new_tunguska_qc.json` (24 checks), `qc/shark_rebuilt_v0.2_qc.json` |

## Technical facts (measured)

| | Original (shark v1) | New (Tunguska) |
|---|---|---|
| Runtime | 53.7 s | 59.3 s |
| Resolution / fps | 1080×1920 / 24, native | 1080×1920 / 24, native (not upscaled) |
| Loudness / true peak | −14.3 LUFS / −1.4 dBTP | −14.3 LUFS / −1.3 dBTP |
| QC | 11/11 (v1 checks) | 24/24 (extended checks) |
| Scenes | 9 + end card | 10 + end card |
| Render time (CPU only, software WebGL) | 403 s | 5,826 s (about 14× the shark) |
| Paid spend | €0 | €0 |
| Music | sine pad (5 s, under the payoff only) | synthesized 7-section score with chord changes, impact hits and reverb |

## Category assessment (agent's view)

| Category | Verdict | Evidence |
|---|---|---|
| Environments & lighting | **Better** | Physically based sky with sky-derived ambient light, real cast shadows (sun, fireball), aerial haze, a river reflecting the fireball, low-sun shafts with long shadows (S7). The shark is mostly a dark void with one light shaft. |
| Visual detail / scale | **Better** | Tens of thousands of instanced trees, terrain, fallen-trunk fields, a homestead, a camp. The radial fall pattern (S6) carries real information. |
| Composition & cinematography | **Better** | Aerial glide, river-level, homestead dolly, high orbit, a crane rise from the camp lantern to a top-down view, a ground-level dolly through standing trunks, a crane down to the bog, and a high-altitude view descending through clouds. The shark used mostly slow push/track moves. |
| Animation & movement | **Better** | The fireball moves the light and its shadows across the scene; the shockwave fells the forest radially; the seasons pass; the airburst lands on the narrated word "exploded". |
| Visual storytelling | **Better** | Every shot illustrates its line, including date, place, area, years, the Kulik expedition, the standing trunks, no crater, altitude, and today. Overlays carry the numbers. |
| Scene variety | **Better** | 10 distinct settings against the shark's 5 visually similar underwater shots, a lab, a lens and a split shot. |
| Subjects (realism of the main subject) | **Comparable / mixed** | The shark film's subject is a single animal, and it stays stylized and plastic up close. Tunguska avoids close organic subjects. Its trees, cabin and logs are clean but still clearly low-poly. Neither is photoreal. |
| Captions & typography | **Comparable** | Same brand caption system (word highlight, safe zone). Tunguska adds date, area and expedition overlays. Word timing is now aligned for numbers and contractions in both films. |
| Sound & editing | **Better (measured), not listened** | Score with an emotional arc, fireball roar, shockwave, wind and impacts synced to the narration. Two-pass loudness. The agent cannot listen to audio; this verdict comes from the spectrogram and loudness measurement only. **Please listen.** |
| Cover | **Better (graphic impact), please judge** | The radial fall pattern with a soft scrim reads at 180 px. The shark cover is also clean. |

**Overall (agent):** the improvement is demonstrated in environments, lighting, composition, camera, scene variety, motion and storytelling. It is **not** demonstrated in subject realism. It is **uncertain** for audio, because the agent can't hear it. Final acceptance is the human reviewer's.

## Remaining visual weaknesses (Tunguska)

1. **Stylized, low-poly assets.** Trees are stacked cones, the cabin is simple, and the fallen trunks read as planks. The film does not look photoreal or like Fern-level hand-modelled 3D.
2. **Hook horizon.** In S1 there is a hard flat band where the distant forest meets the sky, plus a small dark bump at the horizon centre.
3. **S5 (winters).** The fallen trunks are dark, uniform sticks; the snow accumulation is subtle.
4. **S8 (bog)** is flat and hazy; it is the weakest composition.
5. **S9 cloud deck.** The clouds are soft sprites that read as fog, not volumetric cloud.
6. **S10.** For about 1 s the far ground turns into a flat beige band as the fog thickens before the dissolve to ink.
7. **No people or characters.** Eyewitness and expedition beats are told through places and objects.
8. **Runtime 59.3 s,** longer than the brand's 45 s ideal; still inside the project's 40–62 s target.
9. **Render cost.** About 1.6 CPU-hours per finished minute on this 4-core machine. Iterating on a look is slow.
10. **Narration.** The same stock Kokoro voice (bm_george) is used, with no performance direction beyond punctuation.
