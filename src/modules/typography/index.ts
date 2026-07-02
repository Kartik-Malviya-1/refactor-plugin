import type { AuditGroup, AuditItem, AuditModule, ScanProgress, ScanScope } from '../../shared/types'
import type { TypographyProperties } from './types'
import { normalizeTypography, normalizeTypographyProps } from './normalizer'
import { scanEngine } from '../../engine/core'
import { typographyScannerAdapter } from './adapter'

// ---------------------------------------------------------------------------
// Profiling data for the grouping phase.
// Still exported so existing imports in tests or tooling continue to work.
// After the engine refactor, main.ts reads scanEngine.timings instead.
// ---------------------------------------------------------------------------
export const _groupTimings = {
  normalizationMs: 0,
  sortingMs: 0,
}

// ---------------------------------------------------------------------------
// Internals (sync grouping — kept for AuditModule.group() compatibility)
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
// Typography Module
//
// Implements AuditModule<TypographyProperties> for the module registry
// and UI catalog. scan() and group() now delegate to the Core Scan Engine
// via TypographyScannerAdapter.
//
// AuditModule interface is unchanged — backwards compatible.
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
    // Delegate to the engine. isCancelled is a no-op here because
    // cancellation is managed by the engine runner in main.ts.
    const { items } = await scanEngine.run(
      typographyScannerAdapter,
      scope,
      () => false,
      onProgress
    )
    return items
  },

  normalize(item: AuditItem<TypographyProperties>): string {
    return normalizeTypography(item)
  },

  describe(descriptor: TypographyProperties): string {
    return `${descriptor.fontFamily} ${descriptor.fontStyle} / ${descriptor.fontSize}px`
  },

  // Synchronous group() retained for AuditModule interface compatibility.
  // main.ts no longer calls this — it uses scanEngine.run() which includes
  // async grouping. This method exists so external callers of the module
  // interface continue to work without modification.
  group(items: AuditItem<TypographyProperties>[]): AuditGroup<TypographyProperties>[] {
    const buckets = new Map<string, AuditItem<TypographyProperties>[]>()

    const tNormStart = Date.now()
    for (const item of items) {
      const key = normalizeTypographyProps(item.properties)
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.push(item)
      } else {
        buckets.set(key, [item])
      }
    }
    _groupTimings.normalizationMs = Date.now() - tNormStart

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

    const tSortStart = Date.now()
    groups.sort((a, b) => b.count - a.count)
    _groupTimings.sortingMs = Date.now() - tSortStart

    return groups
  },
}
