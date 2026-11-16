# Production pipeline (v0.2 — generalized engine)

The v1 scripts (`engine/assemble.py`, `engine/qc.py`, `engine/cover.sh`, `engine/render_all.sh`, `build_vo.py`) were replaced by the `engine` Python package. Their logic now lives in engine stages. The v1 Greenland shark outputs are preserved read-only in `productions/001-greenland-shark/baseline/` (git-ignored, with `SHA256SUMS`). A regression test (`tests/test_regression_v1.py`) proves the generalized engine reproduces the v1 caption file and FFmpeg filter graph exactly.

```bash
python -m engine produce --project productions/<id>
```

## Stages (each resumable, fingerprinted, logged)

| # | Stage | Status set | What it does | Provider interface |
|---|---|---|---|---|
| 1 | research | RESEARCHING | validates the sources in project.json, writes sources.json | LLM (`manual` default; `ollama` optional, local) |
| 2 | factcheck | | every narrated scene → claims → sources; unresolved claims are reported and block commercial delivery | |
| 3 | script | SCRIPT_READY | script.md with claim references | LLM |
| 4 | storyboard | | storyboard.md (visual goal, module, transition per scene) | |
| 5 | narration | PRODUCING | TTS per scene, trimmed WAVs | TTS (`kokoro`, `mock`) |
| 6 | timing | | word alignment to the exact script; scene timeline (frame-aligned) | aligner (`whisper`, `proportional`, `mock`) |
| 7 | visuals | RENDERING | renders each scene to PNG frames; per-scene fingerprints; resumes partial scenes | renderer (`threejs`, `mock`); image/video (`none` by default) |
| 8 | music | | synthesized score from the project's chord plan (optional) | synth |
| 9 | captions | | word-highlight ASS + SRT + VTT; overlays (label, counter, big, bigsub) | |
| 10 | assemble | | xfade transitions, grade (+bloom), burned captions, narration + SFX + bed + pad + score, −14 LUFS; master + delivery encode | |
| 11 | cover | | cover.png/jpg from a rendered frame + brand typography | |
| 12 | qc | QC_PENDING → QC_PASSED | technical checks (enforced) + editorial record | |
| 13 | package | DELIVERY_READY | delivery folder + manifest with SHA-256; blocks commercial delivery on licensing/claims gaps | |

`DELIVERED` is set only by `python -m engine deliver --project … --confirm "<name>"`. Nothing is uploaded; publishing stays manual.

## Resumability and staleness

- **Stage fingerprint** = the stage's implementation code hash, the configuration it reads, and the upstream fingerprints. Changing a caption overlay re-runs captions → assemble → QC → package, but not narration or rendering.
- **Scene fingerprint** = scene module, project scene libraries, engine 3D libraries, duration, format and params. Frames are written as `.tmp` and then renamed, so a crash never leaves a truncated frame counted as done.
- Outputs are verified (exist, non-empty, hash recorded) before a stage is marked complete. A missing or modified output makes the stage stale.
- Failures are recorded in `state.sqlite` (failures table, structured log `work/logs/production.jsonl`). The visuals stage retries once automatically.

## Creating a new documentary

1. Create `productions/<id>/project.json`, using `productions/002-tunguska/project.json` as the template. Fill in the scenes with narration text, claims, a scene module, transitions and visual goals; then add sources, claims, overlays, sound cues, music sections, cover and publishing metadata.
2. Write scene modules in `productions/<id>/scenes/*.js`. Each one exports `build({dur, params}) → {renderer, render(t)}` and uses the reusable kits in `engine/three/lib/` (`core.js`: underwater/light/particles; `nature.js`: terrain, sky, IBL, instanced forests, particles). Scenes that set `"uses_words": true` receive their narration word timings.
3. Create `productions/<id>/assets.json`, the licensing register.
4. Run `python -m engine produce --project productions/<id>`.

No engine code changes are needed per topic.
