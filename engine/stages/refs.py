"""Visual-reference stage: validate the registry, check scene mappings, write a report and 9:16 composition guides.

Runs for every project; with no `references` configured it records that and returns immediately (the engine works
unchanged without references). Guides are review aids under work/references/ — never used as video frames."""
from __future__ import annotations

from ..pipeline import Context
from ..references import load_registry
from ..util import FFMPEG, EngineError, atomic_write_json, run


def references(ctx: Context) -> dict:
    out = ctx.work("references", "reference_report.json")
    reg = load_registry(ctx.project)
    if reg is None:
        atomic_write_json(out, {"configured": False, "note": "no visual references configured for this project"})
        return {"report": out}
    rows, warns, errs = reg.check()
    used = {rid for s in ctx.project.scenes for rid in s.get("references", [])}
    for s in ctx.project.scenes:
        for rid in s.get("references", []):
            if rid not in reg.frames:
                errs.append(f"scene {s['id']}: unknown reference id '{rid}'")
    for rid, f in reg.frames.items():
        if rid in used and not any(r["id"] == rid and r.get("image_status") == "present" for r in rows):
            warns.append(f"{rid}: used by scenes {sorted(s['id'] for s in ctx.project.scenes if rid in s.get('references', []))} without an image")
    guides = []
    W, H = ctx.project.fmt["width"], ctx.project.fmt["height"]
    for r in rows:
        f = reg.frame(r["id"])
        if r.get("image_status") != "present" or not f.get("vertical_guide"):
            continue
        cx = float(f["vertical_guide"]["center_x"])
        g = ctx.work("references", "vertical_guides", f"{r['id']}_9x16.jpg")
        crop_w = f"ih*{W}/{H}"
        run(FFMPEG + ["-i", str(reg.resolve(f["image"])), "-vf",
                      f"crop={crop_w}:ih:max(0\\,min(iw-{crop_w}\\,iw*{cx}-{crop_w}/2)):0,scale=540:960", "-q:v", "3", str(g)], log=ctx.log)
        guides.append(str(g.name))
    for w in warns:
        ctx.log.warn("reference_warning", detail=w)
    atomic_write_json(out, {"configured": True, "registry": str(reg.path), "frames": rows, "warnings": warns, "errors": errs,
                            "vertical_guides": guides, "scene_map": {s["id"]: s.get("references", []) for s in ctx.project.scenes if s.get("references")},
                            "note": "References are art-direction guidance only; they are never composited into the video."})
    if errs:
        raise EngineError("visual reference errors:\n  - " + "\n  - ".join(errs))
    return {"report": out}
