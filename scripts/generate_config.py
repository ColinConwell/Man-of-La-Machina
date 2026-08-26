#!/usr/bin/env python3
"""Generate or update config.json.

Examples:
  python scripts/generate_config.py
  python scripts/generate_config.py --interactive
  python scripts/generate_config.py --section downloads --output-dir context/data
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from library.config import main


if __name__ == "__main__":
    raise SystemExit(main())
