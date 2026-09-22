"""Plan by default; execute an explicit, bounded experiment selection."""
import argparse
import asyncio
import csv
import io
import json
import os
from pathlib import Path
import tempfile
from dotenv import load_dotenv
from packages.content.aliases import load_aliases
from packages.content.beginnings import load_catalog, apply_catalog
from packages.domain.models import GenerationSettings, digest
from packages.domain.repository import ContentRepository
from packages.domain.providers import validate_settings
from packages.experiments.config import Suite, default_suite, path_tracing_suite, script_path_suite, cases
from packages.experiments.context import split_history
from packages.experiments.path_tracing import boundaries
from packages.experiments.runner import Engine

ROOT = Path(__file__).resolve().parents[2]


def private_write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, tmp = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(value)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def fingerprint():
    paths = sorted((ROOT/'packages/experiments').glob('*.py')) + [
        ROOT/'packages/domain'/f for f in ['models.py', 'providers.py', 'context.py', 'profiles.py', 'repository.py']]
    paths += [ROOT/'packages/content'/f for f in ['aliases.py', 'beginnings.py']]
    paths += sorted((ROOT/'packages/timeline').glob('*.py'))
    return digest({str(p.relative_to(ROOT)):p.read_text() for p in paths})


def identity(bundle, suite, case, engine_hash, timeline_hash=None):
    return digest({'content_version': bundle.content_version, 'bundle_hash': digest(bundle.model_dump()),
                   'suite': suite.model_dump(mode='json'), 'case': case, 'engine_hash': engine_hash,
                   'timeline_hash': timeline_hash})


def prepare(args):
    load_dotenv(ROOT/'.env.local', override=False)
    suite = Suite.model_validate_json(Path(args.suite).read_text()) if args.suite else (
        script_path_suite() if args.script_paths else path_tracing_suite() if args.path_tracing else default_suite())
    if args.exchanges:
        suite = Suite.model_validate({**suite.model_dump(), 'exchanges': args.exchanges})
    if args.offline:
        demo = GenerationSettings()
        suite = suite.model_copy(update={'builder': demo, 'conditions': tuple(
            c.model_copy(update={'traveler': demo, 'companion': demo}) for c in suite.conditions)})
    raw = ContentRepository.load(args.bundle).bundle
    bundle = load_aliases().bundle(apply_catalog(raw, load_catalog(raw)))
    # Validate the final projected boundaries before any model call.
    bundle = ContentRepository(bundle).bundle
    selected = []
    for case in cases(suite):
        if all(not requested or case[key].id in requested.split(',')
               for key, requested in [('event',args.event), ('condition',args.condition), ('seed',args.seed)]):
            selected.append(case)
    if not selected:
        raise ValueError('No cases match the selected factors')
    for key, requested, objects in [('event',args.event,suite.events), ('condition',args.condition,suite.conditions),
                                    ('seed',args.seed,[s for e in suite.events for s in e.seeds])]:
        if requested and set(requested.split(',')) - {o.id for o in objects}:
            raise ValueError(f'Unknown {key} filter')
    starts = {s.id:s for s in bundle.profile.start_options}
    for case in selected:
        if case['event'].start_id not in starts:
            raise ValueError(f"Missing configured beginning: {case['event'].start_id}")
        if suite.kind in ('path-tracing', 'script-path'):
            boundaries(bundle, case['event'])
    return bundle, suite, selected


def plan(bundle, suite, selected, engine_hash):
    starts = {s.id:s for s in bundle.profile.start_options}
    rows = []
    timeline_hash = None
    if suite.kind == 'script-path' and any(c['condition'].representation == 'timeline' for c in selected):
        from packages.timeline import load_timeline
        timeline = load_timeline(bundle, ROOT/suite.timeline_file)
        if timeline.get('status') == 'completed':
            timeline_hash = digest(timeline)
    for case in selected:
        entry = starts[case['event'].start_id].entry_message_id
        past, future, _ = split_history(bundle, entry)
        endpoint = boundaries(bundle, case['event'])[1] if suite.kind in ('path-tracing', 'script-path') else None
        script = suite.kind == 'script-path'
        count = (1 if case['condition'].architecture == 'single-author' else
                 suite.exchanges*2 if case['condition'].length_policy == 'fixed' else suite.safety_max_turns) if script else suite.exchanges*2
        rows.append({'id': identity(bundle,suite,case,engine_hash,timeline_hash), 'event':case['event'].id,
                     'condition':case['condition'].id, 'seed':case['seed'].id, 'repetition':case['repetition'],
                     'entry_message_id':entry, 'end_message_id': endpoint.id if endpoint else None,
                     'history_turns':len(past), 'future_pool_turns':0 if endpoint else len(future),
                     'raw_history_bytes':sum(len(m.body.encode()) for m in past),
                     'dialogue_calls':count, 'call_count_is_ceiling':script,
                     'traveler':case['condition'].traveler.model_dump(),
                     'companion':case['condition'].companion.model_dump()})
    return {'content_version':bundle.content_version, 'engine_hash':engine_hash, 'timeline_hash': timeline_hash,
            'case_count':len(rows), 'dialogue_call_count':sum(r['dialogue_calls'] for r in rows),
            'preparation_calls':'Additional cached persona, compaction, and adaptation calls depend on selected conditions.',
            'suite':suite.model_dump(mode='json'), 'cases':rows}


async def execute(bundle, suite, selected, execution_plan, output, concurrency, resume):
    for setting in [suite.builder]+[s for c in selected for s in (c['condition'].traveler,c['condition'].companion)]:
        validate_settings(setting)
    if suite.kind == 'script-path':
        from packages.experiments.script_paths import ScriptEngine
        from packages.timeline import load_timeline
        timeline = load_timeline(bundle, ROOT/suite.timeline_file)
        if any(c['condition'].representation == 'timeline' for c in selected):
            if timeline.get('status') != 'completed' or digest(timeline) != execution_plan.get('timeline_hash'):
                raise ValueError('Timeline conditions require a completed matching timeline unchanged since planning')
        engine = ScriptEngine(bundle,suite,timeline=timeline)
    else:
        engine = Engine(bundle,suite)
    semaphore = asyncio.Semaphore(concurrency)
    async def one(case, row):
        async with semaphore:
            path = output/(row['id']+'.json')
            if resume and path.exists():
                old = json.loads(path.read_text())
                if old.get('run_id')==row['id'] and old['status']=='completed':
                    print(f"RESUME {row['event']} / {row['seed']} / {row['condition']}", flush=True)
                    return old
            result = await engine.run(case)
            result.update(run_id=row['id'], engine_hash=execution_plan['engine_hash'])
            private_write(path,json.dumps(result,ensure_ascii=False,indent=2))
            print(f"{result['status'].upper()} {row['event']} / {row['seed']} / {row['condition']} "
                  f"({len(result['turns'])} turns)",flush=True)
            return result
    results = await asyncio.gather(*(one(c,r) for c,r in zip(selected,execution_plan['cases'])))
    rows = [{**{k:r['case'][k]['id'] for k in ('event','seed','condition')}, 'run_id':r['run_id'],
             'status':r['status'], **{k:v for k,v in r['metrics'].items() if k!='interpretation'}} for r in results]
    stream = io.StringIO()
    writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    private_write(output/'metrics.csv',stream.getvalue())
    private_write(output/'index.json',json.dumps(rows,indent=2))
    return results


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--suite', help='Strict JSON suite; defaults to paired screening design')
    p.add_argument('--path-tracing', action='store_true', help='Use the two-anchor path-tracing design')
    p.add_argument('--script-paths', action='store_true', help='Compare free-length scripts, agent counts, and event/annotation inputs')
    p.add_argument('--write-default', help='Write a shareable suite JSON and exit')
    p.add_argument('--bundle',default=str(ROOT/'content/generated/bundle.json'))
    p.add_argument('--output',default=str(ROOT/'experiments/results/latest'))
    p.add_argument('--event',help='Comma-separated event IDs')
    p.add_argument('--condition',help='Comma-separated condition IDs')
    p.add_argument('--seed',help='Comma-separated seed IDs')
    p.add_argument('--exchanges',type=int)
    p.add_argument('--concurrency',type=int,default=2,choices=range(1,9))
    p.add_argument('--offline',action='store_true',help='Deterministic plumbing fixtures; no quality evaluation')
    p.add_argument('--execute',action='store_true',help='Execute selected cases; otherwise only print plan')
    p.add_argument('--resume',action='store_true',help='Reuse completed cases with exactly matching content, code, and config')
    args = p.parse_args()
    if args.write_default:
        Path(args.write_default).write_text((script_path_suite() if args.script_paths else path_tracing_suite() if args.path_tracing else default_suite()).model_dump_json(indent=2)+'\n')
        return
    try:
        bundle,suite,selected = prepare(args)
        execution_plan = plan(bundle,suite,selected,fingerprint())
        if not args.execute:
            print(json.dumps(execution_plan,indent=2))
            return
        output=Path(args.output)
        private_write(output/'plan.json',json.dumps(execution_plan,indent=2))
        results=asyncio.run(execute(bundle,suite,selected,execution_plan,output,args.concurrency,args.resume))
        print(json.dumps({'completed':sum(r['status']=='completed' for r in results), 'total':len(results), 'output':str(output)}))
        if any(r['status']!='completed' for r in results):
            raise SystemExit(1)
    except ValueError as exc:
        p.error(str(exc))


if __name__ == '__main__':
    main()
