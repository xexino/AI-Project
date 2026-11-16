"""Delivery package + asset licensing register.

delivery/ contains: final_video.mp4, cover.png, cover.jpg, subtitles.srt, subtitles.vtt, script.md, storyboard.md,
sources.json, factcheck.json, publishing_metadata.json, publish_packet.md, qc_report.json, production_report.json,
asset_licenses.json and package_manifest.json (sha256 of every file). Commercial delivery is BLOCKED when
licensing information is missing/unverified, claims are unresolved, or QC did not pass. Nothing is uploaded."""
from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

from ..pipeline import Context
from ..project import Project
from ..util import REPO_DIR, EngineError, atomic_write_json, atomic_write_text, sha256_file

REQUIRED_ASSET_FIELDS = ["id", "file", "origin", "creator", "license", "commercial_use", "attribution", "acquired", "verification"]


def load_assets(p: Project) -> list[dict]:
    f = p.dir / "assets.json"
    if not f.is_file():
        return [{"id": "__register__", "error": "assets.json missing"}]
    data = json.loads(f.read_text(encoding="utf-8"))
    return data.get("assets", [])


def licensing_problems(assets: list[dict]) -> list[str]:
    probs = []
    for a in assets:
        if a.get("error"):
            probs.append(a["error"]); continue
        miss = [k for k in REQUIRED_ASSET_FIELDS if a.get(k) in (None, "")]
        if miss:
            probs.append(f"{a.get('id', '?')}: missing {', '.join(miss)}")
        if a.get("commercial_use") is True and a.get("verification") not in ("verified", "generated_in_house"):
            probs.append(f"{a.get('id')}: commercial use claimed without verification evidence")
        if a.get("commercial_use") not in (True,):
            probs.append(f"{a.get('id')}: not cleared for commercial use ({a.get('commercial_use')})")
        if a.get("origin") == "third_party" and not a.get("source_url"):
            probs.append(f"{a.get('id')}: third-party asset without source_url")
    return probs


def publish_packet(d: dict, tl: dict) -> str:
    pub = d.get("publishing", {})
    lines = [f"# Publishing packet — {d['id']} ({d['brand'].get('name', '')})", "",
             "**Status:** prepared for MANUAL upload. Nothing has been published. Publishing requires explicit authorization.", "",
             f"**Video:** final_video.mp4 ({d['format']['width']}x{d['format']['height']}, {d['format']['fps']} fps, {tl['duration']:.1f} s)", "",
             f"**Disclosure:** {d['brand'].get('disclosure', 'Animated reconstruction. Narration voice is AI-generated.')}", ""]
    for plat, meta in pub.get("platforms", {}).items():
        lines.append(f"## {plat.replace('_', ' ').title()}")
        for k, v in meta.items():
            lines.append(f"- **{k}:** {v}")
        lines.append("")
    lines += ["## Sources", ""] + [f"- {s['citation']} — {s.get('url') or s.get('doi')}" for s in d["sources"]]
    return "\n".join(lines) + "\n"


def package(ctx: Context) -> dict:
    p, d = ctx.project, ctx.project.data
    tl = json.loads(ctx.work("timeline.json").read_text())
    qc = json.loads(ctx.work("qc", "qc_report.json").read_text())
    if not qc.get("all_pass"):
        raise EngineError("refusing to package: technical QC did not pass")
    out = p.delivery
    staging = p.dir / ".delivery.tmp"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)
    copies = {"final_video.mp4": ctx.work("master", "final_video.mp4"), "cover.png": ctx.work("cover", "cover.png"),
              "cover.jpg": ctx.work("cover", "cover.jpg"), "subtitles.srt": ctx.work("captions", "subtitles.srt"),
              "subtitles.vtt": ctx.work("captions", "subtitles.vtt"), "script.md": ctx.work("editorial", "script.md"),
              "storyboard.md": ctx.work("editorial", "storyboard.md"), "sources.json": ctx.work("editorial", "sources.json"),
              "factcheck.json": ctx.work("editorial", "factcheck.json"), "qc_report.json": ctx.work("qc", "qc_report.json")}
    for name, src in copies.items():
        if not src.exists():
            raise EngineError(f"package input missing: {src}")
        shutil.copy2(src, staging / name)
    assets = load_assets(p)
    lic = licensing_problems(assets)
    atomic_write_json(staging / "asset_licenses.json", {"project": p.id, "assets": assets, "open_items": lic})
    atomic_write_json(staging / "publishing_metadata.json", {"project": p.id, "title": d["title"], "publishing_enabled": False,
                                                             "platforms": d.get("publishing", {}).get("platforms", {})})
    atomic_write_text(staging / "publish_packet.md", publish_packet(d, tl))
    from ..cli import production_report
    atomic_write_json(staging / "production_report.json", production_report(ctx, {"note": "snapshot at packaging time"}))
    blocking = []
    if lic:
        blocking.append("licensing: " + "; ".join(lic))
    if json.loads((staging / "factcheck.json").read_text())["unresolved"]:
        blocking.append("unresolved factual claims")
    files = sorted(x for x in staging.iterdir() if x.is_file())
    manifest = {"project": p.id, "customer_id": d["customer_id"], "created": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "files": {f.name: {"bytes": f.stat().st_size, "sha256": sha256_file(f)} for f in files},
                "commercial_delivery_blocked": bool(blocking), "blocking_reasons": blocking,
                "publishing": "disabled (manual upload only)"}
    atomic_write_json(staging / "package_manifest.json", manifest)
    # verify package integrity before promoting it
    for name, meta in manifest["files"].items():
        if sha256_file(staging / name) != meta["sha256"] or meta["bytes"] == 0:
            raise EngineError(f"package integrity check failed for {name}")
    if out.exists():
        shutil.rmtree(out)
    staging.rename(out)
    if blocking:
        ctx.log.warn("commercial_delivery_blocked", reasons=" | ".join(blocking))
    return {"manifest": out / "package_manifest.json", "video": out / "final_video.mp4"}


def verify_package(delivery: Path) -> list[str]:
    """Re-check a delivery folder against its manifest (used by QC/tests and before DELIVERED)."""
    man = json.loads((delivery / "package_manifest.json").read_text())
    probs = []
    for name, meta in man["files"].items():
        f = delivery / name
        if not f.exists():
            probs.append(f"missing {name}")
        elif sha256_file(f) != meta["sha256"]:
            probs.append(f"modified/corrupted {name}")
    return probs
