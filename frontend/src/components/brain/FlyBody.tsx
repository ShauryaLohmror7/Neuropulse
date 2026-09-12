import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeAnatomyMaterial } from '../../lib/anatomyMaterial'
import { useStore } from '../../lib/store'

/**
 * SCHEMATIC FLY BODY — CONTEXTUAL ANATOMY, NOT CONNECTOME DATA.
 *
 * This shell is generated procedurally. It is *not* derived from MaleCNS and
 * carries no reconstructed structure; it exists only so a viewer can see where
 * the real nervous system sits inside the animal. It is deliberately drawn as a
 * faint glass volume so it never reads as measured data.
 *
 * What *is* faithful is the scale. Dimensions follow published adult
 * Drosophila melanogaster morphometrics (~2.5 mm body, ~0.8 mm head width), and
 * the shell is positioned in the dataset's own coordinate frame, so the real
 * brain lands inside the head and the real ventral nerve cord inside the thorax
 * at their true relative sizes.
 *
 * Dataset axes (MaleCNS): +X = the fly's left, -Y = dorsal, -Z = anterior.
 * The scene applies a pi rotation about X, so here +Y is up and +Z is forward.
 */

interface Part {
  key: string
  geometry: THREE.BufferGeometry
  position: [number, number, number]
  rotation?: [number, number, number]
  tint: string
  strength: number
}

const SHELL = '#66707f'
const EYE = '#7a5766'

function ellipsoid(rx: number, ry: number, rz: number, seg = 32): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, seg, Math.max(12, seg / 2))
  g.scale(rx, ry, rz)
  return g
}

function buildParts(): Part[] {
  const parts: Part[] = []

  // --- head: must enclose the real brain (x +/-339, y -122..257, z 236..495 um)
  parts.push({
    key: 'head',
    geometry: ellipsoid(400, 320, 250, 44),
    position: [0, 66, 366],
    tint: SHELL,
    strength: 1,
  })

  // --- compound eyes, lateral on the head
  for (const side of [1, -1]) {
    parts.push({
      key: `eye${side}`,
      geometry: ellipsoid(170, 250, 200, 30),
      position: [side * 290, 70, 360],
      tint: EYE,
      strength: 1.5,
    })
  }

  // --- antennae, projecting anteriorly (where olfactory and JO input enters)
  for (const side of [1, -1]) {
    parts.push({
      key: `antenna${side}`,
      geometry: ellipsoid(48, 60, 130, 18),
      position: [side * 105, -40, 560],
      rotation: [0.32, 0, 0],
      tint: SHELL,
      strength: 1.25,
    })
  }

  // --- proboscis, ventral-anterior (labellar taste)
  parts.push({
    key: 'proboscis',
    geometry: ellipsoid(90, 130, 90, 20),
    position: [0, -180, 430],
    tint: SHELL,
    strength: 1.1,
  })

  // --- thorax: must enclose the real VNC (x +/-145, y -257..-31, z -495..49)
  parts.push({
    key: 'thorax',
    geometry: ellipsoid(450, 400, 520, 44),
    position: [0, -150, -230],
    tint: SHELL,
    strength: 0.95,
  })

  // --- abdomen, tapering posteriorly
  parts.push({
    key: 'abdomen',
    geometry: ellipsoid(360, 330, 620, 40),
    position: [0, -210, -1050],
    tint: SHELL,
    strength: 0.85,
  })

  // --- wings, hinged dorsally on the thorax and swept back
  for (const side of [1, -1]) {
    const g = ellipsoid(300, 14, 900, 26)
    parts.push({
      key: `wing${side}`,
      geometry: g,
      position: [side * 330, 120, -900],
      rotation: [0.05, side * -0.16, side * 0.12],
      tint: SHELL,
      strength: 0.6,
    })
  }

  // --- legs: three pairs from the ventral thorax, one per VNC leg neuropil
  const legZ = [140, -190, -520]
  legZ.forEach((z, i) => {
    for (const side of [1, -1]) {
      const spread = 0.55 + i * 0.16
      const g = ellipsoid(26, 26, 430, 12)
      parts.push({
        key: `leg${i}${side}`,
        geometry: g,
        position: [side * 330, -430, z - 170],
        rotation: [1.05 - i * 0.18, side * spread, 0],
        tint: SHELL,
        strength: 0.75,
      })
      const t = ellipsoid(18, 18, 330, 10)
      parts.push({
        key: `tarsus${i}${side}`,
        geometry: t,
        position: [side * 520, -760, z - 400],
        rotation: [0.55 - i * 0.1, side * spread, 0],
        tint: SHELL,
        strength: 0.65,
      })
    }
  })

  return parts
}

export function FlyBody({ opacity = 1 }: { opacity?: number }) {
  const parts = useMemo(buildParts, [])
  const materials = useMemo(() => {
    const map = new Map<string, THREE.ShaderMaterial>()
    for (const p of parts) {
      const m = makeAnatomyMaterial(p.tint, p.strength)
      m.uniforms.uOpacity.value = 0.085
      m.uniforms.uFresnel.value = 2.6
      map.set(p.key, m)
    }
    return map
  }, [parts])

  const group = useRef<THREE.Group>(null)
  const sim = useStore((s) => s.sim)
  const phase = useStore((s) => s.phase)

  // Modelled response cue: a small yaw away from the threatened side. Kept
  // deliberately slight — it visualises the model's lateral bias, and must not
  // suggest a measured behaviour.
  const targetYaw = useMemo(() => {
    if (!sim || phase !== 'settled') return 0
    const r = sim.response
    if (!r.direction || r.confidence === 'NONE') return 0
    const escaping = r.channels.some(
      (c) => c.key.startsWith('escape') && c.neurons_activated > 0,
    )
    if (!escaping) return 0
    // Stimulus on the fly's left -> turn toward its right.
    return r.direction === 'left' ? -0.22 : 0.22
  }, [sim, phase])

  useFrame((_, dt) => {
    if (!group.current) return
    const k = 1 - Math.pow(0.001, dt)
    group.current.rotation.y += (targetYaw - group.current.rotation.y) * k * 0.55
    for (const m of materials.values()) m.uniforms.uStrength.value ||= 1
  })

  useFrame(() => {
    for (const p of parts) {
      const m = materials.get(p.key)
      if (m) m.uniforms.uOpacity.value = 0.085 * opacity
    }
  })

  if (opacity <= 0.001) return null

  return (
    <group ref={group}>
      {parts.map((p) => (
        <mesh
          key={p.key}
          geometry={p.geometry}
          material={materials.get(p.key)!}
          position={p.position}
          rotation={p.rotation}
          renderOrder={0}
        />
      ))}
    </group>
  )
}
