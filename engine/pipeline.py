"""Stage runner: ordered, resumable, fingerprinted production stages.

A stage is skipped ("cached") when its recorded fingerprint matches the current one AND every recorded
output still exists with the recorded hash. The fingerprint covers the stage version, the configuration the
stage reads, and the fingerprints of all upstream stages, so any upstream change makes downstream stages
stale automatically. Outputs are written to temporary files and promoted atomically; a stage is only marked
complete after its outputs are verified, so a crash never leaves a partial file marked as done."""
from __future__ import annotations

import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from . import providers
from .project import Project, relpath
from .state import State
from .util import EngineError, Log, fingerprint, sha256_file


@dataclass
class Context:
    project: Project
    state: State
    log: Log
    budget: providers.BudgetGuard
    options: dict = field(default_factory=dict)
    upstream_fp: str = ""
    _providers: dict = field(default_factory=dict)

    def provider(self, kind: str, default: str, **cfg: Any):
        name = (self.project.data.get("providers") or {}).get(kind) or self.options.get(f"{kind}_provider") or default
        if self.options.get(f"{kind}_provider"):
            name = self.options[f"{kind}_provider"]
        key = (kind, name)
        if key not in self._providers:
            self._providers[key] = providers.get(kind, name, **cfg)
        return self._providers[key]

    def work(self, *parts: str) -> Path:
        p = self.project.work.joinpath(*parts)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p


@dataclass
class Stage:
    name: str
    run: Callable[[Context], dict]          # returns {label: Path | {"dir": Path, "count": int, "fp": str}}
    config: Callable[[Context], Any]        # the configuration this stage depends on
    version: str = "1"
    status_before: str | None = None
    status_after: str | None = None
    retries: int = 0


def _verify_outputs(outputs: dict) -> dict:
    rec = {}
    for label, o in outputs.items():
        if isinstance(o, dict) and "dir" in o:
            d = Path(o["dir"])
            files = sorted(d.glob("f*.png"))
            if len(files) != o["count"] or any(p.suffix == ".tmp" for p in d.iterdir()):
                raise EngineError(f"output '{label}' incomplete: {len(files)}/{o['count']} frames in {d}")
            rec[label] = {"dir": relpath(d), "count": o["count"], "fp": o.get("fp", "")}
        else:
            p = Path(o)
            if not p.is_file() or p.stat().st_size == 0:
                raise EngineError(f"output '{label}' missing or empty: {p}")
            rec[label] = {"file": relpath(p), "sha256": sha256_file(p)}
    return rec


def _outputs_intact(project: Project, rec: dict) -> bool:
    from .util import REPO_DIR
    for o in rec.values():
        if "file" in o:
            p = (REPO_DIR / o["file"]) if not Path(o["file"]).is_absolute() else Path(o["file"])
            if not p.is_file() or sha256_file(p) != o["sha256"]:
                return False
        else:
            d = (REPO_DIR / o["dir"]) if not Path(o["dir"]).is_absolute() else Path(o["dir"])
            if not d.is_dir() or len(list(d.glob("f*.png"))) != o["count"]:
                return False
    return True


def run_stages(ctx: Context, stages: list[Stage], until: str | None = None, force: set[str] | None = None) -> dict:
    force = force or set()
    report = {"stages": [], "started": time.time()}
    upstream = fingerprint("root", ctx.project.id)
    for st in stages:
        cfg = st.config(ctx)
        fp = fingerprint(st.name, st.version, cfg, upstream)
        prev = ctx.state.stage(st.name)
        cached = (prev is not None and prev["status"] == "done" and prev["fingerprint"] == fp
                  and st.name not in force and _outputs_intact(ctx.project, prev["outputs"]))
        if cached:
            ctx.log.info("stage_cached", stage=st.name)
            report["stages"].append({"stage": st.name, "result": "cached", "seconds": 0})
        else:
            if prev and prev["status"] == "done":
                ctx.log.info("stage_stale", stage=st.name, reason="fingerprint or outputs changed")
            if st.status_before:
                ctx.state.set_status(st.status_before, f"stage {st.name}")
            attempt = 0
            while True:
                attempt += 1
                n = ctx.state.begin(st.name, fp)
                ctx.log.info("stage_start", stage=st.name, attempt=n)
                t0 = time.time()
                try:
                    ctx.upstream_fp = upstream
                    outputs = st.run(ctx) or {}
                    rec = _verify_outputs(outputs)
                    ctx.state.complete(st.name, fp, rec, meta={"seconds": round(time.time() - t0, 2)})
                    ctx.log.info("stage_done", stage=st.name, seconds=round(time.time() - t0, 1), outputs=len(rec))
                    report["stages"].append({"stage": st.name, "result": "ran", "seconds": round(time.time() - t0, 1)})
                    break
                except Exception as e:  # noqa: BLE001 - every failure is recorded, then re-raised or retried
                    msg = f"{type(e).__name__}: {e}"
                    ctx.state.fail(st.name, msg + "\n" + traceback.format_exc(limit=4))
                    ctx.log.error("stage_failed", stage=st.name, attempt=n, error=msg)
                    if attempt <= st.retries and not isinstance(e, (providers.BudgetExceeded, providers.ProviderUnavailable)):
                        ctx.log.warn("stage_retry", stage=st.name, next_attempt=attempt + 1)
                        continue
                    ctx.state.set_status("FAILED", f"{st.name}: {msg[:200]}")
                    report["failed"] = st.name
                    report["error"] = msg
                    return report
            if st.status_after:
                ctx.state.set_status(st.status_after, f"stage {st.name}")
        rec = ctx.state.stage(st.name)
        upstream = fingerprint(upstream, rec["fingerprint"], rec["outputs"])
        if until and st.name == until:
            break
    report["finished"] = time.time()
    return report
