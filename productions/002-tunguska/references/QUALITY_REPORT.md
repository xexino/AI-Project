# Quality Report — Tunguska Visual Reference Pack

Date: 2026-11-16 · Generator: Canva Magic Media (included account quota, €0 out of pocket) · Source res: 2720×1536 (16:9)

## Honest scope caveat (read first)

Full-resolution files live in the Canva media library; this workspace's network allowlist blocked `media.canva.com` at QC time, so **scores below were judged on ~200 px previews**. Composition, lighting logic, palette and historical staging are reliably judged at that size; **fine-detail axes (material micro-texture, branch-level distortion, small artifacts) are provisional** and must be re-checked at full resolution before any frame is declared production-final. Frame 08 was not generated (quota exhausted — see Limitations).

Criteria (1–10): C Composition · P Photorealism · L Lighting · M Material quality · H Historical plausibility · E Environmental detail · V Visual consistency with the pack · U Usefulness for procedural 3D reconstruction.

| Frame | C | P | L | M | H | E | V | U | Min |
|---|---|---|---|---|---|---|---|---|---|
| 01 wilderness | 9 | 9 | 9 | 8* | 9 | 9 | 9 | 9 | 8 |
| 02 cabin | 9 | 8 | 8 | 8* | 9 | 8 | 9 | 9 | 8 |
| 03 flash | 8 | 8 | 8 | 8* | 9 | 8 | 8 | 8 | 8 |
| 04 fireball | 9 | 9 | 9 | 8* | 9 | 8 | 9 | 9 | 8 |
| 05 shockwave | 9 | 8 | 8 | 8* | 9 | 9 | 8 | 10 | 8 |
| 06 flattened | 9 | 9 | 8 | 8* | 10 | 9 | 9 | 9 | 8 |
| 07 aftermath | 9 | 9 | 8 | 8* | 9 | 9 | 9 | 9 | 8 |
| 08 expedition | — | — | — | — | — | — | — | — | not generated |

\* provisional at preview resolution.

All generated frames meet the ≥8 bar on every category **at preview fidelity**; none required regeneration within available quota.

## Per-frame notes

- **01** — Layered mist, river leading line, single warm sky break: exactly the pack's lighting philosophy. The river is an addition beyond the brief's elements list but strengthens depth and maps cleanly to a ribbon mesh.
- **02** — Period-correct hand-hewn log construction, readable chimney smoke, human scale against the forest wall. Smoke column is slightly faint; acceptable.
- **03** — Weakest of the seven. The flash reads partly as a celestial body (moon/sun-like disc) rather than an unmistakable *explosion* flash; it also sits higher above the horizon than the brief's "over the distant forest". Lighting logic (single cool source, rimmed silhouettes, preserved foreground detail, no fantasy lightning) is correct and highly usable for the engine's light-ramp moment. **First candidate for regeneration when quota refreshes** (add "low above the treeline, expanding burst, not a moon or sun").
- **04** — Standout frame. Incandescent core + ember trail, believable exposure, no mushroom cloud, no impact; bog-pool reflection bonus. Directly mirrors the existing `fireball()` + path-lerp mechanism.
- **05** — Coherent directional devastation with an advancing dust wall and an untouched zone behind it — the clearest 1:1 map to `fallState(R)`. Foreground root plates verge on orange; check saturation at full res.
- **06** — Historically excellent: radial trunks, bog pools, and standing stripped "telegraph pole" trees near the centre, matching the Kulik expedition photographs' geography. Radial alignment is strongest in the foreground; midground reads partly as open bog.
- **07** — Smouldering, drained, horizon-to-horizon destruction; sparse snags give vertical rhythm. No open flames (correct — hours-after beat).

## Rejection checklist (verified at preview fidelity)

No text/watermarks/borders · no modern objects · no crater or mushroom cloud · no fantasy elements · no identifiable historical individuals · perspective coherent in all 7 · no obvious floating objects · compositions non-repetitive (aerial/elevated/ground-level mix).

## Consistency verdict

Palette progression is deliberate and intact: warm-accent-over-cool (01, 02, 04, 05) → cool anomaly (03) → drained overcast (06, 07). Sampled dominant colours (in each frame's JSON) stay inside the ART_DIRECTION gamut. The seven frames read as one production.

## Limitations

1. **Frame 08 not generated**: the Canva account's included AI credit quota was exhausted after 7 images. Per the €0 constraint, no credits were purchased. The complete spec (`metadata/frame_08_reference.json`) and exact prompt (`REFERENCE_MANIFEST.json → frames[7].regenerate_prompt`) are ready — regeneration is one tool call once quota refreshes (Canva free quotas refresh monthly; a design-tier plan has a larger pool).
2. **Full-resolution files not yet in the project workspace**: blocked by the workspace egress allowlist (`media.canva.com`). Until it is allowed (claude.ai → Settings → Capabilities) or the files are downloaded manually from the Canva links in the manifest, the workspace holds small previews only (`metadata/previews/`). Final file sizes/resolutions must be recorded then.
3. **Preview-fidelity QC** as stated above; re-score M and artifact checks at full res.
4. **Aspect mismatch with the current engine output** (16:9 references vs 9:16 renders) is documented with handling guidance in THREEJS_IMPLEMENTATION_NOTES.md §0.
5. Generated imagery is reference-only guidance for the procedural engine — frames are not claimed as final video assets, and none were placed into the production pipeline (`project.json`, scenes and finished videos untouched).

## Verdict on Three.js suitability

**Suitable.** Every frame decomposes into existing engine primitives (see per-frame `engine_mapping`); frames 04/05/06 in particular were composed to match mechanisms the engine already implements (`fireball`, `fallState`, `flatRadius`). Four small reusable library additions are proposed in the implementation notes.
