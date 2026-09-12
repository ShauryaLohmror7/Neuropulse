import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { NeuronSkeleton } from './components/brain/NeuronSkeleton'
import { Atmosphere } from './components/brain/Atmosphere'
import { boundsOf } from './lib/morphology'
import type { CachedDocument, MorphologyPayload } from './types/connectome'

/**
 * Milestone 1 scene: a single genuine MaleCNS v1.0 neuron, reconstructed from
 * its real skeleton, ignited on a loop so the travelling wavefront is visible.
 */
export default function App() {
  const [doc, setDoc] = useState<CachedDocument<MorphologyPayload> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/circuits/demo_neuron.json')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
        return r.json()
      })
      .then(setDoc)
      .catch((e) =>
        setError(
          `Could not load real connectome data (${e.message}).\n` +
            `Run:  backend/.venv/bin/python -m scripts.fetch_demo_neuron\n` +
            `NEUROPULSE has no synthetic fallback by design.`,
        ),
      )
  }, [])

  const radius = useMemo(() => {
    if (!doc) return 200
    const b = boundsOf(doc.payload)
    return b.getSize(new THREE.Vector3()).length() * 0.5
  }, [doc])

  if (error) {
    return (
      <div className="app">
        <div className="error">
          <code>{error}</code>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="scene">
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          camera={{ position: [220, 90, 260], fov: 38, near: 1, far: 6000 }}
          onCreated={({ gl, scene }) => {
            gl.setClearColor('#050507', 1)
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.05
            scene.fog = new THREE.FogExp2('#050507', 0.0009)
          }}
        >
          <Suspense fallback={null}>
            <Atmosphere radius={Math.max(radius * 2.4, 300)} />
            {doc && (
              <PulsingNeuron payload={doc.payload} maxGeodesic={doc.payload.stats.maxGeodesic} />
            )}
            <OrbitControls
              enablePan={false}
              enableDamping
              dampingFactor={0.045}
              rotateSpeed={0.55}
              minDistance={radius * 0.5}
              maxDistance={radius * 8}
              autoRotate
              autoRotateSpeed={0.28}
            />
          </Suspense>
          <EffectComposer>
            <Bloom intensity={1.15} luminanceThreshold={0.12} luminanceSmoothing={0.4} mipmapBlur />
            <Vignette eskil={false} offset={0.24} darkness={0.82} />
          </EffectComposer>
        </Canvas>
      </div>

      <div className="overlay">
        <header className="masthead">
          <h1 className="wordmark">NEUROPULSE</h1>
          <p className="tagline">Give a biological brain an experience.</p>
        </header>
        <div />
      </div>

      {doc && <ProvenancePanel doc={doc} />}
      {!doc && <div className="loading">Loading real connectome data</div>}
    </div>
  )
}

/** Re-ignites the neuron on a slow loop so the wavefront is continuously visible. */
function PulsingNeuron({ payload, maxGeodesic }: { payload: MorphologyPayload; maxGeodesic: number }) {
  const [ignition, setIgnition] = useState(0.6)
  const speed = 210
  const period = Math.max(maxGeodesic / speed + 2.4, 4)

  useEffect(() => {
    const id = setInterval(() => setIgnition(performance.now() / 1000), period * 1000)
    return () => clearInterval(id)
  }, [period])

  return (
    <NeuronSkeleton
      payload={payload}
      ignition={ignition}
      activation={0.85}
      waveSpeed={speed}
      waveWidth={22}
      baseColor="#5d6675"
      activeColor="#a8d8ff"
      baseOpacity={0.34}
      fogNear={120}
      fogFar={760}
    />
  )
}

function ProvenancePanel({ doc }: { doc: CachedDocument<MorphologyPayload> }) {
  const m = doc.payload.meta as Record<string, unknown>
  const rows: [string, string][] = [
    ['Dataset', `${doc.provenance.dataset} ${doc.provenance.dataset_version}`],
    ['Body ID', String(doc.payload.bodyId)],
    ['Cell type', `${m.type ?? '—'}  ${m.instance ? `(${m.instance})` : ''}`],
    ['Class', String(m.superclass ?? m.class ?? '—')],
    ['Transmitter', m.predictedNt ? `${m.predictedNt} · p=${Number(m.predictedNtConfidence).toFixed(2)}` : '—'],
    ['Synapses', `${m.pre ?? '?'} pre · ${m.post ?? '?'} post`],
    ['Morphology', `${doc.payload.stats.pathCount} strands · ${(doc.payload.stats.cableLengthNm / 1000).toFixed(0)} µm cable`],
  ]
  return (
    <div className="provenance">
      <div className="label" style={{ marginBottom: 4 }}>Real reconstruction</div>
      {rows.map(([k, v]) => (
        <div className="row" key={k}>
          <b>{k}</b>
          <span>{v}</span>
        </div>
      ))}
    </div>
  )
}
