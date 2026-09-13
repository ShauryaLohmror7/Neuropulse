import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../lib/store'

export const PRESETS: { label: string; text: string }[] = [
  {
    label: 'Predator + food',
    text: 'A hungry fly smells ripe fruit while a dark object rapidly approaches from its left.',
  },
  { label: 'Touch', text: "Something suddenly touches the fly's left antenna." },
  { label: 'Sweet landing', text: 'The fly lands on a sweet surface and begins tasting sugar.' },
  {
    label: 'Multisensory',
    text: 'The fly smells food, feels a vibration underneath it, and sees motion on its right.',
  },
]

export function ExperienceInput({ onSimulate, disabled = false }: { onSimulate: (text: string) => void; disabled?: boolean }) {
  const text = useStore((s) => s.text)
  const setText = useStore((s) => s.setText)
  const phase = useStore((s) => s.phase)
  const [focused, setFocused] = useState(false)
  const busy = phase === 'compiling' || phase === 'transition' || phase === 'propagating'

  return (
    <motion.div
      className="input-block"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
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
      <p className="input-scope">Free-form text · supported sensory cues only · {text.length}/600</p>
      <div className="preset-label">OR TRY A SENSORY SCENARIO</div>
      <div className="presets">
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => setText(p.text)} disabled={busy}>
            {p.label}
          </button>
        ))}
      </div>
    </motion.div>
  )
}
