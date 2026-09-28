import { useEffect, useRef } from 'react'
import { bitmapToImageData, type Bitmap } from '../lib/bitmap'
import { CELL } from '../lib/geometry'

export default function BitmapThumb({ bitmap }: { bitmap: Bitmap }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    c.width = CELL
    c.height = CELL
    c.getContext('2d')!.putImageData(bitmapToImageData(bitmap), 0, 0)
  }, [bitmap])
  return <canvas ref={ref} className="thumb-canvas" />
}
