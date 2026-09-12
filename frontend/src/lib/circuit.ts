import * as THREE from 'three'
import type { CircuitDoc } from '../types/circuit'

/** Vertex stride in the binary morphology buffer: x, y, z, geodesic. */
const STRIDE = 4

export interface CircuitGeometry {
  /** One LineSegments geometry holding every rendered neuron — a single draw call. */
  geometry: THREE.BufferGeometry
  /** Row index in the per-neuron state texture, keyed by bodyId. */
  slotOf: Map<number, number>
  /** Spatial anchor per rendered neuron (centroid of its real vertices). */
  anchors: Float32Array
  /** Cable extent per neuron, used to pace the intra-neuron wavefront. */
  maxGeodesic: Float32Array
  neuronCount: number
  bounds: THREE.Box3
}

export async function loadCircuit(
  base: string,
  name: string,
): Promise<{ doc: CircuitDoc; buffer: Float32Array }> {
  const [docRes, binRes] = await Promise.all([
    fetch(`${base}/${name}.json`),
    fetch(`${base}/${name}.bin`),
  ])
  if (!docRes.ok) throw new Error(`circuit index: ${docRes.status} ${docRes.statusText}`)
  if (!binRes.ok) throw new Error(`circuit geometry: ${binRes.status} ${binRes.statusText}`)
  const doc = (await docRes.json()) as CircuitDoc
  const buffer = new Float32Array(await binRes.arrayBuffer())
  return { doc, buffer }
}

/**
 * Flatten every neuron's real strands into one line-segment geometry.
 *
 * Each vertex carries the slot of the neuron it belongs to, so a single shader
 * can look that neuron's activation state up in a data texture — hundreds of
 * neurons animate independently without any per-neuron draw call or uniform.
 */
export function buildCircuitGeometry(doc: CircuitDoc, buffer: Float32Array): CircuitGeometry {
  let segTotal = 0
  for (const n of doc.neurons) {
    for (let p = 0; p < n.pathOffsets.length - 1; p++) {
      const len = n.pathOffsets[p + 1] - n.pathOffsets[p]
      if (len > 1) segTotal += len - 1
    }
  }

  const vCount = segTotal * 2
  const pos = new Float32Array(vCount * 3)
  const geo = new Float32Array(vCount)
  const slot = new Float32Array(vCount)

  const slotOf = new Map<number, number>()
  const anchors = new Float32Array(doc.neurons.length * 3)
  const maxGeodesic = new Float32Array(doc.neurons.length)
  const bounds = new THREE.Box3()
  const tmp = new THREE.Vector3()

  let v = 0
  for (let ni = 0; ni < doc.neurons.length; ni++) {
    const n = doc.neurons[ni]
    slotOf.set(n.bodyId, ni)
    maxGeodesic[ni] = Math.max(n.maxGeodesic, 1)

    let cx = 0, cy = 0, cz = 0, cn = 0
    for (let p = 0; p < n.pathOffsets.length - 1; p++) {
      const a = n.pathOffsets[p]
      const b = n.pathOffsets[p + 1]
      for (let i = a; i < b - 1; i++) {
        const o0 = (n.start + i) * STRIDE
        const o1 = (n.start + i + 1) * STRIDE
        pos[v * 3] = buffer[o0]; pos[v * 3 + 1] = buffer[o0 + 1]; pos[v * 3 + 2] = buffer[o0 + 2]
        geo[v] = buffer[o0 + 3]; slot[v] = ni; v++
        pos[v * 3] = buffer[o1]; pos[v * 3 + 1] = buffer[o1 + 1]; pos[v * 3 + 2] = buffer[o1 + 2]
        geo[v] = buffer[o1 + 3]; slot[v] = ni; v++
      }
      for (let i = a; i < b; i++) {
        const o = (n.start + i) * STRIDE
        cx += buffer[o]; cy += buffer[o + 1]; cz += buffer[o + 2]; cn++
        bounds.expandByPoint(tmp.set(buffer[o], buffer[o + 1], buffer[o + 2]))
      }
    }
    if (cn > 0) {
      anchors[ni * 3] = cx / cn
      anchors[ni * 3 + 1] = cy / cn
      anchors[ni * 3 + 2] = cz / cn
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geometry.setAttribute('aGeodesic', new THREE.BufferAttribute(geo, 1))
  geometry.setAttribute('aSlot', new THREE.BufferAttribute(slot, 1))
  geometry.computeBoundingSphere()

  return {
    geometry,
    slotOf,
    anchors,
    maxGeodesic,
    neuronCount: doc.neurons.length,
    bounds,
  }
}

/**
 * Per-neuron animation state, uploaded as a float texture.
 * R = ignition time (seconds, <0 = resting)
 * G = activation level 0..1
 * B = modality index (see MODALITY_ORDER)
 * A = sign (+1 excitatory, -1 inhibitory)
 */
export class NeuronStateTexture {
  readonly texture: THREE.DataTexture
  readonly data: Float32Array
  readonly width: number
  readonly height: number

  constructor(count: number) {
    this.width = Math.min(1024, Math.max(1, count))
    this.height = Math.ceil(count / this.width)
    this.data = new Float32Array(this.width * this.height * 4)
    this.reset()
    this.texture = new THREE.DataTexture(
      this.data, this.width, this.height, THREE.RGBAFormat, THREE.FloatType,
    )
    this.texture.minFilter = THREE.NearestFilter
    this.texture.magFilter = THREE.NearestFilter
    this.texture.needsUpdate = true
  }

  reset() {
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = -1      // not ignited
      this.data[i + 1] = 0
      this.data[i + 2] = 0
      this.data[i + 3] = 1
    }
  }

  set(slot: number, ignition: number, activation: number, modality: number, sign: number) {
    const o = slot * 4
    this.data[o] = ignition
    this.data[o + 1] = activation
    this.data[o + 2] = modality
    this.data[o + 3] = sign
  }

  commit() {
    this.texture.needsUpdate = true
  }

  dispose() {
    this.texture.dispose()
  }
}

export const MODALITY_ORDER = [
  'resting',
  'vision',
  'olfaction',
  'gustation',
  'mechanosensation',
  'audition',
  'airflow',
  'thermosensation',
  'hygrosensation',
  'mixed',
] as const

export function modalityIndex(m: string | null | undefined): number {
  if (!m) return 0
  const i = (MODALITY_ORDER as readonly string[]).indexOf(m)
  return i < 0 ? 9 : i
}
