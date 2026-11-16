import json

import pytest

from engine.project import load, validate
from engine.util import EngineError
from conftest import ROOT


def base(**over):
    d = {"id": "p1", "title": "T", "topic": "x", "customer_id": "oddlight",
         "format": {"aspect_ratio": "9:16", "width": 1080, "height": 1920, "fps": 24},
         "scenes": [{"id": "a", "text": "Hi.", "module": "builtin:endcard", "claims": ["c1"]}],
         "sources": [{"id": "s", "citation": "c", "url": "https://x.org"}],
         "claims": [{"id": "c1", "text": "t", "sources": ["s"], "status": "verified"}]}
    d.update(over)
    return d


def test_both_productions_are_valid():
    for p in ("001-greenland-shark", "002-tunguska"):
        proj = load(ROOT / "productions" / p)
        assert proj.id == p and proj.scenes[-1]["module"] == "builtin:endcard"


def test_valid_minimal():
    assert validate(base()) == []


@pytest.mark.parametrize("change,needle", [
    ({"id": "Bad Id"}, "project.id"),
    ({"format": {"aspect_ratio": "16:9", "width": 1080, "height": 1920, "fps": 24}}, "aspect_ratio"),
    ({"format": {"aspect_ratio": "9:16", "width": 1080, "height": 1920, "fps": 0}}, "format.fps"),
    ({"scenes": []}, "at least one scene"),
    ({"claims": [{"id": "c1", "text": "t", "sources": ["nope"]}]}, "unknown source"),
    ({"sources": [{"id": "s", "citation": "c", "url": "ftp://x"}]}, "http(s)"),
    ({"publishing": {"enabled": True}}, "authorized_by"),
    ({"budget": {"max_paid_eur": -1}}, "max_paid_eur"),
])
def test_validation_errors(change, needle):
    probs = validate(base(**change))
    assert any(needle in p for p in probs), probs


def test_unknown_claim_and_transition():
    d = base(scenes=[{"id": "a", "text": "x", "module": "builtin:endcard", "claims": ["zz"], "transition_out": {"type": "spin"}},
                     {"id": "b", "text": "", "module": "builtin:endcard"}])
    probs = validate(d)
    assert any("unknown claim" in p for p in probs) and any("transition_out" in p for p in probs)


def test_scene_module_must_exist(tmp_path):
    d = base(scenes=[{"id": "a", "text": "x", "module": "scenes/missing.js"}])
    (tmp_path / "project.json").write_text(json.dumps(d))
    with pytest.raises(EngineError, match="scene module not found"):
        load(tmp_path)


def test_scene_module_cannot_escape_project(tmp_path):
    (tmp_path / "proj").mkdir()
    (tmp_path / "evil.js").write_text("//")
    d = base(scenes=[{"id": "a", "text": "x", "module": "../evil.js"}])
    (tmp_path / "proj" / "project.json").write_text(json.dumps(d))
    with pytest.raises(EngineError, match="inside the project"):
        load(tmp_path / "proj")


def test_every_repo_json_parses():
    for f in ROOT.glob("**/*.json"):
        if any(part in f.parts for part in ("node_modules", ".venv", "work", "delivery", "build", "baseline", "var")):
            continue
        json.loads(f.read_text(encoding="utf-8"))
