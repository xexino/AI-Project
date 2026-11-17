# LOOK_V1: "stills-2.5D v1" (as used in 006-deep-coral)

Reuse: a scene module `import { buildStill } from 'oddlight/stills.js'` with the params below. The grade defaults live in `LOOK_V1` in `engine/three/lib/stills.js`; override per production with `params.look`.

## Source images
- Public-domain NOAA photographs (Wikimedia Commons, Lophelia II 2009), 1920×1280 (Wikimedia standard thumbnail; originals rate-limited) → short edge 1280, below the 1536 target.
- Depth: Depth-Anything-V2-Small (Apache-2.0), CPU, about 1.3 s per image after load; 16-bit PNG, near = white. Cached as `<stem>.depth-<sha256[:12]>.png` (`tools/stills/depth.py`); a changed image gets a new key.

## Geometry and camera
| Setting | Value |
|---|---|
| Plane | 320 × (320/aspect) segments, 1 unit tall, displaced along +z by depth × `relief` (0.10) |
| Overscan | 1.12; UVs outside [0,1] mirror (edge stretch); camera margin from `dist` = 0.92 × the frame-filling distance |
| Lens | perspective, vertical FOV 40°, 9:16 slice of a landscape still, `crop_x` 0.36–0.66 (subject off centre) |
| Moves | `push` (2.2–3 % closer over the shot), `drift` (lateral, ±dir), `arc` (lateral + yaw), `locked`. Cubic ease in/out. 4 of 12 shots locked |
| Handheld | band-limited value noise (octaves at ~0.15, 0.4, 0.8 Hz): 0.4 px x, 0.35 px y, ≤0.05° roll; off on locked shots |
| Gate weave | 0.15 px, the same noise at 6× time scale (~1–5 Hz), every shot |
| Motion blur | 2 subframes, 1/96 s apart (≈ 1/48 s shutter at 24 fps), averaged |
| Depth of field | from the rendered depth pass; circle of confusion = clamp(\|d − focus\| × 3) × 9 px; 12 taps on two rings → hexagonal-ish bokeh. One rack focus (s06, 0.35 → 0.70 at 4.0 s, 0.9 s cubic) |

## Grade (one pass, every shot)
1. Linear: DOF → chromatic aberration (0.6 px at the corners, R/B offset) → halation (8 taps at 1.5 px, highlights above 0.7, tint (1.0, 0.35, 0.25), 6 %) → ACES-fit filmic tone curve (long shoulder) → vignette 8 %.
2. Display-referred (after the 1/2.2 encode):
   - split tone: shadows (−1.2 %, +0.8 %, +1.0 %), highlights (+2.0 %, +0.8 %, −2.0 %);
   - black lift 2 % (out = 0.02 + in × 0.98; never 0,0,0);
   - luma grain ±1.8 %, regenerated every frame (hash of pixel and frame), midtones about 1.2× the highlights.
3. Geometry: barrel 0.5 % (r²-weighted), gate-weave offset.
4. Engine grade on top: grain 0, vignette `PI/12`, contrast 1.0, saturation 1.0 (the stills pass carries the look).

## Edit
- 12 shots, 6.0–13.4 s (mean 9.8 s); no two equal in a row; move direction never repeated back to back.
- One-frame crossfades between shots (avoids the consecutive-cut bug); end card 2.4 s.

## Sound
- **Narration:** Kokoro `bm_george`, en-gb, speed 0.96; one voice. 276 words, 97.7 s of speech in 119.5 s (18 % silence).
- **Bed:** `drone_bed` at level 0.55, continuous.
- **Per-shot ambience** (starts 0.25 s before the cut, 0.5 s fade in and out, so about 0.5 s crossfades):
  - in-situ shots: brown-noise rumble (`fireball_roar` preset, vol 0.16);
  - deck and lab shots: band-passed pink room tone (`whoosh`, vol 0.09).
- **Score:** synthesized low drone chords (master −26 dB).
  - Silent 0–16.5 s.
  - Level 0.32 from 16.5 s.
  - Out completely from shot 7 (~53 s).
  - Back at duration − 25 s, level 0.40, with a 2.5 s end fade.
  - No hits.
- **Ducking:** the engine's sidechain compressor (threshold 0.06, ratio 4). This approximates, but is not tuned to, the requested −9 dB.
- **Master:** two-pass loudnorm to −14 LUFS, TP target −1.5 dBTP.

## Captions and titles
- `captions.style = "plain"`: one quiet line per 3-word chunk, 120 ms fades, no word highlight; 48 px (2.5 % of 1920) with 420 px bottom margin.
- 2 titles:
  - an expedition label (not spoken);
  - "2,000 years", which replaces the spoken "at least two thousand years" (phrase-once rule).
