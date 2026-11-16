"""Visual-reference registry: optional, per-scene art-direction guidance for procedural productions.

A project opts in with `"references": "<path to references.json>"` (relative to the project directory) and lists
reference ids per scene (`"references": ["frame_04"]`). The registry records, for every reference frame:
  image (optional file, relative to the registry), image_sha256 (pinned hash), metadata JSON, small preview,
  scenes it guides, palette / lighting / camera / composition / material / environment guidance and a
  vertical (9:16) composition guide for adapting 16:9 references to the vertical output.

References are GUIDANCE ONLY: images are never composited into the video. They influence rendering through the
scene params the engine passes to referenced scenes (`look`, `refs`), and they are part of each referenced scene's
fingerprint, so changing an image or its metadata re-renders exactly the scenes that use it.
Missing optional images produce a warning that is carried into the QC editorial record; missing required images,
hash mismatches, unreadable images and paths escaping the project are errors."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from .util import EngineError, sha256_file

GUIDANCE_KEYS = ("palette", "lighting", "camera", "composition", "materials", "environment")
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}


def _inside(root: Path, p: Path) -> bool:
    try:
        p.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def probe_image(path: Path) -> dict:
    """Decode-check an image with ffprobe; returns {codec, width, height}. Raises on unreadable files."""
    p = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height",
                        "-of", "json", str(path)], capture_output=True, text=True)
    try:
        s = json.loads(p.stdout)["streams"][0]
        info = {"codec": s["codec_name"], "width": int(s["width"]), "height": int(s["height"])}
    except (KeyError, IndexError, ValueError, json.JSONDecodeError) as e:
        raise EngineError(f"reference image is not a readable image: {path} ({p.stderr.strip()[:120]})") from e
    # ffprobe can report a stream for a corrupt file (e.g. 0x0 PNG): require real dimensions and a full decode
    dec = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-frames:v", "1", "-f", "null", "-"], capture_output=True, text=True)
    if info["width"] <= 0 or info["height"] <= 0 or dec.returncode != 0:
        raise EngineError(f"reference image is not a readable image: {path} ({(dec.stderr or p.stderr).strip()[:120]})")
    return info


class Registry:
    def __init__(self, path: Path, data: dict, project_root: Path) -> None:
        self.path, self.data, self.root = path, data, project_root
        self.base = path.parent
        self.frames: dict[str, dict] = {f["id"]: f for f in data.get("frames", [])}

    def frame(self, rid: str) -> dict:
        if rid not in self.frames:
            raise EngineError(f"unknown reference id '{rid}' (registry {self.path.name} has: {', '.join(sorted(self.frames))})")
        return self.frames[rid]

    def resolve(self, rel: str | None) -> Path | None:
        if not rel:
            return None
        p = (self.base / rel)
        if not _inside(self.root, p):
            raise EngineError(f"reference path escapes the production directory: {rel}")
        return p

    def check(self, validate_images: bool = True) -> tuple[list[dict], list[str], list[str]]:
        """Validate every frame. Returns (report rows, warnings, errors)."""
        rows, warns, errs = [], [], []
        for rid, f in self.frames.items():
            row: dict[str, Any] = {"id": rid, "scenes": f.get("scenes", []), "required": bool(f.get("required", False))}
            try:
                meta = self.resolve(f.get("metadata"))
                if meta is not None:
                    if not meta.is_file():
                        errs.append(f"{rid}: metadata file missing: {f['metadata']}")
                    else:
                        json.loads(meta.read_text(encoding="utf-8"))
                        row["metadata_sha256"] = sha256_file(meta)
                img = self.resolve(f.get("image"))
            except (EngineError, json.JSONDecodeError) as e:
                errs.append(f"{rid}: {e}")
                rows.append(row)
                continue
            if img is None:
                row["image_status"] = "not_specified"
                (errs if row["required"] else warns).append(f"{rid}: no reference image (metadata-only guidance)")
            elif not img.is_file():
                row["image_status"] = "missing"
                (errs if row["required"] else warns).append(f"{rid}: reference image missing: {f['image']} — image-guided validation of this frame is not possible")
            elif img.suffix.lower() not in IMAGE_EXT:
                errs.append(f"{rid}: unsupported image type {img.suffix}")
            else:
                h = sha256_file(img)
                row.update(image_status="present", image_sha256=h)
                if f.get("image_sha256") and f["image_sha256"] != h:
                    errs.append(f"{rid}: image changed since it was pinned (sha256 {h[:12]} != {f['image_sha256'][:12]}); "
                                "review it and re-pin with `python -m engine references --project … --pin`")
                if validate_images:
                    try:
                        info = probe_image(img)
                        row.update(info)
                        exp = f.get("expected_size")
                        if exp and [info["width"], info["height"]] != list(exp):
                            warns.append(f"{rid}: image is {info['width']}x{info['height']}, registry expects {exp[0]}x{exp[1]}")
                    except EngineError as e:
                        errs.append(f"{rid}: {e}")
            rows.append(row)
        return rows, warns, errs

    def scene_guidance(self, ids: list[str]) -> dict:
        """The guidance passed to a scene as params.refs (deterministic, JSON-serialisable)."""
        return {rid: {k: self.frame(rid).get(k) for k in GUIDANCE_KEYS if self.frame(rid).get(k) is not None} for rid in ids}

    def fingerprint_parts(self, ids: list[str]) -> list:
        """What a referencing scene depends on: guidance + metadata file hash + current image hash (if present)."""
        parts = []
        for rid in sorted(ids):
            f = self.frame(rid)
            meta, img = self.resolve(f.get("metadata")), self.resolve(f.get("image"))
            parts.append([rid, {k: f.get(k) for k in GUIDANCE_KEYS}, f.get("vertical_guide"),
                          sha256_file(meta) if meta and meta.is_file() else None,
                          sha256_file(img) if img and img.is_file() else "missing"])
        return parts


def load_registry(project) -> Registry | None:
    rel = project.data.get("references")
    if not rel:
        return None
    path = (project.dir / rel)
    root = project.scene_dir if hasattr(project, "scene_dir") else project.dir
    if not (_inside(project.dir, path) or _inside(root, path)):
        raise EngineError(f"references registry must live inside the production: {rel}")
    if not path.is_file():
        raise EngineError(f"references registry not found: {rel}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise EngineError(f"{path}: invalid JSON ({e})") from e
    if data.get("schema") != "oddlight-references/1":
        raise EngineError(f"{path}: expected schema 'oddlight-references/1'")
    seen = set()
    for f in data.get("frames", []):
        if not f.get("id") or f["id"] in seen:
            raise EngineError(f"{path}: every frame needs a unique 'id'")
        seen.add(f["id"])
    return Registry(path, data, root)


def pin(reg: Registry) -> list[str]:
    """Record the current sha256 of every present image (after a human reviewed the change)."""
    changed = []
    for f in reg.data.get("frames", []):
        img = reg.resolve(f.get("image"))
        if img and img.is_file():
            h = sha256_file(img)
            if f.get("image_sha256") != h:
                f["image_sha256"] = h
                changed.append(f["id"])
    reg.path.write_text(json.dumps(reg.data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return changed
