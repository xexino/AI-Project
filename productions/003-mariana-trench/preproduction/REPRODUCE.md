# Reproducing 003-mariana-trench

Everything runs locally, at zero cost, on CPU. No paid API, cloud renderer or AI image/video generator is involved.

## Requirements

- Python 3.13 with `requirements.txt` installed in `.venv` (numpy, soundfile, kokoro-onnx, faster-whisper).
- The Kokoro model files in `models/` (`kokoro-v1.0.onnx`, `voices-v1.0.bin`; see `docs/INSTALL.md`).
- Node ≥ 18 with `engine/three/node_modules` (`npm ci` in `engine/three`; three.js r170 and Playwright Chromium).
- FFmpeg/FFprobe on PATH.
- Optional: the full reference images in `references/images/` (git-ignored). Without them the references stage only warns, because the images are optional guidance and never part of the video.

## Commands

```bash
python -m engine validate --project productions/003-mariana-trench
```

```bash
python -m engine produce --project productions/003-mariana-trench --until timing
```

```bash
python -m engine beats --project productions/003-mariana-trench
```

```bash
python -m engine animatic --project productions/003-mariana-trench --scale 0.25 --fps 8
```

```bash
python -m engine produce --project productions/003-mariana-trench --jobs 2
```

Produce is resumable. Every stage and every scene is fingerprinted, so an interrupted run continues where it stopped, and an unchanged scene is never re-rendered.

## Determinism

- The narration is deterministic: regenerating it gave an identical file.
- The scene code uses no `Math.random`; particles, the amphipod swarm and the fish are seeded or clock-driven, and every event is keyed to measured word timings.
- The sound design noise is seeded (`sound.seed`).
