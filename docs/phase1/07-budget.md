# 07 — Budget (total < €500)

**Read this first:** every figure is an **estimate** built from a public pricing snapshot taken 2026-11-15 (sources in 01). None has been verified by an actual purchase. FX assumption: **$1 ≈ €0.87** (verify on the day). Nothing will be bought without your explicit approval.

## Unit assumptions per finished video
- About 40 s, 9 scenes, mostly 5 s clips
- 4 keyframe candidates per scene (36 images)
- On average 2 video takes per scene (18 clips), 3 takes for hero shots
- VO with about 3 retakes ≈ 1,800 characters
- LLM usage (research, hooks, scripts, critique) ≈ $0.30–1.00

## Scenario A — Almost entirely free

| Item | Choice | Est. cost |
|---|---|---|
| Keyframes | FLUX.1 schnell drafts + FLUX.1 dev finals | ~$0.70 / video |
| Video | Wan 2.2 A14B **Turbo** 720p (fal), 18 clips × $0.10 | ~$1.80 / video |
| VO | Kokoro-82M local (Apache-2.0) | €0 |
| Music / SFX | Original ambient via ACE-Step (Apache-2.0) or CC0 only | €0 |
| LLM | Claude API | ~$0.30 / video |
| Edit / captions | FFmpeg + Remotion (free ≤3 people) | €0 |
| **Cost per scene** | | **≈ €0.25** |
| **Cost per video** | | **≈ €2.50** |
| **10 videos** | | **≈ €25** |
| Setup | — | €0 |
| Monthly fixed | — | €0 |

*Trade-off:* 720p native (upscaled), a less natural voice, more visible AI artifacts.

## Scenario B — Balanced ★ Recommended for the pilot

| Item | Choice | Est. cost |
|---|---|---|
| Keyframes | FLUX.2 [pro] 9:16, 36 × ~$0.045 | ~$1.60 / video |
| Video | Wan 2.2 A14B 720p for 12 clips (~$0.40) + Kling 2.5 Turbo Pro for 6 hero clips (~$0.35) | ~$6.90 / video |
| VO | ElevenLabs **Starter** ($6/mo, commercial rights) — designed original voice | subscription |
| Music | CC0/original by default. Optional licensed library (~€10–17/mo, verify) | €0–17 / mo |
| LLM | Claude API | ~$0.50 / video |
| Upscale | FFmpeg Lanczos + sharpen (free), labelled upscaled | €0 |
| **Cost per scene** | | **≈ €0.85** |
| **Cost per video** | | **≈ €7.80** |
| **10 videos** | | **≈ €80** |
| Setup | fal pre-paid credit, suggested €20 cap (counts toward usage above) | €0 extra |
| Monthly fixed | ElevenLabs Starter + optional music | **≈ €5–20** |
| **Pilot total (10 videos + 1 month)** | | **≈ €85–100** + €50 retake contingency |

## Scenario C — Premium pilot within €500

| Item | Choice | Est. cost |
|---|---|---|
| Keyframes | FLUX.2 [pro]/[max], 6 candidates per scene | ~$3 / video |
| Video | Veo 3.1 Fast 1080p no audio (~$0.50 per 5 s; Google direct ~$0.60) or Kling 2.5 at 1080p, **3 takes per scene** (27 clips) + 2–3 Seedance hero shots | ~$16–18 / video |
| VO | ElevenLabs **Creator** ($22/mo) — higher-quality model + more credits | subscription |
| Music | Licensed library subscription (~€10–17/mo, verify) | subscription |
| Finishing | RunPod GPU for RIFE interpolation / upscaler on a few shots (~1 h at ~$0.79) | ~$1 / video |
| LLM | Claude API, extra critique passes | ~$1 / video |
| **Cost per scene** | | **≈ €2.10** |
| **Cost per video** | | **≈ €19** |
| **10 videos** | | **≈ €190** |
| Monthly fixed | ElevenLabs Creator + music | **≈ €30–35** |
| **Pilot total** | | **≈ €225** + €75 contingency ≈ **€300** (leaves ~€200 reserve) |

## Recommendation
Start with **Scenario B**. Make the pilot video first (expected €8–15 including retakes), review it with you, and upgrade only the shot types that visibly fail (for example, use Kling/Veo for S7). Keep €200+ unspent as a reserve until real analytics justify scaling.

## Approvals I will ask for before any spend
1. A fal.ai account + pre-paid credit (suggest €20 initial cap)
2. An ElevenLabs Starter subscription ($6/mo) — or skip it and use Kokoro for the pilot
3. An Anthropic API key (if this session's model access doesn't cover the pipeline's own calls)
4. (Optional) a music library subscription

A hard spend cap is enforced by the pipeline (`--spend-cap`), and every call is written to `costs.jsonl`.
