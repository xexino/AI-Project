# Quality control

QC runs on the delivery encode (`final_video.mp4`) and on the project's intermediate outputs. A technical failure stops the pipeline before packaging, and the project status becomes `FAILED` until the cause is fixed. The full report is `work/qc/qc_report.json`, copied into `delivery/qc_report.json`.

## Technical checks (enforced)

| Check | Rule | Since |
|---|---|---|
| Resolution / aspect ratio / fps | equal to `project.format` | v1 (aspect: v2) |
| Codec | H.264 High, yuv420p; AAC 48 kHz audio | v1 |
| Duration | equal to the timeline ±0.1 s; inside `format.target_duration_s` | v1 / v2 |
| Decode integrity | full decode with no errors (corrupted frames) | v1 |
| Loudness | integrated `qc.loudness_lufs` ±1 LU (default −14) | v1 |
| True peak | ≤ −1 dBTP | v1 |
| Black segments | none ≥0.25 s outside intended `fadeblack` transitions and the brand end dot | v1 (see note) |
| Frozen video | none > 0.6 s | v1 |
| Audio present | max level > −30 dB | v2 |
| Caption coverage | every script word has an aligned timing; 0 interpolated words | v1 |
| Missing scenes/frames | every scene has exactly round(clip × fps) frames | v2 |
| Narration | every narrated scene has a non-silent VO file that ends within its scene | v2 |
| Caption timing | monotonic, inside the video, no overlaps; minimum display 0.08 s | v2 |
| Caption readability | ≤ 24 characters per caption; caption font ≥ 48 px at 1920 px height | v2 |
| Safe zone | caption bottom margin between 1/6 and 1/2 of the height | v2 |
| Branding | the last scene is the brand's required end card; the cover exists | v2 |
| Brand end card content | the final second shows the wordmark: the dark-pixel share must not reach 100%, and at least one sampled frame must be ≤ 98% | v2 |
| Source references | claims cite listed sources; sources have an https URL or DOI. Links are format-checked only, not fetched | v2 |

**Note on black-segment detection (v2 change, documented deliberately).** The brand end card is an ink-coloured (#05141a) card with a small wordmark, and about 98% of its pixels are below the black detector's threshold. In v1 the shark passed only because film grain kept that share at 98.0%, just under the 98.5% trigger. The Tunguska end card, the same asset, measured 98–99%. Black detection therefore now covers all content up to the required brand end card, and the end card itself is verified by the dedicated *brand end card content* check above. Neither the detector thresholds nor the rules for documentary content were changed. The earlier Tunguska failures caused by real content problems (a crushed-black dip before the card, and loudness 1.3 LU low) were fixed in the content and the mix, not in QC.

## Editorial record (reported, not automated proof)

`qc_report.json → editorial` lists:

- the claims checked and any unresolved claims;
- licensing open items;
- publishing platforms whose metadata lacks an AI disclosure.

Automated checks do **not** prove factual accuracy. A claim marked `verified` means a reviewer checked it against the cited source. Unresolved claims and licensing gaps set `commercial_delivery_blocked` in the package manifest, and `python -m engine deliver` refuses to mark such a package as delivered.
