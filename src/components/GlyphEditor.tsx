import { useEffect, useRef, useState } from 'react'
import type { SetProject } from '../App'
import { bitmapToImageData, newBitmap, type Bitmap } from '../lib/bitmap'
import { ASCENDER, CELL, DESCENDER, GUIDE } from '../lib/geometry'
import { buildGlyph, newRecord, type BuiltGlyph, type GlyphRecord } from '../lib/glyphs'
import type { Project } from '../lib/project'
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

type Tool = 'pen' | 'eraser'

export default function GlyphEditor({ char, chars, project, setProject, onNavigate, onClose }: Props) {
  const rec: GlyphRecord | undefined = project.glyphs[char]
  const [bitmap, setBitmap] = useState<Bitmap>(() => rec?.bitmap ?? newBitmap())
  const [tool, setTool] = useState<Tool>('pen')
  const [size, setSize] = useState(9)
  const undo = useRef<Bitmap[]>([])
  const guides = useRef<HTMLCanvasElement>(null)
  const ink = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<{ last: { x: number; y: number } | null; work: Bitmap } | null>(null)

  useEffect(() => {
    const c = guides.current
    if (!c) return
    c.width = CELL
    c.height = CELL
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, CELL, CELL)
    const line = (f: number, dash: boolean, label: string) => {
      ctx.strokeStyle = dash ? '#b9d3f2' : '#6fa2e0'
      ctx.setLineDash(dash ? [4, 4] : [])
      ctx.lineWidth = dash ? 1 : 1.5
      ctx.beginPath()
      ctx.moveTo(0, f * CELL)
      ctx.lineTo(CELL, f * CELL)
      ctx.stroke()
      ctx.fillStyle = '#9bb7da'
      ctx.font = '9px sans-serif'
      ctx.fillText(label, 3, f * CELL - 3)
    }
    line(GUIDE.cap, true, 'cap height')
    line(GUIDE.xHeight, true, 'x-height')
    line(GUIDE.baseline, false, 'baseline')
    line(GUIDE.descender, true, 'descender')
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(150, 170, 200, 0.18)'
    ctx.font = `${CELL * 0.45}px Georgia, serif`
    ctx.textAlign = 'center'
    ctx.fillText(char, CELL / 2, GUIDE.baseline * CELL)
  }, [char])

  const paint = (b: Bitmap) => {
    const c = ink.current
    if (!c) return
    c.width = CELL
    c.height = CELL
    c.getContext('2d')!.putImageData(bitmapToImageData(b), 0, 0)
  }
  useEffect(() => paint(bitmap), [bitmap])

  const commit = (b: Bitmap) => {
    setBitmap(b)
    setProject((p) => {
      const glyphs = { ...p.glyphs }
      if (!b.some((v) => v)) delete glyphs[char]
      else glyphs[char] = { ...(glyphs[char] ?? newRecord(b)), bitmap: b }
      return { ...p, glyphs }
    })
  }

  const setMetric = (key: 'lsb' | 'rsb' | 'dy', v: number) =>
    setProject((p) => (p.glyphs[char] ? { ...p, glyphs: { ...p.glyphs, [char]: { ...p.glyphs[char], [key]: v } } } : p))

  const stamp = (b: Bitmap, x: number, y: number, r: number, v: 0 | 1) => {
    const r2 = r * r
    for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++)
      for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
        if (xx < 0 || yy < 0 || xx >= CELL || yy >= CELL) continue
        if ((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 <= r2) b[yy * CELL + xx] = v
      }
  }

  const pos = (e: React.PointerEvent) => {
    const r = ink.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * CELL, y: ((e.clientY - r.top) / r.height) * CELL }
  }
  const radius = (e: React.PointerEvent) => {
    const base = tool === 'eraser' ? size * 1.6 : size / 2
    return e.pointerType === 'pen' && e.pressure > 0 ? base * (0.4 + e.pressure * 1.2) : base
  }

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    undo.current.push(bitmap)
    if (undo.current.length > 40) undo.current.shift()
    drawing.current = { last: null, work: bitmap.slice() }
    onMove(e)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drawing.current
    if (!d) return
    const p = pos(e)
    const r = radius(e)
    const v = tool === 'pen' ? 1 : 0
    const from = d.last ?? p
    const steps = Math.max(1, Math.ceil(Math.hypot(p.x - from.x, p.y - from.y) / 0.75))
    for (let i = 1; i <= steps; i++) stamp(d.work, from.x + ((p.x - from.x) * i) / steps, from.y + ((p.y - from.y) * i) / steps, r, v)
    d.last = p
    paint(d.work)
  }
  const onUp = () => {
    const d = drawing.current
    drawing.current = null
    if (d) commit(d.work)
  }

  const doUndo = () => {
    const prev = undo.current.pop()
    if (prev) commit(prev)
  }
  const clear = () => {
    undo.current.push(bitmap)
    commit(newBitmap())
  }

  const idx = chars.indexOf(char)
  const go = (d: number) => onNavigate(chars[(idx + d + chars.length) % chars.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        doUndo()
      } else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const current = project.glyphs[char]
  const built = current ? buildGlyph(char, current, project.settings) : null
  const ctx = (c: string) => (project.glyphs[c] ? buildGlyph(c, project.glyphs[c], project.settings) : null)
  const isUpper = char.toUpperCase() === char && char.toLowerCase() !== char
  const neighbour = isUpper ? ctx('H') : ctx('n') ?? ctx('o')

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal editor">
        <div className="row between">
          <div className="row">
            <button onClick={() => go(-1)} aria-label="Previous character">
              ‹
            </button>
            <h2 className="editor-char">{char}</h2>
            <button onClick={() => go(1)} aria-label="Next character">
              ›
            </button>
          </div>
          <button onClick={onClose}>Done</button>
        </div>
        <div className="editor-body">
          <div className="draw-area">
            <canvas ref={guides} className="layer" />
            <canvas
              ref={ink}
              className="layer ink"
              style={{ cursor: tool === 'pen' ? 'crosshair' : 'cell' }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            />
          </div>
          <div className="editor-side">
            <div className="toolbar">
              <button className={tool === 'pen' ? 'active' : ''} onClick={() => setTool('pen')}>
                Pen
              </button>
              <button className={tool === 'eraser' ? 'active' : ''} onClick={() => setTool('eraser')}>
                Eraser
              </button>
              <button onClick={doUndo}>Undo</button>
              <button onClick={clear}>Clear</button>
            </div>
            <label className="field">
              <span>Brush size: {size}px</span>
              <input type="range" min={2} max={30} value={size} onChange={(e) => setSize(+e.target.value)} />
            </label>
            {current ? (
              <>
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
              </>
            ) : (
              <p className="muted small">Draw on the canvas to create this glyph. A stylus or tablet gives pressure-sensitive strokes.</p>
            )}
            <div className="editor-previews">
              <div className="outline-box">{built ? <GlyphOutline glyph={built} guides /> : <span className="muted small">No glyph yet</span>}</div>
              {built && <Strip glyphs={[neighbour, built, neighbour, built, neighbour]} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Sets a few built glyphs side by side to judge spacing. */
function Strip({ glyphs }: { glyphs: (BuiltGlyph | null)[] }) {
  let x = 0
  const paths: { d: string; x: number }[] = []
  for (const g of glyphs) {
    if (!g) continue
    paths.push({ d: g.contours.map((c) => commandsToSvg(contourToCommands(c))).join(''), x })
    x += g.advance
  }
  const top = ASCENDER + 50
  return (
    <svg className="strip" viewBox={`-50 ${-top} ${x + 100} ${top - DESCENDER + 50}`}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} transform={`translate(${p.x} 0) scale(1,-1)`} />
      ))}
    </svg>
  )
}
