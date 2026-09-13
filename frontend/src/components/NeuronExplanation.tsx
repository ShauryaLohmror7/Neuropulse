import type { CircuitNode } from '../types/circuit'
import type { SimulationEnvelope } from '../types/api'
import { explainNeuron } from '../lib/neuronExplanation'

export function NeuronExplanation({node,sim}:{node:CircuitNode;sim:SimulationEnvelope|null}) {
  const info=explainNeuron(node,sim)
  return <div className="neuron-explanation">
    <div className="eyebrow">IN PLAIN LANGUAGE</div><h4>{info.title}</h4><p>{info.text}</p>
    <h5 className="neuron-role-heading">Why it is highlighted</h5><p className="neuron-run-role">{info.role}</p><details><summary>Evidence for this explanation</summary><small>{info.basis}</small>{info.source && <a href={info.source} target="_blank" rel="noreferrer">Read the research ↗</a>}</details>
  </div>
}
