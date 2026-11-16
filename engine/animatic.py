"""Low-cost animatic: render every scene at reduced resolution and frame rate, then mux with the narration and the
burned-in captions/titles, watermarked "ANIMATIC · NOT FINAL", plus a per-beat contact sheet.

It reuses the production's own scene modules, scene parameters and caption builder, so what it shows is what the full
render will show, only cheaper. Everything is written under work/animatic/<W>x<H>_<fps>fps/; the production's frames,
clips and master (work/frames, work/clips, work/master) are never read or written. Transitions are shown as cuts."""
from __future__ import annotations

import json
import os
import resource
import shutil
import time
from pathlib import Path

from .pipeline import Context
from .stages.captions import build_ass
from .stages.visuals import scene_fingerprint, scene_inputs
from .util import FFMPEG, EngineError, atomic_write_json, atomic_write_text, fingerprint, run

FONTS = Path(__file__).parent / "three" / "fonts"


def _even(x: float) -> int:
    return max(2, int(round(x / 2)) * 2)


def animatic(ctx: Context, scale: float = 0.25, fps: int = 8, scenes: list[str] | None = None) -> dict:
    p = ctx.project
    tlf = ctx.work("timeline.json")
    if not tlf.exists():
        raise EngineError("animatic needs the measured timeline: run `produce --until timing` first")
    tl = json.loads(tlf.read_text())
    W, H = _even(p.fmt["width"] * scale), _even(p.fmt["height"] * scale)
    out = ctx.work("animatic", f"{W}x{H}_{fps}fps")
    renderer = ctx.provider("renderer", p.data["visual"].get("renderer", "threejs"))
    ctx.budget.check(renderer.info, 0.0)
    ru0 = resource.getrusage(resource.RUSAGE_CHILDREN)
    t_all = time.time()
    per_scene: dict[str, dict] = {}
    seq = out / "sequence"
    if seq.exists():
        shutil.rmtree(seq)
    seq.mkdir(parents=True)
    k = 0
    for seg in tl["scenes"]:
        s = scene_inputs(ctx, tl, seg)
        n_clip = max(1, round(seg["clip"] * fps))
        n_slot = max(1, round(seg["slot"] * fps))
        d = out / "frames" / s["id"]
        fp = fingerprint(scene_fingerprint(ctx, s, seg["clip"]), "animatic", W, H, fps)
        marker = d / ".fingerprint"
        cached = marker.is_file() and marker.read_text() == fp and len(list(d.glob("f*.png"))) == n_clip
        secs = 0.0
        if not cached and (scenes is None or s["id"] in scenes):
            if d.exists():
                shutil.rmtree(d)
            d.mkdir(parents=True)
            t0 = time.time()
            renderer.render(project_dir=p.scene_dir, module=s["module"], dur=seg["clip"], fps=fps, width=W, height=H,
                            params=s.get("params", {}), out_dir=d, log=ctx.log)
            secs = round(time.time() - t0, 1)
            if len(list(d.glob("f*.png"))) != n_clip:
                raise EngineError(f"animatic: scene {s['id']} produced {len(list(d.glob('f*.png')))}/{n_clip} frames")
            atomic_write_text(marker, fp)
        elif not cached:
            raise EngineError(f"animatic: scene {s['id']} not rendered and excluded by --scenes")
        per_scene[s["id"]] = {"frames": n_clip, "render_seconds": secs, "cached": cached}
        for i in range(n_slot):                                    # cut transitions: each scene contributes its slot
            src = d / f"f{min(i, n_clip - 1):04d}.png"
            try:
                os.link(src, seq / f"f{k:05d}.png")
            except OSError:
                shutil.copy2(src, seq / f"f{k:05d}.png")
            k += 1
    render_wall = round(time.time() - t_all, 1)
    fmt = {**p.fmt, "width": W, "height": H}
    ass = out / "captions.ass"
    atomic_write_text(ass, build_ass(tl, p.data["brand"], p.data.get("overlays", []), fmt))
    inputs, fl, n = [], [], 0
    for seg in tl["scenes"]:
        if seg.get("vo"):
            inputs += ["-i", str(ctx.work("vo", seg["vo"]))]
            ms = int(seg["vo_start"] * 1000)
            fl.append(f"[{n + 1}:a]aresample=48000,adelay={ms}|{ms}[a{n}]"); n += 1
    mix = "".join(f"[a{i}]" for i in range(n)) + f"amix=inputs={n}:normalize=0,apad=whole_dur={tl['duration']}[aud]"
    wm = (f"drawtext=fontfile={FONTS / 'Inter-SemiBold.ttf'}:text='ANIMATIC · NOT FINAL · {W}x{H} {fps} fps':"
          f"x=(w-tw)/2:y=h*0.035:fontsize={max(10, H // 60)}:fontcolor=white@0.85:box=1:boxcolor=black@0.45:boxborderw=4")
    graph = ";".join(fl + [mix, f"[0:v]scale={W}:{H}:flags=area,subtitles={ass}:fontsdir={FONTS},{wm},format=yuv420p[v]"])
    video = out / f"{p.id}_animatic_{W}x{H}_{fps}fps.mp4"
    run(FFMPEG + ["-framerate", str(fps), "-i", str(seq / "f%05d.png")] + inputs +
        ["-filter_complex", graph, "-map", "[v]", "-map", "[aud]", "-c:v", "libx264", "-crf", "26", "-preset", "medium",
         "-r", str(fps), "-c:a", "aac", "-b:a", "96k", "-t", f"{tl['duration']:.3f}", "-movflags", "+faststart", str(video)], log=ctx.log)
    sheet = contact_sheet(ctx, tl, out, fps, W, H)
    ru1 = resource.getrusage(resource.RUSAGE_CHILDREN)
    rep = {"video": str(video), "contact_sheet": str(sheet), "resolution": f"{W}x{H}", "fps": fps, "scale": scale,
           "frames_total": k, "duration_s": tl["duration"], "scenes": per_scene,
           "render_wall_seconds": render_wall, "render_seconds_sum": round(sum(v["render_seconds"] for v in per_scene.values()), 1),
           "child_cpu_seconds": round((ru1.ru_utime - ru0.ru_utime) + (ru1.ru_stime - ru0.ru_stime), 1),
           "child_peak_rss_mb": round(ru1.ru_maxrss / 1024, 1),
           "renderer": renderer.info.model, "machine_cpus": os.cpu_count(),
           "note": "Animatic only: reduced resolution and frame rate, transitions shown as cuts. Not a deliverable."}
    atomic_write_json(out / "animatic_report.json", rep)
    ctx.log.info("animatic_done", video=str(video), seconds=render_wall)
    return rep


def contact_sheet(ctx: Context, tl: dict, out: Path, fps: int, W: int, H: int) -> Path:
    """Three frames per narrated beat (20/50/80 % of its slot), labelled with beat id and global time."""
    tiles = []
    for seg in tl["scenes"]:
        for f in (0.2, 0.5, 0.8):
            t = seg["start"] + seg["slot"] * f
            tiles.append((seg["id"], t, out / "sequence" / f"f{min(int(t * fps), int(tl['duration'] * fps) - 1):05d}.png"))
    tiles = [x for x in tiles if x[2].exists()]
    cols = 9
    tw, th = 240, round(240 * H / W)
    inputs, fl = [], []
    for i, (sid, t, f) in enumerate(tiles):     # some modules (builtin end card) always render at full size
        inputs += ["-i", str(f)]
        fl.append(f"[{i}:v]scale={tw}:{th}:flags=area,drawtext=fontfile={FONTS / 'Inter-SemiBold.ttf'}:text='{sid}  {t:05.2f}s':x=6:y=6:"
                  f"fontsize=16:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=3[t{i}]")
    rows = -(-len(tiles) // cols)
    pad = rows * cols - len(tiles)
    for j in range(pad):
        fl.append(f"color=c=black:s={tw}x{th}:d=1[p{j}]")
    labels = "".join(f"[t{i}]" for i in range(len(tiles))) + "".join(f"[p{j}]" for j in range(pad))
    fl.append(f"{labels}xstack=inputs={rows * cols}:layout=" + "|".join(f"{(i % cols) * tw}_{(i // cols) * th}" for i in range(rows * cols)) + "[s]")
    sheet = out / "contact_sheet.jpg"
    run(FFMPEG + inputs + ["-filter_complex", ";".join(fl), "-map", "[s]", "-frames:v", "1", "-q:v", "3", str(sheet)], log=ctx.log)
    return sheet
