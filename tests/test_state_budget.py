import pytest

from engine.providers import BudgetExceeded, BudgetGuard, ProviderInfo, ProviderUnavailable, get
from engine.state import State, transition_allowed
from engine.util import EngineError


def test_status_transitions(tmp_path):
    st = State(tmp_path / "s.sqlite")
    assert st.status == "DRAFT"
    for s in ("RESEARCHING", "SCRIPT_READY", "PRODUCING", "RENDERING", "QC_PENDING", "QC_PASSED", "DELIVERY_READY", "DELIVERED"):
        st.set_status(s)
    assert st.status == "DELIVERED"
    with pytest.raises(EngineError):
        st.set_status("PRODUCING")                       # delivered is final
    assert [h[2] for h in st.history()][-1] == "DELIVERED"


def test_delivered_only_from_delivery_ready():
    assert not transition_allowed("QC_PASSED", "DELIVERED")
    assert transition_allowed("DELIVERY_READY", "DELIVERED")
    assert transition_allowed("RENDERING", "FAILED") and transition_allowed("FAILED", "RENDERING")


def test_stage_records_and_failures(tmp_path):
    st = State(tmp_path / "s.sqlite")
    st.begin("x", "fp1"); st.fail("x", "boom")
    st.begin("x", "fp1"); st.complete("x", "fp1", {"o": {"file": "f", "sha256": "h"}})
    rec = st.stage("x")
    assert rec["status"] == "done" and rec["attempts"] == 2 and len(st.failures()) == 1


def test_budget_guard_refuses_paid_by_default(tmp_path):
    st = State(tmp_path / "s.sqlite")
    g = BudgetGuard(st, 0)
    g.check(ProviderInfo("tts", "kokoro", paid=False), 0)            # free: fine
    with pytest.raises(BudgetExceeded):
        g.check(ProviderInfo("video", "hosted", paid=True), 0.4)
    g2 = BudgetGuard(st, 1.0)
    g2.check(ProviderInfo("video", "hosted", paid=True), 0.4)
    g2.record("visuals", ProviderInfo("video", "hosted", paid=True), 1, "clip", 0.4, 0.4)
    g2.check(ProviderInfo("video", "hosted", paid=True), 0.5)
    with pytest.raises(BudgetExceeded):
        g2.check(ProviderInfo("video", "hosted", paid=True), 0.7)
    assert st.paid_total() == pytest.approx(0.4)


def test_disabled_and_unknown_providers():
    with pytest.raises(ProviderUnavailable):
        get("video", "none").generate("x")
    with pytest.raises(ProviderUnavailable):
        get("llm", "manual").generate("x")
    with pytest.raises(ProviderUnavailable, match="available"):
        get("tts", "does-not-exist")


def test_ollama_request_is_local_and_well_formed():
    import json
    req = get("llm", "ollama", model="m").request("hello")
    assert req.full_url.startswith("http://127.0.0.1") and json.loads(req.data)["prompt"] == "hello"
