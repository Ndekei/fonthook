import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Ndekei Sans: drop NdekeiSans.woff2 / .woff / .ttf / .otf into public/fonts/.
// Resolved against the page so it works on any subpath; the browser tries each in turn.
const fontUrl = (f: string) => new URL(`fonts/${f}`, document.baseURI).href
const style = document.createElement('style')
style.textContent = `@font-face {
  font-family: 'Ndekei Sans';
  src: url('${fontUrl('NdekeiSans.woff2')}') format('woff2'), url('${fontUrl('NdekeiSans.woff')}') format('woff'),
       url('${fontUrl('NdekeiSans.ttf')}') format('truetype'), url('${fontUrl('NdekeiSans.otf')}') format('opentype');
  font-display: swap;
}`
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
