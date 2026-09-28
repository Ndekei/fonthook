// Shared geometry: how a template cell maps to font units.
//
// Every glyph is stored as a CELL x CELL bitmap. Guide lines sit at fixed
// fractions of the cell height, and the cap-height band maps to CAP_HEIGHT
// font units, so every glyph shares one scale and one baseline.

export const CELL = 320

export const GUIDE = {
  cap: 0.25,
  xHeight: 0.45,
  baseline: 0.7,
  descender: 0.9,
} as const

export const UNITS_PER_EM = 1000
export const CAP_HEIGHT = 700
export const SCALE = CAP_HEIGHT / ((GUIDE.baseline - GUIDE.cap) * CELL)
export const X_HEIGHT = Math.round((GUIDE.baseline - GUIDE.xHeight) * CELL * SCALE)
export const BASELINE_PX = GUIDE.baseline * CELL
export const ASCENDER = 1000
export const DESCENDER = -350
