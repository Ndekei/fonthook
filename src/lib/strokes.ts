import { getStroke } from 'perfect-freehand'
import { newBitmap, type Bitmap } from './bitmap'
import { CELL } from './geometry'
import { contourToCommands, traceBitmap } from './trace'

/** One pen or eraser stroke, in cell pixel coordinates (0..CELL). */
export interface Stroke {
  mode: 'draw' | 'erase'
  size: number
  thinning: number
  streamline: number
  /** True when pressure should be simulated from speed (mouse/touch). */
  simulate: boolean
  /** Flat [x, y, pressure, x, y, pressure, ...]. */
  pts: number[]
}

export function strokeOutline(s: Stroke, last = true): number[][] {
  const pts: number[][] = []
  for (let i = 0; i < s.pts.length; i += 3) pts.push([s.pts[i], s.pts[i + 1], s.pts[i + 2]])
  return getStroke(pts, {
    size: s.size,
    thinning: s.mode === 'erase' ? 0 : s.thinning,
    streamline: s.streamline,
    smoothing: 0.6,
    simulatePressure: s.simulate,
    start: { taper: false, cap: true },
    end: { taper: false, cap: true },
    last,
  })
}

/** Smooth closed path through the outline points (quadratic curves through midpoints). */
export function outlinePath(outline: number[][]): Path2D {
  const p = new Path2D()
  const n = outline.length
  if (n < 2) return p
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const m0 = mid(outline[n - 1], outline[0])
  p.moveTo(m0[0], m0[1])
  for (let i = 0; i < n; i++) {
    const a = outline[i],
      m = mid(a, outline[(i + 1) % n])
    p.quadraticCurveTo(a[0], a[1], m[0], m[1])
  }
  p.closePath()
  return p
}

const strokeCache = new WeakMap<Stroke, Path2D>()
export function strokePath(s: Stroke): Path2D {
  let p = strokeCache.get(s)
  if (!p) {
    p = outlinePath(strokeOutline(s))
    strokeCache.set(s, p)
  }
  return p
}

const bitmapCache = new WeakMap<Bitmap, Path2D>()
/** Vector outline of a bitmap (e.g. a scanned glyph), so it displays crisply at any zoom. */
export function bitmapPath(b: Bitmap): Path2D {
  let p = bitmapCache.get(b)
  if (!p) {
    p = new Path2D()
    for (const c of traceBitmap(b, { smooth: 2, tolerance: 0.4 }))
      for (const cmd of contourToCommands(c)) {
        if (cmd.t === 'M') p.moveTo(cmd.x, cmd.y)
        else if (cmd.t === 'L') p.lineTo(cmd.x, cmd.y)
        else if (cmd.t === 'Q') p.quadraticCurveTo(cmd.cx, cmd.cy, cmd.x, cmd.y)
        else p.closePath()
      }
    bitmapCache.set(b, p)
  }
  return p
}

/**
 * Paints base + strokes onto ctx, which must already be transformed so one
 * unit = one cell pixel. Erase strokes cut through everything beneath them.
 */
export function paintInk(ctx: CanvasRenderingContext2D, base: Bitmap | undefined, strokes: Stroke[], live: Stroke | null, color: string) {
  ctx.fillStyle = color
  if (base) ctx.fill(bitmapPath(base))
  const all = live ? [...strokes, live] : strokes
  for (const s of all) {
    ctx.globalCompositeOperation = s.mode === 'erase' ? 'destination-out' : 'source-over'
    ctx.fill(s === live ? outlinePath(strokeOutline(s, false)) : strokePath(s), 'nonzero')
  }
  ctx.globalCompositeOperation = 'source-over'
}

/** Rasterises base + strokes into the CELL x CELL bitmap the font is traced from. */
export function flatten(base: Bitmap | undefined, strokes: Stroke[]): Bitmap {
  const SS = 2 // supersample, then threshold coverage at 50%
  const c = document.createElement('canvas')
  c.width = c.height = CELL * SS
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.setTransform(SS, 0, 0, SS, 0, 0)
  if (base) {
    const t = document.createElement('canvas')
    t.width = t.height = CELL
    const img = new ImageData(CELL, CELL)
    for (let i = 0; i < base.length; i++) if (base[i]) img.data[i * 4 + 3] = 255
    t.getContext('2d')!.putImageData(img, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(t, 0, 0)
  }
  paintInk(ctx, undefined, strokes, null, '#000')
  const data = ctx.getImageData(0, 0, CELL * SS, CELL * SS).data
  const out = newBitmap()
  const W = CELL * SS
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      let a = 0
      for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) a += data[((y * SS + j) * W + x * SS + i) * 4 + 3]
      out[y * CELL + x] = a >= 128 * SS * SS ? 1 : 0
    }
  return out
}

/** Whether a point (cell coords) lies within `r` of a stroke's centre line. */
export function strokeHit(s: Stroke, x: number, y: number, r: number) {
  const lim = (r + s.size / 2) ** 2
  for (let i = 0; i < s.pts.length; i += 3) if ((s.pts[i] - x) ** 2 + (s.pts[i + 1] - y) ** 2 <= lim) return true
  return false
}
