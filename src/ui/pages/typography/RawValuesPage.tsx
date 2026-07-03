import { useState, useMemo } from 'react'
import { useAuditStore } from '../../store/audit'
import { useAssignmentStore } from '../../store/assignment'
import { useTypographyClusters } from '../../hooks/useTypographyClusters'
import { buildTypographyClusters } from '../../../clustering/engine'
import { buildConfig } from '../../../clustering/strategies'
import { useClusteringStore } from '../../store/clustering'
import { SearchInput } from '../../components/ui/SearchInput'
import { TypographyPreview } from '../../components/audit/TypographyPreview'
import { StrategySelector } from '../../components/clusters/StrategySelector'
import { ClusterCard } from '../../components/clusters/ClusterCard'
import { AssignmentPanel } from '../../components/clusters/AssignmentPanel'
import type { AuditGroup } from '../../../shared/types'
import type { TypographyProperties } from '../../../modules/typography/types'
import { cn } from '../../lib/cn'
import { locationFromItem } from '../../../shared/navigation'
import { sendToPlugin } from '../../hooks/useSendMessage'

type Tab = 'all' | 'clusters'

export function RawValuesPage() {
  const { result } = useAuditStore()
  const { assignments, assign } = useAssignmentStore()
  const { config } = useClusteringStore()

  const [tab, setTab] = useState<Tab>('clusters')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignPanelOpen, setAssignPanelOpen] = useState(false)

  const groups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )

  // Only raw value groups
  const rawGroups = useMemo(() =>
    groups.filter(g => g.source === 'Raw Values' || g.source === 'Unknown' || !g.source),
    [groups]
  )

  // Clusters computed from raw groups only (not all groups)
  const rawClusters = useMemo(() =>
    buildTypographyClusters(rawGroups, config),
    [rawGroups, config]
  )

  // Filtered for All tab
  const filtered = useMemo(() => {
    if (!search.trim()) return rawGroups
    const q = search.toLowerCase()
    return rawGroups.filter(g =>
      g.descriptor.fontFamily.toLowerCase().includes(q) ||
      g.descriptor.fontStyle.toLowerCase().includes(q) ||
      String(g.descriptor.fontSize).includes(q)
    )
  }, [rawGroups, search])

  const totalLayers = rawGroups.reduce((s, g) => s + g.count, 0)
  const selectedIds = [...selected]

  function toggleRow(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }
  function selectAll() { setSelected(new Set(rawGroups.map(g => g.id))) }
  function clearAll() { setSelected(new Set()) }
  function invertSelection() {
    const next = new Set<string>()
    for (const g of rawGroups) { if (!selected.has(g.id)) next.add(g.id) }
    setSelected(next)
  }

  if (!result) {
    return <div className="flex items-center justify-center h-full"><p className="text-xs text-ink-disabled">No scan data. Run a scan first.</p></div>
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="shrink-0 px-5 py-3 border-b border-border-subtle bg-surface-1">
        <div className="flex items-baseline gap-3">
          <p className="text-base font-semibold text-ink">Raw Values</p>
          <p className="text-xs text-ink-3">{totalLayers.toLocaleString()} layers · {rawGroups.length} signatures · {rawClusters.length} clusters</p>
          {rawGroups.length > 0 && <p className="text-xs text-accent font-medium">{rawGroups.length} → {rawClusters.length}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex border-b border-border bg-surface-1 px-4">
        {(['clusters', 'all'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors capitalize',
              tab === t ? 'border-accent text-accent' : 'border-transparent text-ink-3 hover:text-ink')}
          >{t === 'clusters' ? 'Clusters' : 'All Signatures'}</button>
        ))}
      </div>

      {tab === 'clusters' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <StrategySelector />
          <div className="flex-1 overflow-y-auto">
            {rawClusters.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-ink-disabled">No clusters generated. Try changing the strategy.</p>
              </div>
            ) : (
              rawClusters.map(cluster => <ClusterCard key={cluster.id} cluster={cluster} />)
            )}
          </div>
        </div>
      )}

      {tab === 'all' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Search + bulk actions */}
          <div className="shrink-0 px-4 py-2.5 border-b border-border-subtle bg-surface-0 flex items-center gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search signatures…" className="max-w-xs" />
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={selectAll} className="text-2xs text-ink-3 hover:text-ink transition-colors">All</button>
              <button onClick={clearAll} className="text-2xs text-ink-3 hover:text-ink transition-colors">None</button>
              <button onClick={invertSelection} className="text-2xs text-ink-3 hover:text-ink transition-colors">Invert</button>
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
                dominant={rawGroups.find(g => g.id === selectedIds[0])?.descriptor ?? rawGroups[0]?.descriptor ?? {
                  fontFamily: 'Inter', fontStyle: 'Regular', fontWeight: 400, fontSize: 16,
                  lineHeight: { unit: 'AUTO', value: 0 }, letterSpacing: { unit: 'PIXELS', value: 0 },
                  textCase: 'ORIGINAL', textDecoration: 'NONE',
                }}
                onClose={() => { setAssignPanelOpen(false); clearAll() }}
              />
            </div>
          )}

          {/* Column headers */}
          <div className="shrink-0 grid bg-surface-0 border-b border-border text-2xs font-semibold text-ink-3 uppercase tracking-wider px-3"
            style={{ gridTemplateColumns: '28px 1fr 80px 80px' }}>
            <div className="py-2"><input type="checkbox" checked={selected.size === rawGroups.length && rawGroups.length > 0} onChange={e => e.target.checked ? selectAll() : clearAll()} className="w-3.5 h-3.5 rounded accent-accent" /></div>
            <div className="py-2">Signature</div>
            <div className="py-2 text-right">Layers</div>
            <div className="py-2 text-right">Assigned</div>
          </div>

          {/* Signature list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.map(group => {
              const p = group.descriptor
              const isSelected = selected.has(group.id)
              const assignment = assignments[group.id]
              return (
                <div key={group.id}
                  onClick={() => toggleRow(group.id)}
                  className={cn(
                    'grid items-center px-3 py-2 border-b border-border-subtle cursor-pointer transition-colors',
                    isSelected ? 'bg-accent-subtle/40' : 'hover:bg-surface-hover'
                  )}
                  style={{ gridTemplateColumns: '28px 1fr 80px 80px' }}
                >
                  <input type="checkbox" checked={isSelected} onChange={() => toggleRow(group.id)}
                    onClick={e => e.stopPropagation()}
                    className="w-3.5 h-3.5 rounded accent-accent cursor-pointer" />
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
