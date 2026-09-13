"""Bounded end-to-end demo check. --live explicitly enables Gemini requests.

Run from backend: .venv/bin/python scripts/check_demo.py --live
Results check software/mapping behavior, not predictions in living animals.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.routes import SimulateRequest, simulate
from app.api.state import get_semantic_index
from app.experience.interpreter import interpret

CASES = [
    ('lights repeatedly turn on and off', {'visual_luminance'}),
    ('another fly comes to mate', {'visual_motion'}),
    ('the fly is held in a hand', {'mechano_body'}),
    ('the air around the fly suddenly becomes hot', {'thermo_change'}),
    ('a breeze blows across its antennae', {'mechano_wind'}),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true')
    args = parser.parse_args()
    results = []
    for text, expected in CASES:
        receipt = interpret(text, 'llm' if args.live else 'local', get_semantic_index())
        output = simulate(SimulateRequest(text=text, interpretation_ticket=receipt['ticket']))
        actual = {c.stimulus for c in output.experience.components}
        row = {
            'input':text, 'expected_cues':sorted(expected), 'actual_cues':sorted(actual),
            'passed':actual == expected and (not args.live or output.experience.parser.startswith('gemini:')),
            'parser':output.experience.parser, 'fallback':receipt['notice'],
            'graph':output.circuit,
            'reached':output.result.metrics.neurons_activated,
            'connections':output.result.metrics.connections_traversed,
            'response':output.response.model_dump(),
            'interpretation':output.experience.model_dump(),
        }
        results.append(row)
        print(json.dumps({k:v for k,v in row.items() if k not in ['response','interpretation','graph']}),flush=True)
    artifact = {'scope':'Software and cue-mapping checks; not biological validation.', 'live':args.live, 'results':results}
    destination = Path(__file__).resolve().parents[2] / 'docs' / ('demo-live-check.json' if args.live else 'demo-local-check.json')
    destination.write_text(json.dumps(artifact,indent=2))
    return 0 if all(r['passed'] for r in results) else 1


if __name__ == '__main__':
    raise SystemExit(main())
