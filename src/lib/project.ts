import { decodeBitmap, encodeBitmap } from './bitmap'
import { DEFAULT_CHARSETS } from './charsets'
import { DEFAULT_SETTINGS, type FontSettings, type GlyphRecord } from './glyphs'
import type { PaperSize } from './template'

export interface Project {
  settings: FontSettings
  charsets: string[]
  paper: PaperSize
  glyphs: Record<string, GlyphRecord>
}

export const emptyProject = (): Project => ({
  settings: { ...DEFAULT_SETTINGS },
  charsets: [...DEFAULT_CHARSETS],
  paper: 'a4',
  glyphs: {},
})

interface Serialized {
  app: 'scribefont'
  version: 1
  settings: FontSettings
  charsets: string[]
  paper: PaperSize
  glyphs: Record<string, { bitmap: string; lsb: number; rsb: number; dy: number }>
}

export function serialize(p: Project): string {
  const glyphs: Serialized['glyphs'] = {}
  for (const [ch, g] of Object.entries(p.glyphs)) glyphs[ch] = { bitmap: encodeBitmap(g.bitmap), lsb: g.lsb, rsb: g.rsb, dy: g.dy }
  const s: Serialized = { app: 'scribefont', version: 1, settings: p.settings, charsets: p.charsets, paper: p.paper, glyphs }
  return JSON.stringify(s)
}

export function deserialize(json: string): Project {
  const s = JSON.parse(json) as Serialized
  if (s.app !== 'scribefont') throw new Error('Not a Scribefont project file')
  const glyphs: Record<string, GlyphRecord> = {}
  for (const [ch, g] of Object.entries(s.glyphs ?? {})) glyphs[ch] = { bitmap: decodeBitmap(g.bitmap), lsb: g.lsb, rsb: g.rsb, dy: g.dy }
  return {
    settings: { ...DEFAULT_SETTINGS, ...s.settings },
    charsets: s.charsets ?? [...DEFAULT_CHARSETS],
    paper: s.paper ?? 'a4',
    glyphs,
  }
}

const KEY = 'scribefont-project'

export function loadLocal(): Project {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return deserialize(raw)
  } catch {
    /* corrupt or unavailable storage: start fresh */
  }
  return emptyProject()
}

export function saveLocal(p: Project) {
  try {
    localStorage.setItem(KEY, serialize(p))
  } catch {
    /* quota or privacy mode: project still lives in memory */
  }
}

export function downloadBytes(data: Uint8Array | string, filename: string, type: string) {
  const blob = new Blob([data as BlobPart], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
