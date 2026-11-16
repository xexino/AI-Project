import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
FIX = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture
def mini(tmp_path):
    """A writable copy of the mini fixture project (mock providers, 216x384 @ 12 fps)."""
    d = tmp_path / "mini"
    shutil.copytree(FIX / "mini", d)
    return d


def has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


needs_ffmpeg = pytest.mark.skipif(not has_ffmpeg(), reason="ffmpeg not installed")
