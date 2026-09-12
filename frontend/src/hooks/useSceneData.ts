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
  /** Dataset-space origin (nm) shared by everything in the scene. */
  originNm: number[]
}

const BASE = '/circuits'

/**
 * Load the real circuit and the real neuropil surfaces, aligned to a common
 * dataset origin. Both bundles record the nanometre coordinate that became
 * their local zero, so the offset between them is exact — neurons land inside
 * the neuropils they actually occupy.
 */
export function useSceneData() {
  const [data, setData] = useState<SceneData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { doc, buffer } = await loadCircuit(BASE, 'cns_circuit')
        const circuit = buildCircuitGeometry(doc, buffer)

        let anatomy: SceneData['anatomy'] = []
        let anatomyDoc: AnatomyDoc | null = null
        try {
          const a = await loadAnatomy(BASE)
          anatomyDoc = a.doc
          const co = doc.transform.origin_nm
          const ao = a.doc.transform.origin_nm
          const offset = new THREE.Vector3(
            (ao[0] - co[0]) / 1000,
            (ao[1] - co[1]) / 1000,
            (ao[2] - co[2]) / 1000,
          )
          anatomy = buildAnatomyGroups(a.doc, a.verts, a.idx, offset)
        } catch (e) {
          // Anatomy is context, not the claim — the scene still works without it.
          console.warn('anatomy unavailable:', e)
        }

        if (!cancelled) {
          setData({
            circuitDoc: doc,
            circuit,
            anatomy,
            anatomyDoc,
            originNm: doc.transform.origin_nm,
          })
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            `Could not load real connectome data (${(e as Error).message}).\n\n` +
              `Build it with:\n` +
              `  cd backend && .venv/bin/python -m scripts.build_circuit\n` +
              `  cd backend && .venv/bin/python -m scripts.fetch_anatomy\n\n` +
              `NEUROPULSE has no synthetic fallback by design.`,
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { data, error }
}
