import { BorderBeam } from '../ui/BorderBeam'
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
        <BorderBeam/>
        <div className="label">{response.interpretation_kind === 'partial_marker' ? 'ACTION CIRCUIT · PARTIAL RESPONSE' : response.interpretation_kind === 'no_input' ? 'INPUT NOT YET SUPPORTED' : none ? 'SENSORY RESPONSE · ACTION NOT RESOLVED' : 'POSSIBLE FLY ACTION · MODELED'}</div>
        <div className={`headline ${none ? 'none' : ''}`}>{response.headline.replace(' tendency (modeled)', '')}</div>
        {response.detail && <div className="detail">{response.detail}</div>}
        {!!response.neural_summary?.length && <div className="response-evidence"><h4>What the network did</h4>{response.neural_summary.map(line=><p key={line}>{line}</p>)}</div>}
        {!!response.output_evidence?.length && <details className="response-evidence"><summary>Which action circuits were tested?</summary>{response.output_evidence.map(c=><div className="output-channel" key={c.label}><b>{c.label}</b><span>{c.reached}/{c.available} marker neurons reached · {c.engaged?'engagement criteria met':'below engagement criteria'}</span><small>{c.marker_types.join(', ')} · peak model activity {c.peak.toFixed(3)}</small></div>)}<p>These {response.output_evidence.length} monitored circuits cover only part of the fly’s behavior. No calibrated action probability is available.</p></details>}
        {!!response.limitations?.length && <details className="response-evidence"><summary>What this input leaves uncertain</summary>{response.limitations.map((line,i)=><p key={i}>{line}</p>)}</details>}
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
