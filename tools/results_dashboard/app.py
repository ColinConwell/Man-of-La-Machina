"""Standalone loopback dashboard; no routes are mounted in the experience API."""
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
from .graph import setup_graph
from packages.content.aliases import load_aliases, display_projection

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RESULTS = ROOT / 'experiments/results'
WEB = Path(__file__).parent / 'dist'


def read_json(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        raise HTTPException(422, 'This saved result could not be read.') from None


def create_dashboard(results_root=DEFAULT_RESULTS, web_root=WEB, *, aliases=None):
    if os.getenv('MACHINA_DEPLOYMENT') == 'hosted':
        raise RuntimeError('The results dashboard is available only locally')
    root, web = Path(results_root).resolve(), Path(web_root).resolve()
    aliases = aliases if aliases is not None else load_aliases()
    def project(value):
        return display_projection(value, aliases)
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=['127.0.0.1', 'localhost', '[::1]'])
    summaries = {}

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

    def run_path(run):
        if not re.fullmatch(r'[A-Za-z0-9_-]+', run):
            raise HTTPException(404, 'Run not found')
        directory = root / run
        if directory.is_symlink() or directory.resolve().parent != root or not directory.is_dir():
            raise HTTPException(404, 'Run not found')
        return directory

    def result_path(run, case):
        if not re.fullmatch(r'[a-f0-9]{64}', case):
            raise HTTPException(404, 'Case not found')
        directory = run_path(run)
        path = directory / (case + '.json')
        if path.is_symlink() or not path.is_file() or path.resolve().parent != directory:
            raise HTTPException(404, 'Case not found')
        return path

    def plan_for(run):
        path = run_path(run) / 'plan.json'
        if path.is_symlink() or not path.is_file():
            raise HTTPException(404, 'Plan not found')
        plan = read_json(path)
        if not isinstance(plan, dict) or not isinstance(plan.get('cases'), list):
            raise HTTPException(422, 'This directory does not contain an experiment plan.')
        return plan

    def load_case(run, case):
        if case not in {c['id'] for c in plan_for(run)['cases']}:
            raise HTTPException(404, 'Case is not in this run plan')
        result = read_json(result_path(run, case))
        if result.get('run_id') != case:
            raise HTTPException(422, 'Case identity does not match its filename')
        return result

    @app.get('/api/runs')
    def runs():
        values = []
        for directory in sorted(root.iterdir()) if root.is_dir() else []:
            if directory.is_symlink() or not directory.is_dir() or not (directory/'plan.json').is_file():
                continue
            try:
                plan = plan_for(directory.name)
                settings = plan['suite']['conditions']
                values.append({'id': directory.name, 'cases': len(plan['cases']),
                               'kind': plan['suite'].get('kind', 'counterfactual'),
                               'offline': all(c['traveler']['provider'] == c['companion']['provider'] == 'demo' for c in settings)})
            except (HTTPException, KeyError, TypeError):
                continue
        values.sort(key=lambda r: (r['id'] != 'script-path-screening', r['id'] != 'path-tracing-screening', r['id'] != 'final-screening', r['offline'], r['id']))
        return project({'runs': values, 'default': values[0]['id'] if values else None})

    @app.get('/api/runs/{run}')
    def summary(run: str):
        plan = plan_for(run)
        directory = run_path(run)
        stamps = []
        for row in plan['cases']:
            try:
                st = result_path(run, row['id']).stat()
                stamps.append((row['id'], st.st_mtime_ns, st.st_size))
            except HTTPException:
                stamps.append((row['id'], None, None))
        signature = ((directory/'plan.json').stat().st_mtime_ns, tuple(stamps))
        if run in summaries and summaries[run][0] == signature:
            return project(summaries[run][1])
        cases = []
        for row in plan['cases']:
            base = {'id': row['id'], 'event': row['event'], 'seed': row['seed'],
                    'condition': row['condition'], 'repetition': row['repetition']}
            try:
                r = load_case(run, row['id'])
                cases.append({**base, 'status': r['status'], 'metrics': r['metrics'],
                              'settings': r['case']['condition'], 'offline': r.get('offline', False),
                              'error': r.get('error'), 'path': {
                                  'start_title': r['path']['start_title'], 'end_title': r['path']['end_title'],
                                  'policy': r['path']['policy'], 'gap_turns': len(r['path']['gap_ids']),
                                  'review_status': r['path'].get('review_status'),
                              } if r.get('path') else None})
            except HTTPException as exc:
                cases.append({**base, 'status': 'missing' if exc.status_code == 404 else 'unreadable',
                              'metrics': {}, 'error': {'detail': exc.detail}})
        payload = {'id': run, 'cases': cases, 'suite': plan['suite'],
                   'content_version': plan['content_version'], 'engine_hash': plan['engine_hash']}
        summaries[run] = (signature, payload)
        return project(payload)

    @app.get('/api/runs/{run}/cases/{case}')
    def detail(run: str, case: str):
        r = load_case(run, case)
        # Large native requests are fetched only when a receipt is explicitly opened.
        result = {k: r.get(k) for k in ('run_id', 'case', 'boundary', 'status', 'offline', 'error', 'metrics',
                                       'turns', 'context_steps', 'historical_ids', 'future_pool_ids', 'kind',
                                       'experiment_spec', 'completion_reason', 'simulated_events')}
        if r.get('path'):
            result['path'] = {**r['path'], **{k: {key: v for key, v in r['path'][k].items() if key != 'evidence'}
                             if r['path'].get(k) else None for k in ('plan', 'review')}}
        result['persona'] = {k: v for k, v in r.get('persona', {}).items() if k != 'evidence'}
        result['memories'] = [{k: v for k, v in m.items() if k != 'parts'} for m in r.get('memories', [])]
        result['calls'] = [{
            'id': c['id'], 'purpose': c['manifest']['policy_id'].split(':', 1)[-1],
            'settings': c['manifest']['settings'], 'status': c['status'], 'metadata': c['metadata'],
            'elapsed_seconds': c['elapsed_seconds'], 'input_bound': c['manifest']['token_estimate'],
            'payload_hash': c['payload_hash'], 'retries': len(c.get('previous_attempts', [])),
            'cache_hit': c.get('cache_hit', False), 'error': c.get('error'),
        } for c in r['calls']]
        result['preserved_attempts'] = len(list((run_path(run)/'attempts').glob(case+'-*.json')))
        return project(result)

    @app.get('/api/runs/{run}/cases/{case}/receipts/{receipt}')
    def receipt(run: str, case: str, receipt: str):
        r = load_case(run, case)
        call = next((c for c in r.get('preprocessing_calls', []) + r['calls'] if c['id'] == receipt), None)
        if call is None:
            raise HTTPException(404, 'Receipt not found')
        return project(call)

    @app.get('/api/runs/{run}/cases/{case}/setup')
    def setup(run: str, case: str):
        return project(setup_graph(load_case(run, case), plan_for(run)))

    @app.get('/api/runs/{run}/cases/{case}/setup/download')
    def setup_download(run: str, case: str):
        result = load_case(run, case)
        payload = setup_graph(result, plan_for(run))
        payload['receipts'] = result.get('preprocessing_calls', []) + result.get('calls', [])
        payload['saved_result'] = result
        return JSONResponse(project(payload), headers={'Content-Disposition': f'attachment; filename="{run}-{case[:12]}-setup.json"'})

    @app.get('/api/runs/{run}/cases/{case}/download')
    def download(run: str, case: str):
        return JSONResponse(project(load_case(run, case)), headers={'Content-Disposition': f'attachment; filename="{run}-{case[:12]}.json"'})

    @app.get('/{asset:path}')
    def assets(asset: str):
        path = (web / (asset or 'index.html')).resolve()
        if not path.is_relative_to(web) or not path.is_file():
            raise HTTPException(404, 'Dashboard asset not found. Build the dashboard with just results-build.')
        return FileResponse(path)

    return app
