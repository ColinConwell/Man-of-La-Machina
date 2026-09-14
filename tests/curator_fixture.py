"""Isolated local-editor browser fixture; never writes to the real catalog."""

from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib
import zipfile
import uvicorn
from packages.content.aliases import AliasRewriter
from tests.exploration_fixture import exploration_bundle
from tools.curator.app import create_curator

if __name__ == "__main__":
    with TemporaryDirectory() as temporary:
        root = Path(temporary)
        bundle = exploration_bundle()
        sources = []
        for original in bundle.sources:
            file = root / original.path
            with zipfile.ZipFile(file, "w") as z:
                z.writestr(
                    "word/document.xml",
                    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Invented original source paragraph.</w:t></w:r></w:p></w:body></w:document>',
                )
            sources.append(
                original.model_copy(
                    update={
                        "path": str(file),
                        "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
                    }
                )
            )
        app = create_curator(
            bundle.model_copy(update={"sources": tuple(sources)}),
            Path(temporary) / "beginnings.local.json",
            AliasRewriter(),
            source_root=root,
        )
        uvicorn.run(app, host="127.0.0.1", port=8003, access_log=False)
