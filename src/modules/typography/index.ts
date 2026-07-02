import type { AuditGroup, AuditItem, AuditModule, ScanProgress, ScanScope } from '../../shared/types'
import type { TypographyProperties } from './types'
import { normalizeTypography } from './normalizer'
import { scanTypography } from './scanner'

// ---------------------------------------------------------------------------
// Profiling data — populated during every group() call.
// Read by src/plugin/main.ts after the call returns to build the report.
// ---------------------------------------------------------------------------
export const _groupTimings = {
  normalizationMs: 0,
  sortingMs: 0,
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function hashKey(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return `typo_${Math.abs(hash).toString(36)}`
}

// ---------------------------------------------------------------------------
// Typography Module — reference AuditModule implementation
// ---------------------------------------------------------------------------

export const typographyModule: AuditModule<TypographyProperties> = {
  id: 'typography',
  name: 'Typography',
  description: 'Font families, weights, sizes, line heights, and spacing',
  icon: 'Type',

  async scan(
    scope: ScanScope,
    onProgress?: (p: ScanProgress) => void
  ): Promise<AuditItem<TypographyProperties>[]> {
    return scanTypography(scope, onProgress)
  },

  normalize(item: AuditItem<TypographyProperties>): string {
    return normalizeTypography(item)
  },

  describe(descriptor: TypographyProperties): string {
    return `${descriptor.fontFamily} ${descriptor.fontStyle} / ${descriptor.fontSize}px`
  },

  group(items: AuditItem<TypographyProperties>[]): AuditGroup<TypographyProperties>[] {
    const buckets = new Map<string, AuditItem<TypographyProperties>[]>()

    // ── Stage: Normalization ───────────────────────────────────────────────
    // Normalizes each item into a grouping key and distributes into buckets.
    const tNormStart = Date.now()

    for (const item of items) {
      const key = this.normalize(item)
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.push(item)
      } else {
        buckets.set(key, [item])
      }
    }

    _groupTimings.normalizationMs = Date.now() - tNormStart

    // Build group objects from buckets (not timed separately — O(n) trivial)
    const groups: AuditGroup<TypographyProperties>[] = []
    for (const [key, bucket] of buckets) {
      const descriptor = bucket[0].properties
      groups.push({
        id: hashKey(key),
        key,
        label: this.describe(descriptor),
        count: bucket.length,
        items: bucket,
        descriptor,
      })
    }

    // ── Stage: Sorting ─────────────────────────────────────────────────────
    const tSortStart = Date.now()
    groups.sort((a, b) => b.count - a.count)
    _groupTimings.sortingMs = Date.now() - tSortStart

    return groups
  },
}
