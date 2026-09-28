import { ASCENDER, DESCENDER } from '../lib/geometry'
import type { BuiltGlyph } from '../lib/glyphs'
import { commandsToSvg, contourToCommands } from '../lib/trace'

/** Renders a built glyph's vector outline, with its advance box and baseline. */
export default function GlyphOutline({ glyph, guides = false }: { glyph: BuiltGlyph; guides?: boolean }) {
  const d = glyph.contours.map((c) => commandsToSvg(contourToCommands(c))).join('')
  const pad = 80
  const top = ASCENDER + 150
  const h = top - DESCENDER + 150
  const w = Math.max(glyph.advance + pad * 2, h * 0.6)
  const x0 = (glyph.advance - w) / 2
  return (
    <svg viewBox={`${x0} ${-top} ${w} ${h}`} className="outline-svg" preserveAspectRatio="xMidYMid meet">
      {guides && (
        <g className="guides">
          <line x1={x0} x2={x0 + w} y1={0} y2={0} />
          <line x1={0} x2={0} y1={-top} y2={h - top} />
          <line x1={glyph.advance} x2={glyph.advance} y1={-top} y2={h - top} />
        </g>
      )}
      <path d={d} transform="scale(1,-1)" fillRule="nonzero" />
    </svg>
  )
}
