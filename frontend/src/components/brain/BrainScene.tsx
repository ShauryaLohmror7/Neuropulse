import { Suspense, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { EffectComposer, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { AnatomyShell } from './AnatomyShell'
import { BrainContext } from './BrainContext'
import { Somata } from './Somata'
import { Atmosphere } from './Atmosphere'
import { CameraRig } from './CameraRig'
import { ScaleBar } from './ScaleBar'
import { FullNeuron } from './FullNeuron'
import { CircuitNetwork } from './CircuitNetwork'
import { FlyBody } from './FlyBody'
import { RegionLabels } from './RegionLabels'

import { useStore } from '../../lib/store'
import type { SceneData } from '../../hooks/useSceneData'
import { setSceneTime } from '../../lib/sceneClock'

/**
 * The scene.
 *
 * Everything sits in one group rotated pi about X, which maps the dataset's
 * anatomical axes (+X the fly's left, -Y dorsal, -Z anterior) onto the usual
 * screen convention of +Y up and +Z forward. Real neurons, real neuropils and
 * the schematic body therefore share one coordinate frame.
 */
export function BrainScene({ data }: { data: SceneData }) {
  const controls = useRef<OrbitControlsImpl | null>(null)
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      camera={{ position: [1850, 780, 1750], fov: 34, near: 5, far: 20000 }}
      onCreated={({ gl, scene }) => {
        // Anchor the React-side clock to three's, so scheduled ignition times and
        // shader uniforms agree on t=0.
        setSceneTime(0)
        gl.setClearColor('#090d12', 1)
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.25
        scene.fog = new THREE.FogExp2('#090d12', 0.00004)
      }}
    >
      <Suspense fallback={null}>
        <SceneClock />
        <ScaleBar />
        {/* Real data lives in the dataset frame and is rotated into screen
            convention here. The schematic body is authored directly in screen
            frame, so it must NOT be nested inside this rotation. */}
        <group rotation={[Math.PI, 0, 0]}>
          <RealAnatomy data={data} />
        </group>
        <SchematicBody />
        <LabelProjector data={data} />
        <OrbitControls
          ref={controls}
          makeDefault
          enabled={false}
          enablePan
          enableDamping
          dampingFactor={0.06}
          rotateSpeed={0.62}
          zoomSpeed={0.85}
          panSpeed={0.7}
          minDistance={90}
          maxDistance={9000}
        />
        <Atmosphere count={120} radius={2600} />
        <CameraRig circuit={data.circuit} controls={controls} />
        {import.meta.env.DEV && new URLSearchParams(window.location.search).has('debugScene') && <SceneDebug />}
      </Suspense>
      <EffectComposer multisampling={0}>
        <Vignette eskil={false} offset={0.12} darkness={0.3} />
      </EffectComposer>
    </Canvas>
  )
}

/** Dev-only: exposes camera and per-layer world bounds for diagnosis. */
function SceneDebug() {
  const { camera, scene, gl } = useThree()
  const last = useRef(0)
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 2) return
    last.current = clock.elapsedTime
    const w = window as unknown as Record<string, unknown>
    const layers: Record<string, number[]> = {}
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!(m as THREE.Object3D).visible) return
      if (m.type !== 'LineSegments' && m.type !== 'Points') return
      const g = m.geometry as THREE.BufferGeometry | undefined
      if (!g?.attributes?.position) return
      const box = new THREE.Box3().setFromBufferAttribute(
        g.attributes.position as THREE.BufferAttribute,
      )
      box.applyMatrix4(m.matrixWorld)
      const key = `${m.type}:${(g.attributes.position as THREE.BufferAttribute).count}`
      layers[key] = [
        ...box.min.toArray().map((v) => Math.round(v)),
        ...box.max.toArray().map((v) => Math.round(v)),
      ]
    })
    w.__NP_DEBUG = {
      drawCalls: gl.info.render.calls,
      manual: useStore.getState().manualCamera,
      cam: camera.position.toArray().map((v) => Math.round(v)),
      dir: camera.getWorldDirection(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)),
      layers,
    }
  })
  return null
}

const VNC_GROUPS = new Set(['vnc'])
const EMPTY = new Set<string>()

/**
 * How strongly each layer shows, as a function of view mode and phase.
 * Eased every frame so switching views is a dissolve, never a cut.
 */
function useLayerMix() {
  const view = useStore((s) => s.view)
  const phase = useStore((s) => s.phase)
  const [, force] = useState(0)
  const mix = useRef(0) // 0 = fly view, 1 = brain view
  const last = useRef(0)

  useFrame((_, dt) => {
    const wantBrain = view === 'brain' || phase === 'propagating' || phase === 'transition'
    const k = 1 - Math.pow(0.02, dt)
    mix.current += ((wantBrain ? 1 : 0) - mix.current) * k
    // Re-render only when the value moves visibly, so easing costs nothing.
    if (Math.abs(mix.current - last.current) > 0.004) {
      last.current = mix.current
      force((n) => n + 1)
    }
  })

  return mix.current
}

function RealAnatomy({ data }: { data: SceneData }) {
  const m = useLayerMix()
  const view = useStore((s) => s.view)
  const sim = useStore((s) => s.sim)
  const detail = useStore((s) => s.detail)
  const isolate = useStore((s) => s.isolateNeuron)
  const detailMix = detail && view === 'brain' ? (isolate ? 0 : 0.15) : 1
  // Context recedes once a cascade is running so the active pathway dominates.
  const contextDim = (sim ? 0.55 : 1) * detailMix
  // Brain view isolates the brain. The VNC sits posterior of z = 100 um in the
  // dataset's frame, so clipping there leaves brain and neck connective only.
  const clipZ = view === 'brain' ? -100 : 1e6
  return (
    <>
      <AnatomyShell groups={data.anatomy} opacity={(0.14 + m * 0.2) * detailMix} hide={view === 'brain' ? VNC_GROUPS : EMPTY} />
      {data.context && (
        <group position={data.contextOffset}>
          <BrainContext circuit={data.context} opacity={0.85 + m * 0.15} dim={contextDim} clipZ={clipZ - data.contextOffset.z} />
          {sim && <CircuitNetwork circuit={data.context} opacity={detailMix} clipZ={clipZ - data.contextOffset.z} restingOpacity={0} excludeBodyIds={data.circuit.slotOf} />}
        </group>
      )}
      <Somata circuit={data.circuit} context={data.context} opacity={(0.45 + m * 0.55) * detailMix} clipZ={clipZ} size={0.55} />
      <CircuitNetwork circuit={data.circuit} opacity={(0.5 + m * 0.5) * detailMix} clipZ={clipZ} />
      <FullNeuron />
      {/* Activity is confined to measured skeletons; no invented centroid-to-centroid arcs. */}
    </>
  )
}

function SchematicBody() {
  const m = useLayerMix()
  // Brain view shows the brain alone: the body shell fades out completely so
  // nothing occludes the tissue.
  return <FlyBody opacity={Math.max(1 - m * 1.0, 0)} />
}

/** Labels live outside the dataset rotation; they do their own transform. */
function LabelProjector({ data }: { data: SceneData }) {
  const m = useLayerMix()
  return <RegionLabels doc={data.anatomyDoc} offset={data.anatomyOffset} opacity={m} />
}

function SceneClock() {
  useFrame(({ clock }) => setSceneTime(clock.elapsedTime), -2)
  return null
}
