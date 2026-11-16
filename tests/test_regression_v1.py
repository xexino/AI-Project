"""The generalized engine must reproduce the v1 Greenland shark captions and filter graph exactly."""
import json
import re

from engine.project import load
from engine import customers
from engine.stages.captions import build_ass
from conftest import FIX, ROOT


def shark():
    p = load(ROOT / "productions" / "001-greenland-shark")
    p.data["brand"] = customers.effective_brand(p.data)
    return p


def test_captions_identical_to_v1():
    p = shark()
    tl = json.loads((FIX / "shark_timeline_v1.json").read_text())
    new = build_ass(tl, p.data["brand"], p.data["overlays"], p.data["format"])
    assert new == (FIX / "shark_captions_v1.ass").read_text(encoding="utf-8")


def test_filter_graph_identical_to_v1(tmp_path, monkeypatch):
    from engine.stages import assemble as asm
    from engine.pipeline import Context
    from engine.state import State
    from engine.providers import BudgetGuard
    from engine.util import Log
    p = shark()
    tl = json.loads((FIX / "shark_timeline_v1.json").read_text())
    st = State(tmp_path / "s.sqlite")
    ctx = Context(project=p, state=st, log=Log(None, quiet=True), budget=BudgetGuard(st, 0))
    clips = [tmp_path / f"{s['id']}.mp4" for s in tl["scenes"]]
    _, chain = asm.build_graph(ctx, tl, clips, tmp_path / "captions.ass", None)
    # file paths and the internal names of cue labels may differ; every filter, parameter and input index may not
    norm = lambda s: re.sub(r"\[(bell1b|bell1|bell2b|bell2|crack|thump|rise|pulse|shimmer|whoosh|boomn|boom|c\d+)\]", "[CUE]",
                            re.sub(r"subtitles=[^:]+:fontsdir=[^,]+", "subtitles=X:fontsdir=F", s))
    new = norm(";\n".join(chain))
    old = norm((FIX / "shark_filter_v1.txt").read_text())
    # v1 joined the bed + sidechain chain with ';' and the generalized engine with ';\n' — compare filter statements
    split = lambda s: [x.strip() for x in s.replace("\n", "").split(";") if x.strip()]
    assert split(new) == split(old)
