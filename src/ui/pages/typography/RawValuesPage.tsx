import { useState, useMemo, useEffect } from 'react'
import { Layers, MousePointerClick, Download } from 'lucide-react'
import { useAuditStore } from '../../store/audit'
import { useAssignmentStore } from '../../store/assignment'
import { useUIStore } from '../../store/ui'
import { useQueryStore } from '../../store/query'
import { usePlanningDataStore } from '../../store/planningData'
import { QueryBuilder } from '../../components/query/QueryBuilder'
import { AssignmentDrawer } from '../../components/working-set/AssignmentDrawer'
import { SearchInput } from '../../components/ui/SearchInput'
import { TypographyPreview } from '../../components/audit/TypographyPreview'
import { evaluateQuery } from '../../../query/evaluator'
import { computeStatistics } from '../../../query/working-set'
import { locationFromItem } from '../../../shared/navigation'
import { sendToPlugin } from '../../hooks/useSendMessage'
import { exportWorkbook } from '../../../export/workbook-exporter'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'
import type { SourceType } from '../../../shared/types'
import { cn } from '../../lib/cn'

const SOURCE_CHIP: Partial<Record<SourceType, string>> = {
  'Raw Values':         'bg-surface-active text-ink-2',
  'Local Text Style':   'bg-accent-subtle text-accent',
  'Library Text Style': 'bg-success-subtle text-success',
  'Variable':           'bg-warning-subtle text-warning',
}

function SignatureRow({
  group, isSelected, assignment, onToggle, onInspect,
}: {
  group:      AuditGroup<TypographyProperties>
  isSelected: boolean
  assignment: { label: string } | undefined
  onToggle:   () => void
  onInspect:  () => void
}) {
  const p = group.descriptor
  function handleNavigate(e: React.MouseEvent) {
    e.stopPropagation()
    const locations   = group.items.map(locationFromItem)
    const uniquePages = new Set(group.items.map(i => i.pageId))
    if (uniquePages.size > 1) { onInspect() }
    else { sendToPlugin({ type: 'SELECT_NODES', payload: { locations } }) }
  }
  return (
    <div onClick={onToggle}
      className={cn(
        'grid items-center px-3 py-2 border-b border-border-subtle cursor-pointer transition-colors',
        isSelected ? 'bg-accent-subtle/30' : 'hover:bg-surface-hover'
      )}
      style={{ gridTemplateColumns: '28px 36px 1fr 96px 68px 80px 28px' }}
    >
      <input type="checkbox" checked={isSelected} onChange={onToggle}
        onClick={e => e.stopPropagation()}
        className="w-3.5 h-3.5 rounded accent-accent cursor-pointer" />
      <TypographyPreview
        properties={{ ...p, fontSize: Math.min(p.fontSize, 12) }}
        className="w-8 h-6 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink truncate">
          {p.fontFamily} {p.fontStyle} / {p.fontSize}px
        </p>
        {p.fontWeight !== 400 && (
          <p className="text-2xs text-ink-3">Weight {p.fontWeight}</p>
        )}
      </div>
      <div>
        {group.source && SOURCE_CHIP[group.source as SourceType] && (
          <span className={cn('text-2xs px-1.5 py-0.5 rounded', SOURCE_CHIP[group.source as SourceType])}>
            {group.source === 'Raw Values' ? 'Raw'
              : group.source === 'Local Text Style' ? 'Local'
              : group.source === 'Library Text Style' ? 'Library'
              : group.source}
          </span>
        )}
      </div>
      <div className="text-xs tabular-nums text-ink-2 text-right">
        {group.count.toLocaleString()}
      </div>
      <div className="text-right">
        {assignment
          ? <span className="text-2xs text-accent font-medium truncate max-w-[76px] inline-block">✓ {assignment.label}</span>
          : <span className="text-2xs text-ink-disabled">—</span>
        }
      </div>
      <button onClick={handleNavigate}
        className="flex items-center justify-center p-1 rounded text-ink-3 hover:text-accent hover:bg-accent-subtle transition-colors"
        title="Select layers in Figma">
        <MousePointerClick className="w-3 h-3" />
      </button>
    </div>
  )
}

export function RawValuesPage() {
  const { result }   = useAuditStore()
  const { assignments } = useAssignmentStore()
  const { selectGroup, setSearchQuery, navigate } = useUIStore()
  const { expression, addCondition, removeCondition, updateCondition, toggleCondition, clearAll } = useQueryStore()
  const { textStyles, variables, loaded: planningLoaded, loading: planningLoading } = usePlanningDataStore()

  // All useState declarations must come before any useMemo that references them.
  // Placing them after causes a TDZ ReferenceError during dependency-array evaluation.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch]     = useState('')

  useEffect(() => {
    if (!planningLoaded && !planningLoading) {
      sendToPlugin({ type: 'GET_PLANNING_DATA' })
    }
  }, [planningLoaded, planningLoading])

  const allGroups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )

  const rawGroups = useMemo(() =>
    allGroups.filter(g => !g.source || g.source === 'Raw Values' || g.source === 'Unknown'),
    [allGroups]
  )

  const workingSetGroups = useMemo(() =>
    evaluateQuery(rawGroups, expression),
    [rawGroups, expression]
  )

  const statistics = useMemo(() =>
    computeStatistics(workingSetGroups),
    [workingSetGroups]
  )

  const displayGroups = useMemo(() => {
    if (!search.trim()) return workingSetGroups
    const q = search.toLowerCase()
    return workingSetGroups.filter(g =>
      g.descriptor.fontFamily.toLowerCase().includes(q) ||
      g.descriptor.fontStyle.toLowerCase().includes(q) ||
      String(g.descriptor.fontSize).includes(q)
    )
  }, [workingSetGroups, search])

  // selectedGroups keyed by AuditGroup.key (canonical identifier)
  const selectedGroups = useMemo(() =>
    workingSetGroups.filter(g => selected.has(g.key)),
    [workingSetGroups, selected]
  )

  function toggleRow(sigKey: string) {
    const next = new Set(selected)
    if (next.has(sigKey)) next.delete(sigKey); else next.add(sigKey)
    setSelected(next)
  }
  function selectAll()  { setSelected(new Set(workingSetGroups.map(g => g.key))) }
  function clearSel()   { setSelected(new Set()) }
  function invertSel()  {
    const next = new Set<string>()
    for (const g of workingSetGroups) { if (!selected.has(g.key)) next.add(g.key) }
    setSelected(next)
  }
  function inspectGroup(sigKey: string) {
    setSearchQuery('')
    selectGroup(sigKey)
    navigate('typography/signatures')
  }

  function handleExport() {
    if (!result) return
    exportWorkbook({
      result: result as unknown as import('../../../shared/types').AuditResult<TypographyProperties>,
      assignments,
      textStyles,
      variables,
    })
  }

  const allSelected  = workingSetGroups.length > 0 && workingSetGroups.every(g => selected.has(g.key))
  const someSelected = selected.size > 0 && !allSelected
  const dominant     = selectedGroups[0]?.descriptor ?? workingSetGroups[0]?.descriptor

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Layers className="w-8 h-8 text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-ink mb-1">No scan data</p>
          <p className="text-xs text-ink-3">Run a scan to start exploring typography.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <QueryBuilder
        conditions={expression.conditions}
        statistics={statistics}
        onAdd={addCondition}
        onRemove={removeCondition}
        onUpdate={updateCondition}
        onToggle={toggleCondition}
        onClear={clearAll}
      />

      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-surface-0">
        <input
          type="checkbox"
          checked={allSelected}
          ref={el => { if (el) el.indeterminate = someSelected }}
          onChange={e => e.target.checked ? selectAll() : clearSel()}
          className="w-3.5 h-3.5 rounded accent-accent cursor-pointer shrink-0"
          title={allSelected ? 'Clear all' : 'Select all'}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Search ${workingSetGroups.length} signature${workingSetGroups.length !== 1 ? 's' : ''}…`}
          className="flex-1"
        />
        {selected.size > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={invertSel} className="text-2xs text-ink-3 hover:text-ink transition-colors">Invert</button>
            <button onClick={clearSel}  className="text-2xs text-ink-3 hover:text-ink transition-colors">Clear</button>
          </div>
        )}
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-2xs font-medium text-ink-2 bg-surface-1 border border-border-subtle rounded-md hover:bg-surface-hover hover:text-ink transition-colors shrink-0"
          title="Export migration workbook (.xlsx)"
        >
          <Download className="w-3 h-3" />
          Export
        </button>
      </div>

      {/* Column headers */}
      <div
        className="shrink-0 grid bg-surface-0 border-b border-border text-2xs font-semibold text-ink-3 uppercase tracking-wider px-3"
        style={{ gridTemplateColumns: '28px 36px 1fr 96px 68px 80px 28px' }}
      >
        <div /><div />
        <div className="py-2">Signature</div>
        <div className="py-2">Source</div>
        <div className="py-2 text-right">Layers</div>
        <div className="py-2 text-right">Assigned</div>
        <div />
      </div>

      {/* Signature list */}
      <div className="flex-1 overflow-y-auto">
        {displayGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
            {workingSetGroups.length === 0 ? (
              <>
                <p className="text-sm font-medium text-ink">Working Set is empty</p>
                <p className="text-xs text-ink-3 leading-relaxed max-w-xs">
                  Add conditions above to filter the signatures you want to work on.
                  Without conditions, all raw value signatures are shown.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-ink">No signatures match "{search}"</p>
                <p className="text-xs text-ink-3">Try a different search term.</p>
              </>
            )}
          </div>
        ) : (
          displayGroups.map(group => (
            <SignatureRow
              key={group.key}
              group={group}
              isSelected={selected.has(group.key)}
              assignment={assignments[group.key]}
              onToggle={() => toggleRow(group.key)}
              onInspect={() => inspectGroup(group.key)}
            />
          ))
        )}
      </div>

      {/* Assignment Drawer */}
      {selected.size > 0 && (
        <AssignmentDrawer
          selectedIds={[...selected]}
          selectedGroups={selectedGroups}
          dominant={dominant}
          onDeselect={clearSel}
          onAssigned={clearSel}
        />
      )}
    </div>
  )
}
