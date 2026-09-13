import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  abdomenGeometry,
  antennaGeometry,
  buildLeg,
  eyeGeometry,
  headGeometry,
  segmentGeometry,
  thoraxGeometry,
  wingGeometry,
  wingVeins,
} from '../../lib/flyGeometry'
import { makeBodyMaterial, makeEyeMaterial } from '../../lib/bodyMaterial'


/**
 * SCHEMATIC FLY BODY — CONTEXTUAL ANATOMY, NOT CONNECTOME DATA.
 *
 * Generated procedurally; nothing here is reconstructed from MaleCNS. It exists
 * so a viewer can see where the real nervous system sits inside the animal, and
 * is drawn as dark glass so it never reads as measured data.
 *
 * The *scale and placement* are faithful: dimensions follow adult Drosophila
 * melanogaster morphometrics (~2.5 mm body), and the shell is positioned in the
 * dataset's own frame, so the real brain lands inside the head and the real
 * ventral nerve cord inside the thorax at true relative size.
 *
 * Authored in screen frame (+Y up, +Z toward the head, +X the fly's left), so
 * this component must NOT be nested inside the scene's dataset-axis rotation.
 */

// Anchors chosen so the real neuropils sit where they belong:
// brain occupies x +/-339, y -122..257, z 236..495; VNC x +/-145, y -257..-31, z -495..49.
const HEAD = new THREE.Vector3(0, 78, 352)
const THORAX = new THREE.Vector3(0, -150, -250)
const ABDOMEN = new THREE.Vector3(0, -205, -1180)

export function FlyBody({ opacity = 1 }: { opacity?: number }) {
  const geo = useMemo(
    () => ({
      head: headGeometry(),
      eye: eyeGeometry(),
      thorax: thoraxGeometry(),
      abdomen: abdomenGeometry(),
      wing: wingGeometry(),
      veins: wingVeins(),
      antenna: antennaGeometry(),
    }),
    [],
  )

  const mat = useMemo(
    () => ({
      shell: makeBodyMaterial({ opacity: 0.10, rimStrength: 0.5, rimPower: 2.5 }),
      thorax: makeBodyMaterial({ opacity: 0.24, rimStrength: 1.05, rimPower: 2.3 }),
      abdomen: makeBodyMaterial({ opacity: 0.22, rimStrength: 0.95, rimPower: 2.1 }),
      limb: makeBodyMaterial({ opacity: 0.5, rimStrength: 1.4, rimPower: 1.7 }),
      wing: makeBodyMaterial({
        color: '#0b0e14', rim: '#93a8c8', opacity: 0.21, rimStrength: 0.7, rimPower: 3.4,
      }),
      eye: makeEyeMaterial(),
    }),
    [],
  )

  const veinMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#7d90ad', transparent: true, opacity: 0.16, depthWrite: false,
      }),
    [],
  )

  // Six legs, each a jointed chain hanging off the ventral thorax.
  const legs = useMemo(() => {
    const out: { key: string; seg: ReturnType<typeof buildLeg>[number] }[] = []
    const origins: [number, number, number][] = [
      [188, -300, 92],
      [214, -326, -232],
      [200, -318, -536],
    ]
    origins.forEach((o, pair) => {
      for (const side of [1, -1]) {
        const segs = buildLeg([o[0] * side, o[1], o[2]], side, pair as 0 | 1 | 2)
        segs.forEach((seg, i) => out.push({ key: `leg-${pair}-${side}-${i}`, seg }))
      }
    })
    return out
  }, [])

  const segGeoms = useMemo(() => {
    const cache = new Map<string, THREE.BufferGeometry>()
    for (const l of legs) {
      const k = `${l.seg.rTop}|${l.seg.rBottom}|${l.seg.length}`
      if (!cache.has(k)) cache.set(k, segmentGeometry(l.seg.rTop, l.seg.rBottom, l.seg.length))
    }
    return cache
  }, [legs])

  const group = useRef<THREE.Group>(null)
  // Keep contextual body and real CNS rigidly registered. No unsupported motor pose.
  useFrame(() => {
    for (const m of Object.values(mat)) m.uniforms.uFade.value = opacity
    veinMat.opacity = 0.38 * opacity
  })

  useEffect(
    () => () => {
      for (const g of Object.values(geo)) g.dispose()
      for (const m of Object.values(mat)) m.dispose()
      for (const g of segGeoms.values()) g.dispose()
      veinMat.dispose()
    },
    [geo, mat, segGeoms, veinMat],
  )

  if (opacity <= 0.004) return null

  return (
    <group ref={group} renderOrder={0}>
      {/* --- head + compound eyes --- */}
      <mesh geometry={geo.head} material={mat.shell} position={HEAD} />
      {[1, -1].map((s) => (
        <mesh
          key={`eye${s}`}
          geometry={geo.eye}
          material={mat.eye}
          position={[HEAD.x + s * 262, HEAD.y + 18, HEAD.z + 12]}
          rotation={[0, 0, s > 0 ? -0.22 : Math.PI + 0.22]}
          scale={[s, 1, 1]}
        />
      ))}

      {/* --- antennae, where olfactory and Johnston's-organ input enters --- */}
      {[1, -1].map((s) => (
        <mesh
          key={`ant${s}`}
          geometry={geo.antenna}
          material={mat.limb}
          position={[s * 96, HEAD.y - 132, HEAD.z + 236]}
          rotation={[0.4, 0, 0]}
        />
      ))}

      {/* --- proboscis (labellar taste) --- */}
      <mesh
        geometry={geo.antenna}
        material={mat.limb}
        position={[0, HEAD.y - 266, HEAD.z + 66]}
        scale={[1.5, 2.1, 1.4]}
      />

      {/* --- thorax and abdomen --- */}
      <mesh geometry={geo.thorax} material={mat.thorax} position={THORAX} />
      <mesh geometry={geo.abdomen} material={mat.abdomen} position={ABDOMEN} rotation={[0.06, 0, 0]} />

      {/* --- wings, hinged dorsally and swept back over the abdomen --- */}
      {[1, -1].map((s) => (
        <group
          key={`wing${s}`}
          position={[s * 150, 138, -220]}
          rotation={[0.08, s * 1.05, -s * 0.08]}
          scale={[s, 1, 1]}
        >
          <mesh geometry={geo.wing} material={mat.wing} />
          <lineSegments geometry={geo.veins} material={veinMat} />
        </group>
      ))}

      {/* --- six articulated legs --- */}
      {legs.map((l) => (
        <mesh
          key={l.key}
          geometry={segGeoms.get(`${l.seg.rTop}|${l.seg.rBottom}|${l.seg.length}`)!}
          material={mat.limb}
          position={l.seg.position}
          rotation={l.seg.rotation}
        />
      ))}
    </group>
  )
}
