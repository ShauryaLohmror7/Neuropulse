/** Mirrors the FastAPI response models. */

export type MappingQuality = 'SUPPORTED_REAL_MAPPING' | 'APPROXIMATE_MAPPING' | 'UNSUPPORTED'
export type EvidenceTier = 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE'

export interface ExperienceComponent {
  modality: string
  stimulus: string
  label: string
  direction: string | null
  intensity: number
  confidence: number
  mapping_quality: MappingQuality
  source_clause: string
  evidence: string
  caveat: string | null
  body_ids: number[]
  neuron_count: number
  seed_types: string[]
}

export interface UnmappedContent {
  text: string
  reason: string
  concept: string | null
  label: string | null
  note: string | null
}

export interface CompiledExperience {
  raw_text: string
  components: ExperienceComponent[]
  unmapped: UnmappedContent[]
  parser: string
  clauses: string[]
  note: string | null
}

export interface PulseEvent {
  step: number
  source: number
  target: number
  weight: number
  amplitude: number
  sign: 1 | -1
  modality: string | null
}

export interface NeuronActivation {
  body_id: number
  activation: number
  step: number
}

export interface StepSummary {
  step: number
  newly_activated: number
  active_total: number
  mean_activation: number
  pulses: number
}

export interface SimulationMetrics {
  neurons_activated: number
  connections_traversed: number
  propagation_depth: number
  regions_reached: string[]
  modalities: string[]
  total_synapses_traversed: number
  nt_coverage: Record<string, number | boolean>
}

export interface PropagationResult {
  metrics: SimulationMetrics
  steps: StepSummary[]
  activations: NeuronActivation[]
  pulses: PulseEvent[]
  seeds: Record<string, number[]>
  model_note: string
}

export interface ChannelReadout {
  key: string
  label: string
  evidence_tier: EvidenceTier
  evidence: string
  neurons_in_circuit: number
  neurons_activated: number
  mean_activation: number
  peak_activation: number
  earliest_step: number | null
  left_activation: number
  right_activation: number
  direction: string | null
  body_ids: number[]
}

export interface ModelledResponse {
  headline: string
  detail: string | null
  confidence: EvidenceTier
  channels: ChannelReadout[]
  competing: string[]
  direction: string | null
  disclaimer: string
}

export interface SimulationEnvelope {
  experience: CompiledExperience
  result: PropagationResult
  response: ModelledResponse
  rendered_activated: number
  circuit: {
    name: string
    neurons: number
    edges: number
    rendered: number
    dataset: string
  }
  lesion: {
    lesionedBodyIds: number[]
    deltaNeurons: number
    deltaConnections: number
    deltaDepth: number
    lostNeurons: number[]
    regionsLost: string[]
    caveat: string
    normalMetrics: SimulationMetrics
  } | null
}

export interface HealthInfo {
  status: string
  circuit?: {
    neurons: number
    edges: number
    rendered: number
    dataset: string
    datasetVersion: string
  }
  circuit_error?: string
  parser?: string
}
