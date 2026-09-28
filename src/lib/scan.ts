import { cleanScan, inkCount, newBitmap, type Bitmap } from './bitmap'
import { CELL } from './geometry'
import { applyH, solveHomography, type Homography, type Pt } from './homography'
import { ORIENT_MARK, type PageLayout } from './template'

/** Grayscale page image, using the brightest channel so light-blue guides vanish. */
export interface GrayImage {
  w: number
  h: number
  data: Uint8Array
}

const MAX_SIDE = 3200

export async function loadImage(file: Blob): Promise<{ gray: GrayImage; url: string }> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * k),
    h = Math.round(bmp.height * k)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const rgba = ctx.getImageData(0, 0, w, h).data
  const data = new Uint8Array(w * h)
  for (let i = 0; i < data.length; i++) data[i] = Math.max(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2])
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.85))
  return { gray: { w, h, data }, url: URL.createObjectURL(blob) }
}

interface Blob2 {
  cx: number
  cy: number
  area: number
}

function downscale(img: GrayImage, maxSide: number) {
  const f = Math.max(1, Math.ceil(Math.max(img.w, img.h) / maxSide))
  const w = Math.floor(img.w / f),
    h = Math.floor(img.h / f)
  const data = new Uint8Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) s += img.data[(y * f + j) * img.w + x * f + i]
      data[y * w + x] = s / (f * f)
    }
  return { img: { w, h, data }, f }
}

function darkBlobs(img: GrayImage): Blob2[] {
  const { w, h, data } = img
  const I = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += data[y * w + x]
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row
    }
  }
  const R = Math.max(8, Math.round(Math.min(w, h) / 10))
  const dark = new Uint8Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - R),
        y0 = Math.max(0, y - R),
        x1 = Math.min(w, x + R + 1),
        y1 = Math.min(h, y + R + 1)
      const sum = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]
      const mean = sum / ((x1 - x0) * (y1 - y0))
      dark[y * w + x] = data[y * w + x] < mean * 0.6 ? 1 : 0
    }
  const seen = new Uint8Array(w * h)
  const out: Blob2[] = []
  const stack: number[] = []
  for (let i = 0; i < dark.length; i++) {
    if (!dark[i] || seen[i]) continue
    seen[i] = 1
    stack.push(i)
    let area = 0,
      sx = 0,
      sy = 0,
      bx0 = w,
      by0 = h,
      bx1 = 0,
      by1 = 0,
      edge = false
    while (stack.length) {
      const p = stack.pop()!
      const x = p % w,
        y = (p / w) | 0
      area++
      sx += x
      sy += y
      if (x < bx0) bx0 = x
      if (x > bx1) bx1 = x
      if (y < by0) by0 = y
      if (y > by1) by1 = y
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= dark.length || seen[q] || !dark[q]) continue
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === w - 1)) continue
        seen[q] = 1
        stack.push(q)
      }
    }
    const bw = bx1 - bx0 + 1,
      bh = by1 - by0 + 1
    if (edge || area < 30 || bw < 5 || bh < 5) continue
    const aspect = bw / bh
    if (aspect < 0.5 || aspect > 2) continue
    if (area / (bw * bh) < 0.6) continue
    out.push({ cx: sx / area + 0.5, cy: sy / area + 0.5, area })
  }
  return out
}

function quadArea(q: Pt[]) {
  let a = 0
  for (let i = 0; i < 4; i++) a += q[i].x * q[(i + 1) % 4].y - q[(i + 1) % 4].x * q[i].y
  return a / 2
}

function sample(img: GrayImage, x: number, y: number) {
  const x0 = Math.floor(x - 0.5),
    y0 = Math.floor(y - 0.5)
  const fx = x - 0.5 - x0,
    fy = y - 0.5 - y0
  const at = (xx: number, yy: number) => {
    xx = Math.min(img.w - 1, Math.max(0, xx))
    yy = Math.min(img.h - 1, Math.max(0, yy))
    return img.data[yy * img.w + xx]
  }
  return (
    at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy
  )
}

/** Mean brightness in a small square (mm) of the page under homography h (page mm -> image px). */
function patchMean(img: GrayImage, h: Homography, cx: number, cy: number, size: number) {
  let s = 0,
    n = 0
  for (let j = -2; j <= 2; j++)
    for (let i = -2; i <= 2; i++) {
      const p = applyH(h, cx + (i * size) / 6, cy + (j * size) / 6)
      s += sample(img, p.x, p.y)
      n++
    }
  return s / n
}

/**
 * Finds the four corner markers and returns their image positions ordered to
 * match layout.markers (TL, TR, BR, BL on the printed page), whatever way the
 * photo is rotated. Returns null if nothing plausible is found.
 */
export function detectCorners(gray: GrayImage, layout: PageLayout): Pt[] | null {
  const { img, f } = downscale(gray, 1000)
  const blobs = darkBlobs(img)
    .sort((a, b) => b.area - a.area)
    .slice(0, 14)
    .map((b) => ({ x: b.cx * f, y: b.cy * f, area: b.area }))
  const pageRatio = (layout.markers[3].y - layout.markers[0].y) / (layout.markers[1].x - layout.markers[0].x)
  let best: Pt[] | null = null
  let bestScore = 0
  const n = blobs.length
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++) {
          const set = [blobs[a], blobs[b], blobs[c], blobs[d]]
          const areas = set.map((s) => s.area)
          const areaRatio = Math.min(...areas) / Math.max(...areas)
          if (areaRatio < 0.35) continue
          const tl = set.reduce((m, p) => (p.x + p.y < m.x + m.y ? p : m))
          const br = set.reduce((m, p) => (p.x + p.y > m.x + m.y ? p : m))
          const tr = set.reduce((m, p) => (p.x - p.y > m.x - m.y ? p : m))
          const bl = set.reduce((m, p) => (p.x - p.y < m.x - m.y ? p : m))
          if (new Set([tl, tr, br, bl]).size < 4) continue
          const q = [tl, tr, br, bl]
          const area = quadArea(q)
          if (area <= 0) continue
          // Reject non-convex quads.
          let convex = true
          for (let i = 0; i < 4; i++) {
            const p0 = q[i],
              p1 = q[(i + 1) % 4],
              p2 = q[(i + 2) % 4]
            if ((p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x) <= 0) convex = false
          }
          if (!convex) continue
          const horiz = (Math.hypot(tr.x - tl.x, tr.y - tl.y) + Math.hypot(br.x - bl.x, br.y - bl.y)) / 2
          const vert = (Math.hypot(bl.x - tl.x, bl.y - tl.y) + Math.hypot(br.x - tr.x, br.y - tr.y)) / 2
          const r = vert / horiz
          const fit = Math.min(Math.abs(Math.log(r / pageRatio)), Math.abs(Math.log(r * pageRatio)))
          if (fit > 0.35) continue
          const score = area * areaRatio * (1 - fit)
          if (score > bestScore) {
            bestScore = score
            best = q.map(({ x, y }) => ({ x, y }))
          }
        }
  if (!best) return null
  return orient(gray, layout, best)
}

/** Picks the rotation of the corner quad that puts the orientation mark where it belongs. */
export function orient(gray: GrayImage, layout: PageLayout, quad: Pt[]): Pt[] {
  let bestQ = quad,
    darkest = Infinity
  for (let rot = 0; rot < 4; rot++) {
    const q = [0, 1, 2, 3].map((i) => quad[(i + rot) % 4])
    const h = solveHomography(layout.markers, q)
    const v = patchMean(gray, h, ORIENT_MARK.x, ORIENT_MARK.y, ORIENT_MARK.size * 0.6)
    const bg = patchMean(gray, h, ORIENT_MARK.x, ORIENT_MARK.y + 9, 3)
    const score = v - bg
    if (score < darkest) {
      darkest = score
      bestQ = q
    }
  }
  return bestQ
}

export function pageToImage(layout: PageLayout, corners: Pt[]): Homography {
  return solveHomography(layout.markers, corners)
}

/**
 * Samples each cell into a CELL x CELL bitmap. `sensitivity` is the fraction of
 * the local paper brightness below which a pixel counts as ink (higher = more ink).
 */
export function extractCells(
  gray: GrayImage,
  layout: PageLayout,
  corners: Pt[],
  chars: string[],
  sensitivity: number,
): Record<string, Bitmap> {
  const h = pageToImage(layout, corners)
  const out: Record<string, Bitmap> = {}
  const vals = new Float32Array(CELL * CELL)
  const band = 5
  chars.forEach((ch, idx) => {
    const cell = layout.cells[idx]
    if (!cell) return
    for (let v = 0; v < CELL; v++)
      for (let u = 0; u < CELL; u++) {
        const p = applyH(h, cell.x + ((u + 0.5) / CELL) * cell.size, cell.y + ((v + 0.5) / CELL) * cell.size)
        vals[v * CELL + u] = sample(gray, p.x, p.y)
      }
    const hist = new Uint32Array(256)
    for (let i = 0; i < vals.length; i++) hist[Math.round(vals[i])]++
    let acc = 0,
      bg = 255
    for (let t = 255; t >= 0; t--) {
      acc += hist[t]
      if (acc >= vals.length * 0.1) {
        bg = t
        break
      }
    }
    const thr = Math.min(bg * sensitivity, bg - 30)
    const b = newBitmap()
    for (let y = band; y < CELL - band; y++)
      for (let x = band; x < CELL - band; x++) if (vals[y * CELL + x] < thr) b[y * CELL + x] = 1
    const clean = cleanScan(b)
    if (inkCount(clean) >= 25) out[ch] = clean
  })
  return out
}
