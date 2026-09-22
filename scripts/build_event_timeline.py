"""Build the private event-only timeline from the complete aliased archive."""
import argparse
import asyncio
import json
from pathlib import Path
from dotenv import load_dotenv
from packages.content.aliases import load_aliases
from packages.content.beginnings import apply_catalog, load_catalog
from packages.domain.repository import ContentRepository
from packages.timeline import ROOT, DEFAULT_PATH, load_timeline
from packages.timeline.extract import extract, supplement_boundary, recover_source
from packages.timeline.review import review_timeline


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle',type=Path,default=ROOT/'content/generated/bundle.json')
    parser.add_argument('--output',type=Path,default=DEFAULT_PATH)
    parser.add_argument('--concurrency',type=int,choices=range(1,9),default=4)
    parser.add_argument('--no-resume',action='store_true')
    parser.add_argument('--supplement-only',metavar='START_ID',help='Add one prefix-only boundary extraction to a matching existing asset')
    parser.add_argument('--review-only',action='store_true',help='Conservatively review the saved candidate inventory in original chunk scopes')
    parser.add_argument('--recover-message',metavar='MESSAGE_ID',help='Recover candidates from one source into the preserved candidate asset; review separately')
    args=parser.parse_args()
    load_dotenv(ROOT/'.env.local',override=False)
    raw=ContentRepository.load(args.bundle).bundle
    bundle=ContentRepository(load_aliases().bundle(apply_catalog(raw,load_catalog(raw)))).bundle
    if args.recover_message:
        candidate_path=args.output.with_name('event-timeline-candidates.json')
        result=asyncio.run(recover_source(bundle,load_timeline(bundle,candidate_path),args.recover_message,candidate_path))
    elif args.review_only:
        timeline=load_timeline(bundle,args.output)
        if timeline.get('semantic_review'):
            timeline=load_timeline(bundle,args.output.with_name('event-timeline-candidates.json'))
        result=asyncio.run(review_timeline(bundle,timeline,args.output,concurrency=args.concurrency))
    elif args.supplement_only:
        start=next((s for s in bundle.profile.start_options if s.id==args.supplement_only),None)
        if start is None:
            parser.error('Unknown start ID')
        result=asyncio.run(supplement_boundary(bundle,load_timeline(bundle,args.output),start.entry_message_id,args.output))
    else:
        result=asyncio.run(extract(bundle,args.output,concurrency=args.concurrency,resume=not args.no_resume))
    print(json.dumps({'status':result['status'],'coverage':result['coverage'],'asset_hash':result['asset_hash']}))
    raise SystemExit(0 if result['status']=='completed' else 1)


if __name__=='__main__':
    main()
