import * as THREE from 'three'

/**
 * Specimen shell material.
 *
 * The earlier version used additive blending, which made overlapping body parts
 * pile up into bright soap bubbles. This uses normal alpha blending with no
 * depth write: a very dark interior that lets the real nervous system show
 * through, plus a rim term that traces the silhouette so the form reads.
 *
 * The result is a dark glass specimen — present enough to give the neurons a
 * body, quiet enough that it never competes with them.
 */
export function makeBodyMaterial(opts: {
  color?: THREE.ColorRepresentation
  rim?: THREE.ColorRepresentation
  opacity?: number
  rimStrength?: number
  rimPower?: number
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(opts.color ?? '#0d1016') },
      uRim: { value: new THREE.Color(opts.rim ?? '#8fa4c4') },
      uOpacity: { value: opts.opacity ?? 0.22 },
      uRimStrength: { value: opts.rimStrength ?? 1 },
      uRimPower: { value: opts.rimPower ?? 2.6 },
      uFade: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vDepth;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3  uColor;
      uniform vec3  uRim;
      uniform float uOpacity;
      uniform float uRimStrength;
      uniform float uRimPower;
      uniform float uFade;
      varying vec3  vNormal;
      varying vec3  vView;
      varying float vDepth;

      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(vView);
        float facing = abs(dot(n, v));

        // Rim: strong where the surface turns away from the viewer.
        float rim = pow(1.0 - facing, uRimPower);

        // A soft key from upper-front so the volume is legible, kept very low
        // so the body never looks lit like a product render.
        float key = max(dot(n, normalize(vec3(0.35, 0.75, 0.55))), 0.0);

        vec3 col = uColor + uRim * rim * uRimStrength + uRim * key * 0.06;
        float a = (uOpacity * (0.35 + facing * 0.35) + rim * 0.55 * uRimStrength) * uFade;

        // Distance fade keeps far body parts from crowding the silhouette.
        a *= mix(1.0, 0.55, smoothstep(1800.0, 5200.0, vDepth));

        if (a < 0.004) discard;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  })
}

/**
 * Compound-eye material: a faint ommatidial lattice.
 *
 * The hex grid is procedural and cosmetic — it is a visual cue that this is a
 * fly eye, not a measurement of ommatidia.
 */
export function makeEyeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#1d1016') },
      uRim: { value: new THREE.Color('#a8606f') },
      uFade: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vPos;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        vPos = position;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3  uColor;
      uniform vec3  uRim;
      uniform float uFade;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vPos;

      // Hex distance field over a plane, used for the ommatidial lattice.
      float hex(vec2 p) {
        p = abs(p);
        return max(p.x * 0.866 + p.y * 0.5, p.y);
      }

      void main() {
        vec3 n = normalize(vNormal);
        float facing = abs(dot(n, normalize(vView)));
        float rim = pow(1.0 - facing, 2.2);

        vec2 uv = vPos.yz * 0.055;
        vec2 r = vec2(1.0, 1.732);
        vec2 h = r * 0.5;
        vec2 a = mod(uv, r) - h;
        vec2 b = mod(uv - h, r) - h;
        vec2 g = dot(a, a) < dot(b, b) ? a : b;
        float cell = hex(g);
        float lattice = smoothstep(0.34, 0.5, cell);

        vec3 col = uColor + uRim * (rim * 0.85 + lattice * 0.14);
        // Kept low so the optic lobes stay visible through the eye.
        float alpha = (0.12 + rim * 0.42 + lattice * 0.05) * uFade;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  })
}
