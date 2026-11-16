# Installing the ODDLIGHT production engine

Everything runs locally and costs nothing. No API key is required for the default (zero-cost) route.

## 1. System dependencies

| Dependency | Version tested | Mandatory? | Install |
|---|---|---|---|
| Python | 3.12 / 3.13 | yes | python.org or your package manager |
| FFmpeg + ffprobe (with libass, libx264) | 6.1 | yes | `sudo apt-get install ffmpeg` · `brew install ffmpeg` |
| Node.js | 18+ (tested 22.23) | for the 3D renderer | nodejs.org |
| Chromium for Playwright | Playwright 1.63 | for the 3D renderer | `cd engine/three && npx playwright install chromium` |

## 2. Python packages (pinned)

```bash
python -m venv .venv
```

```bash
.venv/bin/pip install -r requirements.txt
```

- `requirements-core.txt`: mandatory (numpy, soundfile). Enough for assembly, captions, music synthesis, QC, packaging and the test suite with mock providers.
- `requirements.txt`: full production stack. Adds Kokoro TTS (kokoro-onnx), faster-whisper word timing, and fonttools.
- `requirements-dev.txt`: core plus pytest (used by CI).

## 3. Node packages for the 3D renderer (pinned in `engine/three/package-lock.json`)

```bash
cd engine/three && npm ci
```

## 4. Models (not in git)

Kokoro-82M (Apache-2.0) ONNX export, about 350 MB, goes into `models/`:

```bash
mkdir -p models && cd models
```

```bash
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
```

```bash
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

faster-whisper downloads `base.en` (MIT, about 150 MB) automatically on first use.

## 5. Assets

The brand fonts are in git (`engine/three/fonts`, OFL; licence texts in `assets/fonts`). Customer brand assets go in `customers/<id>/assets/`.

## 6. Check the installation

```bash
.venv/bin/python -m engine doctor
```

## 7. Produce a video (one command; resumable)

```bash
.venv/bin/python -m engine produce --project productions/002-tunguska
```

If it stops (crash, Ctrl-C, reboot), run the same command again. Finished stages and finished frames are skipped, and a partially rendered scene resumes from its first missing frame. Useful options:

- `--until <stage>`: stop after a stage (research, factcheck, script, storyboard, narration, timing, visuals, music, captions, assemble, cover, qc, package).
- `--force <stage>`: rerun a stage even if it is cached.
- `--jobs N`: render N scenes in parallel. Default 2; use 1 on a CPU-only machine, where software WebGL already uses every core.
- `--renderer mock --tts mock --aligner mock`: run the whole pipeline without models or a browser (tests/CI).

The outputs:

- `productions/<id>/work/`: intermediate outputs and `state.sqlite`.
- `productions/<id>/delivery/`: the delivery package.
- `productions/<id>/work/production_report.json`: the machine-readable report.

## 8. Other commands

```bash
.venv/bin/python -m engine status --project productions/002-tunguska
```

```bash
.venv/bin/python -m engine queue add --project productions/001-greenland-shark
```

```bash
.venv/bin/python -m engine queue run
```

```bash
.venv/bin/python -m engine dashboard
```

## 9. Tests

```bash
.venv/bin/python -m pytest -q tests
```

The tests need FFmpeg and requirements-dev only: no models, no browser, no network.

## Configuration

See `.env.example`. Never put credentials in `project.json` or `customer.json`; the engine refuses credential-like fields there. Paid providers are not wired in. Each project has `budget.max_paid_eur` (default 0), and any paid provider is refused while it is 0.
