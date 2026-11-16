"""Narration + word timing + timeline. Usage: python -I build_vo.py <production_dir>"""
import json, sys, pathlib, re
import soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
from faster_whisper import WhisperModel

d = pathlib.Path(sys.argv[1]); cfg = json.loads((d / "script.json").read_text())
out = d / "build"; (out / "vo").mkdir(parents=True, exist_ok=True)
v = cfg["voice"]
k = Kokoro("/home/user/AI-Project/models/kokoro-v1.0.onnx", "/home/user/AI-Project/models/voices-v1.0.bin")
wm = WhisperModel("base.en", device="cpu", compute_type="int8")
FPS = 24
import difflib
norm = lambda x: re.sub(r"[^a-z0-9']", "", x.lower())
def align(text, ws, total):
    """Map whisper timings onto the exact script words; interpolate any unmatched word."""
    script = [w for w in text.replace("...", " ").split() if norm(w)]
    a = [norm(w) for w in script]; b = [norm(w.word) for w in ws]
    times = [None] * len(script)
    for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for i in range(blk.size):
            times[blk.a + i] = (ws[blk.b + i].start, ws[blk.b + i].end)
    # interpolate gaps
    for i in range(len(times)):
        if times[i] is None:
            prev = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
            nxt = next((times[j][0] for j in range(i + 1, len(times)) if times[j]), total)
            times[i] = (prev, max(prev + 0.05, (prev + nxt) / 2))
    return [{"word": w, "start": s, "end": e, "matched": True} for w, (s, e) in zip(script, times)]
t = 0.0; timeline = []; words_all = []
for sc in cfg["scenes"]:
    seg = {"id": sc["id"], "start": round(t, 4)}
    vo_len = 0.0
    if sc["text"]:
        audio, sr = k.create(sc["text"], voice=v["voice"], speed=v["speed"], lang=v["lang"])
        # trim leading/trailing near-silence
        nz = np.where(np.abs(audio) > 0.01)[0]; audio = audio[max(nz[0]-240,0): nz[-1]+1200]
        p = out / "vo" / f"{sc['id']}.wav"; sf.write(p, audio, sr)
        vo_len = len(audio) / sr
        segs, _ = wm.transcribe(str(p), word_timestamps=True, language="en", condition_on_previous_text=False)
        ws = [w for s in segs for w in s.words]
        vo_start = t + sc["lead"]
        for w in align(sc["text"], ws, vo_len):
            w.update(scene=sc["id"], start=round(vo_start + w["start"], 3), end=round(vo_start + w["end"], 3))
            words_all.append(w)
        seg.update(vo=str(p.name), vo_start=round(vo_start, 4), vo_len=round(vo_len, 3))
    slot = sc["lead"] + vo_len + sc["tail"]
    slot = round(slot * FPS) / FPS                     # frame-align
    tr = sc["transition_out"] or {"type": "none", "d": 0}
    seg.update(slot=slot, transition=tr, clip=round(slot + tr["d"], 4), text=sc["text"])
    timeline.append(seg); t += slot
(out / "timeline.json").write_text(json.dumps({"fps": FPS, "duration": round(t, 3), "scenes": timeline, "words": words_all}, indent=1))
print(f"total {t:.2f}s")
for s in timeline: print(s["id"], "start", s["start"], "slot", s["slot"], "vo", s.get("vo_len"))
print(len(words_all), "words timed")
