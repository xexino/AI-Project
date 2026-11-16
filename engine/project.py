"""Project definition: loading, defaults and schema validation (stdlib only, no heavy dependencies).

A project lives in its own directory:
    productions/<id>/project.json      creative + technical configuration (validated here)
    productions/<id>/scenes/*.js        project-specific scene modules (procedural 3D)
    productions/<id>/assets.json        asset licensing register
    productions/<id>/work/              resumable intermediate outputs + state.sqlite   (git-ignored)
    productions/<id>/delivery/          delivery package                                  (git-ignored)
"""
from __future__ import annotations

import copy
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .util import EngineError, REPO_DIR

SCHEMA_VERSION = 1
ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{1,63}$")
TRANSITIONS = {"fade", "fadeblack", "fadewhite", "zoomin", "cut", "dissolve", "wipeleft", "wiperight", "slideup", "smoothup", "circleopen", "none"}
CLAIM_STATUS = {"verified", "needs_review", "disputed"}

DEFAULTS: dict[str, Any] = {
    "schema_version": SCHEMA_VERSION,
    "language": "en",
    "target_audience": "general",
    "format": {"aspect_ratio": "9:16", "width": 1080, "height": 1920, "fps": 24, "target_duration_s": [20, 60]},
    "narration": {"provider": "kokoro", "voice": "bm_george", "lang": "en-gb", "speed": 1.0, "aligner": "whisper"},
    "visual": {"renderer": "threejs", "style": "", "grade": {"grain": 5, "vignette": "PI/4.6", "contrast": 1.03, "saturation": 1.04, "bloom": 0.0}},
    "overlays": [],
    "sound": {"bed": None, "pad": None, "cues": []},
    "music": None,
    "sources": [],
    "claims": [],
    "cover": None,
    "publishing": {"enabled": False, "platforms": {}},
    "qc": {"loudness_lufs": -14.0, "loudness_tolerance": 1.0, "true_peak_max_dbtp": -1.0, "max_caption_chars": 24,
           "min_caption_s": 0.08, "black_allow": [], "duration_tolerance_s": 0.1},
    "budget": {"max_paid_eur": 0.0},
    "providers": {"llm": "manual", "tts": None, "aligner": None, "renderer": None, "image": "none", "video": "none"},
}


def _merge(base: Any, over: Any) -> Any:
    if isinstance(base, dict) and isinstance(over, dict):
        out = copy.deepcopy(base)
        for k, v in over.items():
            out[k] = _merge(base.get(k), v) if k in base else copy.deepcopy(v)
        return out
    return copy.deepcopy(over) if over is not None else copy.deepcopy(base)


class Problems:
    def __init__(self) -> None:
        self.items: list[str] = []

    def add(self, where: str, msg: str) -> None:
        self.items.append(f"{where}: {msg}")

    def req(self, d: dict, key: str, typ: type | tuple, where: str) -> Any:
        if key not in d:
            self.add(where, f"missing required field '{key}'")
            return None
        if not isinstance(d[key], typ):
            self.add(f"{where}.{key}", f"expected {getattr(typ, '__name__', typ)}, got {type(d[key]).__name__}")
            return None
        return d[key]


def validate(data: dict, project_dir: Path | None = None) -> list[str]:
    """Return a list of human-readable problems (empty list = valid)."""
    p = Problems()
    if not isinstance(data, dict):
        return ["project: must be a JSON object"]
    if data.get("schema_version", SCHEMA_VERSION) != SCHEMA_VERSION:
        p.add("schema_version", f"unsupported version {data.get('schema_version')} (engine supports {SCHEMA_VERSION})")
    pid = p.req(data, "id", str, "project")
    if pid and not ID_RE.match(pid):
        p.add("project.id", "lowercase letters, digits, '.', '_' or '-' (2-64 chars)")
    for k in ("title", "topic", "customer_id"):
        p.req(data, k, str, "project")
    fmt = data.get("format", {})
    for k in ("width", "height", "fps"):
        v = fmt.get(k)
        if not isinstance(v, int) or v <= 0:
            p.add(f"format.{k}", "must be a positive integer")
    if isinstance(fmt.get("width"), int) and isinstance(fmt.get("height"), int) and fmt.get("aspect_ratio"):
        try:
            a, b = (int(x) for x in str(fmt["aspect_ratio"]).split(":"))
            if fmt["width"] * b != fmt["height"] * a:
                p.add("format.aspect_ratio", f"{fmt['aspect_ratio']} does not match {fmt['width']}x{fmt['height']}")
        except ValueError:
            p.add("format.aspect_ratio", "must look like '9:16'")
    scenes = p.req(data, "scenes", list, "project") or []
    if not scenes:
        p.add("project.scenes", "at least one scene is required")
    ids: set[str] = set()
    source_ids = {s.get("id") for s in data.get("sources", []) if isinstance(s, dict)}
    claim_ids = {c.get("id") for c in data.get("claims", []) if isinstance(c, dict)}
    for i, s in enumerate(scenes):
        w = f"scenes[{i}]"
        if not isinstance(s, dict):
            p.add(w, "must be an object"); continue
        sid = p.req(s, "id", str, w)
        if sid in ids:
            p.add(w, f"duplicate scene id '{sid}'")
        ids.add(sid or "")
        p.req(s, "text", str, w)
        mod = p.req(s, "module", str, w)
        for k in ("lead", "tail"):
            if not isinstance(s.get(k, 0.0), (int, float)) or s.get(k, 0.0) < 0:
                p.add(f"{w}.{k}", "must be a non-negative number")
        tr = s.get("transition_out")
        if tr is not None:
            if not isinstance(tr, dict) or tr.get("type") not in TRANSITIONS:
                p.add(f"{w}.transition_out", f"type must be one of {sorted(TRANSITIONS)}")
            elif not isinstance(tr.get("d", 0), (int, float)) or tr.get("d", 0) < 0:
                p.add(f"{w}.transition_out.d", "must be a non-negative number")
        if mod and project_dir is not None and not mod.startswith("builtin:"):
            sroot = scene_root(data, project_dir)
            if not (sroot / mod).is_file():
                p.add(f"{w}.module", f"scene module not found: {mod}")
            elif not (sroot / mod).resolve().is_relative_to(sroot.resolve()):
                p.add(f"{w}.module", "scene module must live inside the project's scene root")
        if s.get("references") is not None and (not isinstance(s["references"], list) or not data.get("references")):
            p.add(f"{w}.references", "must be a list of reference ids, and the project needs a top-level 'references' registry")
        for c in s.get("claims", []):
            if c not in claim_ids:
                p.add(f"{w}.claims", f"unknown claim id '{c}'")
    if scenes and isinstance(scenes[-1], dict) and scenes[-1].get("transition_out") not in (None, {}):
        p.add(f"scenes[{len(scenes) - 1}].transition_out", "the last scene cannot have an outgoing transition")
    for i, s in enumerate(data.get("sources", [])):
        w = f"sources[{i}]"
        if not isinstance(s, dict):
            p.add(w, "must be an object"); continue
        p.req(s, "id", str, w); p.req(s, "citation", str, w)
        if not (s.get("url") or s.get("doi")):
            p.add(w, "needs a 'url' or 'doi'")
        elif s.get("url") and not str(s["url"]).startswith(("https://", "http://")):
            p.add(f"{w}.url", "must be an http(s) URL")
    for i, c in enumerate(data.get("claims", [])):
        w = f"claims[{i}]"
        if not isinstance(c, dict):
            p.add(w, "must be an object"); continue
        p.req(c, "id", str, w); p.req(c, "text", str, w)
        if c.get("status", "needs_review") not in CLAIM_STATUS:
            p.add(f"{w}.status", f"must be one of {sorted(CLAIM_STATUS)}")
        for sref in c.get("sources", []):
            if sref not in source_ids:
                p.add(f"{w}.sources", f"unknown source id '{sref}'")
        if not c.get("sources"):
            p.add(f"{w}.sources", "a factual claim needs at least one source")
    if data.get("scene_root") and project_dir is not None:
        sr = (project_dir / data["scene_root"]).resolve()
        if not sr.is_relative_to((REPO_DIR / "productions").resolve()) or not (sr / "project.json").is_file():
            p.add("project.scene_root", "must point to another production directory inside productions/")
    budget = data.get("budget", {})
    if not isinstance(budget.get("max_paid_eur", 0), (int, float)) or budget.get("max_paid_eur", 0) < 0:
        p.add("budget.max_paid_eur", "must be a non-negative number")
    pub = data.get("publishing", {})
    if pub.get("enabled") and not pub.get("authorized_by"):
        p.add("publishing.enabled", "publishing can only be enabled together with an explicit 'authorized_by' record")
    return p.items


@dataclass
class Project:
    dir: Path
    data: dict
    raw: dict = field(repr=False, default_factory=dict)

    @property
    def id(self) -> str:
        return self.data["id"]

    @property
    def fmt(self) -> dict:
        return self.data["format"]

    @property
    def scenes(self) -> list[dict]:
        return self.data["scenes"]

    @property
    def scene_dir(self) -> Path:
        """Where scene modules are resolved (the project itself, or a base production for experiments)."""
        return scene_root(self.data, self.dir)

    @property
    def work(self) -> Path:
        return self.dir / "work"

    @property
    def delivery(self) -> Path:
        return self.dir / "delivery"

    def scene(self, sid: str) -> dict:
        for s in self.scenes:
            if s["id"] == sid:
                return s
        raise EngineError(f"unknown scene '{sid}'")

    def config_hash_part(self, *keys: str) -> dict:
        return {k: self.data.get(k) for k in keys}


def scene_root(data: dict, project_dir: Path) -> Path:
    return (project_dir / data["scene_root"]).resolve() if data.get("scene_root") else project_dir


def load(project_dir: str | Path) -> Project:
    d = Path(project_dir).resolve()
    f = d / "project.json"
    if not f.is_file():
        raise EngineError(f"no project.json in {d}")
    try:
        raw = json.loads(f.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise EngineError(f"{f}: invalid JSON ({e})") from e
    data = _merge(DEFAULTS, raw)
    # scene defaults
    for s in data.get("scenes", []):
        s.setdefault("lead", 0.35); s.setdefault("tail", 0.35); s.setdefault("params", {}); s.setdefault("claims", [])
        s.setdefault("transition_out", None)
    problems = validate(data, d)
    if problems:
        raise EngineError("invalid project.json:\n  - " + "\n  - ".join(problems))
    return Project(dir=d, data=data, raw=raw)


def relpath(p: Path) -> str:
    try:
        return str(p.resolve().relative_to(REPO_DIR))
    except ValueError:
        return str(p)
