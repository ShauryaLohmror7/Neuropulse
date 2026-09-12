import { motion } from 'framer-motion'
import { useStore, type ViewMode } from '../lib/store'

const MODES: { key: ViewMode; label: string }[] = [
  { key: 'fly', label: 'Fly' },
  { key: 'brain', label: 'Brain' },
]

export function ViewToggle() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  return (
    <div className="view-toggle" role="group" aria-label="View mode">
      {MODES.map((m) => (
        <button
          key={m.key}
          className={view === m.key ? 'on' : ''}
          onClick={() => setView(m.key)}
          aria-pressed={view === m.key}
        >
          {view === m.key && (
            <motion.span className="pill" layoutId="view-pill" transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} />
          )}
          <span className="txt">{m.label}</span>
        </button>
      ))}
    </div>
  )
}
