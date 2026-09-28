import { useState } from 'react'
import type { SetProject } from '../App'
import { CHARSETS } from '../lib/charsets'
import { downloadBytes, type Project } from '../lib/project'
import { PAPER, pageCount, templateSvg, type PaperSize } from '../lib/template'

interface Props {
  project: Project
  setProject: SetProject
  chars: string[]
  next: () => void
}

export default function TemplateStep({ project, setProject, chars, next }: Props) {
  const { paper, charsets, settings } = project
  const pages = pageCount(chars, paper)
  const [preview, setPreview] = useState(0)
  const page = Math.min(preview, pages - 1)

  const toggle = (id: string) =>
    setProject((p) => ({
      ...p,
      charsets: p.charsets.includes(id) ? p.charsets.filter((c) => c !== id) : [...p.charsets, id],
    }))

  const print = () => {
    const w = window.open('', '_blank')
    if (!w) return alert('Allow pop-ups to print the template.')
    const { w: pw, h: ph } = PAPER[paper]
    const svgs = Array.from({ length: pages }, (_, i) => `<div class="page">${templateSvg(chars, paper, i, settings.family)}</div>`)
    w.document.write(`<!doctype html><html><head><title>${settings.family} template</title><style>
      @page { size: ${pw}mm ${ph}mm; margin: 0 }
      html, body { margin: 0; padding: 0 }
      .page { width: ${pw}mm; height: ${ph}mm; page-break-after: always; break-after: page; overflow: hidden }
      .page svg { display: block; width: ${pw}mm; height: ${ph}mm }
    </style></head><body>${svgs.join('')}<script>window.onload = () => setTimeout(() => window.print(), 200)</script></body></html>`)
    w.document.close()
  }

  const downloadSvg = () => {
    for (let i = 0; i < pages; i++)
      downloadBytes(templateSvg(chars, paper, i, settings.family), `template-page-${i + 1}.svg`, 'image/svg+xml')
  }

  return (
    <section className="step two-col">
      <div className="panel">
        <h2>Set up your font</h2>
        <label className="field">
          <span>Font name</span>
          <input
            value={settings.family}
            maxLength={48}
            onChange={(e) => setProject((p) => ({ ...p, settings: { ...p.settings, family: e.target.value } }))}
          />
        </label>
        <label className="field">
          <span>Paper</span>
          <select value={paper} onChange={(e) => setProject((p) => ({ ...p, paper: e.target.value as PaperSize }))}>
            {Object.entries(PAPER).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="field">
          <span>Characters</span>
          {CHARSETS.map((c) => (
            <label key={c.id} className="check">
              <input type="checkbox" checked={charsets.includes(c.id)} onChange={() => toggle(c.id)} />
              {c.label} <small>({c.chars.length})</small>
            </label>
          ))}
        </fieldset>
        <p className="muted">
          {chars.length} characters on {pages} page{pages > 1 ? 's' : ''}.
        </p>
        <div className="actions">
          <button className="primary" onClick={print} disabled={!chars.length}>
            Print template
          </button>
          <button onClick={downloadSvg} disabled={!chars.length}>
            Download SVG
          </button>
        </div>
        <ol className="howto">
          <li>Print at 100% scale (no "fit to page" needed, but it's fine if it's on).</li>
          <li>Fill each box with a dark felt-tip or gel pen. Sit letters on the solid line; tails go below it.</li>
          <li>Scan it or take a flat, well-lit photo with all four black squares in view.</li>
        </ol>
        <p className="muted">
          No printer? Skip to <button className="link" onClick={next}>Scan</button> or draw each letter by hand in the Glyphs step.
        </p>
      </div>
      <div className="panel preview-panel">
        <div className="pager">
          <button disabled={page === 0} onClick={() => setPreview(page - 1)}>
            ‹
          </button>
          <span>
            Page {page + 1} / {pages}
          </span>
          <button disabled={page >= pages - 1} onClick={() => setPreview(page + 1)}>
            ›
          </button>
        </div>
        <div className="sheet" dangerouslySetInnerHTML={{ __html: templateSvg(chars, paper, page, settings.family) }} />
      </div>
    </section>
  )
}
