import { useState } from 'react'
import type { SetProject, StepId } from '../App'
import { CHARSETS } from '../lib/charsets'
import { downloadBytes, type Project } from '../lib/project'
import { PAPER, pageCount, templateSvg, type PaperSize } from '../lib/template'
import Icon from './Icon'
import { Group, Segmented, Switch } from './ui'

interface Props {
  project: Project
  setProject: SetProject
  chars: string[]
  go: (s: StepId) => void
}

export default function TemplateStep({ project, setProject, chars, go }: Props) {
  const { paper, charsets, settings } = project
  const pages = pageCount(chars, paper)
  const [preview, setPreview] = useState(0)
  const page = Math.min(preview, pages - 1)

  const toggle = (id: string, on: boolean) =>
    setProject((p) => ({ ...p, charsets: on ? [...p.charsets, id] : p.charsets.filter((c) => c !== id) }))

  const print = () => {
    const w = window.open('', '_blank')
    if (!w) return alert('Allow pop-ups for this site to print the template.')
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
    for (let i = 0; i < pages; i++) downloadBytes(templateSvg(chars, paper, i, settings.family), `template-page-${i + 1}.svg`, 'image/svg+xml')
  }

  return (
    <div className="page-grid">
      <div className="page-col">
        <header className="page-head">
          <h1>Print your template</h1>
          <p>Choose the characters you want, print the sheet, then write one character in each box.</p>
        </header>

        <Group title="Font">
          <label className="row-item field-row">
            <span>Name</span>
            <input
              type="text"
              value={settings.family}
              maxLength={48}
              placeholder="My Handwriting"
              onChange={(e) => setProject((p) => ({ ...p, settings: { ...p.settings, family: e.target.value } }))}
            />
          </label>
          <div className="row-item">
            <span>Paper</span>
            <Segmented
              label="Paper size"
              size="sm"
              value={paper}
              onChange={(v: PaperSize) => setProject((p) => ({ ...p, paper: v }))}
              options={Object.entries(PAPER).map(([k, v]) => ({ value: k as PaperSize, label: v.label }))}
            />
          </div>
        </Group>

        <Group title="Characters" footer={`${chars.length} characters · ${pages} page${pages > 1 ? 's' : ''}`}>
          {CHARSETS.map((c) => (
            <Switch key={c.id} label={c.label} detail={c.chars.slice(0, 12).join(' ') + (c.chars.length > 12 ? ' …' : '')} checked={charsets.includes(c.id)} onChange={(on) => toggle(c.id, on)} />
          ))}
        </Group>

        <div className="button-row">
          <button className="btn filled large" onClick={print} disabled={!chars.length}>
            <Icon name="print" /> Print template
          </button>
          <button className="btn tinted large" onClick={downloadSvg} disabled={!chars.length}>
            <Icon name="download" /> Download SVG
          </button>
        </div>

        <Group title="Tips">
          <ol className="tips">
            <li>Print at 100% scale. The corner squares let the scanner correct any scaling.</li>
            <li>Use a dark felt-tip or gel pen. Sit letters on the solid line and let tails drop below it.</li>
            <li>Photograph the page flat and evenly lit, with all four black squares in view.</li>
          </ol>
        </Group>

        <button className="btn plain" onClick={() => go('glyphs')}>
          No printer? Draw on screen instead <Icon name="arrow" size={16} />
        </button>
      </div>

      <div className="page-col sticky">
        <div className="sheet-stage">
          <div className="sheet" dangerouslySetInnerHTML={{ __html: templateSvg(chars, paper, page, settings.family) }} />
        </div>
        {pages > 1 && (
          <div className="pager">
            <button className="icon-btn" disabled={page === 0} onClick={() => setPreview(page - 1)} aria-label="Previous page">
              <Icon name="left" />
            </button>
            <span>
              Page {page + 1} of {pages}
            </span>
            <button className="icon-btn" disabled={page >= pages - 1} onClick={() => setPreview(page + 1)} aria-label="Next page">
              <Icon name="right" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
