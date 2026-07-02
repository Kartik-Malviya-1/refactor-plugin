import type { AuditItem } from '../../shared/types'
import type { TypographyProperties, NormalizedLineHeight, NormalizedLetterSpacing } from './types'

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

function lhKey(lh: NormalizedLineHeight): string {
  if (lh.unit === 'AUTO') return 'auto'
  return `${lh.unit}:${roundTo(lh.value, 2)}`
}

function lsKey(ls: NormalizedLetterSpacing): string {
  return `${ls.unit}:${roundTo(ls.value, 2)}`
}

export function normalizeTypography(item: AuditItem<TypographyProperties>): string {
  const p = item.properties
  // Template literal avoids allocating a throwaway 7-element Array per call.
  // normalizeTypography is called once per item in group(); at 500K items
  // that is 500K Array objects eliminated from the GC workload.
  return `${p.fontFamily}|${p.fontStyle}|${roundTo(p.fontSize, 2)}|${lhKey(p.lineHeight)}|${lsKey(p.letterSpacing)}|${p.textCase}|${p.textDecoration}`
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
  const map: Record<string, string> = {
    ORIGINAL: 'None',
    UPPER: 'Uppercase',
    LOWER: 'Lowercase',
    TITLE: 'Title Case',
    SMALL_CAPS: 'Small Caps',
    SMALL_CAPS_FORCED: 'All Small Caps',
  }
  return map[tc] ?? tc
}

export function formatTextDecoration(td: string): string {
  const map: Record<string, string> = {
    NONE: 'None',
    UNDERLINE: 'Underline',
    STRIKETHROUGH: 'Strikethrough',
  }
  return map[td] ?? td
}
