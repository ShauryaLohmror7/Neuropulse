import { NeuralAmbience } from './components/ui/NeuralAmbience'
import { AtlasLoading } from './components/ui/AtlasLoading'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useShallow } from 'zustand/react/shallow'
import { BrainScene } from './components/brain/BrainScene'
import { ExperienceInput } from './components/experience/ExperienceInput'
import { ExperienceBreakdown } from './components/experience/ExperienceBreakdown'
import { ActivityTimeline } from './components/simulation/ActivityTimeline'
import { SystemActivity } from './components/simulation/SystemActivity'
import { ResponsePanel } from './components/simulation/ResponsePanel'
import { ViewToggle } from './components/ViewToggle'
import { RegionLabelLayer } from './components/RegionLabelLayer'
import { KeyNeurons } from './components/KeyNeurons'
import { ScientificInspector } from './components/ScientificInspector'
import { useFullNeuron } from './hooks/useFullNeuron'
import { NeuronDetailPanel } from './components/NeuronDetailPanel'
import { useSceneData } from './hooks/useSceneData'
import { api } from './lib/api'
import { downloadRun } from './lib/runReport'
import { STEP_DURATION, useStore } from './lib/store'
import { PALETTE } from './lib/networkMaterial'
import { modalityIndex } from './lib/circuit'
import { getSceneTime } from './lib/sceneClock'
import type { SimulationEnvelope, InterpreterInfo } from './types/api'

export default function App() {
  const { data, error: dataError } = useSceneData()
  useFullNeuron(data)
  const { phase, sim, error, view, detail, inspector, showLabels, setPhase, setSim, setError, setView, toggleLabels, toggleInspector } = useStore(useShallow(s => ({detail:s.detail, phase:s.phase, sim:s.sim, error:s.error, view:s.view, inspector:s.inspector, showLabels:s.showLabels, setPhase:s.setPhase, setSim:s.setSim, setError:s.setError, setView:s.setView, toggleLabels:s.toggleLabels, toggleInspector:s.toggleInspector})))
  const anatomyFocus=useStore(s=>s.anatomyFocus)
  const activityGain=useStore(s=>s.activityGain)
  const timers = useRef<number[]>([])
  const [pending, setPending] = useState<SimulationEnvelope | null>(null)
  const [step, setStep] = useState(-1)
  const [continuity, setContinuity] = useState(false)
  const [chosenInterpreter, setInterpreterMode] = useState<'local'|'llm'|null>(null)
  const [interpreterInfo, setInterpreterInfo] = useState<InterpreterInfo|null>(null)
  const interpreterMode = chosenInterpreter ?? (interpreterInfo?.available ? 'llm' : 'local')
  const [interpreterError, setInterpreterError] = useState(false)
  const [tickets, setTickets] = useState<(string|null)[]>([])
  useEffect(() => {
    let cancelled = false
    api.interpreter().then(info => {if (!cancelled) setInterpreterInfo(info)}).catch(()=>{if (!cancelled) setInterpreterError(true)})
    return () => {cancelled = true}
  }, [])
  const [events, setEvents] = useState<string[]>([])
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
      setSim(envelope, getSceneTime() + 0.05)
      setPhase('propagating')
      setStep(-1)
      // Completion follows every recorded model state on the scene clock.
    }, 250))
  }, [setPhase, setView, setSim])

  const runSimulation = useCallback(async (text: string) => {
    const id = ++generation.current
    timers.current.forEach(clearTimeout)
    timers.current = []
    setError(null); setSim(null, null); setPending(null); setPhase('compiling')
    useStore.getState().setHovered(null)
    try {
      const nextEvents = [...events,text]
      const receipt = await api.interpret(text, interpreterMode)
      if (id !== generation.current) return
      const nextTickets = [...tickets,receipt.ticket]
      const envelope = continuity ? await api.simulateSequence(nextEvents,nextTickets,interpreterMode==='llm') : await api.simulate(text,[],receipt.ticket,interpreterMode==='llm')
      if (id === generation.current) { if (continuity) {setEvents(nextEvents);setTickets(nextTickets)} play(envelope) }
    } catch (e) {
      if (id !== generation.current) return
      setPhase('idle'); setError((e as Error).message)
    }
  }, [play, setError, setSim, setPhase, continuity, events, tickets, interpreterMode])

  const reset = () => {
    generation.current++
    timers.current.forEach(clearTimeout); timers.current = []
    setPending(null); setStep(-1)
    setEvents([]);setTickets([])
    useStore.getState().reset(); useStore.getState().setHovered(null)
  }
  const envelope = sim ?? pending
  const nextEvent = () => {setSim(null,null);setPending(null);setStep(-1);setPhase('idle');useStore.getState().setHovered(null)}
  const overviewReached = sim?.result.activations.filter(a=>data?.circuit.slotOf.has(a.body_id)||data?.context?.slotOf.has(a.body_id)).length ?? 0
  const active = sim?.result.activations.filter(a => phase === 'settled' || a.step <= step).length ?? 0
  const edges = (phase === 'settled' ? sim?.result.metrics.connections_traversed : sim?.result.steps.find(s => s.step === step)?.cumulative_connections) ?? 0
  const stageIndex = ['idle', 'compiling', 'transition', 'propagating', 'settled'].indexOf(phase)


  return (
    <div className="app restrained polished">
      <header className="masthead">
        <a className="brand" href="#" aria-label="NEUROPULSE home" onClick={e => { e.preventDefault(); reset() }}>
          <svg className="brand-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M2 17h7l4-11 6 21 4-10h7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="2" cy="17" r="2" fill="currentColor"/><circle cx="30" cy="17" r="2" fill="currentColor"/></svg>
          <span className="wordmark">NEUROPULSE</span><span className="edition">AN INTERACTIVE NEURAL ATLAS</span>
        </a>
        <div className="head-right"><span className="dataset-chip"><span className="live-dot"/> MaleCNS v1.0</span><button className="text-button" onClick={toggleInspector}>What is real? <span>↗</span></button></div>
      </header>

      <main className="workspace">
        <aside className={`experience-rail ${phase !== 'idle' ? 'has-run' : ''}`}>
          <NeuralAmbience/>
          <div className="intro"><div className="eyebrow"><span className="accent-line"/> THE EXPERIENCE</div><h1>A moment.<br/><em>A neural response.</em></h1><p>Explore how a fly’s real neural wiring carries a modeled sensory response.</p></div>
          {phase==='idle' && <details className="session-settings"><summary><span>{interpreterMode==='llm'?'Gemini':'Local'} · {continuity?'Continue sequence':'Fresh run'}</span><b>Settings</b></summary>
          <section className="state-mode"><label htmlFor="state-mode">NEURAL STATE</label><select id="state-mode" value={continuity?'continue':'fresh'} onChange={e=>{reset();setContinuity(e.target.value==='continue')}}><option value="fresh">Fresh run · reset for every input</option><option value="continue">Continue sequence · retain neural state</option></select><p>{continuity?'Activity and refractory state carry between events. This is not learned biological memory.':'Each input begins from zero modeled activity.'}</p></section>
          <section className="state-mode interpreter-mode"><label htmlFor="interpreter-mode">UNDERSTAND THE SITUATION</label><select id="interpreter-mode" value={interpreterMode} onChange={e=>setInterpreterMode(e.target.value as 'local'|'llm')}><option value="local">Local · private, supported vocabulary</option><option value="llm" disabled={!interpreterInfo?.available}>Gemini scene interpretation{interpreterInfo?.available?'':' · setup needed'}</option></select><p>{interpreterMode==='llm'?'Sends your experience to Google Gemini to identify cues. When the model does not resolve a movement, Gemini also receives an activity summary to suggest an action with verified activity citations and explicit assumptions. Neurons and activity are calculated by NEUROPULSE.':'Uses the local parser. No experience text is sent to an external AI.'}</p>{!interpreterInfo?.available && <small>{interpreterError?'Could not check AI availability. Local interpretation remains available.':interpreterInfo?'AI interpretation needs a server-side GEMINI_API_KEY.':'Checking AI availability…'}</small>}</section>
          </details>}
          {continuity && <section className="event-history" aria-label="Sequence history"><b>SEQUENCE · {events.length}/6 EVENTS</b>{events.map((text,i)=><p key={i}><span>{i+1}</span>{text||'Let earlier activity settle'}</p>)}{!!events.length&&<button className="text-button" onClick={reset}>Reset sequence ↺</button>}<small>Model time advances only when you run an event.</small></section>}
          {phase === 'idle' ? <ExperienceInput onSimulate={runSimulation} disabled={!data} /> : <div className="run-story">
            <div className="eyebrow">YOUR EXPERIENCE</div><p className="quote">“{envelope?.experience.raw_text === '' ? 'No new stimulus · let earlier activity settle' : envelope?.experience.raw_text ?? useStore.getState().text}”</p>
            <div className="run-status" role="status"><span className="pulse-dot"/>{sim?.response.interpretation_kind === 'no_input' ? 'Input needs a supported sensory cue' : STATUS[phase]}</div>
            {envelope?.experience.interpreter_notice && <p className="interpreter-notice" role="status">{envelope.experience.interpreter_notice}</p>}
            {envelope && <p className="interpreter-attribution">{envelope.experience.parser.startsWith('gemini:')?'AI scene interpretation · approximate cues':'Local scene interpretation'} · {envelope.response.ai_hypothesis ? 'AI suggestion shown separately from computed activity' : 'outcome calculated from the network'}</p>}
            {envelope && <ResponsePanel response={envelope.response} playing={phase!=='settled'}/>}
            {phase==='propagating' && <button className="skip-playback" onClick={()=>setPhase('settled')}>Show final activity →</button>}
            <div className="run-actions"><button className="text-button" onClick={reset}>{phase === 'settled' ? '← New experience' : 'Cancel simulation'}</button>{phase === 'settled' && sim && sim.result.metrics.neurons_activated > 0 && <button className="text-button" onClick={() => { setSim(null,null); play(sim) }}>↻ Replay</button>}</div>
            {phase==='settled' && sim && <div className="result-tools"><button onClick={()=>{useStore.getState().setText(sim.experience.raw_text);if(continuity){setEvents(events.slice(0,-1));setTickets(tickets.slice(0,-1))}nextEvent()}}>{continuity?'Revise latest event':'Edit this experience'}</button><details><summary>Export this run</summary><button onClick={()=>downloadRun(sim,'md')}>Readable report (.md)</button><button onClick={()=>downloadRun(sim,'json')}>Full model data (.json)</button></details></div>}

            {phase==='settled' && continuity && events.length<6 && <div className="sequence-actions"><button onClick={nextEvent}>Add next event →</button><button onClick={()=>runSimulation('')}>Let activity settle</button></div>}
            <details className="run-details"><summary>Explore neural activity <span>Timeline, brain systems & inputs</span></summary>
            {sim && <ActivityTimeline result={sim.result} step={step} settled={phase==='settled'}/>}
            {phase === 'settled' && sim && <><p className="coverage">{overviewReached} of {sim.result.metrics.neurons_activated} reached neurons have overview morphology.</p></>}
            {sim && <SystemActivity sim={sim} step={step} settled={phase==='settled'}/>}
            {envelope && (phase === 'settled' ? <details className="input-details"><summary>What activated first · sensory inputs</summary><ExperienceBreakdown experience={envelope.experience}/></details> : <ExperienceBreakdown experience={envelope.experience}/>)}

            </details>
          </div>}
          <div className="rail-note"><span>01</span><p><strong>Real anatomy. Modeled activity.</strong><br/>Every rendered neuron comes from the dataset. Signal timing is illustrative.</p></div>
        </aside>

        <section className="viewer" aria-label="Interactive nervous system visualization">
          <div className="viewer-top"><div><div className="eyebrow">DROSOPHILA MELANOGASTER</div><h2>{detail && view === 'brain' ? 'One neuron. Every source branch.' : view === 'brain' ? 'An atlas of sensation.' : 'One fly. Thousands of pathways.'}</h2></div><ViewToggle/></div>
          <NeuralAmbience variant="silk"/>
          <div className="scene">{data && <BrainScene data={data}/>}<RegionLabelLayer/></div>
          {!data && <AtlasLoading error={dataError}/>}{data && <div className="anatomy-entrance-note" aria-hidden="true">Revealing source branches <span>Presentation effect · not neural activity</span></div>}
          <div className="instrument-frame" aria-hidden="true"><i/><i/><i/><i/></div>
          {data && <div className="scene-readout"><span className="readout-dot"/><span>{phase==='propagating' ? 'MODEL SIGNAL PLAYBACK' : phase==='settled' ? 'PEAK ACTIVITY · FROZEN SUMMARY' : 'DATASET ANATOMY'}</span><b>{phase==='propagating' && sim ? `STATE ${String(Math.max(0,Math.min(step,sim.result.steps.length-1))).padStart(2,'0')} / ${String(sim.result.steps.length-1).padStart(2,'0')}` : 'MaleCNS · v1.0'}</b></div>}
          <NeuronDetailPanel data={data}/>
          <div className="viewer-tools" role="toolbar" aria-label="Brain controls">
            <button onClick={() => { useStore.getState().setHovered(null); setView(view) }}>↺ <span>Reset view</span></button>
            <button onClick={toggleInspector}>ⓘ <span>Explore data</span></button>
            <details className="display-menu"><summary>☷ <span>Display</span></summary><div className="display-popover">
              <b>Brain display</b>
              <button aria-pressed={showLabels} onClick={toggleLabels}>Region labels <span>{showLabels?'On':'Off'}</span></button>
              <button aria-pressed={!anatomyFocus} onClick={()=>useStore.getState().toggleAnatomyFocus()}>All cell bodies <span>{anatomyFocus?'Off':'On'}</span></button>
              <label htmlFor="activity-gain">Activity contrast <b>{activityGain.toFixed(1)}×</b></label>
              <input id="activity-gain" type="range" min="0.5" max="4" step="0.5" value={activityGain} onChange={e=>useStore.getState().setActivityGain(Number(e.target.value))}/>
              <small>Appearance only. Model values stay the same.</small>
            </div></details>
          </div>
          {data && sim && phase === 'settled' && <KeyNeurons data={data}/>}
          <div className="view-caption"><span className="specimen-marker">{detail ? `SOURCE / ${detail.manifest.bodyId}` : view === 'brain' ? 'BRAIN / 01' : 'SPECIMEN / 01'}</span><p>{detail ? 'Unpruned source skeleton · checksum verified' : view === 'brain' ? (anatomyFocus?'Source branches · illustrative widths':'All measured somata · overview branches') : 'Contextual fly shell · real CNS reconstruction'}</p><span className="orbit-hint">Drag to orbit · Scroll to zoom</span></div>
          <div className="viewer-bottom">
            <div className="legend" aria-label="Activity color legend"><span><i className="legend-structure"/>Anatomy</span>{Array.from(new Set(sim?.result.metrics.modalities ?? [])).map(modality=><span key={modality}><i style={{background:`#${PALETTE[modalityIndex(modality)].getHexString()}`}}/>{MODALITY_LABELS[modality]??modality}</span>)}<span className="legend-note">{sim ? "Modeled activity" : "Source cell colors"}</span></div>
            <div className="data-stats">{detail ? <><b>{detail.manifest.stats.nodeCount.toLocaleString()}</b> source nodes <span>/</span><b>0</b> invented connections</> : sim ? <><b>{active.toLocaleString()}</b> reached <span>/</span><b>{edges.toLocaleString()}</b> connections reached</> : data ? <><b>{data.circuitDoc.counts.graphNeurons.toLocaleString()}</b> neurons in graph <span>/</span><b>{data.circuitDoc.somas?.bodyIds.length.toLocaleString()}</b> measured cell bodies</> : 'Preparing reconstruction'}</div>
          </div>
        </section>
      </main>
      <footer className="app-footer"><span>NEUROPULSE / ANATOMY IN MOTION</span><div className="pipeline">{['Experience', 'Interpret', 'Map', 'Propagate', 'Response'].map((s,i) => <span className={i === stageIndex ? 'current' : i < stageIndex ? 'complete' : ''} key={s}><i>{String(i+1).padStart(2,'0')}</i>{s}{i < 4 && <b>—</b>}</span>)}</div><button className="text-button" onClick={toggleInspector}>Science & sources ↗</button></footer>
      <AnimatePresence>{data && inspector && <ScientificInspector data={data}/>}</AnimatePresence>
      {error && <div className="toast" role="alert"><span>{error}</span><button onClick={() => setError(null)}>Dismiss</button></div>}
    </div>
  )
}
const STATUS: Record<string,string> = { compiling: 'Interpreting sensory cues…', transition: 'Locating real input neurons…', propagating: 'Modeled activity is propagating', settled: 'Propagation complete' }

const MODALITY_LABELS:Record<string,string> = {vision:"Vision",olfaction:"Smell",gustation:"Taste",mechanosensation:"Touch",audition:"Sound",airflow:"Airflow",thermosensation:"Temperature",hygrosensation:"Humidity",mixed:"Combined"}
