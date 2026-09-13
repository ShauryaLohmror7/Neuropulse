import type { SimulationEnvelope } from '../types/api'

/** Explicit export fields: no credentials or signed interpretation receipts. */
export function runRecord(sim:SimulationEnvelope) {
  return {
    format:'neuropulse-run-v1',
    scientificStatus:'Real annotated connectome; simplified, unvalidated activity and behavioral model.',
    source:'https://male-cns.janelia.org/',
    circuit:sim.circuit,
    experience:sim.experience,
    sequence:sim.sequence??null,
    response:sim.response,
    systems:sim.systems??[],
    result:sim.result,
    lesion:sim.lesion,
    visualLimits:'Overview morphology is sampled and simplified. Full source skeletons load on inspection. Soma and branch widths and signal travel timing are illustrative.',
  }
}

export function runMarkdown(sim:SimulationEnvelope):string {
  const mode=sim.sequence?'Continue sequence':'Fresh run'
  return [
    '# NEUROPULSE · run report',
    `Experience: ${sim.experience.raw_text || 'No new stimulus; let previous activity settle.'}`,
    `Mode: ${mode}. Interpreter: ${sim.experience.parser}.`,
    `## Computed result\n\n${sim.response.headline}\n\n${sim.response.plain_language??''}\n\n${sim.response.detail??''}`,
    `## Real dataset\n\n${sim.circuit.dataset}: ${sim.circuit.neurons.toLocaleString('en-US')} annotated neurons and ${sim.circuit.edges.toLocaleString('en-US')} directed connections. [Official source](https://male-cns.janelia.org/).`,
    `## Inputs\n\n${sim.experience.components.map(c=>`- ${c.label}: ${c.neuron_count} real input neurons; ${c.temporal_pattern??'pulse'}; ${c.direction??'side unspecified'}. ${c.caveat??''}`).join('\n')||'No supported present stimulus was injected.'}`,
    `## Model activity\n\n${sim.result.metrics.neurons_activated.toLocaleString('en-US')} neurons reached; ${sim.result.metrics.connections_traversed.toLocaleString('en-US')} connections traversed.\n\n${(sim.response.neural_summary??[]).join('\n\n')}`,
    `## Boundaries\n\n${sim.response.disclaimer}\n\n${(sim.response.limitations??[]).join('\n\n')}\n\n${sim.result.model_note}\n\n${sim.sequence?.note??''}`,
    'Anatomy comes from source reconstructions. Overview geometry is sampled; branch/soma sizes and signal travel are illustrative. This report does not establish the behavior of a living fly.',
  ].join('\n\n')+'\n'
}

export function downloadRun(sim:SimulationEnvelope, format:'md'|'json') {
  const contents=format==='md'?runMarkdown(sim):JSON.stringify(runRecord(sim),null,2)
  const url=URL.createObjectURL(new Blob([contents],{type:format==='md'?'text/markdown;charset=utf-8':'application/json'}))
  const link=document.createElement('a')
  link.href=url; link.download=`neuropulse-run.${format}`
  document.body.appendChild(link);link.click();link.remove()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}
