import type { AuditGroup, AuditItem } from '../shared/types'

// ---------------------------------------------------------------------------
// Generic async grouper
// ---------------------------------------------------------------------------

const CHUNK = 1000

/**
 * Deterministic 32-bit djb2-style hash rendered as base36.
 * Used only to produce short convenience IDs from the canonical key.
 * Not collision-free — do NOT use the resulting id as a persistent
 * identity for assignments, mappings, or any future migration module.
 * Use AuditGroup.key for canonical identity.
 */
function hashKey(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

// ---------------------------------------------------------------------------
// Instrumentation
// ---------------------------------------------------------------------------

export interface GrouperInstrument {
  normalizationMs: number
  bucketInsertMs: number
  normalizationCount: number
}

export const _grouperInstrument: GrouperInstrument = {
  normalizationMs: 0,
  bucketInsertMs: 0,
  normalizationCount: 0,
}

function resetGrouperInstrument(): void {
  _grouperInstrument.normalizationMs = 0
  _grouperInstrument.bucketInsertMs = 0
  _grouperInstrument.normalizationCount = 0
}

export interface GrouperResult<TProperties> {
  groups: AuditGroup<TProperties>[]
  groupingMs: number
  sortingMs: number
}

export async function groupItems<TProperties>(
  moduleId: string,
  items: AuditItem<TProperties>[],
  normalize: (props: TProperties) => string,
  describe: (props: TProperties) => string,
  isCancelled: () => boolean
): Promise<GrouperResult<TProperties>> {
  resetGrouperInstrument()

  const tGroupStart = Date.now()
  const buckets = new Map<string, AuditItem<TProperties>[]>()

  for (let i = 0; i < items.length; i++) {
    if (i % CHUNK === 0 && i > 0) {
      await new Promise<void>((r) => setTimeout(r, 0))
      if (isCancelled()) {
        return { groups: [], groupingMs: Date.now() - tGroupStart, sortingMs: 0 }
      }
    }

    const _tNorm = Date.now()
    const key = normalize(items[i].properties)
    _grouperInstrument.normalizationMs += Date.now() - _tNorm
    _grouperInstrument.normalizationCount++

    const _tBucket = Date.now()
    const bucket = buckets.get(key)
    if (bucket) { bucket.push(items[i]) } else { buckets.set(key, [items[i]]) }
    _grouperInstrument.bucketInsertMs += Date.now() - _tBucket
  }

  const groupingMs = Date.now() - tGroupStart

  const groups: AuditGroup<TProperties>[] = []
  for (const [key, bucket] of buckets) {
    const descriptor = bucket[0].properties
    groups.push({
      // key is the CANONICAL Typography Signature identifier.
      // Stable, collision-free, module-independent. Use for assignments,
      // mappings, migration plan, preview, apply, reports, navigation.
      //
      // id is a SHORT DERIVED convenience handle for React rendering keys.
      // Format: moduleId + '_' + hash32(key). Stable but hash-collision-
      // prone. Never use id for persistent identity or assignment lookup.
      id:  `${moduleId}_${hashKey(key)}`,
      key,
      label: describe(descriptor),
      count: bucket.length,
      items: bucket,
      descriptor,
    })
  }

  const tSortStart = Date.now()
  groups.sort((a, b) => b.count - a.count)
  const sortingMs = Date.now() - tSortStart

  if (isCancelled()) return { groups: [], groupingMs, sortingMs }
  return { groups, groupingMs, sortingMs }
}
