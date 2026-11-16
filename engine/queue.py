"""Sequential local batch queue (SQLite at var/oddlight.sqlite). One job = one project production.
Projects stay isolated: each job runs against its own project directory and state database."""
from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path

from .util import REPO_DIR, EngineError

DB = REPO_DIR / "var" / "oddlight.sqlite"
SCHEMA = """CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, project TEXT, status TEXT, attempts INTEGER DEFAULT 0,
  max_attempts INTEGER, created REAL, started REAL, finished REAL, error TEXT, options TEXT);"""


def connect(db: Path = DB) -> sqlite3.Connection:
    db.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(str(db), timeout=30)
    c.executescript(SCHEMA)
    return c


def add(project: str, max_attempts: int = 2, options: dict | None = None, db: Path = DB) -> int:
    from .project import load
    p = load(project)                                    # validate before queueing
    c = connect(db)
    cur = c.execute("INSERT INTO jobs (project,status,attempts,max_attempts,created,options) VALUES (?,?,?,?,?,?)",
                    (str(p.dir), "queued", 0, max_attempts, time.time(), json.dumps(options or {})))
    c.commit()
    return int(cur.lastrowid)


def jobs(db: Path = DB) -> list[dict]:
    keys = ["id", "project", "status", "attempts", "max_attempts", "created", "started", "finished", "error", "options"]
    return [dict(zip(keys, r)) for r in connect(db).execute(f"SELECT {','.join(keys)} FROM jobs ORDER BY id").fetchall()]


def run_all(db: Path = DB, log_print=print) -> list[dict]:
    """Run queued jobs one at a time until none are left. Failed jobs are retried up to max_attempts."""
    from argparse import Namespace
    from .cli import cmd_produce
    c = connect(db)
    results = []
    while True:
        row = c.execute("SELECT id, project, attempts, max_attempts, options FROM jobs WHERE status='queued' ORDER BY id LIMIT 1").fetchone()
        if not row:
            break
        jid, project, attempts, max_attempts, options = row
        opts = json.loads(options or "{}")
        c.execute("UPDATE jobs SET status='running', started=?, attempts=? WHERE id=?", (time.time(), attempts + 1, jid)); c.commit()
        log_print(f"[queue] job {jid}: {project} (attempt {attempts + 1}/{max_attempts})")
        ns = Namespace(project=project, until=None, force=None, jobs=opts.get("jobs", 1), scenes=None,
                       renderer=opts.get("renderer"), tts=opts.get("tts"), aligner=opts.get("aligner"))
        try:
            rc = cmd_produce(ns)
            err = None if rc == 0 else "production failed (see project work/production_report.json)"
        except EngineError as e:
            rc, err = 1, str(e)
        if rc == 0:
            c.execute("UPDATE jobs SET status='done', finished=?, error=NULL WHERE id=?", (time.time(), jid))
        elif attempts + 1 < max_attempts:
            c.execute("UPDATE jobs SET status='queued', error=? WHERE id=?", (err, jid))
        else:
            c.execute("UPDATE jobs SET status='failed', finished=?, error=? WHERE id=?", (time.time(), err, jid))
        c.commit()
        results.append({"job": jid, "project": project, "ok": rc == 0, "error": err})
    return results


def retry(job_id: int, db: Path = DB) -> None:
    c = connect(db)
    c.execute("UPDATE jobs SET status='queued', attempts=0, error=NULL WHERE id=? AND status='failed'", (job_id,)); c.commit()


def cmd_queue(a) -> int:
    if a.action == "add":
        if not a.project:
            print("--project is required"); return 2
        opts = {k: getattr(a, k) for k in ("renderer", "tts", "aligner", "jobs") if getattr(a, k, None)}
        print(f"queued job {add(a.project, a.max_attempts, opts)}"); return 0
    if a.action == "run":
        res = run_all()
        print(f"{sum(r['ok'] for r in res)}/{len(res)} jobs succeeded"); return 0 if all(r["ok"] for r in res) else 1
    if a.action == "retry":
        retry(a.job); print(f"job {a.job} re-queued"); return 0
    for j in jobs():
        print(f"{j['id']:>4} {j['status']:<8} {j['attempts']}/{j['max_attempts']}  {j['project']}  {(j['error'] or '')[:80]}")
    return 0
