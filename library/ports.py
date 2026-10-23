"""Local server ports: registry defaults, free-port discovery, running servers.

Every server is a service in ``ports.json`` with a default port and the
environment variables that request an exact port. A requested port (from a
CLI flag or one of those variables) is bound strictly and fails if taken.
Otherwise the server takes the first free port at or above its default,
skipping the other services' defaults so one busy port does not push a tool
onto another tool's address.

A port counts as taken when something already answers there or when it cannot
be bound. Local servers record their address in ``.machina/servers/`` while
they run, so the Vite proxy, Playwright and ``just ports`` can find them.
``apps/web/ports.mjs`` implements the same rules for the JavaScript tooling.
"""

from __future__ import annotations

import argparse
import errno
import json
import logging
import os
import socket
import time
from pathlib import Path
from typing import Any, Iterable

REGISTRY: dict[str, Any] = json.loads(
    Path(__file__).with_name("ports.json").read_text()
)
ROOT = Path(__file__).resolve().parents[1]
# Wildcard binds are probed and advertised through loopback.
LOOPBACK = {"": "127.0.0.1", "0.0.0.0": "127.0.0.1", "::": "::1"}


class PortUnavailable(RuntimeError):
    """A requested port is taken, or no candidate port is free."""


def service(name: str) -> dict[str, Any]:
    try:
        return REGISTRY["services"][name]
    except KeyError:
        raise KeyError(f"Unknown service {name!r}; add it to library/ports.json") from None


def requested_port(name: str, explicit: int | None = None) -> int | None:
    """The exact port asked for by a CLI flag or the service's variables."""
    if explicit is not None:
        return explicit
    for variable in service(name)["env"]:
        value = os.getenv(variable, "").strip()
        if value:
            try:
                return int(value)
            except ValueError:
                raise PortUnavailable(f"{variable}={value!r} is not a port number") from None
    return None


def candidates(name: str, exclude: Iterable[int] = ()) -> list[int]:
    """Ports to try, in order, when no exact port was requested."""
    start = service(name)["port"]
    skip = set(exclude) | {
        entry["port"] for other, entry in REGISTRY["services"].items() if other != name
    }
    return [p for p in range(start, min(start + REGISTRY["scan"], 65536)) if p not in skip]


def answers(host: str, port: int, timeout: float = 0.25) -> bool:
    """Whether something already accepts connections at ``host:port``."""
    try:
        with socket.create_connection((LOOPBACK.get(host, host), port), timeout=timeout):
            return True
    except OSError:
        return False


def bind(host: str, port: int) -> socket.socket | None:
    """A listening socket at ``host:port``, or None when the port is taken."""
    # The connection probe catches listeners that a SO_REUSEADDR bind would
    # silently shadow (on macOS, a wildcard listener on the same port).
    if port and answers(host, port):
        return None
    family, kind, proto, _, address = socket.getaddrinfo(
        host or None, port, type=socket.SOCK_STREAM, flags=socket.AI_PASSIVE
    )[0]
    sock = socket.socket(family, kind, proto)
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(address)
        sock.listen(2048)
    except OSError as error:
        sock.close()
        if error.errno in (errno.EADDRINUSE, errno.EACCES):
            return None
        raise
    return sock


def allocate(
    name: str,
    host: str = "127.0.0.1",
    port: int | None = None,
    exclude: Iterable[int] = (),
) -> socket.socket:
    """Bind the requested port strictly, else the first free candidate."""
    exact = requested_port(name, port)
    if exact is not None:
        sock = bind(host, exact)
        if sock is None:
            raise PortUnavailable(f"{name}: requested port {exact} on {host} is already in use")
        return sock
    tried = candidates(name, exclude)
    for candidate in tried:
        sock = bind(host, candidate)
        if sock is not None:
            return sock
    raise PortUnavailable(
        f"{name}: no free port in {tried[0]}-{tried[-1]} on {host}; "
        f"set {service(name)['env'][0]} to choose one"
    )


def url(host: str, port: int) -> str:
    shown = LOOPBACK.get(host, host)
    return f"http://[{shown}]:{port}" if ":" in shown else f"http://{shown}:{port}"


def runtime_dir() -> Path:
    return Path(os.getenv("MACHINA_RUNTIME_DIR") or ROOT / ".machina" / "servers")


def register(name: str, host: str, port: int) -> Path | None:
    """Record a running local server; hosted deployments record nothing."""
    if os.getenv("MACHINA_DEPLOYMENT") == "hosted":
        return None
    path = runtime_dir() / f"{name}-{port}.json"
    record = {
        "service": name,
        "url": url(host, port),
        "host": host,
        "port": port,
        "pid": os.getpid(),
        "started": time.time(),
    }
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(record))
    except OSError:
        return None
    return path


def unregister(path: Path | None) -> None:
    if path is not None:
        path.unlink(missing_ok=True)


def alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def running(name: str | None = None) -> list[dict[str, Any]]:
    """Answering servers, newest first. Records of exited processes are removed."""
    found = []
    for path in runtime_dir().glob("*.json"):
        try:
            record = json.loads(path.read_text())
        except (OSError, ValueError):
            continue
        if not alive(record.get("pid", 0)):
            path.unlink(missing_ok=True)
        elif (name is None or record["service"] == name) and answers(
            record["host"], record["port"]
        ):
            found.append(record)
    return sorted(found, key=lambda record: record["started"], reverse=True)


def service_url(name: str) -> str:
    """The newest running server's URL, else the default address."""
    live = running(name)
    return live[0]["url"] if live else url("127.0.0.1", service(name)["port"])


def serve(app: Any, name: str, *, host: str = "127.0.0.1", port: int | None = None, **options: Any) -> None:
    """Run ``app`` with uvicorn on an allocated port, recorded while it runs."""
    import uvicorn

    logger = logging.getLogger("uvicorn.error")
    try:
        sock = allocate(name, host, port)
    except PortUnavailable as error:
        raise SystemExit(str(error)) from None
    actual = sock.getsockname()[1]
    default = service(name)["port"]
    moved = requested_port(name, port) is None and actual != default
    record = register(name, host, actual)

    class Server(uvicorn.Server):
        async def startup(self, sockets: list[socket.socket] | None = None) -> None:
            await super().startup(sockets=sockets)
            # uvicorn announces its address only for sockets it binds itself.
            if self.started:
                if moved:
                    logger.warning("%s: port %d is unavailable; using %d", name, default, actual)
                shown = f"[{host}]" if ":" in host else host
                logger.info("Uvicorn running on http://%s:%d (Press CTRL+C to quit)", shown, actual)

        # uvicorn re-raises a stop signal after shutdown, which skips the
        # ``finally`` below, so the record is also removed here.
        async def shutdown(self, sockets: list[socket.socket] | None = None) -> None:
            unregister(record)
            await super().shutdown(sockets=sockets)

    server = Server(uvicorn.Config(app, host=host, port=actual, **options))
    try:
        server.run(sockets=[sock])
    finally:
        unregister(record)
        sock.close()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="List project servers, their default ports, and where they are running."
    )
    parser.add_argument("service", nargs="?", help="print this service's URL (running, else default)")
    args = parser.parse_args(argv)
    if args.service:
        if args.service not in REGISTRY["services"]:
            parser.error(f"unknown service {args.service!r}")
        print(service_url(args.service))
        return
    live = running()
    print(f"{'service':<21}{'default':<9}{'exact-port variable':<35}running")
    for name, entry in REGISTRY["services"].items():
        urls = ", ".join(r["url"] for r in live if r["service"] == name) or "-"
        print(f"{name:<21}{entry['port']:<9}{entry['env'][0]:<35}{urls}")


if __name__ == "__main__":
    main()
