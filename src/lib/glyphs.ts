import { inkBounds, morph, type Bitmap } from './bitmap'
import { BASELINE_PX, SCALE } from './geometry'
import { traceBitmap, type Contour } from './trace'

export interface GlyphRecord {
  bitmap: Bitmap
  /** Extra space left/right of the ink, in font units. */
  lsb: number
  rsb: number
  /** Vertical nudge in font units (+ = up). */
  dy: number
}

export interface FontSettings {
  family: string
  style: string
  /** Stroke thickening (+) or thinning (−) in bitmap pixels. */
  weight: number
  smooth: number
  tolerance: number
  /** Added to both sides of every glyph, font units. */
  tracking: number
  spaceWidth: number
}

export const DEFAULT_SETTINGS: FontSettings = {
  family: 'My Handwriting',
  style: 'Regular',
  weight: 0,
  smooth: 3,
  tolerance: 0.8,
  tracking: 0,
  spaceWidth: 320,
}

export const newRecord = (bitmap: Bitmap): GlyphRecord => ({ bitmap, lsb: 30, rsb: 30, dy: 0 })

/** A glyph in font units, y-up, contours in TrueType orientation (outer clockwise). */
export interface BuiltGlyph {
  char: string
  unicode: number
  advance: number
  contours: Contour[]
}

const cache = new WeakMap<GlyphRecord, { key: string; glyph: BuiltGlyph }>()

export function buildGlyph(char: string, rec: GlyphRecord, s: FontSettings): BuiltGlyph | null {
  const key = `${s.weight}|${s.smooth}|${s.tolerance}|${s.tracking}`
  const hit = cache.get(rec)
  if (hit && hit.key === key) return hit.glyph.char === char ? hit.glyph : { ...hit.glyph, char, unicode: char.codePointAt(0)! }
  const bm = morph(rec.bitmap, s.weight)
  const bounds = inkBounds(bm)
  if (!bounds) return null
  const raw = traceBitmap(bm, { smooth: s.smooth, tolerance: s.tolerance })
  const left = rec.lsb + s.tracking
  const contours: Contour[] = []
  for (const c of raw) {
    const out: Contour = []
    for (const p of c) {
      const q = {
        x: Math.round((p.x - bounds.x0) * SCALE + left),
        y: Math.round((BASELINE_PX - p.y) * SCALE + rec.dy),
        on: p.on,
      }
      const prev = out[out.length - 1]
      if (prev && prev.x === q.x && prev.y === q.y) continue
      out.push(q)
    }
    while (out.length > 1 && out[0].x === out[out.length - 1].x && out[0].y === out[out.length - 1].y) out.pop()
    if (out.length >= 3) contours.push(out)
  }
  if (!contours.length) return null
  const advance = Math.max(1, Math.round((bounds.x1 - bounds.x0) * SCALE + left + rec.rsb + s.tracking))
  const glyph = { char, unicode: char.codePointAt(0)!, advance, contours }
  cache.set(rec, { key, glyph })
  return glyph
}

export function buildAll(glyphs: Record<string, GlyphRecord>, s: FontSettings): BuiltGlyph[] {
  const out: BuiltGlyph[] = []
  for (const [ch, rec] of Object.entries(glyphs)) {
    const g = buildGlyph(ch, rec, s)
    if (g) out.push(g)
  }
  return out.sort((a, b) => a.unicode - b.unicode)
}
