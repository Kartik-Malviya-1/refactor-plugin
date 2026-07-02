import type { AuditGroup, AuditItem } from '../shared/types'

// ---------------------------------------------------------------------------
// Generic grouper
//
// Takes AuditItem<TProperties>[], a normalize function, and a describe
// function. Produces AuditGroup<TProperties>[] sorted by count descending.
//
// Async: yields every CHUNK items so the plugin thread stays responsive
// on files with hundreds of thousands of items. Checks isCancelled() at
// each yield point.
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

  const tSortStart = Date.now()
  groups.sort((a, b) => b.count - a.count)
  const sortingMs = Date.now() - tSortStart

  return { groups, groupingMs, sortingMs }
}
