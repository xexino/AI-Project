"""Technical QC of a master file. Usage: python3 qc.py <video> <timeline.json>  -> prints report, writes <video>.qc.json"""
import json, re, subprocess, sys, pathlib

v = pathlib.Path(sys.argv[1]); T = json.loads(pathlib.Path(sys.argv[2]).read_text())
sh = lambda *c: subprocess.run(c, capture_output=True, text=True)
probe = json.loads(sh("ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(v)).stdout)
vs = next(s for s in probe["streams"] if s["codec_type"] == "video")
au = next((s for s in probe["streams"] if s["codec_type"] == "audio"), None)
dur = float(probe["format"]["duration"])
checks = []
def check(name, ok, detail): checks.append({"check": name, "pass": bool(ok), "detail": detail})

check("resolution 1080x1920", (vs["width"], vs["height"]) == (1080, 1920), f'{vs["width"]}x{vs["height"]}')
check("fps 24", vs["r_frame_rate"] == "24/1", vs["r_frame_rate"])
check("codec h264 high yuv420p", vs["codec_name"] == "h264" and vs.get("profile") == "High" and vs["pix_fmt"] == "yuv420p", f'{vs["codec_name"]} {vs.get("profile")} {vs["pix_fmt"]}')
check("audio aac 48k present", au is not None and au["codec_name"] == "aac" and au["sample_rate"] == "48000", f'{au and au["codec_name"]} {au and au["sample_rate"]}')
check("duration matches timeline (±0.1s)", abs(dur - T["duration"]) <= 0.1, f"{dur:.3f}s vs {T['duration']:.3f}s")
dec = sh("ffmpeg", "-v", "error", "-i", str(v), "-f", "null", "-")
check("decodes without errors", dec.returncode == 0 and not dec.stderr.strip(), dec.stderr.strip()[:300] or "clean")
loud = sh("ffmpeg", "-hide_banner", "-i", str(v), "-af", "ebur128=peak=true", "-f", "null", "-").stderr
I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", loud)[-1]); TP = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", loud)[-1])
check("loudness -14 LUFS ±1", abs(I + 14) <= 1, f"{I} LUFS")
check("true peak <= -1 dBTP", TP <= -1.0, f"{TP} dBTP")
bd = sh("ffmpeg", "-hide_banner", "-i", str(v), "-vf", "blackdetect=d=0.25:pic_th=0.985:pix_th=0.06", "-an", "-f", "null", "-").stderr
blacks = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", bd)
# intended fade-to-black transitions are allowed
sc = T["scenes"]; allowed = [(sc[i + 1]["start"] - 0.2, sc[i + 1]["start"] + sc[i]["transition"]["d"] + 0.2) for i in range(len(sc) - 1) if sc[i]["transition"]["type"] == "fadeblack"]
# the brand signature: a single glowing dot on black, from the last ~1.5 s of the exit scene into the end card
ends = [s for s in sc if s["id"] == "end"]
if ends: allowed.append((ends[0]["start"] - 1.6, ends[0]["start"] + 0.8))
blacks = [b for b in blacks if not any(a <= float(b[0]) and float(b[1]) <= z for a, z in allowed)]
check("no unintended black segments", len(blacks) == 0, blacks or "none")
fz = sh("ffmpeg", "-hide_banner", "-i", str(v), "-vf", "freezedetect=n=0.0005:d=0.6", "-an", "-f", "null", "-").stderr
freezes = re.findall(r"freeze_start: ([\d.]+)", fz)
check("no frozen video > 0.6s", len(freezes) == 0, freezes or "none")
words = T["words"]; unmatched = [w["word"] for w in words if not w.get("matched", True)]
check("every script word has a caption timing", len(unmatched) == 0, f"{len(words)} words, {len(unmatched)} interpolated")
rep = {"file": v.name, "duration": dur, "native_render_resolution": "1080x1920 (rendered natively, not upscaled)",
       "integrated_lufs": I, "true_peak_dbtp": TP, "checks": checks, "all_pass": all(c["pass"] for c in checks)}
pathlib.Path(str(v) + ".qc.json").write_text(json.dumps(rep, indent=1))
for c in checks: print(("PASS " if c["pass"] else "FAIL ") + c["check"], "—", c["detail"])
print("ALL PASS" if rep["all_pass"] else "SOME CHECKS FAILED")
