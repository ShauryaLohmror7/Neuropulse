import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { buildSkeletonGeometry } from '../../lib/morphology'
import { makeNeuronMaterial, type NeuronUniformOptions } from '../../lib/neuronMaterial'
import type { MorphologyPayload } from '../../types/connectome'

interface Props extends NeuronUniformOptions {
  payload: MorphologyPayload
  /** Scene clock time at which this neuron ignites; negative = at rest. */
  ignition?: number
  activation?: number
  sign?: 1 | -1
  dim?: number
}

/** One real MaleCNS neuron, drawn from its actual reconstructed skeleton. */
export function NeuronSkeleton({
  payload,
  ignition = -1,
  activation = 0,
  sign = 1,
  dim = 1,
  ...opts
}: Props) {
  const geometry = useMemo(() => buildSkeletonGeometry(payload), [payload])
  const material = useMemo(() => makeNeuronMaterial(opts), [
    opts.baseColor, opts.activeColor, opts.baseOpacity, opts.waveSpeed, opts.waveWidth,
    opts.fogNear, opts.fogFar,
  ])
  const ref = useRef<THREE.LineSegments>(null)

  useFrame(({ clock }) => {
    const u = material.uniforms
    u.uTime.value = clock.elapsedTime
    u.uIgnition.value = ignition
    u.uActivation.value = activation
    u.uSign.value = sign
    u.uDim.value = dim
  })

  return <lineSegments ref={ref} geometry={geometry} material={material} frustumCulled={false} />
}
