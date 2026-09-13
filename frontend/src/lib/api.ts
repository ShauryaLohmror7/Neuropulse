import type { HealthInfo, SimulationEnvelope, InterpreterInfo, InterpretationReceipt } from '../types/api'

const BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000/api'

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    signal: AbortSignal.timeout(45000),
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ''}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  simulateSequence: (events:string[], interpretation_tickets:(string|null)[] = events.map(()=>null), ai_action_fallback=false) => json<SimulationEnvelope>('/simulate-sequence', {method:'POST',body:JSON.stringify({events, interpretation_tickets, ai_action_fallback})}),
  interpreter: () => json<InterpreterInfo>('/interpreter'),
  interpret: (text:string, mode:'local'|'llm') => json<InterpretationReceipt>('/interpret', {method:'POST',body:JSON.stringify({text,mode})}),
  health: () => json<HealthInfo>('/health'),
  simulate: (text: string, lesion: number[] = [], interpretation_ticket:string|null = null, ai_action_fallback=false) =>
    json<SimulationEnvelope>('/simulate', {
      method: 'POST',
      body: JSON.stringify({ text, lesion, interpretation_ticket, ai_action_fallback }),
    }),
  provenance: () => json<Record<string, unknown>>('/provenance'),
}
