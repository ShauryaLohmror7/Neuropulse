import { create } from 'zustand'
import type { SimulationEnvelope } from '../types/api'

export type ViewMode = 'fly' | 'brain'
export type Phase = 'idle' | 'compiling' | 'transition' | 'propagating' | 'settled'

interface State {
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

  setView: (v: ViewMode) => void
  setPhase: (p: Phase) => void
  setText: (t: string) => void
  setSim: (s: SimulationEnvelope | null, startedAt: number | null) => void
  setError: (e: string | null) => void
  toggleInspector: () => void
  setLesion: (ids: number[]) => void
  setHovered: (id: number | null) => void
  reset: () => void
}

export const useStore = create<State>((set) => ({
  view: 'fly',
  phase: 'idle',
  simStartedAt: null,
  sim: null,
  error: null,
  text: '',
  inspector: false,
  lesion: [],
  hoveredBodyId: null,

  setView: (view) => set({ view }),
  setPhase: (phase) => set({ phase }),
  setText: (text) => set({ text }),
  setSim: (sim, simStartedAt) => set({ sim, simStartedAt }),
  setError: (error) => set({ error }),
  toggleInspector: () => set((s) => ({ inspector: !s.inspector })),
  setLesion: (lesion) => set({ lesion }),
  setHovered: (hoveredBodyId) => set({ hoveredBodyId }),
  reset: () =>
    set({ sim: null, simStartedAt: null, phase: 'idle', error: null, lesion: [] }),
}))

/** Seconds of wall time per propagation step. Paces the whole cascade. */
export const STEP_DURATION = 1.35
