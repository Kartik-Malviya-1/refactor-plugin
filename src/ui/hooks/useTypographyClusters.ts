import { useMemo } from 'react'
import { useAuditStore } from '../store/audit'
import { useClusteringStore } from '../store/clustering'
import { buildTypographyClusters } from '../../clustering/engine'
import type { TypographyCluster } from '../../clustering/types'
import type { AuditGroup } from '../../shared/types'
import type { TypographyProperties } from '../../modules/typography/types'

/**
 * Computes Typography Clusters from the current AuditResult.
 *
 * Recalculates when:
 *   - The scan result changes (new scan)
 *   - The clustering config changes (strategy switch)
 *
 * Never calls Figma API. Never triggers a document rescan.
 * O(N×F) where F = cluster count, typically fast for real group counts.
 */
export function useTypographyClusters(): TypographyCluster[] {
  const { result } = useAuditStore()
  const { config } = useClusteringStore()

  return useMemo(() => {
    if (!result || result.groups.length === 0) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groups = result.groups as unknown as AuditGroup<TypographyProperties>[]
    return buildTypographyClusters(groups, config)
  }, [result, config])
}
