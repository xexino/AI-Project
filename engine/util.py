"""Small shared helpers: hashing, atomic writes, subprocess execution, structured logging."""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Iterable

ENGINE_DIR = Path(__file__).resolve().parent
REPO_DIR = ENGINE_DIR.parent


class EngineError(RuntimeError):
    """An error with a message meant for the operator (no traceback needed)."""


def sha256_file(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def fingerprint(*parts: Any) -> str:
    """Stable fingerprint of JSON-serialisable parts (dict keys sorted)."""
    return sha256_text(json.dumps(parts, sort_keys=True, default=str))


def hash_tree(paths: Iterable[Path]) -> str:
    """Fingerprint of several source files (path + content)."""
    h = hashlib.sha256()
    for p in sorted(Path(x) for x in paths):
        h.update(str(p.name).encode())
        h.update(sha256_file(p).encode())
    return h.hexdigest()


def atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def atomic_write_json(path: Path, data: Any) -> None:
    atomic_write_text(path, json.dumps(data, indent=1, ensure_ascii=False) + "\n")


def tmp_path(path: Path) -> Path:
    """Temporary sibling path that keeps the extension (so ffmpeg can infer the format)."""
    return path.with_name(f".tmp-{path.name}")


def commit_file(tmp: Path, final: Path) -> Path:
    """Atomically promote a fully written temporary file. Refuses empty files."""
    if not tmp.exists() or tmp.stat().st_size == 0:
        raise EngineError(f"refusing to commit empty or missing output: {tmp}")
    os.replace(tmp, final)
    return final


class Log:
    """Structured JSON-lines logger (file) with a compact human line on stderr."""

    def __init__(self, path: Path | None = None, project: str | None = None, quiet: bool = False) -> None:
        self.path = path
        self.project = project
        self.quiet = quiet
        if path:
            path.parent.mkdir(parents=True, exist_ok=True)

    def emit(self, level: str, event: str, **fields: Any) -> None:
        rec = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "level": level, "event": event}
        if self.project:
            rec["project"] = self.project
        rec.update(fields)
        if self.path:
            with open(self.path, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec, default=str) + "\n")
        if not self.quiet:
            extra = " ".join(f"{k}={v}" for k, v in fields.items() if k not in ("detail",))
            print(f"[{level}] {event} {extra}".rstrip(), file=sys.stderr)

    def info(self, event: str, **f: Any) -> None:
        self.emit("info", event, **f)

    def warn(self, event: str, **f: Any) -> None:
        self.emit("warn", event, **f)

    def error(self, event: str, **f: Any) -> None:
        self.emit("error", event, **f)


def run(cmd: list[str], log: Log | None = None, timeout: float | None = None, cwd: Path | None = None) -> subprocess.CompletedProcess:
    """Run a command; raise EngineError with the tail of stderr on failure."""
    t0 = time.time()
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=cwd)
    if log:
        log.emit("debug" if p.returncode == 0 else "error", "subprocess", cmd=cmd[0], rc=p.returncode, seconds=round(time.time() - t0, 2))
    if p.returncode != 0:
        tail = (p.stderr or p.stdout or "").strip().splitlines()[-12:]
        raise EngineError(f"command failed ({cmd[0]} rc={p.returncode}):\n" + "\n".join(tail))
    return p


FFMPEG = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
