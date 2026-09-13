import * as THREE from 'three'

/**
 * Line material for real neuron skeletons.
 *
 * Resting state: a faint cool grey filament, depth-faded so the arbor reads as
 * volume rather than a flat tangle.
 *
 * Active state: a wavefront travels outward from the skeleton root at
 * `uWaveSpeed` scene-units/second. Every fragment knows its own cable distance
 * from the root (`aGeodesic`), so the bright band physically sweeps along the
 * real morphology and arrives at distal branches later than proximal ones —
 * an illustrative root-distance order, not measured electrophysiology.
 */

export const NEURON_VERT = /* glsl */ `
attribute float aGeodesic;
attribute float aRadius;
varying float vGeo;
varying float vRadius;
varying float vDepth;
varying vec3 vWorld;

void main() {
  vGeo = aGeodesic;
  vRadius = aRadius;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * mv;
}
`

export const NEURON_FRAG = /* glsl */ `
precision highp float;

uniform float uCinematic;
uniform float uSummary; // static peak-activity summary, no repeated firing
uniform float uTime;
uniform float uIgnition;      // time the wavefront entered this neuron (<0 = resting)
uniform float uActivation;    // modelled activation level, 0..1
uniform float uWaveSpeed;     // scene units per second
uniform float uWaveWidth;
uniform vec3  uBaseColor;
uniform vec3  uActiveColor;
uniform float uBaseOpacity;
uniform float uFogNear;
uniform float uFogFar;
uniform float uSign;          // +1 excitatory, -1 inhibitory
uniform float uDim;           // global dimming for background neurons

varying float vGeo;
varying float vRadius;
varying float vDepth;

void main() {
  // Depth attenuation gives the arbor a sense of volume.
  float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);
  fog = clamp(fog, 0.08, 1.0);

  // Thicker (more proximal) cable reads slightly brighter, as in real tracing.
  float calibre = clamp(vRadius * 0.9, 0.0, 1.0);

  vec3  color = uBaseColor;
  float alpha = uBaseOpacity * (0.55 + 0.45 * calibre);

  if (uIgnition >= 0.0 && uTime >= uIgnition) {
    float elapsed = max(uTime - uIgnition, 0.0);
    float front = elapsed * uWaveSpeed;
    float d = vGeo - front;

    // Leading pulse: a narrow gaussian band at the wavefront.
    float pulse = exp(-(d * d) / (2.0 * uWaveWidth * uWaveWidth));

    // Sustained glow behind the front, decaying with time since arrival.
    float arrived = step(vGeo, front);
    float sinceArrival = max(elapsed - vGeo / max(uWaveSpeed, 0.0001), 0.0);
    float sustain = arrived * uActivation * exp(-sinceArrival * 0.55);

    float energy = clamp(uActivation * 0.4 + sustain + pulse * uActivation * 1.35, 0.0, 2.2);
    if (uSummary > 0.5) energy = uActivation;

    // Inhibitory signal is rendered cooler and dimmer rather than "bright".
    vec3 activeCol = uSign < 0.0 ? uActiveColor * vec3(0.55, 0.72, 1.0) : uActiveColor;

    color = mix(uBaseColor, activeCol, clamp(energy, 0.0, 1.0));
    color += activeCol * max(energy - 1.0, 0.0) * 1.6;
    float coreWidth = max(uWaveWidth * 0.24, 0.001);
    float core = exp(-(d*d)/(2.0*coreWidth*coreWidth));
    float flare = core * uActivation * uCinematic * 3.0;
    if (uSummary > 0.5) flare = uActivation * uCinematic * 0.35;
    color += mix(activeCol, vec3(0.82, 0.98, 1.0), 0.55) * flare;
    alpha = clamp(alpha + energy * 0.75, 0.0, 1.0);
  }

  alpha *= fog * uDim;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(color, alpha);
}
`

export interface NeuronUniformOptions {
  baseColor?: THREE.ColorRepresentation
  activeColor?: THREE.ColorRepresentation
  baseOpacity?: number
  waveSpeed?: number
  waveWidth?: number
  fogNear?: number
  fogFar?: number
}

export function makeNeuronUniforms(opts: NeuronUniformOptions = {}) {
  return {
    uCinematic: { value: 1 },
    uSummary: { value: 0 },
    uTime: { value: 0 },
    uIgnition: { value: -1 },
    uActivation: { value: 0 },
    uWaveSpeed: { value: opts.waveSpeed ?? 240 },
    uWaveWidth: { value: opts.waveWidth ?? 26 },
    uBaseColor: { value: new THREE.Color(opts.baseColor ?? '#6d7686') },
    uActiveColor: { value: new THREE.Color(opts.activeColor ?? '#9fd2ff') },
    uBaseOpacity: { value: opts.baseOpacity ?? 0.3 },
    uFogNear: { value: opts.fogNear ?? 120 },
    uFogFar: { value: opts.fogFar ?? 900 },
    uSign: { value: 1 },
    uDim: { value: 1 },
  }
}

export function makeNeuronMaterial(opts: NeuronUniformOptions = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: makeNeuronUniforms(opts),
    vertexShader: NEURON_VERT,
    fragmentShader: NEURON_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}
