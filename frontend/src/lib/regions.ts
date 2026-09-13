/**
 * Human-readable names for MaleCNS neuropils.
 *
 * The keys are the dataset's own ROI identifiers; the values are the standard
 * names from the Drosophila neuroanatomy nomenclature (Ito et al. 2014, and the
 * MANC/VNC nomenclature for the ventral nerve cord). Nothing here is invented —
 * this is a lookup table for abbreviations the dataset already uses.
 */
export const REGION_NAMES: Record<string, string> = {
  ME: 'Medulla',
  AME: 'Accessory medulla',
  LO: 'Lobula',
  LOP: 'Lobula plate',
  LA: 'Lamina',
  AL: 'Antennal lobe',
  CA: 'Mushroom body calyx',
  PED: 'Mushroom body peduncle',
  aL: "Mushroom body α lobe",
  "a'L": "Mushroom body α' lobe",
  bL: 'Mushroom body β lobe',
  "b'L": "Mushroom body β' lobe",
  gL: 'Mushroom body γ lobe',
  FB: 'Fan-shaped body',
  EB: 'Ellipsoid body',
  PB: 'Protocerebral bridge',
  NO: 'Noduli',
  AB: 'Asymmetrical body',
  PVLP: 'Posterior ventrolateral protocerebrum',
  AVLP: 'Anterior ventrolateral protocerebrum',
  PLP: 'Posterior lateral protocerebrum',
  AOTU: 'Anterior optic tubercle',
  LH: 'Lateral horn',
  SLP: 'Superior lateral protocerebrum',
  SMP: 'Superior medial protocerebrum',
  SIP: 'Superior intermediate protocerebrum',
  CRE: 'Crepine',
  LAL: 'Lateral accessory lobe',
  ICL: 'Inferior clamp',
  SCL: 'Superior clamp',
  IPS: 'Inferior posterior slope',
  SPS: 'Superior posterior slope',
  ATL: 'Antler',
  BU: 'Bulb',
  EPA: 'Epaulette',
  GOR: 'Gorget',
  IB: 'Inferior bridge',
  VES: 'Vest',
  WED: 'Wedge',
  AMMC: 'Antennal mechanosensory and motor centre',
  SAD: 'Saddle',
  FLA: 'Flange',
  CAN: 'Cantle',
  PRW: 'Prow',
  GNG: 'Gnathal ganglia',
  ANm: 'Abdominal neuromere',
  IntTct: 'Intermediate tectulum',
  LTct: 'Lower tectulum',
  Ov: 'Ovoid',
  'LegNp(T1)': 'Prothoracic leg neuropil',
  'LegNp(T2)': 'Mesothoracic leg neuropil',
  'LegNp(T3)': 'Metathoracic leg neuropil',
  'NTct(UTct-T1)': 'Neck tectulum',
  'WTct(UTct-T2)': 'Wing tectulum',
  'HTct(UTct-T3)': 'Haltere tectulum',
  mVAC: 'Medial ventral association centre',
}

/** Strip the (L)/(R) suffix to look up the base neuropil name. */
export function baseRoi(roi: string): string {
  return roi.replace(/\((L|R)\)$/, '')
}

export function regionName(roi: string): string {
  return REGION_NAMES[baseRoi(roi)] ?? baseRoi(roi)
}

export function regionSide(roi: string): 'L' | 'R' | null {
  const m = roi.match(/\((L|R)\)$/)
  return m ? (m[1] as 'L' | 'R') : null
}

/**
 * One plain-English line per neuropil: what this part of the brain is for.
 *
 * These are standard functional descriptions from the Drosophila neuroanatomy
 * literature, kept deliberately short. They describe what a region is known to
 * do; they say nothing about what our model did to it.
 */
export const REGION_ROLE: Record<string, string> = {
  ME: 'First-stage visual processing',
  AME: 'Circadian light input',
  LO: 'Visual feature detection',
  LOP: 'Motion and looming detection',
  LA: 'Photoreceptor input layer',
  AL: 'Smell processing — first olfactory relay',
  CA: 'Mushroom body input — learning and memory',
  PED: 'Mushroom body axon tract',
  aL: 'Mushroom body output — memory',
  bL: 'Mushroom body output — memory',
  gL: 'Mushroom body output — short-term memory',
  FB: 'Central complex — navigation and action selection',
  EB: 'Central complex — heading direction',
  PB: 'Central complex — heading computation',
  NO: 'Central complex — turning signals',
  AB: 'Central complex accessory region',
  PVLP: 'Visual projection target — looming and escape',
  AVLP: 'Multisensory integration',
  PLP: 'Visual and mechanosensory integration',
  AOTU: 'Visual feature relay',
  LH: 'Innate odour valence — attraction and avoidance',
  SLP: 'Higher-order olfactory and visual integration',
  SMP: 'State and modulatory integration',
  SIP: 'Higher-order integration',
  CRE: 'Motor-related integration',
  LAL: 'Premotor steering hub',
  ICL: 'Descending pathway relay',
  SCL: 'Higher-order relay',
  IPS: 'Premotor and descending relay',
  SPS: 'Visual to premotor relay',
  ATL: 'Central complex input relay',
  BU: 'Visual input to heading system',
  EPA: 'Premotor relay',
  GOR: 'Premotor relay',
  IB: 'Central relay',
  VES: 'Mechanosensory and premotor relay',
  WED: 'Antennal mechanosensation — wind and sound',
  AMMC: 'Antennal mechanosensation — hearing and touch',
  SAD: 'Mechanosensory and taste relay',
  FLA: 'Feeding-related relay',
  CAN: 'Feeding and proboscis control',
  PRW: 'Taste input region',
  GNG: 'Taste, feeding and descending motor control',
  ANm: 'Abdominal motor control',
  IntTct: 'Flight and leg coordination',
  LTct: 'Leg motor coordination',
  Ov: 'Reproductive motor control',
  'LegNp(T1)': 'Front leg sensory and motor',
  'LegNp(T2)': 'Middle leg sensory and motor',
  'LegNp(T3)': 'Hind leg sensory and motor',
  'NTct(UTct-T1)': 'Neck motor control',
  'WTct(UTct-T2)': 'Wing motor control — flight',
  'HTct(UTct-T3)': 'Haltere input — flight stabilisation',
  mVAC: 'Leg proprioception',
}

export function regionRole(roi: string): string | null {
  return REGION_ROLE[baseRoi(roi)] ?? null
}

/**
 * Group left/right pairs of the same neuropil so a readout says
 * "Antennal lobe — left and right" instead of listing AL(L) and AL(R).
 */
export function groupRegions(rois: string[]): {
  base: string
  name: string
  role: string | null
  sides: string[]
}[] {
  const map = new Map<string, { base: string; name: string; role: string | null; sides: string[] }>()
  for (const roi of rois) {
    const base = baseRoi(roi)
    const side = regionSide(roi)
    const e = map.get(base) ?? { base, name: regionName(roi), role: regionRole(roi), sides: [] }
    if (side && !e.sides.includes(side)) e.sides.push(side)
    map.set(base, e)
  }
  return [...map.values()].map((e) => ({ ...e, sides: e.sides.sort() }))
}

export function sidesLabel(sides: string[]): string {
  if (sides.length === 0) return 'midline'
  if (sides.length === 2) return 'both sides'
  return sides[0] === 'L' ? 'left' : 'right'
}

/**
 * Neuropils worth labelling in the scene. Chosen because they are either a
 * sensory entry point NEUROPULSE stimulates, or a landmark that orients the
 * viewer. Labelling all 144 primary ROIs would be unreadable.
 */
export const LABELLED_ROIS = [
  'ME(L)', 'ME(R)',
  'LO(L)', 'LO(R)',
  'LOP(L)', 'LOP(R)',
  'AL(L)', 'AL(R)',
  'CA(L)', 'CA(R)',
  'FB', 'EB',
  'PVLP(L)', 'PVLP(R)',
  'AVLP(L)', 'AVLP(R)',
  'AMMC(L)', 'AMMC(R)',
  'WED(L)', 'WED(R)',
  'GNG',
  'LegNp(T1)(L)', 'LegNp(T2)(L)', 'LegNp(T3)(L)',
  'ANm',
]
