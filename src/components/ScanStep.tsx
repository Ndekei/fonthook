import { useEffect, useRef, useState } from 'react'
import type { SetProject } from '../App'
import type { Bitmap } from '../lib/bitmap'
import { newRecord } from '../lib/glyphs'
import { applyH, type Pt } from '../lib/homography'
import type { Project } from '../lib/project'
import { detectCorners, extractCells, loadImage, pageToImage, type GrayImage } from '../lib/scan'
import { charsOnPage, pageCount, pageLayout, type PageLayout } from '../lib/template'
import BitmapThumb from './BitmapThumb'

interface Props {
  project: Project
  setProject: SetProject
  chars: string[]
  next: () => void
}

interface Scan {
  id: number
  name: string
  url: string
  gray: GrayImage
  corners: Pt[]
  detected: boolean
  page: number
  sensitivity: number
  extracted: Record<string, Bitmap> | null
  imported: boolean
}

let nextId = 1

export default function ScanStep({ project, setProject, chars, next }: Props) {
  const [scans, setScans] = useState<Scan[]>([])
  const [busy, setBusy] = useState(false)
  const layout = pageLayout(project.paper)
  const pages = pageCount(chars, project.paper)

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    const added: Scan[] = []
    for (const file of Array.from(files)) {
      try {
        const { gray, url } = await loadImage(file)
        const found = detectCorners(gray, layout)
        const m = Math.min(gray.w, gray.h) * 0.08
        const corners = found ?? [
          { x: m, y: m },
          { x: gray.w - m, y: m },
          { x: gray.w - m, y: gray.h - m },
          { x: m, y: gray.h - m },
        ]
        const page = Math.min(pages - 1, scans.length + added.length)
        added.push({ id: nextId++, name: file.name, url, gray, corners, detected: !!found, page, sensitivity: 0.62, extracted: null, imported: false })
      } catch (e) {
        alert(`Couldn't read ${file.name}: ${(e as Error).message}`)
      }
    }
    // Auto-extract the ones where the markers were found.
    for (const s of added) if (s.detected) s.extracted = extractCells(s.gray, layout, s.corners, charsOnPage(chars, project.paper, s.page), s.sensitivity)
    setScans((prev) => [...prev, ...added])
    setBusy(false)
  }

  const update = (id: number, patch: Partial<Scan>) => setScans((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const extract = (s: Scan) =>
    update(s.id, {
      extracted: extractCells(s.gray, layout, s.corners, charsOnPage(chars, project.paper, s.page), s.sensitivity),
      imported: false,
    })

  const importScan = (s: Scan) => {
    if (!s.extracted) return
    setProject((p) => {
      const glyphs = { ...p.glyphs }
      for (const [ch, bm] of Object.entries(s.extracted!)) glyphs[ch] = { ...(glyphs[ch] ?? newRecord(bm)), bitmap: bm }
      return { ...p, glyphs }
    })
    update(s.id, { imported: true })
  }

  return (
    <section className="step">
      <div className="panel">
        <h2>Upload your filled-in template</h2>
        <p className="muted">
          Scans or phone photos (JPG/PNG/HEIC where the browser supports it). Keep the page flat and evenly lit with all four black corner
          squares visible. Everything is processed on your device.
        </p>
        <label className="dropzone">
          <input type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} disabled={busy} />
          {busy ? 'Processing…' : 'Choose images or drop them here'}
        </label>
      </div>
      {scans.map((s) => (
        <ScanCard
          key={s.id}
          scan={s}
          layout={layout}
          pages={pages}
          onCorners={(corners) => update(s.id, { corners, extracted: null })}
          onPage={(page) => update(s.id, { page, extracted: null })}
          onSensitivity={(sensitivity) => update(s.id, { sensitivity })}
          onExtract={() => extract(s)}
          onImport={() => importScan(s)}
          onRemove={() => setScans((prev) => prev.filter((x) => x.id !== s.id))}
          chars={charsOnPage(chars, project.paper, s.page)}
        />
      ))}
      {scans.some((s) => s.imported) && (
        <div className="actions end">
          <button className="primary" onClick={next}>
            Review glyphs →
          </button>
        </div>
      )}
    </section>
  )
}

interface CardProps {
  scan: Scan
  layout: PageLayout
  pages: number
  chars: string[]
  onCorners: (c: Pt[]) => void
  onPage: (p: number) => void
  onSensitivity: (v: number) => void
  onExtract: () => void
  onImport: () => void
  onRemove: () => void
}

function ScanCard({ scan, layout, pages, chars, onCorners, onPage, onSensitivity, onExtract, onImport, onRemove }: CardProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const img = useRef<HTMLImageElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const drag = useRef<number | null>(null)
  const { gray, corners } = scan
  const DISPLAY = 900
  const k = Math.min(1, DISPLAY / Math.max(gray.w, gray.h))

  useEffect(() => {
    const el = new Image()
    el.onload = () => {
      img.current = el
      setLoaded(true)
    }
    el.src = scan.url
  }, [scan.url])

  useEffect(() => {
    const c = canvas.current
    if (!c || !loaded || !img.current) return
    c.width = Math.round(gray.w * k)
    c.height = Math.round(gray.h * k)
    const ctx = c.getContext('2d')!
    ctx.drawImage(img.current, 0, 0, c.width, c.height)
    // Projected cell grid shows whether the corners line up.
    const h = pageToImage(layout, corners)
    ctx.strokeStyle = 'rgba(230, 60, 90, 0.75)'
    ctx.lineWidth = 1
    layout.cells.slice(0, chars.length).forEach((cell) => {
      const pts = [
        [cell.x, cell.y],
        [cell.x + cell.size, cell.y],
        [cell.x + cell.size, cell.y + cell.size],
        [cell.x, cell.y + cell.size],
      ].map(([x, y]) => applyH(h, x, y))
      ctx.beginPath()
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x * k, p.y * k) : ctx.moveTo(p.x * k, p.y * k)))
      ctx.closePath()
      ctx.stroke()
    })
    corners.forEach((p, i) => {
      ctx.beginPath()
      ctx.arc(p.x * k, p.y * k, 9, 0, Math.PI * 2)
      ctx.fillStyle = i === 0 ? 'rgba(40, 170, 90, 0.85)' : 'rgba(60, 110, 230, 0.85)'
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(i + 1), p.x * k, p.y * k)
    })
  }, [loaded, corners, gray, k, layout, chars.length])

  const toImage = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    const sx = canvas.current!.width / r.width
    return { x: ((e.clientX - r.left) * sx) / k, y: ((e.clientY - r.top) * sx) / k }
  }

  const onDown = (e: React.PointerEvent) => {
    const p = toImage(e)
    const r = canvas.current!.getBoundingClientRect()
    const tol = (18 * canvas.current!.width) / r.width / k
    const i = corners.findIndex((c) => Math.hypot(c.x - p.x, c.y - p.y) < tol)
    if (i >= 0) {
      drag.current = i
      ;(e.target as Element).setPointerCapture(e.pointerId)
    }
  }
  const onMove = (e: React.PointerEvent) => {
    if (drag.current === null) return
    const p = toImage(e)
    onCorners(corners.map((c, i) => (i === drag.current ? p : c)))
  }
  const onUp = () => {
    drag.current = null
  }

  const rotate = () => onCorners([corners[1], corners[2], corners[3], corners[0]])
  const found = scan.extracted ? Object.keys(scan.extracted).length : 0

  return (
    <div className="panel scan-card">
      <div className="scan-head">
        <strong>{scan.name}</strong>
        {scan.detected ? (
          <span className="badge ok">Corners found</span>
        ) : (
          <span className="badge warn">Couldn't find the corner squares — drag the dots onto them</span>
        )}
        <button className="link" onClick={onRemove}>
          Remove
        </button>
      </div>
      <div className="scan-body">
        <canvas
          ref={canvas}
          className="scan-canvas"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        <div className="scan-side">
          <p className="muted small">
            Dot 1 (green) goes on the top-left square, the one with the small square beside it. The red grid should sit on the boxes.
          </p>
          <label className="field">
            <span>Template page</span>
            <select value={scan.page} onChange={(e) => onPage(+e.target.value)}>
              {Array.from({ length: pages }, (_, i) => (
                <option key={i} value={i}>
                  Page {i + 1}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Ink sensitivity: {Math.round(scan.sensitivity * 100)}%</span>
            <input type="range" min={0.4} max={0.9} step={0.01} value={scan.sensitivity} onChange={(e) => onSensitivity(+e.target.value)} />
          </label>
          <div className="actions">
            <button onClick={rotate}>Rotate corners</button>
            <button onClick={onExtract}>{scan.extracted ? 'Re-extract' : 'Extract glyphs'}</button>
          </div>
          {scan.extracted && (
            <>
              <p className="muted small">{found} characters found on this page.</p>
              <div className="mini-grid">
                {chars.map((ch) => (
                  <div key={ch} className={'mini' + (scan.extracted![ch] ? '' : ' empty')} title={ch}>
                    {scan.extracted![ch] ? <BitmapThumb bitmap={scan.extracted![ch]} /> : <span>{ch}</span>}
                  </div>
                ))}
              </div>
              <button className="primary" onClick={onImport} disabled={!found || scan.imported}>
                {scan.imported ? 'Added to font ✓' : `Add ${found} glyphs to font`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
