import { useMemo } from 'react'
import type { SceneData } from '../hooks/useSceneData'
import { useStore } from '../lib/store'

export function KeyNeurons({data}: {data:SceneData}) {
  const {sim,hoveredBodyId,setHovered,setView,toggleInspector} = useStore()
  const picks = useMemo(() => {
    if (!sim) return []
    const inputs = new Set(Object.values(sim.result.seeds).flat())
    const outputs = new Set(sim.response.channels.flatMap(c=>c.body_ids))
    const ranked = [...sim.result.activations].sort((a,b)=>b.activation-a.activation)
    return [
      {role:'Direct input', a:ranked.find(a=>inputs.has(a.body_id))},
      {role:'Strong relay', a:ranked.find(a=>!inputs.has(a.body_id)&&!outputs.has(a.body_id))},
      {role:'Output reached', a:ranked.find(a=>outputs.has(a.body_id))},
    ].flatMap(p=>p.a ? [{role:p.role, activation:p.a, node:data.circuitDoc.nodes.find(n=>n.bodyId===p.a!.body_id)}] : [])
  },[sim,data])
  if(!sim || !picks.length || hoveredBodyId!==null) return null
  return <div className="key-neurons"><div className="eyebrow">NEURONS IN THIS MODELED PATHWAY</div><div className="key-neuron-row">{picks.map(p=><button aria-pressed={hoveredBodyId===p.activation.body_id} key={p.role} onClick={()=>{setHovered(p.activation.body_id);setView('brain')}}><small>{p.role}</small><strong>{p.node?.type ?? p.activation.body_id}<span>↗</span></strong><span>{p.activation.body_id} · step {p.activation.step}</span></button>)}</div>{hoveredBodyId && <button className="text-button" onClick={toggleInspector}>Why this neuron? Inspect evidence ↗</button>}</div>
}
