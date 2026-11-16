# Visual reference system

Reference images are **art-direction guidance** for the procedural renderer. They are never composited into a video.

## Pieces

| Piece | Where | What it does |
|---|---|---|
| Registry | `productions/<id>/references/references.json` (schema `oddlight-references/1`) | One entry per reference frame. It records: the image (optional, git-ignored); the pinned `image_sha256`; the metadata JSON; a small preview (in git); the scenes it guides; palette, lighting, camera, composition, materials and environment guidance; and a `vertical_guide` (centre X used to adapt 16:9 references to 9:16). |
| Validation | `engine/references.py` | Checks that images exist, decode for real (dimensions and a decode pass, since `ffprobe` alone accepts some corrupt files) and match their pinned hash. Paths must stay inside the production. A missing *optional* image is a **warning**; a missing *required* image, a hash mismatch or an unreadable file is an **error**. |
| Stage | `references` (between `storyboard` and `narration`) | Writes `work/references/reference_report.json` and 9:16 composition guides (`work/references/vertical_guides/*.jpg`). With no registry it records "not configured" and does nothing else. |
| Scene params | `engine/stages/visuals.py → scene_params` | Scenes listing `"references": [...]` receive `params.refs` (the guidance) and `params.look` (from `project.visual.look`). Scenes without references receive nothing new. |
| Dependencies | `scene_fingerprint` | A referencing scene's fingerprint includes the guidance, the metadata file hash and the current image hash. Changing an image or its metadata re-renders exactly the scenes that use it. |
| QC | `qc_report.json → editorial.visual_references` | Lists the frames with and without images, plus any warnings. Similarity to a reference is judged by a human; QC does not claim it. |
| CLI | `python -m engine references --project … [--pin]` | Shows the status. `--pin` records new image hashes after a human has reviewed a changed image. |

## Experiments without touching the original

An experiment is its own production directory (its own `project.json`, state, work and delivery) with:

- `scene_root: "../.."`: reuses the base production's scene modules, so nothing is duplicated;
- `references: "../../references/references.json"`;
- `visual.look: "reference_v1"`: scene modules switch to the reference-guided code path only when `params.look` asks for it;
- `visual.reuse_frames_from: ["../.."]`: scenes whose fingerprint equals the base production's are hard-linked from the base frames instead of being re-rendered.

The narration, timing, captions and audio are regenerated deterministically and verified identical to the base production.

## Reusable rendering kit

`engine/three/lib/cinema.js` is generic and usable by any production:

- `cloudDeck` (textured, drifting cloud layers)
- `mistBands` (valley mist sheets that hills poke through)
- `spruceGeometry` / `makeSpruceForest` (slender ragged spruce, several variants to break repetition)
- `fallenTreeGeometry` / `makeFallenForest` (upturned root plate, splintered top, branch stubs)
- `dustWall` (advancing billboard front)
- `smokeColumns` (thin wisps)
- `fireballCore` (granular incandescent core and halo)

Project-specific builders live next to the scenes; for Tunguska, `scenes/lib/world_ref.js` holds the weathered period cabin, the reference palettes and the hero fireball.
