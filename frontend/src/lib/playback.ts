import type { NeuronActivation } from '../types/api'

/** Recorded state drives brightness. Fronts mark actual model emissions (or first arrival).
 * The root-to-branch sweep is illustrative: the model has no within-cell timing.
 */
export function neuronPlayback(a: NeuronActivation, step: number, summary: boolean) {
  if (summary) return { activation: a.activation, ignitionStep: a.step }
  if (step < a.step) return { activation: 0, ignitionStep: -1 }
  const activation = a.history?.[step] ?? 0
  let ignitionStep = a.step
  for (const emission of a.emission_steps ?? []) {
    if (emission <= step) ignitionStep = Math.max(ignitionStep, emission)
  }
  return { activation, ignitionStep }
}
