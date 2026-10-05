"""The browser app reads frontend/public/data/*.json. Fail if they are stale relative to backend/data."""
import filecmp
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))

from export_web import DEFAULT_OUT, write_exports  # noqa: E402


def test_committed_exports_are_up_to_date(tmp_path):
    written = write_exports(str(tmp_path))
    stale = [
        name for name, _ in written
        if not os.path.exists(os.path.join(DEFAULT_OUT, name))
        or not filecmp.cmp(os.path.join(DEFAULT_OUT, name), os.path.join(tmp_path, name), shallow=False)
    ]
    assert not stale, f"Run `python scripts/export_web.py` and commit the result. Stale: {stale}"
