import type { AuditGroup } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { AssignedTarget } from '../clustering/types'
import {
  formatLineHeight, formatLetterSpacing, formatTextCase, formatTextDecoration,
} from '../modules/typography/normalizer'
import type { SignatureRow } from './types'

function sourceLabel(group: AuditGroup<TypographyProperties>): string {
  const src = group.descriptor.source
  if (!src) return 'Raw Values'
  switch (src.type) {
    case 'Raw':          return 'Raw Values'
    case 'LocalStyle':   return 'Local Text Style'
    case 'LibraryStyle': return 'Library Text Style'
    case 'Variable':     return 'Variable'
    default:             return 'Unknown'
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

function currentVariableName(group: AuditGroup<TypographyProperties>): string {
  const src = group.descriptor.source
  if (!src) return ''
  if (src.type === 'Variable') {
    return src.variableName ?? ''
  }
  return ''
}

function targetLabel(assignment: AssignedTarget | undefined): string {
  if (!assignment) return ''
  return assignment.label
}

function statusLabel(assignment: AssignedTarget | undefined): string {
  if (!assignment) return 'Unassigned'
  switch (assignment.target.type) {
    case 'existing-style':    return 'Mapped to Style'
    case 'existing-variable': return 'Mapped to Variable'
    case 'new-style':         return 'New Style'
    case 'manual-values':     return 'Manual Values'
    case 'skip':              return 'Skipped'
    default:                  return 'Assigned'
  }
}

function sortKey(g: AuditGroup<TypographyProperties>): string {
  const p = g.descriptor
  const src = sourceLabel(g)
  return `${src}|${String(p.fontSize).padStart(6, '0')}|${String(p.fontWeight).padStart(4, '0')}|${p.fontFamily}`
}

export function buildSignatureRows(
  groups: AuditGroup<TypographyProperties>[],
  assignments: Record<string, AssignedTarget>,
): SignatureRow[] {
  const sorted = [...groups].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))

  return sorted.map(group => {
    const p = group.descriptor
    const assignment = assignments[group.key]

    const uniquePages = new Set(group.items.map(i => i.pageId))
    const componentCount = group.items.filter(i =>
      i.parentType === 'COMPONENT' || i.parentType === 'COMPONENT_SET' || i.parentType === 'INSTANCE'
    ).length

    return {
      signatureKey: group.key,
      fontFamily: p.fontFamily,
      fontWeight: p.fontWeight,
      fontSize: p.fontSize,
      lineHeight: formatLineHeight(p.lineHeight),
      letterSpacing: formatLetterSpacing(p.letterSpacing),
      textCase: formatTextCase(p.textCase),
      textDecoration: formatTextDecoration(p.textDecoration),
      sourceType: sourceLabel(group),
      layerCount: group.count,
      componentCount,
      pageCount: uniquePages.size,
      currentStyle: currentStyleName(group),
      currentVariable: currentVariableName(group),
      targetToken: targetLabel(assignment),
      status: statusLabel(assignment),
      notes: '',
    }
  })
}
