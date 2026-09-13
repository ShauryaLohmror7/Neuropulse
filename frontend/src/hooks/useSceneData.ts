import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { buildCircuitGeometry, loadCircuit, type CircuitGeometry } from '../lib/circuit'
import { buildAnatomyGroups, loadAnatomy, type AnatomyDoc } from '../lib/anatomy'
import type { CircuitDoc } from '../types/circuit'

export interface SceneData {
  circuitDoc: CircuitDoc
  circuit: CircuitGeometry
  anatomy: { group: string; geometry: THREE.BufferGeometry; rois: string[] }[]
  anatomyDoc: AnatomyDoc | null
  /** Dense sample of real neurons rendered as structure, not signal. */
  context: CircuitGeometry | null
  /** Translation aligning the context bundle onto the circuit bundle. */
  contextOffset: THREE.Vector3
  /** Translation that aligns the anatomy bundle onto the circuit bundle. */
  anatomyOffset: THREE.Vector3
  /** Dataset-space origin (nm) shared by everything in the scene. */
  originNm: number[]
}

const BASE = '/circuits'

/** Cache the immutable scene for this page lifetime (including StrictMode remounts).
 * Fetch independent LOD layers concurrently. No biological fallback is invented.
 */
let scenePromise: Promise<SceneData> | null = null
function loadScene(): Promise<SceneData> {
  if (scenePromise) return scenePromise
  scenePromise = (async () => {
    const [primary, contextResult, anatomyResult, catalogueResult] = await Promise.allSettled([
      loadCircuit(BASE, 'cns_circuit'),
      loadCircuit(BASE, 'brain_context'),
      loadAnatomy(BASE),
      fetch(`${import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000/api'}/dataset/catalogue`).then(async r => {
        if (!r.ok) throw new Error('Full neuron catalogue unavailable')
        return await r.json() as CircuitDoc
      }),
    ])
    if (primary.status === 'rejected') throw primary.reason
    if (catalogueResult.status === 'rejected') throw catalogueResult.reason
    const {doc: overview, buffer} = primary.value
    const doc = catalogueResult.value
    const circuit = buildCircuitGeometry({...overview, somas:doc.somas}, buffer)
    const offsetFor = (origin: number[]) => new THREE.Vector3(
      ...origin.map((value, i) => (value - doc.transform.origin_nm[i]) / 1000) as [number,number,number],
    )
    let context: CircuitGeometry | null = null
    let contextOffset = new THREE.Vector3()
    if (contextResult.status === 'fulfilled') {
      context = buildCircuitGeometry(contextResult.value.doc, contextResult.value.buffer, {colourBy:'identity'})
      contextOffset = offsetFor(contextResult.value.doc.transform.origin_nm)
    } else console.warn('Context skeletons unavailable:', contextResult.reason)
    let anatomy: SceneData['anatomy'] = []
    let anatomyDoc: AnatomyDoc | null = null
    let anatomyOffset = new THREE.Vector3()
    if (anatomyResult.status === 'fulfilled') {
      const a = anatomyResult.value
      anatomyDoc = a.doc
      anatomyOffset = offsetFor(a.doc.transform.origin_nm)
      anatomy = buildAnatomyGroups(a.doc,a.verts,a.idx,anatomyOffset)
    } else console.warn('Region anatomy unavailable:', anatomyResult.reason)
    return { circuitDoc:doc,circuit,context,contextOffset,anatomy,anatomyDoc,anatomyOffset,originNm:doc.transform.origin_nm }
  })().catch(e => {scenePromise = null; throw e})
  return scenePromise
}

export function useSceneData() {
  const [data, setData] = useState<SceneData | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    loadScene().then(result => { if (!cancelled) setData(result) }).catch(e => {
      if (!cancelled) setError(`Real connectome data could not be loaded: ${(e as Error).message}. Check the circuit bundles; no synthetic fallback is used.`)
    })
    return () => {cancelled = true}
  }, [])
  return {data,error}
}
