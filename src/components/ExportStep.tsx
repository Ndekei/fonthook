import { useEffect, useMemo, useRef, useState } from 'react'
import type { SetProject } from '../App'
import { buildAll, type FontSettings } from '../lib/glyphs'
import { buildOTF } from '../lib/otf'
import { deserialize, downloadBytes, emptyProject, serialize, type Project } from '../lib/project'
import { buildTTF, psName } from '../lib/ttf'
import { sfntToWoff } from '../lib/woff'

interface Props {
  project: Project
  setProject: SetProject
  chars: string[]
}

const SAMPLE = 'The quick brown fox jumps over the lazy dog.\nSphinx of black quartz, judge my vow!\n0123456789 — Hello, world?'

let previewSeq = 0

export default function ExportStep({ project, setProject, chars }: Props) {
  const { settings } = project
  const [text, setText] = useState(SAMPLE)
  const [size, setSize] = useState(48)
  const [previewFamily, setPreviewFamily] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loaded = useRef<FontFace | null>(null)

  const built = useMemo(() => buildAll(project.glyphs, settings), [project.glyphs, settings])
  const missing = chars.filter((c) => !project.glyphs[c])

  // Build a real TTF and load it via the FontFace API, so the preview is exactly what you'll download.
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
    } catch (e) {
      alert(`Export failed: ${(e as Error).message}`)
    }
  }

  const loadProject = async (f: File | undefined) => {
    if (!f) return
    try {
      const p = deserialize(await f.text())
      setProject(() => p)
    } catch (e) {
      alert(`Couldn't open project: ${(e as Error).message}`)
    }
  }

  const reset = () => {
    if (confirm('Delete every glyph and start a new font? Save the project first if you may want it back.')) setProject(() => emptyProject())
  }

  return (
    <section className="step two-col wide-right">
      <div className="panel">
        <h2>Font settings</h2>
        <label className="field">
          <span>Font name</span>
          <input value={settings.family} maxLength={48} onChange={(e) => set('family', e.target.value)} />
        </label>
        <label className="field">
          <span>Style name</span>
          <input value={settings.style} maxLength={32} onChange={(e) => set('style', e.target.value)} />
        </label>
        <Slider label="Stroke weight" value={settings.weight} min={-3} max={4} step={1} onChange={(v) => set('weight', v)} fmt={(v) => (v > 0 ? `+${v}` : `${v}`)} />
        <Slider label="Smoothing" value={settings.smooth} min={0} max={8} step={1} onChange={(v) => set('smooth', v)} />
        <Slider label="Outline detail" value={settings.tolerance} min={0.3} max={2.5} step={0.1} onChange={(v) => set('tolerance', v)} fmt={(v) => (v <= 0.6 ? 'fine' : v >= 1.6 ? 'simple' : 'balanced')} />
        <Slider label="Letter spacing" value={settings.tracking} min={-120} max={200} step={5} onChange={(v) => set('tracking', v)} />
        <Slider label="Word spacing" value={settings.spaceWidth} min={100} max={800} step={10} onChange={(v) => set('spaceWidth', v)} />

        <h2 className="spaced">Download</h2>
        {!built.length ? (
          <p className="muted">Add some glyphs first.</p>
        ) : (
          <>
            <div className="actions">
              <button className="primary" onClick={() => exportFont('ttf')}>
                Download .ttf
              </button>
              <button onClick={() => exportFont('otf')}>.otf</button>
              <button onClick={() => exportFont('woff')}>.woff (web)</button>
            </div>
            <p className="muted small">
              {built.length} glyphs. TTF works everywhere: Windows, macOS, Linux, Word, Photoshop, Canva, Cricut. Double-click the file to install
              it.
              {missing.length > 0 && (
                <>
                  {' '}
                  Still empty: <span className="missing">{missing.join(' ')}</span>
                </>
              )}
            </p>
          </>
        )}

        <h2 className="spaced">Project</h2>
        <p className="muted small">Work autosaves in this browser. Save a project file to move it or keep a backup.</p>
        <div className="actions">
          <button onClick={() => downloadBytes(serialize(project), `${base}.fonte-generer.json`, 'application/json')}>Save project</button>
          <label className="button">
            Open project
            <input type="file" accept=".json,application/json" hidden onChange={(e) => loadProject(e.target.files?.[0])} />
          </label>
          <button className="danger" onClick={reset}>
            New font
          </button>
        </div>
      </div>
      <div className="panel">
        <div className="row between">
          <h2>Preview</h2>
          <label className="row small">
            Size
            <input type="range" min={16} max={120} value={size} onChange={(e) => setSize(+e.target.value)} />
          </label>
        </div>
        {error && <p className="badge warn">Preview error: {error}</p>}
        <textarea
          className="preview-text"
          value={text}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          style={{ fontFamily: previewFamily ? `"${previewFamily}", monospace` : undefined, fontSize: size }}
        />
        <div className="waterfall">
          {[14, 20, 28, 40].map((s) => (
            <div key={s} style={{ fontFamily: previewFamily ? `"${previewFamily}"` : undefined, fontSize: s }}>
              {text.split('\n')[0] || SAMPLE.split('\n')[0]}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Slider(props: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="field">
      <span>
        {props.label}: {props.fmt ? props.fmt(props.value) : props.value}
      </span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(+e.target.value)} />
    </label>
  )
}
