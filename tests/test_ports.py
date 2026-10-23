import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest

from library import ports


def listener(host='127.0.0.1', port=0):
    sock = socket.socket()
    sock.bind((host, port))
    sock.listen()
    return sock


@pytest.fixture
def free_base():
    """A free port with room above it for a small scan."""
    while True:
        with listener() as probe:
            port = probe.getsockname()[1]
        if port < 65000:
            return port


@pytest.fixture
def registry(monkeypatch, free_base, tmp_path):
    services = {'alpha': {'port': free_base, 'env': ['TEST_ALPHA_PORT']},
                'beta': {'port': free_base + 1, 'env': ['TEST_BETA_PORT']}}
    monkeypatch.setattr(ports, 'REGISTRY', {'scan': 6, 'services': services})
    monkeypatch.setenv('MACHINA_RUNTIME_DIR', str(tmp_path))
    monkeypatch.delenv('TEST_ALPHA_PORT', raising=False)
    monkeypatch.delenv('MACHINA_DEPLOYMENT', raising=False)
    return free_base


def test_registry_defaults_and_variables_are_distinct():
    services = ports.REGISTRY['services']
    defaults = [s['port'] for s in services.values()]
    variables = [v for s in services.values() for v in s['env']]
    assert len(set(defaults)) == len(defaults)
    assert len(set(variables)) == len(variables)
    assert 'PORT' in services['api']['env']  # hosted platforms assign PORT
    assert all(ports.candidates(name)[0] == s['port'] for name, s in services.items())


def test_default_port_is_used_when_free(registry):
    with ports.allocate('alpha') as sock:
        assert sock.getsockname()[1] == registry


def test_busy_default_moves_up_past_other_services_defaults(registry):
    with listener(port=registry):
        with ports.allocate('alpha') as sock:
            port = sock.getsockname()[1]
    assert port not in (registry, registry + 1) and registry < port < registry + 6


def test_excluded_ports_are_skipped(registry):
    with ports.allocate('alpha', exclude=[registry]) as sock:
        assert sock.getsockname()[1] != registry


def test_wildcard_listener_counts_as_busy(registry):
    # macOS would otherwise let a SO_REUSEADDR bind shadow it on loopback.
    with listener('0.0.0.0', registry):
        assert ports.bind('127.0.0.1', registry) is None


def test_requested_ports_are_strict(registry, monkeypatch):
    with listener(port=registry):
        with pytest.raises(ports.PortUnavailable, match='requested port'):
            ports.allocate('alpha', port=registry)
        monkeypatch.setenv('TEST_ALPHA_PORT', str(registry))
        with pytest.raises(ports.PortUnavailable, match='requested port'):
            ports.allocate('alpha')
    monkeypatch.setenv('TEST_ALPHA_PORT', 'eighty')
    with pytest.raises(ports.PortUnavailable, match='not a port number'):
        ports.requested_port('alpha')


def test_exhausted_scan_names_the_override(registry, monkeypatch):
    monkeypatch.setitem(ports.REGISTRY, 'scan', 1)
    with listener(port=registry):
        with pytest.raises(ports.PortUnavailable, match='TEST_ALPHA_PORT'):
            ports.allocate('alpha')


def test_records_track_running_servers_and_drop_exited_ones(registry, tmp_path, monkeypatch):
    with listener(port=registry):
        record = ports.register('alpha', '127.0.0.1', registry)
        assert [r['url'] for r in ports.running('alpha')] == [f'http://127.0.0.1:{registry}']
        assert ports.service_url('alpha') == f'http://127.0.0.1:{registry}'
        ports.unregister(record)
    assert ports.running('alpha') == []
    assert ports.service_url('beta') == f'http://127.0.0.1:{registry + 1}'

    exited = subprocess.Popen([sys.executable, '-c', 'pass'])
    exited.wait()
    stale = tmp_path / 'alpha-1.json'
    stale.write_text(json.dumps({'service': 'alpha', 'host': '127.0.0.1', 'port': 1, 'pid': exited.pid,
                                 'started': 0, 'url': 'http://127.0.0.1:1'}))
    assert ports.running() == [] and not stale.exists()

    monkeypatch.setenv('MACHINA_DEPLOYMENT', 'hosted')
    assert ports.register('alpha', '0.0.0.0', registry) is None


def test_serve_records_its_port_and_removes_the_record(tmp_path):
    script = ('from fastapi import FastAPI\nfrom library.ports import serve\n'
              'app = FastAPI()\napp.get("/")(lambda: {"ok": True})\n'
              'serve(app, "results-fixture", log_level="warning")\n')
    env = {**os.environ, 'MACHINA_RUNTIME_DIR': str(tmp_path), 'MACHINA_RESULTS_FIXTURE_PORT': '0'}
    env.pop('MACHINA_DEPLOYMENT', None)
    server = subprocess.Popen([sys.executable, '-c', script], env=env, cwd=Path(__file__).parents[1])
    try:
        for _ in range(100):
            records = list(tmp_path.glob('results-fixture-*.json'))
            if records:
                break
            time.sleep(0.05)
        record = json.loads(records[0].read_text())
        assert record['pid'] == server.pid and record['port'] > 0
        for _ in range(100):
            try:
                with urllib.request.urlopen(record['url'] + '/') as response:
                    assert json.load(response) == {'ok': True}
                break
            except OSError:
                time.sleep(0.05)
        else:
            pytest.fail('server never answered')
    finally:
        server.terminate()
        server.wait(10)
    assert not list(tmp_path.glob('*.json'))
