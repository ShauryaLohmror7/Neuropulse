import { useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BrainScene } from './components/brain/BrainScene'
import { ExperienceInput } from './components/experience/ExperienceInput'
import { ExperienceBreakdown } from './components/experience/ExperienceBreakdown'
import { SimulationOverlay } from './components/simulation/SimulationOverlay'
import { ResponsePanel } from './components/simulation/ResponsePanel'
import { ViewToggle } from './components/ViewToggle'
import { useSceneData } from './hooks/useSceneData'
import { api } from './lib/api'
import { STEP_DURATION, useStore } from './lib/store'

/**
 * One screen.
 *
 * The biology is the hero; every panel is small, quiet, and appears only when it
 * has something to say. Technical detail (provenance, evidence, lesion tooling)
 * lives behind the inspector rather than on the default view.
 */
export default function App() {
  const { data, error: dataError } = useSceneData()
  const { phase, sim, error, setPhase, setSim, setError, setView } = useStore()
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const runSimulation = useCallback(
    async (text: string) => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      setError(null)
      setSim(null, null)
      setPhase('compiling')

      try {
        const envelope = await api.simulate(text)

        // Beat 1: show the decomposition while the camera moves to the head.
        setPhase('transition')
        setView('brain')

        // Beat 2: ignite. simStartedAt is in scene-clock seconds, which the
        // shaders share, so step 0 fires exactly when the camera arrives.
        const startDelay = 1500
        timers.current.push(
          window.setTimeout(() => {
            const t0 = performance.now() / 1000
            setSim(envelope, sceneClockNow() + 0.15)
            setPhase('propagating')
            void t0

            const steps = envelope.result.metrics.propagation_depth + 1
            timers.current.push(
              window.setTimeout(
                () => setPhase('settled'),
                (steps * STEP_DURATION + 1.4) * 1000,
              ),
            )
          }, startDelay),
        )
      } catch (e) {
        setPhase('idle')
        setError((e as Error).message)
      }
    },
    [setError, setPhase, setSim, setView],
  )

  if (dataError) {
    return (
      <div className="app">
        <div className="error">
          <code>{dataError}</code>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="scene">{data && <BrainScene data={data} />}</div>

      {!data && <div className="loading">Loading real connectome</div>}

      <div className="overlay">
        <header className="masthead">
          <div>
            <h1 className="wordmark">NEUROPULSE</h1>
            <p className="tagline">Give a biological brain an experience.</p>
          </div>
          <ViewToggle />
        </header>

        <div className="stage">
          <div className="left-rail">
            {(phase !== 'idle' || sim) && sim && (
              <ExperienceBreakdown experience={sim.experience} />
            )}
          </div>
          <div className="right-rail">
            <AnimatePresence>
              {(phase === 'propagating' || phase === 'settled') && (
                <SimulationOverlay sim={sim} />
              )}
            </AnimatePresence>
          </div>
        </div>

        <footer className="foot">
          <AnimatePresence mode="wait">
            {phase === 'idle' && !sim && (
              <motion.div key="input" exit={{ opacity: 0, y: 8 }} style={{ width: '100%' }}>
                <ExperienceInput onSimulate={runSimulation} />
              </motion.div>
            )}
            {phase !== 'idle' && (
              <motion.div key="status" className="foot-status" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <span className="status-text">{STATUS[phase]}</span>
                {phase === 'settled' && (
                  <button className="again" onClick={() => { useStore.getState().reset(); setView('fly') }}>
                    New experience
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {phase === 'settled' && sim && <ResponsePanel response={sim.response} />}
        </footer>
      </div>

      {error && (
        <div className="toast">
          <code>{error}</code>
          <button onClick={() => setError(null)}>dismiss</button>
        </div>
      )}
    </div>
  )
}

const STATUS: Record<string, string> = {
  compiling: 'Interpreting experience',
  transition: 'Locating sensory populations',
  propagating: 'Propagating through real connectome',
  settled: '',
}

/**
 * Scene-clock reading.
 *
 * three's clock starts when the Canvas mounts; we mirror it here so React-side
 * scheduling and the shader uniforms agree on t=0.
 */
let clockOrigin: number | null = null
export function markSceneClock() {
  if (clockOrigin === null) clockOrigin = performance.now() / 1000
}
function sceneClockNow(): number {
  if (clockOrigin === null) markSceneClock()
  return performance.now() / 1000 - (clockOrigin ?? 0)
}
