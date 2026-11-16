"""Audio: anchors, sound-effect presets, ambience beds, pads (FFmpeg lavfi graphs) and the synthesized score.

Everything is generated here; there is no third-party music or sample library, so there is nothing to license.
Timing anchors used by cues, overlays and music:
    {"t": 1.5}                                  absolute seconds
    {"scene_start": "s7", "offset": -0.4}       start of a scene (+offset)
    {"word": "walk", "scene": "s3", "offset": 0.1}   a narrated word (first match in that scene)
"""
from __future__ import annotations

import json
import math
from typing import Any

from ..pipeline import Context
from ..util import EngineError, commit_file, fingerprint, tmp_path


def resolve_at(anchor: dict, tl: dict) -> float:
    off = float(anchor.get("offset", 0.0))
    if "t" in anchor:
        return float(anchor["t"]) + off
    if "scene_start" in anchor:
        for s in tl["scenes"]:
            if s["id"] == anchor["scene_start"]:
                return s["start"] + off
        raise EngineError(f"anchor: unknown scene '{anchor['scene_start']}'")
    if "word" in anchor:
        key = anchor["word"].lower()
        for w in tl["words"]:
            if w["scene"] == anchor.get("scene", w["scene"]) and w["word"].lower().strip(".,!?;:") == key:
                return w["start"] + off
        raise EngineError(f"anchor: word '{anchor['word']}' not found in scene {anchor.get('scene')}")
    raise EngineError(f"anchor needs 't', 'scene_start' or 'word': {anchor}")


def scene_clip(tl: dict, sid: str) -> float:
    for s in tl["scenes"]:
        if s["id"] == sid:
            return s["clip"]
    raise EngineError(f"unknown scene '{sid}'")


BELL_ECHO = "aecho=0.8:0.7:180|420:0.35|0.2"
# preset -> (lavfi source template, filter template, defaults). Templates use str.format with the merged params.
SFX: dict[str, tuple[str, str, dict[str, Any]]] = {
    "bell": ("sine=f={freq}:d={d}:r=48000", "volume={vol},afade=t=out:st=0.03:d={fade}:curve=exp," + BELL_ECHO, {"freq": 1318.51, "d": 4, "vol": 0.16, "fade": 3.6}),
    "bell_hi": ("sine=f={freq}:d={d}:r=48000", "volume={vol},afade=t=out:st=0.03:d={fade}:curve=exp," + BELL_ECHO, {"freq": 1975.53, "d": 3, "vol": 0.05, "fade": 2.4}),
    "bell_low": ("sine=f={freq}:d={d}:r=48000", "volume={vol},afade=t=out:st=0.03:d={fade}:curve=exp," + BELL_ECHO, {"freq": 987.77, "d": 4, "vol": 0.07, "fade": 3.0}),
    "crack": ("anoisesrc=c=white:d={d}:r=48000", "bandpass=f=1800:w=2400,volume={vol},afade=t=out:st=0:d={fade}:curve=exp,aecho=0.6:0.5:60|140:0.3|0.2", {"d": 0.6, "vol": 0.5, "fade": 0.5}),
    "thump": ("sine=f={freq}:d={d}:r=48000", "volume={vol},afade=t=out:st=0:d={fade}:curve=exp", {"freq": 48, "d": 1.2, "vol": 0.5, "fade": 1.1}),
    "pulse": ("sine=f={freq}:d={d}:r=48000", "volume={vol},afade=t=out:st=0:d={fade}:curve=exp", {"freq": 52, "d": 1.0, "vol": 0.7, "fade": 0.9}),
    "boom": ("sine=f={freq}:d={d}:r=48000", "volume={vol},afade=t=out:st=0:d={fade}:curve=exp", {"freq": 38, "d": 2.0, "vol": 0.8, "fade": 1.9}),
    "boom_noise": ("anoisesrc=c=brown:d={d}:r=48000", "lowpass=f=150,volume={vol},afade=t=out:st=0:d={fade}:curve=exp", {"d": 1.5, "vol": 0.6, "fade": 1.4}),
    "rise": ("aevalsrc='0.06*sin(2*PI*(300*t+60*t*t))':d={d}:s=48000", "afade=t=in:d={fade_in},afade=t=out:st={fade_out_st}:d=0.35,lowpass=f=2500", {"d": 4.0}),
    "shimmer": ("anoisesrc=c=pink:d={d}:r=48000:a=0.3", "highpass=f=5000,volume={vol},afade=t=in:d=1.5,afade=t=out:st={st}:d={fo}", {"d": 5, "vol": 0.12, "st": 2.5, "fo": 2.5}),
    "whoosh": ("anoisesrc=c=pink:d={d}:r=48000", "bandpass=f=700:w=900,volume={vol},afade=t=in:d={fi},afade=t=out:st={st}:d={fo}", {"d": 2.2, "vol": 0.4, "fi": 1.4, "st": 1.4, "fo": 0.8}),
    "fireball_roar": ("anoisesrc=c=brown:d={d}:r=48000", "lowpass=f=520,highpass=f=35,tremolo=f=7:d=0.3,volume={vol},afade=t=in:d={fi},afade=t=out:st={st}:d={fo}", {"d": 5.0, "vol": 0.9, "fi": 1.4, "fo": 1.6}),
    "flash_swell": ("anoisesrc=c=pink:d={d}:r=48000", "highpass=f=1200,lowpass=f=7000,volume={vol},afade=t=in:d={d}:curve=exp", {"d": 0.9, "vol": 0.3}),
    "shockwave": ("anoisesrc=c=brown:d={d}:r=48000", "lowpass=f=700,volume={vol},afade=t=in:d=0.04,afade=t=out:st=0.5:d={fo}", {"d": 4.0, "vol": 1.0, "fo": 3.4}),
    "wind_gust": ("anoisesrc=c=pink:d={d}:r=48000", "bandpass=f=450:w=500,tremolo=f=0.5:d=0.6,volume={vol},afade=t=in:d=1.2,afade=t=out:st={st}:d=1.4", {"d": 4.5, "vol": 0.45}),
}


def sfx_spec(cue: dict, tl: dict) -> tuple[str, str]:
    preset = cue.get("preset")
    if preset not in SFX:
        raise EngineError(f"unknown sound preset '{preset}' (available: {', '.join(sorted(SFX))})")
    src, filt, defaults = SFX[preset]
    p = dict(defaults)
    p.update({k: v for k, v in cue.items() if k not in ("preset", "at", "level")})
    if isinstance(p.get("d"), str) and p["d"].startswith("scene_clip:"):
        p["d"] = scene_clip(tl, p["d"].split(":", 1)[1])
    if "level" in cue and "vol" in p:
        p["vol"] = round(p["vol"] * float(cue["level"]), 4)
    p.setdefault("fade_in", p["d"] * 0.6); p.setdefault("fade_out_st", p["d"] - 0.35)
    p.setdefault("st", round(p["d"] - p.get("fo", 1.2), 3))
    return src.format(**p), filt.format(**p)


def bed_graph(bed: dict, dur: float, src) -> str:
    """Returns filter text producing [bed0] (to be ducked by the voice key). src(spec) -> input label."""
    preset = bed.get("preset")
    lvl = float(bed.get("level", 1.0))
    if preset == "drone_bed":
        d1 = src(f"sine=f=55:d={dur}:r=48000"); d2 = src(f"sine=f=82.41:d={dur}:r=48000"); rn = src(f"anoisesrc=c=brown:d={dur}:r=48000:a=0.5")
        v = (lambda x: x) if lvl == 1.0 else (lambda x: round(x * lvl, 4))
        return (f"[{d1}]volume={v(0.45)}[d1];[{d2}]volume={v(0.22)}[d2];[{rn}]lowpass=f=180,volume={v(0.35)}[rn];"
                f"[d1][d2][rn]amix=inputs=3:normalize=0,tremolo=f=0.35:d=0.3,lowpass=f=420,afade=t=in:d=1.5,afade=t=out:st={dur - 2.5}:d=2.5[bed0]")
    if preset == "wind_bed":
        a = src(f"anoisesrc=c=brown:d={dur}:r=48000:a=0.5"); b = src(f"anoisesrc=c=pink:d={dur}:r=48000:a=0.3:seed=7")
        return (f"[{a}]lowpass=f=260,volume={round(0.5 * lvl, 4)}[w1];[{b}]bandpass=f=420:w=380,tremolo=f=0.13:d=0.7,volume={round(0.35 * lvl, 4)}[w2];"
                f"[w1][w2]amix=inputs=2:normalize=0,afade=t=in:d=1.5,afade=t=out:st={dur - 2.5}:d=2.5[bed0]")
    raise EngineError(f"unknown bed preset '{preset}' (drone_bed, wind_bed)")


def pad_graph(pad: dict, dur: float, start: float, src) -> str:
    freqs = pad.get("freqs", [110, 164.81, 246.94, 261.63]); vols = pad.get("vols", [0.10, 0.07, 0.04, 0.035])
    labs = [src(f"sine=f={f}:d={dur}:r=48000") for f in freqs]
    return ("".join(f"[{p}]volume={v}[p{i}];" for i, (p, v) in enumerate(zip(labs, vols))) +
            f"{''.join(f'[p{i}]' for i in range(len(labs)))}amix=inputs={len(labs)}:normalize=0,tremolo=f=0.2:d=0.4,lowpass=f=900,"
            f"afade=t=in:st={start}:d=3.5,afade=t=out:st={dur - 2.2}:d=2.2[pad]")


# ---------------- synthesized score ----------------
NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def note_hz(n: str) -> float:
    name, octave = n[:-1], int(n[-1])
    return 440.0 * 2 ** ((NOTE[name] + 12 * (octave + 1) - 69) / 12)


def music_fingerprint(ctx: Context) -> Any:
    tl_path = ctx.work("timeline.json")
    tl = json.loads(tl_path.read_text()) if tl_path.exists() else {}
    return fingerprint(ctx.project.data.get("music"), tl.get("duration"), [(w["word"], w["start"]) for w in tl.get("words", [])], [(s["id"], s["start"]) for s in tl.get("scenes", [])])


def synth_score(cfg: dict, tl: dict, sr: int = 48000):
    """Pad + sub + soft low hits, additive synthesis with slow chord crossfades and an FFT reverb.
    Deterministic (seeded); returns a stereo float32 array."""
    import numpy as np
    dur = tl["duration"]
    n = int(dur * sr)
    t = np.arange(n) / sr
    out = np.zeros((n, 2), dtype=np.float64)
    secs = sorted(({**s, "_t": resolve_at(s["from"], tl)} for s in cfg["sections"]), key=lambda s: s["_t"])
    rng = np.random.default_rng(1234)
    for i, sec in enumerate(secs):
        a, b = sec["_t"], (secs[i + 1]["_t"] if i + 1 < len(secs) else dur)
        cs = float(sec.get("chord_s", 3.0)); chords = sec["chords"]
        k, c0 = 0, a
        while c0 < b - 0.05:
            c1 = min(c0 + cs, b)
            chord = chords[k % len(chords)]
            i0, i1 = int(max(c0 - 0.6, 0) * sr), min(int((c1 + 0.9) * sr), n)
            tt = t[i0:i1] - c0
            env = np.clip((tt + 0.6) / 1.2, 0, 1) * np.clip((c1 + 0.9 - c0 - tt) / 1.5, 0, 1)
            env = env * env * (3 - 2 * env)
            bright = float(sec.get("brightness", 0.3)); lvl = float(sec.get("level", 0.6))
            for j, nm in enumerate(chord):
                f0 = note_hz(nm)
                for det, pan in ((-0.0035, 0.3), (0.0035, 0.7)):
                    ph = rng.uniform(0, 2 * math.pi)
                    voice = np.zeros_like(tt)
                    for h in range(1, 9):
                        amp = (1 / h) * math.exp(-(h - 1) * (1.6 - 1.4 * bright))
                        if f0 * h > 9000:
                            break
                        voice += amp * np.sin(2 * math.pi * f0 * (1 + det) * h * tt + ph * h)
                    trem = 1 + 0.08 * np.sin(2 * math.pi * (0.13 + 0.05 * j) * tt + j)
                    g = lvl * env * trem * voice * (0.9 if f0 < 120 else 0.6) / max(len(chord), 1)
                    out[i0:i1, 0] += g * (1 - pan); out[i0:i1, 1] += g * pan
            c0 = c1; k += 1
    for hit in cfg.get("hits", []):
        at = resolve_at(hit["at"], tl); lv = float(hit.get("level", 1.0))
        i0 = int(at * sr); i1 = min(n, i0 + int(2.6 * sr))
        tt = t[i0:i1] - at
        f = 55 * np.exp(-tt * 1.8) + 32
        body = np.sin(2 * math.pi * np.cumsum(f) / sr) * np.exp(-tt * 2.2)
        noise = rng.standard_normal(len(tt)) * np.exp(-tt * 9) * 0.25
        out[i0:i1, 0] += lv * (body + noise) * 0.9; out[i0:i1, 1] += lv * (body + noise) * 0.9
    # FFT convolution reverb with a decaying stereo noise impulse
    ir_len = int(2.8 * sr)
    tail = np.exp(-np.arange(ir_len) / sr * 2.4)
    for ch in range(2):
        ir = rng.standard_normal(ir_len) * tail * 0.018; ir[0] = 1.0
        L = n + ir_len
        N = 1 << (L - 1).bit_length()
        wet = np.fft.irfft(np.fft.rfft(out[:, ch], N) * np.fft.rfft(ir, N), N)[:n]
        out[:, ch] = 0.55 * out[:, ch] + 0.45 * wet
    fade = float(cfg.get("end_fade_s", 2.0))
    out[-int(fade * sr):] *= np.linspace(1, 0, int(fade * sr))[:, None]
    out[: int(0.8 * sr)] *= np.linspace(0, 1, int(0.8 * sr))[:, None]
    peak = np.max(np.abs(out)) or 1.0
    gain = 10 ** (float(cfg.get("master_db", -20)) / 20) / (np.sqrt(np.mean(out ** 2)) + 1e-9)
    out = out * min(gain, 0.98 / peak)
    return out.astype("float32")


def music(ctx: Context) -> dict:
    cfg = ctx.project.data.get("music")
    if not cfg:
        ctx.log.info("music_skipped", reason="no music section in project")
        return {}
    if cfg.get("provider", "synth") != "synth":
        raise EngineError(f"music provider '{cfg.get('provider')}' is not available (only 'synth')")
    import soundfile as sf
    tl = json.loads(ctx.work("timeline.json").read_text())
    audio = synth_score(cfg, tl)
    out = ctx.work("audio", "music.wav")
    tmp = tmp_path(out)
    sf.write(tmp, audio, 48000, subtype="PCM_24")
    commit_file(tmp, out)
    ctx.state.add_cost("music", "synth", "oddlight-additive-v1", tl["duration"], "seconds", False)
    return {"music": out}
