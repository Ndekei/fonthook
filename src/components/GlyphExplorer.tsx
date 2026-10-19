import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { CAP_HEIGHT, DESCENDER, UNITS_PER_EM, X_HEIGHT } from '../lib/geometry'
import { WEIGHT_MAX, WEIGHT_MIN, weightLabel, type BuiltGlyph } from '../lib/glyphs'
import { commandsToSvg, contourToCommands } from '../lib/trace'

interface Props {
  /** Every character the font is meant to have, in display order. */
  chars: string[]
  built: BuiltGlyph[]
  /** The live preview FontFace family, so the grid shows the real font. */
  fontFamily?: string
  weight: number
  onWeight: (v: number) => void
  onDraw: () => void
}

const METRICS = [
  { label: 'Cap height', y: CAP_HEIGHT },
  { label: 'x-height', y: X_HEIGHT },
  { label: 'Baseline', y: 0 },
  { label: 'Descender', y: DESCENDER },
]

const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`

/** Glyph set overview plus a large inspector, like a type foundry's specimen page. */
export default function GlyphExplorer({ chars, built, fontFamily, weight, onWeight, onDraw }: Props) {
  const byChar = useMemo(() => new Map(built.map((g) => [g.char, g])), [built])
  // The chosen character sets first, then anything drawn outside them.
  const all = useMemo(() => [...chars, ...built.map((g) => g.char).filter((c) => !chars.includes(c))], [chars, built])

  const [selected, setSelected] = useState(() => all.find((c) => byChar.has(c)) ?? all[0])
  const [hovered, setHovered] = useState<string | null>(null)
  const grid = useRef<HTMLDivElement>(null)

  const shown = hovered ?? selected
  const glyph = shown ? byChar.get(shown) : undefined
  const cp = shown ? shown.codePointAt(0)! : 0
  const pct = ((weight - WEIGHT_MIN) / (WEIGHT_MAX - WEIGHT_MIN)) * 100

  const select = (c: string, focus = false) => {
    setSelected(c)
    setHovered(null)
    if (focus) grid.current?.querySelector<HTMLButtonElement>(`[data-char="${CSS.escape(c)}"]`)?.focus()
  }

  // Arrow keys move through the grid; up/down jump a whole row.
  const onKey = (e: KeyboardEvent) => {
    const i = all.indexOf(selected)
    if (i < 0 || !grid.current) return
    const cols = getComputedStyle(grid.current).gridTemplateColumns.split(' ').length
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols, Home: -i, End: all.length - 1 - i }[e.key]
    if (step === undefined) return
    e.preventDefault()
    select(all[Math.min(all.length - 1, Math.max(0, i + step))], true)
  }

  return (
    <section className="glyph-explorer" aria-label="Glyph set overview">
      <div className="gx-panel">
        <div className="gx-head">
          <h2>Glyph set overview</h2>
          <label className="gx-weight">
            <span>Weight</span>
            <input
              type="range"
              min={WEIGHT_MIN}
              max={WEIGHT_MAX}
              step={1}
              value={weight}
              aria-valuetext={weightLabel(weight)}
              style={{ '--pct': `${pct}%` } as React.CSSProperties}
              onChange={(e) => onWeight(+e.target.value)}
            />
            <output>{weightLabel(weight)}</output>
          </label>
        </div>
        <div className="gx-grid" ref={grid} role="listbox" aria-label="Characters" onKeyDown={onKey} onMouseLeave={() => setHovered(null)}>
          {all.map((c) => {
            const drawn = byChar.has(c)
            const on = c === selected
            return (
              <button
                key={c}
                data-char={c}
                role="option"
                aria-selected={on}
                aria-label={`${c}${drawn ? '' : ', not drawn yet'}`}
                tabIndex={on ? 0 : -1}
                className={`gx-cell${on ? ' on' : ''}${drawn ? '' : ' missing'}`}
                style={drawn && fontFamily ? { fontFamily } : undefined}
                onClick={() => select(c)}
                onMouseEnter={() => setHovered(c)}
              >
                {c}
              </button>
            )
          })}
        </div>
      </div>

      <div className="gx-inspector" aria-live="polite">
        <div className="gx-meta">
          <span>Units/Em: {UNITS_PER_EM}</span>
          {shown && (
            <span>
              {hex(cp)} ({cp})
            </span>
          )}
        </div>
        {glyph ? <InspectorGlyph glyph={glyph} /> : <Undrawn char={shown} onDraw={onDraw} />}
        {glyph && (
          <div className="gx-meta">
            <span>Advance width: {glyph.advance}</span>
            <span>{weightLabel(weight)}</span>
          </div>
        )}
      </div>
    </section>
  )
}

// On narrow screens a tighter frame keeps the glyph and the metric labels legible.
function useNarrow() {
  const query = '(max-width: 720px)'
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

function InspectorGlyph({ glyph }: { glyph: BuiltGlyph }) {
  const narrow = useNarrow()
  const d = glyph.contours.map((c) => commandsToSvg(contourToCommands(c))).join('')
  // Fixed vertical frame so every glyph sits on the same metric lines; width follows the glyph.
  const top = CAP_HEIGHT + 260
  const bottom = DESCENDER - 120
  const w = Math.max(glyph.advance + 400, narrow ? 1000 : 1600)
  const x0 = (glyph.advance - w) / 2
  return (
    <svg className="gx-glyph" viewBox={`${x0} ${-top} ${w} ${top - bottom}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Outline of ${glyph.char}`}>
      <g className="gx-lines">
        {METRICS.map((m) => (
          <g key={m.label}>
            <line x1={x0} x2={x0 + w} y1={-m.y} y2={-m.y} />
            <text x={x0 + 24} y={-m.y - 18}>
              {m.label}
            </text>
            <text x={x0 + w - 24} y={-m.y - 18} textAnchor="end">
              {m.y}
            </text>
          </g>
        ))}
      </g>
      <path d={d} transform="scale(1,-1)" fillRule="nonzero" />
    </svg>
  )
}

function Undrawn({ char, onDraw }: { char?: string; onDraw: () => void }) {
  return (
    <div className="gx-empty">
      <span className="gx-empty-char">{char}</span>
      <p>Not drawn yet, so it won't be in the font.</p>
      <button className="btn filled small" onClick={onDraw}>
        Draw it
      </button>
    </div>
  )
}
