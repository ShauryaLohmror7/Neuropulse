import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ModelledResponse } from '../../types/api'

/**
 * The modelled behavioural tendency.
 *
 * Every word here is hedged on purpose: this is what the simplified model did to
 * real, identified output neurons, read against published physiology. It is not
 * an observation.
 */
export function ResponsePanel({ response, playing=false }: { response: ModelledResponse | null; playing?:boolean }) {
  const reduced = useReducedMotion()
  if (!response) return null
  const none = response.confidence === 'NONE'
  const suggestion = none ? response.ai_hypothesis : null
  return (
    <AnimatePresence>
      <motion.div
        className="panel response"
        initial={{ opacity: 0, y: reduced ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 14 }}
        transition={{ duration: reduced ? 0 : 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      >
        <div className="label">{suggestion ? (suggestion.kind==='clarification' ? 'AI · CLARIFICATION NEEDED' : 'AI-SUGGESTED ACTION') : response.interpretation_kind === 'partial_marker' ? 'RESULT · MOVEMENT UNRESOLVED' : response.interpretation_kind === 'no_input' ? 'RESULT · MORE CONTEXT NEEDED' : none ? 'RESULT · SENSORY ACTIVITY' : 'RESULT · POSSIBLE ACTION'}</div>
        <div className={`headline ${none ? 'none' : ''}`}>{suggestion?.action ?? response.headline.replace(' tendency (modeled)', '')}</div>
        {playing && <p className="computed-note">Computed result · the animation is replaying the recorded model states.</p>}
        {suggestion ? <><p className="plain-outcome">{suggestion.rationale}</p><p className="computed-note">{suggestion.evidence_level} Brain highlights show the simulation only.</p></> : response.plain_language && <p className="plain-outcome">{response.plain_language}</p>}
        {response.ai_notice && <p className="computed-note" role="status">{response.ai_notice}</p>}
        <details className="response-evidence result-evidence"><summary>{suggestion ? 'AI assumptions & actual model result' : 'Why this result?'}</summary>
        {suggestion && <><p>{suggestion.activity_observation}</p><p>{suggestion.provider} · {suggestion.model}</p>{suggestion.assumptions.map((a,i)=><p key={i}>Assumption: {a}</p>)}{suggestion.evidence_body_ids?.length ? <p>Verified reached neuron IDs: {suggestion.evidence_body_ids.join(', ')}</p> : null}{suggestion.verified_activity?.map(a=><p key={a.body_id}>{a.type ?? a.class ?? 'Neuron'} · ID {a.body_id} · step {a.first_step ?? '—'} · model peak {a.peak_model_activity?.toFixed(3) ?? '—'}</p>)}<b>Actual model result: {response.headline}</b><p>{response.plain_language}</p></>}
        {response.detail && <div className="detail">{response.detail}</div>}
        {!!response.neural_summary?.length && <details className="response-evidence"><summary>What the network did</summary>{response.neural_summary.map(line=><p key={line}>{line}</p>)}</details>}
        {!!response.output_evidence?.length && <details className="response-evidence"><summary>Which action circuits were tested?</summary>{response.output_evidence.map(c=><div className="output-channel" key={c.label}><b>{c.label}</b><span>{c.reached}/{c.available} marker neurons reached · {c.engaged?'engagement criteria met':'below engagement criteria'}</span><small>{c.marker_types.join(', ')} · peak model activity {c.peak.toFixed(3)}</small></div>)}<p>These {response.output_evidence.length} monitored circuits cover only part of the fly’s behavior. No calibrated action probability is available.</p></details>}
        {!!response.limitations?.length && <details className="response-evidence"><summary>What this input leaves uncertain</summary>{response.limitations.map((line,i)=><p key={i}>{line}</p>)}</details>}
        {response.competing.length > 0 && (
          <div className="competing">Competing: {response.competing.join(' · ')}</div>
        )}
        </details>
        {!none && (
          <div className="tier">
            Circuit association: {response.confidence.toLowerCase()} · prediction unvalidated
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
