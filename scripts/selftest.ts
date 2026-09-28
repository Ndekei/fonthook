// Node self-test: synthesise a few glyph bitmaps, build fonts, write them out.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { newBitmap } from '../src/lib/bitmap'
import { CELL } from '../src/lib/geometry'
import { buildAll, DEFAULT_SETTINGS, newRecord, type GlyphRecord } from '../src/lib/glyphs'
import { buildOTF } from '../src/lib/otf'
import { buildTTF } from '../src/lib/ttf'
import { sfntToWoff } from '../src/lib/woff'

const shape = (f: (x: number, y: number) => boolean) => {
  const b = newBitmap()
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) if (f(x, y)) b[y * CELL + x] = 1
  return b
}
const ring = (cx: number, cy: number, r0: number, r1: number) => (x: number, y: number) => {
  const d = Math.hypot(x - cx, y - cy)
  return d >= r0 && d <= r1
}
const glyphs: Record<string, GlyphRecord> = {
  O: newRecord(shape(ring(160, 152, 50, 66))),
  o: newRecord(shape(ring(160, 192, 26, 38))),
  I: newRecord(shape((x, y) => x > 150 && x < 168 && y > 80 && y < 224)),
  i: newRecord(shape((x, y) => (x > 152 && x < 166 && y > 144 && y < 224) || Math.hypot(x - 159, y - 118) < 9)),
  e: newRecord(shape((x, y) => ring(160, 192, 26, 38)(x, y) && !(x > 170 && y > 196 && y < 212) || (y > 186 && y < 196 && x > 124 && x < 196))),
}
const built = buildAll(glyphs, { ...DEFAULT_SETTINGS, family: 'Self Test' })
for (const g of built) console.log(g.char, 'adv', g.advance, 'contours', g.contours.length, 'pts', g.contours.map((c) => c.length).join(','))
const ttf = buildTTF(built, { ...DEFAULT_SETTINGS, family: 'Self Test' })
const otf = buildOTF(built, { ...DEFAULT_SETTINGS, family: 'Self Test' })
const out = process.argv[2] ?? mkdtempSync(join(tmpdir(), 'scribefont-'))
writeFileSync(`${out}/test.ttf`, ttf)
writeFileSync(`${out}/test.otf`, otf)
writeFileSync(`${out}/test.woff`, sfntToWoff(ttf))
console.log('ttf', ttf.length, 'otf', otf.length, '->', out)
