"""Image / video generation and asset-sourcing interfaces.

The zero-cost route renders all visuals procedurally (see render.py), so the default providers here are
'none' (image/video generation disabled) and 'local' (asset sourcing from files inside the project or the
owning customer's folder only). A hosted generator can be added behind these interfaces later; it must
declare paid=True so the BudgetGuard refuses it while the project budget is 0."""
from __future__ import annotations

from pathlib import Path

from . import ProviderInfo, ProviderUnavailable, register
from ..util import EngineError


@register("image", "none")
class NoImage:
    def __init__(self, **_: object) -> None:
        self.info = ProviderInfo("image", "none", paid=False)

    def generate(self, prompt: str, **_: object) -> Path:
        raise ProviderUnavailable("image generation is disabled for this project (providers.image = 'none')")


@register("video", "none")
class NoVideo:
    def __init__(self, **_: object) -> None:
        self.info = ProviderInfo("video", "none", paid=False)

    def generate(self, prompt: str, **_: object) -> Path:
        raise ProviderUnavailable("generative video is disabled for this project (providers.video = 'none')")


@register("assets", "local")
class LocalAssets:
    """Resolves asset paths, refusing anything outside the project dir or the owning customer's dir."""

    def __init__(self, project_dir: Path | None = None, customer_dir: Path | None = None, **_: object) -> None:
        self.info = ProviderInfo("assets", "local", paid=False)
        self.roots = [p.resolve() for p in (project_dir, customer_dir) if p]

    def resolve(self, rel: str, base: Path) -> Path:
        p = (base / rel).resolve()
        if not any(p.is_relative_to(r) for r in self.roots):
            raise EngineError(f"asset '{rel}' is outside the project/customer folders (cross-project asset use is blocked)")
        if not p.is_file():
            raise EngineError(f"asset not found: {rel}")
        return p
