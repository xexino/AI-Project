"""Visual comparison package: evenly spaced frames across the FULL runtime of two videos (no cherry-picking),
contact sheets, side-by-side pairs at matching relative positions, covers and QC reports side by side."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

from .qc_probe import duration
from .util import FFMPEG, run


def frames(video: Path, out: Path, n: int, prefix: str) -> list[Path]:
    d = duration(video)
    out.mkdir(parents=True, exist_ok=True)
    paths = []
    for i in range(n):
        t = d * (i + 0.5) / n                          # centre of each of n equal slices of the runtime
        p = out / f"{prefix}_{i:02d}_{t:05.1f}s.jpg"
        run(FFMPEG + ["-ss", f"{t:.3f}", "-i", str(video), "-frames:v", "1", "-q:v", "3", str(p)])
        paths.append(p)
    return paths


def sheet(images: list[Path], out: Path, cols: int, label: str) -> Path:
    inputs = []
    for p in images:
        inputs += ["-i", str(p)]
    rows = (len(images) + cols - 1) // cols
    layout = "|".join(f"{(i % cols) * 360}_{(i // cols) * 640}" for i in range(len(images)))
    scaled = "".join(f"[{i}:v]scale=360:640,drawtext=text='{images[i].stem.split('_')[-1]}':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.5[s{i}];" for i in range(len(images)))
    run(FFMPEG + inputs + ["-filter_complex", scaled + "".join(f"[s{i}]" for i in range(len(images))) +
                           f"xstack=inputs={len(images)}:layout={layout}:fill=black[o]", "-map", "[o]", "-q:v", "3", str(out)])
    return out


def side_by_side(a: Path, b: Path, out: Path) -> Path:
    run(FFMPEG + ["-i", str(a), "-i", str(b), "-filter_complex", "[0:v]scale=540:960[l];[1:v]scale=540:960[r];[l][r]hstack=inputs=2[o]",
                  "-map", "[o]", "-q:v", "3", str(out)])
    return out


def build(a_video: Path, b_video: Path, out: Path, n: int = 12, a_name: str = "original", b_name: str = "new",
          extra: dict | None = None) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    fa = frames(a_video, out / "frames" / a_name, n, a_name)
    fb = frames(b_video, out / "frames" / b_name, n, b_name)
    res = {"contact_sheet_" + a_name: str(sheet(fa, out / f"contact_sheet_{a_name}.jpg", 6, a_name)),
           "contact_sheet_" + b_name: str(sheet(fb, out / f"contact_sheet_{b_name}.jpg", 6, b_name))}
    sbs = out / "side_by_side"; sbs.mkdir(exist_ok=True)
    res["side_by_side"] = [str(side_by_side(x, y, sbs / f"pair_{i:02d}.jpg")) for i, (x, y) in enumerate(zip(fa, fb))]
    for k, v in (extra or {}).items():
        if v and Path(v).exists():
            shutil.copy2(v, out / k)
    (out / "comparison_index.json").write_text(json.dumps({"a": str(a_video), "b": str(b_video), "frames_per_video": n,
        "sampling": "centre of each of N equal slices of the full runtime", **res}, indent=1))
    return res
