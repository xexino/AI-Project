"""New-story pre-production: phrase-once on-screen text rules, caption hiding, beat table, continuous-world timeline
params, hyphenated-compound alignment, TTS pronunciation overrides, low-cost animatic, and the 003 pilot project."""
import json
import shutil
import subprocess
from argparse import Namespace

import pytest

from conftest import ROOT, needs_ffmpeg
from engine.cli import build_context, cmd_beats, cmd_produce
from engine.editorial_rules import beat_rows, check_phrase_once, spoken_numbers, voiced_indices
from engine.providers.align import align_to_script
from engine.stages.captions import build_ass, build_srt_vtt, caption_chunks, chunk_words
from engine.stages.visuals import scene_timeline

BRAND = {"palette": {}, "caption_style": {}}
FMT = {"width": 1080, "height": 1920}


def tl_for(scenes: dict[str, str]) -> dict:
    """Synthetic timeline: one word every 0.3 s, scenes back to back."""
    t, segs, words = 0.0, [], []
    for sid, text in scenes.items():
        start = t
        for w in text.split():
            words.append({"word": w, "scene": sid, "start": round(t, 3), "end": round(t + 0.25, 3), "matched": True}); t += 0.3
        t += 0.4
        segs.append({"id": sid, "start": round(start, 3), "slot": round(t - start, 3), "clip": round(t - start, 3)})
    return {"fps": 24, "duration": round(t, 3), "scenes": segs, "words": words}


def test_spoken_numbers():
    assert spoken_numbers("measured at about ten thousand nine hundred thirty-five metres.".split()) == {10935}
    assert spoken_numbers("more than a thousand times".split()) == {1000}
    assert spoken_numbers("at eight thousand three hundred thirty-six metres,".split()) == {8336}
    assert spoken_numbers("one hundred and fifty".split()) == {150}
    assert spoken_numbers("the ocean seems to have no end".split()) == set()


def test_phrase_once_flags_restatement_and_accepts_declared_voices():
    tl = tl_for({"a": "This is Challenger Deep, measured at about ten thousand nine hundred thirty-five metres."})
    data = {"scenes": [{"id": "a", "text": "x", "hero": "basin"}], "editorial_rules": {"phrase_once": True, "one_hero_per_beat": True}}
    data["overlays"] = [{"type": "big", "text": "CHALLENGER DEEP", "at": {"word": "challenger", "scene": "a"}, "until": {"word": "measured", "scene": "a"}},
                        {"type": "big", "text": "10,935 m", "at": {"word": "ten", "scene": "a"}, "until": {"t": 9}}]
    probs = check_phrase_once(data, tl)
    assert len(probs) == 2 and all("declares no 'voices'" in p for p in probs)
    data["overlays"][0]["voices"] = {"scene": "a", "text": "Challenger Deep"}
    data["overlays"][1]["voices"] = {"scene": "a", "text": "ten thousand nine hundred thirty-five metres"}
    assert check_phrase_once(data, tl) == []
    data["overlays"][1]["voices"] = {"scene": "a", "text": "thirty-five metres"}          # number shown outside its phrase
    assert any("numbers outside" in p for p in check_phrase_once(data, tl))


def test_phrase_once_partial_words_simultaneous_titles_and_hero():
    tl = tl_for({"a": "in another Pacific trench.", "b": "Our maps are still incomplete."})
    data = {"scenes": [{"id": "a", "text": "x", "hero": "fish"}, {"id": "b", "text": "y"}], "editorial_rules": {"phrase_once": True, "one_hero_per_beat": True},
            "overlays": [{"type": "big", "text": "Izu-Ogasawara Trench", "voices": {"scene": "a", "text": "Pacific"}, "at": {"t": 0}, "until": {"t": 2}},
                         {"type": "big", "text": "STILL BEING EXPLORED", "at": {"word": "maps", "scene": "b"}, "until": {"t": 9}},
                         {"type": "big", "text": "STILL BEING EXPLORED", "at": {"t": 1}, "until": {"t": 1.5}}]}
    probs = check_phrase_once(data, tl)
    assert any("outside its 'voices'" in p and "trench" in p for p in probs)             # 'trench' spoken but not in voices
    assert any("repeats overlay" in p for p in probs)
    assert any("same time" in p for p in probs)
    assert any("scene b" in p and "hero" in p for p in probs)
    assert not any("overlay 1 " in p and "declares no" in p for p in probs)             # partial overlap is not a restatement


def test_voiced_words_hidden_from_burned_captions_but_kept_in_sidecars():
    tl = tl_for({"a": "This is Challenger Deep, inside the Mariana Trench."})
    ovs = [{"type": "big", "text": "CHALLENGER DEEP", "voices": {"scene": "a", "text": "Challenger Deep"}, "size": 104,
            "at": {"word": "challenger", "scene": "a"}, "until": {"t": 3}}]
    hidden = voiced_indices(tl, ovs)
    assert [tl["words"][i]["word"] for i in sorted(hidden)] == ["Challenger", "Deep,"]
    shown = " ".join(w["word"] for c in caption_chunks(tl, hidden) for w in c)
    assert "Challenger" not in shown and shown.startswith("This is") and "Mariana" in shown
    ass = build_ass(tl, BRAND, ovs, FMT)
    assert "\\fs104" in ass and ass.count("CHALLENGER DEEP") == 1
    srt, _ = build_srt_vtt(tl)
    assert "Challenger" in srt and "Deep," in srt                                        # accessibility sidecar keeps everything


def _base_captions_module():
    """engine/stages/captions.py as it was at the pilot's base commit (fddb328), loaded beside the current package."""
    import importlib.util
    r = subprocess.run(["git", "-C", str(ROOT), "show", "fddb328413f449c4258ea2f087dccb63c030f0b9:engine/stages/captions.py"], capture_output=True, text=True)
    if r.returncode != 0:
        pytest.skip("base commit not available in this checkout")
    spec = importlib.util.spec_from_loader("engine.stages._captions_base", loader=None)
    mod = importlib.util.module_from_spec(spec); mod.__package__ = "engine.stages"
    exec(compile(r.stdout, "captions_base.py", "exec"), mod.__dict__)
    return mod


def test_projects_without_voices_or_size_render_captions_exactly_as_before():
    old = _base_captions_module()
    fix = json.loads((ROOT / "tests" / "fixtures" / "mini" / "project.json").read_text())
    tl = tl_for({"a": "Water boils at one hundred degrees.", "b": "At sea level, that is."})
    assert caption_chunks(tl, voiced_indices(tl, [])) == chunk_words(tl["words"])
    assert build_ass(tl, BRAND, fix["overlays"], FMT) == old.build_ass(tl, BRAND, fix["overlays"], FMT)   # byte-identical
    assert build_srt_vtt(tl) == old.build_srt_vtt(tl)


def test_aligner_maps_hyphenated_compounds_heard_as_separate_words():
    heard = [("near", 0.0, 0.2), ("freezing,", 0.2, 0.5), ("pitch", 0.6, 0.8), ("dark,", 0.8, 1.0), ("under", 1.1, 1.3)]
    out = align_to_script("near-freezing, pitch-dark, under", heard, 1.5)
    assert all(w["matched"] for w in out)
    assert [(w["start"], w["end"]) for w in out] == [(0.0, 0.5), (0.6, 1.0), (1.1, 1.3)]


def test_scene_timeline_gives_global_times():
    tl = tl_for({"a": "one two", "b": "three four"})
    p = scene_timeline(tl, tl["scenes"][1])
    assert p["t0"] == tl["scenes"][1]["start"] and [s["id"] for s in p["scenes"]] == ["a", "b"]
    assert p["words"][2]["word"] == "three" and p["words"][2]["start"] == tl["words"][2]["start"]


def test_kokoro_pronunciation_override():
    from engine.providers.tts import KokoroTTS
    k = KokoroTTS()
    if not (k.model.is_file() and k.voices.is_file()):
        pytest.skip("Kokoro model not installed")
    ph = k.phonemes("Below six thousand metres lies the hadal zone:", "en-gb", {"hadal": "hˈeɪdəl"})
    assert "hˈeɪdəl" in ph and "hˈadəl" not in ph


@needs_ffmpeg
def test_mariana_pilot_rules_and_beat_table(tmp_path):
    """The 003 pilot as committed: valid, references registered, and its on-screen text passes the rules on a
    deterministic mock narration (no model needed)."""
    from engine.project import load, validate
    src = ROOT / "productions" / "003-mariana-trench"
    assert validate(json.loads((src / "project.json").read_text()), src) == []
    d = ROOT / "productions" / "_test_mariana"
    if d.exists():
        shutil.rmtree(d)
    shutil.copytree(src, d, ignore=shutil.ignore_patterns("work", "delivery", "images"))
    try:
        p = json.loads((d / "project.json").read_text())
        p["id"] = "test-mariana"; p["narration"].update(provider="mock", aligner="mock"); p["narration"].pop("pronunciations", None)
        (d / "project.json").write_text(json.dumps(p))
        assert cmd_produce(Namespace(project=str(d), until="timing", force=None, jobs=1, scenes=None, renderer=None, tts=None, aligner=None)) == 0
        rep = json.loads((d / "work" / "references" / "reference_report.json").read_text())
        assert rep["configured"]                                                           # images git-ignored -> warnings only
        tl = json.loads((d / "work" / "timeline.json").read_text())
        assert check_phrase_once(load(d).data, tl) == []
        assert cmd_beats(Namespace(project=str(d), out=None)) == 0
        table = json.loads((d / "work" / "preproduction" / "beat_table.json").read_text())
        assert [r["id"] for r in table["beats"]] == ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "end"]
        b7 = table["beats"][6]
        assert b7["on_screen_text"][0]["text"].startswith("8,336 m") and "Izu-Ogasawara" in b7["on_screen_text"][0]["text"]
        assert "eight" not in b7["captions_shown"]                                         # the number is shown once, as the title
        assert all(r["hero"] for r in table["beats"] if r["narration"])
        assert all(s.get("uses_timeline") and s["module"] == "scenes/ocean_world.js" for s in p["scenes"] if s["id"] != "end")
    finally:
        shutil.rmtree(d, ignore_errors=True)


@needs_ffmpeg
def test_animatic_is_isolated_from_production_frames(mini):
    from engine.animatic import animatic
    assert cmd_produce(Namespace(project=str(mini), until="timing", force=None, jobs=1, scenes=None, renderer=None, tts=None, aligner=None)) == 0
    ctx = build_context(Namespace(project=str(mini), jobs=1, scenes=None, renderer=None, tts=None, aligner=None))
    rep = animatic(ctx, scale=0.5, fps=6)
    v = rep["video"]
    probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height:format=duration", "-of", "json", v],
                                      capture_output=True, text=True).stdout)
    assert (probe["streams"][0]["width"], probe["streams"][0]["height"]) == (108, 192)
    assert abs(float(probe["format"]["duration"]) - json.loads((mini / "work" / "timeline.json").read_text())["duration"]) < 0.25
    assert not (mini / "work" / "frames").exists() and not (mini / "work" / "master").exists()   # production outputs untouched
    rep2 = animatic(ctx, scale=0.5, fps=6)
    assert all(s["cached"] for s in rep2["scenes"].values())                                      # re-run reuses its own frames


def test_assembly_refuses_transitions_past_the_end_of_the_stream():
    """Two consecutive zero-length cuts used to make xfade drop the rest of the video silently."""
    from engine.stages.assemble import build_graph
    from engine.util import EngineError

    class Ctx:
        class project:
            data = {"visual": {"grade": {}}, "sound": {}, "qc": {"loudness_lufs": -14.0}}
        options = {}

    def tl_with(tr):
        scenes, t = [], 0.0
        for i in range(3):
            slot = 2.0
            scenes.append({"id": f"s{i}", "start": t, "slot": slot, "clip": slot + tr["d"], "transition": tr})
            t += slot
        return {"fps": 24, "duration": t, "scenes": scenes, "words": []}
    with pytest.raises(EngineError, match="starts at"):
        build_graph(Ctx(), tl_with({"type": "cut", "d": 0}), [None] * 3, "x.ass", None)
    build_graph(Ctx(), tl_with({"type": "fade", "d": 1 / 24}), [None] * 3, "x.ass", None)        # one-frame fades are fine


@needs_ffmpeg
def test_qc_measures_the_video_stream_not_the_container(tmp_path):
    """A file whose audio is longer than its video must fail the 'video stream covers the timeline' check."""
    from engine.stages.qc import technical_checks
    v = tmp_path / "short_video.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=108x192:r=24:d=2", "-f", "lavfi", "-i", "sine=f=440:d=5",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(v)], check=True)
    tl = {"duration": 5.0, "scenes": [{"id": "a", "start": 0, "slot": 5.0, "clip": 5.0, "transition": {"type": "none", "d": 0}}], "words": []}
    checks, _ = technical_checks(v, tl, {"width": 108, "height": 192, "fps": 24, "aspect_ratio": "9:16"}, {"loudness_lufs": -14.0})
    c = next(c for c in checks if c["check"].startswith("video stream covers"))
    assert not c["pass"] and "2.000s of video" in c["detail"]
