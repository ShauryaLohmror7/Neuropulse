import type { Provenance } from './connectome'

export interface CircuitNeuronGeometry {
  bodyId: number
  /** Vertex offset into the binary buffer (stride 4: x, y, z, geodesic). */
  start: number
  count: number
  /** Vertex indices where each unbranched strand starts, relative to `start`. */
  pathOffsets: number[]
  maxGeodesic: number
  fragments: number
}

export interface CircuitNode {
  bodyId: number
  hop: number | null
  type: string | null
  instance: string | null
  class: string | null
  superclass: string | null
  side: string | null
  nt: string | null
  ntConf: number | null
  pre: number | null
  post: number | null
}

export interface ConceptInfo {
  key: string
  modality: string
  label: string
  mappingQuality: 'SUPPORTED_REAL_MAPPING' | 'APPROXIMATE_MAPPING' | 'UNSUPPORTED'
  evidence: string
  caveat: string | null
}

export interface CircuitDoc {
  provenance: Provenance
  name: string
  transform: {
    units: string
    origin_nm: number[]
    scale_from_nm: number
    bounds_nm: { min: number[]; max: number[] }
  }
  counts: {
    graphNeurons: number
    graphEdges: number
    renderedNeurons: number
    renderedVertices: number
  }
  seedSets: Record<string, number[]>
  policy: Record<string, number | null>
  neurons: CircuitNeuronGeometry[]
  /** Real soma (cell body) positions, from the dataset's somaLocation field. */
  somas?: { bodyIds: number[]; positions: number[] }
  nodes: CircuitNode[]
  edges: { source: number[]; target: number[]; weight: number[] }
  extra: { concepts?: ConceptInfo[] }
}
