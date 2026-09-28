import { useEffect, useMemo, useRef, useState } from 'react'
import type { SetProject, StepId } from '../App'
import { buildAll, type FontSettings } from '../lib/glyphs'
import { buildOTF } from '../lib/otf'
import { deserialize, downloadBytes, emptyProject, serialize, type Project } from '../lib/project'
import { buildTTF, psName } from '../lib/ttf'
import { sfntToWoff } from '../lib/woff'
import Icon from './Icon'
import { Group, Segmented, SliderRow, useToast } from './ui'

interface Props {
  project: Project
  setProject: SetProject
  chars: string[]
  go: (s: StepId) => void
}

const SAMPLE = 'The quick brown fox jumps over the lazy dog.\nSphinx of black quartz, judge my vow!\n0123456789 — Hello, world?'

let previewSeq = 0

export default function ExportStep({ project, setProject, chars, go }: Props) {
  const toast = useToast()
  const { settings } = project
  const [text, setText] = useState(SAMPLE)
  const [size, setSize] = useState<'s' | 'm' | 'l'>('m')
  const [previewFamily, setPreviewFamily] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loaded = useRef<FontFace | null>(null)

  const built = useMemo(() => buildAll(project.glyphs, settings), [project.glyphs, settings])
  const missing = chars.filter((c) => !project.glyphs[c])

  // Build a real TTF and load it with the FontFace API, so the preview is exactly what you'll download.
  useEffect(() => {
    if (!built.length) return
    const t = window.setTimeout(async () => {
      try {
        const ttf = buildTTF(built, settings)
        const family = `fonte-generer-preview-${++previewSeq}`
        const face = new FontFace(family, ttf.buffer as ArrayBuffer)
        await face.load()
        document.fonts.add(face)
        if (loaded.current) document.fonts.delete(loaded.current)
        loaded.current = face
        setPreviewFamily(family)
        setError(null)
      } catch (e) {
        setError((e as Error).message)
      }
    }, 250)
    return () => window.clearTimeout(t)
  }, [built, settings])

  const set = <K extends keyof FontSettings>(k: K, v: FontSettings[K]) => setProject((p) => ({ ...p, settings: { ...p.settings, [k]: v } }))
  const base = `${psName(settings.family)}-${psName(settings.style)}`

  const exportFont = (kind: 'ttf' | 'otf' | 'woff') => {
    try {
      if (kind === 'otf') downloadBytes(buildOTF(built, settings), `${base}.otf`, 'font/otf')
      else if (kind === 'ttf') downloadBytes(buildTTF(built, settings), `${base}.ttf`, 'font/ttf')
      else downloadBytes(sfntToWoff(buildTTF(built, settings)), `${base}.woff`, 'font/woff')
      toast(`${base}.${kind} downloaded`, 'download')
    } catch (e) {
      alert(`Export failed: ${(e as Error).message}`)
    }
  }

  const loadProject = async (f: File | undefined) => {
    if (!f) return
    try {
      const p = deserialize(await f.text())
      setProject(() => p)
      toast('Project opened', 'folder')
    } catch (e) {
      alert(`Couldn't open project: ${(e as Error).message}`)
    }
  }

  const reset = () => {
    if (confirm('Start a new font? Every glyph in this one will be deleted. Save the project first if you might want it back.')) setProject(() => emptyProject())
  }

  const font = previewFamily ? `"${previewFamily}", ui-sans-serif` : undefined
  const px = { s: 28, m: 44, l: 72 }[size]

  if (!built.length)
    return (
      <div className="page-single">
        <div className="empty-state large">
          <Icon name="pen" size={36} />
          <h2>Nothing to export yet</h2>
          <p>Draw or scan a few characters first, and your font will show up here.</p>
          <button className="btn filled large" onClick={() => go('glyphs')}>
            Go to glyphs
          </button>
        </div>
      </div>
    )

  return (
    <div className="page-grid wide-right">
      <div className="page-col">
        <header className="page-head">
          <h1>Export</h1>
          <p>Fine-tune the font, then download it. Double-click the file to install it.</p>
        </header>

        <div className="card download-card">
          <div className="font-file-icon" aria-hidden style={{ fontFamily: font }}>
            Aa
          </div>
          <div className="download-meta">
            <strong className="truncate">{settings.family || 'Untitled'}</strong>
            <span className="muted small">
              {built.length} characters
              {missing.length > 0 && ` · ${missing.length} not drawn yet`}
            </span>
          </div>
          <button className="btn filled large block" onClick={() => exportFont('ttf')}>
            <Icon name="download" /> Download font (.ttf)
          </button>
          <div className="button-row center">
            <button className="btn plain" onClick={() => exportFont('otf')}>
              OpenType .otf
            </button>
            <button className="btn plain" onClick={() => exportFont('woff')}>
              Web .woff
            </button>
          </div>
        </div>

        <Group title="Name">
          <label className="row-item field-row">
            <span>Family</span>
            <input type="text" value={settings.family} maxLength={48} onChange={(e) => set('family', e.target.value)} />
          </label>
          <label className="row-item field-row">
            <span>Style</span>
            <input type="text" value={settings.style} maxLength={32} onChange={(e) => set('style', e.target.value)} />
          </label>
        </Group>

        <Group title="Adjust" footer="Changes apply to every character and show in the preview straight away.">
          <SliderRow label="Weight" value={settings.weight} min={-3} max={4} onChange={(v) => set('weight', v)} format={(v) => (v === 0 ? 'Natural' : v > 0 ? `Bolder +${v}` : `Lighter ${v}`)} />
          <SliderRow label="Smoothing" value={settings.smooth} min={0} max={8} onChange={(v) => set('smooth', v)} />
          <SliderRow label="Detail" value={settings.tolerance} min={0.3} max={2.5} step={0.1} onChange={(v) => set('tolerance', v)} format={(v) => (v <= 0.6 ? 'Fine' : v >= 1.6 ? 'Simple' : 'Balanced')} />
          <SliderRow label="Letter spacing" value={settings.tracking} min={-120} max={200} step={5} onChange={(v) => set('tracking', v)} />
          <SliderRow label="Word spacing" value={settings.spaceWidth} min={100} max={800} step={10} onChange={(v) => set('spaceWidth', v)} />
        </Group>

        {missing.length > 0 && (
          <Group title="Not drawn yet" footer="These characters will be left out of the font.">
            <div className="missing-chars">
              {missing.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          </Group>
        )}

        <Group title="Project" footer="Your work autosaves in this browser. Save a project file to back it up or move it to another device.">
          <button className="row-item action-row" onClick={() => downloadBytes(serialize(project), `${base}.fonte-generer.json`, 'application/json')}>
            <Icon name="download" /> Save project file
          </button>
          <label className="row-item action-row">
            <Icon name="upload" /> Open project file
            <input type="file" accept=".json,application/json" hidden onChange={(e) => loadProject(e.target.files?.[0])} />
          </label>
          <button className="row-item action-row destructive" onClick={reset}>
            <Icon name="plus" /> Start a new font
          </button>
        </Group>
      </div>

      <div className="page-col sticky">
        <div className="card preview-sheet">
          <div className="preview-head">
            <span className="eyebrow">Live preview</span>
            <Segmented
              label="Preview size"
              size="sm"
              value={size}
              onChange={setSize}
              options={[
                { value: 's', label: 'S' },
                { value: 'm', label: 'M' },
                { value: 'l', label: 'L' },
              ]}
            />
          </div>
          {error && <p className="badge warning">Preview error: {error}</p>}
          <textarea
            className="preview-text"
            value={text}
            spellCheck={false}
            aria-label="Preview text"
            onChange={(e) => setText(e.target.value)}
            style={{ fontFamily: font, fontSize: px }}
          />
          <div className="waterfall" aria-hidden>
            {[14, 18, 24, 32].map((s) => (
              <div key={s}>
                <span className="size-tag">{s}</span>
                <span style={{ fontFamily: font, fontSize: s }}>{text.split('\n')[0] || SAMPLE.split('\n')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
