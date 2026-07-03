import { useState, useMemo } from 'react'
import { useAuditStore } from '../../store/audit'
import { useAssignmentStore } from '../../store/assignment'
import { useClusteringStore } from '../../store/clustering'
import { useQueryStore } from '../../store/query'
import { QueryBuilder } from '../../components/query/QueryBuilder'
import { StrategySelector } from '../../components/clusters/StrategySelector'
import { ClusterCard } from '../../components/clusters/ClusterCard'
import { AssignmentPanel } from '../../components/clusters/AssignmentPanel'
import { SearchInput } from '../../components/ui/SearchInput'
import { TypographyPreview } from '../../components/audit/TypographyPreview'
import { evaluateQuery } from '../../../query/evaluator'
import { buildSuggestedConsolidations, countPotentialConsolidations } from '../../../query/partitioner'
import { computeStatistics } from '../../../query/working-set'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'
import { cn } from '../../lib/cn'

type Tab = 'consolidations' | 'all'

export function RawValuesPage() {
  const { result } = useAuditStore()
  const { assignments } = useAssignmentStore()
  const { config } = useClusteringStore()
  const { expression, addCondition, removeCondition, updateCondition, toggleCondition, clearAll } = useQueryStore()

  const [tab, setTab] = useState<Tab>('consolidations')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignPanelOpen, setAssignPanelOpen] = useState(false)

  const allGroups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )

  // All raw value groups (source filter — happens before query)
  const rawGroups = useMemo(() =>
    allGroups.filter(g => g.source === 'Raw Values' || g.source === 'Unknown' || !g.source),
    [allGroups]
  )

  // Apply query to get the Working Set
  const workingSetGroups = useMemo(() =>
    evaluateQuery(rawGroups, expression),
    [rawGroups, expression]
  )

  // Consolidation opportunities for statistics
  const { opportunities, estimatedReduction } = useMemo(() =>
    countPotentialConsolidations(workingSetGroups, config),
    [workingSetGroups, config]
  )

  const statistics = useMemo(() =>
    computeStatistics(workingSetGroups, opportunities, estimatedReduction),
    [workingSetGroups, opportunities, estimatedReduction]
  )

  // Suggested Consolidations (partition-first, Working Set only)
  const consolidations = useMemo(() =>
    tab === 'consolidations'
      ? buildSuggestedConsolidations(workingSetGroups, config)
      : [],
    [workingSetGroups, config, tab]
  )

  // All tab: search within Working Set
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return workingSetGroups
    const q = search.toLowerCase()
    return workingSetGroups.filter(g =>
      g.descriptor.fontFamily.toLowerCase().includes(q) ||
      g.descriptor.fontStyle.toLowerCase().includes(q) ||
      String(g.descriptor.fontSize).includes(q)
    )
  }, [workingSetGroups, search])

  const selectedIds = [...selected]

  function toggleRow(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }
  function selectAll() { setSelected(new Set(workingSetGroups.map(g => g.id))) }
  function clearSel() { setSelected(new Set()) }
  function invertSel() {
    const next = new Set<string>()
    for (const g of workingSetGroups) { if (!selected.has(g.id)) next.add(g.id) }
    setSelected(next)
  }

  if (!result) {
    return <div className="flex items-center justify-center h-full"><p className="text-xs text-ink-disabled">No scan data. Run a scan first.</p></div>
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Query Builder */}
      <QueryBuilder
        conditions={expression.conditions}
        statistics={statistics}
        onAdd={addCondition}
        onRemove={removeCondition}
        onUpdate={updateCondition}
        onToggle={toggleCondition}
        onClear={clearAll}
      />

      {/* Page header */}
      <div className="shrink-0 px-5 py-2.5 border-b border-border-subtle bg-surface-1 flex items-center gap-3">
        <div>
          <span className="text-sm font-semibold text-ink">Raw Values</span>
          <span className="ml-2 text-xs text-ink-3">{rawGroups.reduce((s, g) => s + g.count, 0).toLocaleString()} total layers</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex border-b border-border bg-surface-1 px-4">
        {([['consolidations', 'Suggested Consolidations'], ['all', 'All Signatures']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
              tab === t ? 'border-accent text-accent' : 'border-transparent text-ink-3 hover:text-ink')}
          >
            {label}
            {t === 'consolidations' && opportunities > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-accent text-accent-fg text-2xs">{opportunities}</span>
            )}
          </button>
        ))}
      </div>

      {/* Suggested Consolidations tab */}
      {tab === 'consolidations' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <StrategySelector />
          <div className="flex-1 overflow-y-auto">
            {workingSetGroups.length < 2 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
                <p className="text-sm font-medium text-ink">Build a Working Set first</p>
                <p className="text-xs text-ink-3 leading-relaxed max-w-xs">
                  Add query conditions above to define which signatures you want to standardize.
                  Suggested Consolidations only appear within the defined Working Set.
                </p>
              </div>
            ) : consolidations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
                <p className="text-sm font-medium text-ink">No consolidation opportunities</p>
                <p className="text-xs text-ink-3 leading-relaxed max-w-xs">
                  All signatures in this Working Set are already distinct within their size and family.
                  Try a more aggressive clustering strategy or adjust the Working Set.
                </p>
              </div>
            ) : (
              consolidations.map(cluster => <ClusterCard key={cluster.id} cluster={cluster} />)
            )}
          </div>
        </div>
      )}

      {/* All Signatures tab */}
      {tab === 'all' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Search + bulk actions */}
          <div className="shrink-0 px-4 py-2 border-b border-border-subtle bg-surface-0 flex items-center gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search within Working Set…" className="max-w-xs" />
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={selectAll} className="text-2xs text-ink-3 hover:text-ink">All</button>
              <button onClick={clearSel} className="text-2xs text-ink-3 hover:text-ink">None</button>
              <button onClick={invertSel} className="text-2xs text-ink-3 hover:text-ink">Invert</button>
              {selectedIds.length > 0 && (
                <button onClick={() => setAssignPanelOpen(!assignPanelOpen)}
                  className="ml-2 px-2.5 py-1 rounded bg-accent text-accent-fg text-2xs font-medium hover:bg-accent-hover transition-colors">
                  Assign {selectedIds.length}
                </button>
              )}
            </div>
          </div>

          {/* Assignment panel */}
          {assignPanelOpen && selectedIds.length > 0 && (
            <div className="shrink-0 border-b border-border-subtle">
              <AssignmentPanel
                selectedIds={selectedIds}
                clusterId="raw-all"
                dominant={
                  workingSetGroups.find(g => g.id === selectedIds[0])?.descriptor ??
                  workingSetGroups[0]?.descriptor ?? { fontFamily: 'Inter', fontStyle: 'Regular', fontWeight: 400, fontSize: 16, lineHeight: { unit: 'AUTO', value: 0 }, letterSpacing: { unit: 'PIXELS', value: 0 }, textCase: 'ORIGINAL', textDecoration: 'NONE', source: { type: 'Raw' } }
                }
                onClose={() => { setAssignPanelOpen(false); clearSel() }}
              />
            </div>
          )}

          {/* Column headers */}
          <div className="shrink-0 grid bg-surface-0 border-b border-border text-2xs font-semibold text-ink-3 uppercase tracking-wider px-3"
            style={{ gridTemplateColumns: '28px 1fr 80px 80px' }}>
            <div className="py-2"><input type="checkbox" checked={selected.size === workingSetGroups.length && workingSetGroups.length > 0} onChange={e => e.target.checked ? selectAll() : clearSel()} className="w-3.5 h-3.5 rounded accent-accent" /></div>
            <div className="py-2">Signature</div>
            <div className="py-2 text-right">Layers</div>
            <div className="py-2 text-right">Assigned</div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filteredGroups.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-ink-disabled">No signatures match this Working Set.</p>
              </div>
            ) : filteredGroups.map(group => {
              const p = group.descriptor
              const isSelected = selected.has(group.id)
              const assignment = assignments[group.id]
              return (
                <div key={group.id} onClick={() => toggleRow(group.id)}
                  className={cn('grid items-center px-3 py-2 border-b border-border-subtle cursor-pointer transition-colors',
                    isSelected ? 'bg-accent-subtle/40' : 'hover:bg-surface-hover')}
                  style={{ gridTemplateColumns: '28px 1fr 80px 80px' }}
                >
                  <input type="checkbox" checked={isSelected} onChange={() => toggleRow(group.id)}
                    onClick={e => e.stopPropagation()} className="w-3.5 h-3.5 rounded accent-accent cursor-pointer" />
                  <div className="flex items-center gap-2 min-w-0">
                    <TypographyPreview properties={{ ...p, fontSize: Math.min(p.fontSize, 12) }} className="w-7 h-6 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ink truncate">{p.fontFamily} {p.fontStyle} / {p.fontSize}px</p>
                    </div>
                  </div>
                  <div className="text-xs tabular-nums text-ink-2 text-right">{group.count.toLocaleString()}</div>
                  <div className="text-right">
                    {assignment
                      ? <span className="text-2xs text-accent font-medium truncate max-w-[70px] inline-block">✓ {assignment.label}</span>
                      : <span className="text-2xs text-ink-disabled">—</span>
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
