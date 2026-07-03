/**
 * Review Changes computation layer.
 *
 * computeReview<T> is intentionally generic so the same logic works for
 * any audit module (Typography, Colors, Spacing, Radius, Effects,
 * Variables, Components) that produces:
 *   groups      AuditGroup<T>[]              — from the scan result
 *   assignments Record<string, AssignedTarget> — from useAssignmentStore,
 *                                               keyed by AuditGroup.key
 *
 * For v0.3 only Typography is wired. The types and algorithm are
 * module-agnostic so future modules share the same review infrastructure.
 */

import type { AuditGroup } from '../../shared/types'
import type { AssignedTarget } from '../../clustering/types'

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** One mapping entry enriched with usage data from the scan result. */
export interface MappingCard<T = Record<string, unknown>> {
  signatureKey:   string
  group:          AuditGroup<T>
  assignment:     AssignedTarget
  layerCount:     number
  pageCount:      number
  componentCount: number
  pageNames:      string[]
}

export type ConflictSeverity = 'error' | 'warning'

export interface ReviewConflict {
  type:          'duplicate-target' | 'large-impact' | 'all-skipped'
  severity:      ConflictSeverity
  message:       string
  signatureKeys: string[]
}

export interface ReviewStats {
  totalMappings:   number  // all cards including skips
  activeMappings:  number  // non-skip cards
  skipCount:       number
  totalLayers:     number  // active cards only
  totalPages:      number  // unique page IDs across active cards
  totalComponents: number  // active cards only
  uniqueTargets:   number  // distinct target identities across active cards
}

export interface ReviewResult<T = Record<string, unknown>> {
  cards:     MappingCard<T>[]
  conflicts: ReviewConflict[]
  stats:     ReviewStats
  /**
   * True when there are no error-level conflicts and at least one active
   * (non-skip) mapping. Gates the Apply button.
   */
  isReady:   boolean
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Mappings affecting this many layers or more trigger a large-impact warning. */
const LARGE_IMPACT_THRESHOLD = 500

// ---------------------------------------------------------------------------
// computeReview
// ---------------------------------------------------------------------------

export function computeReview<T>(
  groups:      AuditGroup<T>[],
  assignments: Record<string, AssignedTarget>
): ReviewResult<T> {
  // Build O(1) lookup from signature key → AuditGroup
  const groupByKey = new Map<string, AuditGroup<T>>()
  for (const g of groups) groupByKey.set(g.key, g)

  // Build mapping cards
  const cards: MappingCard<T>[] = []
  for (const [sigKey, assignment] of Object.entries(assignments)) {
    const group = groupByKey.get(sigKey)
    if (!group) continue  // orphan — pruneOrphans should have cleared this

    const pageNames = [...new Set(group.items.map(i => i.pageName))]
    const componentCount = group.items.filter(i =>
      i.parentType === 'COMPONENT' || i.parentType === 'INSTANCE'
    ).length

    cards.push({
      signatureKey: sigKey,
      group,
      assignment,
      layerCount:    group.count,
      pageCount:     pageNames.length,
      componentCount,
      pageNames,
    })
  }

  // Sort by layer count descending — highest-impact changes first
  cards.sort((a, b) => b.layerCount - a.layerCount)

  // ---------------------------------------------------------------------------
  // Conflict detection
  // ---------------------------------------------------------------------------
  const conflicts: ReviewConflict[] = []

  // 1. Duplicate target: multiple signatures → same existing-style styleId
  const targetStyleIds = new Map<string, string[]>()
  for (const card of cards) {
    const t = card.assignment.target
    if (t.type === 'existing-style') {
      const arr = targetStyleIds.get(t.styleId) ?? []
      arr.push(card.signatureKey)
      targetStyleIds.set(t.styleId, arr)
    }
  }
  for (const [, sigKeys] of targetStyleIds) {
    if (sigKeys.length > 1) {
      conflicts.push({
        type:          'duplicate-target',
        severity:      'warning',
        message:       `${sigKeys.length} different signatures consolidate to the same target style`,
        signatureKeys: sigKeys,
      })
    }
  }

  // 2. Large impact
  for (const card of cards) {
    if (card.layerCount >= LARGE_IMPACT_THRESHOLD && card.assignment.target.type !== 'skip') {
      conflicts.push({
        type:          'large-impact',
        severity:      'warning',
        message:       `“${card.assignment.label}” will affect ${card.layerCount.toLocaleString()} layers — review carefully`,
        signatureKeys: [card.signatureKey],
      })
    }
  }

  // 3. All-skipped
  const activeCards = cards.filter(c => c.assignment.target.type !== 'skip')
  if (cards.length > 0 && activeCards.length === 0) {
    conflicts.push({
      type:          'all-skipped',
      severity:      'warning',
      message:       'Every planned change is marked Skip — nothing will be applied',
      signatureKeys: [],
    })
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------
  const skipCount       = cards.length - activeCards.length
  const totalLayers     = activeCards.reduce((s, c) => s + c.layerCount, 0)
  const totalPages      = new Set(activeCards.flatMap(c => c.group.items.map(i => i.pageId))).size
  const totalComponents = activeCards.reduce((s, c) => s + c.componentCount, 0)

  // Unique target identities (distinct destinations, not just distinct type)
  const uniqueTargetSet = new Set<string>()
  for (const card of activeCards) {
    const t = card.assignment.target
    switch (t.type) {
      case 'existing-style':    uniqueTargetSet.add(`s:${t.styleId}`);         break
      case 'existing-variable': uniqueTargetSet.add(`v:${t.variableId}`);       break
      case 'new-style':         uniqueTargetSet.add(`ns:${t.name}`);            break
      case 'new-variable':      uniqueTargetSet.add(`nv:${t.variableName}`);    break
      case 'manual-values':     uniqueTargetSet.add(`m:${card.signatureKey}`);  break
    }
  }

  const stats: ReviewStats = {
    totalMappings:   cards.length,
    activeMappings:  activeCards.length,
    skipCount,
    totalLayers,
    totalPages,
    totalComponents,
    uniqueTargets:   uniqueTargetSet.size,
  }

  const hasErrors = conflicts.some(c => c.severity === 'error')
  const isReady   = !hasErrors && activeCards.length > 0

  return { cards, conflicts, stats, isReady }
}
