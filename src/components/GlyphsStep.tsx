import { useState } from 'react'
import type { SetProject } from '../App'
import { buildGlyph } from '../lib/glyphs'
import type { Project } from '../lib/project'
import GlyphEditor from './GlyphEditor'
import GlyphOutline from './GlyphOutline'

interface Props {
  project: Project
  setProject: SetProject
  chars: string[]
  next: () => void
}

export default function GlyphsStep({ project, setProject, chars, next }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'missing'>('all')
  // Also show glyphs that exist but whose charset was switched off.
  const all = [...chars, ...Object.keys(project.glyphs).filter((c) => !chars.includes(c))]
  const shown = filter === 'missing' ? all.filter((c) => !project.glyphs[c]) : all
  const missing = chars.filter((c) => !project.glyphs[c]).length

  return (
    <section className="step">
      <div className="panel">
        <div className="row between">
          <div>
            <h2>Your glyphs</h2>
            <p className="muted">
              Click any character to draw it, fix it up, or adjust its spacing. {missing ? `${missing} still empty.` : 'All characters are filled in.'}
            </p>
          </div>
          <div className="actions">
            <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'missing')}>
              <option value="all">All characters</option>
              <option value="missing">Only empty</option>
            </select>
            <button className="primary" onClick={next}>
              Preview & export →
            </button>
          </div>
        </div>
        <div className="glyph-grid">
          {shown.map((ch) => {
            const rec = project.glyphs[ch]
            const g = rec ? buildGlyph(ch, rec, project.settings) : null
            return (
              <button key={ch} className={'glyph-cell' + (g ? '' : ' empty')} onClick={() => setEditing(ch)} title={`U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`}>
                <span className="glyph-label">{ch}</span>
                {g ? <GlyphOutline glyph={g} /> : <span className="glyph-placeholder">{ch}</span>}
              </button>
            )
          })}
        </div>
      </div>
      {editing && (
        <GlyphEditor
          key={editing}
          char={editing}
          chars={all}
          project={project}
          setProject={setProject}
          onNavigate={setEditing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}
