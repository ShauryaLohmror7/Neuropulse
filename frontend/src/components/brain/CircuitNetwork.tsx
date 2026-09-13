import { anatomyEntrance } from '../../lib/anatomyEntrance'
import { useEffect, useMemo, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NeuronStateTexture, modalityIndex, type CircuitGeometry } from '../../lib/circuit'
import { makeNetworkMaterial } from '../../lib/networkMaterial'
import { neuronPlayback } from '../../lib/playback'
import { STEP_DURATION, useStore } from '../../lib/store'

interface Props {
  circuit: CircuitGeometry
  opacity?: number
  restingOpacity?: number
  excludeBodyIds?: Map<number,number>
  /** Fade out everything posterior to this plane (isolates the brain). */
  clipZ?: number
}

/**
 * Every rendered MaleCNS neuron in a single draw call.
 *
 * Activation state lives in a data texture (one texel per neuron), so when a
 * simulation arrives we write each neuron's ignition time and let the GPU sweep
 * a wavefront along its real cable. Neurons ignite in the order the propagation
 * model produced, at a pace of STEP_DURATION seconds per synaptic step.
 */
export function CircuitNetwork({ circuit, opacity = 1, clipZ = 1e6, restingOpacity = 0.18, excludeBodyIds }: Props) {
  const reducedMotion=useReducedMotion()
  const selected = useStore((s) => s.hoveredBodyId)
  const sim = useStore((s) => s.sim)
  const simStartedAt = useStore((s) => s.simStartedAt)

  const state = useMemo(() => new NeuronStateTexture(circuit.neuronCount), [circuit.neuronCount])
  const material = useMemo(
    () => makeNetworkMaterial(state.texture, [state.width, state.height]),
    [state],
  )
  const ref = useRef<THREE.LineSegments>(null)

  const tracks = useMemo(() => {
    const modalityOf = new Map<number, string>()
    if (!sim) return []
    for (const [modality, ids] of Object.entries(sim.result.seeds)) {
      for (const id of ids) modalityOf.set(id, modality)
    }
    const seedIds = new Set(Object.values(sim.result.seeds).flat())
    const best = new Map<number, number>()
    for (const p of sim.result.pulses) {
      if (p.modality && p.amplitude > (best.get(p.target) ?? -1)) {
        best.set(p.target, p.amplitude)
        if (!seedIds.has(p.target)) modalityOf.set(p.target, p.modality)
      }
    }
    return sim.result.activations.flatMap(a => {
      if (excludeBodyIds?.has(a.body_id)) return []
      const slot = circuit.slotOf.get(a.body_id)
      return slot === undefined ? [] : [{ a, slot, modality: modalityIndex(a.modality ?? modalityOf.get(a.body_id)) }]
    })
  }, [sim, circuit, excludeBodyIds])
  const lastState = useRef('')
  useEffect(() => { lastState.current = '' }, [tracks, simStartedAt])

  const dim = useRef(1)

  useFrame(({ clock }, dt) => {
    const u = material.uniforms
    u.uReveal.value = anatomyEntrance(clock.elapsedTime, !!reducedMotion || useStore.getState().manualCamera || !!sim)
    const summary = useStore.getState().phase === 'settled'
    const step = simStartedAt === null ? -1 : Math.floor((clock.elapsedTime - simStartedAt) / STEP_DURATION)
    const key = summary ? 'summary' : `${step}:playing`
    if (lastState.current !== key) {
      state.reset()
      if (simStartedAt !== null) for (const {a, slot, modality} of tracks) {
        const sample = neuronPlayback(a, step, summary)
        state.set(slot, sample.ignitionStep < 0 ? -1 : simStartedAt + sample.ignitionStep * STEP_DURATION,
          sample.activation, modality, 1)
      }
      state.commit()
      lastState.current = key
    }
    u.uSummary.value = summary || reducedMotion ? 1 : 0
    u.uCinematic.value = useStore.getState().cinematic ? 1 : 0
    u.uTime.value = clock.elapsedTime
    u.uGain.value = opacity * useStore.getState().activityGain

    // While a cascade runs, fade the quiet network back so the active pathway
    // is legible. Eased, never snapped.
    const wantDim = sim ? 0.42 : 1
    dim.current += (wantDim - dim.current) * (1 - Math.pow(0.05, dt))
    u.uDimUnactivated.value = dim.current
    u.uSelectedSlot.value = selected === null ? -1 : (circuit.slotOf.get(selected) ?? -1)
    u.uBaseOpacity.value = restingOpacity * opacity
    // Full-detail selection is rendered separately; do not superimpose a second LOD highlight.
    if (useStore.getState().detail?.manifest.bodyId === selected) u.uSelectedSlot.value = -1
    u.uClipZ.value += (clipZ - u.uClipZ.value) * (1 - Math.pow(0.02, dt))
  })

  useEffect(() => () => { state.dispose(); material.dispose() }, [state, material])

  return (
    <lineSegments
      ref={ref}
      geometry={circuit.geometry}
      material={material}
      frustumCulled={false}
      renderOrder={2}

    />
  )
}
