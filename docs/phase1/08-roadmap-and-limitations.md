# 08 — Implementation Roadmap & Expected Limitations

## Roadmap

| Phase | Deliverable | Exit criterion | Est. effort |
|---|---|---|---|
| 1 Research ✅ | These documents | Your approval of brand + direction | done |
| 2 Brand | Handle/domain/TM check, logo, brand kit (colours, fonts, caption style, sound signature), voice design | You approve the kit | 1 session |
| 3 Foundation | Python package, project store, state machine, locking, cost/failure ledger, provider interfaces, `.env` handling, tests | `studio new`, `studio status` and dry-run cost estimates work | 1 session |
| 4 Content engine | Research → hooks (×5) → scripts (×3) → endings (×2) → scene breakdown → motion prompts, with source enforcement | The pilot script is produced through the pipeline | 1 session |
| 5 Video production | fal (FLUX, Wan, Kling) adapters, your motion-site adapter, reference-sheet continuity | All 9 pilot shots generated and logged | 1–2 sessions + €8–15 |
| 6 Post-production | VO, word timing, captions (Remotion), grade, transitions, mix, QC | **Pilot video v1 delivered for your review** | 1–2 sessions |
| 7 Distribution | Per-platform export packets, covers, captions/hashtags. Postiz later | Pilot packets ready for manual upload | 1 session |
| 8 Analytics + dashboard | Metrics store (API + manual import), comparables, candidate→approve learning, local dashboard | You can log real metrics and see the reports | 1–2 sessions |
| 9 Pilot campaign | 10 videos across D1/D2/D3, schedule | 10 approved videos | ~€80–100 |
| 10 Optimization | Results report from real data, next-batch plan | You approve batch 2 | after ~14 days of data |

## Expected technical limitations (honest list)

1. **Clip length.** Current models produce about 5–10 s per generation. Longer shots require chaining (last frame → next first frame), and quality drifts over chains.
2. **Continuity.** The same animal or object can subtly change shape between shots. Reference sheets and image-first workflows reduce this but do not eliminate it. Expect 1–3 retakes on some shots.
3. **Anatomy and physics.** Fins, tails and hands can deform, and fast motion amplifies artifacts. The brand's slow, dark style is chosen partly for this reason.
4. **Resolution.** Most affordable models generate at 720p–1080p. Native 4K is expensive and rarely worth it for phone screens. Upscaled shots will always be labelled as upscaled.
5. **Text in video.** Models render text badly, so all text, numbers and logos are added in Remotion, never generated.
6. **Voice.** Free TTS (Kokoro) has a limited emotional range. ElevenLabs is better but is a subscription, and its commercial rights apply only while subscribed (verify the terms).
7. **No GPU in this environment.** Generation runs on hosted APIs. Local open-source inference requires a rented GPU.
8. **Ephemeral container.** Generated media is large and the container can be reclaimed. Final videos must be downloaded by you or stored externally (e.g. cloud storage you choose). We commit code and metadata to git, not large media.
9. **Subjective quality.** I can inspect frames, measure technical specs and critique composition. Final taste is yours, which is why approval gates exist.
10. **Publishing APIs.** TikTok (unaudited → private only), YouTube (unverified project → private only) and Meta (professional account + app) all need setup and review before automated public posting. The pilot therefore uses manual uploads.
11. **Analytics APIs.** Retention curves are only partly available via APIs (YouTube Analytics yes; TikTok largely only in-app). Some metrics must be entered from your platform dashboards. They are marked `manual_export` and never estimated.
12. **Small samples.** 10 videos give directional signals, not proof. Platform algorithms add large random variance in early-account distribution.
13. **Provider churn.** Model prices and capabilities change monthly. The provider interface keeps switching cheap.
14. **AI disclosure.** Realistic AI visuals must be labelled per platform rules (TikTok AIGC label, YouTube synthetic-media flag, Meta "AI info"). This is built into our export packets.
