import type {SimulationEnvelope} from '../../types/api'
import {useStore} from '../../lib/store'

export function SystemActivity({sim,step,settled}:{sim:SimulationEnvelope;step:number;settled:boolean}) {
 if(!sim.systems?.length)return null
 return <section className="system-activity" aria-label="Activity across brain systems"><div className="label">ACROSS THE NERVOUS SYSTEM</div><p>{settled?'Cells reached during this event':'Cells above threshold in this model step'} · groups follow dataset annotations.</p>{sim.systems.map(system=>{
  const count=settled?system.reached:(system.active_by_step[step]??0)
  return <details key={system.key} className={count?'responding':''}><summary><span>{system.label}</span><b>{count.toLocaleString()}<small> / {system.total.toLocaleString()}</small></b></summary><meter min={0} max={system.total} value={count} aria-label={`${system.label} activity`}/><p>{system.role}</p><small>{count?'Computed activity, not proof that the associated function occurred.':'Not recruited above threshold here. This does not prove biological inactivity.'}</small>{system.example_ids.length>0&&<button className="text-button" onClick={()=>useStore.getState().setHovered(system.example_ids[0])}>Inspect a reached neuron ↗</button>}</details>})}<small>The graph includes every annotated neuron. These are broad, non-overlapping annotation groups, not measured brain-region boundaries.</small></section>
}
