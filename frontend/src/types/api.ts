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
  temporal_pattern?: 'pulse' | 'repeated' | 'sustained'
  input_steps?: number[]
  timing_note?: string
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
  interpreter_notice?: string | null
  scene_interpretations?: {label:string;original:string;assumptions:string;missing:string;question?:string}[]
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
  carried?: boolean
  modality?: string | null
  body_id: number
  activation: number
  history: number[]
  emission_steps: number[]
  step: number
}

export interface StepSummary {
  input_neurons?: number
  cumulative_connections: number
  step: number
  newly_activated: number
  active_total: number
  mean_activation: number
  pulses: number
}

export interface SimulationMetrics {
  connections_considered: number
  pulses_omitted: number
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
  ai_hypothesis?: {kind:'suggested_action'|'clarification';evidence_body_ids?:number[];activity_observation?:string;basis?:'activity_informed'|'scene_only';verified_activity?:{body_id:number;type:string|null;class:string|null;side:string|null;peak_model_activity:number|null;first_step:number|null}[];action:string;rationale:string;assumptions:string[];provider:string;model:string;evidence_level:string}|null
  ai_notice?: string|null
  plain_language?: string
  interpretation_kind?: 'behavioral_marker'|'partial_marker'|'sensory_only'|'no_input'
  neural_summary?: string[]
  limitations?: string[]
  output_evidence?: {label:string;marker_types:string[];reached:number;available:number;peak:number;engaged:boolean;body_ids:number[]}[]
  headline: string
  detail: string | null
  confidence: EvidenceTier
  channels: ChannelReadout[]
  competing: string[]
  direction: string | null
  disclaimer: string
}

export interface SimulationEnvelope {
  sequence?: {mode:string; carried_active:number; note:string; events:{text:string;reached:number;carried_active:number;steps:number}[]} | null
  systems?: {key:string;label:string;role:string;total:number;reached:number;active_by_step:number[];peak:number;example_ids:number[]}[]
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

export interface InterpreterInfo { available: boolean; provider: string; model: string }
export interface InterpretationReceipt { experience: CompiledExperience; ticket: string; notice: string | null }
