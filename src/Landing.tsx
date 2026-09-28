import { useEffect, useRef, useState } from 'react'
import { ThemeToggle } from './App'
import Icon, { type IconName } from './components/Icon'
import type { Theme } from './theme'

// ---------------------------------------------------------------------------
// Copy lives here so it's easy to make it your own.
// ---------------------------------------------------------------------------
const STORY = {
  quote: 'Everyone’s handwriting deserves to be a font.',
  paragraphs: [
    'Fonte Générer is my passion project. I’ve always loved the small quirks that make handwriting personal: the loop of a g, the lean of a t, the way a signature settles into a shape only you make.',
    'Turning that into a real, installable font shouldn’t be locked behind a paywall or an upload to someone’s server. So I built a tool that does it all in your browser, for free, and keeps your pages on your device.',
    'The headline font on this page, Ndekei Sans, is my own handwriting. I hope you make something just as personal.',
  ],
  signature: 'Ndekei',
}

const STEPS: { title: string; body: string; art: 'sheet' | 'draw' | 'file' }[] = [
  { title: 'Write', body: 'Print the template and fill each box with a pen, or skip the paper and draw straight on screen.', art: 'sheet' },
  { title: 'Capture', body: 'Snap a photo. The corners are found for you, the page is straightened, and every letter is traced.', art: 'draw' },
  { title: 'Install', body: 'Tune weight and spacing with a live preview, then download a real TTF, OTF or WOFF file.', art: 'file' },
]

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'pen', title: 'Drawing that feels like ink', body: 'Smooth, pressure-sensitive strokes with an Apple Pencil or any stylus, and natural thick-and-thin lines with a mouse.' },
  { icon: 'camera', title: 'From photo to font', body: 'Tilted, rotated or even upside-down photos are corrected automatically.' },
  { icon: 'lock', title: 'Private by design', body: 'Nothing leaves your browser. There’s no account, no upload and no tracking.' },
  { icon: 'file', title: 'Real font files', body: 'Standard TTF, OTF and WOFF files that work in Word, Pages, Photoshop, Figma, Canva, Cricut and on the web.' },
  { icon: 'sparkle', title: 'Live preview', body: 'Every adjustment renders instantly in the actual font you’re about to download.' },
  { icon: 'heart', title: 'Free, for real', body: 'No trial, no watermark and no export fee. Make as many fonts as you like.' },
]

const WORDS = ['hello', 'bonjour', 'jambo', 'hola', 'ciao', 'olá', 'hallo', 'merci', 'asante', 'grazie', 'danke', 'karibu']

export default function Landing({ go, theme, setTheme }: { go: (p: string) => void; theme: Theme; setTheme: (t: Theme) => void }) {
  const [sample, setSample] = useState('Write something lovely')
  const root = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  // Reveal sections as they scroll into view.
  useEffect(() => {
    const els = root.current?.querySelectorAll('.reveal') ?? []
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    els.forEach((el) => io.observe(el))
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  const start = () => go('studio/glyphs')
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="landing" ref={root}>
      <header className={'land-nav' + (scrolled ? ' scrolled' : '')}>
        <a className="brand" href="#/" aria-label="Fonte Générer home">
          <span className="brand-mark" aria-hidden>
            Fg
          </span>
          <span className="brand-name">Fonte Générer</span>
        </a>
        <nav className="land-links" aria-label="Sections">
          <button onClick={() => scrollTo('how')}>How it works</button>
          <button onClick={() => scrollTo('features')}>Features</button>
          <button onClick={() => scrollTo('story')}>Story</button>
        </nav>
        <div className="toolbar-end">
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <button className="btn filled small" onClick={start}>
            Open studio
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------ hero */}
      <section className="hero">
        <div className="hero-glow" aria-hidden>
          <span className="blob b1" />
          <span className="blob b2" />
          <span className="blob b3" />
        </div>
        <div className="hero-inner">
          <p className="eyebrow-pill reveal">
            <Icon name="heart" size={14} /> A free, private passion project
          </p>
          <h1 className="hero-title reveal">
            Your handwriting,
            <span className="hand hero-hand">
              as a real font.
              <svg className="scribble" viewBox="0 0 420 40" preserveAspectRatio="none" aria-hidden>
                <path d="M6 28 C 70 10, 140 8, 210 20 S 350 34, 414 12" />
              </svg>
            </span>
          </h1>
          <p className="hero-sub reveal">
            Write it, snap it, install it. Fonte Générer turns the way you write into a font you can type with anywhere, entirely in your browser.
          </p>
          <div className="hero-ctas reveal">
            <button className="btn filled xl" onClick={start}>
              Start your font <Icon name="arrow" />
            </button>
            <button className="btn plain xl" onClick={() => scrollTo('how')}>
              See how it works
            </button>
          </div>

          <div className="tester reveal" aria-label="Type tester set in Ndekei Sans">
            <div className="tester-chrome">
              <span />
              <span />
              <span />
              <em>Ndekei Sans · Regular</em>
            </div>
            <input
              className="tester-input hand"
              value={sample}
              onChange={(e) => setSample(e.target.value)}
              maxLength={60}
              spellCheck={false}
              aria-label="Type to try Ndekei Sans"
            />
            <p className="tester-caption">
              Go on, type something. This is Ndekei Sans, a font made from real handwriting.
            </p>
          </div>

          <div className="tiles" aria-hidden>
            {['A', 'g', '&', 'é', 'k', '?'].map((c, i) => (
              <span key={c} className={`tile hand t${i}`}>
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- marquee */}
      <div className="marquee" aria-hidden>
        <div className="marquee-track hand">
          {[...WORDS, ...WORDS].map((w, i) => (
            <span key={i}>
              {w}
              <i>✦</i>
            </span>
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------- how it works */}
      <section className="land-section" id="how">
        <div className="section-head reveal">
          <p className="eyebrow">How it works</p>
          <h2>
            Three steps. <span className="hand">No design skills needed.</span>
          </h2>
        </div>
        <div className="steps-grid">
          {STEPS.map((s, i) => (
            <article key={s.title} className="step-card reveal" style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="step-art">
                <StepArt kind={s.art} />
              </div>
              <span className="step-index">{String(i + 1).padStart(2, '0')}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- features */}
      <section className="land-section alt" id="features">
        <div className="section-head reveal">
          <p className="eyebrow">Features</p>
          <h2>Everything you need, nothing you don’t.</h2>
        </div>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <article key={f.title} className="feature reveal" style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
              <span className="feature-icon">
                <Icon name={f.icon} size={22} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ story */}
      <section className="land-section story" id="story">
        <div className="story-inner">
          <p className="eyebrow reveal">The story</p>
          <blockquote className="story-quote hand reveal">“{STORY.quote}”</blockquote>
          <div className="story-body">
            {STORY.paragraphs.map((p, i) => (
              <p key={i} className="reveal">
                {p}
              </p>
            ))}
          </div>
          <p className="signature hand reveal">— {STORY.signature}</p>
        </div>
      </section>

      {/* ---------------------------------------------------------- formats */}
      <section className="land-section formats reveal">
        <div className="formats-row">
          {['.ttf', '.otf', '.woff'].map((f) => (
            <span key={f} className="format-chip">
              {f}
            </span>
          ))}
        </div>
        <p className="muted">Works on Windows, macOS, iPadOS, Linux and the web.</p>
      </section>

      {/* -------------------------------------------------------------- cta */}
      <section className="final-cta">
        <h2 className="hand reveal">Your turn.</h2>
        <p className="reveal">Grab a pen. Your font is only a few minutes away.</p>
        <button className="btn filled xl reveal" onClick={start}>
          Start your font <Icon name="arrow" />
        </button>
      </section>

      <footer className="land-footer">
        <span>
          <span className="hand">Fonte Générer</span> · a passion project by {STORY.signature}
        </span>
        <span className="muted">Made with care. Your pages never leave your device.</span>
      </footer>
    </div>
  )
}

function StepArt({ kind }: { kind: 'sheet' | 'draw' | 'file' }) {
  if (kind === 'sheet')
    return (
      <svg viewBox="0 0 200 140" className="art">
        <rect x="45" y="8" width="110" height="124" rx="4" className="paper" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={i % 2 ? 145 : 50} y={i > 1 ? 118 : 13} width="6" height="6" className="ink-fill" />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={58 + (i % 4) * 22} y={30 + Math.floor(i / 4) * 28} width="18" height="18" rx="2" className="cell" />
        ))}
        {['a', 'b', 'c', 'd', 'e', 'f'].map((c, i) => (
          <text key={c} x={67 + (i % 4) * 22} y={45 + Math.floor(i / 4) * 28} className="art-hand" textAnchor="middle">
            {c}
          </text>
        ))}
      </svg>
    )
  if (kind === 'draw')
    return (
      <svg viewBox="0 0 200 140" className="art">
        <rect x="40" y="10" width="120" height="120" rx="14" className="device" />
        <rect x="48" y="18" width="104" height="104" rx="8" className="paper" />
        <line x1="48" y1="92" x2="152" y2="92" className="guide" />
        <line x1="48" y1="58" x2="152" y2="58" className="guide dashed" />
        <path d="M78 92 C 78 60, 122 56, 118 80 C 115 96, 90 98, 86 84 C 84 70, 110 64, 124 92" className="draw-path" />
      </svg>
    )
  return (
    <svg viewBox="0 0 200 140" className="art">
      <path d="M68 12h44l22 22v92a4 4 0 01-4 4H68a4 4 0 01-4-4V16a4 4 0 014-4z" className="paper" />
      <path d="M112 12v22h22" className="fold" />
      <text x="99" y="92" textAnchor="middle" className="art-hand big">
        Aa
      </text>
      <rect x="78" y="106" width="42" height="14" rx="7" className="accent-fill" />
      <text x="99" y="116.5" textAnchor="middle" className="art-label">
        .ttf
      </text>
    </svg>
  )
}
