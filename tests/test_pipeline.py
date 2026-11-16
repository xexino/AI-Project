"""End-to-end smoke + resume/failure behaviour, using mock providers (no models, no browser)."""
import json
from argparse import Namespace

import pytest

from engine.cli import cmd_produce, build_context
from engine.state import State
from engine.stages.package import verify_package
from conftest import needs_ffmpeg


def produce(d, until=None, force=None):
    return cmd_produce(Namespace(project=str(d), until=until, force=force, jobs=1, scenes=None, renderer=None, tts=None, aligner=None))


def stage(d, name):
    return State(d / "work" / "state.sqlite").stage(name)


@needs_ffmpeg
def test_smoke_full_pipeline(mini):
    assert produce(mini) == 0
    st = State(mini / "work" / "state.sqlite")
    assert st.status == "DELIVERY_READY"
    deliv = mini / "delivery"
    for f in ("final_video.mp4", "cover.png", "subtitles.srt", "subtitles.vtt", "script.md", "sources.json", "publishing_metadata.json",
              "publish_packet.md", "qc_report.json", "production_report.json", "asset_licenses.json", "package_manifest.json"):
        assert (deliv / f).is_file() and (deliv / f).stat().st_size > 0, f
    qc = json.loads((deliv / "qc_report.json").read_text())
    assert qc["all_pass"], [c for c in qc["checks"] if not c["pass"]]
    man = json.loads((deliv / "package_manifest.json").read_text())
    assert man["commercial_delivery_blocked"] is False and man["publishing"].startswith("disabled")
    assert verify_package(deliv) == []
    (deliv / "subtitles.srt").write_text("tampered")
    assert verify_package(deliv) == ["modified/corrupted subtitles.srt"]
    # second run: everything cached
    assert produce(mini) == 0
    rep = json.loads((mini / "work" / "production_report.json").read_text())
    assert all(s["result"] == "cached" for s in rep["last_run"]["stages"]), rep["last_run"]["stages"]


@needs_ffmpeg
def test_resume_only_rerenders_damaged_scene(mini):
    assert produce(mini, until="visuals") == 0
    fa, fb = mini / "work/frames/a", mini / "work/frames/b"
    a_mtime = (fa / "f0000.png").stat().st_mtime
    victim = sorted(fb.glob("f*.png"))[-1]
    victim.unlink()
    (fb / "f0001.png.tmp").write_bytes(b"partial")               # simulated crash leftover
    assert produce(mini, until="visuals") == 0
    assert victim.exists() and not (fb / "f0001.png.tmp").exists()
    assert (fa / "f0000.png").stat().st_mtime == a_mtime           # scene a untouched


@needs_ffmpeg
def test_failure_is_recorded_and_resumable(mini, monkeypatch):
    from engine.providers import render
    calls = {"n": 0}
    real = render.MockRenderer.render

    def flaky(self, **kw):
        calls["n"] += 1
        if kw["module"] == "scenes/b.js":
            raise RuntimeError("GPU fell over")
        return real(self, **kw)
    monkeypatch.setattr(render.MockRenderer, "render", flaky)
    assert produce(mini, until="visuals") == 1
    st = State(mini / "work" / "state.sqlite")
    assert st.status == "FAILED" and stage(mini, "visuals")["status"] == "failed"
    assert any("GPU fell over" in f[3] for f in st.failures())
    assert stage(mini, "visuals")["attempts"] == 2                  # one automatic retry
    monkeypatch.setattr(render.MockRenderer, "render", real)
    assert produce(mini, until="visuals") == 0
    assert stage(mini, "visuals")["status"] == "done"


@needs_ffmpeg
def test_config_change_invalidates_downstream_only(mini):
    assert produce(mini, until="timing") == 0
    narr_fp = stage(mini, "narration")["fingerprint"]
    p = json.loads((mini / "project.json").read_text())
    p["overlays"][0]["text"] = "changed"                          # captions-only change
    (mini / "project.json").write_text(json.dumps(p))
    assert produce(mini, until="timing") == 0
    assert stage(mini, "narration")["fingerprint"] == narr_fp
    p["scenes"][0]["text"] = "Water boils at one hundred degrees Celsius."
    (mini / "project.json").write_text(json.dumps(p))
    assert produce(mini, until="timing") == 0
    assert stage(mini, "narration")["fingerprint"] != narr_fp


def test_paid_provider_blocked_with_zero_budget(mini):
    from engine.providers import register, ProviderInfo
    @register("tts", "pretend-paid")
    class Paid:
        def __init__(self, **_):
            self.info = ProviderInfo("tts", "pretend-paid", paid=True)
        def synthesize(self, *a, **k):
            raise AssertionError("must not be called")
    p = json.loads((mini / "project.json").read_text())
    p["narration"]["provider"] = "pretend-paid"
    (mini / "project.json").write_text(json.dumps(p))
    assert produce(mini, until="narration") == 1
    assert "budget" in State(mini / "work" / "state.sqlite").stage("narration")["error"]


def test_secrets_in_project_are_refused(mini):
    p = json.loads((mini / "project.json").read_text())
    p["providers"] = {"llm": "manual", "api_key": "sk-abcdefghijklmnopqrstuvwxyz"}
    (mini / "project.json").write_text(json.dumps(p))
    with pytest.raises(Exception, match="credential"):
        build_context(Namespace(project=str(mini), jobs=1, scenes=None, renderer=None, tts=None, aligner=None))


@needs_ffmpeg
def test_licensing_gap_blocks_commercial_delivery(mini):
    a = json.loads((mini / "assets.json").read_text())
    a["assets"].append({"id": "mystery-track", "file": "x.mp3", "origin": "third_party", "creator": "?", "license": "", "commercial_use": "unknown"})
    (mini / "assets.json").write_text(json.dumps(a))
    assert produce(mini) == 0
    man = json.loads((mini / "delivery" / "package_manifest.json").read_text())
    assert man["commercial_delivery_blocked"] and any("mystery-track" in r for r in man["blocking_reasons"])
    from engine.cli import cmd_deliver
    assert cmd_deliver(Namespace(project=str(mini), confirm="tester")) == 1


@needs_ffmpeg
def test_batch_queue_isolated_projects(mini, tmp_path):
    import shutil
    from engine import queue
    other = tmp_path / "mini2"
    shutil.copytree(mini, other)
    p = json.loads((other / "project.json").read_text()); p["id"] = "mini-two"
    (other / "project.json").write_text(json.dumps(p))
    db = tmp_path / "q.sqlite"
    j1, j2 = queue.add(str(mini), db=db), queue.add(str(other), db=db)
    res = queue.run_all(db=db, log_print=lambda *_: None)
    assert [r["ok"] for r in res] == [True, True]
    assert {j["status"] for j in queue.jobs(db)} == {"done"}
    assert (mini / "delivery/final_video.mp4").exists() and (other / "delivery/final_video.mp4").exists()
    assert json.loads((other / "delivery/package_manifest.json").read_text())["project"] == "mini-two"


def test_builtin_endcard_receives_brand_params(mini):
    from engine.stages.visuals import scene_params
    ctx = build_context(Namespace(project=str(mini), jobs=1, scenes=None, renderer=None, tts=None, aligner=None))
    end = ctx.project.scene("end")
    p = scene_params(ctx, {**end, "params": {"footer": ["x"]}})
    assert p["tagline"] == "The world is stranger than you were told." and p["footer"] == ["x"]
    assert scene_params(ctx, ctx.project.scene("a")) == {}
