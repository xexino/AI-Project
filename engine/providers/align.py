"""Word-timing aligners: map the exact script words onto the narration audio."""
from __future__ import annotations

import difflib
import re

from . import ProviderInfo, ProviderUnavailable, register

_ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def number_words(n: int, year_style: bool = False) -> list[str]:
    """British-English words for an integer ('one hundred and fifty'); compound tens are joined ('sixtyfive')
    to match hyphenated script words. Years 1100-1999 and 2010-2099 read as pairs ('nineteen oh eight', 'twenty sixteen')."""
    if year_style and (1100 <= n <= 1999 or 2010 <= n <= 2099):
        hi, lo = divmod(n, 100)
        return number_words(hi) + (["hundred"] if lo == 0 else (["oh", _ONES[lo]] if lo < 10 else number_words(lo)))
    if n < 20:
        return [_ONES[n]]
    if n < 100:
        t, o = divmod(n, 10)
        return [_TENS[t] + (_ONES[o] if o else "")]
    if n < 1000:
        h, r = divmod(n, 100)
        return [_ONES[h], "hundred"] + (["and"] + number_words(r) if r else [])
    if n < 1_000_000:
        th, r = divmod(n, 1000)
        return number_words(th) + ["thousand"] + ((["and"] if r < 100 else []) + number_words(r) if r else [])
    m, r = divmod(n, 1_000_000)
    return number_words(m) + ["million"] + (number_words(r) if r else [])


def _canon(w: str) -> str:
    """Spelling-insensitive key: lower-case, no punctuation/hyphens, British/American variants folded."""
    w = re.sub(r"[^a-z0-9']", "", w.lower().replace("-", ""))
    w = re.sub(r"tre(s?)$", r"ter\1", w)          # metres/meters, centre/center
    w = re.sub(r"(.)\1", r"\1", w)                # levelled/leveled, travelled/traveled
    w = re.sub(r"our$", "or", w)                   # colour/color
    w = re.sub(r"ise(s|d)?$", r"ize\1", w)        # realise/realize
    return w


def expand_heard(heard: list[tuple[str, float, float]]) -> list[tuple[str, float, float]]:
    """Turn recognised digits ('1908,', '2' ',000', '65') into words, sharing the token's time span."""
    merged: list[tuple[str, float, float]] = []
    for w, s, e in heard:
        if merged and re.fullmatch(r",\d{3}[.,!?]?", w.strip()) and re.fullmatch(r"\d+", merged[-1][0].strip().rstrip(".,")):
            pw, ps, _ = merged[-1]; merged[-1] = (pw.strip() + w.strip().rstrip(".,!?").lstrip(","), ps, e); continue
        merged.append((w, s, e))
    out = []
    for w, s, e in merged:
        core = w.strip().rstrip(".,!?;:").replace(",", "")
        if re.fullmatch(r"\d+", core):
            words = number_words(int(core), year_style=len(core) == 4)
            step = (e - s) / len(words)
            out += [(x, s + i * step, s + (i + 1) * step) for i, x in enumerate(words)]
        else:
            out.append((w, s, e))
    return out


_norm = _canon


def script_words(text: str) -> list[str]:
    return [w for w in text.replace("...", " ").replace("—", " ").split() if _norm(w)]


def align_to_script(text: str, heard: list[tuple[str, float, float]], total: float) -> list[dict]:
    """Map recognised (word, start, end) onto the script's words; interpolate unmatched ones.
    The returned words are always exactly the script's words (captions never show misrecognitions)."""
    script = script_words(text)
    heard = expand_heard(heard)
    a = [_norm(w) for w in script]
    b = [_norm(w) for w, _, _ in heard]
    times: list[tuple[float, float] | None] = [None] * len(script)
    blocks = [blk for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks()]
    for blk in blocks:
        for i in range(blk.size):
            _, s, e = heard[blk.b + i]
            times[blk.a + i] = (s, e)
    # gaps between two matched anchors with the same number of words on both sides (e.g. a proper name the
    # recogniser spelled differently: 'Kulik' heard as 'Killick') take the recognised word's timing one-to-one
    prev_a = prev_b = 0
    for blk in blocks:
        ga, gb = blk.a - prev_a, blk.b - prev_b
        if 0 < ga == gb:
            for i in range(ga):
                _, s, e = heard[prev_b + i]
                times[prev_a + i] = (s, e)
        elif ga == 1 and gb > 1:          # one script word heard as several ("they're" -> "they are")
            times[prev_a] = (heard[prev_b][1], heard[prev_b + gb - 1][2])
        elif gb == 1 and ga > 1:          # several script words heard as one token: split its span evenly
            _, s, e = heard[prev_b]
            for i in range(ga):
                times[prev_a + i] = (s + (e - s) * i / ga, s + (e - s) * (i + 1) / ga)
        prev_a, prev_b = blk.a + blk.size, blk.b + blk.size
    matched = [t is not None for t in times]
    for i in range(len(times)):
        if times[i] is None:
            prev = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
            nxt = next((times[j][0] for j in range(i + 1, len(times)) if times[j]), total)
            times[i] = (prev, max(prev + 0.05, (prev + nxt) / 2))
    return [{"word": w, "start": round(s, 3), "end": round(e, 3), "matched": m} for w, (s, e), m in zip(script, times, matched)]


@register("aligner", "whisper")
class WhisperAligner:
    def __init__(self, model: str = "base.en", **_: object) -> None:
        self.model_name = model
        self.info = ProviderInfo("aligner", "whisper", paid=False, model=f"faster-whisper {model}", license="MIT")
        self._m = None

    def align(self, wav_path: str, text: str, duration: float) -> list[dict]:
        if self._m is None:
            try:
                from faster_whisper import WhisperModel
            except ImportError as e:
                raise ProviderUnavailable("faster-whisper is not installed (pip install -r requirements.txt)") from e
            self._m = WhisperModel(self.model_name, device="cpu", compute_type="int8")
        segs, _ = self._m.transcribe(wav_path, word_timestamps=True, language="en", condition_on_previous_text=False)
        heard = [(w.word, w.start, w.end) for s in segs for w in s.words]
        return align_to_script(text, heard, duration)


@register("aligner", "proportional")
class ProportionalAligner:
    """No model: spreads words over the audio proportionally to their length (tests / fallback)."""

    def __init__(self, **_: object) -> None:
        self.info = ProviderInfo("aligner", "proportional", paid=False, model="", license="n/a")

    def align(self, wav_path: str, text: str, duration: float) -> list[dict]:
        words = script_words(text)
        weights = [len(_norm(w)) + 1 for w in words]
        tot = sum(weights) or 1
        t, out = 0.0, []
        for w, k in zip(words, weights):
            d = duration * k / tot
            out.append({"word": w, "start": round(t, 3), "end": round(t + d * 0.9, 3), "matched": False})
            t += d
        return out


@register("aligner", "mock")
class MockAligner:
    """Exact timings for the mock TTS (0.32 s per word / speed). Test use only."""

    def __init__(self, **_: object) -> None:
        self.info = ProviderInfo("aligner", "mock", paid=False, model="", license="n/a (test only)")

    def align(self, wav_path: str, text: str, duration: float, speed: float = 1.0) -> list[dict]:
        per = 0.32 / max(speed, 0.1)
        return [{"word": w, "start": round(i * per, 3), "end": round(i * per + per * 0.8, 3), "matched": True}
                for i, w in enumerate(script_words(text))]
