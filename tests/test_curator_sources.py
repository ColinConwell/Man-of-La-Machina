import hashlib
import re
import zipfile
from unittest.mock import patch
from fastapi.testclient import TestClient
from tests.exploration_fixture import exploration_bundle
from tools.curator.app import create_curator


def test_original_source_preview_is_aliased_and_native_actions_are_scoped(tmp_path):
    root = tmp_path / "context"
    root.mkdir()
    file = root / "source.docx"
    with zipfile.ZipFile(file, "w") as z:
        z.writestr(
            "word/document.xml",
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Aster Riley considers an invented journey.</w:t></w:r></w:p></w:body></w:document>',
        )
    b = exploration_bundle()
    original = b.sources[0].model_copy(
        update={
            "path": str(file),
            "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
        }
    )
    b = b.model_copy(update={"sources": (original, *b.sources[1:])})
    with TestClient(
        create_curator(b, tmp_path / "notes.local.json", source_root=root),
        base_url="http://127.0.0.1",
        client=("127.0.0.1", 10000),
    ) as c:
        c.headers["X-Curator-Token"] = re.search(r'nonce="([^"]+)"', c.get("/").text)[1]
        r = c.get("/api/threads/thread-a1/source")
        assert r.status_code == 200 and r.json()["matches_archive"]
        assert "Aster" not in r.text and "The Visitor" in r.text
        with (
            patch("tools.curator.app.sys.platform", "darwin"),
            patch("tools.curator.app.subprocess.run") as run,
        ):
            assert c.post("/api/threads/thread-a1/source/reveal").status_code == 200
            assert run.call_args.args[0] == ["/usr/bin/open", "-R", str(file)]
            assert c.post("/api/threads/thread-a1/source/open").status_code == 200
            assert run.call_args.args[0] == ["/usr/bin/open", str(file)]
            assert c.post("/api/threads/thread-a1/source/delete").status_code == 422
            assert c.post("/api/threads/missing/source/open").status_code == 404
            assert (
                c.post(
                    "/api/threads/thread-a1/source/open",
                    headers={"origin": "https://hostile.example"},
                ).status_code
                == 403
            )
            assert run.call_count == 2
        # A symlink to a file outside the source root cannot be opened or previewed.
        outside = tmp_path / "outside.docx"
        file.rename(outside)
        file.symlink_to(outside)
        assert c.get("/api/threads/thread-a1/source").status_code == 404
