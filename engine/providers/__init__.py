"""Provider interfaces and registry.

Every provider declares whether it is paid. Paid providers must pass the budget guard before every call
(default budget: 0 EUR, so paid providers are refused unless a project explicitly allows spending).
Free/local providers: kokoro (TTS), whisper (alignment), threejs (procedural 3D video), manual/ollama (LLM).
Test providers: mock-tts, proportional (alignment), mock-render."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from ..util import EngineError


class ProviderUnavailable(EngineError):
    pass


class BudgetExceeded(EngineError):
    pass


@dataclass
class ProviderInfo:
    kind: str
    name: str
    paid: bool
    model: str = ""
    license: str = ""


_REGISTRY: dict[tuple[str, str], Callable[..., object]] = {}


def register(kind: str, name: str):
    def deco(factory):
        _REGISTRY[(kind, name)] = factory
        return factory
    return deco


def get(kind: str, name: str, **cfg):
    from . import tts, align, render, llm, media  # noqa: F401  (populate registry)
    if (kind, name) not in _REGISTRY:
        known = sorted(n for k, n in _REGISTRY if k == kind)
        raise ProviderUnavailable(f"no {kind} provider named '{name}' (available: {', '.join(known)})")
    return _REGISTRY[(kind, name)](**cfg)


def available(kind: str) -> list[str]:
    from . import tts, align, render, llm, media  # noqa: F401
    return sorted(n for k, n in _REGISTRY if k == kind)


class BudgetGuard:
    """Enforces the project's paid-spend ceiling. Call check() BEFORE a paid call, record() after."""

    def __init__(self, state, max_paid_eur: float) -> None:
        self.state = state
        self.max = float(max_paid_eur)

    def check(self, info: ProviderInfo, estimated_eur: float) -> None:
        if not info.paid:
            return
        spent = self.state.paid_total()
        if self.max <= 0:
            raise BudgetExceeded(f"{info.kind} provider '{info.name}' is paid and this project's budget.max_paid_eur is 0. "
                                 "Choose a free provider or raise the budget explicitly.")
        if spent + estimated_eur > self.max:
            raise BudgetExceeded(f"{info.name}: estimated {estimated_eur:.2f} EUR would exceed the budget "
                                 f"({spent:.2f} of {self.max:.2f} EUR already spent)")

    def record(self, stage: str, info: ProviderInfo, units: float, unit: str, estimated_eur: float = 0.0,
               actual_eur: float = 0.0, note: str = "") -> None:
        self.state.add_cost(stage, info.name, info.model, units, unit, info.paid, estimated_eur, actual_eur, note)
