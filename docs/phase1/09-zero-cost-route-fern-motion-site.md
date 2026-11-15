# 09 — Decisions after approval: zero-cost route, Fern, prompt-motion.com

Approved 2026-11-15: brand **ODDLIGHT**, narration **Kokoro** for the pilot.

## 1. prompt-motion.com: what it actually is (inspected, not assumed)

Pages read: `/`, `/customize`, `/templates`, `/about`.

- A **free library of AI motion-graphics videos plus the prompts or "skills" that made them**. It was started on 5 Oct 2026, has about 240 entries, and is curated by hand.
- The prompts target **Claude + code renderers**: Remotion, three.js, HyperFrames, HTML. They do **not** target AI video models (Kling, Veo, Wan, Runway).
- Features: browse by category (Product UI, Charts, Diagrams, Kinetic type, Shapes, Particles, Characters…), "Customize" (rewrites a prompt in your browser with your brand, format and colours), and two templates ("3D template" for real-time three.js, "showreel prompt").
- **No public API, no login, no JSON/CSV export.** The only action is copy. Rights statement: "Videos and prompts belong to their creators, linked on each entry." I found no terms on automated access.
- Camera-move, transition and image-to-video vocabularies are **not** on the site.

**Integration decision:**
- No scraping. You (or I, from links you send) pick entries and use the site's own Copy/Customize. Each chosen prompt is saved into `motion-library/` with its source URL and creator credit.
- Our own structured camera/motion schema (doc 06) stays as the motion system for every scene.
- The site's real value is **motion graphics in Remotion/three.js**: animated numbers, maps, timelines, diagrams, title cards. That is exactly the layer ODDLIGHT needs, and it costs nothing to render.

## 2. Fern (YouTube): what we take, and what we don't

I can't watch YouTube videos from this environment, so this comes from secondary sources: reviews, analytics and tutorial summaries.
- **What Fern is:** long-form "armchair documentaries" (crime, history, investigations) told through **stylized 3D animation**, with heavy research, a strong narrator, music, and a distinctive animated intro. The channel was started in 2020 by a small team and is reported at about 5M subscribers.
- **Why it works:** deep research builds trust. The clean, minimal 3D reconstructions make complex events easy to follow, the camera moves slowly and deliberately, and the series feel is consistent.
- **What we adopt (format and craft level):** research-first scripts, stylized 3D reconstruction instead of photoreal fakery, slow motivated camera, consistent "world" rules.
- **What we do NOT copy:** Fern's characters, art style specifics, intro, music, narration, topics-as-told or scripts. ODDLIGHT keeps its own identity: dark scenes with one warm light, the oddlight dot, the Fraunces/Inter type, and the bell signature.
- **Implication:** stylized 3D is a better fit than photoreal AI video, both for the Fern-like quality you want and for honesty. A stylized reconstruction is obviously a reconstruction, so there is no misleading synthetic realism.

## 3. Starting at 0 MAD: options compared

| Route | Cost | Quality | Automatable | Commercial-safe | Verdict |
|---|---|---|---|---|---|
| **A. Code-rendered stylized 3D** (three.js/Remotion rendered on CPU in this container) + Kokoro + FFmpeg | **0** | Clean stylized 3D. Perfect continuity (same model every shot). Weaker on organic realism | Fully | Yes (our own code; MIT three.js; Remotion free ≤3 people) | ★ **Recommended pilot route** |
| B. Free GPU notebooks (Kaggle ~30 GPU h/week, Colab free T4) running open models (Wan 2.2 5B, LTX-Video) | 0 | Photoreal-ish 480–720p, artifacts | You run the notebook; I prepare it | Yes for Apache-2.0 models | Good add-on for occasional hero shots |
| C. Free daily credits in web apps (Kling, Hailuo, Grok Imagine, Meta AI, etc.) | 0 | Good | No (manual) | **Often watermarked, and free tiers often restrict commercial use** | Testing looks only, not for publishing |
| D. Hugging Face ZeroGPU Spaces | 0 | Varies | Partly | Depends on model/space | Small daily quota. Unreliable for production |
| E. Blender (free) | 0 | Highest stylized quality | Yes, headless | Yes (outputs are yours) | Too slow on this CPU-only container; an option if you have a PC with a GPU |

### Proof (done, at 0 MAD)
- **Scene S1** of the shark storyboard was rendered from code: `experiments/poc-3d/` (scene.html + render.mjs).
  - 144 frames at 1080×1920 in about 49 s of CPU time, encoded with grain and vignette.
  - Narration: Kokoro (`bm_george`).
  - The drone and bell signature is synthesized in FFmpeg, so it is original audio with no licence issues.
  - Projection: a full 42 s video takes about 6–8 min of render time.
- **Kokoro voice test:** 6 voices rendered for the hook (`experiments/voice/`) at about 4× real time on CPU.
- **Honest assessment:** the environment, light, particles, grade and audio already read as "ODDLIGHT". The procedural shark is placeholder quality.

### Upgrade path that keeps cost at 0
- Use a **properly licensed free 3D model** (CC0 or CC-BY with attribution, glTF) for animals and objects, loaded straight into three.js. No CC0 *Greenland* shark was found yet. Next step: search Sketchfab (licence filter CC0/CC-BY) and museum scan repositories. Every model's licence and attribution is logged.
- Alternatively, sculpt a better procedural shark: anatomically correct proportions, a skinned skeleton, a normal-mapped skin texture.

## 4. Budget impact
- Pilot under Route A: **0 MAD** in cash. It costs render time and iteration only.
- Paid AI video stays an optional upgrade, per shot, only after you approve it.
