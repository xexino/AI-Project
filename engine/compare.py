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


def scene_sheets(a_dir: Path, b_dir: Path, out: Path, scenes: list[str], fractions=(0.2, 0.55, 0.9), registry=None,
                 scene_refs: dict | None = None) -> list[str]:
    """Per-scene comparison sheets: original frames | enhanced frames at identical frame indices (+ the guiding
    reference adapted to 9:16, when available). Rows = fractions of the scene's duration."""
    out.mkdir(parents=True, exist_ok=True)
    made = []
    for sid in scenes:
        fa, fb = sorted((a_dir / "work" / "frames" / sid).glob("f*.png")), sorted((b_dir / "work" / "frames" / sid).glob("f*.png"))
        if not fa or len(fa) != len(fb):
            continue
        idx = [min(len(fa) - 1, int(len(fa) * f)) for f in fractions]
        inputs, filt = [], []
        for k, i in enumerate(idx):
            inputs += ["-i", str(fa[i]), "-i", str(fb[i])]
        cols = 2
        ref = None
        if registry is not None and scene_refs and scene_refs.get(sid):
            for rid in scene_refs[sid]:
                img = registry.resolve(registry.frame(rid).get("image"))
                if img and img.is_file():
                    ref = (rid, img, registry.frame(rid).get("vertical_guide", {}).get("center_x", 0.5)); break
        n = len(idx)
        parts = []
        for k in range(n):
            parts.append(f"[{2 * k}:v]scale=360:640,drawtext=text='original {sid} f{idx[k]}':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6[a{k}]")
            parts.append(f"[{2 * k + 1}:v]scale=360:640,drawtext=text='reference_v1 {sid} f{idx[k]}':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6[b{k}]")
        if ref:
            inputs += ["-i", str(ref[1])]
            ri = 2 * n
            parts.append(f"[{ri}:v]crop=ih*9/16:ih:max(0\\,min(iw-ih*9/16\\,iw*{ref[2]}-ih*9/32)):0,scale=360:640,"
                         f"drawtext=text='reference {ref[0]} (9\\:16 guide)':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6,split={n}" + "".join(f"[r{k}]" for k in range(n)))
            cols = 3
        rows = []
        for k in range(n):
            parts.append(f"[a{k}][b{k}]" + (f"[r{k}]" if ref else "") + f"hstack=inputs={cols}[row{k}]")
            rows.append(f"[row{k}]")
        parts.append("".join(rows) + f"vstack=inputs={n}[o]")
        o = out / f"scene_{sid}_original_vs_reference_v1.jpg"
        run(FFMPEG + inputs + ["-filter_complex", ";".join(parts), "-map", "[o]", "-q:v", "4", str(o)])
        made.append(str(o))
    return made
