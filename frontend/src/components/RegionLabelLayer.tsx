import { useMemo } from 'react'
import { useStore } from '../lib/store'

/**
 * The DOM layer for neuropil labels.
 *
 * Lives outside the canvas so the text is real, crisp DOM rather than a texture.
 * Regions the cascade actually reached are highlighted using the real
 * `regions_reached` list from the simulation.
 *
 * Crowded clusters are thinned by nearest-first distance rejection, so labels
 * never stack into an unreadable pile.
 */
export function RegionLabelLayer() {
  const labels = useStore((s) => s.labels)
  const sim = useStore((s) => s.sim)
  const phase = useStore((s) => s.phase)

  const activeRois = useMemo(
    () => new Set(sim?.result.metrics.regions_reached ?? []),
    [sim],
  )

  const visible = useMemo(() => {
    const kept: typeof labels = []
    for (const l of labels) {
      const clash = kept.some((k) => Math.abs(k.x - l.x) < 128 && Math.abs(k.y - l.y) < 26)
      if (!clash) kept.push(l)
    }
    return kept
  }, [labels])

  if (!visible.length) return null

  return (
    <div className="label-layer" aria-hidden>
      {visible.map((l) => {
        const active = activeRois.has(l.roi)
        const dim = sim && phase !== 'idle' && !active
        return (
          <div
            key={l.roi}
            className={`roi-label${active ? ' active' : ''}${dim ? ' dim' : ''}`}
            style={{ transform: `translate3d(${l.x}px, ${l.y}px, 0)` }}
          >
            <span className="roi-dot" />
            <span className="roi-text">
              <span className="roi-abbr">{l.roi}</span>
              <span className="roi-name">{l.name}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
