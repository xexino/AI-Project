"""Visual-reference system: registry validation, hashing, invalidation, experiments with scene_root + frame reuse."""
import json
import shutil
import subprocess
from argparse import Namespace

import pytest

from engine.cli import build_context, cmd_produce
from engine.references import Registry, load_registry, pin
from engine.util import EngineError
from conftest import ROOT, needs_ffmpeg


def make_image(path, w=64, h=36, color="red"):
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", f"color={color}:s={w}x{h}", "-frames:v", "1", str(path)], check=True)


def registry(tmp_path, frames):
    d = tmp_path / "proj" / "references"
    d.mkdir(parents=True, exist_ok=True)
    (d / "meta.json").write_text("{}")
    data = {"schema": "oddlight-references/1", "frames": frames}
    (d / "references.json").write_text(json.dumps(data))
    return Registry(d / "references.json", data, tmp_path / "proj")


def frame(fid="f1", image="img/f1.png", **kw):
    return {"id": fid, "image": image, "metadata": "meta.json", "scenes": ["a"], "palette": ["#112233"], "vertical_guide": {"center_x": 0.5}, **kw}


@needs_ffmpeg
def test_valid_registry_and_pinning(tmp_path):
    reg = registry(tmp_path, [frame()])
    make_image(reg.base / "img" / "f1.png")
    rows, warns, errs = reg.check()
    assert not errs and not warns and rows[0]["image_status"] == "present" and rows[0]["width"] == 64
    assert pin(reg) == ["f1"] and pin(reg) == []                         # second pin: nothing changed
    make_image(reg.base / "img" / "f1.png", color="blue")                 # image replaced after pinning
    assert any("changed since it was pinned" in e for e in reg.check()[2])


@needs_ffmpeg
def test_missing_optional_image_warns_required_errors(tmp_path):
    reg = registry(tmp_path, [frame(), frame("f2", "img/nope.png", required=True), frame("f3", None)])
    make_image(reg.base / "img" / "f1.png")
    rows, warns, errs = reg.check()
    assert any("f2" in e and "missing" in e for e in errs)
    assert any("f3" in w for w in warns)
    assert {r["id"]: r["image_status"] for r in rows} == {"f1": "present", "f2": "missing", "f3": "not_specified"}


def test_path_escape_and_corrupt_image(tmp_path):
    reg = registry(tmp_path, [frame("bad", "../../../etc/passwd")])
    assert any("escapes" in e for e in reg.check()[2])
    reg2 = registry(tmp_path, [frame("c", "img/corrupt.png")])
    (reg2.base / "img").mkdir(parents=True, exist_ok=True)
    (reg2.base / "img" / "corrupt.png").write_bytes(b"not an image")
    assert any("not a readable image" in e for e in reg2.check()[2])


@needs_ffmpeg
def test_fingerprint_changes_with_image_and_metadata_only_for_that_frame(tmp_path):
    reg = registry(tmp_path, [frame(), frame("f2", "img/f2.png")])
    make_image(reg.base / "img" / "f1.png"); make_image(reg.base / "img" / "f2.png")
    a1, b1 = reg.fingerprint_parts(["f1"]), reg.fingerprint_parts(["f2"])
    assert reg.fingerprint_parts(["f1"]) == a1                           # deterministic
    make_image(reg.base / "img" / "f1.png", color="green")
    assert reg.fingerprint_parts(["f1"]) != a1 and reg.fingerprint_parts(["f2"]) == b1
    (reg.base / "meta.json").write_text('{"changed": true}')
    assert reg.fingerprint_parts(["f2"]) != b1                           # metadata is a dependency too


def test_tunguska_registry_and_experiment_are_valid():
    from engine.project import load
    exp = load(ROOT / "productions/002-tunguska/experiments/visual-reference-v1")
    assert exp.scene_dir == (ROOT / "productions/002-tunguska").resolve()
    reg = load_registry(exp)
    assert set(reg.frames) == {f"frame_0{i}" for i in range(1, 9)}
    assert reg.frames["frame_08"]["status"] == "pending_quota"
    orig = load(ROOT / "productions/002-tunguska")
    assert load_registry(orig) is None and all("references" not in s for s in orig.scenes)   # original untouched


def test_scene_root_must_be_a_production(tmp_path):
    from engine.project import validate
    d = {"id": "x1", "title": "t", "topic": "t", "customer_id": "oddlight", "scene_root": "../../../..",
         "format": {"aspect_ratio": "9:16", "width": 1080, "height": 1920, "fps": 24}, "scenes": [{"id": "a", "text": "", "module": "builtin:endcard"}]}
    (tmp_path / "p").mkdir()
    assert any("scene_root" in p for p in validate(d, tmp_path / "p"))


@needs_ffmpeg
def test_experiment_reuses_base_frames_and_passes_reference_params(mini, tmp_path):
    # base production (no references) -> renders all scenes
    base = ROOT / "productions" / "_test_base_mini"
    if base.exists():
        shutil.rmtree(base)
    shutil.copytree(mini, base)
    try:
        assert cmd_produce(Namespace(project=str(base), until="visuals", force=None, jobs=1, scenes=None, renderer=None, tts=None, aligner=None)) == 0
        exp = base / "experiments" / "ref"
        exp.mkdir(parents=True)
        make_image(base / "references" / "img" / "r1.png")
        (base / "references" / "meta.json").write_text("{}")
        (base / "references" / "references.json").write_text(json.dumps({"schema": "oddlight-references/1", "frames": [
            {"id": "r1", "image": "img/r1.png", "metadata": "meta.json", "scenes": ["a"], "palette": ["#3a3b2f"], "vertical_guide": {"center_x": 0.4}},
            {"id": "r2", "image": "img/missing.png", "metadata": "meta.json", "scenes": ["a"]}]}))
        p = json.loads((base / "project.json").read_text())
        p.update(id="mini-ref-exp", scene_root="../..", references="../../references/references.json")
        p["visual"].update(look="reference_v1", reuse_frames_from=["../.."])
        p["scenes"][0]["references"] = ["r1", "r2"]
        (exp / "project.json").write_text(json.dumps(p)); shutil.copy(base / "assets.json", exp / "assets.json")
        assert cmd_produce(Namespace(project=str(exp), until="visuals", force=None, jobs=1, scenes=None, renderer=None, tts=None, aligner=None)) == 0
        log = (exp / "work" / "logs" / "production.jsonl").read_text()
        assert '"scene_reused", "project": "mini-ref-exp", "scene": "b"' in log      # unchanged scene reused from base
        assert '"scene": "a"' in log and '"scene_reused", "project": "mini-ref-exp", "scene": "a"' not in log  # referenced scene re-rendered
        rep = json.loads((exp / "work" / "references" / "reference_report.json").read_text())
        assert rep["configured"] and any("r2" in w for w in rep["warnings"]) and rep["vertical_guides"] == ["r1_9x16.jpg"]
        from engine.stages.visuals import scene_params
        ctx = build_context(Namespace(project=str(exp), jobs=1, scenes=None, renderer=None, tts=None, aligner=None))
        prm = scene_params(ctx, ctx.project.scene("a"))
        assert prm["look"] == "reference_v1" and prm["refs"]["r1"]["palette"] == ["#3a3b2f"]
        assert scene_params(ctx, ctx.project.scene("b")) == {}                # unreferenced scenes get no look
    finally:
        shutil.rmtree(base, ignore_errors=True)


@needs_ffmpeg
def test_audio_from_requires_identical_timeline(mini, tmp_path):
    from engine.stages.assemble import audio_from_master
    base = ROOT / "productions" / "_test_audio_base"
    if base.exists():
        shutil.rmtree(base)
    shutil.copytree(mini, base)
    try:
        assert cmd_produce(Namespace(project=str(base), until="assemble", force=None, jobs=1, scenes=None, renderer=None, tts=None, aligner=None)) == 0
        exp = base / "experiments" / "a"; exp.mkdir(parents=True)
        p = json.loads((base / "project.json").read_text()); p.update(id="mini-audio-exp", scene_root="../..")
        p["sound"]["audio_from"] = "../.."; p["visual"]["reuse_frames_from"] = ["../.."]
        (exp / "project.json").write_text(json.dumps(p)); shutil.copy(base / "assets.json", exp / "assets.json")
        assert cmd_produce(Namespace(project=str(exp), until="assemble", force=None, jobs=1, scenes=None, renderer=None, tts=None, aligner=None)) == 0
        def audio_md5(v):
            return subprocess.run(["ffmpeg", "-v", "error", "-i", str(v), "-map", "0:a", "-c", "copy", "-f", "md5", "-"], capture_output=True, text=True).stdout
        assert audio_md5(exp / "work/master/mini-audio-exp_master.mp4") == audio_md5(base / "work/master/mini-fixture_master.mp4")
        ctx = build_context(Namespace(project=str(exp), jobs=1, scenes=None, renderer=None, tts=None, aligner=None))
        tl = json.loads((exp / "work/timeline.json").read_text()); tl["duration"] += 1
        with pytest.raises(EngineError, match="timeline differs"):
            audio_from_master(ctx, tl)
    finally:
        shutil.rmtree(base, ignore_errors=True)
