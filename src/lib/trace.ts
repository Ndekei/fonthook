import type { Bitmap } from './bitmap'
import { CELL } from './geometry'

/** TrueType-style contour point: consecutive off-curve points imply an on-curve midpoint. */
export interface CPoint {
  x: number
  y: number
  on: boolean
}
export type Contour = CPoint[]

export interface TraceOptions {
  /** Taubin smoothing passes (0–6). */
  smooth: number
  /** Douglas–Peucker tolerance in bitmap pixels. */
  tolerance: number
}

const DX = [1, 0, -1, 0]
const DY = [0, 1, 0, -1]

/**
 * Vectorises a binary bitmap. Contours are in bitmap pixel space (y down),
 * running clockwise (as seen) around ink and anticlockwise around holes:
 * TrueType orientation, which survives the flip to y-up font coordinates.
 */
export function traceBitmap(b: Bitmap, opts: TraceOptions): Contour[] {
  const W = CELL + 1
  const has = new Uint8Array(W * W * 4)
  const ink = (x: number, y: number) => x >= 0 && y >= 0 && x < CELL && y < CELL && b[y * CELL + x] === 1
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      if (!ink(x, y)) continue
      if (!ink(x, y - 1)) has[(y * W + x) * 4 + 0] = 1
      if (!ink(x + 1, y)) has[(y * W + x + 1) * 4 + 1] = 1
      if (!ink(x, y + 1)) has[((y + 1) * W + x + 1) * 4 + 2] = 1
      if (!ink(x - 1, y)) has[((y + 1) * W + x) * 4 + 3] = 1
    }

  const contours: Contour[] = []
  for (let e = 0; e < has.length; e++) {
    if (has[e] !== 1) continue
    const startV = e >> 2
    let v = startV
    let d = e & 3
    const pts: { x: number; y: number }[] = []
    for (;;) {
      has[v * 4 + d] = 2
      const vx = v % W,
        vy = (v / W) | 0
      pts.push({ x: vx + DX[d] * 0.5, y: vy + DY[d] * 0.5 })
      const nv = (vy + DY[d]) * W + vx + DX[d]
      if (nv === startV) break
      // Prefer turning right (hugging the ink), then straight, then left.
      let nd = -1
      for (const c of [(d + 1) & 3, d, (d + 3) & 3]) {
        if (has[nv * 4 + c] === 1) {
          nd = c
          break
        }
      }
      if (nd < 0) break
      v = nv
      d = nd
    }
    if (pts.length < 8) continue
    const smoothed = taubin(pts, opts.smooth)
    if (Math.abs(polyArea(smoothed)) < 6) continue
    const simple = simplifyClosed(smoothed, opts.tolerance)
    if (simple.length < 3) continue
    contours.push(markCorners(simple))
  }
  return contours
}

function taubin(p: { x: number; y: number }[], passes: number) {
  let cur = p
  const n = p.length
  for (let it = 0; it < passes * 2; it++) {
    const f = it % 2 === 0 ? 0.5 : -0.53
    const next = new Array(n)
    for (let i = 0; i < n; i++) {
      const a = cur[(i + n - 1) % n],
        c = cur[(i + 1) % n],
        q = cur[i]
      next[i] = { x: q.x + f * ((a.x + c.x) / 2 - q.x), y: q.y + f * ((a.y + c.y) / 2 - q.y) }
    }
    cur = next
  }
  return cur
}

export function polyArea(p: { x: number; y: number }[]) {
  let a = 0
  for (let i = 0; i < p.length; i++) {
    const q = p[i],
      r = p[(i + 1) % p.length]
    a += q.x * r.y - r.x * q.y
  }
  return a / 2
}

function rdp(p: { x: number; y: number }[], a: number, b: number, tol: number, keep: Uint8Array) {
  const A = p[a],
    B = p[b]
  const dx = B.x - A.x,
    dy = B.y - A.y
  const len = Math.hypot(dx, dy) || 1e-9
  let best = -1,
    bi = -1
  for (let i = a + 1; i < b; i++) {
    const d = Math.abs((p[i].x - A.x) * dy - (p[i].y - A.y) * dx) / len
    if (d > best) {
      best = d
      bi = i
    }
  }
  if (best > tol) {
    keep[bi] = 1
    rdp(p, a, bi, tol, keep)
    rdp(p, bi, b, tol, keep)
  }
}

function simplifyClosed(p: { x: number; y: number }[], tol: number) {
  let far = 0,
    fd = -1
  for (let i = 1; i < p.length; i++) {
    const d = (p[i].x - p[0].x) ** 2 + (p[i].y - p[0].y) ** 2
    if (d > fd) {
      fd = d
      far = i
    }
  }
  const ring = [...p, p[0]]
  const keep = new Uint8Array(ring.length)
  keep[0] = keep[far] = 1
  rdp(ring, 0, far, tol, keep)
  rdp(ring, far, ring.length - 1, tol, keep)
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < p.length; i++) if (keep[i]) out.push(p[i])
  return out
}

/** Sharp turns become on-curve corners; everything else is a smooth off-curve control point. */
function markCorners(p: { x: number; y: number }[]): Contour {
  const n = p.length
  return p.map((q, i) => {
    const a = p[(i + n - 1) % n],
      c = p[(i + 1) % n]
    const ux = q.x - a.x,
      uy = q.y - a.y,
      vx = c.x - q.x,
      vy = c.y - q.y
    const cos = (ux * vx + uy * vy) / ((Math.hypot(ux, uy) * Math.hypot(vx, vy)) || 1e-9)
    return { x: q.x, y: q.y, on: cos < 0.55 }
  })
}

export type PathCmd =
  | { t: 'M' | 'L'; x: number; y: number }
  | { t: 'Q'; cx: number; cy: number; x: number; y: number }
  | { t: 'Z' }

/** Expands implied on-curve points and emits move/line/quad commands. */
export function contourToCommands(c: Contour): PathCmd[] {
  const n = c.length
  const full: CPoint[] = []
  for (let i = 0; i < n; i++) {
    const p = c[i],
      q = c[(i + 1) % n]
    full.push(p)
    if (!p.on && !q.on) full.push({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, on: true })
  }
  const s = full.findIndex((p) => p.on)
  const pts = [...full.slice(s), ...full.slice(0, s)]
  const out: PathCmd[] = [{ t: 'M', x: pts[0].x, y: pts[0].y }]
  for (let i = 1; i <= pts.length; i++) {
    const p = pts[i % pts.length]
    if (p.on) out.push({ t: 'L', x: p.x, y: p.y })
    else {
      const q = pts[(i + 1) % pts.length]
      out.push({ t: 'Q', cx: p.x, cy: p.y, x: q.x, y: q.y })
      i++
    }
  }
  out.push({ t: 'Z' })
  return out
}

export function commandsToSvg(cmds: PathCmd[]) {
  const f = (v: number) => +v.toFixed(2)
  return cmds
    .map((c) => (c.t === 'Z' ? 'Z' : c.t === 'Q' ? `Q${f(c.cx)} ${f(c.cy)} ${f(c.x)} ${f(c.y)}` : `${c.t}${f(c.x)} ${f(c.y)}`))
    .join('')
}
