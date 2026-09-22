"""Explicit experiment factors and a paired screening design."""
from itertools import product
from typing import Literal
from pydantic import Field, model_validator
from packages.domain.models import Frozen, GenerationSettings, digest


class Seed(Frozen):
    id: str
    prompt: str = Field(min_length=1)


class Event(Frozen):
    id: str
    start_id: str
    end_id: str | None = None
    seeds: tuple[Seed, ...] = Field(min_length=1)


class Condition(Frozen):
    id: str
    memory: Literal['full', 'compact', 'rolling'] = 'full'
    persona: Literal['minimal', 'past', 'retrospective'] = 'past'
    forward: Literal['none', 'static', 'dynamic', 'adapted'] = 'none'
    forward_audience: Literal['both', 'traveler', 'companion'] = 'both'
    endpoint_policy: Literal['upfront', 'backward', 'delayed', 'companion-only'] = 'upfront'
    architecture: Literal['single-author', 'two-agent'] = 'two-agent'
    representation: Literal['dialogue', 'annotated', 'timeline'] = 'dialogue'
    length_policy: Literal['fixed', 'adaptive'] = 'fixed'
    prompt_style: Literal['direct', 'state-first'] = 'direct'
    annotation_policy: Literal['eligible', 'retrospective-reference'] = 'eligible'
    traveler: GenerationSettings
    companion: GenerationSettings


class Suite(Frozen):
    version: Literal[1] = 1
    kind: Literal['counterfactual', 'path-tracing', 'script-path'] = 'counterfactual'
    events: tuple[Event, ...] = Field(min_length=1)
    conditions: tuple[Condition, ...] = Field(min_length=1)
    builder: GenerationSettings
    exchanges: int = Field(default=3, ge=1, le=20)
    repetitions: int = Field(default=1, ge=1, le=20)
    # Deliberately the same conservative UTF-8 bound as the interactive backend.
    input_budget: int = Field(default=600000, ge=2000, le=2000000)
    chunk_budget: int = Field(default=60000, ge=2000, le=100000)
    recent_turns: int = Field(default=2, ge=1, le=30)
    rolling_every: int = Field(default=2, ge=1, le=20)
    forward_k: int = Field(default=3, ge=1, le=20)
    forward_chars: int = Field(default=1800, ge=100, le=10000)
    persona_examples: int = Field(default=16, ge=2, le=100)
    persona_chars: int = Field(default=1200, ge=100, le=10000)
    safety_max_turns: int = Field(default=24, ge=2, le=100)
    timeline_file: str = 'content/generated/event-timeline.json'

    @model_validator(mode='after')
    def unique_ids(self):
        for values in (self.events, self.conditions, *(e.seeds for e in self.events)):
            ids = [x.id for x in values]
            if len(ids) != len(set(ids)):
                raise ValueError('Experiment IDs must be unique within their collection')
        if self.kind in ('path-tracing', 'script-path'):
            if any(not e.end_id or e.end_id == e.start_id for e in self.events):
                raise ValueError('Path tracing requires two distinct event boundaries')
            if any(c.persona == 'retrospective' or c.forward != 'none' for c in self.conditions):
                raise ValueError('Path tracing withholds intervening and subsequent archive material')
            if self.kind == 'script-path':
                if any(c.endpoint_policy != 'upfront' or c.memory == 'rolling' for c in self.conditions):
                    raise ValueError('Script paths use upfront endpoints and full or compact input')
                if self.exchanges * 2 > self.safety_max_turns:
                    raise ValueError('Fixed turn budget exceeds the explicit safety ceiling')
        elif any(e.end_id for e in self.events):
            raise ValueError('End boundaries require a path-tracing suite')
        return self


def cases(suite):
    for event, condition, repetition in product(suite.events, suite.conditions, range(suite.repetitions)):
        for seed in event.seeds:
            yield dict(event=event, condition=condition, seed=seed, repetition=repetition)


def default_suite():
    def settings(provider='openai', model='gpt-4.1-mini', output=350):
        return GenerationSettings(provider=provider, model=model, max_output_tokens=output)
    base = Condition(id='baseline', traveler=settings(), companion=settings())
    conditions = [base]
    for field, values in [('memory', ['compact', 'rolling']), ('persona', ['minimal', 'retrospective']),
                          ('forward', ['static', 'dynamic', 'adapted'])]:
        conditions.extend(base.model_copy(update={'id': f'{field}-{v}', field: v}) for v in values)
    for provider, model in [('anthropic', 'claude-sonnet-4-6'), ('gemini', 'gemini-2.5-flash')]:
        conditions.append(base.model_copy(update={'id': f'companion-{provider}', 'companion': settings(provider, model)}))
        conditions.append(base.model_copy(update={'id': f'traveler-{provider}', 'traveler': settings(provider, model)}))
    seeds = [
        ('april-1', 'earliest', [
            ('practical', 'At this opening, ask the companion to separate imaginative possibilities from a concrete next step and its constraints.'),
            ('uncertainty', 'At this opening, ask what remains uncertain and invite the companion to challenge one assumption rather than settle the story.')]),
        ('may-8', 'rain-in-spain', [
            ('constraints', 'Respond to the advice by requesting two feasible alternatives, including shelter, transport, and reasons to change plans.'),
            ('stay', 'Explore the possibility of staying put for one night. Ask what evidence would make continuing or pausing the journey preferable.')]),
        ('may-10', 'naming-mirrows', [
            ('boundaries', 'Explore giving the companion a name while stating what decisions and interpretations should remain your own.'),
            ('disagreement', 'Explore a named companionship in which disagreement is welcome. Ask the companion how it should challenge you when a story outruns the evidence.')]),
    ]
    return Suite(builder=settings(output=1800), conditions=tuple(conditions), events=tuple(
        Event(id=id, start_id=start, seeds=tuple(Seed(id=s, prompt=p) for s,p in ss)) for id,start,ss in seeds))


def path_tracing_suite():
    """Three ordered pairs, four disclosure policies, two actor-provider contrasts."""
    actor = GenerationSettings(provider='openai', model='gpt-4.1-mini', max_output_tokens=450)
    base = Condition(id='endpoint-upfront', memory='compact', traveler=actor, companion=actor)
    conditions = [base] + [base.model_copy(update={'id': 'endpoint-'+policy, 'endpoint_policy': policy})
                           for policy in ('backward', 'delayed', 'companion-only')]
    conditions += [base.model_copy(update={'id': 'path-companion-anthropic', 'companion':
        actor.model_copy(update={'provider': 'anthropic', 'model': 'claude-sonnet-4-6'})}),
        base.model_copy(update={'id': 'path-traveler-gemini', 'traveler':
        actor.model_copy(update={'provider': 'gemini', 'model': 'gemini-2.5-flash'})})]
    seed = Seed(id='bridge', prompt='Continue from the starting situation. Develop a plausible sequence of '
                'choices, questions, and responses; keep practical constraints and the Traveler’s agency visible.')
    pairs = [('april-1-to-may-8', 'earliest', 'rain-in-spain'),
             ('may-8-to-may-10', 'rain-in-spain', 'naming-mirrows'),
             ('april-1-to-may-10', 'earliest', 'naming-mirrows')]
    return Suite(kind='path-tracing', builder=actor.model_copy(update={'max_output_tokens': 1800}),
                 exchanges=4, conditions=tuple(conditions), events=tuple(
                     Event(id=id, start_id=start, end_id=end, seeds=(seed,)) for id,start,end in pairs))


def script_path_suite():
    """Paired architecture/length/context/prompt contrasts, not a full factorial."""
    actor = GenerationSettings(provider='openai', model='gpt-4.1-mini', max_output_tokens=4096)
    base = Condition(id='single-dialogue-adaptive', architecture='single-author', length_policy='adaptive',
                     persona='minimal', traveler=actor, companion=actor)
    variants = [
        ('single-dialogue-fixed', {'length_policy': 'fixed'}),
        (base.id, {}),
        ('two-dialogue-fixed', {'architecture': 'two-agent', 'length_policy': 'fixed'}),
        ('two-dialogue-adaptive', {'architecture': 'two-agent'}),
        ('single-annotated-adaptive', {'representation': 'annotated', 'annotation_policy': 'retrospective-reference'}),
        ('two-annotated-adaptive', {'architecture': 'two-agent', 'representation': 'annotated', 'annotation_policy': 'retrospective-reference'}),
        ('single-timeline-adaptive', {'representation': 'timeline'}),
        ('two-timeline-adaptive', {'architecture': 'two-agent', 'representation': 'timeline'}),
        ('single-dialogue-state-first', {'prompt_style': 'state-first'}),
        ('two-dialogue-state-first', {'architecture': 'two-agent', 'prompt_style': 'state-first'}),
        ('single-dialogue-compact', {'memory': 'compact'}),
        ('two-dialogue-anthropic', {'architecture': 'two-agent', 'companion': actor.model_copy(
            update={'provider': 'anthropic', 'model': 'claude-sonnet-4-6'})}),
    ]
    seed = Seed(id='connect-events', prompt='Given the starting context and terminal utterance, write the '
                'intervening conversation between the Traveler, and the same AI companion. '
                'Develop the physical events and choices that make the terminal utterance possible. '
                'Keep invented transitions explicit and preserve uncertainty.')
    return Suite(kind='script-path', builder=actor.model_copy(update={'max_output_tokens': 1800}),
        exchanges=4, safety_max_turns=24,
        conditions=tuple(base.model_copy(update={'id': id, **updates}) for id,updates in variants),
        events=tuple(e.model_copy(update={'seeds': (seed,)}) for e in path_tracing_suite().events))
