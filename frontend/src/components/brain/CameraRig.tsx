import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { STEP_DURATION, useStore } from '../../lib/store'
import type { CircuitGeometry } from '../../lib/circuit'

/**
 * Cinematic camera.
 *
 * One continuously eased rig rather than a cut between views: the camera always
 * moves toward a target pose, and the pose is chosen from the current view mode
 * and simulation phase. Whole fly -> head -> neural close-up is therefore a
 * single continuous move, and returning to Fly View retraces it.
 *
 * During propagation the look-at point drifts toward the centroid of whatever
 * ignited on the current step, so the camera follows the cascade without ever
 * snapping.
 */

interface Pose {
  position: THREE.Vector3
  target: THREE.Vector3
  fov: number
}

// Scene frame after the pi-about-X rotation: +Y up, +Z toward the fly's head,
// +X the fly's left. Distances are micrometres.
const POSES: Record<string, Pose> = {
  fly: {
    position: new THREE.Vector3(1850, 780, 1750),
    target: new THREE.Vector3(0, -140, -260),
    fov: 34,
  },
  approach: {
    position: new THREE.Vector3(980, 420, 1180),
    target: new THREE.Vector3(0, 20, 180),
    fov: 33,
  },
  brain: {
    position: new THREE.Vector3(560, 210, 690),
    target: new THREE.Vector3(0, 20, 330),
    fov: 32,
  },
  brainWide: {
    position: new THREE.Vector3(760, 300, 900),
    target: new THREE.Vector3(0, 0, 200),
    fov: 34,
  },
}

function poseFor(view: string, phase: string): Pose {
  if (view === 'fly') return phase === 'settled' ? POSES.fly : POSES.fly
  if (phase === 'transition') return POSES.approach
  if (phase === 'propagating') return POSES.brain
  if (phase === 'settled') return POSES.brainWide
  return POSES.brain
}

export function CameraRig({ circuit, enabled = true }: { circuit: CircuitGeometry; enabled?: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const view = useStore((s) => s.view)
  const phase = useStore((s) => s.phase)
  const sim = useStore((s) => s.sim)
  const simStartedAt = useStore((s) => s.simStartedAt)

  const target = useRef(new THREE.Vector3().copy(POSES.fly.target))
  const desired = useRef(new THREE.Vector3().copy(POSES.fly.target))
  const orbit = useRef(0)

  // Where each propagation step's newly-activated neurons sit, so the camera
  // can lean toward the advancing front.
  const stepCentroids = useMemo(() => {
    if (!sim) return []
    const acc = new Map<number, { v: THREE.Vector3; n: number }>()
    for (const a of sim.result.activations) {
      const slot = circuit.slotOf.get(a.body_id)
      if (slot === undefined) continue
      const e = acc.get(a.step) ?? { v: new THREE.Vector3(), n: 0 }
      e.v.x += circuit.anchors[slot * 3]
      e.v.y += circuit.anchors[slot * 3 + 1]
      e.v.z += circuit.anchors[slot * 3 + 2]
      e.n++
      acc.set(a.step, e)
    }
    const out: THREE.Vector3[] = []
    const maxStep = Math.max(0, ...acc.keys())
    for (let s = 0; s <= maxStep; s++) {
      const e = acc.get(s)
      out.push(e && e.n ? e.v.clone().multiplyScalar(1 / e.n) : new THREE.Vector3(0, 0, 250))
    }
    return out
  }, [sim, circuit])

  useEffect(() => {
    camera.position.copy(POSES.fly.position)
    camera.fov = POSES.fly.fov
    camera.updateProjectionMatrix()
  }, [camera])

  useFrame(({ clock }, dt) => {
    if (!enabled) return
    const pose = poseFor(view, phase)

    // Slow idle orbit; almost imperceptible, and it never stops entirely.
    orbit.current += dt * (phase === 'idle' ? 0.052 : 0.021)
    const yaw = orbit.current
    const r = Math.hypot(pose.position.x, pose.position.z)
    const basis = Math.atan2(pose.position.x, pose.position.z)
    const wanted = new THREE.Vector3(
      Math.sin(basis + yaw) * r,
      pose.position.y,
      Math.cos(basis + yaw) * r,
    )

    desired.current.copy(pose.target)

    // Follow the advancing activation front while the cascade runs.
    if (phase === 'propagating' && sim && simStartedAt !== null && stepCentroids.length) {
      const elapsed = clock.elapsedTime - simStartedAt
      const idx = Math.min(Math.max(Math.floor(elapsed / STEP_DURATION), 0), stepCentroids.length - 1)
      const frac = Math.min(Math.max(elapsed / STEP_DURATION - idx, 0), 1)
      const a = stepCentroids[idx]
      const b = stepCentroids[Math.min(idx + 1, stepCentroids.length - 1)]
      const follow = a.clone().lerp(b, frac)
      desired.current.lerp(follow, 0.55)
    }

    // Critically-damped-ish easing, frame-rate independent.
    const kPos = 1 - Math.pow(0.0009, dt)
    const kTgt = 1 - Math.pow(0.004, dt)
    camera.position.lerp(wanted, kPos)
    target.current.lerp(desired.current, kTgt)
    camera.lookAt(target.current)

    const fovDelta = pose.fov - camera.fov
    if (Math.abs(fovDelta) > 0.01) {
      camera.fov += fovDelta * kPos
      camera.updateProjectionMatrix()
    }
  })

  return null
}
