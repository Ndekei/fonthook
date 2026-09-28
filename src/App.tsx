import { useEffect, useMemo, useRef, useState } from 'react'
import { charsFor } from './lib/charsets'
import { loadLocal, saveLocal, type Project } from './lib/project'
import TemplateStep from './components/TemplateStep'
import ScanStep from './components/ScanStep'
import GlyphsStep from './components/GlyphsStep'
import ExportStep from './components/ExportStep'

const STEPS = [
  { id: 'template', label: 'Template' },
  { id: 'scan', label: 'Scan' },
  { id: 'glyphs', label: 'Glyphs' },
  { id: 'export', label: 'Preview & export' },
] as const
type StepId = (typeof STEPS)[number]['id']

export type SetProject = (fn: (p: Project) => Project) => void

export default function App() {
  const [project, setProjectState] = useState<Project>(loadLocal)
  const [step, setStep] = useState<StepId>('template')
  const setProject: SetProject = (fn) => setProjectState((p) => fn(p))

  // Autosave, debounced so dragging a slider doesn't hammer localStorage.
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => saveLocal(project), 600)
  }, [project])

  const chars = useMemo(() => charsFor(project.charsets), [project.charsets])
  const done = chars.filter((c) => project.glyphs[c]).length

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            ✎
          </span>
          Scribefont
        </div>
        <nav className="steps">
          {STEPS.map((s, i) => (
            <button key={s.id} className={step === s.id ? 'active' : ''} onClick={() => setStep(s.id)}>
              <span className="num">{i + 1}</span>
              {s.label}
            </button>
          ))}
        </nav>
        <div className="progress" title="Characters with a glyph">
          {done}/{chars.length}
        </div>
      </header>
      <main>
        {step === 'template' && <TemplateStep project={project} setProject={setProject} chars={chars} next={() => setStep('scan')} />}
        {step === 'scan' && <ScanStep project={project} setProject={setProject} chars={chars} next={() => setStep('glyphs')} />}
        {step === 'glyphs' && <GlyphsStep project={project} setProject={setProject} chars={chars} next={() => setStep('export')} />}
        {step === 'export' && <ExportStep project={project} setProject={setProject} chars={chars} />}
      </main>
    </div>
  )
}
