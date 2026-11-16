"""Cover image from a rendered frame: grade, optional readability scrim, two title lines in brand fonts, wordmark.
Text stays inside the centre 1080x1350 crop used by profile grids."""
from __future__ import annotations

from ..pipeline import Context
from ..providers.render import THREE_DIR
from ..util import FFMPEG, EngineError, commit_file, run, tmp_path

FONTS = THREE_DIR / "fonts"


def _esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’").replace("%", "\\%")


def cover(ctx: Context) -> dict:
    c = ctx.project.data.get("cover")
    if not c:
        raise EngineError("project.json has no 'cover' section (scene, frame, lines)")
    frame = ctx.work("frames", c["scene"], f"f{int(c['frame']):04d}.png")
    if not frame.exists():
        raise EngineError(f"cover frame not rendered: {frame}")
    pal = ctx.project.data["brand"].get("palette", {})
    bone, accent = pal.get("bone", "#ede6d6").lstrip("#"), pal.get("sodium", "#ff8a1f").lstrip("#")
    lines = c.get("lines", [])
    y0 = int(c.get("y", 360)); size = int(c.get("size", 92))
    vf = ["vignette=PI/4.2", "noise=alls=4"]
    if c.get("scrim", True):
        # soft vertical gradient behind the title (stacked translucent bands; no hard edge)
        top, h, steps = max(0, y0 - 260), 760, 16
        for k in range(steps):
            a = 0.55 * (1 - abs((k + 0.5) / steps * 2 - 1)) ** 0.8 / steps * 4
            vf.append(f"drawbox=x=0:y={top + k * h // steps}:w=iw:h={h // steps + 1}:color=black@{a:.3f}:t=fill")
    for i, line in enumerate(lines):
        col = bone if i == 0 else accent
        vf.append(f"drawtext=fontfile={FONTS / 'Fraunces-Regular.ttf'}:text='{_esc(line)}':fontcolor=0x{col}:fontsize={size}:x=(w-tw)/2:y={y0 + i * int(size * 1.2)}")
    name = ctx.project.data["brand"].get("name", "")
    if name:
        vf.append(f"drawtext=fontfile={FONTS / 'Inter-SemiBold.ttf'}:text='{_esc(name)}':fontcolor=0x{bone}@0.8:fontsize=38:x=(w-tw)/2:y=1560")
    out = ctx.work("cover", "cover.png")
    tmp = tmp_path(out)
    run(FFMPEG + ["-i", str(frame), "-vf", ",".join(vf), str(tmp)], log=ctx.log)
    commit_file(tmp, out)
    jpg = ctx.work("cover", "cover.jpg")
    tmp = tmp_path(jpg)
    run(FFMPEG + ["-i", str(out), "-q:v", "2", str(tmp)], log=ctx.log)
    commit_file(tmp, jpg)
    return {"cover_png": out, "cover_jpg": jpg}
