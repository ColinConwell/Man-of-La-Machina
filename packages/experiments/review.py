"""Render a private Markdown comparison from saved case receipts; no provider calls."""
import argparse
import json
from pathlib import Path
from packages.experiments.__main__ import private_write


def render(directory):
    results = []
    for path in sorted(directory.glob('*.json')):
        value = json.loads(path.read_text())
        if isinstance(value, dict) and 'run_id' in value and 'turns' in value:
            results.append((path, value))
    results.sort(key=lambda item: tuple(item[1]['case'][k]['id'] for k in ('event','seed','condition')))
    lines = ['# Counterfactual Experiment Review', '',
             'This private report contains simulated dialogue. It is not historical evidence or a prediction of the participant.', '',
             'Input bounds count UTF-8 bytes plus message overhead, not provider tokens. The JSON files contain exact requests, '
             'source dependencies, character sketches, retrieval decisions, and partial failures.', '',
             '| Event | Seed | Condition | Status | Turns | Mean Input Bound | Future Cards | Branch Compactions |',
             '| --- | --- | --- | --- | ---: | ---: | ---: | ---: |']
    for path,r in results:
        c,m=r['case'],r['metrics']
        lines.append(f"| {c['event']['id']} | {c['seed']['id']} | {c['condition']['id']} | {r['status']} | "
                     f"{m['completed_turns']} | {m['mean_dialogue_input_bound']} | {m['future_cards_exposed']} | {m['branch_compactions']} |")
    for path,r in results:
        c=r['case']
        lines += ['', f"## {c['event']['id']} / {c['seed']['id']} / {c['condition']['id']}", '',
                  f"Receipt: [{r['run_id'][:12]}]({path.name}). Status: {r['status']}. "
                  f"Boundary: {r['boundary']['entry_message_id']} ({r['boundary']['mode']}).", '',
                  'Intervention: '+c['seed']['prompt'], '',
                  f"Traveler: {c['condition']['traveler']['provider']} / {c['condition']['traveler']['model']}. "
                  f"Companion: {c['condition']['companion']['provider']} / {c['condition']['companion']['model']}."]
        if r.get('error'):
            lines += ['', 'Failure: '+json.dumps(r['error'])]
        for turn in r['turns']:
            lines += ['', f"### Simulated {turn['actor'].title()}", '', turn['text']]
    output=directory/'review.md'
    private_write(output,'\n'.join(lines)+'\n')
    return output


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('directory',type=Path)
    args=p.parse_args()
    print(render(args.directory))


if __name__=='__main__':
    main()
