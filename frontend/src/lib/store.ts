import type { FullNeuron } from './fullNeuron'
import { create } from 'zustand'
import type { SimulationEnvelope } from '../types/api'

export interface ProjectedLabel {
  roi: string
  name: string
  x: number
  y: number
  depth: number
}

export type ViewMode = 'fly' | 'brain'
export type Phase = 'idle' | 'compiling' | 'transition' | 'propagating' | 'settled'

interface State {
  anatomyFocus:boolean
  toggleAnatomyFocus:()=>void
  cinematic:boolean
  activityGain:number
  setActivityGain:(gain:number)=>void
  toggleCinematic:()=>void
  detail: FullNeuron | null
  detailStatus: 'idle' | 'loading' | 'ready' | 'error'
  detailError: string | null
  detailRetry: number
  isolateNeuron: boolean
  setDetail: (detail:FullNeuron|null, status:State['detailStatus'], error:string|null) => void
  retryDetail: () => void
  toggleIsolate: () => void
  view: ViewMode
  phase: Phase
  /** Scene-clock time (seconds) at which propagation step 0 fires. */
  simStartedAt: number | null
  sim: SimulationEnvelope | null
  error: string | null
  text: string
  inspector: boolean
  lesion: number[]
  hoveredBodyId: number | null
  /** True once the viewer has taken the camera over by dragging or scrolling. */
  manualCamera: boolean
  showLabels: boolean
  labels: ProjectedLabel[]

  setView: (v: ViewMode) => void
  setPhase: (p: Phase) => void
  setText: (t: string) => void
  setSim: (s: SimulationEnvelope | null, startedAt: number | null) => void
  setError: (e: string | null) => void
  toggleInspector: () => void
  setLesion: (ids: number[]) => void
  setHovered: (id: number | null) => void
  setManualCamera: (v: boolean) => void
  setLabels: (l: ProjectedLabel[]) => void
  toggleLabels: () => void
  reset: () => void
}

export const useStore = create<State>((set) => ({
  anatomyFocus:true, toggleAnatomyFocus:()=>set(s=>({anatomyFocus:!s.anatomyFocus})),
  cinematic:false, toggleCinematic:()=>set(s=>({cinematic:!s.cinematic})),
  activityGain:2, setActivityGain:(activityGain)=>set({activityGain:Math.max(.5,Math.min(4,activityGain))}),
  detail:null, detailStatus:'idle', detailError:null, detailRetry:0, isolateNeuron:false,
  setDetail:(detail,detailStatus,detailError)=>set({detail,detailStatus,detailError}),
  retryDetail:()=>set(s=>({detailRetry:s.detailRetry+1})),
  toggleIsolate:()=>set(s=>({isolateNeuron:!s.isolateNeuron})),
  view: 'brain',
  phase: 'idle',
  simStartedAt: null,
  sim: null,
  error: null,
  text: 'A hungry fly smells ripe fruit while a dark object rapidly approaches from its left.',
  inspector: false,
  lesion: [],
  hoveredBodyId: null,
  manualCamera: false,
  showLabels: false,
  labels: [],

  setView: (view) => set({ view, manualCamera: false }),
  setPhase: (phase) => set({ phase }),
  setText: (text) => set({ text }),
  setSim: (sim, simStartedAt) => set({ sim, simStartedAt }),
  setError: (error) => set({ error }),
  toggleInspector: () => set((s) => ({ inspector: !s.inspector })),
  setLesion: (lesion) => set({ lesion }),
  setHovered: (hoveredBodyId) => set(s => s.hoveredBodyId === hoveredBodyId ? { manualCamera:false } : { hoveredBodyId, detail:null, detailStatus:hoveredBodyId === null ? 'idle' : 'loading', detailError:null, manualCamera:false }),
  setManualCamera: (manualCamera) => set({ manualCamera }),
  setLabels: (labels) => set({ labels }),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels, labels: [] })),
  reset: () =>
    set({
      sim: null, simStartedAt: null, phase: 'idle', error: null,
      lesion: [], manualCamera: false,
    }),
}))

/** Seconds of wall time per propagation step. Paces the whole cascade. */
// Display seconds per recorded state; does not change biological/model time.
export const STEP_DURATION = 0.85
