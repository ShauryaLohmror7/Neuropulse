import { AnimatePresence, motion } from 'framer-motion'
import type { CompiledExperience } from '../../types/api'

const QUALITY_LABEL: Record<string, string> = {
  SUPPORTED_REAL_MAPPING: 'supported',
  APPROXIMATE_MAPPING: 'approximate',
  UNSUPPORTED: 'unsupported',
}

/** The compiler's reading of the sentence. Deliberately small and quiet. */
export function ExperienceBreakdown({ experience }: { experience: CompiledExperience | null }) {
  if (!experience) return null
  const contextOnly = experience.unmapped

  return (
    <AnimatePresence>
      <motion.div
        className="panel breakdown"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="label">Experience decomposition</div>

        {experience.components.map((c, i) => (
          <motion.div
            key={c.stimulus}
            className="item"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.09 * i, duration: 0.45 }}
          >
            <span className={`dot m-${c.modality}`} />
            <div className="item-body">
              <div className="item-head">
                <span className="modality">{c.modality}</span>
                {c.direction && <span className="direction">{c.direction}</span>}
              </div>
              <div className="stimulus">{c.label}</div>
              <div className={`quality q-${c.mapping_quality}`}>
                {QUALITY_LABEL[c.mapping_quality]} · {c.neuron_count} neurons
              </div>
              {c.caveat && <p className="mapping-caveat">{c.caveat}</p>}
            </div>
          </motion.div>
        ))}

        {contextOnly.map((u) => (
          <div className="item muted" key={u.concept ?? u.text}>
            <span className="dot m-internal_state" />
            <div className="item-body">
              <div className="item-head">
                <span className="modality">{u.reason === 'NO_SENSORY_MATCH' ? 'unmapped' : 'context'}</span>
              </div>
              <div className="stimulus">{u.label ?? u.text}</div>
              <div className="quality q-UNSUPPORTED">{u.reason === 'NEGATED' ? 'Absent · not simulated' : u.reason === 'NO_SENSORY_MATCH' ? 'No supported mapping · not simulated' : 'Recognised · not simulated'}</div>
            </div>
          </div>
        ))}

        {experience.note && <div className="note">{experience.note}</div>}
      </motion.div>
    </AnimatePresence>
  )
}
