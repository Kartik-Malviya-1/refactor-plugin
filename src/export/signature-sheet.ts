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
  if (!assignment) return 'Pending'
  switch (assignment.target.type) {
    case 'existing-style':    return 'Mapped'
    case 'existing-variable': return 'Mapped'
    case 'new-style':         return 'Mapped'
    case 'manual-values':     return 'Mapped'
    case 'skip':              return 'Skip'
    default:                  return 'Pending'
  }
}

function confidenceLabel(assignment: AssignedTarget | undefined): string {
  if (!assignment) return ''
  return 'Manual'
}

function priorityLabel(layerCount: number, componentCount: number, pageCount: number): string {
  if (layerCount >= 100 || componentCount >= 20) return 'Critical'
  if (layerCount >= 50 || componentCount >= 10) return 'High'
  if (layerCount >= 10 || pageCount >= 3) return 'Medium'
  return 'Low'
}

function buildSignatureLabel(p: TypographyProperties): string {
  const lh = formatLineHeight(p.lineHeight)
  const ls = formatLetterSpacing(p.letterSpacing)
  let label = `${p.fontFamily} ${p.fontStyle} • ${p.fontSize}`
  if (lh !== 'Auto') label += ` / ${lh}`
  if (ls !== '0') label += ` • ${ls}`
  return label
}

function sortKey(g: AuditGroup<TypographyProperties>): string {
  const p = g.descriptor
  const compCount = g.items.filter(i =>
    i.parentType === 'COMPONENT' || i.parentType === 'COMPONENT_SET' || i.parentType === 'INSTANCE'
  ).length
  const prio = priorityLabel(g.count, compCount, new Set(g.items.map(i => i.pageId)).size)
  const prioOrder = prio === 'Critical' ? '0' : prio === 'High' ? '1' : prio === 'Medium' ? '2' : '3'
  return `${prioOrder}|${String(99999 - g.count).padStart(6, '0')}|${String(p.fontSize).padStart(6, '0')}|${String(p.fontWeight).padStart(4, '0')}`
}

export function buildSignatureRows(
  groups: AuditGroup<TypographyProperties>[],
  assignments: Record<string, AssignedTarget>,
  totalLayers: number,
): SignatureRow[] {
  const sorted = [...groups].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))

  return sorted.map((group, index) => {
    const p = group.descriptor
    const assignment = assignments[group.key]

    const uniquePages = new Set(group.items.map(i => i.pageId))
    const componentCount = group.items.filter(i =>
      i.parentType === 'COMPONENT' || i.parentType === 'COMPONENT_SET' || i.parentType === 'INSTANCE'
    ).length

    const usagePct = totalLayers > 0 ? ((group.count / totalLayers) * 100) : 0

    return {
      signatureId: `TYPO-${String(index + 1).padStart(4, '0')}`,
      signatureLabel: buildSignatureLabel(p),
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
      usagePercent: `${usagePct.toFixed(1)}%`,
      rank: index + 1,
      priority: priorityLabel(group.count, componentCount, uniquePages.size),
      currentStyle: currentStyleName(group),
      currentVariable: currentVariableName(group),
      targetToken: targetLabel(assignment),
      confidence: confidenceLabel(assignment),
      status: statusLabel(assignment),
      notes: '',
    }
  })
}
