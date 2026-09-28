import { useState } from 'react'
import type { SetProject, StepId } from '../App'
import { buildGlyph } from '../lib/glyphs'
import type { Project } from '../lib/project'
import GlyphEditor from './GlyphEditor'
import GlyphOutline from './GlyphOutline'
import Icon from './Icon'
import { Segmented } from './ui'

interface Props {
  project: Project
  setProject: SetProject
  chars: string[]
  go: (s: StepId) => void
}

type Filter = 'all' | 'todo' | 'done'

export default function GlyphsStep({ project, setProject, chars, go }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  // Also show glyphs that exist but whose character set was switched off.
  const all = [...chars, ...Object.keys(project.glyphs).filter((c) => !chars.includes(c))]
  const has = (c: string) => !!project.glyphs[c]
  const shown = all.filter((c) => (filter === 'all' ? true : filter === 'todo' ? !has(c) : has(c)))
  const done = chars.filter(has).length
  const firstEmpty = chars.find((c) => !has(c))

  return (
    <div className="page-single">
      <header className="page-head with-actions">
        <div>
          <h1>Your glyphs</h1>
          <p>
            {done === 0
              ? 'Draw each character on screen, or scan a filled-in template.'
              : done < chars.length
                ? `${done} of ${chars.length} done. Select any character to draw it or touch it up.`
                : `All ${chars.length} characters are done. Touch up anything you like, then export.`}
          </p>
        </div>
        <div className="button-row">
          {firstEmpty ? (
            <button className="btn filled large" onClick={() => setEditing(firstEmpty)}>
              <Icon name="pen" /> {done ? 'Continue drawing' : 'Start drawing'}
            </button>
          ) : (
            <button className="btn filled large" onClick={() => go('export')}>
              Preview & export <Icon name="arrow" />
            </button>
          )}
        </div>
      </header>

      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={chars.length} aria-valuenow={done}>
        <div style={{ width: `${chars.length ? (done / chars.length) * 100 : 0}%` }} />
      </div>

      <div className="grid-toolbar">
        <Segmented
          label="Filter"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All ${all.length}` },
            { value: 'todo', label: `To do ${all.length - all.filter(has).length}` },
            { value: 'done', label: `Done ${all.filter(has).length}` },
          ]}
        />
      </div>

      {shown.length ? (
        <div className="glyph-grid">
          {shown.map((ch) => {
            const rec = project.glyphs[ch]
            const g = rec ? buildGlyph(ch, rec, project.settings) : null
            return (
              <button
                key={ch}
                className={'glyph-cell' + (g ? '' : ' empty')}
                onClick={() => setEditing(ch)}
                aria-label={`${g ? 'Edit' : 'Draw'} ${ch}`}
                title={`U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`}
              >
                <span className="glyph-label">{ch}</span>
                {g ? <GlyphOutline glyph={g} /> : <span className="glyph-placeholder">{ch}</span>}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name={filter === 'todo' ? 'check' : 'pen'} size={32} />
          <p>{filter === 'todo' ? 'Nothing left to draw.' : 'No characters drawn yet.'}</p>
        </div>
      )}

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
    </div>
  )
}
