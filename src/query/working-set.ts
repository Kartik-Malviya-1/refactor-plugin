import type { AuditGroup } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { QueryExpression, WorkingSet, WorkingSetStatistics } from './types'
import { evaluateQuery } from './evaluator'

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export function computeStatistics(
  groups: AuditGroup<TypographyProperties>[],
  potentialConsolidations = 0,
  estimatedReduction = 0
): WorkingSetStatistics {
  const pages      = new Set<string>()
  const components = new Set<string>()
  const libraries  = new Set<string>()
  const variables  = new Set<string>()
  let totalLayers = 0

  for (const g of groups) {
    totalLayers += g.count
    for (const item of g.items) {
      pages.add(item.pageId)
      if (item.parentType === 'COMPONENT' || item.parentType === 'INSTANCE') {
        components.add(`${item.pageId}:${item.parentName ?? ''}`)
      }
    }
    const src = g.descriptor.source
    if (src?.libraryName)   libraries.add(src.libraryName)
    if (src?.variableId)    variables.add(src.variableId)
  }

  return {
    signatureCount:         groups.length,
    layerCount:             totalLayers,
    pageCount:              pages.size,
    componentCount:         components.size,
    libraryCount:           libraries.size,
    variableCount:          variables.size,
    potentialConsolidations,
    estimatedReduction,
  }
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

let _wsCounter = 0

/**
 * Builds a WorkingSet<TypographyProperties> from a query expression.
 *
 * This is the canonical way to produce a Working Set for the Typography module.
 * Future modules produce their own typed Working Sets the same way.
 */
export function buildWorkingSet(
  allGroups: AuditGroup<TypographyProperties>[],
  query: QueryExpression,
  potentialConsolidations = 0,
  estimatedReduction = 0
): WorkingSet<TypographyProperties> {
  const items = evaluateQuery(allGroups, query)
  return {
    id: `ws_${_wsCounter++}`,
    module: 'typography',
    query,
    items,
    statistics: computeStatistics(items, potentialConsolidations, estimatedReduction),
  }
}
