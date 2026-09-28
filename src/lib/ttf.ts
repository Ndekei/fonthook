import { ASCENDER, CAP_HEIGHT, DESCENDER, UNITS_PER_EM, X_HEIGHT } from './geometry'
import type { BuiltGlyph, FontSettings } from './glyphs'
import type { Contour } from './trace'

// Minimal but complete TrueType (glyf-flavoured sfnt) writer.

class Buf {
  bytes: number[] = []
  u8(v: number) {
    this.bytes.push(v & 0xff)
  }
  u16(v: number) {
    this.u8(v >> 8)
    this.u8(v)
  }
  i16(v: number) {
    this.u16(v < 0 ? v + 0x10000 : v)
  }
  u32(v: number) {
    this.u16(v >>> 16)
    this.u16(v & 0xffff)
  }
  tag(s: string) {
    for (let i = 0; i < 4; i++) this.u8(s.charCodeAt(i))
  }
  append(b: number[] | Uint8Array) {
    for (const v of b) this.bytes.push(v)
  }
  pad4() {
    while (this.bytes.length % 4) this.u8(0)
  }
  get length() {
    return this.bytes.length
  }
}

interface OutGlyph {
  advance: number
  contours: Contour[] // font units, TrueType orientation
  unicodes: number[]
}

function checksum(bytes: number[]) {
  let sum = 0
  for (let i = 0; i < bytes.length; i += 4)
    sum = (sum + (((bytes[i] << 24) | ((bytes[i + 1] ?? 0) << 16) | ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0)) >>> 0)) >>> 0
  return sum
}

function bbox(cs: Contour[]) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity
  for (const c of cs)
    for (const p of c) {
      x0 = Math.min(x0, p.x)
      y0 = Math.min(y0, p.y)
      x1 = Math.max(x1, p.x)
      y1 = Math.max(y1, p.y)
    }
  return cs.length ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: 0, y1: 0 }
}

function encodeGlyf(g: OutGlyph): number[] {
  if (!g.contours.length) return []
  const b = new Buf()
  const bb = bbox(g.contours)
  b.i16(g.contours.length)
  b.i16(bb.x0)
  b.i16(bb.y0)
  b.i16(bb.x1)
  b.i16(bb.y1)
  let end = -1
  for (const c of g.contours) {
    end += c.length
    b.u16(end)
  }
  b.u16(0) // no instructions
  const flags: number[] = [],
    xs = new Buf(),
    ys = new Buf()
  let px = 0,
    py = 0
  for (const c of g.contours)
    for (const p of c) {
      let f = p.on ? 1 : 0
      const dx = p.x - px,
        dy = p.y - py
      if (dx === 0) f |= 0x10
      else if (Math.abs(dx) < 256) {
        f |= 0x02 | (dx > 0 ? 0x10 : 0)
        xs.u8(Math.abs(dx))
      } else xs.i16(dx)
      if (dy === 0) f |= 0x20
      else if (Math.abs(dy) < 256) {
        f |= 0x04 | (dy > 0 ? 0x20 : 0)
        ys.u8(Math.abs(dy))
      } else ys.i16(dy)
      flags.push(f)
      px = p.x
      py = p.y
    }
  b.append(flags)
  b.append(xs.bytes)
  b.append(ys.bytes)
  b.pad4()
  return b.bytes
}

function notdef(): OutGlyph {
  const r = (x0: number, y0: number, x1: number, y1: number, cw: boolean): Contour => {
    const pts = [
      { x: x0, y: y0, on: true },
      { x: x0, y: y1, on: true },
      { x: x1, y: y1, on: true },
      { x: x1, y: y0, on: true },
    ]
    return cw ? pts : pts.reverse()
  }
  return { advance: 500, unicodes: [], contours: [r(50, 0, 450, 700, true), r(100, 50, 400, 650, false)] }
}

function utf16be(s: string) {
  const out: number[] = []
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    out.push(c >> 8, c & 0xff)
  }
  return out
}

export function psName(s: string) {
  return s.replace(/[^A-Za-z0-9-]/g, '').slice(0, 60) || 'Untitled'
}

export function buildTTF(built: BuiltGlyph[], s: FontSettings): Uint8Array {
  const family = s.family.trim() || 'Untitled'
  const style = s.style.trim() || 'Regular'
  const glyphs: OutGlyph[] = [
    notdef(),
    { advance: s.spaceWidth, unicodes: [0x20, 0xa0], contours: [] },
    ...built
      .filter((g) => g.unicode !== 0x20 && g.unicode !== 0xa0)
      .map((g) => ({ advance: g.advance, unicodes: [g.unicode], contours: g.contours })),
  ]

  // glyf + loca
  const glyf = new Buf()
  const loca = new Buf()
  const boxes = glyphs.map((g) => bbox(g.contours))
  for (const g of glyphs) {
    loca.u32(glyf.length)
    glyf.append(encodeGlyf(g))
  }
  loca.u32(glyf.length)

  const inked = glyphs.map((g, i) => ({ g, b: boxes[i] })).filter(({ g }) => g.contours.length)
  const xMin = Math.min(...inked.map((e) => e.b.x0))
  const yMin = Math.min(...inked.map((e) => e.b.y0))
  const xMax = Math.max(...inked.map((e) => e.b.x1))
  const yMax = Math.max(...inked.map((e) => e.b.y1))
  const winAscent = Math.max(ASCENDER, yMax)
  const winDescent = Math.max(-DESCENDER, -yMin)

  // head
  const head = new Buf()
  const now = BigInt(Math.floor(Date.now() / 1000)) + 2082844800n
  head.u32(0x00010000)
  head.u32(0x00010000)
  head.u32(0) // checkSumAdjustment, patched below
  head.u32(0x5f0f3cf5)
  head.u16(0x000b)
  head.u16(UNITS_PER_EM)
  for (let k = 0; k < 2; k++) {
    head.u32(Number(now >> 32n))
    head.u32(Number(now & 0xffffffffn))
  }
  head.i16(xMin)
  head.i16(yMin)
  head.i16(xMax)
  head.i16(yMax)
  head.u16(0) // macStyle
  head.u16(8) // lowestRecPPEM
  head.i16(2)
  head.i16(1) // long loca
  head.i16(0)

  // hhea + hmtx
  const hmtx = new Buf()
  let minRsb = Infinity,
    maxExtent = 0,
    minLsb = Infinity
  glyphs.forEach((g, i) => {
    hmtx.u16(g.advance)
    hmtx.i16(boxes[i].x0)
    if (g.contours.length) {
      minLsb = Math.min(minLsb, boxes[i].x0)
      minRsb = Math.min(minRsb, g.advance - boxes[i].x1)
      maxExtent = Math.max(maxExtent, boxes[i].x1)
    }
  })
  const hhea = new Buf()
  hhea.u32(0x00010000)
  hhea.i16(winAscent)
  hhea.i16(-winDescent)
  hhea.i16(0)
  hhea.u16(Math.max(...glyphs.map((g) => g.advance)))
  hhea.i16(minLsb)
  hhea.i16(minRsb)
  hhea.i16(maxExtent)
  hhea.i16(1)
  hhea.i16(0)
  hhea.i16(0)
  for (let k = 0; k < 4; k++) hhea.i16(0)
  hhea.i16(0)
  hhea.u16(glyphs.length)

  // maxp
  const maxp = new Buf()
  maxp.u32(0x00010000)
  maxp.u16(glyphs.length)
  maxp.u16(Math.max(...glyphs.map((g) => g.contours.reduce((n, c) => n + c.length, 0))))
  maxp.u16(Math.max(...glyphs.map((g) => g.contours.length)))
  maxp.u16(0)
  maxp.u16(0)
  maxp.u16(2)
  for (let k = 0; k < 8; k++) maxp.u16(0)

  // cmap (format 4, one segment per code point)
  const map = new Map<number, number>()
  glyphs.forEach((g, gid) => g.unicodes.forEach((u) => u <= 0xffff && map.set(u, gid)))
  const codes = [...map.keys()].sort((a, b) => a - b)
  const segs = [...codes.map((c) => ({ start: c, end: c, delta: (map.get(c)! - c + 0x10000) & 0xffff })), { start: 0xffff, end: 0xffff, delta: 1 }]
  const segX2 = segs.length * 2
  const log = Math.floor(Math.log2(segs.length))
  const sub = new Buf()
  sub.u16(4)
  sub.u16(16 + segs.length * 8)
  sub.u16(0)
  sub.u16(segX2)
  sub.u16(2 * 2 ** log)
  sub.u16(log)
  sub.u16(segX2 - 2 * 2 ** log)
  segs.forEach((g) => sub.u16(g.end))
  sub.u16(0)
  segs.forEach((g) => sub.u16(g.start))
  segs.forEach((g) => sub.u16(g.delta))
  segs.forEach(() => sub.u16(0))
  const cmap = new Buf()
  cmap.u16(0)
  cmap.u16(2)
  cmap.u16(0)
  cmap.u16(3)
  cmap.u32(20)
  cmap.u16(3)
  cmap.u16(1)
  cmap.u32(20)
  cmap.append(sub.bytes)

  // name
  const ps = `${psName(family)}-${psName(style)}`
  const names: [number, string][] = [
    [0, `Created with Fonte Générer by the font's author.`],
    [1, family],
    [2, style],
    [3, `${ps};${new Date().toISOString().slice(0, 10)}`],
    [4, style === 'Regular' ? family : `${family} ${style}`],
    [5, 'Version 1.000'],
    [6, ps],
  ]
  const name = new Buf()
  name.u16(0)
  name.u16(names.length)
  name.u16(6 + names.length * 12)
  const strings: number[] = []
  for (const [id, str] of names) {
    const enc = utf16be(str)
    name.u16(3)
    name.u16(1)
    name.u16(0x409)
    name.u16(id)
    name.u16(enc.length)
    name.u16(strings.length)
    strings.push(...enc)
  }
  name.append(strings)

  // OS/2 v4
  const avg = Math.round(glyphs.filter((g) => g.advance > 0).reduce((n, g) => n + g.advance, 0) / glyphs.length)
  const allCodes = codes.filter((c) => c !== 0xffff)
  const os2 = new Buf()
  os2.u16(4)
  os2.i16(avg)
  os2.u16(400)
  os2.u16(5)
  os2.u16(0) // fsType: installable embedding
  for (const v of [650, 600, 0, 75, 650, 600, 0, 350, 50, 300]) os2.i16(v)
  os2.i16(0)
  os2.append([2, 0, 0, 0, 0, 0, 0, 0, 0, 0]) // panose: script family
  os2.u32(0b11) // Basic Latin + Latin-1 Supplement
  os2.u32(0)
  os2.u32(0)
  os2.u32(0)
  os2.tag('NONE')
  os2.u16(0x40 | 0x80) // REGULAR | USE_TYPO_METRICS
  os2.u16(Math.min(...allCodes))
  os2.u16(Math.min(0xffff, Math.max(...allCodes)))
  os2.i16(ASCENDER)
  os2.i16(DESCENDER)
  os2.i16(0)
  os2.u16(winAscent)
  os2.u16(winDescent)
  os2.u32(1) // Latin 1 code page
  os2.u32(0)
  os2.i16(X_HEIGHT)
  os2.i16(CAP_HEIGHT)
  os2.u16(0)
  os2.u16(32)
  os2.u16(2)

  const post = new Buf()
  post.u32(0x00030000)
  post.u32(0)
  post.i16(-100)
  post.i16(50)
  for (let k = 0; k < 5; k++) post.u32(0)

  const tables: [string, Buf][] = (
    [
      ['OS/2', os2],
      ['cmap', cmap],
      ['glyf', glyf],
      ['head', head],
      ['hhea', hhea],
      ['hmtx', hmtx],
      ['loca', loca],
      ['maxp', maxp],
      ['name', name],
      ['post', post],
    ] as [string, Buf][]
  ).sort(([a], [b]) => (a < b ? -1 : 1))

  const n = tables.length
  const sr = 16 * 2 ** Math.floor(Math.log2(n))
  const out = new Buf()
  out.u32(0x00010000)
  out.u16(n)
  out.u16(sr)
  out.u16(Math.floor(Math.log2(n)))
  out.u16(n * 16 - sr)
  let offset = 12 + n * 16
  let headOffset = 0
  for (const [tag, t] of tables) {
    out.tag(tag)
    out.u32(checksum(t.bytes))
    out.u32(offset)
    out.u32(t.length)
    if (tag === 'head') headOffset = offset
    offset += Math.ceil(t.length / 4) * 4
  }
  for (const [, t] of tables) {
    out.append(t.bytes)
    out.pad4()
  }
  const adj = (0xb1b0afba - checksum(out.bytes)) >>> 0
  const bytes = new Uint8Array(out.bytes)
  new DataView(bytes.buffer).setUint32(headOffset + 8, adj)
  return bytes
}
