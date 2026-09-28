import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SetProject } from '../App'
import type { Bitmap } from '../lib/bitmap'
import { ASCENDER, CELL, DESCENDER, GUIDE } from '../lib/geometry'
import { buildGlyph, newRecord, type BuiltGlyph } from '../lib/glyphs'
import type { Project } from '../lib/project'
import { bitmapPath, flatten, paintInk, strokeHit, type Stroke } from '../lib/strokes'
import { commandsToSvg, contourToCommands } from '../lib/trace'
import GlyphOutline from './GlyphOutline'

interface Props {
  char: string
  chars: string[]
  project: Project
  setProject: SetProject
  onNavigate: (ch: string) => void
  onClose: () => void
}

type Tool = 'pen' | 'eraser' | 'remove'

interface Doc {
  base: Bitmap | undefined
  strokes: Stroke[]
}

interface Brush {
  size: number
  steadiness: number
  thinning: number
  ghost: boolean
  onion: boolean
}

const BRUSH_KEY = 'fonte-generer-brush'
const DEFAULT_BRUSH: Brush = { size: 14, steadiness: 0.5, thinning: 0.55, ghost: true, onion: true }

function loadBrush(): Brush {
  try {
    return { ...DEFAULT_BRUSH, ...JSON.parse(localStorage.getItem(BRUSH_KEY) ?? '{}') }
  } catch {
    return DEFAULT_BRUSH
  }
}

const INK = '#15141a'

export default function GlyphEditor({ char, chars, project, setProject, onNavigate, onClose }: Props) {
  const rec = project.glyphs[char]
  const [doc, setDoc] = useState<Doc>(() =>
    rec?.strokes ? { base: rec.base, strokes: rec.strokes } : { base: rec?.bitmap, strokes: [] },
  )
  const [tool, setTool] = useState<Tool>('pen')
  const [brush, setBrushState] = useState<Brush>(loadBrush)
  const [word, setWord] = useState('hamburgefonts')
  const past = useRef<Doc[]>([])
  const future = useRef<Doc[]>([])
  const [, bump] = useState(0) // re-render when history changes (button enabled states)

  const area = useRef<HTMLDivElement>(null)
  const bg = useRef<HTMLCanvasElement>(null)
  const ink = useRef<HTMLCanvasElement>(null)
  const cursor = useRef<HTMLDivElement>(null)
  const [cssSize, setCssSize] = useState(0)
  const live = useRef<Stroke | null>(null)
  const removing = useRef<Doc | null>(null)
  const removeStart = useRef<Doc | null>(null)
  const penSeen = useRef(false)
  const frame = useRef(0)

  const setBrush = (patch: Partial<Brush>) =>
    setBrushState((b) => {
      const n = { ...b, ...patch }
      try {
        localStorage.setItem(BRUSH_KEY, JSON.stringify(n))
      } catch {
        /* ignore */
      }
      return n
    })

  // Track the on-screen size so both canvases render at full device resolution.
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    const ro = new ResizeObserver(() => setCssSize(el.clientWidth))
    ro.observe(el)
    setCssSize(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const prepare = (c: HTMLCanvasElement | null) => {
    if (!c || !cssSize) return null
    const dpr = window.devicePixelRatio || 1
    const px = Math.round(cssSize * dpr)
    if (c.width !== px) c.width = c.height = px
    const ctx = c.getContext('2d')!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, px, px)
    ctx.setTransform(px / CELL, 0, 0, px / CELL, 0, 0)
    ctx.imageSmoothingEnabled = true
    return ctx
  }

  // Background: guides, reference letter, previous glyph.
  const prevChar = chars[chars.indexOf(char) - 1]
  const prevBitmap = prevChar ? project.glyphs[prevChar]?.bitmap : undefined
  useEffect(() => {
    const ctx = prepare(bg.current)
    if (!ctx) return
    const onePx = CELL / cssSize
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, CELL, CELL)
    if (brush.ghost) {
      ctx.fillStyle = 'rgba(120, 140, 180, 0.13)'
      ctx.font = `${CELL * 0.62}px Georgia, 'Times New Roman', serif`
      ctx.textAlign = 'center'
      ctx.fillText(char, CELL / 2, GUIDE.baseline * CELL)
    }
    if (brush.onion && prevBitmap) {
      ctx.fillStyle = 'rgba(220, 110, 70, 0.14)'
      ctx.fill(bitmapPath(prevBitmap))
    }
    const line = (f: number, solid: boolean, label: string) => {
      ctx.strokeStyle = solid ? '#6fa2e0' : '#b9d3f2'
      ctx.lineWidth = (solid ? 1.5 : 1) * onePx
      ctx.setLineDash(solid ? [] : [5 * onePx, 5 * onePx])
      ctx.beginPath()
      ctx.moveTo(0, f * CELL)
      ctx.lineTo(CELL, f * CELL)
      ctx.stroke()
      ctx.fillStyle = '#9bb7da'
      ctx.font = `${11 * onePx}px system-ui, sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText(label, 6 * onePx, f * CELL - 4 * onePx)
    }
    line(GUIDE.cap, false, 'cap height')
    line(GUIDE.xHeight, false, 'x-height')
    line(GUIDE.baseline, true, 'baseline')
    line(GUIDE.descender, false, 'descender')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cssSize, char, brush.ghost, brush.onion, prevBitmap])

  const renderInk = useCallback(
    (d: Doc) => {
      const ctx = prepare(ink.current)
      if (ctx) paintInk(ctx, d.base, d.strokes, live.current, INK)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cssSize],
  )
  useEffect(() => renderInk(doc), [doc, renderInk])

  const commit = (next: Doc, record = true) => {
    if (record) {
      past.current.push(doc)
      if (past.current.length > 100) past.current.shift()
      future.current = []
    }
    setDoc(next)
    bump((n) => n + 1)
    const empty = !next.base && !next.strokes.some((s) => s.mode === 'draw')
    const bitmap = empty ? null : flatten(next.base, next.strokes)
    setProject((p) => {
      const glyphs = { ...p.glyphs }
      if (!bitmap || !bitmap.some((v) => v)) delete glyphs[char]
      else glyphs[char] = { ...(glyphs[char] ?? newRecord(bitmap)), bitmap, base: next.base, strokes: next.strokes }
      return { ...p, glyphs }
    })
  }

  const undo = () => {
    const prev = past.current.pop()
    if (!prev) return
    future.current.push(doc)
    commit(prev, false)
  }
  const redo = () => {
    const nxt = future.current.pop()
    if (!nxt) return
    past.current.push(doc)
    commit(nxt, false)
  }
  const clear = () => {
    if (doc.base || doc.strokes.length) commit({ base: undefined, strokes: [] })
  }

  const setMetric = (key: 'lsb' | 'rsb' | 'dy', v: number) =>
    setProject((p) => (p.glyphs[char] ? { ...p, glyphs: { ...p.glyphs, [char]: { ...p.glyphs[char], [key]: v } } } : p))

  // ---- pointer input ----
  const toCell = (e: { clientX: number; clientY: number }) => {
    const r = ink.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * CELL, y: ((e.clientY - r.top) / r.height) * CELL }
  }

  const moveCursor = (e: React.PointerEvent) => {
    const c = cursor.current
    if (!c || !cssSize) return
    const r = ink.current!.getBoundingClientRect()
    const d = (tool === 'pen' ? brush.size : brush.size * 2) * (cssSize / CELL)
    c.style.width = c.style.height = `${d}px`
    c.style.transform = `translate(${e.clientX - r.left - d / 2}px, ${e.clientY - r.top - d / 2}px)`
    c.style.opacity = e.pointerType === 'mouse' || e.pointerType === 'pen' ? '1' : '0'
  }

  const removeAt = (p: { x: number; y: number }) => {
    const d = removing.current
    if (!d) return
    const r = brush.size
    const keep = d.strokes.filter((s) => !strokeHit(s, p.x, p.y, r))
    if (keep.length !== d.strokes.length) {
      removing.current = { ...d, strokes: keep }
      setDoc(removing.current)
    }
  }

  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'pen') penSeen.current = true
    else if (e.pointerType === 'touch' && penSeen.current) return // palm rejection
    if (e.button > 0) return
    e.preventDefault()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const p = toCell(e)
    if (tool === 'remove') {
      removing.current = removeStart.current = doc
      removeAt(p)
      return
    }
    live.current = {
      mode: tool === 'pen' ? 'draw' : 'erase',
      size: tool === 'pen' ? brush.size : brush.size * 2,
      thinning: brush.thinning,
      streamline: brush.steadiness,
      simulate: e.pointerType !== 'pen',
      pts: [p.x, p.y, e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5],
    }
    renderInk(doc)
  }

  const onMove = (e: React.PointerEvent) => {
    moveCursor(e)
    if (removing.current) {
      removeAt(toCell(e))
      return
    }
    const s = live.current
    if (!s) return
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p = toCell(ev)
      s.pts.push(p.x, p.y, ev.pointerType === 'pen' ? ev.pressure || 0.5 : 0.5)
    }
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => renderInk(doc))
  }

  const onUp = () => {
    if (removing.current) {
      const d = removing.current,
        start = removeStart.current!
      removing.current = removeStart.current = null
      if (d !== start) {
        // The canvas already shows the removal; record history against the state before it.
        past.current.push(start)
        future.current = []
        commit(d, false)
      }
      return
    }
    const s = live.current
    live.current = null
    cancelAnimationFrame(frame.current)
    if (s) commit({ base: doc.base, strokes: [...doc.strokes, s] })
  }

  // ---- navigation & shortcuts ----
  const idx = chars.indexOf(char)
  const go = (d: number) => onNavigate(chars[(idx + d + chars.length) % chars.length])
  const nextEmpty = () => {
    for (let i = 1; i <= chars.length; i++) {
      const c = chars[(idx + i) % chars.length]
      if (!project.glyphs[c]) return onNavigate(c)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLInputElement).type === 'text') return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'Delete' || e.key === 'Backspace') clear()
      else if (!mod && e.key === '[') setBrush({ size: Math.max(3, brush.size - 2) })
      else if (!mod && e.key === ']') setBrush({ size: Math.min(48, brush.size + 2) })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Keep the current character visible in the filmstrip.
  const strip = useRef<HTMLDivElement>(null)
  useEffect(() => {
    strip.current?.querySelector('.current')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [char])

  const current = project.glyphs[char]
  const built = current ? buildGlyph(char, current, project.settings) : null
  const get = (c: string) => (project.glyphs[c] ? buildGlyph(c, project.glyphs[c], project.settings) : null)
  const wordGlyphs = Array.from(word).map((c) => (c === ' ' ? 'space' : get(c)))

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal editor">
        <div className="row between">
          <div className="row">
            <button onClick={() => go(-1)} aria-label="Previous character" title="Previous (←)">
              ‹
            </button>
            <h2 className="editor-char">{char}</h2>
            <button onClick={() => go(1)} aria-label="Next character" title="Next (→ or Enter)">
              ›
            </button>
            <button onClick={nextEmpty}>Next empty</button>
            <span className="muted small">
              {idx + 1} / {chars.length}
            </span>
          </div>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>

        <div className="editor-body">
          <div
            className="draw-area"
            ref={area}
            onPointerLeave={() => cursor.current && (cursor.current.style.opacity = '0')}
          >
            <canvas ref={bg} className="layer" />
            <canvas
              ref={ink}
              className="layer ink"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onContextMenu={(e) => e.preventDefault()}
            />
            <div ref={cursor} className={'brush-cursor ' + tool} />
          </div>

          <div className="editor-side">
            <div className="toolbar">
              <button className={tool === 'pen' ? 'active' : ''} onClick={() => setTool('pen')}>
                Pen
              </button>
              <button className={tool === 'eraser' ? 'active' : ''} onClick={() => setTool('eraser')}>
                Eraser
              </button>
              <button className={tool === 'remove' ? 'active' : ''} onClick={() => setTool('remove')} title="Tap a stroke to delete it">
                Delete stroke
              </button>
            </div>
            <div className="toolbar">
              <button onClick={undo} disabled={!past.current.length} title="Ctrl+Z">
                Undo
              </button>
              <button onClick={redo} disabled={!future.current.length} title="Ctrl+Shift+Z">
                Redo
              </button>
              <button onClick={clear} title="Delete">
                Clear
              </button>
            </div>
            <label className="field">
              <span>Pen size: {brush.size}</span>
              <input type="range" min={3} max={48} value={brush.size} onChange={(e) => setBrush({ size: +e.target.value })} />
            </label>
            <label className="field">
              <span>Steadiness: {Math.round(brush.steadiness * 100)}%</span>
              <input type="range" min={0} max={0.9} step={0.05} value={brush.steadiness} onChange={(e) => setBrush({ steadiness: +e.target.value })} />
            </label>
            <label className="field">
              <span>Line variation: {Math.round(brush.thinning * 100)}%</span>
              <input type="range" min={0} max={0.9} step={0.05} value={brush.thinning} onChange={(e) => setBrush({ thinning: +e.target.value })} />
            </label>
            <label className="check small">
              <input type="checkbox" checked={brush.ghost} onChange={(e) => setBrush({ ghost: e.target.checked })} />
              Show guide letter
            </label>
            <label className="check small">
              <input type="checkbox" checked={brush.onion} onChange={(e) => setBrush({ onion: e.target.checked })} />
              Show previous character{prevChar ? ` (${prevChar})` : ''}
            </label>

            {current && (
              <details className="spacing">
                <summary>Spacing & position</summary>
                <label className="field">
                  <span>Left space: {current.lsb}</span>
                  <input type="range" min={-150} max={300} step={5} value={current.lsb} onChange={(e) => setMetric('lsb', +e.target.value)} />
                </label>
                <label className="field">
                  <span>Right space: {current.rsb}</span>
                  <input type="range" min={-150} max={300} step={5} value={current.rsb} onChange={(e) => setMetric('rsb', +e.target.value)} />
                </label>
                <label className="field">
                  <span>Raise / lower: {current.dy}</span>
                  <input type="range" min={-300} max={300} step={5} value={current.dy} onChange={(e) => setMetric('dy', +e.target.value)} />
                </label>
              </details>
            )}

            <div className="editor-previews">
              <div className="outline-box">{built ? <GlyphOutline glyph={built} guides /> : <span className="muted small">Draw to create this character</span>}</div>
              <input type="text" className="word-input" value={word} onChange={(e) => setWord(e.target.value)} aria-label="Preview text" />
              <Strip glyphs={wordGlyphs} spaceWidth={project.settings.spaceWidth} />
            </div>
          </div>
        </div>

        <div className="filmstrip" ref={strip}>
          {chars.map((c) => {
            const g = get(c)
            return (
              <button key={c} className={'film-cell' + (c === char ? ' current' : '') + (g ? '' : ' empty')} onClick={() => onNavigate(c)} title={c}>
                {g ? <GlyphOutline glyph={g} /> : <span>{c}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Sets built glyphs side by side, as they'll appear in the font. */
function Strip({ glyphs, spaceWidth }: { glyphs: (BuiltGlyph | 'space' | null)[]; spaceWidth: number }) {
  let x = 0
  const paths: { d: string; x: number }[] = []
  for (const g of glyphs) {
    if (g === 'space') x += spaceWidth
    else if (g) {
      paths.push({ d: g.contours.map((c) => commandsToSvg(contourToCommands(c))).join(''), x })
      x += g.advance
    } else x += spaceWidth * 0.6
  }
  const top = ASCENDER + 50
  return (
    <svg className="strip" viewBox={`-50 ${-top} ${Math.max(x, 1000) + 100} ${top - DESCENDER + 50}`}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} transform={`translate(${p.x} 0) scale(1,-1)`} />
      ))}
    </svg>
  )
}
