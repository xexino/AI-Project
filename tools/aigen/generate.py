"""Local, zero-cost AI still generation for ODDLIGHT experiments (CPU, no API, no account).

Writes one PNG per prompt plus <name>.json provenance (model, revision, licence, prompt, seed, steps, size, seconds).
Run with the separate image-generation environment, not the production engine's .venv:
    ~/aigen-venv/bin/python tools/aigen/generate.py --prompts prompts.json --out DIR [--model latent-consistency/lcm-ssd-1b]
prompts.json: {"style": "...", "negative": "...", "shots": [{"id": "b1", "prompt": "...", "seed": 1}, ...]}
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

MODELS = {
    "latent-consistency/lcm-ssd-1b": {"license": "openrail++ (commercial use allowed, use-based restrictions)", "steps": 4, "guidance": 1.0, "kind": "lcm"},
    "segmind/Segmind-VegaRT": {"license": "apache-2.0", "steps": 4, "guidance": 0.0, "kind": "vegart"},
}


def load(model: str):
    import torch
    from diffusers import DiffusionPipeline, LCMScheduler, UNet2DConditionModel
    torch.set_num_threads(max(1, torch.get_num_threads()))
    if MODELS[model]["kind"] == "lcm":
        unet = UNet2DConditionModel.from_pretrained(model, torch_dtype=torch.float32)
        pipe = DiffusionPipeline.from_pretrained("segmind/SSD-1B", unet=unet, torch_dtype=torch.float32)
    else:
        pipe = DiffusionPipeline.from_pretrained("segmind/Segmind-Vega", torch_dtype=torch.float32)
        pipe.load_lora_weights(model)
        pipe.fuse_lora()
    pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
    pipe.set_progress_bar_config(disable=True)
    return pipe


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompts", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="latent-consistency/lcm-ssd-1b", choices=sorted(MODELS))
    ap.add_argument("--width", type=int, default=768); ap.add_argument("--height", type=int, default=1344)
    ap.add_argument("--steps", type=int); ap.add_argument("--only")
    a = ap.parse_args()
    import torch
    spec = json.loads(Path(a.prompts).read_text())
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    m = MODELS[a.model]
    t0 = time.time(); pipe = load(a.model); load_s = round(time.time() - t0, 1)
    for shot in spec["shots"]:
        if a.only and shot["id"] not in a.only.split(","):
            continue
        prompt = f"{shot['prompt']}, {spec.get('style', '')}".strip(", ")
        g = torch.Generator("cpu").manual_seed(int(shot.get("seed", 1)))
        t1 = time.time()
        img = pipe(prompt=prompt, negative_prompt=spec.get("negative") if m["guidance"] > 1 else None, num_inference_steps=a.steps or m["steps"],
                   guidance_scale=m["guidance"], width=a.width, height=a.height, generator=g).images[0]
        secs = round(time.time() - t1, 1)
        name = shot.get("name", shot["id"])
        img.save(out / f"{name}.png")
        (out / f"{name}.json").write_text(json.dumps({
            "id": shot["id"], "file": f"{name}.png", "generator": "AI image model (local CPU inference, no API)", "model": a.model,
            "base_model": "segmind/SSD-1B (apache-2.0)" if m["kind"] == "lcm" else "segmind/Segmind-Vega (apache-2.0)", "license": m["license"],
            "prompt": prompt, "negative_prompt": spec.get("negative") if m["guidance"] > 1 else None, "seed": int(shot.get("seed", 1)),
            "steps": a.steps or m["steps"], "guidance": m["guidance"], "size": [a.width, a.height], "seconds": secs, "model_load_seconds": load_s,
            "ai_generated": True, "disclosure": "AI-generated image; label the video as containing AI-generated imagery"}, indent=1))
        print(json.dumps({"shot": shot["id"], "seconds": secs}), flush=True)


if __name__ == "__main__":
    main()
