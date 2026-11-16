import pytest

from engine import customers
from engine.providers.media import LocalAssets
from engine.stages.package import licensing_problems
from engine.util import EngineError


def test_internal_brand_loads():
    c = customers.load("oddlight")
    assert c["brand"]["endcard"]["tagline"]


def test_secret_detection():
    assert customers.find_secrets({"a": {"api_key": "x"}}) == [".a.api_key"]
    assert customers.find_secrets({"note": "token sk-abcdefghijklmnopqrstuvwx"}) == [".note"]
    assert customers.find_secrets({"api_key": None, "name": "ok"}) == []


def test_asset_isolation(tmp_path):
    proj, cust, other = tmp_path / "p", tmp_path / "c", tmp_path / "o"
    for d in (proj, cust, other):
        d.mkdir()
    (proj / "a.png").write_text("x"); (other / "b.png").write_text("x")
    la = LocalAssets(project_dir=proj, customer_dir=cust)
    assert la.resolve("a.png", proj).name == "a.png"
    with pytest.raises(EngineError, match="outside"):
        la.resolve("../o/b.png", proj)


def test_licensing_rules():
    ok = {"id": "x", "file": "f", "origin": "generated_in_house", "creator": "me", "license": "owned", "commercial_use": True,
          "attribution": "none", "acquired": "2026-01-01", "verification": "generated_in_house"}
    assert licensing_problems([ok]) == []
    assert any("missing" in p for p in licensing_problems([{**ok, "license": ""}]))
    assert any("without verification" in p for p in licensing_problems([{**ok, "verification": "unverified"}]))
    assert any("not cleared" in p for p in licensing_problems([{**ok, "commercial_use": "unknown"}]))
    assert any("source_url" in p for p in licensing_problems([{**ok, "origin": "third_party", "verification": "verified"}]))
