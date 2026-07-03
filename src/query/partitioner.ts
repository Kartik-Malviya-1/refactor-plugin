import type { AuditGroup } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { TypographyCluster } from '../clustering/types'
import type { ClusteringConfig } from '../clustering/types'
import { buildTypographyClusters } from '../clustering/engine'

// ---------------------------------------------------------------------------
// Semantic boundary partitioning
//
// The key insight: Font Size is a SEMANTIC partition, not just another
// weighted property. 12px body copy and 16px body copy represent different
// hierarchy levels and should NEVER be consolidation candidates — even
// if their other properties are nearly identical.
//
// Partition first by (fontFamily, fontSize). Only compare signatures
// WITHIN the same partition. This eliminates false consolidation
// opportunities that global clustering would generate.
// ---------------------------------------------------------------------------

export function partitionBySemanticBoundary(
  groups: AuditGroup<TypographyProperties>[]
): Map<string, AuditGroup<TypographyProperties>[]> {
  const map = new Map<string, AuditGroup<TypographyProperties>[]>()
  for (const g of groups) {
    // Primary boundaries: font family (visual identity) + font size (hierarchy)
    const key = `${g.descriptor.fontFamily}||${g.descriptor.fontSize}`
    const arr = map.get(key) ?? []
    arr.push(g)
    map.set(key, arr)
  }
  return map
}

/**
 * Builds Suggested Consolidations from a Working Set.
 *
 * Algorithm:
 *  1. Partition Working Set by (fontFamily, fontSize).
 *  2. Within each partition, run clustering (same algorithm as before).
 *  3. Only return clusters with >1 signature (actual consolidation value).
 *
 * Key differences from global clustering:
 *  • Only operates on the Working Set provided — never the full document.
 *  • 12px and 16px are never compared, regardless of config thresholds.
 *  • Only surfaces genuine consolidation opportunities (multi-sig clusters).
 */
export function buildSuggestedConsolidations(
  workingSetGroups: AuditGroup<TypographyProperties>[],
  config: ClusteringConfig
): TypographyCluster[] {
  if (workingSetGroups.length < 2) return []

  const partitions = partitionBySemanticBoundary(workingSetGroups)
  const suggestions: TypographyCluster[] = []

  for (const partitionGroups of partitions.values()) {
    if (partitionGroups.length < 2) continue  // single signature: nothing to consolidate
    const clusters = buildTypographyClusters(partitionGroups, config)
    // Only include clusters that actually consolidate (>1 signature → fewer targets)
    suggestions.push(...clusters.filter(c => c.signatureCount > 1))
  }

  return suggestions.sort((a, b) => b.totalLayers - a.totalLayers)
}

/**
 * Lightweight version: counts opportunities without building full clusters.
 * Used for overview statistics.
 */
export function countPotentialConsolidations(
  groups: AuditGroup<TypographyProperties>[],
  config: ClusteringConfig
): { opportunities: number; estimatedReduction: number } {
  if (groups.length < 2) return { opportunities: 0, estimatedReduction: 0 }

  const partitions = partitionBySemanticBoundary(groups)
  let opportunities = 0
  let estimatedReduction = 0

  for (const partitionGroups of partitions.values()) {
    if (partitionGroups.length < 2) continue
    const clusters = buildTypographyClusters(partitionGroups, config)
    const consolidating = clusters.filter(c => c.signatureCount > 1)
    opportunities += consolidating.length
    estimatedReduction += consolidating.reduce((s, c) => s + (c.signatureCount - 1), 0)
  }

  return { opportunities, estimatedReduction }
}
