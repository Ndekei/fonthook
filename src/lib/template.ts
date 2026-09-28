import { GUIDE } from './geometry'

// Template layout, in millimetres. The four solid corner markers are what the
// scanner looks for; everything else is printed in light blue so it drops out
// when the scan is thresholded.

export type PaperSize = 'a4' | 'letter'

export const PAPER: Record<PaperSize, { w: number; h: number; label: string }> = {
  a4: { w: 210, h: 297, label: 'A4' },
  letter: { w: 215.9, h: 279.4, label: 'US Letter' },
}

const MARKER = 10
const MARKER_INSET = 7
const GRID_MARGIN_X = 20
const GRID_TOP = 26
const GRID_BOTTOM = 22
const LABEL_H = 5
const COLS = 7
export const GUIDE_COLOR = '#9ec5f0'

/** Small square beside the top-left marker that tells the scanner which way is up. */
export const ORIENT_MARK = { x: MARKER_INSET + MARKER + 5, y: MARKER_INSET + MARKER / 2, size: 5 }

export interface CellRect {
  x: number
  y: number
  size: number
}

export interface PageLayout {
  paper: PaperSize
  w: number
  h: number
  /** Marker centres: top-left, top-right, bottom-right, bottom-left. */
  markers: { x: number; y: number }[]
  cellSize: number
  cellsPerPage: number
  cells: CellRect[]
}

export function pageLayout(paper: PaperSize): PageLayout {
  const { w, h } = PAPER[paper]
  const c = MARKER_INSET + MARKER / 2
  const markers = [
    { x: c, y: c },
    { x: w - c, y: c },
    { x: w - c, y: h - c },
    { x: c, y: h - c },
  ]
  const cellSize = (w - 2 * GRID_MARGIN_X) / COLS
  const pitch = cellSize + LABEL_H
  const rows = Math.floor((h - GRID_TOP - GRID_BOTTOM) / pitch)
  const cells: CellRect[] = []
  for (let r = 0; r < rows; r++)
    for (let col = 0; col < COLS; col++)
      cells.push({ x: GRID_MARGIN_X + col * cellSize, y: GRID_TOP + LABEL_H + r * pitch, size: cellSize })
  return { paper, w, h, markers, cellSize, cellsPerPage: cells.length, cells }
}

export function pageCount(chars: string[], paper: PaperSize) {
  return Math.max(1, Math.ceil(chars.length / pageLayout(paper).cellsPerPage))
}

export function charsOnPage(chars: string[], paper: PaperSize, page: number) {
  const n = pageLayout(paper).cellsPerPage
  return chars.slice(page * n, (page + 1) * n)
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function templateSvg(chars: string[], paper: PaperSize, page: number, fontName: string): string {
  const L = pageLayout(paper)
  const total = pageCount(chars, paper)
  const pageChars = charsOnPage(chars, paper, page)
  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${L.w}mm" height="${L.h}mm" viewBox="0 0 ${L.w} ${L.h}">`,
    `<rect width="${L.w}" height="${L.h}" fill="#fff"/>`,
  )
  for (const m of L.markers)
    parts.push(`<rect x="${m.x - MARKER / 2}" y="${m.y - MARKER / 2}" width="${MARKER}" height="${MARKER}" fill="#000"/>`)
  const o = ORIENT_MARK
  parts.push(`<rect x="${o.x - o.size / 2}" y="${o.y - o.size / 2}" width="${o.size}" height="${o.size}" fill="#000"/>`)
  parts.push(
    `<text x="${GRID_MARGIN_X + 12}" y="15" font-family="Helvetica, Arial, sans-serif" font-size="4.2" fill="#666">` +
      `${esc(fontName || 'My Handwriting')} — page ${page + 1} of ${total}</text>`,
    `<text x="${GRID_MARGIN_X + 12}" y="20.5" font-family="Helvetica, Arial, sans-serif" font-size="2.6" fill="#888">` +
      `One character per box, dark pen. Sit letters on the solid line. Keep the black squares clear.</text>`,
  )
  pageChars.forEach((ch, i) => {
    const c = L.cells[i]
    const s = c.size
    const g = (f: number) => (c.y + f * s).toFixed(2)
    parts.push(
      `<rect x="${c.x}" y="${c.y}" width="${s}" height="${s}" fill="none" stroke="${GUIDE_COLOR}" stroke-width="0.3"/>`,
      `<line x1="${c.x}" x2="${c.x + s}" y1="${g(GUIDE.cap)}" y2="${g(GUIDE.cap)}" stroke="${GUIDE_COLOR}" stroke-width="0.2" stroke-dasharray="1 1"/>`,
      `<line x1="${c.x}" x2="${c.x + s}" y1="${g(GUIDE.xHeight)}" y2="${g(GUIDE.xHeight)}" stroke="${GUIDE_COLOR}" stroke-width="0.2" stroke-dasharray="1 1"/>`,
      `<line x1="${c.x}" x2="${c.x + s}" y1="${g(GUIDE.baseline)}" y2="${g(GUIDE.baseline)}" stroke="${GUIDE_COLOR}" stroke-width="0.35"/>`,
      `<text x="${c.x + 0.8}" y="${c.y - 1.2}" font-family="Helvetica, Arial, sans-serif" font-size="3.4" fill="${GUIDE_COLOR}">${esc(ch)}</text>`,
    )
  })
  parts.push('</svg>')
  return parts.join('')
}
