import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LABELLED_ROIS, regionName } from '../../lib/regions'
import { useStore, type ProjectedLabel } from '../../lib/store'
import type { AnatomyDoc } from '../../lib/anatomy'

interface Props {
  doc: AnatomyDoc | null
  offset: THREE.Vector3
  opacity: number
}

/**
 * Projects real neuropil centroids to screen space each frame and publishes the
 * result to the store; the DOM layer that draws them lives outside the canvas.
 *
 * Anchors are the centroids of the dataset's own ROI meshes, and the text is
 * the dataset's ROI identifier plus its standard anatomical name — so a label
 * always points at the region it names.
 */
export function RegionLabels({ doc, offset, opacity }: Props) {
  const setLabels = useStore((s) => s.setLabels)
  const showLabels = useStore((s) => s.showLabels)

  const anchors = useMemo(() => {
    if (!doc) return []
    const wanted = new Set(LABELLED_ROIS)
    return doc.rois
      .filter((r) => wanted.has(r.roi))
      .map((r) => ({
        roi: r.roi,
        name: regionName(r.roi),
        // ROI centroids sit in the anatomy bundle's frame: align to the circuit
        // frame, then apply the scene's dataset-axis rotation (pi about X).
        world: new THREE.Vector3(
          r.centroid[0] + offset.x,
          -(r.centroid[1] + offset.y),
          -(r.centroid[2] + offset.z),
        ),
      }))
  }, [doc, offset])

  const v = useMemo(() => new THREE.Vector3(), [])
  const tick = useRef(0)
  const cleared = useRef(false)

  useFrame(({ camera, size }) => {
    if (!showLabels || opacity < 0.06) {
      if (!cleared.current) {
        setLabels([])
        cleared.current = true
      }
      return
    }
    cleared.current = false
    // Text follows a slow camera; 20 Hz is ample and keeps React quiet.
    if (++tick.current % 3 !== 0) return

    const out: ProjectedLabel[] = []
    for (const a of anchors) {
      v.copy(a.world).project(camera)
      if (v.z > 1) continue
      const x = (v.x * 0.5 + 0.5) * size.width
      const y = (-v.y * 0.5 + 0.5) * size.height
      if (x < 30 || x > size.width - 30 || y < 74 || y > size.height - 120) continue
      out.push({ roi: a.roi, name: a.name, x, y, depth: v.z })
    }
    // Nearest first, so the overlay can thin out crowded clusters predictably.
    out.sort((p, q) => p.depth - q.depth)
    setLabels(out)
  })

  return null
}
