import { useMemo } from 'react'
import { useAuditStore } from '../store/audit'
import { buildCandidateFamilies } from '../../similarity/builder'
import type { CandidateFamily } from '../../similarity/types'
import type { AuditGroup } from '../../shared/types'
import type { TypographyProperties } from '../../modules/typography/types'

/**
 * Computes Candidate Families from the current AuditResult.
 *
 * The computation runs inside a useMemo so it executes once per scan
 * result, not on every render. For typical group counts (<2,000) the
 * O(N×F) algorithm completes in <100ms.
 */
export function useCandidateFamilies(): CandidateFamily[] {
  const { result } = useAuditStore()

  return useMemo(() => {
    if (!result || result.groups.length === 0) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groups = result.groups as unknown as AuditGroup<TypographyProperties>[]
    return buildCandidateFamilies(groups)
  }, [result])
}
