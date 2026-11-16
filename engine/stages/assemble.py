"""Assembly: scene clips -> transitions (xfade) -> grade (+ optional bloom) -> burned captions/overlays,
narration + synthesized sound design + optional score, loudness-normalised master (H.264 High / AAC 48 kHz)."""
from __future__ import annotations

import json
from pathlib import Path

from ..pipeline import Context
from ..providers.render import THREE_DIR
from ..util import FFMPEG, commit_file, fingerprint, hash_tree, run, tmp_path
from .audio import bed_graph, pad_graph, resolve_at, sfx_spec

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

    def src(spec: str) -> str:
        nonlocal ai
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
    for i, cue in enumerate(sound.get("cues", [])):
        spec, filt = sfx_spec(cue, tl)
        lab = src(spec); ms = int(resolve_at(cue["at"], tl) * 1000)
        chain.append(f"[{lab}]{filt},adelay={ms}|{ms},apad=whole_dur={dur}[c{i}]"); amix.append(f"[c{i}]")
    q = ctx.project.data["qc"]
    chain.append(f"[vo]{''.join(amix)}amix=inputs={len(amix) + 1}:normalize=0,atrim=0:{dur},"
                 f"loudnorm=I={q['loudness_lufs']:g}:TP=-1.5:LRA=11,aresample=48000[a]")
    return inputs + A, chain


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
    inputs, chain = build_graph(ctx, tl, clips, ctx.work("captions", "captions.ass"), music)
    graph = ctx.work("assemble", "filter.txt"); graph.write_text(";\n".join(chain))
    master = ctx.work("master", f"{ctx.project.id}_master.mp4")
    tmp = tmp_path(master)
    run(FFMPEG + inputs + ["-filter_complex_script", str(graph), "-map", "[v]", "-map", "[a]",
                           "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", str(fps),
                           "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", f"{tl['duration']:.3f}", "-movflags", "+faststart", str(tmp)],
        log=ctx.log, timeout=7200)
    commit_file(tmp, master)
    # delivery encode (smaller, upload-friendly; grain-tuned), audio copied bit-exact
    final = ctx.work("master", "final_video.mp4")
    tmp = tmp_path(final)
    run(FFMPEG + ["-i", str(master), "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-tune", "grain", "-profile:v", "high",
                  "-pix_fmt", "yuv420p", "-maxrate", "12M", "-bufsize", "24M", "-c:a", "copy", "-movflags", "+faststart", str(tmp)], log=ctx.log, timeout=7200)
    commit_file(tmp, final)
    return {"master": master, "final": final, "filter": graph}
