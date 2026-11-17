"""Narration (TTS per scene) and timing (word alignment + scene timeline)."""
from __future__ import annotations

import json

from ..pipeline import Context
from ..util import EngineError, atomic_write_json, commit_file, tmp_path


def narration(ctx: Context) -> dict:
    import numpy as np
    import soundfile as sf
    n = ctx.project.data["narration"]
    tts = ctx.provider("tts", n["provider"])
    ctx.budget.check(tts.info, 0.0)
    outs, meta = {}, {}
    chars = 0
    for s in ctx.project.scenes:
        if not s["text"].strip():
            continue
        extra = {"pronunciations": n["pronunciations"]} if n.get("pronunciations") else {}
        audio, sr = tts.synthesize(s["text"], voice=s.get("voice", n["voice"]), lang=n["lang"], speed=s.get("speed", n["speed"]), **extra)   # per-scene voice: dialogue
        nz = np.where(np.abs(audio) > 0.01)[0]
        if len(nz) == 0:
            raise EngineError(f"TTS returned silence for scene {s['id']}")
        audio = audio[max(nz[0] - 240, 0): nz[-1] + 1200]
        out = ctx.work("vo", f"{s['id']}.wav")
        tmp = tmp_path(out)
        sf.write(tmp, audio, sr)
        commit_file(tmp, out)
        outs[f"vo_{s['id']}"] = out
        meta[s["id"]] = {"file": out.name, "seconds": round(len(audio) / sr, 3), "sample_rate": sr}
        chars += len(s["text"])
    ctx.budget.record("narration", tts.info, chars, "characters")
    m = ctx.work("vo", "vo.json")
    atomic_write_json(m, meta)
    outs["vo_meta"] = m
    return outs


def timing(ctx: Context) -> dict:
    p = ctx.project
    fps = p.fmt["fps"]
    vo = json.loads(ctx.work("vo", "vo.json").read_text())
    al = ctx.provider("aligner", p.data["narration"].get("aligner", "whisper"))
    t, scenes, words = 0.0, [], []
    for s in p.scenes:
        seg = {"id": s["id"], "start": round(t, 4)}
        vo_len = 0.0
        if s["id"] in vo:
            vo_len = vo[s["id"]]["seconds"]
            wav = ctx.work("vo", vo[s["id"]]["file"])
            vo_start = t + s["lead"]
            for w in al.align(str(wav), s["text"], vo_len):
                w.update(scene=s["id"], start=round(vo_start + w["start"], 3), end=round(vo_start + w["end"], 3))
                words.append(w)
            seg.update(vo=vo[s["id"]]["file"], vo_start=round(vo_start, 4), vo_len=round(vo_len, 3))
        slot = round((s["lead"] + vo_len + s["tail"]) * fps) / fps
        tr = s["transition_out"] or {"type": "none", "d": 0}
        seg.update(slot=slot, transition=tr, clip=round(slot + tr["d"], 4), text=s["text"])
        scenes.append(seg)
        t += slot
    ctx.budget.record("timing", al.info, len(words), "words")
    lo, hi = p.fmt.get("target_duration_s", [0, 1e9])
    if not lo <= t <= hi:
        ctx.log.warn("duration_outside_target", seconds=round(t, 2), target=f"{lo}-{hi}")
    out = ctx.work("timeline.json")
    atomic_write_json(out, {"fps": fps, "duration": round(t, 3), "scenes": scenes, "words": words})
    return {"timeline": out}
