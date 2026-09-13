import type { HealthInfo, SimulationEnvelope } from '../types/api'

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
  health: () => json<HealthInfo>('/health'),
  simulate: (text: string, lesion: number[] = []) =>
    json<SimulationEnvelope>('/simulate', {
      method: 'POST',
      body: JSON.stringify({ text, lesion }),
    }),
  provenance: () => json<Record<string, unknown>>('/provenance'),
}
