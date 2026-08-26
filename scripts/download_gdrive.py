#!/usr/bin/env python3
"""CLI wrapper for the Google Drive folder download.

Settings come from config.json ``downloads``. Generate that file with
``python scripts/generate_config.py`` (add ``--interactive`` to prompt).

Examples:
  python scripts/download_gdrive.py
  python scripts/download_gdrive.py --config config.json --dry-run
  python scripts/download_gdrive.py --max-size-mb 50 --exclude-extensions .mp4,.mov
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from library.gdrive import main


if __name__ == "__main__":
    raise SystemExit(main())
