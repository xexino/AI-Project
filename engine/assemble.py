"""Assemble a production: scene clips -> transitions -> grade -> captions/overlays -> sound design -> master.
Usage: python3 assemble.py <production_dir>
Reads build/timeline.json (from build_vo.py) and build/frames/<scene>/f####.png (from render_all.sh).
All audio is synthesized here or is our own narration: no third-party music or SFX."""
import json, subprocess, sys, pathlib, shutil

PROD = pathlib.Path(sys.argv[1]).resolve()
B = PROD / "build"; T = json.loads((B / "timeline.json").read_text())
FPS, DUR = T["fps"], T["duration"]
FONTS = pathlib.Path(__file__).resolve().parent / "three" / "fonts"
SC = {s["id"]: s for s in T["scenes"]}
OUT = PROD / "output"; OUT.mkdir(exist_ok=True)
run = lambda cmd: subprocess.run(cmd, check=True)
ff = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]

def word_time(scene, w):
    for x in T["words"]:
        if x["scene"] == scene and x["word"].lower().strip(".,!?") == w: return x["start"]
    raise KeyError((scene, w))

# ---------- 1. scene clips ----------
clips = []
for s in T["scenes"]:
    c = B / "clips" / f"{s['id']}.mp4"; c.parent.mkdir(exist_ok=True)
    run(ff + ["-framerate", str(FPS), "-i", str(B / "frames" / s["id"] / "f%04d.png"),
              "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p", str(c)])
    clips.append(c)

# ---------- 2. transitions (xfade chain) ----------
inputs, chain, prev, = [], [], "0:v"
for i, c in enumerate(clips): inputs += ["-i", str(c)]
for i in range(1, len(clips)):
    s_prev, s = T["scenes"][i - 1], T["scenes"][i]
    tr = s_prev["transition"]; kind, d = tr["type"], tr["d"]
    if kind in ("cut", "none") or d <= 0: kind, d = "fade", 1 / FPS
    off = s["start"] if tr["d"] > 0 else s["start"] - d
    label = f"x{i}"
    chain.append(f"[{prev}][{i}:v]xfade=transition={kind}:duration={d:.4f}:offset={off:.4f}[{label}]")
    prev = label

# ---------- 3. captions + overlays (ASS) ----------
def ass_time(t):
    t = max(t, 0); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"
BONE, SODIUM, SIGNAL, INK = "&H00D6E6ED", "&H001F8AFF", "&H00C7D17F", "&H661A1405"
head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,OL Caption,64,{BONE},{BONE},{INK},{INK},0,0,0,0,100,100,0,0,3,14,0,2,120,120,560,1
Style: Label,OL Caption,42,{SIGNAL},{SIGNAL},&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,0,0,8,80,80,260,1
Style: Year,OL Display,72,{BONE},{BONE},&H00000000,&H00000000,0,0,0,0,100,100,4,0,1,0,0,8,80,80,120,1
Style: Big,OL Display,150,{BONE},{BONE},&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,60,60,0,1
Style: BigSub,OL Caption,52,{SIGNAL},{SIGNAL},&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,0,0,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
ev = []
# caption chunks: <=3 words / <=20 chars, break after punctuation, never across scenes
words = T["words"]; chunks, cur = [], []
for i, w in enumerate(words):
    cur.append(w)
    nxt = words[i + 1] if i + 1 < len(words) else None
    txt = " ".join(x["word"] for x in cur)
    if (len(cur) >= 3 or len(txt) >= 20 or w["word"][-1] in ".,?!…" or nxt is None or nxt["scene"] != w["scene"]
            or (nxt and len(txt) + len(nxt["word"]) > 22)):
        chunks.append(cur); cur = []
for ci, ch in enumerate(chunks):
    nxt_start = chunks[ci + 1][0]["start"] if ci + 1 < len(chunks) else ch[-1]["end"] + 0.4
    chunk_end = min(nxt_start, ch[-1]["end"] + 0.45)
    for wi, w in enumerate(ch):
        a = w["start"]; b = ch[wi + 1]["start"] if wi + 1 < len(ch) else chunk_end
        parts = [(f"{{\\c{SODIUM}}}{x['word'].rstrip('.,')}{{\\c{BONE}}}{x['word'][len(x['word'].rstrip('.,')):]}" if j == wi else x["word"]) for j, x in enumerate(ch)]
        ev.append(f"Dialogue: 1,{ass_time(a)},{ass_time(b)},Cap,,0,0,0,,{' '.join(parts)}")
# S6 label
s6 = SC["s6"]["start"]
ev.append(f"Dialogue: 2,{ass_time(s6 + 2.6)},{ass_time(s6 + 6.2)},Label,,0,0,0,,{{\\fad(400,400)}}lens nucleus  ·  formed before birth")
# S7 year counter (illustrative: largest shark ~392 years in 2016 -> born c. 1624), then the big number
s7, s7c = SC["s7"]["start"], SC["s7"]["clip"]
y0, y1, span = 1624, 2016, s7c * 0.86
steps = int(span * 12)
for k in range(steps):
    a = s7 + k / 12; b = s7 + (k + 1) / 12
    yr = round(y0 + (y1 - y0) * min(1, (k / (steps - 1)) ** 1.1))
    ev.append(f"Dialogue: 2,{ass_time(a)},{ass_time(b)},Year,,0,0,0,,{yr}")
ev.append(f"Dialogue: 2,{ass_time(s7 + span)},{ass_time(SC['s8']['start'])},Year,,0,0,0,,{{\\fad(0,200)}}{y1}")
four = word_time("s7", "four")
big_y = int(1920 * 0.46) + 210
ev.append(f"Dialogue: 3,{ass_time(four)},{ass_time(SC['s8']['start'])},Big,,0,0,0,,{{\\an5\\pos(540,{big_y})\\fad(250,150)}}≈ 400 years")
ev.append(f"Dialogue: 3,{ass_time(word_time('s7', 'century') - 0.3)},{ass_time(SC['s8']['start'])},BigSub,,0,0,0,,{{\\an5\\pos(540,{big_y + 120})\\fad(250,150)}}± 120")
ass = B / "captions.ass"; ass.write_text(head + "\n".join(ev) + "\n", encoding="utf-8")

grade = (f"noise=alls=5:allf=t,vignette=PI/4.6,eq=contrast=1.03:saturation=1.04,"
         f"subtitles={ass}:fontsdir={FONTS},format=yuv420p")
chain.append(f"[{prev}]{grade}[v]")

# ---------- 4. sound design (all synthesized) ----------
A = []; ai = len(clips); amix = []
def src(spec):
    global ai
    A.extend(["-f", "lavfi", "-i", spec]); ai += 1; return f"{ai - 1}:a"
vo_labels = []
for s in T["scenes"]:
    if s.get("vo"):
        A.extend(["-i", str(B / "vo" / s["vo"])]); ai += 1
        ms = int(s["vo_start"] * 1000)
        chain.append(f"[{ai - 1}:a]aresample=48000,highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=5:release=120,adelay={ms}|{ms},apad=whole_dur={DUR}[vo{s['id']}]")
        vo_labels.append(f"[vo{s['id']}]")
chain.append(f"{''.join(vo_labels)}amix=inputs={len(vo_labels)}:normalize=0,volume=1.0,asplit=2[vo][key]")
# drone bed + water rumble, ducked by the voice
d1 = src(f"sine=f=55:d={DUR}:r=48000"); d2 = src(f"sine=f=82.41:d={DUR}:r=48000"); rn = src(f"anoisesrc=c=brown:d={DUR}:r=48000:a=0.5")
chain.append(f"[{d1}]volume=0.45[d1];[{d2}]volume=0.22[d2];[{rn}]lowpass=f=180,volume=0.35[rn];"
             f"[d1][d2][rn]amix=inputs=3:normalize=0,tremolo=f=0.35:d=0.3,lowpass=f=420,afade=t=in:d=1.5,afade=t=out:st={DUR - 2.5}:d=2.5[bed0];"
             f"[bed0][key]sidechaincompress=threshold=0.05:ratio=6:attack=20:release=400[bed]")
# pad swell (S7 -> end): A minor add9
pad_in = SC["s7"]["start"]
pads = [src(f"sine=f={f}:d={DUR}:r=48000") for f in (110, 164.81, 246.94, 261.63)]
chain.append("".join(f"[{p}]volume={v}[p{i}];" for i, (p, v) in enumerate(zip(pads, (0.10, 0.07, 0.04, 0.035)))) +
             f"[p0][p1][p2][p3]amix=inputs=4:normalize=0,tremolo=f=0.2:d=0.4,lowpass=f=900,"
             f"afade=t=in:st={pad_in}:d=3.5,afade=t=out:st={DUR - 2.2}:d=2.2[pad]")
amix += ["[bed]", "[pad]"]
def hit(label, spec, at, filt):
    lab = src(spec); ms = int(at * 1000)
    chain.append(f"[{lab}]{filt},adelay={ms}|{ms},apad=whole_dur={DUR}[{label}]"); amix.append(f"[{label}]")
bell = "aecho=0.8:0.7:180|420:0.35|0.2"
hit("bell1", "sine=f=1318.51:d=4:r=48000", 0.25, f"volume=0.16,afade=t=out:st=0.03:d=3.6:curve=exp,{bell}")
hit("bell1b", "sine=f=1975.53:d=3:r=48000", 0.25, f"volume=0.05,afade=t=out:st=0.03:d=2.4:curve=exp,{bell}")
hit("crack", "anoisesrc=c=white:d=0.6:r=48000", word_time("s3", "walk") + 0.1, "bandpass=f=1800:w=2400,volume=0.5,afade=t=out:st=0:d=0.5:curve=exp,aecho=0.6:0.5:60|140:0.3|0.2")
hit("thump", "sine=f=48:d=1.2:r=48000", word_time("s3", "walk") + 0.1, "volume=0.5,afade=t=out:st=0:d=1.1:curve=exp")
s5, s5c = SC["s5"]["start"], SC["s5"]["clip"]
hit("rise", f"aevalsrc='0.06*sin(2*PI*(300*t+60*t*t))':d={s5c}:s=48000", s5, f"afade=t=in:d={s5c * 0.6},afade=t=out:st={s5c - 0.35}:d=0.35,lowpass=f=2500")
hit("pulse", "sine=f=52:d=1.0:r=48000", word_time("s6", "answer"), "volume=0.7,afade=t=out:st=0:d=0.9:curve=exp")
hit("shimmer", "anoisesrc=c=pink:d=5:r=48000:a=0.3", SC["s6"]["start"] + 0.3, "highpass=f=5000,volume=0.12,afade=t=in:d=1.5,afade=t=out:st=2.5:d=2.5")
hit("whoosh", "anoisesrc=c=pink:d=2.2:r=48000", SC["s7"]["start"] - 0.4, "bandpass=f=700:w=900,volume=0.4,afade=t=in:d=1.4,afade=t=out:st=1.4:d=0.8")
hit("boom", "sine=f=38:d=2.0:r=48000", word_time("s7", "century"), "volume=0.8,afade=t=out:st=0:d=1.9:curve=exp")
hit("boomn", "anoisesrc=c=brown:d=1.5:r=48000", word_time("s7", "century"), "lowpass=f=150,volume=0.6,afade=t=out:st=0:d=1.4:curve=exp")
end_t = SC["end"]["start"] + 0.2
hit("bell2", "sine=f=1318.51:d=4:r=48000", end_t, f"volume=0.14,afade=t=out:st=0.03:d=3.0:curve=exp,{bell}")
hit("bell2b", "sine=f=987.77:d=4:r=48000", end_t, f"volume=0.07,afade=t=out:st=0.03:d=3.0:curve=exp,{bell}")
chain.append(f"[vo]{''.join(amix)}amix=inputs={len(amix) + 1}:normalize=0,atrim=0:{DUR},"
             f"loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]")

master = OUT / f"{PROD.name}_master_1080x1920.mp4"
(B / "filter.txt").write_text(";\n".join(chain))
run(ff + inputs + A + ["-filter_complex_script", str(B / "filter.txt"), "-map", "[v]", "-map", "[a]",
     "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", str(FPS),
     "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", f"{DUR:.3f}", "-movflags", "+faststart", str(master)])
print("master:", master)
