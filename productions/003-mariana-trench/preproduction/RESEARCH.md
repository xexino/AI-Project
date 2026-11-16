# Research and fact verification: The Deepest Place on Earth (003-mariana-trench)

Status: **verified against the sources below on 2026-11-16**. Every narrated statement maps to one claim id. The machine-readable copies are in `project.json` (`sources`, `claims`, with each beat's `claims`).

Method: each source page was fetched and the exact passage read. ScienceDirect blocks automated access, so the Greenaway et al. abstract was read through Crossref/OpenAlex metadata for the same DOI.

## Claims

| Claim | Narration | Verdict | Evidence (quoted or paraphrased from the source) | Sources |
|---|---|---|---|---|
| c_location | "beneath the western Pacific" (b2) | ✅ | NOAA: Challenger Deep "is located beneath the western Pacific Ocean in the southern end of the Mariana Trench". | noaa_oceandepth |
| c_deepest | "the deepest known point in the ocean" (b3) | ✅ | NOAA: "The deepest part of the ocean is called the Challenger Deep". WHOI: "Challenger Deep … is the deepest part of the ocean". "Known" is our deliberate hedge. | noaa_oceandepth, noaa_oe_depth, whoi_trenches |
| c_depth | "nearly eleven kilometres down" (b2); "measured at about ten thousand nine hundred thirty-five metres" (b3) | ✅ with uncertainty | Greenaway et al. 2021: "the deepest observed seafloor depth was 10,935 m (±6 m at 95% C.I.) below mean sea level", from June 2020 submersible dives, pressure-derived. NOAA (both pages) gives 10,935 m (35,876 ft). | greenaway2021, noaa_oceandepth, noaa_oe_depth |
| c_sunlight | "Sunlight vanishes far above it." (b4) | ✅ | NOAA: "Ocean depths greater than 1,000 meters (3,280 feet) are completely devoid of light". 1,000 m is far above ~10,935 m. | noaa_deep |
| c_hadal | "Below six thousand metres lies the hadal zone" (b4) | ✅ | WHOI: "With depths exceeding 6,000 meters (nearly 20,000 feet), trenches make up the world's 'hadal zone'". | whoi_trenches |
| c_conditions | "near-freezing, pitch-dark, under pressure more than a thousand times the air at sea level" (b5) | ✅ | WHOI: "water pressures more than 1,000 times greater than the surface, constant temperatures just above freezing, and no light". PMC11291871: hydrostatic pressure at Challenger Deep "increases up to ~115 MPa" (≈1,100+ atm). | whoi_trenches, pmc_cd_microbes |
| c_life | "Small animals inhabit these trenches" (b6) | ✅ | Kobayashi et al. 2012: "The amphipod *Hirondellea gigas* is a resident of the Challenger Deep". WHOI: trenches "host specialized life". | kobayashi2012, whoi_trenches |
| c_fish | "The deepest fish ever filmed was found higher up, at eight thousand three hundred thirty-six metres, in another Pacific trench." (b7) | ✅ (attribution checked) | NOAA: "The deepest confirmed fish sighting is of a snailfish filmed at a depth of 8,336 meters". NHM London (5 Apr 2023): "Snailfish in the Izu-Ogasawara Trench are the deepest ever caught on camera"; "a *Pseudoliparis* snailfish at 8,336 metres". **It is not in Challenger Deep.** 8,336 m is about 2.6 km above Challenger Deep's floor, so "higher up" is correct. | noaa_fish, nhm_fish |
| c_maps | "At the bottom, our maps are still incomplete." (b8) | ✅ general / ⚠ wording | NOAA: "We have only mapped about 26 percent of the Earth's seafloor in high resolution as of June 2024". **Caveat:** Challenger Deep itself has been surveyed with high-resolution multibeam (e.g. Bongiovanni, Stewart & Jamieson 2022, ref_02). The line holds for the deep seafloor in general, not for this one basin. Flagged for owner review. | noaa_oe_depth |
| — | "At the surface, the ocean seems to have no end." / "Earth's deepest frontier is not another planet. It's beneath us." | non-factual | Rhetorical framing; no factual claim. | — |

## Depth uncertainty (production note)

Published maximum depths for Challenger Deep differ by method, survey and corrections:

| Value | Context | Where seen |
|---|---|---|
| **10,935 m ± 6 m (95% CI)** | 2020 submersible transects, pressure-derived, below mean sea level | Greenaway et al. 2021; NOAA |
| 10,911 m | older figure still on WHOI's Ocean Learning Hub | whoi_trenches |
| 10,984 m | 2010 mapping estimate (mentioned in coverage of Greenaway et al.) | secondary coverage |
| 10,994 m | cited in Kobayashi et al. 2012 | kobayashi2012 |

The narration says "about" and the on-screen figure follows NOAA and Greenaway et al. The illustrative terrain puts the deepest point at exactly 10,935 m at the scene origin. The relief is not survey data, and the end card says "illustrative scale".

## Source issues noticed

- NOAA's "What is the 'deep' ocean?" page says deep-ocean pressure ranges "from about 40 to over 110 times" atmospheric pressure. That is inconsistent with ~1,100 atm at 11 km, so we **do not** cite that page for pressure.
- The NOAA fish page names the record fish's depth but not its trench. The trench (Izu-Ogasawara) is attributed from NHM London, which credits the University of Western Australia and Tokyo University of Marine Science and Technology expedition (filmed August 2022, announced April 2023).
- The record fish is an **unidentified** *Pseudoliparis* species. Our model is a genus-level likeness (morphology from *P. swirei*, ref_05), not that individual. The on-screen label names the Izu-Ogasawara Trench.

## Sources

| id | Citation | URL / DOI | Accessed |
|---|---|---|---|
| noaa_oceandepth | NOAA National Ocean Service, "How deep is the ocean?" | https://oceanservice.noaa.gov/facts/oceandepth.html | 2026-11-16 |
| noaa_oe_depth | NOAA Ocean Exploration, "How deep is the ocean?" | https://oceanexplorer.noaa.gov/ocean-fact/ocean-depth/ | 2026-11-16 |
| greenaway2021 | Greenaway, Sullivan, Umfress, Beittel & Wagner (2021), *Revised depth of the Challenger Deep from submersible transects; including a general method for precise, pressure-derived depths in the ocean*. Deep-Sea Research Part I 178: 103644 | https://doi.org/10.1016/j.dsr.2021.103644 | 2026-11-16 |
| whoi_trenches | WHOI Ocean Learning Hub, "Ocean trenches" | https://www.whoi.edu/ocean-learning-hub/ocean-topics/how-the-ocean-works/seafloor-below/ocean-trenches/ | 2026-11-16 |
| noaa_deep | NOAA Ocean Exploration, "What is the 'deep' ocean?" | https://oceanexplorer.noaa.gov/ocean-fact/deep-ocean/ | 2026-11-16 |
| noaa_fish | NOAA Ocean Exploration, "What is the deepest-living fish?" | https://oceanexplorer.noaa.gov/ocean-fact/what-is-the-deepest-living-fish/ | 2026-11-16 |
| nhm_fish | Natural History Museum London, "Deepest-ever fish filmed at a depth of 8,336 metres" (J. Ashworth, 5 April 2023) | https://www.nhm.ac.uk/discover/news/2023/april/deepest-ever-fish-filmed-depth-8336-metres.html | 2026-11-16 |
| kobayashi2012 | Kobayashi et al. (2012), *The hadal amphipod Hirondellea gigas possessing a unique cellulase…*, PLoS ONE 7(8): e42727 | https://doi.org/10.1371/journal.pone.0042727 | 2026-11-16 |
| pmc_cd_microbes | Challenger Deep seawater and sediment microbial communities (PMC11291871) | https://pmc.ncbi.nlm.nih.gov/articles/PMC11291871/ | 2026-11-16 |
