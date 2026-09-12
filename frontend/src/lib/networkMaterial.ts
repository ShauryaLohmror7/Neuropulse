import * as THREE from 'three'

/**
 * The network shader.
 *
 * Every vertex knows (a) which neuron it belongs to and (b) how far along that
 * neuron's real cable it sits. Per-neuron state lives in a data texture, so one
 * draw call animates the whole circuit: each neuron ignites at its own time and
 * a wavefront sweeps outward through its actual morphology at a fixed
 * conduction speed.
 *
 * Colour encodes which sensory stream the signal descends from. Hues are kept
 * restrained and desaturated-at-rest so the resting network reads as tissue,
 * not as a chart.
 */

export const NETWORK_VERT = /* glsl */ `
attribute float aGeodesic;
attribute float aSlot;

uniform sampler2D uState;
uniform vec2  uStateSize;

varying float vGeo;
varying float vDepth;
varying vec4  vState;

void main() {
  vGeo = aGeodesic;

  float x = mod(aSlot, uStateSize.x);
  float y = floor(aSlot / uStateSize.x);
  vec2 uv = (vec2(x, y) + 0.5) / uStateSize;
  vState = texture2D(uState, uv);

  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

export const NETWORK_FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uWaveSpeed;     // micrometres per second
uniform float uWaveWidth;
uniform float uBaseOpacity;
uniform float uFogNear;
uniform float uFogFar;
uniform float uGain;
uniform vec3  uRestColor;
uniform vec3  uPalette[10];

varying float vGeo;
varying float vDepth;
varying vec4  vState;

void main() {
  float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);
  fog = clamp(fog, 0.05, 1.0);

  vec3  color = uRestColor;
  float alpha = uBaseOpacity;

  float ignition = vState.r;
  if (ignition >= 0.0) {
    float activation = vState.g;
    int   mi = int(vState.b + 0.5);
    float sign = vState.a;

    float elapsed = max(uTime - ignition, 0.0);
    float front = elapsed * uWaveSpeed;
    float d = vGeo - front;

    // Travelling wavefront: a narrow band sweeping out along the real cable.
    float pulse = exp(-(d * d) / (2.0 * uWaveWidth * uWaveWidth));

    // Sustained glow behind the front, fading as the activation decays.
    float arrived = step(vGeo, front);
    float since = max(elapsed - vGeo / max(uWaveSpeed, 0.001), 0.0);
    float sustain = arrived * activation * exp(-since * 0.42);

    float energy = (sustain + pulse * 1.5) * uGain;

    vec3 hue = uPalette[0];
    for (int i = 0; i < 10; i++) { if (i == mi) hue = uPalette[i]; }
    // Inhibitory transmission reads cool and restrained rather than bright.
    if (sign < 0.0) hue = mix(hue, vec3(0.35, 0.52, 0.85), 0.65) * 0.8;

    color = mix(uRestColor, hue, clamp(energy * 1.4, 0.0, 1.0));
    color += hue * max(energy - 0.85, 0.0) * 1.5;
    alpha = clamp(alpha + energy * 0.8, 0.0, 1.0);
  }

  alpha *= fog;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(color, alpha);
}
`

/** One restrained hue per sensory stream; index 0 is the resting network. */
export const PALETTE: THREE.Color[] = [
  new THREE.Color('#6b7482'), // resting
  new THREE.Color('#7fb2ff'), // vision
  new THREE.Color('#6ff0c0'), // olfaction
  new THREE.Color('#ff9ecb'), // gustation
  new THREE.Color('#ffc98a'), // mechanosensation
  new THREE.Color('#c9a6ff'), // audition
  new THREE.Color('#9fe8ff'), // airflow
  new THREE.Color('#ff8f6b'), // thermosensation
  new THREE.Color('#8fd5ff'), // hygrosensation
  new THREE.Color('#ffffff'), // mixed / convergent
]

export function makeNetworkMaterial(
  stateTexture: THREE.DataTexture,
  stateSize: [number, number],
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uState: { value: stateTexture },
      uStateSize: { value: new THREE.Vector2(stateSize[0], stateSize[1]) },
      uWaveSpeed: { value: 260 },
      uWaveWidth: { value: 12 },
      uBaseOpacity: { value: 0.085 },
      uFogNear: { value: 260 },
      uFogFar: { value: 1500 },
      uGain: { value: 1 },
      uRestColor: { value: new THREE.Color('#5d6675') },
      uPalette: { value: PALETTE },
    },
    vertexShader: NETWORK_VERT,
    fragmentShader: NETWORK_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}
