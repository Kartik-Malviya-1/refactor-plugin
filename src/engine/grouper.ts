import type { AuditGroup, AuditItem } from '../shared/types'

// ---------------------------------------------------------------------------
// Generic async grouper
// ---------------------------------------------------------------------------

const CHUNK = 1000

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
//
// Separates normalization time (normalize() call per item) from bucket
// insertion time (Map.get/set/push per item) so the report can show them
// as distinct stages.
// ---------------------------------------------------------------------------

export interface GrouperInstrument {
  normalizationMs: number   // Stage 5: time in normalize() per item
  bucketInsertMs: number    // Stage 6: time in Map.get + Map.set/push per item
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
  // Reset grouper instrumentation for this scan.
  resetGrouperInstrument()

  const tGroupStart = Date.now()
  const buckets = new Map<string, AuditItem<TProperties>[]>()

  // ── Stages 5 + 6: Normalisation + bucket insertion ─────────────────
  for (let i = 0; i < items.length; i++) {
    if (i % CHUNK === 0 && i > 0) {
      await new Promise<void>((r) => setTimeout(r, 0))
      if (isCancelled()) {
        return { groups: [], groupingMs: Date.now() - tGroupStart, sortingMs: 0 }
      }
    }

    // Stage 5: Typography normalization (key generation)
    const _tNorm = Date.now()
    const key = normalize(items[i].properties)
    _grouperInstrument.normalizationMs += Date.now() - _tNorm
    _grouperInstrument.normalizationCount++

    // Stage 6: Bucket insertion (Map operations)
    const _tBucket = Date.now()
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.push(items[i])
    } else {
      buckets.set(key, [items[i]])
    }
    _grouperInstrument.bucketInsertMs += Date.now() - _tBucket
  }

  const groupingMs = Date.now() - tGroupStart

  // ── Build group objects ─────────────────────────────────────────
  const groups: AuditGroup<TProperties>[] = []
  for (const [key, bucket] of buckets) {
    const descriptor = bucket[0].properties
    groups.push({
      id: `${moduleId}_${hashKey(key)}`,
      key,
      label: describe(descriptor),
      count: bucket.length,
      items: bucket,
      descriptor,
    })
  }

  // ── Stage 8: Sorting ─────────────────────────────────────────
  const tSortStart = Date.now()
  groups.sort((a, b) => b.count - a.count)
  const sortingMs = Date.now() - tSortStart

  if (isCancelled()) {
    return { groups: [], groupingMs, sortingMs }
  }

  return { groups, groupingMs, sortingMs }
}
