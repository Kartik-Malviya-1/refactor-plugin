import { useRef, useMemo, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'
import { GroupRow } from './GroupRow'
import { useUIStore } from '../../store/ui'
import { cn } from '../../lib/cn'

interface AuditTableProps {
  groups: AuditGroup<TypographyProperties>[]
}

type SortField = 'count' | 'family' | 'size'
const COL_WIDTHS = '52px 1fr 80px 58px 70px 72px 64px 36px'

const columns: { key: SortField | null; label: string }[] = [
  { key: null, label: 'Preview' },
  { key: 'family', label: 'Family / Style' },
  { key: 'size', label: 'Size' },
  { key: null, label: 'Line H.' },
  { key: null, label: 'Letter S.' },
  { key: 'count', label: 'Layers' },
  { key: null, label: '' },
  { key: null, label: '' },
]

export function AuditTable({ groups }: AuditTableProps) {
  const { selectedGroupId, expandedGroupIds, sortField, sortDirection, setSort, selectGroup, toggleGroupExpand } = useUIStore()

  const sorted = useMemo(() => {
    return [...groups].sort((a, b) => {
      let cmp = 0
      if (sortField === 'count') cmp = a.count - b.count
      else if (sortField === 'family') cmp = a.descriptor.fontFamily.localeCompare(b.descriptor.fontFamily)
      else if (sortField === 'size') cmp = a.descriptor.fontSize - b.descriptor.fontSize
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [groups, sortField, sortDirection])

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSort(field, sortDirection === 'asc' ? 'desc' : 'asc')
      } else {
        setSort(field, field === 'count' ? 'desc' : 'asc')
      }
    },
    [sortField, sortDirection, setSort]
  )

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const group = sorted[index]
      return 40 + (expandedGroupIds.has(group.id) ? group.items.length * 28 : 0)
    },
    overscan: 8,
  })

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 opacity-30" />
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-accent" /> : <ArrowDown className="w-3 h-3 text-accent" />
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="grid items-center h-8 shrink-0 bg-surface-0 border-b border-border text-2xs font-semibold text-ink-3 uppercase tracking-wider"
        style={{ gridTemplateColumns: COL_WIDTHS }}
      >
        {columns.map((col, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-1 pr-2',
              i === 0 ? 'pl-2 justify-center' : '',
              col.key ? 'cursor-pointer select-none hover:text-ink transition-colors' : ''
            )}
            onClick={() => col.key && handleSort(col.key)}
          >
            {col.label}{col.key && <SortIcon field={col.key} />}
          </div>
        ))}
      </div>

      <div ref={parentRef} className="flex-1 overflow-y-auto min-h-0">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vItem) => {
            const group = sorted[vItem.index]
            return (
              <div
                key={group.id}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vItem.start}px)` }}
              >
                <GroupRow
                  group={group}
                  rank={vItem.index}
                  isSelected={selectedGroupId === group.id}
                  isExpanded={expandedGroupIds.has(group.id)}
                  onSelect={() => selectGroup(selectedGroupId === group.id ? null : group.id)}
                  onToggleExpand={() => toggleGroupExpand(group.id)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
