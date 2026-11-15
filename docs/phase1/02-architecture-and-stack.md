# 02 — Recommended Architecture & Video Generation Stack

## Principle

Build a **lean Python orchestrator we own**, and plug best-in-class components into stable interfaces. We do not adopt any single "do-everything" repo: none of them meets our quality, licensing and approval requirements as-is (see 01).

## Pipeline

```
 IDEA ─► RESEARCH ─► STORY ─► HOOKS ─► SCRIPT ─► SCENES ─► KEYFRAMES ─► MOTION ─► VO ─► SOUND ─► EDIT ─► SUBS ─► QC ─► FORMAT ─► APPROVAL ─► PUBLISH ─► ANALYTICS ─► LEARN
  └────────── content engine (LLM) ─────────┘  └──── generation (hosted APIs) ───┘  └────── post-production (local) ──────┘  └ human ┘  └── distribution & learning ──┘
```

## Components

| Layer | Choice | Why | Swappable via |
|---|---|---|---|
| Orchestration | **Python 3.12**, typer CLI, pydantic models | Simple, testable, resumable | — |
| Project store | Folder per video + `project.json` + SQLite index | Local-first, git-friendly, easy to inspect and resume | — |
| State machine | `IDEA → … → ANALYZED` (the 11 statuses from your brief) | Each transition checks that the required artifacts exist | — |
| Locking | SHA-256 of approved script/final video stored on approval; writes to locked files are refused, and a new version folder is created instead | "Never silently overwrite approved work" | — |
| LLM | Claude API (research, hooks, scripts, scene breakdown, QA critique) | Best editorial quality; pay-per-use | `LLMProvider` |
| Fact layer | Every factual claim in a script links to a source; unsourced claims block the move to SCRIPT | Your "never fabricate" rule, enforced in code | — |
| Keyframes | **FLUX.2 [pro]** on fal (≈$0.045 per 9:16 frame). FLUX schnell for drafts | Image-first gives control over composition, palette, continuity | `ImageProvider` |
| Image → video | **Default: Wan 2.2 A14B I2V** (fal). **Hero shots: Kling 2.5 Turbo Pro**. **Premium option: Veo 3.1 Fast** | Cost/quality ladder; per-scene choice | `VideoProvider` |
| Motion prompts | Our structured motion library + **adapter for your motion-prompt website** (once I see it) | Every scene has an explicit visual + motion objective | `MotionPromptSource` |
| Narration | **ElevenLabs** (licensed, consistent designed voice, paid tier). **Kokoro-82M** (Apache-2.0) as free fallback | Quality vs. €0 | `TTSProvider` |
| Word timing | faster-whisper forced-timestamps on our own VO | Word-accurate captions and cut points | — |
| Music | Licensed library (see budget) or original tracks from ACE-Step (Apache-2.0) | No copyright claims | `MusicProvider` |
| SFX | Freesound **CC0 only**, plus self-generated | Clean licensing, logged per asset | — |
| Edit / grade / mix | **FFmpeg**: xfade transitions, LUT grade, grain, sidechain ducking, EBU R128 loudness (−14 LUFS) | Deterministic, free, scriptable | — |
| Motion graphics / captions | **Remotion** (free ≤3 employees), reusing caption + safe-zone ideas from social-video-agent (Apache-2.0, with NOTICE) | Brand-consistent animated captions and title cards | — |
| Upscale / interpolation | Optional ComfyUI pass (Vidia `Upscaler`, `post` workflows) on a rented GPU | Only when a shot needs it; always labelled "upscaled" in metadata | — |
| QC | ffprobe checks (1080×1920, fps, codec, duration, audio present, loudness, no black/frozen frames), caption-safe-zone check, sync drift check, LLM visual critique of sampled frames | Catch corrupted or incomplete files before you see them | — |
| Distribution | Per-platform export packets (video + caption + title + tags + cover). **Manual upload for the pilot.** Postiz self-hosted later | No unsafe automation; official APIs only | `Publisher` |
| Analytics | Metrics table with a `source` field (`api` / `manual_export`); never-fabricate rule; Social-Post-style comparables and candidate→approve learning | Honest learning loop | — |
| Dashboard | Local web UI (Phase 8+), dark editorial design | After the pipeline works | — |
| Ledger | `costs.jsonl` + `failures.jsonl`, per call | Budget control | — |

## Provider interface sketch

```python
class VideoProvider(Protocol):
    name: str
    def estimate_cost(self, req: ShotRequest) -> Money: ...
    def generate(self, req: ShotRequest) -> GeneratedClip: ...   # returns path, seed, cost, raw response

class ShotRequest(BaseModel):
    keyframe: Path              # first frame (image-to-video)
    end_frame: Path | None      # optional last frame for continuity
    motion: MotionPrompt        # structured, see 06
    duration_s: float
    aspect: Literal["9:16"]
    resolution: Literal["480p", "720p", "1080p"]
```

A `--dry-run` flag prints the estimated cost of the whole job **before** any paid call. Paid calls also require an explicit `--spend-cap` value.

## What runs where

- **This cloud container:** orchestration, LLM calls, FFmpeg, Remotion, QC. There is no GPU, so generation goes to hosted APIs.
- **Hosted APIs:** fal (Wan, Kling, Veo, FLUX), ElevenLabs.
- **Optional rented GPU (RunPod):** only for ComfyUI upscaling/interpolation or bulk Wan runs, if they prove cheaper.
- **Secrets:** stored as environment network secrets or a local `.env` (git-ignored). They are never committed and never shown in logs.

## Honesty rules built into the stack

- A clip generated at 720p and upscaled is tagged `native_res: 720p, delivered: 1080p (upscaled)`. Nothing is called 4K unless it was generated at 4K.
- Every video carries an `ai_generated: true` disclosure flag, which maps to the TikTok AIGC label and YouTube's `containsSyntheticMedia`.
- Publishing status becomes `PUBLISHED` only after we have a platform post ID or URL confirmed by the platform.
