# Scribefont

Turn your handwriting into an installable font, entirely in the browser: no account, no server, no paywall.

1. **Template**: name your font, pick character sets, and print the template (A4 or US Letter).
2. **Scan**: upload scans or phone photos of the filled-in pages. The four corner squares are found automatically, and
   the photo can be rotated or upside down. You can drag the corners by hand if detection misses.
3. **Glyphs**: review every character, draw missing ones with a mouse, touch, or stylus (pressure-sensitive), erase
   stray marks, and adjust spacing and baseline.
4. **Preview & export**: type in the live preview, which uses the actual generated font, tune weight, smoothing,
   and spacing, then download **.ttf**, **.otf**, or **.woff**.

Work autosaves to the browser's localStorage. Use *Save project* for a portable backup.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/, deployable anywhere
npm run lint
npm run selftest   # builds TTF/OTF/WOFF from synthetic glyphs into a temp dir
```

## How it works

- `src/lib/template.ts`: template layout (mm) and SVG. Guides print in light blue so they drop out of the scan.
- `src/lib/scan.ts`: marker detection (adaptive threshold + blob search), orientation mark, homography, per-cell
  sampling and thresholding against the local paper brightness.
- `src/lib/trace.ts`: bitmap → pixel-edge contours → Taubin smoothing → Douglas–Peucker → quadratic outlines.
- `src/lib/ttf.ts`: a self-contained TrueType writer (glyf/loca/cmap/hmtx/OS/2/name/post…).
- `src/lib/otf.ts`: CFF OpenType via opentype.js. `src/lib/woff.ts`: WOFF 1.0 wrapper.
