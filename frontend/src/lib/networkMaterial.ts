import * as THREE from 'three'
import { STEP_DURATION } from './store'

/**
 * The network shader.
 *
 * Every vertex knows (a) which neuron it belongs to and (b) how far along that
 * neuron's real cable it sits. Per-neuron state lives in a data texture, so one
 * draw call animates the whole circuit: each neuron ignites at its own time and
 * a wavefront sweeps outward through its actual morphology at an illustrative
 * display speed, not a biological conduction speed.
 *
 * Colour encodes which sensory stream the signal descends from. Hues are kept
 * restrained and desaturated-at-rest so the resting network reads as tissue,
 * not as a chart.
 */

export const NETWORK_VERT = /* glsl */ `
attribute float aGeodesic;
attribute float aExtent;
attribute float aSlot;
attribute vec3  aTint;

uniform sampler2D uState;
uniform vec2  uStateSize;

varying float vGeo;
varying float vDepth;
varying vec4  vState;
varying vec3  vTint;
varying float vZ;
varying float vSlot;

void main() {
  vSlot = aSlot;
  vGeo = aGeodesic / max(aExtent, 1.0);
  vTint = aTint;
  vZ = position.z;

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

uniform float uCinematic;
uniform float uSummary; // static peak-activity summary, no repeated firing
uniform float uTime;
uniform float uWaveSpeed;     // normalized cable extent per display second; illustrative pacing
uniform float uWaveWidth;
uniform float uBaseOpacity;
uniform float uFogNear;
uniform float uFogFar;
uniform float uGain;
uniform float uRestMix;     // how strongly class colour shows at rest
uniform vec3  uRestColor;
uniform vec3  uPalette[10];
uniform float uDimUnactivated;
uniform float uClipZ;      // fade out everything posterior to this plane
uniform float uClipSoft;
uniform float uSelectedSlot;
varying float vSlot;

varying float vGeo;
varying float vDepth;
varying vec4  vState;
varying vec3  vTint;
varying float vZ;

void main() {
  // Brain view isolates the brain: the ventral nerve cord sits posterior of the
  // clip plane in the dataset's own frame and fades out entirely.
  float keep = (1.0 - smoothstep(uClipZ - uClipSoft, uClipZ + uClipSoft, vZ));
  if (keep < 0.004) discard;
  float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);
  fog = clamp(fog, 0.12, 1.0);

  // At rest the neuron already carries its own class colour, the way
  // reconstructions of this dataset are conventionally displayed. Activity then
  // rides on top of that rather than replacing it.
  vec3  color = mix(uRestColor, vTint, uRestMix);
  float alpha = uBaseOpacity;

  float ignition = vState.r;
  if (ignition >= 0.0 && uTime >= ignition) {
    // Display-only contrast curve: zero remains zero; model values are untouched.
    float activation = sqrt(max(vState.g, 0.0));
    int   mi = int(vState.b + 0.5);
    float sign = vState.a;

    float elapsed = max(uTime - ignition, 0.0);
    float front = elapsed * uWaveSpeed;
    float d = vGeo - front;

    // Travelling wavefront: a narrow band sweeping out along the real cable.
    float pulse = exp(-(d * d) / (2.0 * uWaveWidth * uWaveWidth));

    // A short trail behind the front, decaying quickly. Slow decay made every
    // active arbor hold a glow simultaneously, which saturated the dense central
    // brain into a white mass. A fast trail keeps the moving front legible.
    float arrived = step(vGeo, front);
    float since = max(elapsed - vGeo / max(uWaveSpeed, 0.001), 0.0);
    float trail = arrived * activation * exp(-since * 1.35) * 0.55;
    // A faint permanent mark so a viewer can still see which cells took part.
    float residue = arrived * activation * 0.1;

    float energy = min((0.38 * activation + trail + residue + pulse * activation * 2.2) * uGain, 1.5);
    if (uSummary > 0.5) energy = activation * 0.8 * uGain;

    vec3 hue = uPalette[0];
    for (int i = 0; i < 10; i++) { if (i == mi) hue = uPalette[i]; }
    // Blend the stream hue with the cell's own class colour so identity is
    // never completely washed out by activity.
    hue = mix(hue, vTint, 0.16);
    // Inhibitory transmission reads cool and restrained rather than bright.
    if (sign < 0.0) hue = mix(hue, vec3(0.35, 0.52, 0.85), 0.6) * 0.85;

    color = mix(color, hue, clamp(energy * 1.6, 0.0, 1.0));
    color += hue * max(energy - 0.9, 0.0) * 1.2;
    // One luminous core for the recorded event, following the source cable.
    // Styling adds no events, connections, or biological timing assumptions.
    float core = exp(-(d*d) / (2.0 * 0.009 * 0.009));
    float halo = exp(-(d*d) / (2.0 * 0.065 * 0.065));
    float flare = (core * 2.8 + halo * 0.32) * activation * uGain * uCinematic;
    if (uSummary > 0.5) flare = activation * uGain * uCinematic * 0.24;
    color += mix(hue, vec3(0.82, 0.98, 1.0), 0.48) * flare;
    alpha = clamp(alpha + energy * 0.55 + flare * 0.16, 0.0, 0.95);
  } else {
    // Once a cascade is running, quiet cells recede so the active path reads.
    alpha *= uDimUnactivated;
    color *= mix(1.0, 0.75, 1.0 - uDimUnactivated);
  }

  if (abs(vSlot - uSelectedSlot) < 0.1) { color = vec3(0.72, 1.0, 0.87); alpha = 0.95; }
  alpha *= fog * keep;
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
      uCinematic: { value: 1 },
      uSummary: { value: 0 },
    uTime: { value: 0 },
      uSelectedSlot: { value: -1 },
      uState: { value: stateTexture },
      uStateSize: { value: new THREE.Vector2(stateSize[0], stateSize[1]) },
      uWaveSpeed: { value: 1 / (STEP_DURATION * 0.85) },
      uWaveWidth: { value: 0.035 },
      uBaseOpacity: { value: 0.022 },
      uFogNear: { value: 420 },
      uFogFar: { value: 2600 },
      uGain: { value: 1 },
      uRestMix: { value: 0.92 },
      uDimUnactivated: { value: 1 },
      uClipZ: { value: 1e6 },
      uClipSoft: { value: 90 },
      uRestColor: { value: new THREE.Color('#7b869b') },
      uPalette: { value: PALETTE },
    },
    vertexShader: NETWORK_VERT,
    fragmentShader: NETWORK_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
  })
}
