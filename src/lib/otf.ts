import opentype from 'opentype.js'
import { ASCENDER, DESCENDER, UNITS_PER_EM } from './geometry'
import type { BuiltGlyph, FontSettings } from './glyphs'
import { contourToCommands } from './trace'
import { psName } from './ttf'

/** Builds a CFF-flavoured OpenType font (.otf) with opentype.js. */
export function buildOTF(built: BuiltGlyph[], s: FontSettings): Uint8Array {
  const notdefPath = new opentype.Path()
  notdefPath.moveTo(50, 0)
  notdefPath.lineTo(450, 0)
  notdefPath.lineTo(450, 700)
  notdefPath.lineTo(50, 700)
  notdefPath.close()
  notdefPath.moveTo(100, 50)
  notdefPath.lineTo(100, 650)
  notdefPath.lineTo(400, 650)
  notdefPath.lineTo(400, 50)
  notdefPath.close()

  const glyphs = [
    new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 500, path: notdefPath }),
    new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: s.spaceWidth, path: new opentype.Path() }),
  ]
  for (const g of built) {
    if (g.unicode === 32) continue
    const path = new opentype.Path()
    // CFF wants outer contours anticlockwise: the reverse of TrueType.
    for (const c of g.contours)
      for (const cmd of contourToCommands([...c].reverse())) {
        if (cmd.t === 'M') path.moveTo(cmd.x, cmd.y)
        else if (cmd.t === 'L') path.lineTo(cmd.x, cmd.y)
        else if (cmd.t === 'Q') path.quadraticCurveTo(cmd.cx, cmd.cy, cmd.x, cmd.y)
        else path.close()
      }
    glyphs.push(
      new opentype.Glyph({
        name: `uni${g.unicode.toString(16).toUpperCase().padStart(4, '0')}`,
        unicode: g.unicode,
        advanceWidth: g.advance,
        path,
      }),
    )
  }
  const font = new opentype.Font({
    familyName: s.family.trim() || 'Untitled',
    styleName: s.style.trim() || 'Regular',
    unitsPerEm: UNITS_PER_EM,
    ascender: ASCENDER,
    descender: DESCENDER,
    glyphs,
  })
  font.names.postScriptName = { en: `${psName(s.family)}-${psName(s.style)}` }
  return new Uint8Array(font.toArrayBuffer())
}
