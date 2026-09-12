import * as THREE from 'three'

/**
 * Translucent neuropil shell.
 *
 * Rim-weighted transparency: surfaces facing the camera nearly vanish while
 * grazing angles pick up a faint edge, so the neuropils read as glass volumes
 * that reveal the neurons inside rather than as opaque blobs. Front faces are
 * culled and depth writing is off so nothing occludes the network.
 */
export function makeAnatomyMaterial(color: THREE.ColorRepresentation, strength = 1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uStrength: { value: strength },
      uOpacity: { value: 0.1 },
      uFresnel: { value: 2.1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3  uColor;
      uniform float uStrength;
      uniform float uOpacity;
      uniform float uFresnel;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float f = 1.0 - abs(dot(normalize(vNormal), normalize(vView)));
        f = pow(clamp(f, 0.0, 1.0), uFresnel);
        float a = uOpacity * (0.18 + f * 1.5) * uStrength;
        if (a < 0.002) discard;
        gl_FragColor = vec4(uColor * (0.55 + f * 0.9), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  })
}

/** Restrained, near-monochrome tints so anatomy never competes with activity. */
export const GROUP_TINT: Record<string, string> = {
  optic: '#3f5c78',
  olfactory: '#3e6b60',
  mushroom_body: '#4a4a68',
  central_complex: '#55506e',
  lateral_protocerebrum: '#3d5470',
  mechanosensory: '#5a4f63',
  gnathal: '#4c4a5c',
  superior: '#404a60',
  vnc: '#38465c',
}
