"""stills-2.5D v1: depth-map cache, the stills renderer (real render through the headless three.js host) and plain captions."""
import importlib.util
import shutil
import subprocess
from pathlib import Path

import pytest

from conftest import ROOT, needs_ffmpeg

spec = importlib.util.spec_from_file_location("depth_tool", ROOT / "tools" / "stills" / "depth.py")
depth_tool = importlib.util.module_from_spec(spec); spec.loader.exec_module(depth_tool)
HAS_BROWSER = shutil.which("node") is not None and (ROOT / "engine" / "three" / "node_modules" / "three").is_dir()


def make(path: Path, src: str, size="96x64"):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"{src}=s={size}:d=1", "-frames:v", "1", str(path)], check=True)


@needs_ffmpeg
def test_depth_cache_is_keyed_by_image_hash_and_skips_existing(tmp_path, capsys):
    img = tmp_path / "a.jpg"; make(img, "testsrc2")
    p = depth_tool.depth_path(img)
    assert p.parent == img.parent and p.name.startswith("a.depth-") and len(p.stem.split("-")[-1]) == 12
    p.write_bytes(b"cached")                                           # present -> main must not load the model at all
    depth_tool.main([str(img)])
    assert "cached" in capsys.readouterr().out and p.read_bytes() == b"cached"
    make(img, "testsrc2", "100x64")                                    # a changed image gets a different cache key
    assert depth_tool.depth_path(img) != p


@needs_ffmpeg
@pytest.mark.skipif(not HAS_BROWSER, reason="node/three.js not installed")
def test_stills_renderer_renders_deterministically_with_lifted_blacks(tmp_path):
    import base64, json
    proj = tmp_path / "proj"; (proj / "scenes").mkdir(parents=True)
    make(proj / "img.png", "testsrc2", "192x128"); make(proj / "dep.png", "gradients", "192x128")
    (proj / "scenes" / "s.js").write_text("import { buildStill } from 'oddlight/stills.js';\nexport async function build(a) { return buildStill(a); }\n")
    prm = base64.b64encode(json.dumps({"image": "img.png", "depth": "dep.png", "camera": {"move": "push", "amount": 0.03, "handheld": 1}, "subframes": 2}).encode()).decode()
    outs = []
    for k in range(2):
        out = tmp_path / f"o{k}"
        subprocess.run(["node", str(ROOT / "engine/three/render.mjs"), "--module", "/project/scenes/s.js", "--project", str(proj), "--dur", "1", "--fps", "24",
                        "--w", "72", "--h", "128", "--out", str(out), "--frames", "0,12", "--params", prm], check=True, capture_output=True, timeout=300)
        outs.append([(out / f"f{i:04d}.png").read_bytes() for i in (0, 12)])
    assert outs[0] == outs[1]                                           # same params -> identical frames (resume/fingerprint safe)
    assert outs[0][0] != outs[0][1]                                     # the camera moves / grain changes over time
    st = subprocess.run(["ffprobe", "-v", "error", "-f", "lavfi", "-i", f"movie={tmp_path / 'o0' / 'f0000.png'},format=gray,signalstats",
                         "-show_entries", "frame_tags=lavfi.signalstats.YMIN", "-of", "csv=p=0"], capture_output=True, text=True).stdout.strip()
    assert int(float(st.splitlines()[0])) >= 3                         # lifted blacks: never 0 anywhere


def test_plain_captions_have_no_word_highlight():
    from engine.stages.captions import build_ass
    tl = {"duration": 3.0, "scenes": [], "words": [{"word": w, "scene": "a", "start": i * 0.4, "end": i * 0.4 + 0.3} for i, w in enumerate("the reef grows in the dark".split())]}
    plain = [l for l in build_ass(tl, {"palette": {}, "caption_style": {}}, [], {"width": 1080, "height": 1920}, plain=True).splitlines() if ",Cap," in l]
    karaoke = [l for l in build_ass(tl, {"palette": {}, "caption_style": {}}, [], {"width": 1080, "height": 1920}).splitlines() if ",Cap," in l]
    assert plain and all("\\c&" not in l for l in plain) and len(plain) < len(karaoke)
