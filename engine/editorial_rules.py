"""Editorial rules for on-screen text and the timed beat table (opt-in per project via "editorial_rules").

phrase_once        every spoken phrase appears on screen at most once. An overlay that restates narration
                   (all of its words are spoken in that beat, or it shows a number that is spoken there) must declare
                   the phrase it replaces ("voices"); the burned-in captions then hide exactly those words, so the
                   overlay is the phrase's single on-screen appearance. Overlays may not repeat each other and big
                   overlays may not be on screen at the same time.
one_hero_per_beat  every narrated scene names exactly one hero ("hero": "<one subject>").

The beat table is generated from the project and the measured timeline (never typed by hand), so its times are the
real narration timings."""
from __future__ import annotations

import re

from .util import EngineError

_UNITS = {w: i for i, w in enumerate("zero one two three four five six seven eight nine ten eleven twelve thirteen "
                                     "fourteen fifteen sixteen seventeen eighteen nineteen".split())}
_TENS = {w: 10 * i for i, w in enumerate("_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()) if w != "_"}
_SCALES = {"hundred": 100, "thousand": 1000, "million": 1_000_000}
_FILLER = {"and", "a"}


def norm(w: str) -> str:
    return re.sub(r"[^a-z0-9]", "", w.lower())


def _num_value(tok: str) -> int | None:
    t = tok.lower().strip(".,:;!?")
    if t in _UNITS:
        return _UNITS[t]
    if t in _TENS:
        return _TENS[t]
    if "-" in t:
        a, _, b = t.partition("-")
        if a in _TENS and b in _UNITS and _UNITS[b] < 10:
            return _TENS[a] + _UNITS[b]
    return None


def spoken_numbers(words: list[str]) -> set[int]:
    """Integers spoken as words ('ten thousand nine hundred thirty-five' -> 10935, 'a thousand' -> 1000)."""
    out: set[int] = set()
    total = cur = 0
    active = False
    toks = [w.lower().strip(".,:;!?") for w in words]
    for i, t in enumerate(toks):
        v = _num_value(t)
        nxt = toks[i + 1] if i + 1 < len(toks) else ""
        if v is not None:
            cur += v; active = True
        elif t == "hundred" and active:
            cur = max(cur, 1) * 100
        elif t in _SCALES and active:
            total += max(cur, 1) * _SCALES[t]; cur = 0
        elif t == "a" and nxt in _SCALES:
            cur = 1; active = True
        elif t == "and" and active:
            pass
        else:
            if active:
                out.add(total + cur)
            total = cur = 0; active = False
            continue
        if words[i].rstrip()[-1:] in ".,:;!?":
            out.add(total + cur); total = cur = 0; active = False
    if active:
        out.add(total + cur)
    return out


def overlay_numbers(text: str) -> set[int]:
    return {int(m.replace(",", "")) for m in re.findall(r"\d[\d,]*", text)}


def overlay_text(ov: dict) -> str:
    return " ".join(x for x in (ov.get("text", ""), ov.get("sub", "")) if x)


def scene_words(tl: dict, sid: str) -> list[tuple[int, dict]]:
    return [(i, w) for i, w in enumerate(tl.get("words", [])) if w["scene"] == sid]


def voiced_span(tl: dict, voices: dict) -> list[int]:
    """Global word indices of the phrase an overlay replaces (must be a contiguous run of that scene's words)."""
    want = [norm(w) for w in voices["text"].split() if norm(w)]
    sw = scene_words(tl, voices["scene"])
    have = [norm(w["word"]) for _, w in sw]
    for k in range(len(have) - len(want) + 1):
        if have[k:k + len(want)] == want:
            return [sw[k + j][0] for j in range(len(want))]
    raise EngineError(f"overlay voices '{voices['text']}' is not a contiguous phrase of scene {voices['scene']}")


def voiced_indices(tl: dict, overlays: list[dict]) -> set[int]:
    out: set[int] = set()
    for ov in overlays:
        if ov.get("voices"):
            out.update(voiced_span(tl, ov["voices"]))
    return out


def _overlay_scene(ov: dict) -> str | None:
    if ov.get("voices"):
        return ov["voices"]["scene"]
    at = ov.get("at", {})
    return at.get("scene") or at.get("scene_start")


def check_phrase_once(data: dict, tl: dict) -> list[str]:
    """Problems with on-screen text under the phrase_once / one_hero_per_beat rules (empty list = compliant)."""
    from .stages.audio import resolve_at
    problems: list[str] = []
    rules = data.get("editorial_rules") or {}
    overlays = data.get("overlays", [])
    seen: dict[str, int] = {}
    windows = []
    for i, ov in enumerate(overlays):
        txt = overlay_text(ov)
        key = norm(txt)
        if key in seen:
            problems.append(f"overlay {i} repeats overlay {seen[key]}: '{txt}'")
        seen[key] = i
        sid = _overlay_scene(ov)
        words = [w["word"] for _, w in scene_words(tl, sid)] if sid else []
        spoken = {norm(w) for w in words}
        alpha = [norm(x) for x in re.findall(r"[A-Za-z][A-Za-z'-]*", txt) if len(norm(x)) >= 3]
        nums = overlay_numbers(txt) & spoken_numbers(words)
        restates = (alpha and all(a in spoken for a in alpha)) or bool(nums)
        if ov.get("voices"):
            try:
                span = voiced_span(tl, ov["voices"])
            except EngineError as e:
                problems.append(f"overlay {i} ('{txt}'): {e}"); span = []
            if span:
                vw = [tl["words"][j]["word"] for j in span]
                vn = {norm(w) for w in vw}
                missing = [a for a in alpha if a in spoken and a not in vn]
                if missing:
                    problems.append(f"overlay {i} ('{txt}') shows spoken words outside its 'voices' phrase: {missing}")
                if nums - spoken_numbers(vw):
                    problems.append(f"overlay {i} ('{txt}') shows spoken numbers outside its 'voices' phrase: {sorted(nums - spoken_numbers(vw))}")
        elif restates:
            problems.append(f"overlay {i} ('{txt}') restates narration of scene {sid} but declares no 'voices' phrase "
                            "(the caption would show the same phrase a second time)")
        if ov.get("type") in ("big", "bigsub") and "at" in ov and "until" in ov:
            try:
                windows.append((resolve_at(ov["at"], tl), resolve_at(ov["until"], tl), i, txt))
            except EngineError as e:
                problems.append(f"overlay {i} ('{txt}'): {e}")
    windows.sort()
    for (a0, a1, i, t1), (b0, b1, j, t2) in zip(windows, windows[1:]):
        if b0 < a1 - 1e-6:
            problems.append(f"overlays {i} ('{t1}') and {j} ('{t2}') are on screen at the same time ({b0:.2f}s < {a1:.2f}s)")
    if rules.get("one_hero_per_beat"):
        for s in data["scenes"]:
            if s["text"].strip():
                h = s.get("hero")
                if not isinstance(h, str) or not h.strip():
                    problems.append(f"scene {s['id']}: narrated beat needs exactly one 'hero' (a single subject string)")
    return problems


def _fmt(t: float) -> str:
    m, s = divmod(max(t, 0.0), 60)
    return f"{int(m):02d}:{s:05.2f}"


def beat_rows(data: dict, tl: dict, registry=None, assets: dict | None = None) -> list[dict]:
    from .stages.audio import resolve_at
    segs = {s["id"]: s for s in tl["scenes"]}
    hidden = voiced_indices(tl, data.get("overlays", []))
    asset_ids = [a["id"] for a in (assets or {}).get("assets", [])]
    rows = []
    for k, s in enumerate(data["scenes"]):
        seg = segs[s["id"]]
        nxt = data["scenes"][k + 1]["id"] if k + 1 < len(data["scenes"]) else None
        ovs = []
        for i, ov in enumerate(data.get("overlays", [])):
            try:
                a = resolve_at(ov["at"], tl)
                b = resolve_at(ov["until"], tl) if "until" in ov else a + ov.get("duration", 3.5)
            except (EngineError, KeyError):
                continue
            if seg["start"] - 1e-6 <= a < seg["start"] + seg["slot"]:
                ovs.append({"text": overlay_text(ov).replace(" ", " ").strip(), "from": round(a, 2), "to": round(b, 2),
                            "replaces_caption": " ".join(tl["words"][j]["word"] for j in voiced_span(tl, ov["voices"])) if ov.get("voices") else None})
        words = [(i, w) for i, w in scene_words(tl, s["id"])]
        refs = []
        for rid in s.get("references", []) or []:
            f = registry.frame(rid) if registry else {"id": rid}
            refs.append({"id": rid, "title": f.get("title", ""), "credit": f.get("credit", ""), "license": f.get("license", ""), "use": f.get("use", "guidance only")})
        tr = s.get("transition_out") or {}
        rows.append({
            "id": s["id"], "beat": s.get("beat", ""), "start": round(seg["start"], 3), "end": round(seg["start"] + seg["slot"], 3),
            "vo": [round(words[0][1]["start"], 3), round(words[-1][1]["end"], 3)] if words else None,
            "narration": s["text"], "hero": s.get("hero", ""), "on_screen_text": ovs,
            "captions_shown": " ".join(w["word"] for i, w in words if i not in hidden),
            "camera": s.get("camera", ""), "event": s.get("event", ""), "claims": s.get("claims", []),
            "references": refs, "assets": [a for a in s.get("assets", asset_ids if s["text"].strip() else [])],
            "transition": f"{tr.get('type', 'none')} {tr.get('d', '')}".strip() + (f" → {nxt}" if nxt else ""),
        })
    return rows


def beat_table_md(title: str, rows: list[dict], duration: float, problems: list[str]) -> str:
    out = [f"# Beat table — {title}", "",
           f"Generated from the measured narration timeline (total {duration:.2f} s at 24 fps). Times are global (mm:ss.ss).", "",
           "Rule check (phrase once, one hero per beat, no simultaneous titles): " + ("**PASS**" if not problems else "**FAIL**"), ""]
    out += [f"- {p}" for p in problems]
    out += ["", "| Beat | Start–end | Narration | Hero | On-screen text | Camera | Visual event | References / assets | Transition |",
            "|---|---|---|---|---|---|---|---|---|"]
    esc = lambda x: str(x).replace("|", "\\|").replace("\n", " ")
    for r in rows:
        ost = "<br>".join(f"**{esc(o['text'])}** ({_fmt(o['from'])}–{_fmt(o['to'])})" + (f"<br>_replaces caption: “{esc(o['replaces_caption'])}”_" if o["replaces_caption"] else "")
                          for o in r["on_screen_text"]) or "— (captions only)"
        refs = "<br>".join(f"{x['id']}: {esc(x['title'])} — {esc(x['credit'])} ({esc(x['license'])}; {esc(x['use'])})" for x in r["references"]) or "—"
        out.append(f"| {r['id']} {esc(r['beat'])} | {_fmt(r['start'])}–{_fmt(r['end'])}" + (f"<br>VO {_fmt(r['vo'][0])}–{_fmt(r['vo'][1])}" if r["vo"] else "")
                   + f" | {esc(r['narration']) or '—'} | {esc(r['hero']) or '—'} | {ost} | {esc(r['camera']) or '—'} | {esc(r['event']) or '—'} | {refs} | {esc(r['transition'])} |")
    return "\n".join(out) + "\n"
