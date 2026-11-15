# 01 — Repository Research Report

Audit date: 2026-11-15. Method: shallow read-only clone of each repo into a scratch directory, inspection of source, license, commit history and dependency manifests. **Nothing was installed or executed.** Pricing figures come from a web snapshot on the same date and are marked as such.

## Summary verdict

| # | Project | License | Last commit | Verdict |
|---|---|---|---|---|
| 1 | OpenX Flow | MIT | 2026-07-23 | **Reference only.** Good architecture ideas (orchestrator ↔ GPU backend split, last-frame chaining). Code is not production-ready. |
| 2 | ComfyUI VidFlows | none stated | 2025-10-02 | **Reject.** No license, 2 commits, needs 96 GB VRAM, built for talking characters/lip-sync. |
| 3 | Vidia Open Workflows | FSL-1.1 → Apache-2.0 | 2026-08-09 | **Keep in reserve.** Useful ComfyUI post workflows (upscale, interpolation, deflicker). Internal use is permitted. |
| 4 | Social Video Agent | Apache-2.0 | 2026-11-11 | **Reuse components.** Best code of the set: captions, QA, safe zones, Remotion layer, loudness. Built for editing *recordings*, not generated footage. |
| 5 | Social Post (skill) | MIT | 2026-10-16 | **Borrow concepts, do not install.** Learning-governance design is excellent; the execution layer drives a logged-in Chrome — not acceptable for us. |
| 6 | Postiz | AGPL-3.0 | 2026-11-14 | **Use later for publishing.** Most complete, actively maintained, official APIs. Heavy to self-host. |
| 7 | Postly | AGPL-3.0 | 2026-11-10 | **Reject.** Marketing-post autopilot; its video is Ken-Burns stills. Overlaps Postiz with less depth. |

Additional alternatives checked: **MoneyPrinterTurbo** (stock-footage shorts — produces exactly the "generic AI / repetitive stock" look we must avoid), **OpenMontage** (AGPL, agent-driven multi-pipeline; large and overlapping with what we will build lean), **browser-use/video-use** (MIT; upstream of #4 — #4 is the better maintained descendant).

---

## 1. OpenX Flow — https://github.com/OpenX-Inc/flow

- **Capabilities claimed:** topic → LLM script → Wan 2.2 scene clips with last-frame chaining → narration + subtitles + music → publish to TikTok/YouTube/IG. "No human in the loop."
- **Stack:** Python 3.12, httpx, pydantic, typer, sqlmodel, FastAPI, edge-tts, FFmpeg; GPU backend on Modal/RunPod with `diffusers`.
- **Hardware:** 40–80 GB VRAM for Wan 2.2 14B (A100 class). No local GPU path for small cards.
- **Cost (their claim):** ~$2 per 60 s short on an A100. Unverified.
- **What the code actually does (verified by reading it):**
  - The image-to-video path in `src/gpu_backend/modal_server.py` loads the I2V checkpoint with `WanPipeline` (the text-to-video class) and then passes `image=` to it. That call should fail; diffusers uses `WanImageToVideoPipeline` for I2V. So the advertised scene chaining is broken as written.
  - Resolutions are hard-coded to landscape 480p (832×480) and 720p (1280×720). There is no 9:16 option.
  - Subtitles are one block per scene, timed to scene length — not word-aligned to the narration.
  - Assembly is `ffmpeg concat -c copy` (hard cuts only), then subtitles are burned in. There are no transitions, no ducking, no loudness normalisation.
  - TTS is edge-tts by default. That uses Microsoft's consumer Edge read-aloud endpoint, so its commercial-use status is unclear. **Not acceptable for a monetised brand.**
  - The "no human in the loop" auto-publishing conflicts with our approval requirement.
- **Reusable:** the orchestrator ↔ remote-GPU HTTP contract idea, last-frame conditioning concept, the cost docs in `docs/costs` as a sanity reference.
- **Risks:** small codebase (~1.9k lines core), early stage; would need significant fixing.

## 2. ComfyUI VidFlows — https://github.com/iqgeoai/ComfyUI-vidflows

- **Capabilities:** three ComfyUI graphs: (a) Google Veo 3 + Imagen pipeline (paid APIs), (b) Wan 2.2 + MultiTalk lip-sync character videos, (c) story creator with Kokoro TTS + ACE-Step music + Wan first/last-frame.
- **Stack:** ComfyUI JSON + 3 tiny custom nodes (audio duration, line count).
- **Hardware:** README says minimum RTX 6000 Pro **96 GB VRAM**.
- **License:** **no license file** → legally "all rights reserved". We cannot reuse it.
- **Maintenance:** 2 commits, last October 2025. Compiled `.pyc` files are committed.
- **Value:** the *idea* of the Story Creator graph (Kokoro + ACE-Step + Wan FLF2V) confirms a viable open-source chain. We re-implement the idea, we don't copy the files.

## 3. Vidia Open Workflows — https://github.com/Vidia-Tools/Vidia-Open-Workflows

- **Capabilities:** 19 ComfyUI workflows: Wan 2.2 pose/depth-guided video, LTX 2.3 image-to-video, Wan 2.1 tile upscaler, frame interpolation + deflicker + HDR finishing, MMAudio sound generation, SAM3 rotoscoping, clean-plate removal, face swap, and others.
- **License:** Functional Source License 1.1. Using it to make our own videos is a **Permitted Purpose**. Offering it as a competing commercial service is not. It converts to Apache-2.0 after two years. **This fits our use.**
- **Maintenance:** single sanitised public release (Aug 2026). One node (`VidiaVideoSaver`) is private, so the Export workflow needs a substitute.
- **Hardware:** 24–48 GB GPU for most. Runs on rented GPUs or partly on Comfy Cloud.
- **Security:** the workflows ask ComfyUI Manager to install third-party custom-node packs, and each pack is arbitrary Python. Install only on a disposable rented GPU, never on a machine that holds credentials.
- **Reusable:** `Upscaler Normal` (honest upscaling path), `post Normal` (RIFE interpolation 16→24/30 fps, deflicker), `Audio Generator` (MMAudio foley — check the MMAudio weights' license before using it commercially).

## 4. Social Video Agent — https://github.com/bartlomiejborzucki/social-video-agent

- **Capabilities (verified in `src/social_video/`):** transcript-driven editing, word-timed captions laid out against real font metrics, active-word highlight, per-platform safe zones (Reels/Shorts/TikTok), `reel-check` retention heuristics (hook within 1 s, dead air, payoff), loudness normalisation, music ducking, technical + brand QA, immutable delivery manifests, covers, NLE export (FCPXML/OTIO), and a Remotion motion layer (`remotion/*.tsx`).
- **Stack:** Python ≥3.10, typer, pydantic, faster-whisper (CPU), scenedetect, fonttools; Node + Remotion 4 for the motion layer.
- **License:** Apache-2.0, with an MIT upstream (browser-use/video-use) attributed properly in NOTICE.
- **Maintenance:** very active (v2.13.1, 2026-11-11), ADRs, provenance docs, a security policy.
- **Fit:** it is designed to cut *existing recordings* (interviews, talking heads). Our input is generated clips plus TTS. Its **captions, QA, safe-zone, loudness and delivery modules** are the parts we can reuse. Its editorial/EDL layer is not.
- **Hardware:** CPU-only works. No paid key required.
- **Remotion licensing:** Remotion is free for for-profit organisations with up to 3 employees. Above that it needs a Company License (~$25/seat/month per Remotion's pricing page — verify before you grow past 3).

## 5. Social Post — https://github.com/Hao0321/claude-skill-social-post

- **Capabilities:** a Claude/Codex skill (docs mostly in Traditional Chinese) with six modes: Plan, Write, Publish, Comment management, Analytics, Learning. Covers FB/IG/Threads text and image posts.
- **Stack:** Python + JS scripts, local JSONL data, a local "workbench" HTML UI.
- **License:** MIT.
- **Key concepts worth adopting:**
  - Outcomes are compared only within the same platform × content type × surface × account maturity ("comparables partition").
  - `causal_claim_allowed: false` on timing variables: correlation is never reported as cause.
  - New learnings become *candidates*. Rules change only after author review and an explicit separate activation. The previous version is always kept.
  - Every metric records where it came from, and low-confidence placeholders are kept out of pattern mining.
  - The analytics `coverage` gate proves each post's features made it into the analysis matrix.
- **Why not install it:** comment and reply automation works by driving a **logged-in Chrome session** (DOM automation of Meta sites). That is the insecure, ToS-risky method your brief forbids. It is also text-post oriented, not short video.
- **Decision:** we re-implement its learning-governance model in our analytics engine (Phase 8), with credit in our docs.

## 6. Postiz — https://github.com/gitroomhq/postiz-app

- **Capabilities:** a mature scheduling and publishing platform with about 37 providers, including TikTok (personal + business), YouTube, Instagram (Graph + standalone), Facebook, X, Threads, and others. Also a public REST API, MCP server, approval workflow, and analytics.
- **Verified details:** the TikTok provider correctly distinguishes `DIRECT_POST` from `UPLOAD` (UPLOAD sends a draft to the TikTok inbox). The YouTube provider maps a `made_with_ai` flag to `containsSyntheticMedia`, which matters for our AI-disclosure policy. Tokens are encrypted server-side.
- **Stack:** NestJS + Next.js, Postgres, Redis, **Temporal**, Elasticsearch. `docker-compose.yaml` runs **9 containers**.
- **License:** AGPL-3.0. Self-hosting for our own accounts is fine. AGPL obligations apply only if we modify it *and* offer it to others over a network.
- **Hardware/cost:** about 4 GB RAM. Running it locally in Docker is free; a small VPS is roughly €6–12/month (estimate).
- **Platform reality (applies to any tool, including our own):**
  - TikTok: posts from *unaudited* API apps are forced to private, and the posting account must be private. Leaving that mode requires TikTok's Content Posting audit. Postiz needs your own TikTok developer app.
  - YouTube: uploads from *unverified* API projects are restricted to private until the project passes Google's audit.
  - Instagram/Facebook: need a Professional (Creator/Business) account linked to a Facebook Page, plus a Meta app.
  - X: API write access and pricing have changed repeatedly. Check the current tier before relying on it.
- **Decision:** for the 10-video pilot, **upload manually** from our generated per-platform packets (fastest, zero audit risk). Introduce Postiz in Phase 7 once accounts exist and the API apps are approved.

## 7. Postly — https://github.com/chentaymane/Postly

- **Capabilities:** multi-tenant Next.js "social autopilot" for business marketing posts. Video = LLM script + Pollinations images + Piper TTS + FFmpeg `zoompan` Ken Burns + `xfade` crossfades.
- **License:** AGPL-3.0. Active (2026-11-10). Tokens are encrypted (`secretbox.js`).
- **Fit:** low. Still images with zoom read exactly as "generic AI content". Pollinations' terms for commercial use would need checking. Publishing overlaps Postiz with fewer providers.
- **Reusable idea:** the "Needs you" approval queue UX, which we will mirror in our dashboard.

---

## Video, image and voice providers (pricing snapshot, 2026-11-15 — **estimates; verify on the provider page before any spend**)

| Provider / model | Unit | Price seen | Notes |
|---|---|---|---|
| fal · Wan 2.2 A14B I2V | per video-second | $0.04 (480p) / $0.08 (720p) | ≈ $0.40 per 5 s 720p clip. Open weights. |
| fal · Wan 2.2 A14B I2V **Turbo** | per clip | $0.05 (480p) / $0.10 (720p) | Cheapest decent option; check max duration. |
| fal/Replicate · Kling 2.5 Turbo Pro | per second | ~$0.07 | ≈ $0.35 per 5 s. Strong motion and physics. |
| fal · Veo 3.1 Fast | per second | $0.10 (no audio) / $0.15 (audio), 720p–1080p; $0.30+ at 4K | Google direct lists $0.10/$0.12/$0.30 (720p/1080p/4K). |
| fal · Seedance 2.0 | per second | ~$0.24–0.30 at 720p | Premium. |
| fal · FLUX.2 [pro] | per image | $0.03 first MP + $0.015/MP | ≈ $0.045 for a 1080×1920 keyframe. |
| fal · FLUX.1 [schnell] | per MP | ~$0.003 | Drafts and thumbnails. |
| RunPod community RTX 4090 / L40S / H100 PCIe | per hour | ~$0.34 / ~$0.79 / ~$1.99 | Secure Cloud rose 11–20% in Oct 2026. Community capacity varies. |
| ElevenLabs Starter / Creator | per month | $6 / $22 | Commercial rights on paid plans only. The free tier is **not** usable for monetised content. |
| Kokoro-82M | free | Apache-2.0 | Local CPU TTS, commercial OK. Quality good, emotional range limited. |
| Remotion | free | ≤3 employees | Company License above that. |

### Sources
- [fal Wan 2.2 A14B I2V](https://fal.ai/models/fal-ai/wan/v2.2-a14b/image-to-video/llms.txt), [Wan Turbo](https://fal.ai/models/fal-ai/wan/v2.2-a14b/image-to-video/turbo), [Wan API price comparison](https://aiidelist.com/blog/cheapest-wan-2-2-api-pricing-2026)
- [Kling 2.5 cost guide](https://akool.com/blog-posts/kling-2-5-cost-guide), [Atlas Cloud Kling pricing](https://www.atlascloud.ai/blog/guides/kling-ai-pricing), [Krea Kling 2.5 docs](https://www.krea.ai/docs/api-reference/video/kling-25.md)
- [fal Veo 3.1 Fast](https://fal.ai/models/fal-ai/veo3.1/fast), [Seedance 2.0 vs Veo 3.1 (fal)](https://fal.ai/learn/tools/seedance-2-0-vs-veo-3-1), [InVideo per-second rate table](https://invideo.io/blog/ai-video-model-pricing)
- [fal pricing docs](https://fal.ai/docs/documentation/model-apis/pricing.md), [FLUX API pricing breakdown](https://developer.puter.com/tutorials/flux-api-pricing/)
- [RunPod pricing](https://www.runpod.io/gpu-cloud/pricing), [RunPod Oct 2026 Secure Cloud change](https://www.usagepricing.com/blueprint/activity/runpod-2026-10-15-secure-cloud-second-hike), [computeprices RTX 4090](https://computeprices.com/providers/runpod/gpus/rtx4090)
- [ElevenLabs pricing 2026 (bigvu)](https://bigvu.tv/blog/elevenlabs-pricing-2026-plans-credits-commercial-rights-api-costs/), [eesel ElevenLabs comparison](https://eesel.ai/blog/elevenlabs-pricing)
- [Kokoro-82M model card](https://huggingface.co/hexgrad/Kokoro-82M)
- [Remotion license](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md), [Remotion license FAQ](https://www.remotion.dev/docs/license/faq)
- [TikTok content sharing guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines), [TikTok Direct Post reference](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post), [Postiz TikTok provider docs](https://docs.postiz.com/providers/tiktok)
- [MoneyPrinterTurbo review](https://wavect.io/blog/moneyprinterturbo-review-2026/), [OpenMontage overview](https://ai-tldr.dev/tools/openmontage/)
