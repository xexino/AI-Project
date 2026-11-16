"""ODDLIGHT production engine CLI.

  python -m engine doctor                                   check dependencies and models
  python -m engine validate  --project productions/<id>     validate project + customer + assets
  python -m engine produce   --project productions/<id>     run (or resume) every stage, QC, package
        [--until STAGE] [--force STAGE ...] [--jobs N] [--scenes s1,s2] [--renderer mock --tts mock --aligner proportional]
  python -m engine status    --project productions/<id>     stage table, status, costs, failures
  python -m engine deliver   --project productions/<id> --confirm "<who>"   mark a DELIVERY_READY package as delivered
  python -m engine queue add|run|status|retry ...           sequential local batch queue (SQLite)
  python -m engine customers                                list customers / brands
  python -m engine dashboard [--out var/dashboard.html]     static HTML overview
  python -m engine compare --a A.mp4 --b B.mp4 --out DIR    visual comparison package (evenly sampled frames)
Publishing is not implemented as an action: packages are prepared for manual upload only."""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from pathlib import Path

from . import customers, providers
from .pipeline import Context, run_stages
from .project import load, relpath, validate
from .state import State
from .util import EngineError, Log, REPO_DIR, atomic_write_json


def open_project(path: str, quiet: bool = False):
    p = load(path)
    brand = customers.effective_brand(p.data)
    p.data["brand"] = brand
    secrets = customers.find_secrets(p.raw)
    if secrets:
        raise EngineError("project.json contains credential-like fields: " + ", ".join(secrets))
    st = State(p.work / "state.sqlite")
    log = Log(p.work / "logs" / "production.jsonl", project=p.id, quiet=quiet)
    return p, st, log


def cmd_doctor(_a) -> int:
    from .providers.render import ThreeRenderer
    ok = True
    def line(good, what, hint=""):
        nonlocal ok
        ok &= bool(good)
        print(("OK   " if good else "MISS ") + what + ("" if good else f"  -> {hint}"))
    line(shutil.which("ffmpeg"), "ffmpeg", "apt install ffmpeg / brew install ffmpeg (>= 6)")
    line(shutil.which("ffprobe"), "ffprobe", "ships with ffmpeg")
    for m, hint in (("numpy", "pip install -r requirements.txt"), ("soundfile", "pip install -r requirements.txt"),
                    ("kokoro_onnx", "optional: needed for the kokoro TTS provider"), ("faster_whisper", "optional: needed for the whisper aligner")):
        try:
            __import__(m); line(True, f"python: {m}")
        except ImportError:
            line(False, f"python: {m}", hint)
    for f in ("kokoro-v1.0.onnx", "voices-v1.0.bin"):
        line((REPO_DIR / "models" / f).is_file(), f"model: models/{f}", "see docs/INSTALL.md")
    for prob in ThreeRenderer().check() or []:
        line(False, "threejs renderer", prob)
    if not ThreeRenderer().check():
        line(True, "threejs renderer (node + three + playwright)")
    return 0 if ok else 1


def cmd_validate(a) -> int:
    try:
        p, st, log = open_project(a.project, quiet=True)
    except EngineError as e:
        print(f"INVALID: {e}"); return 1
    from .stages.package import load_assets, licensing_problems
    probs = licensing_problems(load_assets(p))
    print(f"OK: {p.id} — {len(p.scenes)} scenes, customer '{p.data['customer_id']}', status {st.status}")
    for x in probs:
        print(f"  licensing: {x}")
    return 0


def build_context(a) -> Context:
    p, st, log = open_project(a.project)
    opts = {"jobs": a.jobs}
    for k in ("renderer", "tts", "aligner"):
        if getattr(a, k, None):
            opts[f"{k}_provider"] = getattr(a, k)
    if a.scenes:
        opts["scenes"] = a.scenes.split(",")
    return Context(project=p, state=st, log=log, budget=providers.BudgetGuard(st, p.data["budget"]["max_paid_eur"]), options=opts)


def production_report(ctx: Context, run_report: dict) -> dict:
    st = ctx.state
    stages = st.stages()
    rep = {
        "project": ctx.project.id, "title": ctx.project.data["title"], "customer_id": ctx.project.data["customer_id"],
        "status": st.status, "generated": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "last_run": run_report,
        "stages": [{k: s[k] for k in ("name", "status", "attempts", "seconds", "error")} for s in stages if s],
        "render_seconds_per_scene": st.get("render_seconds", {}),
        "costs": {"paid_eur_actual": st.paid_total(), "ledger": st.costs()},
        "failures": [{"ts": f[0], "stage": f[1], "attempt": f[2], "error": f[3][:500]} for f in st.failures()],
        "status_history": [{"ts": h[0], "from": h[1], "to": h[2], "reason": h[3]} for h in st.history()],
        "publishing": {"enabled": False, "note": "No upload was performed. Publishing is manual and requires explicit authorization."},
    }
    return rep


def cmd_produce(a) -> int:
    from .stages import STAGES, NAMES
    if a.until and a.until not in NAMES:
        print(f"unknown stage '{a.until}' (stages: {', '.join(NAMES)})"); return 2
    try:
        ctx = build_context(a)
    except EngineError as e:
        print(f"ERROR: {e}"); return 1
    ctx.log.info("produce_start", project=relpath(ctx.project.dir), until=a.until or "package")
    rep = run_stages(ctx, STAGES, until=a.until, force=set(a.force or []))
    out = ctx.work("production_report.json")
    atomic_write_json(out, production_report(ctx, rep))
    if rep.get("failed"):
        print(f"FAILED at stage '{rep['failed']}': {rep['error']}\nResume with the same command after fixing the cause.")
        return 1
    print(f"OK: {ctx.project.id} status={ctx.state.status}  report={relpath(out)}")
    return 0


def cmd_status(a) -> int:
    p, st, _ = open_project(a.project, quiet=True)
    print(f"{p.id}  status={st.status}  paid={st.paid_total():.2f} EUR")
    for s in st.stages():
        print(f"  {s['name']:<11} {s['status']:<8} attempts={s['attempts']} {('%.1fs' % s['seconds']) if s['seconds'] else ''} {(s['error'] or '').splitlines()[0][:90] if s['error'] else ''}")
    return 0


def cmd_deliver(a) -> int:
    p, st, log = open_project(a.project, quiet=True)
    if st.status != "DELIVERY_READY":
        print(f"cannot deliver: status is {st.status} (needs DELIVERY_READY)"); return 1
    man = json.loads((p.delivery / "package_manifest.json").read_text())
    if man.get("commercial_delivery_blocked"):
        print("cannot deliver: commercial delivery is blocked: " + "; ".join(man.get("blocking_reasons", []))); return 1
    st.set_status("DELIVERED", f"confirmed by {a.confirm}")
    log.info("delivered", by=a.confirm)
    print(f"{p.id}: DELIVERED (recorded; nothing was uploaded)")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m engine", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("doctor")
    for name in ("validate", "status"):
        sp = sub.add_parser(name); sp.add_argument("--project", required=True)
    sp = sub.add_parser("produce")
    sp.add_argument("--project", required=True); sp.add_argument("--until"); sp.add_argument("--force", nargs="*")
    sp.add_argument("--jobs", type=int, default=2); sp.add_argument("--scenes")
    sp.add_argument("--renderer"); sp.add_argument("--tts"); sp.add_argument("--aligner")
    sp = sub.add_parser("deliver"); sp.add_argument("--project", required=True); sp.add_argument("--confirm", required=True)
    sp = sub.add_parser("queue"); sp.add_argument("action", choices=["add", "run", "status", "retry"])
    sp.add_argument("--project"); sp.add_argument("--max-attempts", type=int, default=2); sp.add_argument("--job", type=int)
    sp.add_argument("--renderer"); sp.add_argument("--tts"); sp.add_argument("--aligner"); sp.add_argument("--jobs", type=int, default=2)
    sub.add_parser("customers")
    sp = sub.add_parser("references"); sp.add_argument("--project", required=True); sp.add_argument("--pin", action="store_true")
    sp = sub.add_parser("compare"); sp.add_argument("--a", required=True); sp.add_argument("--b", required=True)
    sp.add_argument("--out", required=True); sp.add_argument("--n", type=int, default=12)
    sp.add_argument("--a-name", default="original"); sp.add_argument("--b-name", default="new")
    sp = sub.add_parser("dashboard"); sp.add_argument("--out", default=str(REPO_DIR / "var" / "dashboard.html"))
    a = ap.parse_args(argv)
    try:
        if a.cmd == "doctor":
            return cmd_doctor(a)
        if a.cmd == "validate":
            return cmd_validate(a)
        if a.cmd == "produce":
            return cmd_produce(a)
        if a.cmd == "status":
            return cmd_status(a)
        if a.cmd == "deliver":
            return cmd_deliver(a)
        if a.cmd == "queue":
            from .queue import cmd_queue
            return cmd_queue(a)
        if a.cmd == "customers":
            for c in customers.list_customers():
                print(f"{c['id']:<16} {c.get('name', '')}  {c.get('error', '')}")
            return 0
        if a.cmd == "references":
            from .references import load_registry, pin
            p, _, _ = open_project(a.project, quiet=True)
            reg = load_registry(p)
            if reg is None:
                print("no visual references configured"); return 0
            if a.pin:
                print("pinned:", ", ".join(pin(reg)) or "nothing changed")
            rows, warns, errs = reg.check()
            for r in rows:
                print(f"{r['id']:<10} {r.get('image_status', '?'):<13} {r.get('width', '')}x{r.get('height', '')}  scenes={','.join(r['scenes'])}")
            for w in warns:
                print("WARN ", w)
            for e in errs:
                print("ERROR", e)
            return 1 if errs else 0
        if a.cmd == "compare":
            from .compare import build
            res = build(Path(a.a), Path(a.b), Path(a.out), a.n, a.a_name, a.b_name)
            print(json.dumps({k: v for k, v in res.items() if k != "side_by_side"}, indent=1)); return 0
        if a.cmd == "dashboard":
            from .dashboard import write_dashboard
            print(write_dashboard(Path(a.out)))
            return 0
    except EngineError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    return 2
