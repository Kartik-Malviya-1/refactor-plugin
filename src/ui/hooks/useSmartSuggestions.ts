import { useMemo } from 'react'
import { useAuditStore } from '../store/audit'
import { useCandidateFamilies } from './useCandidateFamilies'
import { usePlanningDataStore } from '../store/planningData'
import { useMigrationStore } from '../store/migration'
import { useSessionLearning } from './useSessionLearning'
import { generateSuggestions } from '../../suggestions/engine'
import type { SmartSuggestion } from '../../suggestions/types'

/**
 * Computes Smart Suggestions for every Typography Family.
 *
 * Returns a Map<familyId, SmartSuggestion[]> computed via useMemo.
 * Only recalculates when families, styles/variables, the plan, or
 * session learning data changes — not on every render.
 */
export function useSmartSuggestions(): Map<string, SmartSuggestion[]> {
  const { result }        = useAuditStore()
  const families          = useCandidateFamilies()
  const { textStyles, variables } = usePlanningDataStore()
  const { plan }          = useMigrationStore()
  const { accepted }      = useSessionLearning()

  return useMemo(() => {
    const map = new Map<string, SmartSuggestion[]>()
    if (!result || families.length === 0) return map

    // Families that have already been planned are used as cross-family evidence.
    const otherPlanned = families
      .filter((f) => {
        const e = plan.entries[f.id]
        return e && (e.status === 'planned' || e.status === 'modified') && e.target
      })
      .map((f) => ({ family: f, entry: plan.entries[f.id] }))

    for (const family of families) {
      const suggestions = generateSuggestions(family, {
        textStyles,
        variables,
        otherPlanned: otherPlanned.filter((o) => o.family.id !== family.id),
        sessionAccepted: accepted,
        strategy: plan.strategy,
      })
      map.set(family.id, suggestions)
    }

    return map
  }, [result, families, textStyles, variables, plan, accepted])
}
