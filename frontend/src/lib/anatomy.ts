import * as THREE from 'three'
import type { Provenance } from '../types/connectome'

export interface RoiEntry {
  roi: string
  group: string
  vertexStart: number
  vertexCount: number
  indexStart: number
  indexCount: number
  centroid: [number, number, number]
}

export interface AnatomyDoc {
  provenance: Provenance
  transform: {
    units: string
    origin_nm: number[]
    bounds_um: { min: number[]; max: number[] }
  }
  rois: RoiEntry[]
  counts: { vertices: number; indices: number }
}

export async function loadAnatomy(base: string, name = 'anatomy') {
  const [d, v, i] = await Promise.all([
    fetch(`${base}/${name}.json`),
    fetch(`${base}/${name}.verts.bin`),
    fetch(`${base}/${name}.idx.bin`),
  ])
  if (!d.ok || !v.ok || !i.ok) throw new Error('anatomy bundle missing')
  const doc = (await d.json()) as AnatomyDoc
  const verts = new Float32Array(await v.arrayBuffer())
  const idx = new Uint32Array(await i.arrayBuffer())
  return { doc, verts, idx }
}

/**
 * Build one geometry per anatomical group.
 *
 * `offset` aligns this bundle with the circuit bundle: both record the dataset
 * coordinate (in nm) that became their local origin, so the difference puts
 * neurons inside the neuropils they actually occupy.
 */
export function buildAnatomyGroups(
  doc: AnatomyDoc,
  verts: Float32Array,
  idx: Uint32Array,
  offset: THREE.Vector3,
): { group: string; geometry: THREE.BufferGeometry; rois: string[] }[] {
  const byGroup = new Map<string, RoiEntry[]>()
  for (const r of doc.rois) {
    const list = byGroup.get(r.group) ?? []
    list.push(r)
    byGroup.set(r.group, list)
  }

  const out: { group: string; geometry: THREE.BufferGeometry; rois: string[] }[] = []
  for (const [group, entries] of byGroup) {
    let vTotal = 0
    let iTotal = 0
    for (const e of entries) {
      vTotal += e.vertexCount
      iTotal += e.indexCount
    }
    const pos = new Float32Array(vTotal * 3)
    const ind = new Uint32Array(iTotal)
    let vo = 0
    let io = 0
    for (const e of entries) {
      for (let k = 0; k < e.vertexCount; k++) {
        pos[(vo + k) * 3] = verts[(e.vertexStart + k) * 3] + offset.x
        pos[(vo + k) * 3 + 1] = verts[(e.vertexStart + k) * 3 + 1] + offset.y
        pos[(vo + k) * 3 + 2] = verts[(e.vertexStart + k) * 3 + 2] + offset.z
      }
      for (let k = 0; k < e.indexCount; k++) {
        ind[io + k] = idx[e.indexStart + k] - e.vertexStart + vo
      }
      vo += e.vertexCount
      io += e.indexCount
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setIndex(new THREE.BufferAttribute(ind, 1))
    g.computeVertexNormals()
    g.computeBoundingSphere()
    out.push({ group, geometry: g, rois: entries.map((e) => e.roi) })
  }
  return out
}
