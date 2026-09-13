import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CircuitGeometry } from '../../lib/circuit'

/**
 * The dense brain-context layer.
 *
 * Thousands of real MaleCNS neurons sampled across the whole brain, drawn dim
 * and coloured by their real cell class. This is what gives the scene the
 * familiar shape of this connectome — optic lobes flanking the central brain —
 * instead of a sparse tangle of wires.
 *
 * Deliberately inert: no activation state, no wavefront, no pulses. It is
 * structure, never signal, so it can never be mistaken for simulated activity.
 */
export function BrainContext({
  circuit,
  opacity = 1,
  dim = 1,
  clipZ = 1e6,
}: {
  circuit: CircuitGeometry
  opacity?: number
  dim?: number
  /** Fade out everything posterior to this plane (isolates the brain). */
  clipZ?: number
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uOpacity: { value: 0.3 },
          uDim: { value: 1 },
          uFogNear: { value: 500 },
          uFogFar: { value: 4200 },
          uSaturation: { value: 1.25 },
          uLift: { value: 0.02 },
          uClipZ: { value: 1e6 },
          uClipSoft: { value: 90 },
        },
        vertexShader: /* glsl */ `
          attribute vec3 aTint;
          varying vec3  vTint;
          varying float vDepth;
          varying float vZ;
          void main() {
            vTint = aTint;
            vZ = position.z;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vDepth = -mv.z;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform float uOpacity;
          uniform float uDim;
          uniform float uFogNear;
          uniform float uFogFar;
          uniform float uSaturation;
          uniform float uLift;
          uniform float uClipZ;
          uniform float uClipSoft;
          varying vec3  vTint;
          varying float vDepth;
          varying float vZ;

          void main() {
            float keep = (1.0 - smoothstep(uClipZ - uClipSoft, uClipZ + uClipSoft, vZ));
            if (keep < 0.004) discard;
            float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);
            fog = clamp(fog, 0.65, 1.0);
            float lum = dot(vTint, vec3(0.299, 0.587, 0.114));
            vec3 col = (mix(vec3(lum), vTint, uSaturation) + uLift) * 0.55;
            col *= mix(0.55, 1.0, fog) * uDim;
            float a = uOpacity * fog * keep;
            if (a < 0.002) discard;
            gl_FragColor = vec4(col, a);
          }
        `,
        transparent: true,
        depthWrite: true,
        blending: THREE.NormalBlending,
      }),
    [],
  )

  useFrame((_, dt) => {
    material.uniforms.uDim.value = dim
    material.uniforms.uOpacity.value = 0.48 * opacity * dim
    const u = material.uniforms.uClipZ
    u.value += (clipZ - u.value) * (1 - Math.pow(0.02, dt))
  })

  useEffect(() => () => material.dispose(), [material])

  if (opacity <= 0.004) return null

  return (
    <lineSegments
      geometry={circuit.geometry}
      material={material}
      frustumCulled={false}
      renderOrder={1}
    />
  )
}
