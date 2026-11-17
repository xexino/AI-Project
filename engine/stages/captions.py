"""Captions (word-highlighted ASS for burn-in, plus SRT and VTT sidecars) and timed overlays.

Overlay types (project.json "overlays"):
  label   {"text", "at", "duration"}                       small tracked text near the top
  counter {"scene", "from", "to", "span_fraction"}          rolling number (e.g. years) during a scene
  big     {"text", "at", "until", "y", "sub"?}              large display number/word; optional smaller sub-line
  bigsub  {"text", "at", "until", "y"}                      the smaller line on its own anchor
Optional on big/bigsub: "size" (px at 1920 tall). Optional on any overlay: "voices": {"scene", "text"} — the overlay
is the on-screen form of that spoken phrase, so the burned-in captions hide those words (each phrase shown once).
The SRT/VTT sidecars always keep the full narration (accessibility).
"""
from __future__ import annotations

import json

from ..editorial_rules import check_phrase_once, voiced_indices
from ..pipeline import Context
from ..util import EngineError, atomic_write_text
from .audio import resolve_at


def ass_color(hex_rgb: str, alpha: float = 1.0) -> str:
    h = hex_rgb.lstrip("#")
    r, g, b = h[0:2], h[2:4], h[4:6]
    a = round((1 - alpha) * 255)
    return f"&H{a:02X}{b.upper()}{g.upper()}{r.upper()}"


def ass_time(t: float) -> str:
    t = max(t, 0); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def srt_time(t: float, sep: str = ",") -> str:
    t = max(t, 0); ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def chunk_words(words: list[dict], max_words: int = 3) -> list[list[dict]]:
    """<= 3 words / ~20 chars per caption, break after punctuation, never across scenes."""
    chunks, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        txt = " ".join(x["word"] for x in cur)
        if (len(cur) >= max_words or len(txt) >= 20 or w["word"][-1] in ".,?!…" or nxt is None or nxt["scene"] != w["scene"]
                or (nxt and len(txt) + len(nxt["word"]) > 22)):
            chunks.append(cur); cur = []
    return chunks


def chunk_windows(chunks: list[list[dict]]) -> list[tuple[float, float]]:
    out = []
    for ci, ch in enumerate(chunks):
        nxt_start = chunks[ci + 1][0]["start"] if ci + 1 < len(chunks) else ch[-1]["end"] + 0.4
        out.append((ch[0]["start"], min(nxt_start, ch[-1]["end"] + 0.45)))
    return out


def caption_chunks(tl: dict, hidden: set[int] | None = None) -> list[list[dict]]:
    """Caption chunks of the burned-in captions: narration words minus those an overlay shows instead."""
    if not hidden:
        return chunk_words(tl["words"])
    chunks, run = [], []
    for i, w in enumerate(tl["words"]):
        if i in hidden:
            if run:
                chunks += chunk_words(run); run = []
        else:
            run.append(w)
    return chunks + (chunk_words(run) if run else [])


def build_ass(tl: dict, brand: dict, overlays: list[dict], fmt: dict, plain: bool = False) -> str:
    cs = brand.get("caption_style", {})
    pal = brand.get("palette", {})
    BONE = ass_color(cs.get("primary", pal.get("bone", "#ede6d6")))
    HI = ass_color(cs.get("highlight", pal.get("sodium", "#ff8a1f")))
    SIGNAL = ass_color(pal.get("signal", "#7fd1c7"))
    BOX = ass_color(cs.get("box", pal.get("ink", "#05141a")), cs.get("box_alpha", 0.6))
    W, H = fmt["width"], fmt["height"]
    scale = H / 1920                   # brand sizes are specified for a 1920-px-tall frame
    sz = lambda v: max(1, round(v * scale))
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{cs.get('font', 'OL Caption')},{sz(cs.get('size', 64))},{BONE},{BONE},{BOX},{BOX},0,0,0,0,100,100,0,0,3,{sz(14)},0,2,{sz(cs.get('margin_lr', 120))},{sz(cs.get('margin_lr', 120))},{sz(cs.get('margin_v', 560))},1
Style: Label,OL Caption,{sz(42)},{SIGNAL},{SIGNAL},&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,0,0,8,{sz(80)},{sz(80)},{sz(260)},1
Style: Year,OL Display,{sz(72)},{BONE},{BONE},&H00000000,&H00000000,0,0,0,0,100,100,4,0,1,0,0,8,{sz(80)},{sz(80)},{sz(120)},1
Style: Big,OL Display,{sz(150)},{BONE},{BONE},&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,{sz(60)},{sz(60)},0,1
Style: BigSub,OL Caption,{sz(52)},{SIGNAL},{SIGNAL},&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,0,0,5,{sz(60)},{sz(60)},0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    chunks = caption_chunks(tl, voiced_indices(tl, overlays))
    for (cs_, ce), ch in zip(chunk_windows(chunks), chunks):
        if plain:                                       # documentary style: one quiet line per chunk, no word highlight
            ev.append(f"Dialogue: 1,{ass_time(ch[0]['start'])},{ass_time(ce)},Cap,,0,0,0,,{{\\fad(120,120)}}{' '.join(x['word'] for x in ch)}")
            continue
        for wi, w in enumerate(ch):
            a = w["start"]; b = ch[wi + 1]["start"] if wi + 1 < len(ch) else ce
            parts = [(f"{{\\c{HI}}}{x['word'].rstrip('.,')}{{\\c{BONE}}}{x['word'][len(x['word'].rstrip('.,')):]}" if j == wi else x["word"]) for j, x in enumerate(ch)]
            ev.append(f"Dialogue: 1,{ass_time(a)},{ass_time(b)},Cap,,0,0,0,,{' '.join(parts)}")
    starts = {s["id"]: s for s in tl["scenes"]}
    for ov in overlays:
        typ = ov["type"]
        if typ == "label":
            a = resolve_at(ov["at"], tl)
            ev.append(f"Dialogue: 2,{ass_time(a)},{ass_time(a + ov.get('duration', 3.5))},Label,,0,0,0,,{{\\fad(400,400)}}{ov['text']}")
        elif typ == "counter":
            sc = starts[ov["scene"]]; s0, clip = sc["start"], sc["clip"]
            y0, y1, span = ov["from"], ov["to"], clip * ov.get("span_fraction", 0.86)
            steps = int(span * 12)
            for k in range(steps):
                yr = round(y0 + (y1 - y0) * min(1, (k / (steps - 1)) ** 1.1))
                ev.append(f"Dialogue: 2,{ass_time(s0 + k / 12)},{ass_time(s0 + (k + 1) / 12)},Year,,0,0,0,,{yr}")
            nxt = tl["scenes"][[s["id"] for s in tl["scenes"]].index(ov["scene"]) + 1]["start"]
            ev.append(f"Dialogue: 2,{ass_time(s0 + span)},{ass_time(nxt)},Year,,0,0,0,,{{\\fad(0,200)}}{y1}")
        elif typ in ("big", "bigsub"):
            a = resolve_at(ov["at"], tl); b = resolve_at(ov["until"], tl)
            y = round(ov.get("y", int(1920 * 0.46) + 210) * scale)
            style = "Big" if typ == "big" else "BigSub"
            fs = f"\\fs{sz(ov['size'])}" if ov.get("size") else ""
            ev.append(f"Dialogue: 3,{ass_time(a)},{ass_time(b)},{style},,0,0,0,,{{\\an5\\pos({W // 2},{y}){fs}\\fad(250,150)}}{ov['text']}")
            if typ == "big" and ov.get("sub"):
                dy = sz(max(120, round(ov["size"] * 0.85))) if ov.get("size") else sz(120)
                ev.append(f"Dialogue: 3,{ass_time(a + 0.3)},{ass_time(b)},BigSub,,0,0,0,,{{\\an5\\pos({W // 2},{y + dy})\\fad(250,150)}}{ov['sub']}")
        else:
            raise ValueError(f"unknown overlay type '{typ}'")
    return head + "\n".join(ev) + "\n"


def build_srt_vtt(tl: dict) -> tuple[str, str]:
    chunks = chunk_words(tl["words"])
    srt, vtt = [], ["WEBVTT", ""]
    for i, ((a, b), ch) in enumerate(zip(chunk_windows(chunks), chunks), 1):
        text = " ".join(w["word"] for w in ch)
        srt += [str(i), f"{srt_time(a)} --> {srt_time(b)}", text, ""]
        vtt += [f"{srt_time(a, '.')} --> {srt_time(b, '.')}", text, ""]
    return "\n".join(srt), "\n".join(vtt)


def captions(ctx: Context) -> dict:
    tl = json.loads(ctx.work("timeline.json").read_text())
    d = ctx.project.data
    if (d.get("editorial_rules") or {}).get("phrase_once"):
        problems = check_phrase_once(d, tl)
        if problems:
            raise EngineError("on-screen text breaks the project's editorial rules:\n  - " + "\n  - ".join(problems))
    ass = ctx.work("captions", "captions.ass")
    atomic_write_text(ass, build_ass(tl, d["brand"], d.get("overlays", []), d["format"], plain=(d.get("captions") or {}).get("style") == "plain"))
    srt_txt, vtt_txt = build_srt_vtt(tl)
    srt, vtt = ctx.work("captions", "subtitles.srt"), ctx.work("captions", "subtitles.vtt")
    atomic_write_text(srt, srt_txt); atomic_write_text(vtt, vtt_txt)
    return {"ass": ass, "srt": srt, "vtt": vtt}
