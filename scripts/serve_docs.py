"""Preview the MkDocs site on the ``docs`` port from ``library/ports.json``."""

from __future__ import annotations

import argparse

from mkdocs.commands.serve import serve

from library.ports import PortUnavailable, allocate, register, unregister, url


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, help="bind exactly this port")
    args = parser.parse_args(argv)
    host = "127.0.0.1"
    try:
        sock = allocate("docs", host, args.port)
    except PortUnavailable as error:
        raise SystemExit(str(error)) from None
    # MkDocs binds its own socket, so the probe is released just before it starts.
    port = sock.getsockname()[1]
    sock.close()
    record = register("docs", host, port)
    print(f"Documentation preview: {url(host, port)}")
    try:
        serve(config_file="mkdocs.yml", dev_addr=f"{host}:{port}")
    finally:
        unregister(record)


if __name__ == "__main__":
    main()
