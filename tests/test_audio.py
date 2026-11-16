import json

import pytest

from engine.stages.audio import resolve_at, sfx_spec, note_hz, synth_score, SFX
from engine.util import EngineError
from conftest import FIX


TL = json.loads((FIX / "shark_timeline_v1.json").read_text())


def test_anchors():
    assert resolve_at({"t": 1.5, "offset": 0.5}, TL) == 2.0
    s7 = next(s for s in TL["scenes"] if s["id"] == "s7")["start"]
    assert resolve_at({"scene_start": "s7", "offset": -0.4}, TL) == pytest.approx(s7 - 0.4)
    walk = next(w for w in TL["words"] if w["word"].startswith("walk"))["start"]
    assert resolve_at({"word": "walk", "scene": "s3", "offset": 0.1}, TL) == pytest.approx(walk + 0.1)
    with pytest.raises(EngineError):
        resolve_at({"word": "nonexistent", "scene": "s3"}, TL)


def test_presets_reproduce_v1_strings():
    assert sfx_spec({"preset": "bell"}, TL) == ("sine=f=1318.51:d=4:r=48000", "volume=0.16,afade=t=out:st=0.03:d=3.6:curve=exp,aecho=0.8:0.7:180|420:0.35|0.2")
    assert sfx_spec({"preset": "whoosh"}, TL)[1] == "bandpass=f=700:w=900,volume=0.4,afade=t=in:d=1.4,afade=t=out:st=1.4:d=0.8"
    clip = next(s for s in TL["scenes"] if s["id"] == "s5")["clip"]
    src, filt = sfx_spec({"preset": "rise", "d": "scene_clip:s5"}, TL)
    assert src == f"aevalsrc='0.06*sin(2*PI*(300*t+60*t*t))':d={clip}:s=48000"
    assert filt == f"afade=t=in:d={clip * 0.6},afade=t=out:st={clip - 0.35}:d=0.35,lowpass=f=2500"


def test_level_scales_volume_and_unknown_preset():
    assert "volume=0.08" in sfx_spec({"preset": "bell", "level": 0.5}, TL)[1]
    with pytest.raises(EngineError, match="unknown sound preset"):
        sfx_spec({"preset": "kazoo"}, TL)
    assert all(len(v) == 3 for v in SFX.values())


def test_score_synth_is_deterministic_and_bounded():
    import numpy as np
    tl = {"duration": 3.0, "scenes": [{"id": "a", "start": 0}], "words": []}
    cfg = {"sections": [{"from": {"t": 0}, "chords": [["A2", "E3"]], "chord_s": 1.5, "level": 0.6}], "hits": [{"at": {"t": 1.0}}], "master_db": -20}
    a, b = synth_score(cfg, tl, sr=8000), synth_score(cfg, tl, sr=8000)
    assert a.shape == (24000, 2) and np.array_equal(a, b) and np.max(np.abs(a)) < 1.0
    assert note_hz("A4") == pytest.approx(440.0)
