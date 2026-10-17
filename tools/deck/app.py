"""Loopback server for the private project deck; never mounted in the experience API."""
from __future__ import annotations

import ipaddress
import json
import os
from pathlib import Path
import re
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from packages.content.aliases import display_projection, load_aliases
from .samples import case_beats

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONTENT = ROOT / 'manuscript/deck/deck.local.json'
DEFAULT_RESULTS = ROOT / 'experiments/results'
WEB = Path(__file__).parent / 'dist'
MAX_EDITS = 2 * 1024 * 1024
EDIT_KEYS = {'version', 'text', 'style', 'slides', 'annotations'}


def write_private(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    tmp = path.with_name(path.name + '.tmp')
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as handle:
        handle.write(text)
    os.replace(tmp, path)


def annotations_markdown(edits: dict, content: dict) -> str:
    order = [s.get('id') for s in content.get('slides', [])]
    lines = ['# Deck annotations', '', 'Generated from edits.local.json by the deck server. Edit notes in the deck, not here.', '']
    for a in edits.get('annotations', []):
        slide = a.get('slide')
        where = f"Slide {order.index(slide) + 1} ({slide})" if slide in order else str(slide)
        mark = 'x' if a.get('status') == 'resolved' else ' '
        text = str(a.get('text', '')).replace('\n', ' ')
        lines.append(f"- [{mark}] **{where}** · `{a.get('target')}` · {a.get('created', '')[:16]} — {text}")
    return '\n'.join(lines) + '\n'


def create_deck(content_path=None, edits_path=None, results_root=DEFAULT_RESULTS, web_root=WEB, *, aliases=None):
    if os.getenv('MACHINA_DEPLOYMENT') == 'hosted':
        raise RuntimeError('The project deck is available only locally')
    content_path = Path(content_path or os.getenv('MACHINA_DECK_FILE') or DEFAULT_CONTENT)
    edits_path = Path(edits_path or os.getenv('MACHINA_DECK_EDITS') or content_path.with_name('edits.local.json'))
    notes_path = edits_path.with_name('annotations.local.md')
    results, web = Path(results_root).resolve(), Path(web_root).resolve()
    aliases = aliases if aliases is not None else load_aliases()
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=['127.0.0.1', 'localhost', '[::1]'])

    @app.middleware('http')
    async def local_only(request: Request, call_next):
        try:
            local = bool(request.client) and ipaddress.ip_address(request.client.host).is_loopback
        except ValueError:
            local = False
        origin = request.headers.get('origin')
        foreign = origin and urlsplit(origin).netloc != request.headers.get('host')
        if not local or foreign or request.headers.get('sec-fetch-site') == 'cross-site':
            return JSONResponse({'detail': 'Local same-origin access only.'}, status_code=403)
        response = await call_next(request)
        response.headers.update({
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
            'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; object-src 'none'",
        })
        return response

    def read_content():
        if content_path.is_file():
            try:
                data = json.loads(content_path.read_text())
            except ValueError:
                raise HTTPException(422, 'The private deck file is not valid JSON.') from None
            if isinstance(data, dict) and isinstance(data.get('slides'), list):
                return data, 'private'
            raise HTTPException(422, 'The private deck file needs a "slides" list.')
        example = web / 'example-deck.json'
        return (json.loads(example.read_text()) if example.is_file() else {'slides': []}), 'example'

    def read_edits():
        if not edits_path.is_file():
            return {'version': 1, 'text': {}, 'style': {}, 'slides': {}, 'annotations': []}
        try:
            return json.loads(edits_path.read_text())
        except ValueError:
            raise HTTPException(422, 'The deck edits file is not valid JSON.') from None

    @app.get('/api/deck')
    def deck():
        content, source = read_content()
        return {'content': content, 'edits': read_edits(), 'source': source}

    @app.put('/api/edits')
    async def save_edits(request: Request):
        raw = await request.body()
        if len(raw) > MAX_EDITS:
            raise HTTPException(413, 'Edits are too large.')
        try:
            edits = json.loads(raw)
        except ValueError:
            raise HTTPException(422, 'Edits must be JSON.') from None
        if not isinstance(edits, dict) or not set(edits) <= EDIT_KEYS or not isinstance(edits.get('annotations', []), list):
            raise HTTPException(422, 'Unexpected edit structure.')
        for key in ('text', 'style', 'slides'):
            if not isinstance(edits.get(key, {}), dict):
                raise HTTPException(422, 'Unexpected edit structure.')
        write_private(edits_path, json.dumps(edits, indent=2, ensure_ascii=False))
        write_private(notes_path, annotations_markdown(edits, read_content()[0]))
        return {'saved': True}

    def run_dir(run):
        if not re.fullmatch(r'[A-Za-z0-9_-]+', run):
            raise HTTPException(404, 'Run not found')
        directory = results / run
        if directory.is_symlink() or directory.resolve().parent != results or not (directory / 'plan.json').is_file():
            raise HTTPException(404, 'Run not found')
        return directory

    def plan_for(run):
        try:
            plan = json.loads((run_dir(run) / 'plan.json').read_text())
        except ValueError:
            raise HTTPException(422, 'Unreadable plan') from None
        if not isinstance(plan, dict) or not isinstance(plan.get('cases'), list):
            raise HTTPException(422, 'Not an experiment plan')
        return plan

    @app.get('/api/runs')
    def runs():
        values = []
        for directory in sorted(results.iterdir()) if results.is_dir() else []:
            try:
                plan = plan_for(directory.name)
                settings = plan['suite']['conditions']
                values.append({'id': directory.name, 'cases': len(plan['cases']),
                               'kind': plan['suite'].get('kind', 'counterfactual'),
                               'offline': all(c['traveler']['provider'] == c['companion']['provider'] == 'demo' for c in settings)})
            except (HTTPException, KeyError, TypeError):
                continue
        return {'runs': values}

    @app.get('/api/runs/{run}/cases')
    def cases(run: str):
        plan = plan_for(run)
        return display_projection({'cases': [{'id': c['id'], 'event': c.get('event'), 'condition': c.get('condition'),
                                              'seed': c.get('seed')} for c in plan['cases']]}, aliases)

    @app.get('/api/sample')
    def sample(run: str, case: str):
        if not re.fullmatch(r'[a-f0-9]{64}', case) or case not in {c['id'] for c in plan_for(run)['cases']}:
            raise HTTPException(404, 'Case not found')
        directory = run_dir(run)
        path = directory / f'{case}.json'
        if path.is_symlink() or not path.is_file() or path.resolve().parent != directory.resolve():
            raise HTTPException(404, 'Case not found')
        try:
            result = json.loads(path.read_text())
        except ValueError:
            raise HTTPException(422, 'This saved result could not be read.') from None
        if result.get('run_id') != case:
            raise HTTPException(422, 'Case identity does not match its filename')
        return display_projection(case_beats(result), aliases)

    @app.get('/{asset:path}')
    def assets(asset: str):
        path = (web / (asset or 'index.html')).resolve()
        if not path.is_relative_to(web) or not path.is_file():
            raise HTTPException(404, 'Deck asset not found. Build it with just deck-build.')
        return FileResponse(path)

    return app
