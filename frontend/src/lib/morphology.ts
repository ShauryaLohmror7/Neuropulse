import * as THREE from 'three'
import type { MorphologyPayload } from '../types/connectome'

/**
 * Build a single line-segment BufferGeometry from a neuron's real strands.
 *
 * Each strand is an unbranched run of real skeleton nodes; we emit it as a
 * connected sequence of segments. Two custom attributes ride along:
 *   aGeodesic — cable distance from the skeleton root (drives travelling pulses)
 *   aRadius   — real skeleton radius (drives subtle thickness/brightness cues)
 */
export function buildSkeletonGeometry(payload: MorphologyPayload): THREE.BufferGeometry {
  const { vertices, pathOffsets, geodesic, radii } = payload
  const segCount = countSegments(pathOffsets)

  const pos = new Float32Array(segCount * 6)
  const geo = new Float32Array(segCount * 2)
  const rad = new Float32Array(segCount * 2)

  let s = 0
  for (let p = 0; p < pathOffsets.length - 1; p++) {
    const start = pathOffsets[p]
    const end = pathOffsets[p + 1]
    for (let i = start; i < end - 1; i++) {
      pos[s * 6 + 0] = vertices[i * 3 + 0]
      pos[s * 6 + 1] = vertices[i * 3 + 1]
      pos[s * 6 + 2] = vertices[i * 3 + 2]
      pos[s * 6 + 3] = vertices[(i + 1) * 3 + 0]
      pos[s * 6 + 4] = vertices[(i + 1) * 3 + 1]
      pos[s * 6 + 5] = vertices[(i + 1) * 3 + 2]
      geo[s * 2 + 0] = geodesic[i] ?? 0
      geo[s * 2 + 1] = geodesic[i + 1] ?? 0
      rad[s * 2 + 0] = radii[i] ?? 0
      rad[s * 2 + 1] = radii[i + 1] ?? 0
      s++
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aGeodesic', new THREE.BufferAttribute(geo, 1))
  g.setAttribute('aRadius', new THREE.BufferAttribute(rad, 1))
  g.computeBoundingSphere()
  return g
}

function countSegments(offsets: number[]): number {
  let n = 0
  for (let p = 0; p < offsets.length - 1; p++) {
    const len = offsets[p + 1] - offsets[p]
    if (len > 1) n += len - 1
  }
  return n
}

/** Centroid of a neuron's real vertices — used as a node anchor for synaptic pulses. */
export function centroidOf(payload: MorphologyPayload): THREE.Vector3 {
  const v = payload.vertices
  let x = 0, y = 0, z = 0
  const n = v.length / 3
  for (let i = 0; i < n; i++) {
    x += v[i * 3]; y += v[i * 3 + 1]; z += v[i * 3 + 2]
  }
  return new THREE.Vector3(x / n, y / n, z / n)
}

export function boundsOf(payload: MorphologyPayload): THREE.Box3 {
  const box = new THREE.Box3()
  const v = payload.vertices
  const p = new THREE.Vector3()
  for (let i = 0; i < v.length; i += 3) box.expandByPoint(p.set(v[i], v[i + 1], v[i + 2]))
  return box
}
