import type { AuditGroup } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { AvailableTextStyle, AvailableTypographyVariable } from '../shared/migration'
import type { SummaryRow } from './types'

export function buildSummaryRows(
  groups: AuditGroup<TypographyProperties>[],
  textStyles: AvailableTextStyle[],
  variables: AvailableTypographyVariable[],
): SummaryRow[] {
  const totalLayers = groups.reduce((s, g) => s + g.count, 0)
  const allPages = new Set<string>()
  let componentLayers = 0

  for (const g of groups) {
    for (const item of g.items) {
      allPages.add(item.pageId)
      if (item.parentType === 'COMPONENT' || item.parentType === 'COMPONENT_SET' || item.parentType === 'INSTANCE') {
        componentLayers++
      }
    }
  }

  return [
    { metric: 'Typography Signatures', value: groups.length },
    { metric: 'Layers', value: totalLayers },
    { metric: 'Pages', value: allPages.size },
    { metric: 'Component Layers', value: componentLayers },
    { metric: 'Styles', value: textStyles.length },
    { metric: 'Variables', value: variables.length },
  ]
}
