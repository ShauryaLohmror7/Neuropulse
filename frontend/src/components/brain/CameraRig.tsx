import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { STEP_DURATION, useStore } from '../../lib/store'
import type { CircuitGeometry } from '../../lib/circuit'

/**
 * Camera.
 *
 * Two regimes that hand off to each other rather than fighting:
 *
 *  - *Cinematic*: while a simulation plays, the rig eases toward a pose chosen
 *    from the view mode and phase, and leans its look-at point toward whatever
 *    just ignited — so the camera follows the cascade.
 *  - *Manual*: the moment the viewer drags or scrolls, the rig yields and
 *    OrbitControls takes over, so the brain can be inspected freely. Pressing
 *    simulate (or switching view) re-arms the cinematic path.
 *
 * Scene frame: +Y up, +Z toward the fly's head, +X the fly's left. Micrometres.
 */

interface Pose {
  position: THREE.Vector3
  target: THREE.Vector3
  fov: number
}

const POSES: Record<string, Pose> = {
  // Whole animal, three-quarter view from the fly's left and slightly above.
  fly: {
    position: new THREE.Vector3(3250, 2450, 2550),
    target: new THREE.Vector3(0, -280, -500),
    fov: 30,
  },
  // Moving in on the head.
  approach: {
    position: new THREE.Vector3(1500, 700, 1720),
    target: new THREE.Vector3(0, 20, 140),
    fov: 30,
  },
  // Inside the head: the brain fills the frame.
  brain: {
    position: new THREE.Vector3(40, 160, 1500),
    target: new THREE.Vector3(0, 65, 335),
    fov: 32,
  },
  // Pulled back just enough to show where the cascade ended up.
  brainWide: {
    position: new THREE.Vector3(40, 160, 1500),
    target: new THREE.Vector3(0, 65, 335),
    fov: 32,
  },
}

function poseFor(view: string, phase: string): Pose {
  if (view === 'fly') return POSES.fly
  if (phase === 'transition') return POSES.approach
  if (phase === 'propagating') return POSES.brain
  if (phase === 'settled') return POSES.brainWide
  return POSES.brain
}

export function CameraRig({
  circuit,
  controls,
}: {
  circuit: CircuitGeometry
  controls: React.RefObject<OrbitControlsImpl | null>
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const selected = useStore((s) => s.hoveredBodyId)
  const detail = useStore((s) => s.detail)
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, [])
  const view = useStore((s) => s.view)
  const phase = useStore((s) => s.phase)
  const sim = useStore((s) => s.sim)
  const simStartedAt = useStore((s) => s.simStartedAt)
  const manual = useStore((s) => s.manualCamera)
  const setManual = useStore((s) => s.setManualCamera)

  const target = useRef(new THREE.Vector3().copy(POSES.fly.target))
  const desired = useRef(new THREE.Vector3().copy(POSES.fly.target))
  const orbit = useRef(0)

  // Centroid of the neurons that first ignited on each step, so the camera can
  // lean toward the advancing front.
  const stepCentroids = useMemo(() => {
    if (!sim) return []
    const acc = new Map<number, { v: THREE.Vector3; n: number }>()
    for (const a of sim.result.activations) {
      const slot = circuit.slotOf.get(a.body_id)
      if (slot === undefined) continue
      const e = acc.get(a.step) ?? { v: new THREE.Vector3(), n: 0 }
      e.v.x += circuit.anchors[slot * 3]
      e.v.y -= circuit.anchors[slot * 3 + 1]
      e.v.z -= circuit.anchors[slot * 3 + 2]
      e.n++
      acc.set(a.step, e)
    }
    const out: THREE.Vector3[] = []
    const maxStep = Math.max(0, ...acc.keys())
    for (let s = 0; s <= maxStep; s++) {
      const e = acc.get(s)
      out.push(e && e.n ? e.v.clone().multiplyScalar(1 / e.n) : new THREE.Vector3(0, 40, 300))
    }
    return out
  }, [sim, circuit])

  useEffect(() => {
    camera.position.copy(POSES.fly.position)
    camera.fov = POSES.fly.fov
    camera.updateProjectionMatrix()
  }, [camera])

  // Any deliberate interaction hands control to the viewer.
  //
  // OrbitControls runs its own frame update and would overwrite anything the
  // rig writes to the camera, so the two must never be live at once: the
  // controls stay disabled until the viewer actually reaches for them. We
  // therefore listen on the canvas itself rather than on the controls' own
  // 'start' event, which only fires while they are enabled.
  useEffect(() => {
    const el = gl.domElement
    const take = (e: Event) => {
      if (e instanceof PointerEvent && e.button !== 0 && e.button !== 1 && e.button !== 2) return
      if (useStore.getState().manualCamera) return
      const c = controls.current
      if (c) {
        // Adopt the rig's current framing so control transfer is seamless.
        c.target.copy(target.current)
        c.enabled = true
        c.update()
      }
      setManual(true)
    }
    el.addEventListener('pointerdown', take, {capture:true})
    el.addEventListener('wheel', take, { passive: true, capture:true })
    return () => {
      el.removeEventListener('pointerdown', take, {capture:true})
      el.removeEventListener('wheel', take, {capture:true})
    }
  }, [gl, controls, setManual])

  // Switching view or starting a new run returns the camera to the rig.
  useEffect(() => {
    if (!manual && controls.current) controls.current.enabled = false
  }, [manual, view, phase, controls])

  useFrame(({ clock }, dt) => {
    const c = controls.current
    const pose = poseFor(view, phase)

    if (manual) {
      // Viewer is driving; OrbitControls owns the camera and we stay out of it.
      return
    }
    if (c) c.enabled = false

    // Fly view gets a slow turntable; brain view sways gently around face-on so
    // the canonical silhouette is never turned away from the viewer.
    orbit.current += (reduced ? 0 : dt) * (phase === 'idle' ? 0.055 : 0.022)
    const yaw = Math.sin(orbit.current * 0.62) * (view === 'brain' ? 0.07 : 0.12)

    // Orbit about the *subject*, not the world origin: the brain's centre sits
    // well forward of origin, so orbiting the origin swings it off-frame.
    const off = pose.position.clone().sub(pose.target).multiplyScalar(Math.max(1, 1.4 / camera.aspect))
    const r = Math.hypot(off.x, off.z)
    const basis = Math.atan2(off.x, off.z)
    const wanted = new THREE.Vector3(
      pose.target.x + Math.sin(basis + yaw) * r,
      pose.target.y + off.y,
      pose.target.z + Math.cos(basis + yaw) * r,
    )

    desired.current.copy(pose.target)
    const slot = selected === null ? undefined : circuit.slotOf.get(selected)
    if (slot !== undefined && view === 'brain') {
      desired.current.set(circuit.anchors[slot*3], -circuit.anchors[slot*3+1], -circuit.anchors[slot*3+2])
      wanted.copy(desired.current).add(new THREE.Vector3(60, 80, 780))
    }

    if (detail && view === 'brain') {
      const {min,max}=detail.manifest.stats.bounds
      desired.current.set((min[0]+max[0])/2, -(min[1]+max[1])/2, -(min[2]+max[2])/2)
      const reserved = window.innerWidth > 800 ? Math.min(340, size.width * 0.4) : 0
      const usefulAspect = (size.width-reserved)/size.height
      const halfHeight=Math.max((max[1]-min[1])/2, (max[0]-min[0])/(2*usefulAspect))
      const distance=Math.max(160,halfHeight/Math.tan(THREE.MathUtils.degToRad(pose.fov/2))*1.4+(max[2]-min[2])/2)
      desired.current.x += reserved / size.width * distance * Math.tan(THREE.MathUtils.degToRad(pose.fov/2)) * camera.aspect
      wanted.copy(desired.current).add(new THREE.Vector3(0,0,distance))
    }

    if (selected === null && phase === 'propagating'  && sim && simStartedAt !== null && stepCentroids.length) {
      const elapsed = clock.elapsedTime - simStartedAt
      const idx = Math.min(Math.max(Math.floor(elapsed / STEP_DURATION), 0), stepCentroids.length - 1)
      const frac = Math.min(Math.max(elapsed / STEP_DURATION - idx, 0), 1)
      const a = stepCentroids[idx]
      const b = stepCentroids[Math.min(idx + 1, stepCentroids.length - 1)]
      desired.current.lerp(a.clone().lerp(b, frac), 0.08)
    }

    ;(window as unknown as Record<string, unknown>).__NP_RIG = {
      view, phase, manual, yaw: +yaw.toFixed(3), orbit: +orbit.current.toFixed(3),
      pose: pose.position.toArray(), wanted: wanted.toArray().map((v) => Math.round(v)),
    }

    const kPos = 1 - Math.pow(0.0012, dt)
    const kTgt = 1 - Math.pow(0.005, dt)
    camera.position.lerp(wanted, kPos)
    target.current.lerp(desired.current, kTgt)
    camera.lookAt(target.current)

    // Keep OrbitControls' pivot in sync so a drag starts from where we are.
    if (c) c.target.copy(target.current)

    const fovDelta = pose.fov - camera.fov
    if (Math.abs(fovDelta) > 0.01) {
      camera.fov += fovDelta * kPos
      camera.updateProjectionMatrix()
    }
  })

  return null
}
