import * as THREE from 'three'
import type { CircuitDoc } from '../types/circuit'

/** Vertex stride in the binary morphology buffer: x, y, z, geodesic. */
const STRIDE = 4

export interface CircuitGeometry {
  /** One LineSegments geometry holding every rendered neuron — a single draw call. */
  geometry: THREE.BufferGeometry
  /** Row index in the per-neuron state texture, keyed by bodyId. */
  slotOf: Map<number, number>
  /** bodyId for each slot, for picking and labelling. */
  bodyIds: Int32Array
  /** Spatial anchor per rendered neuron (centroid of its real vertices). */
  anchors: Float32Array
  /** Cable extent per neuron, used to pace the intra-neuron wavefront. */
  maxGeodesic: Float32Array
  neuronCount: number
  bounds: THREE.Box3
  /** Real soma positions, if the bundle carries them. */
  somas: { bodyIds: number[]; positions: Float32Array; colours: Float32Array } | null
}

/**
 * Resting colour by the neuron's real MaleCNS annotation.
 *
 * This is how reconstructions of this dataset are conventionally shown: each
 * cell class in its own hue, so a dense arbor reads as distinguishable neurons
 * rather than an undifferentiated tangle. The hue is *derived from real
 * annotation*, so colour here carries information.
 */
const CLASS_TINT: Record<string, [number, number, number]> = {
  visual: [0.42, 0.62, 0.95],
  olfactory: [0.36, 0.88, 0.70],
  gustatory: [0.95, 0.55, 0.76],
  mechanosensory: [0.98, 0.74, 0.46],
  mechanosensory_tactile: [0.96, 0.68, 0.42],
  mechanosensory_proprioceptive: [0.86, 0.66, 0.52],
  thermosensory: [1.0, 0.55, 0.4],
  hygrosensory: [0.55, 0.82, 0.98],
  chemosensory: [0.62, 0.9, 0.74],
  unknown_sensory: [0.6, 0.62, 0.68],
  Kenyon_Cell: [0.72, 0.62, 0.95],
  ALPN: [0.44, 0.86, 0.78],
  ALLN: [0.38, 0.72, 0.68],
  MBON: [0.86, 0.72, 0.98],
  DAN: [0.92, 0.66, 0.86],
  CX: [0.66, 0.70, 0.96],
}

const SUPERCLASS_TINT: Record<string, [number, number, number]> = {
  visual_projection: [0.52, 0.70, 1.0],
  visual_centrifugal: [0.48, 0.62, 0.9],
  ol_intrinsic: [0.40, 0.54, 0.82],
  ol_sensory: [0.46, 0.66, 0.98],
  cb_intrinsic: [0.62, 0.66, 0.80],
  cb_sensory: [0.56, 0.80, 0.76],
  descending_neuron: [1.0, 0.80, 0.50],
  ascending_neuron: [0.80, 0.84, 0.60],
  vnc_intrinsic: [0.58, 0.64, 0.78],
  vnc_sensory: [0.80, 0.70, 0.55],
  vnc_motor: [1.0, 0.72, 0.58],
  cb_motor: [1.0, 0.74, 0.60],
}

const DEFAULT_TINT: [number, number, number] = [0.56, 0.60, 0.70]

function tintFor(node: { class: string | null; superclass: string | null } | undefined) {
  if (!node) return DEFAULT_TINT
  if (node.class && CLASS_TINT[node.class]) return CLASS_TINT[node.class]
  if (node.superclass && SUPERCLASS_TINT[node.superclass]) return SUPERCLASS_TINT[node.superclass]
  return DEFAULT_TINT
}

/**
 * Per-neuron hue, derived deterministically from the real bodyId.
 *
 * This is the convention published renders of this connectome use: every cell
 * gets its own colour so that individual arbors stay separable inside dense
 * tissue. The hue carries no biological meaning — it is an identity cue — which
 * is why it is used only for the inert context layer, never for cells whose
 * colour is reporting simulated activity.
 */
function hashHue(bodyId: number): [number, number, number] {
  let h = bodyId >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = (h ^ (h >>> 16)) >>> 0
  const hue = (h % 3600) / 3600
  const sat = 0.68 + ((h >>> 12) % 100) / 100 * 0.28
  const light = 0.48 + ((h >>> 20) % 100) / 100 * 0.16
  return hslToRgb(hue, sat, light)
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h * 12) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
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
export function buildCircuitGeometry(
  doc: CircuitDoc,
  buffer: Float32Array,
  opts: { colourBy?: 'class' | 'identity' } = {},
): CircuitGeometry {
  const byIdentity = opts.colourBy === 'identity'
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
  const extent = new Float32Array(vCount)
  const slot = new Float32Array(vCount)
  const tint = new Float32Array(vCount * 3)

  const nodeById = new Map(doc.nodes.map((n) => [n.bodyId, n]))
  const slotOf = new Map<number, number>()
  const bodyIds = new Int32Array(doc.neurons.length)
  const anchors = new Float32Array(doc.neurons.length * 3)
  const maxGeodesic = new Float32Array(doc.neurons.length)
  const bounds = new THREE.Box3()
  const tmp = new THREE.Vector3()

  let v = 0
  for (let ni = 0; ni < doc.neurons.length; ni++) {
    const n = doc.neurons[ni]
    slotOf.set(n.bodyId, ni)
    bodyIds[ni] = n.bodyId
    maxGeodesic[ni] = Math.max(n.maxGeodesic, 1)
    const [tr, tg, tb] = byIdentity ? hashHue(n.bodyId) : tintFor(nodeById.get(n.bodyId))

    let cx = 0, cy = 0, cz = 0, cn = 0
    for (let p = 0; p < n.pathOffsets.length - 1; p++) {
      const a = n.pathOffsets[p]
      const b = n.pathOffsets[p + 1]
      for (let i = a; i < b - 1; i++) {
        const o0 = (n.start + i) * STRIDE
        const o1 = (n.start + i + 1) * STRIDE
        pos[v * 3] = buffer[o0]; pos[v * 3 + 1] = buffer[o0 + 1]; pos[v * 3 + 2] = buffer[o0 + 2]
        extent[v] = maxGeodesic[ni]; geo[v] = buffer[o0 + 3]; slot[v] = ni
        tint[v * 3] = tr; tint[v * 3 + 1] = tg; tint[v * 3 + 2] = tb; v++
        pos[v * 3] = buffer[o1]; pos[v * 3 + 1] = buffer[o1 + 1]; pos[v * 3 + 2] = buffer[o1 + 2]
        extent[v] = maxGeodesic[ni]; geo[v] = buffer[o1 + 3]; slot[v] = ni
        tint[v * 3] = tr; tint[v * 3 + 1] = tg; tint[v * 3 + 2] = tb; v++
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
  geometry.setAttribute('aExtent', new THREE.BufferAttribute(extent, 1))
  geometry.setAttribute('aGeodesic', new THREE.BufferAttribute(geo, 1))
  geometry.setAttribute('aSlot', new THREE.BufferAttribute(slot, 1))
  geometry.setAttribute('aTint', new THREE.BufferAttribute(tint, 3))
  geometry.computeBoundingSphere()

  // --- somata -----------------------------------------------------------
  let somas: CircuitGeometry['somas'] = null
  const sd = doc.somas
  if (sd && sd.bodyIds.length) {
    const n = sd.bodyIds.length
    const positions = new Float32Array(sd.positions.slice(0, n * 3))
    const colours = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const [r, g, b] = byIdentity ? hashHue(sd.bodyIds[i]) : tintFor(nodeById.get(sd.bodyIds[i]))
      colours[i * 3] = r
      colours[i * 3 + 1] = g
      colours[i * 3 + 2] = b
    }
    somas = { bodyIds: sd.bodyIds, positions, colours }
  }

  return {
    geometry,
    slotOf,
    bodyIds,
    anchors,
    maxGeodesic,
    neuronCount: doc.neurons.length,
    bounds,
    somas,
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
