export interface CharsetDef {
  id: string
  label: string
  chars: string[]
}

const split = (s: string) => Array.from(s)

export const CHARSETS: CharsetDef[] = [
  { id: 'upper', label: 'Uppercase A–Z', chars: split('ABCDEFGHIJKLMNOPQRSTUVWXYZ') },
  { id: 'lower', label: 'Lowercase a–z', chars: split('abcdefghijklmnopqrstuvwxyz') },
  { id: 'digits', label: 'Digits 0–9', chars: split('0123456789') },
  { id: 'punct', label: 'Punctuation & symbols', chars: split('.,;:!?\'"-()[]{}/\\&@#$%*+=<>_~^|`') },
  {
    id: 'latin1',
    label: 'Accented letters',
    chars: split('ÀÁÂÄÃÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÖÕØŒÙÚÛÜÝàáâäãåæçèéêëìíîïñòóôöõøœùúûüýÿß'),
  },
  { id: 'extra', label: 'Typographic extras', chars: split('“”‘’–—…«»¿¡€£¥©°·•') },
]

export const DEFAULT_CHARSETS = ['upper', 'lower', 'digits', 'punct']

export function charsFor(ids: string[]): string[] {
  const out: string[] = []
  for (const set of CHARSETS) if (ids.includes(set.id)) out.push(...set.chars)
  return out
}
