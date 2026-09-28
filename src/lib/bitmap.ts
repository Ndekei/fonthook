import { deflateSync, inflateSync } from 'fflate'
import { CELL } from './geometry'

/** A CELL x CELL binary image, 1 = ink. */
export type Bitmap = Uint8Array

export const newBitmap = (): Bitmap => new Uint8Array(CELL * CELL)

export function inkCount(b: Bitmap) {
  let n = 0
  for (let i = 0; i < b.length; i++) n += b[i]
  return n
}

export function inkBounds(b: Bitmap) {
  let x0 = CELL,
    y0 = CELL,
    x1 = -1,
    y1 = -1
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++)
      if (b[y * CELL + x]) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 }
}

/** Labels 8-connected ink components; returns labels and per-component pixel counts. */
function components(b: Bitmap) {
  const labels = new Int32Array(b.length).fill(-1)
  const sizes: number[] = []
  const boxes: { x0: number; y0: number; x1: number; y1: number }[] = []
  const stack: number[] = []
  for (let i = 0; i < b.length; i++) {
    if (!b[i] || labels[i] >= 0) continue
    const id = sizes.length
    let size = 0
    const box = { x0: CELL, y0: CELL, x1: 0, y1: 0 }
    labels[i] = id
    stack.push(i)
    while (stack.length) {
      const p = stack.pop()!
      size++
      const px = p % CELL,
        py = (p / CELL) | 0
      if (px < box.x0) box.x0 = px
      if (px > box.x1) box.x1 = px
      if (py < box.y0) box.y0 = py
      if (py > box.y1) box.y1 = py
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx,
            ny = py + dy
          if (nx < 0 || ny < 0 || nx >= CELL || ny >= CELL) continue
          const q = ny * CELL + nx
          if (b[q] && labels[q] < 0) {
            labels[q] = id
            stack.push(q)
          }
        }
    }
    sizes.push(size)
    boxes.push(box)
  }
  return { labels, sizes, boxes }
}

/**
 * Removes specks and leftover box-border slivers from a freshly scanned cell.
 * Keeps anything reasonably sized so dots on i/j and periods survive.
 */
export function cleanScan(b: Bitmap, minArea = 14): Bitmap {
  const { labels, sizes, boxes } = components(b)
  const keep = sizes.map((s, i) => {
    if (s < minArea) return false
    const bx = boxes[i]
    const w = bx.x1 - bx.x0 + 1,
      h = bx.y1 - bx.y0 + 1
    const touchesEdge = bx.x0 === 0 || bx.y0 === 0 || bx.x1 === CELL - 1 || bx.y1 === CELL - 1
    // Thin line hugging the edge = printed cell border, not handwriting.
    if (touchesEdge && Math.min(w, h) <= 6 && Math.max(w, h) > CELL * 0.3) return false
    return true
  })
  const out = newBitmap()
  for (let i = 0; i < b.length; i++) if (b[i] && keep[labels[i]]) out[i] = 1
  return out
}

/** Grows (r > 0) or shrinks (r < 0) ink by a disc of radius |r| pixels. */
export function morph(b: Bitmap, r: number): Bitmap {
  if (r === 0) return b
  const rad = Math.abs(r)
  const grow = r > 0
  const offs: [number, number][] = []
  for (let dy = -rad; dy <= rad; dy++)
    for (let dx = -rad; dx <= rad; dx++) if (dx * dx + dy * dy <= rad * rad + rad * 0.5) offs.push([dx, dy])
  const out = newBitmap()
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      let v = grow ? 0 : 1
      for (const [dx, dy] of offs) {
        const nx = x + dx,
          ny = y + dy
        const s = nx >= 0 && ny >= 0 && nx < CELL && ny < CELL ? b[ny * CELL + nx] : 0
        if (grow && s) {
          v = 1
          break
        }
        if (!grow && !s) {
          v = 0
          break
        }
      }
      out[y * CELL + x] = v
    }
  return out
}

export function encodeBitmap(b: Bitmap): string {
  const packed = new Uint8Array(Math.ceil(b.length / 8))
  for (let i = 0; i < b.length; i++) if (b[i]) packed[i >> 3] |= 1 << (i & 7)
  const z = deflateSync(packed, { level: 9 })
  let s = ''
  for (let i = 0; i < z.length; i++) s += String.fromCharCode(z[i])
  return btoa(s)
}

export function decodeBitmap(s: string): Bitmap {
  const bin = atob(s)
  const z = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) z[i] = bin.charCodeAt(i)
  const packed = inflateSync(z)
  const b = newBitmap()
  for (let i = 0; i < b.length; i++) b[i] = (packed[i >> 3] >> (i & 7)) & 1
  return b
}

/** Renders a bitmap into RGBA ImageData (ink colour on transparent). */
export function bitmapToImageData(b: Bitmap, rgb: [number, number, number] = [20, 20, 30]) {
  const img = new ImageData(CELL, CELL)
  for (let i = 0; i < b.length; i++)
    if (b[i]) {
      img.data[i * 4] = rgb[0]
      img.data[i * 4 + 1] = rgb[1]
      img.data[i * 4 + 2] = rgb[2]
      img.data[i * 4 + 3] = 255
    }
  return img
}
