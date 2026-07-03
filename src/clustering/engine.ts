import type { AuditGroup, SourceType } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { TypographyCluster, ClusteringConfig, ClusterReason, ConfidenceLabel } from './types'
import { computeSimilarityWithWeights } from '../similarity/scorer'

// ---------------------------------------------------------------------------
// Cluster reason generation
// ---------------------------------------------------------------------------

/**
 * Explains WHY this cluster exists by comparing all members to the dominant.
 * Every cluster must explain itself — confidence is never displayed without reasons.
 */
export function buildClusterReasons(
  members: AuditGroup<TypographyProperties>[],
  dominant: TypographyProperties
): ClusterReason[] {
  if (members.length <= 1) {
    return [{ property: 'Unique', description: 'Only one Typography Signature in this cluster', type: 'match' }]
  }

  const N = members.length
  const reasons: ClusterReason[] = []

  // Font Family
  const sameFamily = members.filter(m => m.descriptor.fontFamily === dominant.fontFamily).length
  if (sameFamily === N) {
    reasons.push({ property: 'Font Family', description: `All use ${dominant.fontFamily}`, type: 'match' })
  } else {
    const families = [...new Set(members.map(m => m.descriptor.fontFamily))]
    if (families.length <= 2) {
      reasons.push({ property: 'Font Family', description: `Similar families: ${families.join(', ')}`, type: 'similar' })
    }
  }

  // Font Size
  const sizes = members.map(m => m.descriptor.fontSize)
  const sameSize = sizes.every(s => s === dominant.fontSize)
  const sizeRange = [Math.min(...sizes), Math.max(...sizes)]
  if (sameSize) {
    reasons.push({ property: 'Font Size', description: `Same size (${dominant.fontSize}px)`, type: 'match' })
  } else if (sizeRange[1] - sizeRange[0] <= 4) {
    reasons.push({ property: 'Font Size', description: `Similar sizes (${sizeRange[0]}–${sizeRange[1]}px)`, type: 'similar' })
  } else {
    reasons.push({ property: 'Font Size', description: `Varying sizes (${sizeRange[0]}–${sizeRange[1]}px)`, type: 'different' })
  }

  // Font Weight
  const weights = members.map(m => m.descriptor.fontWeight)
  const sameWeight = weights.every(w => w === dominant.fontWeight)
  const weightRange = [Math.min(...weights), Math.max(...weights)]
  if (sameWeight) {
    reasons.push({ property: 'Font Weight', description: `Same weight (${dominant.fontWeight})`, type: 'match' })
  } else if (weightRange[1] - weightRange[0] <= 200) {
    reasons.push({ property: 'Font Weight', description: `Similar weights (${weightRange[0]}–${weightRange[1]})`, type: 'similar' })
  }

  // Line Height
  const domLH = dominant.lineHeight
  const nearLH = members.filter(m => {
    const mLH = m.descriptor.lineHeight
    if (mLH.unit !== domLH.unit) return false
    if (mLH.unit === 'AUTO') return true
    const max = Math.max(mLH.value, domLH.value)
    return max === 0 || Math.abs(mLH.value - domLH.value) / max <= 0.15
  }).length
  if (nearLH === N) {
    const lhDisplay = domLH.unit === 'AUTO' ? 'Auto' : `${domLH.value}${domLH.unit === 'PERCENT' ? '%' : 'px'}`
    reasons.push({ property: 'Line Height', description: `Similar line height (≈${lhDisplay})`, type: 'similar' })
  }

  // Letter Spacing
  const allNearZeroLS = members.every(m => Math.abs(m.descriptor.letterSpacing.value) <= 0.5)
  if (allNearZeroLS && Math.abs(dominant.letterSpacing.value) <= 0.5) {
    reasons.push({ property: 'Letter Spacing', description: 'Similar letter spacing (near default)', type: 'similar' })
  }

  // Cap at 5 most informative reasons; filter out 'different' unless no others exist
  const nonDiff = reasons.filter(r => r.type !== 'different')
  return (nonDiff.length > 0 ? nonDiff : reasons).slice(0, 5)
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

function toConfidenceLabel(score: number): ConfidenceLabel {
  if (score >= 95) return 'Very Strong'
  if (score >= 85) return 'Strong'
  if (score >= 70) return 'Review Recommended'
  return 'Weak'
}

// ---------------------------------------------------------------------------
// Cluster builder
// ---------------------------------------------------------------------------

function buildCluster(
  id: string,
  members: AuditGroup<TypographyProperties>[],
  dominant: TypographyProperties,
  config: ClusteringConfig
): TypographyCluster {
  const signatureCount = members.length
  const totalLayers    = members.reduce((s, m) => s + m.count, 0)

  // Per-member similarity to dominant
  const memberSimilarities = new Map<string, number>()
  for (const m of members) {
    memberSimilarities.set(m.id, computeSimilarityWithWeights(m.descriptor, dominant, config.weights))
  }

  // Confidence = average similarity of all members to dominant
  const sims = [...memberSimilarities.values()]
  const confidence = signatureCount === 1
    ? 100
    : Math.round(sims.reduce((a, b) => a + b, 0) / sims.length)

  // Outliers
  const outlierIds = new Set<string>()
  for (const m of members) {
    if ((memberSimilarities.get(m.id) ?? 100) < config.outlierThreshold) {
      outlierIds.add(m.id)
    }
  }

  // Source breakdown
  const sourceBreakdown: Partial<Record<SourceType, number>> = {}
  for (const m of members) {
    const src = (m.source ?? 'Unknown') as SourceType
    sourceBreakdown[src] = (sourceBreakdown[src] ?? 0) + m.count
  }

  // Usage breakdown
  const usageBreakdown: Record<string, number> = {}
  for (const m of members) {
    for (const item of m.items) {
      if (item.parentType) {
        usageBreakdown[item.parentType] = (usageBreakdown[item.parentType] ?? 0) + 1
      }
    }
  }

  // Page coverage
  const pageIds = new Set<string>()
  for (const m of members) {
    for (const item of m.items) pageIds.add(item.pageId)
  }

  return {
    id,
    members,
    signatureCount,
    totalLayers,
    dominant,
    confidence,
    confidenceLabel: toConfidenceLabel(confidence),
    clusterReasons: buildClusterReasons(members, dominant),
    sourceBreakdown,
    usageBreakdown,
    outlierIds,
    outlierCount: outlierIds.size,
    pageIds,
    memberSimilarities,
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Builds Typography Clusters from Typography Signature groups.
 *
 * Algorithm: greedy leader-clustering with configurable thresholds.
 *   1. Sort groups by layer count descending.
 *   2. For each group, find the cluster whose representative has the
 *      highest weighted similarity.
 *   3. If best ≥ config.mergeThreshold: join that cluster.
 *   4. Otherwise: start a new cluster.
 *
 * Deterministic: same input + same config → same output, always.
 *
 * Clustering and scoring are independent:
 *   - Changing config.weights changes how properties are compared.
 *   - Changing config.mergeThreshold changes how clusters form.
 *   - Neither requires a document rescan.
 */
export function buildTypographyClusters(
  groups: AuditGroup<TypographyProperties>[],
  config: ClusteringConfig
): TypographyCluster[] {
  if (groups.length === 0) return []

  const sorted = [...groups].sort((a, b) => b.count - a.count)

  const proto: {
    representative: TypographyProperties
    members: AuditGroup<TypographyProperties>[]
  }[] = []

  for (const group of sorted) {
    const props = group.descriptor
    let bestIdx = -1
    let bestSim = -1

    for (let i = 0; i < proto.length; i++) {
      const sim = computeSimilarityWithWeights(props, proto[i].representative, config.weights)
      if (sim > bestSim) { bestSim = sim; bestIdx = i }
    }

    if (bestIdx >= 0 && bestSim >= config.mergeThreshold) {
      proto[bestIdx].members.push(group)
    } else {
      proto.push({ representative: props, members: [group] })
    }
  }

  return proto
    .map((p, i) => buildCluster(`cluster_${i}`, p.members, p.representative, config))
    .sort((a, b) => b.totalLayers - a.totalLayers)
}
