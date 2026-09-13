import type { PropagationResult } from '../../types/api'

export function ActivityTimeline({ result, step, settled }: {result:PropagationResult;step:number;settled:boolean}) {
  const current=result.steps.find(s=>s.step===step)
  const maximum=Math.max(1,...result.steps.map(s=>s.active_total))
  return <section className="activity-timeline" aria-label="Recorded model activity">
    <div className="timeline-heading"><span>{settled ? 'PATHWAY SUMMARY' : 'MODEL PLAYBACK'}</span><b>{settled ? `${result.steps.length} states` : `Step ${Math.max(0,Math.min(step,result.steps.length-1))} / ${result.steps.length-1}`}</b></div>
    <div className="timeline-bars">{result.steps.map(s=><div key={s.step} className={settled || s.step<step ? 'passed' : s.step===step ? 'present' : ''} title={`Model step ${s.step}: ${s.active_total} neurons above threshold`}><i style={{height:`${8+32*s.active_total/maximum}px`}}/><span>{s.step}</span></div>)}</div>
    <p>{settled ? 'Each reached neuron keeps its strongest modeled glow. This is a frozen result, not ongoing firing.' : current ? `${current.active_total.toLocaleString()} neurons above threshold now · ${current.pulses.toLocaleString()} recorded edge signals` : 'Preparing recorded activity…'}</p>
    <small>Glows follow model states. Traveling fronts illustrate cable distance; they are not measured electrical signals.</small>
  </section>
}
