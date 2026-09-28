import { useEffect, useMemo, useRef, useState } from 'react'
import { charsFor } from './lib/charsets'
import { loadLocal, saveLocal, type Project } from './lib/project'
import { useRoute, useTheme, type Theme } from './theme'
import Icon from './components/Icon'
import { Segmented, ToastProvider } from './components/ui'
import Landing from './Landing'
import TemplateStep from './components/TemplateStep'
import ScanStep from './components/ScanStep'
import GlyphsStep from './components/GlyphsStep'
import ExportStep from './components/ExportStep'

const STEPS = [
  { id: 'template', label: 'Template' },
  { id: 'scan', label: 'Scan' },
  { id: 'glyphs', label: 'Glyphs' },
  { id: 'export', label: 'Export' },
] as const
export type StepId = (typeof STEPS)[number]['id']

export type SetProject = (fn: (p: Project) => Project) => void

export default function App() {
  const [theme, setTheme] = useTheme()
  const [route, go] = useRoute()
  return (
    <ToastProvider>
      {route[0] === 'studio' ? (
        <Studio step={(STEPS.find((s) => s.id === route[1])?.id ?? 'glyphs') as StepId} go={go} theme={theme} setTheme={setTheme} />
      ) : (
        <Landing go={go} theme={theme} setTheme={setTheme} />
      )}
    </ToastProvider>
  )
}

export function ThemeToggle({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const next = theme === 'light' ? 'dark' : 'light'
  return (
    <button className="icon-btn" onClick={() => setTheme(next)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      <Icon name={theme === 'light' ? 'moon' : 'sun'} />
    </button>
  )
}

function Studio({ step, go, theme, setTheme }: { step: StepId; go: (p: string) => void; theme: Theme; setTheme: (t: Theme) => void }) {
  const [project, setProjectState] = useState<Project>(loadLocal)
  const setProject: SetProject = (fn) => setProjectState((p) => fn(p))
  const setStep = (s: StepId) => go(`studio/${s}`)

  // Autosave, debounced so dragging a slider doesn't hammer localStorage.
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => saveLocal(project), 600)
  }, [project])

  const chars = useMemo(() => charsFor(project.charsets), [project.charsets])
  const done = chars.filter((c) => project.glyphs[c]).length
  const pct = chars.length ? done / chars.length : 0

  return (
    <div className="studio">
      <header className="toolbar-bar">
        <a className="brand" href="#/" aria-label="Fonte Générer home">
          <span className="brand-mark" aria-hidden>
            Fg
          </span>
          <span className="brand-name">Fonte Générer</span>
        </a>
        <nav className="step-nav" aria-label="Steps">
          <Segmented
            label="Steps"
            value={step}
            onChange={setStep}
            options={STEPS.map((s, i) => ({ value: s.id, label: <><span className="step-num">{i + 1}</span>{s.label}</> }))}
          />
        </nav>
        <div className="toolbar-end">
          <div className="progress-pill" title={`${done} of ${chars.length} characters done`} aria-label={`${done} of ${chars.length} characters done`}>
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
              <circle cx="10" cy="10" r="8" className="ring-bg" />
              <circle cx="10" cy="10" r="8" className="ring-fg" strokeDasharray={`${pct * 50.27} 50.27`} />
            </svg>
            <span>
              {done}/{chars.length}
            </span>
          </div>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </header>
      <main className="studio-main" key={step}>
        {step === 'template' && <TemplateStep project={project} setProject={setProject} chars={chars} go={setStep} />}
        {step === 'scan' && <ScanStep project={project} setProject={setProject} chars={chars} go={setStep} />}
        {step === 'glyphs' && <GlyphsStep project={project} setProject={setProject} chars={chars} go={setStep} />}
        {step === 'export' && <ExportStep project={project} setProject={setProject} chars={chars} go={setStep} />}
      </main>
    </div>
  )
}
