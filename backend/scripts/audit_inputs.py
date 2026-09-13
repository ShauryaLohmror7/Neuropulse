"""Live HTTP demo audit: observed software outputs, not biological validation."""
import json,time
from pathlib import Path
import requests
CASES=[('antenna_repeated','Something repeatedly touches the fly’s left antenna.'),('antenna_single','Something touches its antenna.'),('looming','A dark object rapidly expands in front of the fly.'),('sugar','The fly tastes sugar with its mouthparts.'),('fruit','The fly smells ripe banana.'),('lights','The lights repeatedly turn on and off.'),('darkness','All the lights in the room turn off.'),('rain','Raindrops repeatedly hit the fly’s body in humid air.'),('mate','A female fly approaches to mate.'),('social_food','Two flies approach while it is eating sugar.'),('song','The fly hears a courtship song.'),('wind','A breeze blows across its antennae.'),('heat','The air around the fly suddenly becomes hot.'),('cold','The temperature suddenly drops around the fly.'),('held','The fly is held in a hand.'),('jar','The fly is captured in a jar.'),('absent','Nothing touches its antenna and there is no sound.'),('hypothetical','What if it started raining tomorrow?'),('memory','The fly remembers where it found sugar yesterday.'),('mixed','It smells ripe fruit while something repeatedly touches its left antenna.')]
ROOT=Path(__file__).resolve().parents[2]
rows=[]
for name,text in CASES:
 start=time.monotonic();row={'case':name,'input':text}
 try:
  r=requests.post('http://127.0.0.1:8000/api/interpret',json={'text':text,'mode':'llm'},timeout=40);r.raise_for_status();receipt=r.json()
  r=requests.post('http://127.0.0.1:8000/api/simulate',json={'text':text,'interpretation_ticket':receipt['ticket']},timeout=90);r.raise_for_status();out=r.json()
  row.update(parser=out['experience']['parser'],notice=out['experience'].get('interpreter_notice'),cues=[{'label':c['label'],'stimulus':c['stimulus'],'modality':c['modality'],'neurons':c['neuron_count']} for c in out['experience']['components']],kind=out['response']['interpretation_kind'],headline=out['response']['headline'],explanation=out['response'].get('plain_language'),reached=out['result']['metrics']['neurons_activated'],connections=out['result']['metrics']['connections_traversed'],evidence=out['response'].get('output_evidence'),limitations=out['response'].get('limitations'))
  row['sample_neurons']=[{'id':a['body_id'],'step':a['step'],'modality':a.get('modality')} for a in sorted(out['result']['activations'],key=lambda a:-a['activation'])[:5]]
 except Exception as e: row['error']=type(e).__name__+': '+str(e)
 row['seconds']=round(time.monotonic()-start,2);rows.append(row)
 (ROOT/'docs/input-audit.json').write_text(json.dumps({'scope':'Observed live software outputs; not validated animal behavior.','results':rows},indent=2))
 print(json.dumps({k:v for k,v in row.items() if k in ['case','parser','kind','headline','reached','seconds','error','notice']}),flush=True)
counts={}
for r in rows: counts[r.get('kind','error')]=counts.get(r.get('kind','error'),0)+1
print(json.dumps({'counts':counts}),flush=True)
