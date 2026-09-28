import { zlibSync } from 'fflate'

/** Wraps an sfnt (TTF/OTF) in a WOFF 1.0 container. */
export function sfntToWoff(sfnt: Uint8Array): Uint8Array {
  const dv = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength)
  const flavor = dv.getUint32(0)
  const n = dv.getUint16(4)
  const entries: { tag: number; checksum: number; data: Uint8Array; origLength: number }[] = []
  let totalSfnt = 12 + 16 * n
  for (let i = 0; i < n; i++) {
    const rec = 12 + i * 16
    const offset = dv.getUint32(rec + 8)
    const length = dv.getUint32(rec + 12)
    const orig = sfnt.subarray(offset, offset + length)
    const z = zlibSync(orig, { level: 9 })
    entries.push({ tag: dv.getUint32(rec), checksum: dv.getUint32(rec + 4), data: z.length < length ? z : orig, origLength: length })
    totalSfnt += Math.ceil(length / 4) * 4
  }
  let size = 44 + 20 * n
  const offsets = entries.map((e) => {
    const o = size
    size += Math.ceil(e.data.length / 4) * 4
    return o
  })
  const out = new Uint8Array(size)
  const w = new DataView(out.buffer)
  w.setUint32(0, 0x774f4646) // 'wOFF'
  w.setUint32(4, flavor)
  w.setUint32(8, size)
  w.setUint16(12, n)
  w.setUint32(16, totalSfnt)
  w.setUint16(20, 1)
  entries.forEach((e, i) => {
    const d = 44 + i * 20
    w.setUint32(d, e.tag)
    w.setUint32(d + 4, offsets[i])
    w.setUint32(d + 8, e.data.length)
    w.setUint32(d + 12, e.origLength)
    w.setUint32(d + 16, e.checksum)
    out.set(e.data, offsets[i])
  })
  return out
}
