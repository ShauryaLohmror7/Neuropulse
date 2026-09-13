"""Compare old/new readouts on identical local-parser propagation results."""
import sys,json
from dataclasses import replace
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.api.routes import simulate,SimulateRequest
from app.api.state import get_circuit
import app.simulation.response as response
root=Path(__file__).resolve().parents[2]
cases=json.loads((root/'docs/input-audit.json').read_text())['results']
new=response.CHANNELS
old=tuple(replace(c,marker_types=('MN9','MN11D','MN11V','MN12D')) if c.key=='feeding_proboscis' else c for c in new if c.key not in {'front_leg_rubbing','stride_steering','forward_walking'})
rows=[]
for case in cases:
 out=simulate(SimulateRequest(text=case['input']))
 response.CHANNELS=old;response.BY_KEY={c.key:c for c in old}
 before=response.infer_response(out.result.activations,get_circuit().node_meta)
 response.CHANNELS=new;response.BY_KEY={c.key:c for c in new}
 rows.append({'input':case['input'],'parser':out.experience.parser,'before':before.headline,'after':out.response.headline,'before_action':before.confidence!='NONE','after_action':out.response.confidence!='NONE','new_channels':[c.model_dump() for c in out.response.channels if c.key not in {x.key for x in old}]})
 print(json.dumps({k:v for k,v in rows[-1].items() if k not in ['new_channels','parser']}),flush=True)
(root/'docs/readout-comparison.json').write_text(json.dumps({'method':'Same activity arrays evaluated with old and new readouts; local parser; not biological validation.','results':rows},indent=2))
print('before',sum(x['before_action'] for x in rows),'after',sum(x['after_action'] for x in rows),flush=True)
