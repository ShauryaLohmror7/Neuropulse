import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Suspended dust motes. Purely atmospheric — they carry no biological meaning
 * and are deliberately near-invisible; they exist to give the empty volume
 * around the tissue a sense of depth and scale.
 */
export function Atmosphere({ count = 900, radius = 420 }: { count?: number; radius?: number }) {
  const ref = useRef<THREE.Points>(null)

  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      // Uniform-ish in a sphere shell
      const u = Math.random()
      const r = radius * (0.35 + 0.65 * Math.cbrt(u))
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7
      pos[i * 3 + 2] = r * Math.cos(phi)
      seed[i] = Math.random() * 100
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return g
  }, [count, radius])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uSize: { value: 1.6 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute float aSeed;
          uniform float uTime;
          uniform float uSize;
          varying float vAlpha;
          void main() {
            vec3 p = position;
            p.y += sin(uTime * 0.09 + aSeed) * 5.0;
            p.x += cos(uTime * 0.07 + aSeed * 1.3) * 4.0;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float d = -mv.z;
            vAlpha = smoothstep(1400.0, 300.0, d) * (0.10 + 0.14 * fract(aSeed));
            gl_PointSize = uSize * (600.0 / max(d, 1.0));
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vAlpha;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float m = smoothstep(0.5, 0.0, length(c));
            gl_FragColor = vec4(vec3(0.62, 0.70, 0.85), m * vAlpha);
          }
        `,
      }),
    [],
  )

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
  })

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />
}
