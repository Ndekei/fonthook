import { decodeBitmap, encodeBitmap } from './bitmap'
import { DEFAULT_CHARSETS } from './charsets'
import { DEFAULT_SETTINGS, type FontSettings, type GlyphRecord } from './glyphs'
import type { Stroke } from './strokes'
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
  app: 'fonte-generer' | 'scribefont'
  version: 1
  settings: FontSettings
  charsets: string[]
  paper: PaperSize
  glyphs: Record<string, { bitmap: string; base?: string; strokes?: Stroke[]; lsb: number; rsb: number; dy: number }>
}

export function serialize(p: Project): string {
  const glyphs: Serialized['glyphs'] = {}
  for (const [ch, g] of Object.entries(p.glyphs))
    glyphs[ch] = {
      bitmap: encodeBitmap(g.bitmap),
      base: g.base && encodeBitmap(g.base),
      strokes: g.strokes?.map((s) => ({ ...s, pts: s.pts.map((v) => Math.round(v * 100) / 100) })),
      lsb: g.lsb,
      rsb: g.rsb,
      dy: g.dy,
    }
  const s: Serialized = { app: 'fonte-generer', version: 1, settings: p.settings, charsets: p.charsets, paper: p.paper, glyphs }
  return JSON.stringify(s)
}

export function deserialize(json: string): Project {
  const s = JSON.parse(json) as Serialized
  if (s.app !== 'fonte-generer' && s.app !== 'scribefont') throw new Error('Not a Fonte Générer project file')
  const glyphs: Record<string, GlyphRecord> = {}
  for (const [ch, g] of Object.entries(s.glyphs ?? {}))
    glyphs[ch] = {
      bitmap: decodeBitmap(g.bitmap),
      base: g.base ? decodeBitmap(g.base) : undefined,
      strokes: g.strokes,
      lsb: g.lsb,
      rsb: g.rsb,
      dy: g.dy,
    }
  return {
    settings: { ...DEFAULT_SETTINGS, ...s.settings },
    charsets: s.charsets ?? [...DEFAULT_CHARSETS],
    paper: s.paper ?? 'a4',
    glyphs,
  }
}

const KEY = 'fonte-generer-project'
const OLD_KEY = 'scribefont-project'

export function loadLocal(): Project {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY)
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
