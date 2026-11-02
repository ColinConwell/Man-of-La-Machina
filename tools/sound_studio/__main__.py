"""Run Sound Studio on a separately registered loopback port."""

import argparse
from library.ports import serve
from tools.sound_studio.app import create_app

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sound Studio · Man of La Machina")
    parser.add_argument("--port", type=int)
    parser.add_argument("--data-dir")
    parser.add_argument("--fixture", action="store_true")
    args = parser.parse_args()
    serve(
        create_app(args.data_dir, args.fixture),
        "sound-fixture" if args.fixture else "sound",
        host="127.0.0.1",
        port=args.port,
        access_log=False,
        timeout_graceful_shutdown=3,
    )
