"""Persistent production state (SQLite, one database per project: <project>/work/state.sqlite).

Records stage completions with input fingerprints and output hashes (resume / staleness detection),
the project lifecycle status with its history, a cost ledger and failure log."""
from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any

from .util import EngineError

STATUSES = ["DRAFT", "RESEARCHING", "SCRIPT_READY", "PRODUCING", "RENDERING", "QC_PENDING", "QC_PASSED",
            "DELIVERY_READY", "DELIVERED", "FAILED"]
# allowed transitions (FAILED can be entered from anywhere; a failed project can be resumed)
_ORDER = {s: i for i, s in enumerate(STATUSES[:-1])}


def transition_allowed(old: str, new: str) -> bool:
    if new == "FAILED":
        return True
    if old == "FAILED":
        return new in ("DRAFT", "RESEARCHING", "SCRIPT_READY", "PRODUCING", "RENDERING", "QC_PENDING")
    if new == "DELIVERED":
        return old == "DELIVERY_READY"
    if old == "DELIVERED":
        return False
    # forward moves, or going back to re-produce after a configuration change
    return new in _ORDER


SCHEMA = """
CREATE TABLE IF NOT EXISTS stages (name TEXT PRIMARY KEY, status TEXT, fingerprint TEXT, outputs TEXT,
  attempts INTEGER DEFAULT 0, started REAL, finished REAL, seconds REAL, error TEXT, meta TEXT);
CREATE TABLE IF NOT EXISTS status_history (ts REAL, old TEXT, new TEXT, reason TEXT);
CREATE TABLE IF NOT EXISTS costs (ts REAL, stage TEXT, provider TEXT, model TEXT, units REAL, unit TEXT,
  paid INTEGER, estimated_eur REAL, actual_eur REAL, note TEXT);
CREATE TABLE IF NOT EXISTS failures (ts REAL, stage TEXT, attempt INTEGER, error TEXT);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
"""


class State:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.db = sqlite3.connect(str(path), timeout=30)
        self.db.executescript(SCHEMA)
        self.db.commit()

    # ---- key/value
    def get(self, k: str, default: Any = None) -> Any:
        r = self.db.execute("SELECT v FROM kv WHERE k=?", (k,)).fetchone()
        return json.loads(r[0]) if r else default

    def put(self, k: str, v: Any) -> None:
        self.db.execute("INSERT OR REPLACE INTO kv VALUES (?,?)", (k, json.dumps(v)))
        self.db.commit()

    # ---- lifecycle
    @property
    def status(self) -> str:
        return self.get("status", "DRAFT")

    def set_status(self, new: str, reason: str = "") -> None:
        if new not in STATUSES:
            raise EngineError(f"unknown status {new}")
        old = self.status
        if old == new:
            return
        if not transition_allowed(old, new):
            raise EngineError(f"status transition {old} -> {new} is not allowed")
        self.db.execute("INSERT INTO status_history VALUES (?,?,?,?)", (time.time(), old, new, reason))
        self.put("status", new)

    def history(self) -> list[tuple]:
        return self.db.execute("SELECT ts, old, new, reason FROM status_history ORDER BY ts").fetchall()

    # ---- stages
    def stage(self, name: str) -> dict | None:
        r = self.db.execute("SELECT name,status,fingerprint,outputs,attempts,started,finished,seconds,error,meta FROM stages WHERE name=?", (name,)).fetchone()
        if not r:
            return None
        keys = ["name", "status", "fingerprint", "outputs", "attempts", "started", "finished", "seconds", "error", "meta"]
        d = dict(zip(keys, r))
        d["outputs"] = json.loads(d["outputs"] or "{}")
        d["meta"] = json.loads(d["meta"] or "{}")
        return d

    def stages(self) -> list[dict]:
        return [self.stage(n) for (n,) in self.db.execute("SELECT name FROM stages ORDER BY started").fetchall()]

    def begin(self, name: str, fp: str) -> int:
        prev = self.stage(name)
        attempts = (prev["attempts"] if prev else 0) + 1
        self.db.execute("INSERT OR REPLACE INTO stages (name,status,fingerprint,outputs,attempts,started,finished,seconds,error,meta) VALUES (?,?,?,?,?,?,?,?,?,?)",
                        (name, "running", fp, json.dumps(prev["outputs"] if prev else {}), attempts, time.time(), None, None, None, json.dumps(prev["meta"] if prev else {})))
        self.db.commit()
        return attempts

    def complete(self, name: str, fp: str, outputs: dict, meta: dict | None = None) -> None:
        st = self.stage(name)
        started = st["started"] if st else time.time()
        now = time.time()
        self.db.execute("UPDATE stages SET status='done', fingerprint=?, outputs=?, finished=?, seconds=?, error=NULL, meta=? WHERE name=?",
                        (fp, json.dumps(outputs), now, now - started, json.dumps(meta or {}), name))
        self.db.commit()

    def fail(self, name: str, error: str) -> None:
        st = self.stage(name)
        self.db.execute("UPDATE stages SET status='failed', error=?, finished=? WHERE name=?", (error[-4000:], time.time(), name))
        self.db.execute("INSERT INTO failures VALUES (?,?,?,?)", (time.time(), name, st["attempts"] if st else 0, error[-4000:]))
        self.db.commit()

    def invalidate(self, name: str) -> None:
        self.db.execute("UPDATE stages SET status='stale' WHERE name=?", (name,))
        self.db.commit()

    def failures(self) -> list[tuple]:
        return self.db.execute("SELECT ts, stage, attempt, error FROM failures ORDER BY ts").fetchall()

    # ---- costs
    def add_cost(self, stage: str, provider: str, model: str, units: float, unit: str, paid: bool,
                 estimated_eur: float = 0.0, actual_eur: float = 0.0, note: str = "") -> None:
        self.db.execute("INSERT INTO costs VALUES (?,?,?,?,?,?,?,?,?,?)",
                        (time.time(), stage, provider, model, units, unit, int(paid), estimated_eur, actual_eur, note))
        self.db.commit()

    def costs(self) -> list[dict]:
        keys = ["ts", "stage", "provider", "model", "units", "unit", "paid", "estimated_eur", "actual_eur", "note"]
        return [dict(zip(keys, r)) for r in self.db.execute("SELECT * FROM costs ORDER BY ts").fetchall()]

    def paid_total(self) -> float:
        r = self.db.execute("SELECT COALESCE(SUM(actual_eur),0) FROM costs WHERE paid=1").fetchone()
        return float(r[0])

    def close(self) -> None:
        self.db.close()
