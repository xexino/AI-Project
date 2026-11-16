"""Tiny ffprobe helpers shared by tools."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path


def duration(video: Path) -> float:
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(video)], capture_output=True, text=True, check=True)
    return float(json.loads(p.stdout)["format"]["duration"])
