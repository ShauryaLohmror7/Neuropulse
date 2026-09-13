import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { groupRegions, sidesLabel } from '../../lib/regions'
import type { SimulationEnvelope } from '../../types/api'

/**
 * Which parts of the brain the cascade reached, in plain language.
 *
 * The region list is the real `regions_reached` set from the simulation — each
 * entry is a MaleCNS primary neuropil that at least one activated neuron has
 * most of its synapses in. The one-line role is standard anatomy; it describes
 * what the region is for, not what our model proved.
 */
export function RegionsPanel({ sim, limit = 7 }: { sim: SimulationEnvelope; limit?: number }) {
  const groups = useMemo(() => {
    const all = groupRegions(sim.result.metrics.regions_reached)
    // Named regions first — an unnamed catch-all tells the viewer nothing.
    return all
      .filter((g) => !g.base.includes('unspecified'))
      .sort((a, b) => (b.role ? 1 : 0) - (a.role ? 1 : 0) || a.name.localeCompare(b.name))
  }, [sim])

  if (!groups.length) return null
  const shown = groups.slice(0, limit)
  const rest = groups.length - shown.length

  return (
    <motion.div
      className="panel regions"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
    >
      <div className="label">Brain regions activated</div>
      {shown.map((g, i) => (
        <motion.div
          className="region-row"
          key={g.base}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i, duration: 0.4 }}
        >
          <div className="region-head">
            <span className="region-name">{g.name}</span>
            <span className="region-side">{sidesLabel(g.sides)}</span>
          </div>
          {g.role && <div className="region-role">{g.role}</div>}
        </motion.div>
      ))}
      {rest > 0 && <div className="region-more">+{rest} more regions</div>}
    </motion.div>
  )
}
