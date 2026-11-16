"""Text-to-speech providers. Output: mono float32 samples + sample rate."""
from __future__ import annotations

import math
from pathlib import Path

from . import ProviderInfo, ProviderUnavailable, register
from ..util import REPO_DIR

MODELS = REPO_DIR / "models"


class TTSProvider:
    info: ProviderInfo

    def synthesize(self, text: str, voice: str, lang: str, speed: float):  # -> (np.ndarray, int)
        raise NotImplementedError


@register("tts", "kokoro")
class KokoroTTS(TTSProvider):
    """Kokoro-82M via kokoro-onnx (Apache-2.0 weights). Local CPU inference, no network at synthesis time."""

    def __init__(self, model: str | None = None, voices: str | None = None, **_: object) -> None:
        self.model = Path(model) if model else MODELS / "kokoro-v1.0.onnx"
        self.voices = Path(voices) if voices else MODELS / "voices-v1.0.bin"
        self.info = ProviderInfo("tts", "kokoro", paid=False, model="kokoro-v1.0 (82M)", license="Apache-2.0")
        self._k = None

    def _load(self):
        if self._k is None:
            for p in (self.model, self.voices):
                if not p.is_file():
                    raise ProviderUnavailable(f"Kokoro model file missing: {p}. See docs/INSTALL.md (models section).")
            try:
                from kokoro_onnx import Kokoro
            except ImportError as e:
                raise ProviderUnavailable("kokoro-onnx is not installed (pip install -r requirements.txt)") from e
            self._k = Kokoro(str(self.model), str(self.voices))
        return self._k

    def synthesize(self, text: str, voice: str, lang: str, speed: float):
        return self._load().create(text, voice=voice, speed=speed, lang=lang)


@register("tts", "mock")
class MockTTS(TTSProvider):
    """Deterministic test voice: one soft tone burst per word (~0.32 s/word). No model required."""

    def __init__(self, **_: object) -> None:
        self.info = ProviderInfo("tts", "mock", paid=False, model="sine", license="n/a (test only)")

    def synthesize(self, text: str, voice: str, lang: str, speed: float):
        import numpy as np
        sr = 24000
        words = [w for w in text.replace("...", " ").split() if w.strip()]
        per = 0.32 / max(speed, 0.1)
        out = []
        for i, _w in enumerate(words):
            n = int(sr * per)
            t = np.arange(n) / sr
            env = np.sin(np.pi * np.minimum(t / (per * 0.8), 1.0)) ** 2 * (t < per * 0.8)
            out.append(0.3 * env * np.sin(2 * math.pi * (180 + 20 * (i % 5)) * t))
        return (np.concatenate(out) if out else np.zeros(sr // 4)).astype("float32"), sr
