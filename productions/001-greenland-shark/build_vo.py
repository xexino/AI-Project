"""Superseded (v1 pipeline). Narration and word timing are now engine stages:
    python -m engine produce --project productions/001-greenland-shark --until timing
"""
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
sys.exit(subprocess.call([sys.executable, "-m", "engine", "produce", "--project", str(Path(__file__).parent), "--until", "timing"], cwd=root))
