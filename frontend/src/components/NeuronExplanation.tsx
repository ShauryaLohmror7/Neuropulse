import type { CircuitNode } from '../types/circuit'
import type { SimulationEnvelope } from '../types/api'
import { explainNeuron } from '../lib/neuronExplanation'

export function NeuronExplanation({node,sim}:{node:CircuitNode;sim:SimulationEnvelope|null}) {
  const info=explainNeuron(node,sim)
  return <div className="neuron-explanation">
    <div className="eyebrow">IN PLAIN LANGUAGE</div><h4>{info.title}</h4><p>{info.text}</p>
    <details><summary>Why is this neuron highlighted?</summary><p>{info.role}</p><small>{info.basis}</small>{info.source && <a href={info.source} target="_blank" rel="noreferrer">Read the research ↗</a>}</details>
  </div>
}
