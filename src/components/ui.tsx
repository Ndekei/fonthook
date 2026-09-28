import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T
  options: { value: T; label: ReactNode; icon?: IconName; title?: string }[]
  onChange: (v: T) => void
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className={`segmented ${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
          title={o.title}
        >
          {o.icon && <Icon name={o.icon} size={18} />}
          {o.label && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  )
}

export function Switch({ checked, onChange, label, detail }: { checked: boolean; onChange: (v: boolean) => void; label: string; detail?: string }) {
  return (
    <label className="row-item switch-row">
      <span className="row-text">
        <span>{label}</span>
        {detail && <small>{detail}</small>}
      </span>
      <input type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className="row-item slider-row">
      <span className="row-text">
        <span>{label}</span>
        <output>{format ? format(value) : value}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(+e.target.value)}
      />
    </label>
  )
}

export function Group({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="group">
      {title && <h3 className="group-title">{title}</h3>}
      <div className="group-body">{children}</div>
      {footer && <p className="group-footer">{footer}</p>}
    </section>
  )
}

// ---- Toasts ----

interface ToastItem {
  id: number
  text: string
  icon: IconName
}

const ToastCtx = createContext<(text: string, icon?: IconName) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const show = useCallback((text: string, icon: IconName = 'check') => {
    const id = ++seq.current
    setItems((t) => [...t.slice(-2), { id, text, icon }])
    window.setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast">
            <Icon name={t.icon} size={18} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastCtx)
