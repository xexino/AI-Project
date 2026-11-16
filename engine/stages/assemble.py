"""Assembly: scene clips -> transitions (xfade) -> grade (+ optional bloom) -> burned captions/overlays,
narration + synthesized sound design + optional score, loudness-normalised master (H.264 High / AAC 48 kHz)."""
from __future__ import annotations

import json
from pathlib import Path

from ..pipeline import Context
from ..providers.render import THREE_DIR
from ..util import FFMPEG, EngineError, commit_file, fingerprint, hash_tree, run, tmp_path
from .audio import bed_graph, pad_graph, resolve_at, seeded, sfx_spec

FONTS = THREE_DIR / "fonts"


def assemble_fingerprint(ctx: Context):
    d = ctx.project.data
    return fingerprint(d.get("visual"), d.get("sound"), d.get("format"), [(s["id"], s["transition_out"]) for s in d["scenes"]],
                       hash_tree(sorted(FONTS.glob("*.ttf"))))


def grade_chain(g: dict, ass: Path, prev: str) -> list[str]:
    grade = (f"noise=alls={g.get('grain', 5)}:allf=t,vignette={g.get('vignette', 'PI/4.6')},"
             f"eq=contrast={g.get('contrast', 1.03)}:saturation={g.get('saturation', 1.04)},"
             f"subtitles={ass}:fontsdir={FONTS},format=yuv420p")
    if float(g.get("bloom", 0) or 0) > 0:
        return [f"[{prev}]split[g0][g1]", "[g1]curves=all='0/0 0.62/0 1/1',gblur=sigma=26[g2]",
                f"[g0][g2]blend=all_mode=screen:all_opacity={g['bloom']}[g3]", f"[g3]{grade}[v]"]
    return [f"[{prev}]{grade}[v]"]


def build_graph(ctx: Context, tl: dict, clips: list[Path], ass: Path, music: Path | None) -> tuple[list[str], list[str]]:
    fps, dur = tl["fps"], tl["duration"]
    inputs: list[str] = []
    for c in clips:
        inputs += ["-i", str(c)]
    chain, prev = [], "0:v"
    for i in range(1, len(clips)):
        s_prev, s = tl["scenes"][i - 1], tl["scenes"][i]
        tr = s_prev["transition"]; kind, d = tr["type"], tr["d"]
        if kind in ("cut", "none") or d <= 0:
            kind, d = "fade", 1 / fps
        off = s["start"] if tr["d"] > 0 else s["start"] - d
        chain.append(f"[{prev}][{i}:v]xfade=transition={kind}:duration={d:.4f}:offset={off:.4f}[x{i}]")
        prev = f"x{i}"
    chain += grade_chain(ctx.project.data["visual"].get("grade", {}), ass, prev)

    A: list[str] = []
    ai = len(clips)
    sound_seed = (ctx.project.data.get("sound") or {}).get("seed")
    nseed = 0
    ctx.options["_audio_from"] = len(chain)            # statements before this index are video-only

    def src(spec: str) -> str:
        nonlocal ai, nseed
        if sound_seed is not None and spec.startswith("anoisesrc"):
            nseed += 1
            spec = seeded(spec, int(sound_seed) + 7 * nseed)
        A.extend(["-f", "lavfi", "-i", spec]); ai += 1
        return f"{ai - 1}:a"

    vo_labels = []
    for s in tl["scenes"]:
        if s.get("vo"):
            A.extend(["-i", str(ctx.work("vo", s["vo"]))]); ai += 1
            ms = int(s["vo_start"] * 1000)
            chain.append(f"[{ai - 1}:a]aresample=48000,highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=5:release=120,adelay={ms}|{ms},apad=whole_dur={dur}[vo{s['id']}]")
            vo_labels.append(f"[vo{s['id']}]")
    sound = ctx.project.data.get("sound") or {}
    keys = 1 + (1 if sound.get("bed") else 0) + (1 if music else 0)
    key_labels = ["[vo]"] + [f"[key{k}]" for k in range(1, keys)]
    chain.append(f"{''.join(vo_labels)}amix=inputs={len(vo_labels)}:normalize=0,volume=1.0,asplit={keys}{''.join(key_labels)}" if keys > 1
                 else f"{''.join(vo_labels)}amix=inputs={len(vo_labels)}:normalize=0,volume=1.0[vo]")
    if keys == 2 and sound.get("bed") and not music:
        chain[-1] = chain[-1].replace("[key1]", "[key]")  # identical graph to the v1 pilot
    amix: list[str] = []
    k = 1
    if sound.get("bed"):
        chain.append(bed_graph(sound["bed"], dur, src))
        key = "[key]" if (keys == 2 and not music) else f"[key{k}]"
        chain.append(f"[bed0]{key}sidechaincompress=threshold=0.05:ratio=6:attack=20:release=400[bed]")
        amix.append("[bed]"); k += 1
    if sound.get("pad"):
        chain.append(pad_graph(sound["pad"], dur, resolve_at(sound["pad"]["start"], tl), src))
        amix.append("[pad]")
    if music:
        A.extend(["-i", str(music)]); ai += 1
        chain.append(f"[{ai - 1}:a]aresample=48000,aformat=channel_layouts=stereo[mus0];[mus0][key{k}]sidechaincompress=threshold=0.06:ratio=4:attack=30:release=500[mus]")
        amix.append("[mus]")
    base_seed = sound.get("seed")
    for i, cue in enumerate(sound.get("cues", [])):
        spec, filt = sfx_spec(cue, tl)
        spec = seeded(spec, None if base_seed is None else int(base_seed) + 101 * i)
        lab = src(spec); ms = int(resolve_at(cue["at"], tl) * 1000)
        chain.append(f"[{lab}]{filt},adelay={ms}|{ms},apad=whole_dur={dur}[c{i}]"); amix.append(f"[c{i}]")
    q = ctx.project.data["qc"]
    measured = ctx.options.get("_loudness_measured")
    ln = f"loudnorm=I={q['loudness_lufs']:g}:TP=-1.5:LRA=11"
    if measured == "measure":
        ln += ":print_format=json"
    elif measured:
        ln += (f":measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:measured_LRA={measured['input_lra']}"
               f":measured_thresh={measured['input_thresh']}:offset={measured['target_offset']}:linear=true")
    chain.append(f"[vo]{''.join(amix)}amix=inputs={len(amix) + 1}:normalize=0,atrim=0:{dur},{ln},aresample=48000[a]")
    return inputs + A, chain


def measure_loudness(ctx: Context, tl: dict, clips: list[Path], ass: Path, music: Path | None) -> dict:
    """First pass of two-pass loudness normalisation: render the audio graph only and read loudnorm's measurement."""
    ctx.options["_loudness_measured"] = "measure"
    inputs, chain = build_graph(ctx, tl, clips, ass, music)
    audio = chain[ctx.options["_audio_from"]:]
    graph = ctx.work("assemble", "filter_measure.txt"); graph.write_text(";\n".join(audio))
    p = run(["ffmpeg", "-hide_banner", "-loglevel", "info", "-y"] + inputs + ["-filter_complex_script", str(graph), "-map", "[a]", "-f", "null", "-"], log=ctx.log, timeout=3600)
    txt = p.stderr[p.stderr.rfind("{"): p.stderr.rfind("}") + 1]
    return json.loads(txt)


def audio_from_master(ctx: Context, tl: dict) -> Path | None:
    """sound.audio_from: reuse a base production's mastered soundtrack (experiments that change only visuals).
    Refuses unless the base timeline is identical (same durations, words and scene starts)."""
    rel = (ctx.project.data.get("sound") or {}).get("audio_from")
    if not rel:
        return None
    from ..project import load
    base = load(ctx.project.dir / rel)
    btl = json.loads((base.work / "timeline.json").read_text())
    key = lambda t: [t["duration"], [(s["id"], s["start"], s["clip"]) for s in t["scenes"]], [(w["word"], w["start"], w["end"]) for w in t["words"]]]
    if key(btl) != key(tl):
        raise EngineError(f"sound.audio_from: timeline differs from {base.id}; the soundtrack cannot be reused")
    m = base.work / "master" / f"{base.id}_master.mp4"
    if not m.is_file():
        raise EngineError(f"sound.audio_from: base master not found: {m}")
    ctx.log.info("audio_reused", source=str(m))
    return m


def assemble(ctx: Context) -> dict:
    tl = json.loads(ctx.work("timeline.json").read_text())
    fps = tl["fps"]
    clips = []
    for s in tl["scenes"]:
        c = ctx.work("clips", f"{s['id']}.mp4")
        tmp = tmp_path(c)
        run(FFMPEG + ["-framerate", str(fps), "-i", str(ctx.work("frames", s["id"], "f%04d.png")),
                      "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p", str(tmp)], log=ctx.log)
        commit_file(tmp, c); clips.append(c)
    music = ctx.work("audio", "music.wav")
    music = music if (ctx.project.data.get("music") and music.exists()) else None
    ass = ctx.work("captions", "captions.ass")
    if (ctx.project.data.get("sound") or {}).get("loudness") == "two_pass":
        ctx.options["_loudness_measured"] = measure_loudness(ctx, tl, clips, ass, music)
        ctx.log.info("loudness_measured", **{k: ctx.options["_loudness_measured"][k] for k in ("input_i", "input_tp", "input_lra")})
    inputs, chain = build_graph(ctx, tl, clips, ass, music)
    ctx.options.pop("_loudness_measured", None)
    audio_src = audio_from_master(ctx, tl)
    if audio_src is not None:                     # keep another production's finished soundtrack bit-for-bit
        chain = chain[: ctx.options["_audio_from"]]
        inputs = inputs[: 2 * len(clips)] + ["-i", str(audio_src)]
        amap = f"{len(clips)}:a"
    else:
        amap = "[a]"
    graph = ctx.work("assemble", "filter.txt"); graph.write_text(";\n".join(chain))
    master = ctx.work("master", f"{ctx.project.id}_master.mp4")
    tmp = tmp_path(master)
    graph.write_text(";\n".join(chain))
    run(FFMPEG + inputs + ["-filter_complex_script", str(graph), "-map", "[v]", "-map", amap,
                           "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", str(fps),
                           *(["-c:a", "copy"] if audio_src is not None else ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"]),
                           "-t", f"{tl['duration']:.3f}", "-movflags", "+faststart", str(tmp)],
        log=ctx.log, timeout=7200)
    commit_file(tmp, master)
    # delivery encode (smaller, upload-friendly; grain-tuned), audio copied bit-exact
    final = ctx.work("master", "final_video.mp4")
    tmp = tmp_path(final)
    run(FFMPEG + ["-i", str(master), "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-tune", "grain", "-profile:v", "high",
                  "-pix_fmt", "yuv420p", "-maxrate", "12M", "-bufsize", "24M", "-c:a", "copy", "-movflags", "+faststart", str(tmp)], log=ctx.log, timeout=7200)
    commit_file(tmp, final)
    return {"master": master, "final": final, "filter": graph}
