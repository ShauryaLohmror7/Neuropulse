import { NeuralAmbience } from './components/ui/NeuralAmbience'
import { AuroraBackdrop } from './components/ui/AuroraBackdrop'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useShallow } from 'zustand/react/shallow'
import { BrainScene } from './components/brain/BrainScene'
import { ExperienceInput } from './components/experience/ExperienceInput'
import { ExperienceBreakdown } from './components/experience/ExperienceBreakdown'
import { ActivityTimeline } from './components/simulation/ActivityTimeline'
import { ResponsePanel } from './components/simulation/ResponsePanel'
import { ViewToggle } from './components/ViewToggle'
import { RegionLabelLayer } from './components/RegionLabelLayer'
import { KeyNeurons } from './components/KeyNeurons'
import { ScientificInspector } from './components/ScientificInspector'
import { useFullNeuron } from './hooks/useFullNeuron'
import { NeuronDetailPanel } from './components/NeuronDetailPanel'
import { useSceneData } from './hooks/useSceneData'
import { api } from './lib/api'
import { STEP_DURATION, useStore } from './lib/store'
import { getSceneTime } from './lib/sceneClock'
import type { SimulationEnvelope } from './types/api'

export default function App() {
  const { data, error: dataError } = useSceneData()
  useFullNeuron(data)
  const { phase, sim, error, view, detail, inspector, showLabels, setPhase, setSim, setError, setView, toggleLabels, toggleInspector } = useStore(useShallow(s => ({detail:s.detail, phase:s.phase, sim:s.sim, error:s.error, view:s.view, inspector:s.inspector, showLabels:s.showLabels, setPhase:s.setPhase, setSim:s.setSim, setError:s.setError, setView:s.setView, toggleLabels:s.toggleLabels, toggleInspector:s.toggleInspector})))
  const cinematic=useStore(s=>s.cinematic)
  const activityGain=useStore(s=>s.activityGain)
  const timers = useRef<number[]>([])
  const [pending, setPending] = useState<SimulationEnvelope | null>(null)
  const [step, setStep] = useState(-1)
  const generation = useRef(0)
  useEffect(() => () => { generation.current++; timers.current.forEach(clearTimeout) }, [])
  useEffect(() => {
    if (phase !== 'propagating') return
    const id = window.setInterval(() => {
      const start = useStore.getState().simStartedAt
      const currentStep = start === null ? -1 : Math.floor((getSceneTime() - start) / STEP_DURATION)
      setStep(currentStep)
      const steps = useStore.getState().sim?.result.steps
      if (steps?.length && currentStep > steps[steps.length - 1].step) setPhase('settled')
    }, 80)
    return () => clearInterval(id)
  }, [phase, setPhase])

  const play = useCallback((envelope: SimulationEnvelope) => {
    setPending(envelope)
    if (!envelope.result.metrics.neurons_activated) { setSim(envelope, null); setPhase('settled'); setStep(-1); return }
    setPhase('transition')
    setView('brain')
    useStore.getState().setManualCamera(false)
    timers.current.push(window.setTimeout(() => {
      setSim(envelope, getSceneTime() + 0.2)
      setPhase('propagating')
      setStep(-1)
      // Completion follows every recorded model state on the scene clock.
    }, 1600))
  }, [setPhase, setView, setSim])

  const runSimulation = useCallback(async (text: string) => {
    const id = ++generation.current
    timers.current.forEach(clearTimeout)
    timers.current = []
    setError(null); setSim(null, null); setPending(null); setPhase('compiling')
    useStore.getState().setHovered(null)
    try {
      const envelope = await api.simulate(text)
      if (id === generation.current) play(envelope)
    } catch (e) {
      if (id !== generation.current) return
      setPhase('idle'); setError((e as Error).message)
    }
  }, [play, setError, setSim, setPhase])

  const reset = () => {
    generation.current++
    timers.current.forEach(clearTimeout); timers.current = []
    setPending(null); setStep(-1)
    useStore.getState().reset(); useStore.getState().setHovered(null)
  }
  const envelope = sim ?? pending
  const active = sim?.result.activations.filter(a => phase === 'settled' || a.step <= step).length ?? 0
  const edges = (phase === 'settled' ? sim?.result.metrics.connections_traversed : sim?.result.steps.find(s => s.step === step)?.cumulative_connections) ?? 0
  const stageIndex = ['idle', 'compiling', 'transition', 'propagating', 'settled'].indexOf(phase)


  return (
    <div className={`app ${cinematic ? 'cinematic' : 'restrained'}`}>
      <header className="masthead">
        <a className="brand" href="#" aria-label="NEUROPULSE home" onClick={e => { e.preventDefault(); reset() }}>
          <svg className="brand-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M2 17h7l4-11 6 21 4-10h7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="2" cy="17" r="2" fill="currentColor"/><circle cx="30" cy="17" r="2" fill="currentColor"/></svg>
          <span className="wordmark">NEUROPULSE</span><span className="edition">CONNECTOME EXPLORER</span>
        </a>
        <div className="head-right"><span className="dataset-chip"><span className="live-dot"/> MaleCNS v1.0</span><button className="text-button" onClick={toggleInspector}>What is real? <span>↗</span></button></div>
      </header>

      <main className="workspace">
        <aside className={`experience-rail ${phase !== 'idle' ? 'has-run' : ''}`}>
          <NeuralAmbience/>
          <div className="intro"><div className="eyebrow"><span className="accent-line"/> EXPERIENCE → ACTIVITY</div><h1>Give a biological <br/>brain an <em>experience.</em></h1><p>Explore how a fly’s real neural wiring carries a modeled sensory response.</p></div>
          {phase === 'idle' ? <ExperienceInput onSimulate={runSimulation} disabled={!data} /> : <div className="run-story">
            <div className="eyebrow">YOUR EXPERIENCE</div><p className="quote">“{envelope?.experience.raw_text ?? useStore.getState().text}”</p>
            <div className="run-status" role="status"><span className="pulse-dot"/>{sim?.response.interpretation_kind === 'no_input' ? 'Input needs a supported sensory cue' : STATUS[phase]}</div>
            {sim && <ActivityTimeline result={sim.result} step={step} settled={phase==='settled'}/>}
            {phase === 'settled' && sim && <><ResponsePanel response={sim.response}/><p className="coverage">{sim.rendered_activated} of {sim.result.metrics.neurons_activated} reached neurons have overview morphology.</p></>}
            {envelope && (phase === 'settled' ? <details className="input-details"><summary>What activated first · sensory inputs</summary><ExperienceBreakdown experience={envelope.experience}/></details> : <ExperienceBreakdown experience={envelope.experience}/>)}
            <div className="run-actions"><button className="text-button" onClick={reset}>{phase === 'settled' ? '← New experience' : 'Cancel simulation'}</button>{phase === 'settled' && sim && sim.result.metrics.neurons_activated > 0 && <button className="text-button" onClick={() => { setSim(null,null); play(sim) }}>↻ Replay</button>}</div>
          </div>}
          <div className="rail-note"><span>01</span><p><strong>Real anatomy. Modeled activity.</strong><br/>Every rendered neuron comes from the dataset. Signal timing is illustrative.</p></div>
        </aside>

        <section className="viewer" aria-label="Interactive nervous system visualization">
          <div className="viewer-top"><div><div className="eyebrow">DROSOPHILA MELANOGASTER</div><h2>{detail && view === 'brain' ? 'One neuron. Every source branch.' : view === 'brain' ? 'The architecture of sensation.' : 'One fly. Thousands of pathways.'}</h2></div><ViewToggle/></div>
          <div className="scene">{data && <BrainScene data={data}/>}<RegionLabelLayer/></div>
          {!data && <div className="loading" role="status"><span className="pulse-dot"/>{dataError ?? 'Loading measured anatomy…'}</div>}
          {cinematic && <AuroraBackdrop/>}
          <div className="instrument-frame" aria-hidden="true"><i/><i/><i/><i/></div>
          {data && <div className="scene-readout"><span className="readout-dot"/><span>{phase==='propagating' ? 'MODEL SIGNAL PLAYBACK' : phase==='settled' ? 'PEAK ACTIVITY · FROZEN SUMMARY' : 'DATASET ANATOMY'}</span><b>{phase==='propagating' && sim ? `STATE ${String(Math.max(0,Math.min(step,sim.result.steps.length-1))).padStart(2,'0')} / ${String(sim.result.steps.length-1).padStart(2,'0')}` : 'MaleCNS · v1.0'}</b></div>}
          <NeuronDetailPanel data={data}/>
          <div className="activity-exposure"><label htmlFor="activity-gain">ACTIVITY VISIBILITY <b>{activityGain.toFixed(1)}×</b></label><input id="activity-gain" type="range" min="0.5" max="4" step="0.5" value={activityGain} onChange={e=>useStore.getState().setActivityGain(Number(e.target.value))}/><small>Display contrast only · model values unchanged</small></div><div className="viewer-tools"><button aria-label="Toggle cinematic glow" aria-pressed={cinematic} title="Display styling only; neuron data and model values stay the same" onClick={()=>useStore.getState().toggleCinematic()}>✧ <span>Sci-fi glow</span></button><button aria-label="Reset view" title="Return to the default camera" onClick={() => { useStore.getState().setHovered(null); setView(view) }}>↺ <span>Reset view</span></button><button aria-label="Toggle region labels" aria-pressed={showLabels} onClick={toggleLabels}>⌖ <span>Regions</span></button><button aria-label="Inspect scientific data" onClick={toggleInspector}>ⓘ <span>Inspect data</span></button></div>
          {data && sim && phase === 'settled' && <KeyNeurons data={data}/>}
          <div className="view-caption"><span className="specimen-marker">{detail ? `SOURCE / ${detail.manifest.bodyId}` : view === 'brain' ? 'BRAIN / 01' : 'SPECIMEN / 01'}</span><p>{detail ? 'Unpruned source skeleton · checksum verified' : view === 'brain' ? 'Real skeletons + measured region surfaces' : 'Contextual fly shell · real CNS reconstruction'}</p><span className="orbit-hint">Drag to orbit · Scroll to zoom</span></div>
          <div className="viewer-bottom">
            <div className="legend"><span><i className="legend-structure"/>Anatomy</span><span><i className="m-vision"/>Vision</span><span><i className="m-olfaction"/>Smell</span><span><i className="legend-signal"/>Modeled activity</span></div>
            <div className="data-stats">{detail ? <><b>{detail.manifest.stats.nodeCount.toLocaleString()}</b> source nodes <span>/</span><b>0</b> invented connections</> : sim ? <><b>{active.toLocaleString()}</b> reached <span>/</span><b>{edges.toLocaleString()}</b> connections reached</> : data ? <><b>{data.circuitDoc.counts.graphNeurons.toLocaleString()}</b> neurons in graph <span>/</span><b>{data.circuitDoc.somas?.bodyIds.length.toLocaleString()}</b> measured cell bodies</> : 'Preparing reconstruction'}</div>
          </div>
        </section>
      </main>
      <footer className="app-footer"><span>REAL WIRING. NEW PERSPECTIVES.</span><div className="pipeline">{['Experience', 'Interpret', 'Map', 'Propagate', 'Response'].map((s,i) => <span className={i === stageIndex ? 'current' : i < stageIndex ? 'complete' : ''} key={s}><i>{String(i+1).padStart(2,'0')}</i>{s}{i < 4 && <b>—</b>}</span>)}</div><button className="text-button" onClick={toggleInspector}>Science & sources ↗</button></footer>
      <AnimatePresence>{data && inspector && <ScientificInspector data={data}/>}</AnimatePresence>
      {error && <div className="toast" role="alert"><span>{error}</span><button onClick={() => setError(null)}>Dismiss</button></div>}
    </div>
  )
}
const STATUS: Record<string,string> = { compiling: 'Interpreting sensory cues…', transition: 'Locating real input neurons…', propagating: 'Modeled activity is propagating', settled: 'Propagation complete' }
