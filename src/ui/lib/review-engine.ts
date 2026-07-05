import type { AuditGroup } from '../../shared/types'
import type { TypographyProperties } from '../../modules/typography/types'
import type { AssignedTarget } from '../../clustering/types'
import type { ReviewItem, LayerChange } from '../../shared/review'

export function buildReviewItems(
  groups:      AuditGroup<TypographyProperties>[],
  assignments: Record<string, AssignedTarget>
): ReviewItem[] {
  const groupByKey = new Map(groups.map(g => [g.key, g]))
  const frameMap   = new Map<string, ReviewItem>()

  for (const [sigKey, assignment] of Object.entries(assignments)) {
    if (assignment.target.type === 'skip') continue
    const group = groupByKey.get(sigKey)
    if (!group) continue

    for (const item of group.items) {
      const frameName = item.parentName ?? 'Unknown Frame'
      const frameId   = `${item.pageId}__${frameName}`

      if (!frameMap.has(frameId)) {
        frameMap.set(frameId, {
          id: frameId, pageId: item.pageId, pageName: item.pageName,
          frameName, changes: [], changeCount: 0,
        })
      }

      const ri = frameMap.get(frameId)!
      const change: LayerChange = {
        layerId: item.nodeId, layerName: item.nodeName,
        signatureKey: sigKey, current: group.descriptor, planned: assignment,
      }
      // dedupe by layerId
      if (!ri.changes.some(c => c.layerId === item.nodeId)) {
        ri.changes.push(change)
      }
    }
  }

  const items = [...frameMap.values()]
  for (const i of items) i.changeCount = i.changes.length

  return items.sort((a, b) => {
    const p = a.pageName.localeCompare(b.pageName)
    return p !== 0 ? p : b.changeCount - a.changeCount
  })
}

export function groupItemsByPage(
  items: ReviewItem[]
): { pageId: string; pageName: string; items: ReviewItem[] }[] {
  const map = new Map<string, { pageId: string; pageName: string; items: ReviewItem[] }>()
  for (const item of items) {
    if (!map.has(item.pageId)) map.set(item.pageId, { pageId: item.pageId, pageName: item.pageName, items: [] })
    map.get(item.pageId)!.items.push(item)
  }
  return [...map.values()]
}

/** Compute property diffs between before (TypographyProperties) and target. */
export interface PropDiff { prop: string; before: string; after: string }

export function diffTypographyToTarget(
  before: TypographyProperties,
  target: AssignedTarget['target']
): PropDiff[] {
  const diffs: PropDiff[] = []

  if (target.type === 'existing-style' || target.type === 'new-style' || target.type === 'manual-values') {
    const t = target as { fontFamily: string; fontStyle: string; fontSize: number }
    if (t.fontFamily !== before.fontFamily) diffs.push({ prop: 'Family', before: before.fontFamily, after: t.fontFamily })
    if (t.fontStyle  !== before.fontStyle)  diffs.push({ prop: 'Style',  before: before.fontStyle,  after: t.fontStyle  })
    if (t.fontSize   !== before.fontSize)   diffs.push({ prop: 'Size',   before: `${before.fontSize}px`, after: `${t.fontSize}px` })
  }

  if ('lineHeightUnit' in target) {
    const t  = target as { lineHeightUnit: string; lineHeightValue: number }
    const bl = before.lineHeight
    const bStr = bl.unit === 'AUTO' ? 'Auto' : `${bl.value}${bl.unit === 'PERCENT' ? '%' : 'px'}`
    const aStr = t.lineHeightUnit === 'AUTO' ? 'Auto' : `${t.lineHeightValue}${t.lineHeightUnit === 'PERCENT' ? '%' : 'px'}`
    if (aStr !== bStr) diffs.push({ prop: 'Line Height', before: bStr, after: aStr })
  }

  if ('letterSpacingUnit' in target) {
    const t  = target as { letterSpacingUnit: string; letterSpacingValue: number }
    const bl = before.letterSpacing
    const bStr = `${bl.value}${bl.unit === 'PERCENT' ? '%' : 'px'}`
    const aStr = `${t.letterSpacingValue}${t.letterSpacingUnit === 'PERCENT' ? '%' : 'px'}`
    if (aStr !== bStr) diffs.push({ prop: 'Spacing', before: bStr, after: aStr })
  }

  return diffs
}
