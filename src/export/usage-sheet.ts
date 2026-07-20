import type { AuditGroup } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { UsageRow } from './types'

export function buildUsageRows(
  groups: AuditGroup<TypographyProperties>[],
): UsageRow[] {
  const rows: UsageRow[] = []

  for (const group of groups) {
    for (const item of group.items) {
      const src = item.properties.source
      let currentStyle = ''
      if (src?.type === 'LocalStyle' || src?.type === 'LibraryStyle') {
        currentStyle = src.styleName ?? ''
      }

      rows.push({
        signatureKey: group.key,
        page: item.pageName,
        frame: item.parentName ?? '',
        layerName: item.nodeName,
        currentStyle,
        nodeId: item.nodeId,
      })
    }
  }

  return rows
}
