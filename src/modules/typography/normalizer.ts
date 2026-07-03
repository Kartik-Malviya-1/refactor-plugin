import type { AuditItem } from '../../shared/types'
import type { TypographyProperties, NormalizedLineHeight, NormalizedLetterSpacing } from './types'
import { sourceKey } from '../../shared/typography-source'

function roundTo(n: number, decimals: number): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals
}
function lhKey(lh: NormalizedLineHeight): string {
  return lh.unit === 'AUTO' ? 'auto' : `${lh.unit}:${roundTo(lh.value, 2)}`
}
function lsKey(ls: NormalizedLetterSpacing): string {
  return `${ls.unit}:${roundTo(ls.value, 2)}`
}

/**
 * Normalization key for Typography Signature grouping.
 *
 * v0.2.1: Source identity appended to key so that visually-identical
 * text with different sources (Raw vs LocalStyle vs LibraryStyle) produces
 * SEPARATE Typography Signatures. This is the fix for library style detection.
 *
 * Example:
 *   Raw Inter 16px:           "Inter|Regular|16|...|Raw:"
 *   Local "Body" Inter 16px:  "Inter|Regular|16|...|LocalStyle:S:abc"
 *   Library "Body" Inter 16px: "Inter|Regular|16|...|LibraryStyle:S:def"
 */
export function normalizeTypographyProps(p: TypographyProperties): string {
  const src = p.source ? sourceKey(p.source) : 'Raw:'
  return `${p.fontFamily}|${p.fontStyle}|${roundTo(p.fontSize, 2)}|${lhKey(p.lineHeight)}|${lsKey(p.letterSpacing)}|${p.textCase}|${p.textDecoration}|${src}`
}

export function normalizeTypography(item: AuditItem<TypographyProperties>): string {
  return normalizeTypographyProps(item.properties)
}

export function styleToWeight(style: string): number {
  const s = style.toLowerCase()
  if (s.includes('thin')) return 100
  if (s.includes('extralight') || s.includes('extra light') || s.includes('ultralight')) return 200
  if (s.includes('light')) return 300
  if (s.includes('medium')) return 500
  if (s.includes('semibold') || s.includes('semi bold') || s.includes('demibold')) return 600
  if (s.includes('extrabold') || s.includes('extra bold') || s.includes('ultrabold')) return 800
  if (s.includes('heavy') || s.includes('black')) return 900
  if (s.includes('bold')) return 700
  return 400
}

export function formatLineHeight(lh: NormalizedLineHeight): string {
  if (lh.unit === 'AUTO') return 'Auto'
  if (lh.unit === 'PERCENT') return `${lh.value}%`
  return `${lh.value}px`
}
export function formatLetterSpacing(ls: NormalizedLetterSpacing): string {
  if (ls.value === 0) return '0'
  if (ls.unit === 'PERCENT') return `${ls.value}%`
  return `${ls.value}px`
}
export function formatTextCase(tc: string): string {
  const map: Record<string, string> = { ORIGINAL: 'None', UPPER: 'Uppercase', LOWER: 'Lowercase', TITLE: 'Title Case', SMALL_CAPS: 'Small Caps', SMALL_CAPS_FORCED: 'All Small Caps' }
  return map[tc] ?? tc
}
export function formatTextDecoration(td: string): string {
  const map: Record<string, string> = { NONE: 'None', UNDERLINE: 'Underline', STRIKETHROUGH: 'Strikethrough' }
  return map[td] ?? td
}
