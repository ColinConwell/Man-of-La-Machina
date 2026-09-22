"""Grounded plain events with separate occurrence and disclosure chronologies."""
from __future__ import annotations
import json
from datetime import date
from pathlib import Path
from typing import Literal
from pydantic import Field, field_validator
from packages.domain.models import Frozen, digest

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PATH = ROOT / 'content/generated/event-timeline.json'


class Evidence(Frozen):
    source_id: str
    quote: str = Field(min_length=12, max_length=1800)


class Candidate(Frozen):
    actor: str = Field(min_length=1, max_length=150)
    action: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=600)
    place: str | None = None
    occurred_at: str | None = None
    occurred_end_at: str | None = None
    duration_text: str | None = None
    date_basis: Literal['explicit', 'relative', 'unknown'] = 'unknown'
    status: Literal['reported', 'planned', 'uncertain']
    evidence: tuple[Evidence, ...] = Field(min_length=1, max_length=5)

    @field_validator('occurred_at', 'occurred_end_at')
    @classmethod
    def iso_day(cls, value):
        if value is not None:
            date.fromisoformat(value)
        return value


def source_records(bundle):
    """Include every dialogue turn and each unique nonempty annotation exactly once."""
    records = []
    for m in sorted(bundle.messages, key=lambda m:m.ordinal):
        records.append({'id':m.id,'body':m.body,'kind':'dialogue','speaker':m.speaker,
                        'ordinal':m.ordinal,'disclosed_at':m.disclosed_at,'disclosed_end_at':m.disclosed_end_at,
                        'content_hash':m.content_hash,'provenance':m.provenance.model_dump(mode='json')})
    known = set(r['id'] for r in records)
    for item in (*bundle.documents, *bundle.artifacts):
        if item.id in known or not item.body or (getattr(item,'origin',None) != 'annotation' and getattr(item,'kind',None) != 'annotation'):
            continue
        records.append({'id':item.id,'body':item.body,'kind':'annotation','speaker':'author_annotation',
                        'ordinal':None,'disclosed_at':item.disclosed_at,'disclosed_end_at':item.disclosed_end_at,
                        'content_hash':digest(item.body),'provenance':item.provenance.model_dump(mode='json')})
        known.add(item.id)
    return records


def corpus_hash(bundle):
    return digest([{k:r[k] for k in ('id','content_hash','ordinal','disclosed_at','disclosed_end_at','kind')} for r in source_records(bundle)])


def validate_events(raw, records, *, call_id='test'):
    """Reject unsupported IDs/quotes. Semantic entailment remains a model judgment."""
    if not isinstance(raw, dict) or set(raw) != {'events'} or not isinstance(raw['events'],list):
        raise ValueError('Expected an object containing only an events list')
    source_map = {r['id']:r for r in records}
    processing_dates = [r['disclosed_end_at'] or r['disclosed_at'] for r in records]
    accepted, rejected = [], []
    for i, item in enumerate(raw['events']):
        try:
            c = Candidate.model_validate(item)
            sources = []
            for evidence in c.evidence:
                source = source_map.get(evidence.source_id)
                if source is None or evidence.quote not in source['body']:
                    raise ValueError('Evidence source or literal quote is unsupported')
                if source not in sources:
                    sources.append(source)
            if c.occurred_end_at and (not c.occurred_at or c.occurred_end_at < c.occurred_at):
                raise ValueError('Invalid occurrence interval')
            if c.date_basis == 'unknown' and (c.occurred_at or c.occurred_end_at):
                raise ValueError('Unknown date basis cannot establish occurrence')
            if c.date_basis != 'unknown' and not c.occurred_at:
                raise ValueError('Dated basis requires occurrence')
            # A supplied duration is only accepted when it appears verbatim in evidence.
            if c.duration_text and not any(c.duration_text.casefold() in e.quote.casefold() for e in c.evidence):
                raise ValueError('Duration must be explicitly quoted, never inferred')
            sources.sort(key=lambda r:(r['ordinal'] is None,r['ordinal'] or 0,r['id']))
            disclosed = [r['disclosed_at'] for r in sources]
            ends = [r['disclosed_end_at'] or r['disclosed_at'] for r in sources]
            event = c.model_dump(mode='json')
            event.update(id='event-'+digest(event)[:24],
                         disclosed_at=max(disclosed) if all(disclosed) else None,
                         disclosed_end_at=max(ends) if all(ends) else None,
                         source_ids=[r['id'] for r in sources],
                         source_ordinals=[r['ordinal'] for r in sources if r['ordinal'] is not None],
                         annotation_source_ids=[r['id'] for r in sources if r['kind']=='annotation'],
                         entry_message_id=next((r['id'] for r in sources if r['kind']=='dialogue'),None),
                         provenance={'call_ids':[call_id],'method':'model-extraction-literal-evidence-validation-v1',
                                     'source_hashes':{r['id']:r['content_hash'] for r in sources},
                                     'processing_source_ids':list(source_map),
                                     'processing_source_ordinals':[r['ordinal'] for r in records if r['ordinal'] is not None],
                                     'processing_disclosed_end_at':max(processing_dates) if processing_dates and all(processing_dates) else None,
                                     'semantic_entailment':'model-interpreted; not manually verified'})
            accepted.append(event)
        except (ValueError, TypeError) as exc:
            rejected.append({'candidate_index':i,'reason':str(exc).split('\n')[0][:180]})
    return accepted, rejected


def eligible_events(timeline, cutoff, *, allowed_source_ids=None):
    """As-of context, using latest disclosure and source ordinal, never occurrence alone."""
    if timeline.get('status') not in ('completed','partial') or not cutoff.disclosed_at:
        return []
    allowed = set(allowed_source_ids) if allowed_source_ids is not None else None
    supplemental = timeline.get('boundary_supplements',{}).get(cutoff.id,{}).get('events',[])
    candidates = {e['id']:e for e in [*timeline.get('events',[]),*supplemental]}
    return [e for e in candidates.values() if e.get('disclosed_at') and e.get('disclosed_end_at')
            and e['disclosed_end_at'] <= cutoff.disclosed_at
            and all(n <= cutoff.ordinal for n in e['source_ordinals'])
            and e.get('provenance',{}).get('processing_disclosed_end_at')
            and e['provenance']['processing_disclosed_end_at'] <= cutoff.disclosed_at
            and all(n <= cutoff.ordinal for n in e['provenance']['processing_source_ordinals'])
            and (allowed is None or set(e['provenance']['processing_source_ids']) <= allowed)]


def load_timeline(bundle, path=DEFAULT_PATH):
    unavailable = {'version':1,'status':'unavailable','content_version':bundle.content_version,'events':[], 'coverage':{}}
    try:
        timeline = json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return unavailable
    if timeline.get('content_version') != bundle.content_version or timeline.get('corpus_hash') != corpus_hash(bundle):
        return {**unavailable,'status':'stale'}
    return timeline
