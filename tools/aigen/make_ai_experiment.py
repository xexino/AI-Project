"""Build productions/003-mariana-trench/experiments/ai-stills-v1/project.json from the approved base production:
same narration, timeline, titles, captions and (bit-identical) soundtrack; each beat's visuals = one animated AI still.
Image hashes go into the scene params, so replacing an image re-renders exactly that beat."""
import hashlib, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "productions/003-mariana-trench"
EXP = BASE / "experiments/ai-stills-v1"
MOVES = {  # zoom [start, end], pan [[x0, y0], [x1, y1]] in frame-height units
    "b1": {"zoom": [1.0, 1.08], "pan": [[0, -0.01], [0, 0.015]]},
    "b2": {"zoom": [1.0, 1.18], "pan": [[0, 0], [0, -0.02]]},
    "b3": {"zoom": [1.04, 1.22], "pan": [[0, 0.02], [0, -0.03]]},
    "b4": {"zoom": [1.16, 1.02], "pan": [[0, -0.04], [0, 0.02]]},
    "b5": {"zoom": [1.3, 1.42], "pan": [[0.01, 0.16], [-0.01, 0.2]]},   # crop out the surface glints
    "b6": {"zoom": [1.04, 1.18], "pan": [[0, 0], [0, 0.01]]},
    "b7": {"zoom": [1.1, 1.02], "pan": [[-0.03, 0], [0.03, 0]]},
    "b8": {"zoom": [1.18, 1.0], "pan": [[0, 0.02], [0, 0]]},
}
d = json.loads((BASE / "project.json").read_text())
d["id"] = "003-mariana-trench-ai-stills-v1"
d["scene_root"] = "../.."
d.pop("references", None)
d["visual"]["style"] = "TEST: AI-generated stills (local model, see assets.json), animated with eased push-in/pan and drifting marine snow."
d["visual"]["reuse_frames_from"] = ["../.."]                     # the end card is identical
d["sound"]["audio_from"] = "../.."
d["experiment"] = {"of": "003-mariana-trench", "purpose": "owner-requested fast test of AI-generated imagery (2026-11-16)",
                   "differs_in": "visuals of beats b1-b8 only", "ai_imagery": True}
d["publishing"] = {"enabled": False, "platforms": {}}
for s in d["scenes"]:
    s.pop("references", None)
    if s["id"] in MOVES:
        img = EXP / "images" / f"{s['id']}.png"
        s["module"] = "scenes/ai_still.js"; s.pop("uses_timeline", None)
        s["params"] = {"image": f"experiments/ai-stills-v1/images/{s['id']}.png", "move": MOVES[s["id"]],
                       "image_sha256": hashlib.sha256(img.read_bytes()).hexdigest() if img.exists() else None}
(EXP / "project.json").write_text(json.dumps(d, indent=1, ensure_ascii=False) + "\n")
a = json.loads((BASE / "assets.json").read_text())
a["assets"] = [x for x in a["assets"] if x["id"] != "visuals-mariana"]
for p in sorted((EXP / "images").glob("b*.json")):
    m = json.loads(p.read_text())
    a["assets"].append({"id": f"ai-still-{m['id']}", "file": f"experiments/ai-stills-v1/images/{m['file']} (git-ignored)", "origin": "ai_generated",
        "source_url": "https://huggingface.co/" + m["model"], "creator": f"{m['model']} on {m['base_model']}, local CPU inference",
        "license": m["license"], "commercial_use": True, "attribution": "AI-generated imagery must be disclosed on publication",
        "acquired": "2026-11-16", "verification": "needs_review",
        "evidence": f"prompt: {m['prompt'][:160]} | seed {m['seed']} | steps {m['steps']}"})
a["assets"].append({"id": "visuals-ai-still", "file": "productions/003-mariana-trench/scenes/ai_still.js", "origin": "owned", "source_url": "",
    "creator": "ODDLIGHT", "license": "owned", "commercial_use": True, "attribution": "n/a", "acquired": "2026-11-16", "verification": "verified",
    "evidence": "animation code in this repository"})
(EXP / "assets.json").write_text(json.dumps(a, indent=1, ensure_ascii=False) + "\n")
print("written", EXP / "project.json")
