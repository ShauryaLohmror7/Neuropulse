import { neuronDisplayName } from '../lib/neuronExplanation'
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
    const nodes=new Map(data.circuitDoc.nodes.map(n=>[n.bodyId,n]))
    const used=new Set<number>()
    const selections=sim.experience.components.map(c=>({role:c.label,a:ranked.find(a=>c.body_ids.includes(a.body_id)&&nodes.get(a.body_id)?.type)??ranked.find(a=>c.body_ids.includes(a.body_id))}))
    selections.push({role:'Downstream relay',a:ranked.find(a=>!inputs.has(a.body_id)&&!outputs.has(a.body_id)&&nodes.get(a.body_id)?.type)})
    selections.push({role:'Output reached',a:ranked.find(a=>outputs.has(a.body_id))})
    return selections.flatMap(p=>{
      if(!p.a||used.has(p.a.body_id))return []
      used.add(p.a.body_id)
      return [{role:p.role,activation:p.a,node:nodes.get(p.a.body_id)}]
    }).slice(0,5)
  },[sim,data])
  if(!sim || !picks.length || hoveredBodyId!==null) return null
  return <div className="key-neurons"><div className="eyebrow">REPRESENTATIVE INPUTS & DOWNSTREAM NEURONS</div><div className="key-neuron-row">{picks.map(p=><button aria-pressed={hoveredBodyId===p.activation.body_id} key={p.role} onClick={()=>{setHovered(p.activation.body_id);setView('brain')}}><small>{p.role}</small><strong>{p.node ? neuronDisplayName(p.node) : 'Neuron'}<span>↗</span></strong><span>{p.activation.body_id} · step {p.activation.step}</span></button>)}</div>{hoveredBodyId && <button className="text-button" onClick={toggleInspector}>Why this neuron? Inspect evidence ↗</button>}</div>
}
