import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NeuronStateTexture, modalityIndex, type CircuitGeometry } from '../../lib/circuit'
import { makeNetworkMaterial } from '../../lib/networkMaterial'
import { STEP_DURATION, useStore } from '../../lib/store'

interface Props {
  circuit: CircuitGeometry
  opacity?: number
}

/**
 * Every rendered MaleCNS neuron in a single draw call.
 *
 * Activation state lives in a data texture (one texel per neuron), so when a
 * simulation arrives we write each neuron's ignition time and let the GPU sweep
 * a wavefront along its real cable. Neurons ignite in the order the propagation
 * model produced, at a pace of STEP_DURATION seconds per synaptic step.
 */
export function CircuitNetwork({ circuit, opacity = 1 }: Props) {
  const sim = useStore((s) => s.sim)
  const simStartedAt = useStore((s) => s.simStartedAt)

  const state = useMemo(() => new NeuronStateTexture(circuit.neuronCount), [circuit.neuronCount])
  const material = useMemo(
    () => makeNetworkMaterial(state.texture, [state.width, state.height]),
    [state],
  )
  const ref = useRef<THREE.LineSegments>(null)

  // Modality per activated neuron, resolved from the pulses that reached it.
  useEffect(() => {
    state.reset()
    if (!sim || simStartedAt === null) {
      state.commit()
      return
    }

    const modalityOf = new Map<number, string>()
    for (const seedList of Object.entries(sim.result.seeds)) {
      const [modality, ids] = seedList
      for (const id of ids) modalityOf.set(id, modality)
    }
    // Pulses carry the stream they descend from; strongest arrival wins.
    const best = new Map<number, number>()
    for (const p of sim.result.pulses) {
      if (!p.modality) continue
      const prev = best.get(p.target) ?? -1
      if (p.amplitude > prev) {
        best.set(p.target, p.amplitude)
        if (!modalityOf.has(p.target)) modalityOf.set(p.target, p.modality)
      }
    }

    for (const a of sim.result.activations) {
      const slot = circuit.slotOf.get(a.body_id)
      if (slot === undefined) continue
      const ignition = simStartedAt + a.step * STEP_DURATION
      state.set(slot, ignition, Math.min(a.activation * 2.4, 1), modalityIndex(modalityOf.get(a.body_id)), 1)
    }
    state.commit()
  }, [sim, simStartedAt, state, circuit])

  useFrame(({ clock }) => {
    const u = material.uniforms
    u.uTime.value = clock.elapsedTime
    u.uGain.value = opacity
    u.uBaseOpacity.value = 0.075 * opacity
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
