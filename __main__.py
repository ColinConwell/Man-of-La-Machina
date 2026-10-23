import argparse
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from library.ports import serve


def create_preview():
    dist = Path(__file__).with_name("dist")
    if not (dist / "index.html").is_file():
        raise RuntimeError("Build the design preview first: just design-build")
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    @app.get("/healthz")
    def health():
        return {"status": "ok", "service": "design-preview"}

    @app.get("/")
    @app.get("/design")
    def index():
        return FileResponse(dist / "index.html", headers={"Cache-Control": "no-store"})

    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")
    return app


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Serve synthetic design studies on loopback.")
    parser.add_argument("--port", type=int, help="exact port; otherwise use the port registry")
    args = parser.parse_args()
    serve(create_preview(), "design", port=args.port, access_log=False)
