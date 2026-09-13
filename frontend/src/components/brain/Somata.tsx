import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CircuitGeometry } from '../../lib/circuit'

/**
 * The soma rind.
 *
 * Drosophila cell bodies sit in a layer on the outside of the neuropil, and in
 * published renders of this connectome they are the dominant texture — the
 * dense field of coloured dots wrapping the brain. Positions come from the
 * dataset's own `somaLocation` field, so every dot is a real cell body at its
 * measured location.
 *
 * Drawn as sprites with a soft falloff and a slight size-with-depth response so
 * the rind reads as a surface rather than a flat stipple.
 */
export function Somata({
  circuit,
  opacity = 1,
  clipZ = 1e6,
  size = 1,
}: {
  circuit: CircuitGeometry
  opacity?: number
  clipZ?: number
  size?: number
}) {
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const s = circuit.somas
    if (s) {
      g.setAttribute('position', new THREE.BufferAttribute(s.positions, 3))
      g.setAttribute('aColour', new THREE.BufferAttribute(s.colours, 3))
    }
    g.computeBoundingSphere()

    const m = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0.5 },
        uSize: { value: 7.0 },
        uClipZ: { value: 1e6 },
        uClipSoft: { value: 90 },
        uFogNear: { value: 500 },
        uFogFar: { value: 4200 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aColour;
        uniform float uSize;
        uniform float uClipZ;
        uniform float uClipSoft;
        uniform float uFogNear;
        uniform float uFogFar;
        varying vec3  vColour;
        varying float vAlpha;

        void main() {
          vColour = aColour;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float d = -mv.z;
          float keep = (1.0 - smoothstep(uClipZ - uClipSoft, uClipZ + uClipSoft, position.z));
          float fog = 1.0 - smoothstep(uFogNear, uFogFar, d);
          vAlpha = keep * clamp(fog, 0.05, 1.0);
          gl_PointSize = uSize * (760.0 / max(d, 1.0));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uOpacity;
        varying vec3  vColour;
        varying float vAlpha;

        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          if (r > 0.5) discard;
          // Soft-edged disc with a brighter core, so dense clusters still read
          // as individual cell bodies rather than a flat wash.
          float core = smoothstep(0.5, 0.06, r);
          float a = core * vAlpha * uOpacity;
          if (a < 0.003) discard;
          vec3 col = mix(vColour, vec3(1.0), pow(core, 6.0) * 0.15);
          gl_FragColor = vec4(col * 0.65, a);
        }
      `,
    })
    return { geometry: g, material: m }
  }, [circuit])

  useFrame((_, dt) => {
    material.uniforms.uOpacity.value = 0.85 * opacity
    material.uniforms.uSize.value = 5.0 * size
    const u = material.uniforms.uClipZ
    u.value += (clipZ - u.value) * (1 - Math.pow(0.02, dt))
  })

  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])

  if (!circuit.somas || opacity <= 0.004) return null

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />
}
