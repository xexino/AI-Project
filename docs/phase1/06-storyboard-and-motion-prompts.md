# 06 — Pilot Storyboard & Motion Prompts: "Still Here: The Greenland Shark"

**Spec:** 9:16, 1080×1920 delivery, 24 fps, ~42 s, 9 scenes. Keyframe first (FLUX.2), then image-to-video (Wan 2.2 A14B, with Kling 2.5 for hero shots S1/S7/S9).

**Native resolution will be recorded honestly:** 720p-generated shots are labelled "upscaled to 1080p".

## Global style block (prepended to every image prompt)

> cinematic underwater documentary still, vertical 9:16 composition, polar night, near-black teal water, **one single warm sodium-orange light source**, soft volumetric light shafts, suspended particles (marine snow), shallow depth of field, anamorphic lens character, subtle horizontal flare, fine 35mm film grain, muted desaturated palette except the warm light, photorealistic, natural animal anatomy

**Global negative:** text, watermark, logo, cartoon, CGI look, oversaturated, extra fins, deformed tail, two heads, human faces, divers, bubbles from nowhere, bright tropical water, coral reef, jitter, flicker, morphing.

**Continuity anchors:** the same shark design throughout (grey-brown mottled skin, small pale eyes, blunt rounded snout, small dorsal fins, faint scars, a small pale parasite trailing from one eye). We generate a **character reference sheet** first and condition every shark keyframe on it.

## Motion prompt schema (applies to every scene)

`camera · subject · environment · lighting · lens · intensity (1–5) · temporal consistency · transition out · negative`

---

### S1 — HOOK — 0.0–2.5 s — *"There's a shark in the Arctic that is probably older than the United States."*
- **Visual objective:** stop the scroll. A massive dark silhouette slowly enters a single warm shaft of light under the ice.
- **Keyframe:** looking up from below, an ice ceiling with one round hole, and a warm orange shaft of light descending. A huge shark silhouette is half inside the beam. Lots of negative space.
- **Motion:**
  - camera: very slow push-in (dolly forward, ~3% scale) · subject: shark glides left→right into the beam, tail sweeps slowly once · environment: marine snow drifting downward, light shaft gently wavering
  - lighting: the beam brightens slightly as the shark crosses · lens: 24 mm, low angle, deep blacks
  - intensity **2** · consistency: no change in shark shape; constant ice ceiling
  - transition out: **match-cut on the shark's eye** into S2
  - negative: fast motion, camera shake, the shark turning toward camera
- **Sound:** brand signature (sub drone + single glass bell as the light reveals). Under-ice creaks.
- **On-screen text:** captions only (word-highlight). No title card. Content first.

### S2 — SETUP — 2.5–6.5 s — *"It's called the Greenland shark. It lives in water close to freezing…"*
- **Visual objective:** reveal the animal clearly: scale, texture, calm.
- **Keyframe:** side profile, full body, the shark gliding through dark teal water, rim-lit by warm light from above.
- **Motion:** camera: slow lateral truck tracking alongside the shark · subject: gentle undulation, pectoral fins steady · environment: particles parallax past the lens · lighting: rim light slides along the skin · lens: 50 mm · intensity **2** · consistency: one continuous body, no fin count changes · transition: soft **1-frame dip through dark water** · negative: mouth opening, aggressive pose.
- **Sound:** a low water hum, a muffled distant ice groan.

### S3 — SETUP — 6.5–10 s — *"…and moves slower than you walk."*
- **Visual objective:** convey slowness and cold.
- **Keyframe:** wide shot, the shark tiny in the lower third, a vast ice ceiling with pressure ridges above, a faint warm glow far away.
- **Motion:** camera: locked-off with an imperceptible drift · subject: the shark barely advances (≈5% of frame) · environment: ice crystals glitter slowly · lighting: static · lens: 18 mm · intensity **1** · transition: **slow crossfade 12 frames** · negative: speed-ramping, fish schools.
- **Sound:** silence-adjacent. One deep ice crack at the word "walk".

### S4 — STORY — 10–15 s — *"For decades, no one could tell its age. Sharks don't have the bones scientists usually count."*
- **Visual objective:** the scientific problem: no countable rings.
- **Keyframe:** a dark lab tabletop with a single warm desk lamp. Close-up of cartilage samples and an open notebook with tally marks crossed out. Gloved hands only, at the frame edge.
- **Motion:** camera: slow top-down slide across the table · subject: a gloved hand lifts a sample slightly · environment: dust motes in the lamp beam · lighting: the lamp is the "odd light" · lens: 35 mm macro-ish · intensity **2** · transition: **light-match**, the lamp glow becomes the eye glint in S5 · negative: readable text, faces, logos, modern branded equipment.
- **Sound:** paper rustle, a soft pencil scratch.

### S5 — STORY — 15–20 s — *"So in 2016, researchers looked into its eyes."*
- **Visual objective:** the turn. The eye is the key.
- **Keyframe:** extreme macro of the shark's pale eye in darkness. A warm light glints in the lens.
- **Motion:** camera: slow **push-in to the pupil** (scale 100→130%) · subject: a micro-movement of the eye surface · environment: particles pass in front, out of focus · lighting: the glint slowly blooms · lens: 100 mm macro · intensity **2** · transition: **zoom-through** into S6 (we go *inside* the lens) · negative: blinking eyelids (sharks lack them in this form), cartoon eye.
- **Sound:** a rising airy tone. Narration is dry and close.

### S6 — STORY — 20–25 s — *"The core of the eye lens forms before birth — and never changes. Carbon-dating it gave an answer."*
- **Visual objective:** make an invisible science concept beautiful and clear.
- **Keyframe:** an abstract macro of transparent concentric layers, like tree rings made of glass. The central nucleus glows sodium-orange.
- **Motion:** camera: slow orbit (10°) around the layered sphere · subject: the layers assemble outward from the core one by one, then the core pulses once on "answer" · environment: soft caustics · lighting: the internal glow intensifies · lens: macro, very shallow DOF · intensity **3** · transition: the **core light becomes the sun/light above the ice** in S7 · negative: text, labels, DNA helices, sci-fi HUD.
- **Remotion overlay:** a minimal label "lens nucleus · formed before birth" in Inter, Bone colour, fading in and out (2 s).
- **Sound:** a crystalline shimmer, a low pulse on "answer".

### S7 — PAYOFF — 25–31 s — *"The largest shark they studied was around four hundred years old. Give or take a century."*
- **Visual objective:** feel centuries pass. The world above changes; the shark below doesn't.
- **Keyframe:** a split-depth composition: the ice surface and sky at the top third, the dark water and slow shark at the bottom. At the surface, a silhouette of a wooden sailing ship.
- **Motion:** camera: locked · subject: the shark moves almost imperceptibly · environment: **time-lapse above the surface**: sky cycles through day/night/aurora rapidly, and surface silhouettes change (sailing ship → steamship → modern icebreaker with lights) while the water below stays still · lighting: the warm light above flickers through the eras · intensity **4 above / 1 below** · consistency: the shark identical across the whole clip · transition: **hard cut on "century"** (the only hard cut, for emphasis) · negative: the shark speeding up, people visible, readable ship names.
- **Production note:** this is the hardest shot. It is built as 2–3 generated clips with a Remotion/FFmpeg composite (above layer and below layer masked at the ice line). Kling 2.5 is used for the surface time-lapse.
- **On-screen:** a large serif number, "≈ 400 years", in Fraunces, Bone, with "± 120" smaller in Signal teal.
- **Sound:** a slow whoosh of time, a fragment of distant ship horn (CC0), a deep boom on "century".

### S8 — PAYOFF — 31–36 s — *"And it doesn't become an adult until it's about one hundred and fifty."*
- **Visual objective:** intimacy. The animal up close, ancient and scarred.
- **Keyframe:** a 3/4 front close-up, the shark passing near the camera, scarred skin texture, a small pale parasite trailing from one eye, lit by warm light from the side.
- **Motion:** camera: slow pan following the head as it passes · subject: the head moves past the frame, the parasite drifts naturally · environment: particles · lighting: warm side-light sweeps · lens: 35 mm · intensity **2** · transition: **the shark's body wipes the frame to darkness** (natural wipe) into S9 · negative: teeth display, aggression, extra eyes.
- **Sound:** close water movement; the music swells slightly.

### S9 — EXIT — 36–42 s — *"So the oldest ones down there were young before the steam engine… and they're still in no hurry."*
- **Visual objective:** a memorable, calm ending. The brand signature.
- **Keyframe:** the shark descending away into the deep black, the light shaft above narrowing.
- **Motion:** camera: slow tilt up from the descending shark to the warm light · subject: the shark fades into darkness · environment: marine snow · lighting: the shaft narrows until **only a small glowing orange dot remains** (the oddlight logo dot) · lens: 24 mm · intensity **1** · transition: **end on the glowing dot (0.8 s hold) → wordmark fade** · negative: the logo rendered by the AI model. The logo is added in Remotion.
- **Sound:** the signature bell resolves; a 0.5 s tail of silence.

---

## Audio plan
- **VO:** a single designed voice, recorded as one take per beat, normalised, de-essed. Pauses are placed per the script's ellipses.
- **Music:** a sparse ambient pad (licensed or original), ducked −12 dB under the VO.
- **Mix:** −14 LUFS integrated, true peak ≤ −1 dBTP.

## Caption style
Inter SemiBold, 64 px, Bone on a 60% Ink rounded box. Active word in Sodium. 1–3 words per line. Placed in the upper-middle safe zone, clear of the TikTok/Reels UI.

## QC checklist for the pilot
- 1080×1920, 24 fps, H.264 High, yuv420p, AAC 48 kHz
- duration 38–45 s, no frozen or black frames > 0.2 s
- caption-to-VO drift < 80 ms
- each shot's shark design matches the reference (manual + LLM frame check)
- native resolution logged per shot
- AI-generated disclosure present in the description
