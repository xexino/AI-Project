"""Visual generation: render every scene to a PNG frame sequence, scene by scene, resumably.

Per-scene fingerprint = scene module + project scene libraries + engine 3D libraries + duration/format/params.
A scene whose frames are complete and whose fingerprint matches is skipped; a partially rendered scene with the
same fingerprint resumes from its first missing frame; a scene whose inputs changed is re-rendered from zero."""
from __future__ import annotations

import json
import re
import shutil
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from ..pipeline import Context
from ..providers.render import THREE_DIR
from ..util import EngineError, atomic_write_text, fingerprint, hash_tree


IMPORT_RE = re.compile(r"""(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)""")


def scene_dependencies(project_dir: Path, module: str) -> list[Path]:
    """The scene module plus every local file it imports, transitively ('oddlight/x.js' -> engine/three/lib/x.js).
    The host page and renderer are always included. 'three' itself is pinned by package-lock."""
    if module.startswith("builtin:"):
        start = THREE_DIR / "builtin" / f"{module.split(':', 1)[1]}.js"
    else:
        start = project_dir / module
    seen: set[Path] = set()
    todo = [start.resolve()]
    while todo:
        f = todo.pop()
        if f in seen or not f.is_file():
            continue
        seen.add(f)
        for a, b in IMPORT_RE.findall(f.read_text(encoding="utf-8")):
            spec = a or b
            if spec.startswith("oddlight/"):
                todo.append((THREE_DIR / "lib" / spec.split("/", 1)[1]).resolve())
            elif spec.startswith("."):
                todo.append((f.parent / spec).resolve())
    return sorted(seen) + [THREE_DIR / "index.html", THREE_DIR / "render.mjs"]


def scene_fingerprint(ctx: Context, s: dict, clip: float) -> str:
    p = ctx.project
    deps = scene_dependencies(p.dir, s["module"])
    return fingerprint(s["module"], hash_tree(deps), round(clip, 4), p.fmt["fps"], p.fmt["width"], p.fmt["height"], s.get("params", {}))


def scene_words(tl: dict, seg: dict) -> list[dict]:
    return [{"word": w["word"], "start": round(w["start"] - seg["start"], 3), "end": round(w["end"] - seg["start"], 3)}
            for w in tl.get("words", []) if w["scene"] == seg["id"]]


def scene_params(ctx: Context, s: dict) -> dict:
    """Brand defaults for the builtin end card (wordmark, tagline, colours), overridden by the scene's own params."""
    if s["module"] == "builtin:endcard":
        return {**(ctx.project.data["brand"].get("endcard") or {}), **s.get("params", {})}
    return s.get("params", {})


def config(ctx: Context) -> dict:
    tl = json.loads(ctx.work("timeline.json").read_text()) if ctx.work("timeline.json").exists() else {}
    out = {}
    for seg in tl.get("scenes", []):
        s = dict(ctx.project.scene(seg["id"]))
        if s.get("uses_words"):
            s["params"] = {**s.get("params", {}), "words": scene_words(tl, seg)}
        s["params"] = scene_params(ctx, s)
        out[s["id"]] = scene_fingerprint(ctx, s, seg["clip"])
    return out


def visuals(ctx: Context) -> dict:
    p = ctx.project
    fps, w, h = p.fmt["fps"], p.fmt["width"], p.fmt["height"]
    tl = json.loads(ctx.work("timeline.json").read_text())
    renderer = ctx.provider("renderer", p.data["visual"].get("renderer", "threejs"))
    ctx.budget.check(renderer.info, 0.0)
    only = set(ctx.options.get("scenes") or [])
    jobs = []
    outputs = {}
    for seg in tl["scenes"]:
        s = dict(p.scene(seg["id"]))
        # scenes that set "uses_words": true receive their narration word timings (scene-local seconds)
        if s.get("uses_words"):
            s["params"] = {**s.get("params", {}), "words": scene_words(tl, seg)}
        s["params"] = scene_params(ctx, s)
        n = round(seg["clip"] * fps)
        fp = scene_fingerprint(ctx, s, seg["clip"])
        d = ctx.work("frames", s["id"])
        marker = d / ".fingerprint"
        have = sorted(d.glob("f*.png")) if d.is_dir() else []
        for t in d.glob("*.tmp") if d.is_dir() else []:
            t.unlink()                                   # never trust a partially written frame
        if marker.exists() and marker.read_text() == fp and len(have) == n:
            ctx.log.info("scene_cached", scene=s["id"], frames=n)
        elif only and s["id"] not in only:
            raise EngineError(f"scene {s['id']} is not rendered/current but was excluded by --scenes")
        else:
            start = 0
            if marker.exists() and marker.read_text() == fp:
                existing = {int(x.stem[1:]) for x in have}
                start = next((i for i in range(n) if i not in existing), n)
                ctx.log.info("scene_resume", scene=s["id"], from_frame=start, of=n)
            else:
                if d.exists():
                    shutil.rmtree(d)
                d.mkdir(parents=True)
                atomic_write_text(marker, fp)
            jobs.append((s, seg, n, d, start))
        outputs[f"frames_{s['id']}"] = {"dir": d, "count": n, "fp": fp}

    def work(job):
        s, seg, n, d, start = job
        t0 = time.time()
        ctx.log.info("scene_render_start", scene=s["id"], frames=n, start=start)
        renderer.render(project_dir=p.dir, module=s["module"], dur=seg["clip"], fps=fps, width=w, height=h,
                        params=s.get("params", {}), out_dir=d, start=start, log=ctx.log)
        got = len(list(d.glob("f*.png")))
        if got != n:
            raise EngineError(f"scene {s['id']}: renderer produced {got}/{n} frames")
        secs = round(time.time() - t0, 1)
        ctx.log.info("scene_render_done", scene=s["id"], seconds=secs)
        return s["id"], secs

    timings = ctx.state.get("render_seconds", {})
    with ThreadPoolExecutor(max_workers=int(ctx.options.get("jobs", 2))) as ex:
        for sid, secs in ex.map(work, jobs):
            timings[sid] = secs
            ctx.state.put("render_seconds", timings)
    ctx.budget.record("visuals", renderer.info, sum(o["count"] for o in outputs.values()), "frames")
    return outputs
