"""The ordered production stages. Each entry: name, implementation, configuration it depends on, version."""
from __future__ import annotations

import importlib
from typing import Callable

from ..pipeline import Context, Stage
from ..util import ENGINE_DIR, hash_tree


def _code(*rel: str) -> str:
    """Stage version = hash of the implementation files, so code changes invalidate cached outputs."""
    return hash_tree([ENGINE_DIR / r for r in rel])[:16]


def _impl(path: str) -> Callable[[Context], dict]:
    mod, fn = path.rsplit(".", 1)
    return lambda ctx: getattr(importlib.import_module(f"engine.stages.{mod}"), fn)(ctx)


def _cfg(*keys: str, extra: Callable[[Context], object] | None = None) -> Callable[[Context], object]:
    def f(ctx: Context):
        d = ctx.project.data
        base = {k: d.get(k) for k in keys}
        if extra:
            base["_extra"] = extra(ctx)
        return base
    return f


def _visual_cfg(ctx: Context):
    from .visuals import config
    return config(ctx)


def _scene_text(ctx: Context):
    return [(s["id"], s["text"], s["lead"], s["tail"], s["transition_out"]) for s in ctx.project.scenes]


def _music_cfg(ctx: Context):
    from .audio import music_fingerprint
    return music_fingerprint(ctx)


def _assemble_cfg(ctx: Context):
    from .assemble import assemble_fingerprint
    return assemble_fingerprint(ctx)


STAGES: list[Stage] = [
    Stage("research", _impl("editorial.research"), _cfg("topic", "sources", "claims"), _code("stages/editorial.py"), status_before="RESEARCHING"),
    Stage("factcheck", _impl("editorial.factcheck"), _cfg("claims", "sources", extra=lambda c: [(s["id"], s.get("claims"), s.get("non_factual")) for s in c.project.scenes]), _code("stages/editorial.py")),
    Stage("script", _impl("editorial.script"), _cfg("title", "topic", "target_audience", "narration", "sources", extra=_scene_text), _code("stages/editorial.py"), status_after="SCRIPT_READY"),
    Stage("storyboard", _impl("editorial.storyboard"), _cfg("title", "format", "visual", extra=lambda c: [(s["id"], s.get("visual_goal"), s["module"], s["transition_out"]) for s in c.project.scenes]), _code("stages/editorial.py")),
    Stage("narration", _impl("narration.narration"), _cfg("narration", extra=lambda c: [(s["id"], s["text"]) for s in c.project.scenes]), _code("stages/narration.py", "providers/tts.py"), status_before="PRODUCING"),
    Stage("timing", _impl("narration.timing"), _cfg("format", "narration", extra=_scene_text), _code("stages/narration.py", "providers/align.py")),
    Stage("visuals", _impl("visuals.visuals"), _visual_cfg, _code("stages/visuals.py", "providers/render.py"), status_before="RENDERING", retries=1),
    Stage("music", _impl("audio.music"), _music_cfg, _code("stages/audio.py")),
    Stage("captions", _impl("captions.captions"), _cfg("brand", "overlays", "qc", "format"), _code("stages/captions.py")),
    Stage("assemble", _impl("assemble.assemble"), _assemble_cfg, _code("stages/assemble.py", "stages/audio.py")),
    Stage("cover", _impl("cover.cover"), _cfg("cover", "brand", "format"), _code("stages/cover.py")),
    Stage("qc", _impl("qc.qc"), _cfg("qc", "format", "brand", "sources", "claims"), _code("stages/qc.py"), status_before="QC_PENDING", status_after="QC_PASSED"),
    Stage("package", _impl("package.package"), _cfg("publishing", "title", "brand", "sources", "claims", "customer_id"), _code("stages/package.py"), status_after="DELIVERY_READY"),
]

NAMES = [s.name for s in STAGES]
