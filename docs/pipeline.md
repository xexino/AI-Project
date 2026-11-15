# Production pipeline (v0, zero-cost route)

```bash
# 1. narration + word timing + timeline (Kokoro bm_george, faster-whisper alignment to the exact script)
.venv/bin/python -I productions/001-greenland-shark/build_vo.py productions/001-greenland-shark
# 2. render all scenes (three.js, headless Chromium, CPU) from timeline clip lengths
engine/render_all.sh productions/001-greenland-shark
# 3. transitions, grade, captions/overlays (ASS), synthesized sound design, -14 LUFS master
python3 engine/assemble.py productions/001-greenland-shark
# 4. technical QC (resolution, fps, codec, decode, loudness, true peak, black/freeze, caption coverage)
python3 engine/qc.py productions/001-greenland-shark/output/<file>.mp4 productions/001-greenland-shark/build/timeline.json
# 5. cover
engine/cover.sh productions/001-greenland-shark s1 110 "Older than the" "United States."
```

Requirements: python venv with `kokoro-onnx soundfile faster-whisper "av<19" fonttools`; Kokoro model files in `models/` (from the kokoro-onnx GitHub release `model-files-v1.0`); Node 22 + `npm install` in `engine/three`; FFmpeg ≥ 6; Playwright Chromium.

Timing (4 CPU cores, no GPU): VO ~1 min · scene render ~9 min · assembly ~5 min · QC ~2 min.

Licensing: three.js (MIT); fonts Inter + Fraunces (OFL, renamed internally as OL Caption / OL Display); Kokoro-82M (Apache-2.0); all music and sound effects are synthesized in `assemble.py`. No third-party footage, music or models.
