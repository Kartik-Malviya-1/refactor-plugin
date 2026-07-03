import type { AuditGroup } from '../shared/types'

// ---------------------------------------------------------------------------
// Selection domain model
//
// A Selection represents the Typography Signatures (or domain equivalents)
// that the user has explicitly chosen from a Working Set.
//
// Selection is the bridge between Working Set and Assignment.
// Every future module (Colors, Spacing, Radius…) reuses this model.
//
// Platform pipeline:
//   Scan → AuditItem<T> → Query Builder → WorkingSet<T>
//         → Selection<T> → Assignment → Mapping<T> → Preview → Apply
// ---------------------------------------------------------------------------

export interface SelectionStatistics {
  signatureCount: number
  layerCount: number
  pageCount: number
  componentCount: number
  libraryCount: number
  /**
   * How many signatures would be eliminated if all selected items
   * are mapped to a single target (selection.length - 1).
   */
  potentialReduction: number
}

export interface Selection<T> {
  id: string
  /** ID of the Working Set this selection was made within. */
  workingSetId: string
  items: AuditGroup<T>[]
  statistics: SelectionStatistics
}

/**
 * Computes SelectionStatistics from a list of selected groups.
 * Pure function — no Figma API calls.
 */
export function computeSelectionStatistics<T extends {
  fontFamily: string
  source?: { libraryName?: string }
}>(
  groups: AuditGroup<T>[]
): SelectionStatistics {
  const pages      = new Set<string>()
  const components = new Set<string>()
  const libraries  = new Set<string>()
  let totalLayers = 0

  for (const g of groups) {
    totalLayers += g.count
    for (const item of g.items) {
      pages.add(item.pageId)
      if (item.parentType === 'COMPONENT' || item.parentType === 'INSTANCE') {
        components.add(`${item.pageId}::${item.parentName ?? ''}`)
      }
    }
    const src = (g.descriptor as unknown as { source?: { libraryName?: string } }).source
    if (src?.libraryName) libraries.add(src.libraryName)
  }

  return {
    signatureCount:   groups.length,
    layerCount:       totalLayers,
    pageCount:        pages.size,
    componentCount:   components.size,
    libraryCount:     libraries.size,
    potentialReduction: Math.max(0, groups.length - 1),
  }
}
