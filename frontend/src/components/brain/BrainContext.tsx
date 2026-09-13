import { anatomyEntrance } from '../../lib/anatomyEntrance'
import { useReducedMotion } from 'framer-motion'
import { useStore } from '../../lib/store'
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
  const reduced = useReducedMotion()
  // Screen-space ribbons follow each existing source segment exactly. Width is
  // illustrative display styling, not a measured neurite radius.
  const geometry = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute('position',new THREE.Float32BufferAttribute([0,-1,0, 1,-1,0, 1,1,0, 0,-1,0, 1,1,0, 0,1,0],3))
    const positions = new THREE.InstancedInterleavedBuffer(circuit.geometry.getAttribute('position').array as Float32Array,6)
    const colours = new THREE.InstancedInterleavedBuffer(circuit.geometry.getAttribute('aTint').array as Float32Array,6)
    g.setAttribute('aStart',new THREE.InterleavedBufferAttribute(positions,3,0))
    g.setAttribute('aEnd',new THREE.InterleavedBufferAttribute(positions,3,3))
    g.setAttribute('aTint',new THREE.InterleavedBufferAttribute(colours,3,0))
    const cable = circuit.geometry.getAttribute('aGeodesic')
    const extent = circuit.geometry.getAttribute('aExtent')
    const normalized = new Float32Array(cable.count)
    for(let i=0;i<cable.count;i++) normalized[i]=cable.getX(i)/Math.max(1,extent.getX(i))
    const reveal = new THREE.InstancedInterleavedBuffer(normalized,2)
    g.setAttribute('aCableStart',new THREE.InterleavedBufferAttribute(reveal,1,0))
    g.setAttribute('aCableEnd',new THREE.InterleavedBufferAttribute(reveal,1,1))
    g.instanceCount = positions.count
    return g
  },[circuit])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uReveal: { value: 1.1 },
          uResolution: { value: new THREE.Vector2(1,1) },
          uWidth: { value: 1.25 },
          uOpacity: { value: 0.3 },
          uDim: { value: 1 },
          uFogNear: { value: 700 },
          uFogFar: { value: 1900 },
          uSaturation: { value: 1.25 },
          uLift: { value: 0.02 },
          uClipZ: { value: 1e6 },
          uClipSoft: { value: 90 },
        },
        vertexShader: /* glsl */ `
          attribute float aCableStart;
          attribute float aCableEnd;
          varying float vCable;
          attribute vec3 aTint;
          attribute vec3 aStart;
          attribute vec3 aEnd;
          uniform vec2 uResolution;
          uniform float uWidth;
          varying vec3  vTint;
          varying float vDepth;
          varying float vZ;
          void main() {
            vCable = mix(aCableStart,aCableEnd,position.x);
            vTint = aTint;
            vec4 startView = modelViewMatrix * vec4(aStart,1.0);
            vec4 endView = modelViewMatrix * vec4(aEnd,1.0);
            // Clip in view space before the perspective divide. A segment
            // crossing the camera must never extrude across the whole screen.
            float nearZ = -projectionMatrix[3][2] / (projectionMatrix[2][2] - 1.0);
            if (startView.z > nearZ && endView.z > nearZ) {
              vZ = 0.0;
              vDepth = 0.0;
              gl_Position = vec4(2.0,2.0,2.0,1.0);
              return;
            }
            float from = 0.0;
            float to = 1.0;
            if (startView.z > nearZ) from = (nearZ-startView.z)/(endView.z-startView.z);
            if (endView.z > nearZ) to = (nearZ-startView.z)/(endView.z-startView.z);
            vec4 start = projectionMatrix * mix(startView,endView,from);
            vec4 end = projectionMatrix * mix(startView,endView,to);
            vec2 direction = (end.xy/max(end.w,0.001)-start.xy/max(start.w,0.001))*uResolution;
            direction /= max(length(direction),0.001);
            vec2 normal = vec2(-direction.y,direction.x);
            float along = mix(from,to,position.x);
            vZ = mix(aStart.z,aEnd.z,along);
            vec4 mv = mix(startView,endView,along);
            vDepth = -mv.z;
            gl_Position = projectionMatrix * mv;
            gl_Position.xy += normal * position.y * uWidth / uResolution * gl_Position.w;
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform float uReveal;
          varying float vCable;
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
            if (vCable > uReveal) discard;
            float keep = (1.0 - smoothstep(uClipZ - uClipSoft, uClipZ + uClipSoft, vZ));
            if (keep < 0.004) discard;
            float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);
            fog = clamp(fog, 0.2, 1.0);
            float lum = dot(vTint, vec3(0.299, 0.587, 0.114));
            vec3 col = (mix(vec3(lum), vTint, uSaturation) + uLift) * 0.5;
            col *= mix(0.35, 1.0, fog) * uDim;
            float a = uOpacity * fog * keep;
            if (a < 0.002) discard;
            gl_FragColor = vec4(col, a);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    [],
  )

  useFrame(({gl,clock}, dt) => {
    material.uniforms.uReveal.value = anatomyEntrance(clock.elapsedTime, !!reduced || useStore.getState().manualCamera || !!useStore.getState().sim)
    gl.getDrawingBufferSize(material.uniforms.uResolution.value)
    material.uniforms.uWidth.value = 0.8 * gl.getPixelRatio()
    material.uniforms.uDim.value = dim
    material.uniforms.uOpacity.value = 0.72 * opacity
    const u = material.uniforms.uClipZ
    u.value += (clipZ - u.value) * (1 - Math.pow(0.02, dt))
  })

  useEffect(() => () => {material.dispose();geometry.dispose()}, [material,geometry])

  if (opacity <= 0.004) return null

  return (
    <mesh
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={1}
    />
  )
}
