import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useStore } from '../../lib/store'

const PRESETS: { label: string; text: string }[] = [
  {label:'Threat + food',text:'A hungry fly smells ripe fruit while a dark object rapidly approaches from its left.'},
  {label:'Antenna cleaning',text:'Something repeatedly touches the fly’s left antenna.'},
  {label:'Flashing lights',text:'The lights repeatedly turn on and off.'},
  {label:'Social encounter',text:'A female crosses its view while it drinks sugar.'},
  {label:'Rain',text:'Raindrops repeatedly hit the fly’s body in humid air.'},
  {label:'Sound + wind',text:'It hears a courtship song while a breeze blows across its antennae.'},
  {label:'Heat',text:'The air around the fly suddenly becomes hot.'},
  {label:'Absent stimulus',text:'Nothing touches its antenna, but it hears a courtship song.'},
]

export function ExperienceInput({ onSimulate, disabled = false }: { onSimulate: (text: string) => void; disabled?: boolean }) {
  const reduced = useReducedMotion()
  const text = useStore((s) => s.text)
  const setText = useStore((s) => s.setText)
  const phase = useStore((s) => s.phase)
  const [focused, setFocused] = useState(false)
  const busy = phase === 'compiling' || phase === 'transition' || phase === 'propagating'

  return (
    <motion.div
      className="input-block"
      initial={{ opacity: 0, y: reduced ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <label className="eyebrow" htmlFor="experience">DESCRIBE A MOMENT</label>
      <div className={`field ${focused ? 'focused' : ''}`}>
        <textarea
          id="experience"
          rows={4}
          maxLength={600}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim() && !busy && !disabled) { e.preventDefault(); onSimulate(text) }
          }}
          placeholder="Describe an experience…"
          spellCheck={false}
          aria-label="Describe an experience for the fly"
        />
        <button
          className="simulate"
          disabled={disabled || !text.trim() || busy}
          onClick={() => onSimulate(text)}
        >
          {busy ? 'Simulating' : 'Simulate experience'} <span aria-hidden="true">↗</span>
        </button>
      </div>
      <p className="input-scope">Describe freely · mappings have scientific limits · {text.length}/600</p>
      <div className="preset-label">A FEW PLACES TO BEGIN</div>
      <div className="presets">
        {PRESETS.map((p, i) => (
          <button key={p.label} onClick={() => setText(p.text)} disabled={busy}>
            <span className="preset-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</span><span>{p.label}</span><span className="preset-arrow" aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}
