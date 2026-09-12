import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { modalityIndex, type CircuitGeometry } from '../../lib/circuit'
import { PALETTE } from '../../lib/networkMaterial'
import { STEP_DURATION, useStore } from '../../lib/store'

const MAX_PULSES = 4000

/**
 * Signal crossing real synapses.
 *
 * One point sprite per modelled transmission event, travelling from the source
 * neuron's anchor to the target's over one propagation step. Each pulse knows
 * its own departure time, so the whole cascade animates on the GPU from static
 * buffers — no per-frame CPU work beyond advancing a clock.
 *
 * Brightness scales with the modelled amplitude; size scales with the *real*
 * synapse count of the connection, so the heaviest measured pathways read as
 * the strongest.
 */
export function SignalParticles({ circuit }: { circuit: CircuitGeometry }) {
  const sim = useStore((s) => s.sim)
  const simStartedAt = useStore((s) => s.simStartedAt)
  const ref = useRef<THREE.Points>(null)

  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PULSES * 3), 3))
    g.setAttribute('aTarget', new THREE.BufferAttribute(new Float32Array(MAX_PULSES * 3), 3))
    g.setAttribute('aStart', new THREE.BufferAttribute(new Float32Array(MAX_PULSES), 1))
    g.setAttribute('aAmp', new THREE.BufferAttribute(new Float32Array(MAX_PULSES), 1))
    g.setAttribute('aWeight', new THREE.BufferAttribute(new Float32Array(MAX_PULSES), 1))
    g.setAttribute('aModality', new THREE.BufferAttribute(new Float32Array(MAX_PULSES), 1))
    g.setAttribute('aSign', new THREE.BufferAttribute(new Float32Array(MAX_PULSES), 1))
    g.setDrawRange(0, 0)

    const m = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTravel: { value: STEP_DURATION * 0.92 },
        uPalette: { value: PALETTE },
        uGain: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3  aTarget;
        attribute float aStart;
        attribute float aAmp;
        attribute float aWeight;
        attribute float aModality;
        attribute float aSign;

        uniform float uTime;
        uniform float uTravel;

        varying float vAlpha;
        varying float vModality;
        varying float vSign;
        varying float vHead;

        void main() {
          float t = (uTime - aStart) / uTravel;
          float alive = step(0.0, t) * step(t, 1.0);
          float u = clamp(t, 0.0, 1.0);
          // Ease so the pulse leaves briskly and decelerates into the target.
          float e = u * u * (3.0 - 2.0 * u);

          vec3 p = mix(position, aTarget, e);
          // A gentle arc keeps overlapping pulses distinguishable.
          vec3 dir = aTarget - position;
          vec3 up = normalize(cross(dir, vec3(0.0, 0.0, 1.0)) + vec3(1e-4));
          p += up * sin(u * 3.14159) * length(dir) * 0.09;

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;

          float fade = sin(u * 3.14159);
          vAlpha = alive * fade * clamp(aAmp * 5.0, 0.15, 1.0);
          vModality = aModality;
          vSign = aSign;
          vHead = e;

          float size = 2.6 + 4.4 * clamp(aWeight / 60.0, 0.0, 1.0);
          gl_PointSize = alive * size * (520.0 / max(d, 1.0));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform vec3  uPalette[10];
        uniform float uGain;
        varying float vAlpha;
        varying float vModality;
        varying float vSign;

        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          if (r > 0.5) discard;
          float core = smoothstep(0.5, 0.0, r);
          core = pow(core, 2.2);

          int mi = int(vModality + 0.5);
          vec3 hue = uPalette[0];
          for (int i = 0; i < 10; i++) { if (i == mi) hue = uPalette[i]; }
          if (vSign < 0.0) hue = mix(hue, vec3(0.35, 0.52, 0.85), 0.7) * 0.75;

          vec3 col = mix(hue, vec3(1.0), core * 0.55);
          gl_FragColor = vec4(col, core * vAlpha * uGain);
        }
      `,
    })
    return { geometry: g, material: m }
  }, [])

  useEffect(() => {
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute
    const tgt = geometry.getAttribute('aTarget') as THREE.BufferAttribute
    const start = geometry.getAttribute('aStart') as THREE.BufferAttribute
    const amp = geometry.getAttribute('aAmp') as THREE.BufferAttribute
    const wgt = geometry.getAttribute('aWeight') as THREE.BufferAttribute
    const mod = geometry.getAttribute('aModality') as THREE.BufferAttribute
    const sgn = geometry.getAttribute('aSign') as THREE.BufferAttribute

    if (!sim || simStartedAt === null) {
      geometry.setDrawRange(0, 0)
      return
    }

    // Strongest pulses first so the cap never drops the structurally important ones.
    const pulses = [...sim.result.pulses].sort((a, b) => b.amplitude - a.amplitude).slice(0, MAX_PULSES)

    let n = 0
    for (const p of pulses) {
      const si = circuit.slotOf.get(p.source)
      const ti = circuit.slotOf.get(p.target)
      if (si === undefined || ti === undefined) continue // not a rendered neuron
      pos.setXYZ(n, circuit.anchors[si * 3], circuit.anchors[si * 3 + 1], circuit.anchors[si * 3 + 2])
      tgt.setXYZ(n, circuit.anchors[ti * 3], circuit.anchors[ti * 3 + 1], circuit.anchors[ti * 3 + 2])
      start.setX(n, simStartedAt + (p.step - 1) * STEP_DURATION)
      amp.setX(n, p.amplitude)
      wgt.setX(n, p.weight)
      mod.setX(n, modalityIndex(p.modality))
      sgn.setX(n, p.sign)
      n++
    }

    for (const a of [pos, tgt, start, amp, wgt, mod, sgn]) a.needsUpdate = true
    geometry.setDrawRange(0, n)
    geometry.computeBoundingSphere()
  }, [sim, simStartedAt, geometry, circuit])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
  })

  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />
}
