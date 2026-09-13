import { useReducedMotion } from 'framer-motion'
import { useStore } from '../../lib/store'
import { anatomyEntrance } from '../../lib/anatomyEntrance'
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GROUP_TINT, makeAnatomyMaterial } from '../../lib/anatomyMaterial'

interface Props {
  groups: { group: string; geometry: THREE.BufferGeometry; rois: string[] }[]
  opacity?: number
  /** Anatomical groups to omit (e.g. the VNC while in brain view). */
  hide?: Set<string>
}

/**
 * Real MaleCNS neuropil surfaces, drawn as translucent glass.
 *
 * These are the dataset's own ROI meshes (decimated, never re-sculpted), so the
 * silhouette a viewer sees is the actual shape of the reconstructed brain and
 * ventral nerve cord.
 */
export function AnatomyShell({ groups, opacity = 1, hide }: Props) {
  const reduced = useReducedMotion()
  const materials = useMemo(() => {
    const m = new Map<string, THREE.ShaderMaterial>()
    for (const g of groups) {
      m.set(g.group, makeAnatomyMaterial(GROUP_TINT[g.group] ?? '#44506a'))
    }
    return m
  }, [groups])

  useFrame(({clock}) => {
    for (const mat of materials.values()) mat.uniforms.uOpacity.value = 0.105 * opacity * Math.min(1, anatomyEntrance(clock.elapsedTime, !!reduced || useStore.getState().manualCamera || !!useStore.getState().sim))
  })

  useEffect(() => () => { for (const m of materials.values()) m.dispose() }, [materials])

  if (opacity <= 0.001) return null

  return (
    <group>
      {groups
        .filter((g) => !hide?.has(g.group))
        .map((g) => (
          <mesh key={g.group} geometry={g.geometry} material={materials.get(g.group)!} renderOrder={1} />
        ))}
    </group>
  )
}
