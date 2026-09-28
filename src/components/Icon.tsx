// A small, consistent line-icon set (20px grid, 1.75 stroke, round joins).

const PATHS: Record<string, string> = {
  pen: 'M4 16l1-4L14.5 2.5a2.1 2.1 0 013 3L8 15l-4 1zM12.5 4.5l3 3',
  eraser: 'M8 17h9M3.6 12.6l7.8-7.8a2 2 0 012.8 0l2.8 2.8a2 2 0 010 2.8L10 17H7l-3.4-3.4a0.7 0.7 0 010-1zM7.5 8.8l4.7 4.7',
  scissors: 'M5.5 7.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm0 10a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM7.5 6.5L17 15M7.5 13.5L17 5',
  undo: 'M7 5L3 9l4 4M3.5 9H12a5 5 0 010 10H9',
  redo: 'M13 5l4 4-4 4M16.5 9H8a5 5 0 000 10h3',
  trash: 'M3.5 5.5h13M8 5.5V3.8a.8.8 0 01.8-.8h2.4a.8.8 0 01.8.8v1.7M5.2 5.5l.8 11a1.5 1.5 0 001.5 1.4h5a1.5 1.5 0 001.5-1.4l.8-11',
  left: 'M12.5 4l-6 6 6 6',
  right: 'M7.5 4l6 6-6 6',
  sun: 'M10 13.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M16 4l-1.4 1.4M5.4 14.6L4 16M16 16l-1.4-1.4M5.4 5.4L4 4',
  moon: 'M16.5 12.2A7 7 0 017.8 3.5 7 7 0 1016.5 12.2z',
  download: 'M10 3v10M5.5 9l4.5 4.5L14.5 9M3.5 16.5h13',
  upload: 'M10 14V4M5.5 8L10 3.5 14.5 8M3.5 16.5h13',
  print: 'M5.5 7.5V3h9v4.5M5.5 14H3.8a.8.8 0 01-.8-.8V8.3a.8.8 0 01.8-.8h12.4a.8.8 0 01.8.8v4.9a.8.8 0 01-.8.8h-1.7M5.5 11.5h9V17h-9z',
  check: 'M4 10.5l4 4 8-9',
  grid: 'M3 3h5.5v5.5H3zM11.5 3H17v5.5h-5.5zM3 11.5h5.5V17H3zM11.5 11.5H17V17h-5.5z',
  sparkle: 'M10 2l1.6 4.8L16.5 8.5l-4.9 1.7L10 15l-1.6-4.8L3.5 8.5l4.9-1.7zM16 14l.6 1.6 1.6.6-1.6.6L16 18.4l-.6-1.6-1.6-.6 1.6-.6z',
  camera: 'M3 6.5a1 1 0 011-1h2.5L8 3.5h4l1.5 2H16a1 1 0 011 1V15a1 1 0 01-1 1H4a1 1 0 01-1-1zM10 13.5a3 3 0 100-6 3 3 0 000 6z',
  lock: 'M5 9h10v8H5zM7 9V6.5a3 3 0 016 0V9',
  heart: 'M10 17s-6.5-3.8-6.5-8.6A3.6 3.6 0 0110 6.3a3.6 3.6 0 016.5 2.1C16.5 13.2 10 17 10 17z',
  globe: 'M10 17.5a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM2.5 10h15M10 2.5c2 2.2 3 4.7 3 7.5s-1 5.3-3 7.5c-2-2.2-3-4.7-3-7.5s1-5.3 3-7.5z',
  file: 'M5 2.5h6.5L15.5 6.5V17a.5.5 0 01-.5.5H5a.5.5 0 01-.5-.5V3a.5.5 0 01.5-.5zM11 2.5V7h4.5',
  close: 'M5 5l10 10M15 5L5 15',
  rotate: 'M15.5 10a5.5 5.5 0 11-1.6-3.9M14 2.5v3.8h-3.8',
  plus: 'M10 4v12M4 10h12',
  arrow: 'M4 10h12M11 5l5 5-5 5',
  folder: 'M2.5 5.5a1 1 0 011-1h4l1.5 1.5h7.5a1 1 0 011 1V15a1 1 0 01-1 1h-13a1 1 0 01-1-1z',
}

export type IconName = keyof typeof PATHS

export default function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
