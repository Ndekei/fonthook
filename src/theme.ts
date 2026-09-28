import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'fonte-generer-theme'

/** Light by default (the app is designed paper-first); the choice is remembered per browser. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#000000' : '#f5f5f7')
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* private mode */
    }
  }, [theme])
  return [theme, setTheme]
}

/** Tiny hash router: '#/', '#/studio', '#/studio/glyphs'. Works on static hosting. */
export function useRoute(): [string[], (path: string) => void] {
  const parse = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = () => {
      setRoute(parse())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return [route, (path: string) => (location.hash = `#/${path}`)]
}
