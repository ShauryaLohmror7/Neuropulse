import { useReducedMotion } from 'framer-motion'
import { anatomyEntrance } from '../../lib/anatomyEntrance'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { STEP_DURATION, useStore } from '../../lib/store'
import { neuronPlayback } from '../../lib/playback'
import { modalityIndex, type CircuitGeometry } from '../../lib/circuit'
import { PALETTE } from '../../lib/networkMaterial'

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
  context,
  opacity = 1,
  clipZ = 1e6,
  size = 1,
}: {
  circuit: CircuitGeometry
  context?: CircuitGeometry | null
  opacity?: number
  clipZ?: number
  size?: number
}) {
  const reduced = useReducedMotion()
  const sim = useStore(s => s.sim)
  const simStartedAt = useStore(s => s.simStartedAt)
  const tracks = useMemo(() => {
    const slots = new Map(circuit.somas?.bodyIds.map((id,i) => [id,i]) ?? [])
    return sim?.result.activations.flatMap(a => {
      const slot = slots.get(a.body_id)
      return slot === undefined ? [] : [{a,slot}]
    }) ?? []
  }, [circuit,sim])
  const lastState = useRef('')
  useEffect(() => { lastState.current = '' }, [tracks,simStartedAt])
  const { geometry, material, halo } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const s = circuit.somas
    if (s) {
      g.setAttribute('position', new THREE.BufferAttribute(s.positions, 3))
      g.setAttribute('aActivity', new THREE.BufferAttribute(new Float32Array(s.bodyIds.length), 1))
      g.setAttribute('aModality', new THREE.BufferAttribute(new Float32Array(s.bodyIds.length), 1))
      const focus = new Float32Array(s.bodyIds.length)
      const colours = s.colours.slice()
      const contextColours = context?.somas
      const contextSlots = new Map(contextColours?.bodyIds.map((id,i)=>[id,i]) ?? [])
      for (let i=0;i<s.bodyIds.length;i++) {
        const id=s.bodyIds[i]
        focus[i]=circuit.slotOf.has(id)||context?.slotOf.has(id)?1:0
        const slot=contextSlots.get(id)
        if (slot!==undefined&&contextColours) colours.set(contextColours.colours.subarray(slot*3,slot*3+3),i*3)
      }
      g.setAttribute('aFocus',new THREE.BufferAttribute(focus,1))
      g.setAttribute('aColour', new THREE.BufferAttribute(colours, 3))
    }
    g.computeBoundingSphere()

    const m = new THREE.ShaderMaterial({
      uniforms: {
        uFocus: { value: 1 },
        uOpacity: { value: 0.5 },
        uGain: { value: 2 },
        uHalo: { value: 0 },
        uActiveScene: { value: 0 },
        uPalette: { value: PALETTE },
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
        attribute float aFocus;
        uniform float uFocus;
        attribute float aActivity;
        attribute float aModality;
        uniform vec3 uPalette[10];
        uniform float uGain;
        uniform float uHalo;
        uniform float uActiveScene;
        varying float vActivity;
        uniform float uSize;
        uniform float uOpacity;
        uniform float uClipZ;
        uniform float uClipSoft;
        uniform float uFogNear;
        uniform float uFogFar;
        varying vec3  vColour;
        varying float vAlpha;

        void main() {
          vActivity = sqrt(max(aActivity, 0.0));
          vec3 hue = vec3(0.3, 1.0, 0.85);
          for (int i = 1; i < 10; i++) { if (i == int(aModality + 0.5)) hue = uPalette[i]; }
          vColour = mix(aColour, hue, clamp(vActivity * 3.0, 0.0, 1.0));
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float d = -mv.z;
          float keep = (1.0 - smoothstep(uClipZ - uClipSoft, uClipZ + uClipSoft, position.z));
          float fog = 1.0 - smoothstep(uFogNear, uFogFar, d);
          vAlpha = keep * clamp(fog, 0.05, 1.0);
          vAlpha *= mix(1.0,max(aFocus,step(0.000001,aActivity)),uFocus);
          vAlpha *= mix(1.0, mix(0.17, 1.0, min(vActivity * 6.0, 1.0)), uActiveScene);
          gl_PointSize = min(24.0, (uSize + vActivity * 5.0 * sqrt(uGain)) * mix(1.0, 1.6, uHalo) * (760.0 / max(d, 1.0)));
          gl_Position = projectionMatrix * mv;
          if (vAlpha < 0.002 || (uHalo > 0.5 && (aActivity <= 0.0 || uOpacity <= 0.0))) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            gl_PointSize = 1.0;
          }
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying float vActivity;
        uniform float uOpacity;
        uniform float uHalo;
        uniform float uGain;
        varying vec3  vColour;
        varying float vAlpha;

        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          if (r > 0.5) discard;
          if (uHalo > 0.5) {
            if (vActivity <= 0.0) discard;
            float halo = exp(-r * r * 24.0);
            float core = exp(-r * r * 220.0);
            gl_FragColor = vec4(vColour * (1.0 + core * 0.5), halo * vActivity * uGain * vAlpha * uOpacity * 0.12);
            return;
          }
          // Soft-edged disc with a brighter core, so dense clusters still read
          // as individual cell bodies rather than a flat wash.
          float core = 1.0-smoothstep(0.36,0.5,r);
          vec3 normal = vec3(c*2.0,sqrt(max(0.0,1.0-dot(c*2.0,c*2.0))));
          float lighting = 0.38+0.62*max(dot(normal,normalize(vec3(-0.5,0.7,1.0))),0.0);
          float a = core * vAlpha * uOpacity;
          if (a < 0.003) discard;
          vec3 col = mix(vColour, vec3(1.0), pow(core, 6.0) * 0.15);
          gl_FragColor = vec4(col * (lighting + vActivity * 0.7), a);
        }
      `,
    })
    const halo = m.clone()
    halo.uniforms.uHalo.value = 1
    halo.blending = THREE.NormalBlending
    halo.depthTest = false
    return { geometry: g, material: m, halo }
  }, [circuit,context])

  useFrame(({clock}, dt) => {
    const summary = useStore.getState().phase === 'settled'
    const step = simStartedAt === null ? -1 : Math.floor((clock.elapsedTime - simStartedAt) / STEP_DURATION)
    const key = summary ? 'summary' : `${step}:playing`
    if (key !== lastState.current) {
      const attribute = geometry.getAttribute('aActivity') as THREE.BufferAttribute | undefined
      const modalities = geometry.getAttribute('aModality') as THREE.BufferAttribute | undefined
      if (attribute) {
        (attribute.array as Float32Array).fill(0)
        if (simStartedAt !== null) for (const {a,slot} of tracks) {
          attribute.setX(slot,neuronPlayback(a,step,summary).activation)
          modalities?.setX(slot,modalityIndex(a.modality))
        }
        attribute.needsUpdate = true
        if (modalities) modalities.needsUpdate = true
      }
      lastState.current = key
    }
    material.uniforms.uOpacity.value = 0.85 * opacity * Math.min(1, anatomyEntrance(clock.elapsedTime, !!reduced || useStore.getState().manualCamera || !!sim))
    material.uniforms.uFocus.value = useStore.getState().anatomyFocus ? 1 : 0
    material.uniforms.uSize.value = 5.0 * (useStore.getState().anatomyFocus ? 2.0 : size)
    const u = material.uniforms.uClipZ
    u.value += (clipZ - u.value) * (1 - Math.pow(0.02, dt))
    material.uniforms.uActiveScene.value = sim?.result.activations.length ? 1 : 0
    material.uniforms.uGain.value = useStore.getState().activityGain
    for (const name of ['uOpacity','uSize','uClipZ','uActiveScene','uGain','uFocus']) halo.uniforms[name].value = material.uniforms[name].value
    if (!useStore.getState().cinematic) halo.uniforms.uOpacity.value = 0
  })

  useEffect(() => () => { geometry.dispose(); material.dispose(); halo.dispose() }, [geometry, material, halo])

  if (!circuit.somas || opacity <= 0.004) return null

  return <><points geometry={geometry} material={material} frustumCulled={false} renderOrder={1} /><points geometry={geometry} material={halo} frustumCulled={false} renderOrder={3} /></>
}
