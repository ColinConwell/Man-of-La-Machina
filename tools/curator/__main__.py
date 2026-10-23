import argparse
from library.ports import serve
from .app import create_curator

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Serve the local annotation tool on loopback.")
    parser.add_argument("--port", type=int, default=None, help="exact port (default: 8001 or the next free port)")
    args = parser.parse_args()
    serve(create_curator(), "curator", port=args.port, access_log=False)
