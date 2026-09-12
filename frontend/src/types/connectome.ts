/** Types mirroring the backend payloads. All coordinates are real MaleCNS geometry. */

export interface Provenance {
  dataset: string
  dataset_version: string
  server: string
  source_query: string
  fetched_at: string
  neuprint_python_version?: string | null
  citation: string
  notes?: string | null
  extra: Record<string, unknown>
}

export interface MorphologyPayload {
  bodyId: number
  /** Flat xyz triples, scene units (micrometres), centred on the circuit origin. */
  vertices: number[]
  /** Index into the vertex list where each unbranched strand starts/ends. */
  pathOffsets: number[]
  radii: number[]
  /** Cable distance from the skeleton root for every vertex, scene units. */
  geodesic: number[]
  somaPosition: [number, number, number] | null
  stats: {
    pathCount: number
    vertexCount: number
    originalNodeCount: number
    cableLengthNm: number
    maxGeodesic: number
  }
  transform: { units: string; origin_nm: number[]; scale: number }
  meta: Record<string, unknown>
  connectivity?: {
    downstream: { bodyId: number; weight: number; type: string | null }[]
    upstream: { bodyId: number; weight: number; type: string | null }[]
  }
}

export interface CachedDocument<T> {
  provenance: Provenance
  payload: T
}
