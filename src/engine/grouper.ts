import type { AuditGroup, AuditItem } from '../shared/types'

// ---------------------------------------------------------------------------
// Generic async grouper
//
// Yields every CHUNK items during normalization so the plugin thread stays
// responsive on files with hundreds of thousands of items.
// isCancelled() is checked at each yield and after sorting.
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
  const tGroupStart = Date.now()
  const buckets = new Map<string, AuditItem<TProperties>[]>()

  // ── Normalisation + bucketing ──────────────────────────────────────
  for (let i = 0; i < items.length; i++) {
    if (i % CHUNK === 0 && i > 0) {
      await new Promise<void>((r) => setTimeout(r, 0))
      if (isCancelled()) {
        return { groups: [], groupingMs: Date.now() - tGroupStart, sortingMs: 0 }
      }
    }

    const key = normalize(items[i].properties)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.push(items[i])
    } else {
      buckets.set(key, [items[i]])
    }
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

  // ── Sort ─────────────────────────────────────────────────────────
  const tSortStart = Date.now()
  groups.sort((a, b) => b.count - a.count)
  const sortingMs = Date.now() - tSortStart

  // Check cancellation after the synchronous sort. If the user cancelled
  // during this window, discard results rather than propagating partial data.
  if (isCancelled()) {
    return { groups: [], groupingMs, sortingMs }
  }

  return { groups, groupingMs, sortingMs }
}
