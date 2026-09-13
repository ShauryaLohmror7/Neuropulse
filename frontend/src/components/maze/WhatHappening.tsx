import {useEffect,useMemo,useState} from 'react'
import type {SceneData} from '../../hooks/useSceneData'
import {STEP_DURATION,useStore} from '../../lib/store'
import {getSceneTime} from '../../lib/sceneClock'
export type Decision={title:string;body:string;step:number}
const SENSORY_EXPLANATIONS:Record<string,string>={
 motion:'As the fly moves, the game sends a visual-motion cue to the model. Real visual neurons receive that input; connected neurons may then become active.',
 threat:'A pebble is approaching. The game sends an expanding-dark-object cue to real looming-related visual neurons. This is a modeled threat response, not proof that the fly feels fear.',
 touch:'The agent tried to enter a corridor occupied by a pebble. The game sends a body-touch cue to real touch-related sensory neurons.',
 scent:'The agent is near the fruit-scented sugar reward. The game sends a ripe-fruit odor cue to real odor-related neurons. We are modeling the fruit scent, not claiming that sugar itself has this smell.',
 sugar:'The fly has reached the sugar tile. The model receives a taste-on-the-mouthparts cue. These are real taste-related neurons, but the dataset does not establish that every highlighted cell specifically detects sugar.',
}
export function WhatHappening({data,event,decision,history}:{data:SceneData|null;event:string|null;decision:Decision;history:Decision[]}) {
 const sim=useStore(s=>s.sim),phase=useStore(s=>s.phase),started=useStore(s=>s.simStartedAt)
 const [step,setStep]=useState(-1)
 useEffect(()=>{const tick=()=>setStep(started===null?-1:Math.floor((getSceneTime()-started)/STEP_DURATION));tick();const timer=setInterval(tick,250);return()=>clearInterval(timer)},[started])
 const nodes=useMemo(()=>new Map(data?.circuitDoc.nodes.map(n=>[n.bodyId,n])??[]),[data])
 const groups=useMemo(()=>{
  const types=new Map<string,{name:string;count:number;id:number;direct:number}>()
  const seedIds=new Set(Object.values(sim?.result.seeds??{}).flat())
  for(const a of sim?.result.activations??[]){const value=phase==='settled'?a.activation:(a.history[step]??0);if(value<=.035)continue
   const n=nodes.get(a.body_id);const name=n?.type??'Type not assigned';const group=types.get(name)??{name,count:0,id:a.body_id,direct:0};group.count++;if(seedIds.has(a.body_id))group.direct++;types.set(name,group)}
  return [...types.values()].sort((a,b)=>b.count-a.count).slice(0,3)
 },[sim,phase,step,nodes])
 const areas=useMemo(()=>{
  const names:Record<string,string>={ol_intrinsic:'optic lobe (visual system)',ol_sensory:'visual sensory inputs',visual_projection:'visual projection neurons',visual_centrifugal:'visual feedback neurons',cb_sensory:'sensory inputs to the central brain',cb_intrinsic:'central brain',vnc_sensory:'sensory inputs to the ventral nerve cord',vnc_intrinsic:'ventral nerve cord',descending_neuron:'descending neurons',ascending_neuron:'ascending neurons'}
  const found=new Set<string>();for(const c of sim?.experience.components??[])for(const id of c.body_ids){const group=nodes.get(id)?.superclass;if(group&&names[group])found.add(names[group])}return [...found].slice(0,3)
 },[sim,nodes])
 const inputs=sim?.experience.components.flatMap(c=>c.seed_types).filter((v,i,a)=>a.indexOf(v)===i).slice(0,5)??[]
 return <section className="what-happening" aria-label="Plain-language explanation"><div className="thought-heading"><span className="maze-eyebrow">FOLLOW THE EXPERIMENT</span><h3>What’s happening?</h3></div><article className="decision-explanation"><span className="explanation-label">MOVEMENT DECISION · STEP {decision.step}</span><h4>{decision.title}</h4><p>{decision.body}</p><small>From the game controller’s actual choice—not a decoded biological thought.</small></article><article className="sensory-explanation"><span className="explanation-label">LATEST COMPUTED SENSORY EVENT</span><p>{event?SENSORY_EXPLANATIONS[event]:'Start an attempt or throw a pebble. Its sensory explanation will appear here after the model responds.'}</p>{areas.length>0&&<p className="input-names"><b>Input area / group:</b> {areas.join('; ')}.</p>}{inputs.length>0&&<p className="input-names"><b>Input neuron types:</b> {inputs.join(', ')}. Names come from the dataset.</p>}<div className="active-types"><span>{phase==='settled'?'Reached in the last event':'Active in the displayed model step'}</span>{groups.length?groups.map(g=><button key={g.name} onClick={()=>{useStore.getState().setHovered(g.id);useStore.getState().setView('brain')}}><b>{g.name}</b><span>{g.count.toLocaleString()} cells ↗</span><small>{g.direct===g.count?'These cells receive the mapped sensory input.':g.direct===0?'Activity reached these cells through the connectome’s connections.':`${g.direct} receive direct input; the others respond downstream.`}</small></button>):<small>No cells above the display threshold in this step.</small>}</div><small>Showing up to three neuron types. Click one to inspect a real member’s source skeleton.</small></article>{history.length>0&&<details className="decision-history"><summary>Recent decisions</summary><ol>{history.map((d,i)=><li key={`${d.step}:${i}`}><span>Step {d.step}</span><b>{d.title}</b><p>{d.body}</p></li>)}</ol></details>}</section>
}
