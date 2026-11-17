"""Monocular depth for stills-2.5D: Depth-Anything-V2-Small (Apache-2.0), CPU. Writes <stem>.depth-<sha12>.png beside the
image (16-bit, near = white) and skips work when a map for that exact image hash already exists (the depth cache).
Run with the separate image environment: ~/aigen-venv/bin/python tools/stills/depth.py IMG [IMG ...]"""
import hashlib, sys
from pathlib import Path


def depth_path(img: Path) -> Path:
    h = hashlib.sha256(img.read_bytes()).hexdigest()[:12]
    return img.with_name(f"{img.stem}.depth-{h}.png")


def main(paths):
    todo = [Path(p) for p in paths if not depth_path(Path(p)).exists()]
    for p in paths:
        print(("cached " if Path(p) not in todo else "compute ") + str(depth_path(Path(p))))
    if not todo:
        return
    import numpy as np
    from PIL import Image
    from transformers import pipeline
    pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf", device="cpu")
    for p in todo:
        im = Image.open(p).convert("RGB")
        d = np.array(pipe(im)["predicted_depth"].squeeze(), dtype=np.float32)
        d = (d - d.min()) / max(1e-6, d.max() - d.min())
        Image.fromarray((d * 65535).astype(np.uint16)).resize(im.size, Image.BICUBIC).save(depth_path(p))


if __name__ == "__main__":
    main(sys.argv[1:])
