# 006-deep-coral: delivery review

Final: `delivery/final_video.mp4` (copied as `delivery/oddlight_006_deep_coral.mp4`, git-ignored), 1080×1920, 24 fps, 119.54 s, 2,869 frames, 35.4 MB.

- **QC:** 25/25 technical checks. −14.1 LUFS, true peak −2.0 dBTP (limit −1.5); video stream covers the timeline; no black or frozen segments.
- **Editorial:** 7 claims, all cited; phrase-once rule enforced.
- **Images:** all 12 are public-domain NOAA photographs, with no AI imagery, so no AI disclosure tag is needed.

## Fallback ladder
- **Rung "stills at 1024 px" (partially):** Wikimedia rate-limited originals, so images are 1920×1280 standard thumbnails (short edge 1280, not ≥1536).
- **Rung "CC0 photos only, no aigen":** used.
- Kept 12 shots and 2 subframes.

## Anti-tell checklist (self-review)
| Tell | Result |
|---|---|
| Every shot moving | ✅ 4 of 12 shots locked off (s01, s03, s07, s11) |
| Identical move directions back to back | ✅ none (drift+ → locked → push → arc− → drift− → locked → push → arc+ → push → locked → drift+) |
| Subject dead-centre every shot | ✅ framing offsets `crop_x` 0.36–0.66; per-shot subject position not measured |
| Pure black frames | ✅ none (QC). ⚠ Isolated pixels reach luma 6–7 (below video black 16) in every frame: the renderer's floor is about 11/255, but encoding around grain undershoots it. The 10th-percentile luma is ≥19. Not strictly "never 0,0,0" |
| Music starting at 0:00 | ✅ score enters at 16.5 s, out from ~53 s, back for the last 25 s |
| A caption on every line | ⚠ yes: every spoken line is captioned (the spec asks for burned captions), except the phrase replaced by the "2,000 years" title |
| Same shot length repeated | ✅ 6.0–13.4 s, no two equal in a row |
| Visible inpainting smear | not seen on the contact sheet; mirrored overscan plus ≤3 % moves. Not checked frame by frame |

## What still reads as fake (most fixable first)
1. **Caption legibility:** 48 px white text with no box disappears on the pale specimen shots (s02, s06, s12). Fix: a subtle shadow or 20 % box. Minutes.
2. **Below-black specks:** add an opt-in luma floor (e.g. Y ≥ 18) to the delivery encode. Minutes plus one re-assembly (~20 min).
3. **Softness:** 1280 px sources enlarged ~1.5× into a 9:16 slice look slightly soft next to native footage. Fix: fetch originals (3888×2592) once the Wikimedia rate limit clears; no other change needed. About 30 min including re-render.
4. **Shoot order reads as "lab photos":** many stills are shipboard specimen shots in dishes. That is honest, but a real crew would intercut seafloor video. Fix: add more public-domain ROV frames of the reef in place (NOAA Ocean Exploration). Sourcing time.
5. **Parallax is shallow on flat lab photos:** dishes and tabletops have little depth, so moves read close to 2D there. Fix: favour lateral drift less and locked-off framing more on flat images, and use relief 0.06 for flat subjects. Easy.
6. **Ambience is synthetic:** filtered-noise rumble and room tone, not recorded location sound. Fix: CC0 field recordings (freesound CC0 subset), which needs licence checks per file. Moderate.
7. **Ducking is not calibrated to −9 dB:** the engine's sidechain compressor is generic. Fix: an explicit duck-depth parameter. Moderate.

## Process notes (what went wrong)
- **Disk allowance ran out mid-render.** Frames are about 4.2 MB each because of the grain. Frames written while the disk was full came out **blank (48 KB) but valid**. QC caught them as black/frozen segments; they were deleted and re-rendered. Lesson: the visuals stage should reject implausibly small frames.
- **Container restart mid-repair:** resumable rendering continued from the last good frame of each shot.
- **Phrase-once caught a real duplicate:** the expedition label repeated the spoken year.
