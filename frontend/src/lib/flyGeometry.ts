import * as THREE from 'three'

/**
 * Procedural geometry for the schematic fly body.
 *
 * NOT connectome data — see FlyBody.tsx. What matters here is that the shapes
 * are built from revolved profile curves and jointed segment chains rather than
 * stacked ellipsoids, so the silhouette actually reads as Drosophila: huge
 * compound eyes dominating the head, a humped thorax, a tapering segmented
 * abdomen, and properly articulated legs.
 *
 * All dimensions are micrometres, matching the dataset's own scale.
 */

/**
 * Revolve a radius profile around the local Y axis.
 *
 * `profile` entries are [t along the axis 0..1, radius 0..1]; both are
 * normalised, so `length` and `radius` set the real micrometre dimensions.
 */
function lathe(
  profile: [number, number][],
  length: number,
  radius: number,
  segments = 48,
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = profile.map(
    ([t, r]) => new THREE.Vector2(Math.max(r * radius, 0.01), t * length),
  )
  const g = new THREE.LatheGeometry(pts, segments)
  g.translate(0, -length / 2, 0)
  return g
}

/** Head capsule: broad, slightly flattened front-to-back. */
export function headGeometry(): THREE.BufferGeometry {
  const g = lathe(
    [
      [0.0, 0.02], [0.06, 0.34], [0.16, 0.58], [0.3, 0.79], [0.45, 0.93],
      [0.58, 0.99], [0.72, 0.95], [0.85, 0.78], [0.94, 0.48], [1.0, 0.03],
    ],
    470,
    290,
    56,
  )
  g.scale(1.30, 1.06, 0.94) // wider than tall, shallow front-to-back
  g.rotateX(Math.PI / 2) // axis along Z (anterior-posterior)
  return g
}

/**
 * Compound eye: a deep spherical cap. In Drosophila the eyes wrap most of the
 * lateral head, which is the single strongest cue that a shape is a fly.
 */
export function eyeGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 48, 36, 0, Math.PI * 2, 0, Math.PI * 0.62)
  g.scale(178, 215, 180)
  g.rotateZ(Math.PI / 2)
  return g
}

/** Thorax: egg-shaped with a dorsal hump. */
export function thoraxGeometry(): THREE.BufferGeometry {
  const g = lathe(
    [
      [0.0, 0.05], [0.08, 0.42], [0.2, 0.7], [0.34, 0.88], [0.48, 0.97],
      [0.62, 0.99], [0.76, 0.9], [0.88, 0.68], [0.96, 0.38], [1.0, 0.04],
    ],
    980,
    360,
    56,
  )
  g.scale(0.92, 1.0, 0.9)
  g.rotateX(Math.PI / 2)
  return g
}

/** Abdomen: tapering cone with segment bulges (tergites). */
export function abdomenGeometry(): THREE.BufferGeometry {
  const profile: [number, number][] = []
  const segs = 5
  for (let i = 0; i <= 60; i++) {
    const t = i / 60
    // Overall taper, strong toward the tip.
    const taper = Math.pow(1 - t, 0.42) * (0.45 + 0.55 * Math.sin(Math.min(t * 3.2, 1) * Math.PI * 0.5))
    // Segment ripple so the tergites read as distinct bands.
    const ripple = 1 + 0.05 * Math.cos(t * segs * Math.PI * 2)
    profile.push([t, Math.max(taper * ripple, 0.004)])
  }
  const g = lathe(profile, 1120, 330, 52)
  g.scale(0.86, 0.9, 1.0)
  g.rotateX(-Math.PI / 2)
  return g
}

/** Wing: a real wing outline (narrow at the hinge, broad and rounded distally). */
export function wingGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(160, 84, 820, 150, 1650, 128)
  shape.bezierCurveTo(1900, 112, 1930, 28, 1700, -30)
  shape.bezierCurveTo(1080, -158, 290, -128, 0, 0)
  const g = new THREE.ShapeGeometry(shape, 48)
  g.scale(0.9, 2.2, 1)
  g.rotateX(-Math.PI / 2)
  return g
}

/** Longitudinal wing veins, drawn as line segments over the membrane. */
export function wingVeins(): THREE.BufferGeometry {
  const lines: number[] = []
  const veins: [number, number][][] = [
    [[36, 8], [620, 68], [1330, 86], [1760, 72]],
    [[36, -4], [620, 14], [1330, 18], [1820, 18]],
    [[36, -18], [570, -50], [1240, -68], [1720, -50]],
    [[52, -30], [460, -94], [1050, -122], [1510, -100]],
  ]
  for (const v of veins) {
    for (let i = 0; i < v.length - 1; i++) {
      lines.push(v[i][0], 0, v[i][1], v[i + 1][0], 0, v[i + 1][1])
    }
  }
  // Two cross-veins.
  lines.push(676, 0, 64, 676, 0, -44, 1104, 0, 78, 1104, 0, -58)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3))
  g.scale(0.9, 1, -2.2)
  return g
}

/** A tapered segment used for leg podomeres and the antennal arista. */
export function segmentGeometry(rTop: number, rBottom: number, length: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBottom, length, 12, 1, false)
  g.translate(0, -length / 2, 0)
  return g
}

export interface LegSegment {
  position: [number, number, number]
  rotation: [number, number, number]
  rTop: number
  rBottom: number
  length: number
}

/**
 * One articulated leg: coxa -> femur -> tibia -> tarsus, each hanging from the
 * end of the previous segment so the joints actually line up.
 *
 * `side` is +1 for the fly's left. Angles differ per leg pair the way a real
 * fly stands: forelegs reach forward, hindlegs push back.
 */
export function buildLeg(
  origin: [number, number, number],
  side: number,
  pair: 0 | 1 | 2,
): LegSegment[] {
  const out: LegSegment[] = []
  const [x,y,z] = origin
  const reach = [380, -100, -620][pair]
  const joints = [
    new THREE.Vector3(x,y,z),
    new THREE.Vector3(x + side*75,y-100,z+reach*0.12),
    new THREE.Vector3(side*(510+pair*35),y-90,z+reach*0.65),
    new THREE.Vector3(side*(640+pair*45),-650,z+reach),
    new THREE.Vector3(side*(790+pair*45),-690,z+reach+80),
  ]
  const radii = [20,17,12,6,2]
  for (let i=0;i<joints.length-1;i++) {
    const dir = joints[i+1].clone().sub(joints[i])
    const length = dir.length()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),dir.normalize())
    const e = new THREE.Euler().setFromQuaternion(q)
    out.push({position:joints[i].toArray() as [number,number,number], rotation:[e.x,e.y,e.z],rTop:radii[i],rBottom:radii[i+1],length})
  }
  return out
}

/** Antenna: a small funiculus with the feathered arista projecting forward. */
export function antennaGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 20, 16)
  g.scale(46, 54, 70)
  return g
}
