"""Isolated local-editor browser fixture; never writes to the real catalog."""

from pathlib import Path
from tempfile import TemporaryDirectory
import uvicorn
from packages.content.aliases import AliasRewriter
from tests.exploration_fixture import exploration_bundle
from tools.curator.app import create_curator

if __name__ == "__main__":
    with TemporaryDirectory() as temporary:
        app = create_curator(
            exploration_bundle(),
            Path(temporary) / "beginnings.local.json",
            AliasRewriter(),
        )
        uvicorn.run(app, host="127.0.0.1", port=8003, access_log=False)
