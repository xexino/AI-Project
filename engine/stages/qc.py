"""Quality control. Technical checks are automated and enforced (a failure stops the pipeline before packaging).
Editorial checks are reported separately: an automated check cannot prove factual accuracy.

Preserved from the v1 pilot (same thresholds): resolution, fps, codec/profile/pixel format, AAC 48 kHz audio,
duration vs timeline (±0.1 s), full decode, integrated loudness (target ±1 LU), true peak <= -1 dBTP,
black segments (except intended fade-to-black transitions and the brand end dot), frozen video > 0.6 s,
every script word has a caption timing (0 interpolated words)."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

from ..pipeline import Context
from ..util import EngineError, atomic_write_json
from ..editorial_rules import voiced_indices
from .captions import caption_chunks, chunk_windows


def _sh(*c: str) -> subprocess.CompletedProcess:
    return subprocess.run(c, capture_output=True, text=True)


def probe(v: Path) -> dict:
    p = _sh("ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(v))
    if p.returncode != 0:
        raise EngineError(f"ffprobe cannot read {v}: {p.stderr.strip()[:200]}")
    return json.loads(p.stdout)


def technical_checks(v: Path, tl: dict, fmt: dict, q: dict, brand_endcard: bool = False) -> tuple[list[dict], dict]:
    checks: list[dict] = []
    def check(name: str, ok, detail) -> None:
        checks.append({"check": name, "pass": bool(ok), "detail": detail})
    pr = probe(v)
    vs = next(s for s in pr["streams"] if s["codec_type"] == "video")
    au = next((s for s in pr["streams"] if s["codec_type"] == "audio"), None)
    dur = float(pr["format"]["duration"])
    W, H, fps = fmt["width"], fmt["height"], fmt["fps"]
    check(f"resolution {W}x{H}", (vs["width"], vs["height"]) == (W, H), f'{vs["width"]}x{vs["height"]}')
    check(f"aspect ratio {fmt.get('aspect_ratio', '')}", vs["width"] * H == vs["height"] * W, f'{vs["width"]}:{vs["height"]}')
    check(f"fps {fps}", vs["r_frame_rate"] == f"{fps}/1", vs["r_frame_rate"])
    check("codec h264 high yuv420p", vs["codec_name"] == "h264" and vs.get("profile") == "High" and vs["pix_fmt"] == "yuv420p", f'{vs["codec_name"]} {vs.get("profile")} {vs["pix_fmt"]}')
    check("audio aac 48k present", au is not None and au["codec_name"] == "aac" and au["sample_rate"] == "48000", f'{au and au["codec_name"]} {au and au["sample_rate"]}')
    tol = q.get("duration_tolerance_s", 0.1)
    check(f"duration matches timeline (±{tol}s)", abs(dur - tl["duration"]) <= tol, f"{dur:.3f}s vs {tl['duration']:.3f}s")
    lo, hi = fmt.get("target_duration_s", [0, 1e9])
    check(f"duration within project target {lo}-{hi}s", lo <= dur <= hi, f"{dur:.1f}s")
    dec = _sh("ffmpeg", "-v", "error", "-i", str(v), "-f", "null", "-")
    check("decodes without errors (no corrupted frames)", dec.returncode == 0 and not dec.stderr.strip(), dec.stderr.strip()[:300] or "clean")
    loud = _sh("ffmpeg", "-hide_banner", "-i", str(v), "-af", "ebur128=peak=true", "-f", "null", "-").stderr
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", loud)[-1]); TP = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", loud)[-1])
    target, ltol = q.get("loudness_lufs", -14.0), q.get("loudness_tolerance", 1.0)
    check(f"loudness {target:g} LUFS ±{ltol:g}", abs(I - target) <= ltol, f"{I} LUFS")
    check(f"true peak <= {q.get('true_peak_max_dbtp', -1.0):g} dBTP", TP <= q.get("true_peak_max_dbtp", -1.0), f"{TP} dBTP")
    bd = _sh("ffmpeg", "-hide_banner", "-i", str(v), "-vf", "blackdetect=d=0.25:pic_th=0.985:pix_th=0.06", "-an", "-f", "null", "-").stderr
    blacks = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", bd)
    sc = tl["scenes"]
    allowed = [(sc[i + 1]["start"] - 0.2, sc[i + 1]["start"] + sc[i]["transition"]["d"] + 0.2) for i in range(len(sc) - 1) if sc[i]["transition"]["type"] == "fadeblack"]
    ends = [s for s in sc if s["id"] == "end"]
    if ends:
        # the brand end dot (last ~1.5 s of the exit scene) — unchanged v1 allowance
        allowed.append((ends[0]["start"] - 1.6, ends[0]["start"] + 0.8))
        if brand_endcard:
            # The required brand end card is an intentionally ink-dark brand asset (~98% of pixels below the
            # detector threshold). It is verified by its own check below instead of by black detection.
            allowed.append((ends[0]["start"] - 1.6, dur + 1.0))
    blacks = [b for b in blacks if not any(a <= float(b[0]) and float(b[1]) <= z for a, z in allowed)]
    check("no unintended black segments (content before the brand end card)", len(blacks) == 0, blacks or "none")
    if ends and brand_endcard:
        t0 = max(dur - 0.9, ends[0]["start"])
        bf = _sh("ffmpeg", "-hide_banner", "-ss", f"{t0:.2f}", "-i", str(v), "-vf", "fps=8,blackframe=amount=0:threshold=32,metadata=print:key=lavfi.blackframe.pblack", "-an", "-f", "null", "-").stderr
        pb = [int(x) for x in re.findall(r"pblack=(\d+)", bf)]
        ok = bool(pb) and max(pb) < 100 and min(pb) <= 98
        check("brand end card shows its wordmark (not blank)", ok, f"dark-pixel share {min(pb) if pb else '?'}-{max(pb) if pb else '?'}% in the final second")
    fz = _sh("ffmpeg", "-hide_banner", "-i", str(v), "-vf", "freezedetect=n=0.0005:d=0.6", "-an", "-f", "null", "-").stderr
    freezes = re.findall(r"freeze_start: ([\d.]+)", fz)
    check("no frozen video > 0.6s", len(freezes) == 0, freezes or "none")
    nb = _sh("ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets,r_frame_rate", "-of", "json", str(v)).stdout
    try:
        st = json.loads(nb)["streams"][0]; num, den = (int(x) for x in st["r_frame_rate"].split("/")); vdur = int(st["nb_read_packets"]) * den / num
    except (KeyError, IndexError, ValueError, ZeroDivisionError, json.JSONDecodeError):
        vdur = -1.0
    check(f"video stream covers the timeline (±{q.get('duration_tolerance_s', 0.1)}s)", abs(vdur - tl["duration"]) <= q.get("duration_tolerance_s", 0.1),
          f"{vdur:.3f}s of video vs {tl['duration']:.3f}s timeline")
    vol = _sh("ffmpeg", "-hide_banner", "-i", str(v), "-af", "volumedetect", "-vn", "-f", "null", "-").stderr
    mx = re.findall(r"max_volume: (-?[\d.]+) dB", vol)
    check("audio is not silent", bool(mx) and float(mx[0]) > -30, f"max {mx[0] if mx else '?'} dB")
    words = tl["words"]; unmatched = [w["word"] for w in words if not w.get("matched", True)]
    check("every script word has a caption timing", len(unmatched) == 0, f"{len(words)} words, {len(unmatched)} interpolated" + (f": {unmatched}" if unmatched else ""))
    return checks, {"duration": dur, "integrated_lufs": I, "true_peak_dbtp": TP}


def structural_checks(ctx: Context, tl: dict) -> list[dict]:
    checks: list[dict] = []
    def check(name: str, ok, detail) -> None:
        checks.append({"check": name, "pass": bool(ok), "detail": detail})
    p, d, q = ctx.project, ctx.project.data, ctx.project.data["qc"]
    fps = tl["fps"]
    missing = []
    for s in tl["scenes"]:
        n = round(s["clip"] * fps)
        got = len(list(ctx.work("frames", s["id"]).glob("f*.png")))
        if got != n:
            missing.append(f"{s['id']}: {got}/{n} frames")
    check("no missing scenes or frames", not missing and len(tl["scenes"]) == len(p.scenes), missing or f"{len(tl['scenes'])} scenes complete")
    vo_problems = []
    for s in tl["scenes"]:
        if p.scene(s["id"])["text"].strip():
            f = ctx.work("vo", s.get("vo") or "missing.wav")
            if not f.exists():
                vo_problems.append(f"{s['id']}: narration file missing"); continue
            mx = re.findall(r"max_volume: (-?[\d.]+) dB", _sh("ffmpeg", "-hide_banner", "-i", str(f), "-af", "volumedetect", "-f", "null", "-").stderr)
            if not mx or float(mx[0]) < -30:
                vo_problems.append(f"{s['id']}: narration is silent")
            end = s["vo_start"] + s["vo_len"]
            if end > s["start"] + s["slot"] + 1e-3:
                vo_problems.append(f"{s['id']}: narration overruns its scene by {end - s['start'] - s['slot']:.2f}s")
    check("narration present and synchronised with its scene", not vo_problems, vo_problems or "ok")
    ws = tl["words"]
    order_bad = [w["word"] for a, w in zip(ws, ws[1:]) if w["start"] < a["start"] - 1e-6]
    outside = [w["word"] for w in ws if w["end"] > tl["duration"] or w["start"] < 0]
    chunks = caption_chunks(tl, voiced_indices(tl, d.get("overlays", []))); wins = chunk_windows(chunks)   # what is burned in
    short = [" ".join(x["word"] for x in c) for c, (a, b) in zip(chunks, wins) if b - a < q.get("min_caption_s", 0.08)]
    overlap = [i for i in range(len(wins) - 1) if wins[i][1] > wins[i + 1][0] + 1e-6]
    check("caption timing monotonic, inside the video, no overlaps", not order_bad and not outside and not overlap,
          {"out_of_order": order_bad, "outside": outside, "overlaps": overlap} if (order_bad or outside or overlap) else f"{len(chunks)} captions")
    check(f"caption minimum display {q.get('min_caption_s', 0.08)}s", not short, short or "ok")
    longest = max((len(" ".join(x["word"] for x in c)) for c in chunks), default=0)
    cs = d["brand"].get("caption_style", {})
    k = d["format"]["height"] / 1920
    check(f"caption readability (<= {q.get('max_caption_chars', 24)} chars per caption, font >= 2.5% of frame height)",
          longest <= q.get("max_caption_chars", 24) and cs.get("size", 64) >= 48, f"longest {longest} chars, font {round(cs.get('size', 64) * k)}px")
    mv = cs.get("margin_v", 560)
    check("captions inside platform safe zone (bottom margin 1/6..1/2 of height)", 320 <= mv <= 960, f"bottom margin {round(mv * k)}px of {d['format']['height']}")
    req = d["brand"].get("required_endcard_module")
    last = p.scenes[-1]
    check("brand end card present", not req or last["module"] == req, f"last scene module {last['module']} (required {req})")
    check("cover image present", ctx.work("cover", "cover.png").exists(), "work/cover/cover.png")
    src_ids = {s["id"] for s in d["sources"]}
    bad_src = [f"{c['id']}->{x}" for c in d["claims"] for x in c.get("sources", []) if x not in src_ids]
    no_url = [s["id"] for s in d["sources"] if not str(s.get("url", "")).startswith("https://") and not s.get("doi")]
    check("source references valid (claims cite listed sources; sources have https URL or DOI)", not bad_src and not no_url,
          {"unknown": bad_src, "no_url": no_url} if (bad_src or no_url) else f"{len(src_ids)} sources (format checked; links not fetched)")
    return checks


def _reference_record(ctx: Context) -> dict:
    f = ctx.work("references", "reference_report.json")
    if not f.exists():
        return {"configured": False}
    r = json.loads(f.read_text())
    if not r.get("configured"):
        return {"configured": False}
    return {"configured": True, "warnings": r["warnings"], "frames_with_images": [x["id"] for x in r["frames"] if x.get("image_status") == "present"],
            "frames_without_images": [x["id"] for x in r["frames"] if x.get("image_status") != "present"],
            "note": "References guide art direction only. Similarity to a reference is judged by a human, not by these checks."}


def qc(ctx: Context) -> dict:
    tl = json.loads(ctx.work("timeline.json").read_text())
    final = ctx.work("master", "final_video.mp4")
    req = ctx.project.data["brand"].get("required_endcard_module")
    tech, metrics = technical_checks(final, tl, ctx.project.fmt, ctx.project.data["qc"],
                                     brand_endcard=bool(req) and ctx.project.scenes[-1]["module"] == req)
    master_probe = probe(ctx.work("master", f"{ctx.project.id}_master.mp4"))
    struct = structural_checks(ctx, tl)
    fc = json.loads(ctx.work("editorial", "factcheck.json").read_text())
    from .package import load_assets, licensing_problems
    lic = licensing_problems(load_assets(ctx.project))
    pubs = ctx.project.data.get("publishing", {}).get("platforms", {})
    disclosure_missing = [k for k, v in pubs.items() if "ai" not in json.dumps(v).lower()]
    rep = {
        "file": final.name, **metrics,
        "native_render_resolution": f"{ctx.project.fmt['width']}x{ctx.project.fmt['height']} (rendered natively, not upscaled)",
        "master": {"file": ctx.work("master", f"{ctx.project.id}_master.mp4").name, "duration": float(master_probe["format"]["duration"])},
        "technical": {"checks": tech + struct, "all_pass": all(c["pass"] for c in tech + struct)},
        "editorial": {
            "note": "Editorial items are records for a human reviewer. Automated checks do not prove factual accuracy.",
            "claims_checked": fc["claims_checked"], "claims_unresolved": fc["unresolved"],
            "licensing_open_items": lic,
            "ai_disclosure_missing_in": disclosure_missing,
            "visual_references": _reference_record(ctx),
        },
    }
    rep["checks"] = rep["technical"]["checks"]           # v1-compatible keys
    rep["all_pass"] = rep["technical"]["all_pass"]
    out = ctx.work("qc", "qc_report.json")
    atomic_write_json(out, rep)
    for c in rep["checks"]:
        ctx.log.info("qc_check", check=c["check"], result="PASS" if c["pass"] else "FAIL")
    if not rep["all_pass"]:
        failed = [c["check"] for c in rep["checks"] if not c["pass"]]
        raise EngineError("technical QC failed: " + "; ".join(failed) + f" (see {out})")
    return {"qc_report": out}
