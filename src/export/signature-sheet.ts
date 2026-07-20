import type { AuditGroup } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import {
  formatLineHeight, formatLetterSpacing, formatTextCase, formatTextDecoration,
} from '../modules/typography/normalizer'
import type { SignatureRow } from './types'

function sourceLabel(group: AuditGroup<TypographyProperties>): string {
  const src = group.descriptor.source
  if (!src) return 'Raw'
  switch (src.type) {
    case 'Raw':          return 'Raw'
    case 'LocalStyle':   return 'Local Style'
    case 'LibraryStyle': return 'Library Style'
    case 'Variable':     return 'Variable'
    default:             return 'Raw'
  }
}

function currentStyleName(group: AuditGroup<TypographyProperties>): string {
  const src = group.descriptor.source
  if (!src) return ''
  if (src.type === 'LocalStyle' || src.type === 'LibraryStyle') {
    return src.styleName ?? ''
  }
  return ''
}

function weightName(fontStyle: string): string {
  const s = fontStyle.toLowerCase()
  if (s.includes('thin')) return 'Thin'
  if (s.includes('extralight') || s.includes('extra light') || s.includes('ultralight')) return 'ExtraLight'
  if (s.includes('light')) return 'Light'
  if (s.includes('medium')) return 'Medium'
  if (s.includes('semibold') || s.includes('semi bold') || s.includes('demibold')) return 'SemiBold'
  if (s.includes('extrabold') || s.includes('extra bold') || s.includes('ultrabold')) return 'ExtraBold'
  if (s.includes('heavy') || s.includes('black')) return 'Black'
  if (s.includes('bold')) return 'Bold'
  return 'Regular'
}

function buildSignatureLabel(p: TypographyProperties): string {
  const lh = formatLineHeight(p.lineHeight)
  const ls = formatLetterSpacing(p.letterSpacing)
  let label = `${p.fontFamily} ${weightName(p.fontStyle)} • ${p.fontSize}`
  if (lh !== 'Auto') label += ` / ${lh}`
  if (ls !== '0') label += ` • ${ls}`
  return label
}

function sortKey(g: AuditGroup<TypographyProperties>): string {
  const p = g.descriptor
  const layerDesc = String(99999 - g.count).padStart(6, '0')
  const sizeAsc = String(p.fontSize).padStart(6, '0')
  const weightAsc = String(p.fontWeight).padStart(4, '0')
  const familyAsc = p.fontFamily.toLowerCase()
  return `${layerDesc}|${sizeAsc}|${weightAsc}|${familyAsc}`
}

export function buildSignatureRows(
  groups: AuditGroup<TypographyProperties>[],
): SignatureRow[] {
  const sorted = [...groups].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))

  return sorted.map((group, index) => {
    const p = group.descriptor

    const uniquePages = new Set(group.items.map(i => i.pageId))
    const componentCount = group.items.filter(i =>
      i.parentType === 'COMPONENT' || i.parentType === 'COMPONENT_SET' || i.parentType === 'INSTANCE'
    ).length

    const exampleText = (group.items[0]?.nodeName ?? '').slice(0, 80)

    return {
      signatureId: `TYPO-${String(index + 1).padStart(4, '0')}`,
      signatureLabel: buildSignatureLabel(p),
      fontFamily: p.fontFamily,
      weightName: weightName(p.fontStyle),
      weightValue: p.fontWeight,
      fontSize: p.fontSize,
      lineHeight: formatLineHeight(p.lineHeight),
      letterSpacing: formatLetterSpacing(p.letterSpacing),
      textCase: formatTextCase(p.textCase),
      textDecoration: formatTextDecoration(p.textDecoration),
      layerCount: group.count,
      pageCount: uniquePages.size,
      componentCount,
      exampleText,
      currentStyle: currentStyleName(group),
      source: sourceLabel(group),
    }
  })
}
