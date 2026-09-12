import { AnimatePresence, motion } from 'framer-motion'
import type { ModelledResponse } from '../../types/api'

/**
 * The modelled behavioural tendency.
 *
 * Every word here is hedged on purpose: this is what the simplified model did to
 * real, identified output neurons, read against published physiology. It is not
 * an observation.
 */
export function ResponsePanel({ response }: { response: ModelledResponse | null }) {
  if (!response) return null
  const none = response.confidence === 'NONE'
  return (
    <AnimatePresence>
      <motion.div
        className="panel response"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 14 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      >
        <div className="label">Modelled response</div>
        <div className={`headline ${none ? 'none' : ''}`}>{response.headline}</div>
        {response.detail && <div className="detail">{response.detail}</div>}
        {response.competing.length > 0 && (
          <div className="competing">Competing: {response.competing.join(' · ')}</div>
        )}
        {!none && (
          <div className="tier">
            evidence: {response.confidence.toLowerCase()} · inferred, not observed
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
