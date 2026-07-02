import type { AuditGroup, SourceType } from '../shared/types'
import type { TypographyProperties } from '../modules/typography/types'
import type { CandidateFamily, ConfidenceLabel } from './types'
import { computeSimilarity } from './scorer'
import { FAMILY_CONFIG } from './weights'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toConfidenceLabel(score: number): ConfidenceLabel {
  if (score >= 95) return 'Very Strong'
  if (score >= 85) return 'Strong'
  if (score >= 70) return 'Review Recommended'
  return 'Weak'
}

function assembleFamily(
  id: string,
  members: AuditGroup<TypographyProperties>[],
  dominant: TypographyProperties
): CandidateFamily {
  const signatureCount = members.length
  const totalLayers    = members.reduce((s, m) => s + m.count, 0)

  // Per-member similarity to dominant
  const memberSimilarities = new Map<string, number>()
  for (const m of members) {
    memberSimilarities.set(m.id, computeSimilarity(m.descriptor, dominant))
  }

  // Confidence: average similarity of all members to dominant
  const sims = [...memberSimilarities.values()]
  const confidence = signatureCount === 1
    ? 100
    : Math.round(sims.reduce((a, b) => a + b, 0) / sims.length)

  // Outliers: members below OUTLIER_THRESHOLD
  const outlierIds = new Set<string>()
  for (const m of members) {
    if ((memberSimilarities.get(m.id) ?? 100) < FAMILY_CONFIG.OUTLIER_THRESHOLD) {
      outlierIds.add(m.id)
    }
  }

  // Source breakdown
  const sourceBreakdown: Partial<Record<SourceType, number>> = {}
  for (const m of members) {
    const src = (m.source ?? 'Unknown') as SourceType
    sourceBreakdown[src] = (sourceBreakdown[src] ?? 0) + m.count
  }

  // Usage breakdown (parent type distribution)
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
    sourceBreakdown,
    usageBreakdown,
    outlierIds,
    outlierCount: outlierIds.size,
    pageIds,
    memberSimilarities,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds Candidate Families from Typography Signature groups.
 *
 * Algorithm: greedy leader-clustering.
 *   1. Sort groups by layer count descending so the most-used signatures
 *      become family representatives (they define the canonical style).
 *   2. For each group find the existing family whose representative has
 *      the highest similarity score to this group’s properties.
 *   3. If best score ≥ MERGE_THRESHOLD: join that family.
 *   4. Otherwise: create a new family with this group as its representative.
 *
 * Deterministic: same input + same config → same output, always.
 *
 * The scoring algorithm (scorer.ts) and the clustering config (weights.ts)
 * are intentionally separate from this function. You can:
 *   • Change MERGE_THRESHOLD to tune granularity without touching scoring.
 *   • Replace this function with hierarchical clustering (Sprint 4+)
 *     without touching the similarity scores.
 *
 * Complexity: O(N × F) where F = current family count.
 * In practice F ≪ N so this runs in milliseconds for realistic group counts.
 */
export function buildCandidateFamilies(
  groups: AuditGroup<TypographyProperties>[],
  config = FAMILY_CONFIG
): CandidateFamily[] {
  if (groups.length === 0) return []

  // Most-used signatures become family representatives first
  const sorted = [...groups].sort((a, b) => b.count - a.count)

  const proto: { representative: TypographyProperties; members: AuditGroup<TypographyProperties>[] }[] = []

  for (const group of sorted) {
    const props = group.descriptor
    let bestIdx = -1
    let bestSim = -1

    for (let i = 0; i < proto.length; i++) {
      const sim = computeSimilarity(props, proto[i].representative)
      if (sim > bestSim) { bestSim = sim; bestIdx = i }
    }

    if (bestIdx >= 0 && bestSim >= config.MERGE_THRESHOLD) {
      proto[bestIdx].members.push(group)
    } else {
      proto.push({ representative: props, members: [group] })
    }
  }

  return proto
    .map((p, i) => assembleFamily(`family_${i}`, p.members, p.representative))
    .sort((a, b) => b.totalLayers - a.totalLayers)
}
