import { Suspense, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { AnatomyShell } from './AnatomyShell'
import { Atmosphere } from './Atmosphere'
import { CameraRig } from './CameraRig'
import { CircuitNetwork } from './CircuitNetwork'
import { FlyBody } from './FlyBody'
import { SignalParticles } from './SignalParticles'
import { useStore } from '../../lib/store'
import type { SceneData } from '../../hooks/useSceneData'
import { markSceneClock } from '../../App'

/**
 * The scene.
 *
 * Everything sits in one group rotated pi about X, which maps the dataset's
 * anatomical axes (+X the fly's left, -Y dorsal, -Z anterior) onto the usual
 * screen convention of +Y up and +Z forward. Real neurons, real neuropils and
 * the schematic body therefore share one coordinate frame.
 */
export function BrainScene({ data }: { data: SceneData }) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      camera={{ position: [1850, 780, 1750], fov: 34, near: 5, far: 20000 }}
      onCreated={({ gl, scene }) => {
        // Anchor the React-side clock to three's, so scheduled ignition times and
        // shader uniforms agree on t=0.
        markSceneClock()
        gl.setClearColor('#040406', 1)
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.12
        scene.fog = new THREE.FogExp2('#040406', 0.00021)
      }}
    >
      <Suspense fallback={null}>
        {/* Real data lives in the dataset frame and is rotated into screen
            convention here. The schematic body is authored directly in screen
            frame, so it must NOT be nested inside this rotation. */}
        <group rotation={[Math.PI, 0, 0]}>
          <RealAnatomy data={data} />
        </group>
        <SchematicBody />
        <Atmosphere count={700} radius={2600} />
        <CameraRig circuit={data.circuit} />
      </Suspense>
      <EffectComposer multisampling={4}>
        <Bloom intensity={1.05} luminanceThreshold={0.1} luminanceSmoothing={0.5} mipmapBlur radius={0.72} />
        <Vignette eskil={false} offset={0.2} darkness={0.86} />
      </EffectComposer>
    </Canvas>
  )
}

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
  return (
    <>
      <AnatomyShell groups={data.anatomy} opacity={0.35 + m * 0.65} />
      <CircuitNetwork circuit={data.circuit} opacity={0.42 + m * 0.58} />
      <SignalParticles circuit={data.circuit} />
    </>
  )
}

function SchematicBody() {
  const m = useLayerMix()
  // Never fully gone in brain view: a faint outline keeps the viewer oriented
  // about where inside the animal they are.
  return <FlyBody opacity={1 - m * 0.78} />
}
