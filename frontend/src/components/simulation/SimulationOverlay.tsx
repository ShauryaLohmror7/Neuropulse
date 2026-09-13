import { AnimatePresence, motion } from 'framer-motion'
import type { SimulationEnvelope } from '../../types/api'

/** Live metrics. Only quantities we can compute honestly from the real graph. */
export function SimulationOverlay({ sim }: { sim: SimulationEnvelope | null }) {
  if (!sim) return null
  const m = sim.result.metrics
  const rows: [string, string][] = [
    ['Sensory systems', String(m.modalities.length)],
    ['Neurons activated', m.neurons_activated.toLocaleString()],
    ['Connections traversed', m.connections_traversed.toLocaleString()],
    ['Synapses traversed', m.total_synapses_traversed.toLocaleString()],
    ['Propagation steps', String(m.propagation_depth)],
    ['Regions reached', String(m.regions_reached.length)],
  ]
  return (
    <AnimatePresence>
      <motion.div
        className="panel metrics"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="label">Real MaleCNS connectome</div>
        {rows.map(([k, v], i) => (
          <motion.div
            className="metric"
            key={k}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.06 * i }}
          >
            <span className="mk">{k}</span>
            <span className="mv">{v}</span>
          </motion.div>
        ))}
        <div className="footnote">
          {sim.rendered_activated} of {m.neurons_activated} activated neurons have overview
          skeletons; measured cell bodies also show activity, and source detail loads on selection
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
