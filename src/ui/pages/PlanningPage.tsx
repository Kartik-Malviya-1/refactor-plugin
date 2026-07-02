import { useEffect, useMemo, useState } from 'react'
import { GitBranch, AlertTriangle } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { PlanningCard } from '../components/planning/PlanningCard'
import { BulkActions } from '../components/planning/BulkActions'
import { FamilyFilters, applyFilter } from '../components/planning/FamilyFilters'
import type { FamilyFilter } from '../components/planning/FamilyFilters'
import { useMigrationStore } from '../store/migration'
import { usePlanningDataStore } from '../store/planningData'
import { useUIStore } from '../store/ui'
import { useAuditStore } from '../store/audit'
import { useCandidateFamilies } from '../hooks/useCandidateFamilies'
import { useSmartSuggestions } from '../hooks/useSmartSuggestions'
import { sendToPlugin } from '../hooks/useSendMessage'
import type { MigrationStrategy } from '../../shared/migration'

// ---------------------------------------------------------------------------
// Strategy selector (shown before planning begins)
// ---------------------------------------------------------------------------

const STRATEGIES: { id: MigrationStrategy; label: string; description: string }[] = [
  { id: 'existing-design-system', label: 'Use Existing Design System',  description: 'Match each family to an existing text style or variable.' },
  { id: 'existing-variables',     label: 'Use Existing Variables',      description: 'Prefer typography variables wherever possible.' },
  { id: 'create-new',             label: 'Create New Design System',    description: 'Define a new canonical style for each family.' },
  { id: 'manual',                 label: 'Manual Planning',             description: 'You decide every family individually. No suggestions applied automatically.' },
  { id: 'hybrid',                 label: 'Hybrid',                      description: 'Mix existing styles, variables and new styles.' },
]

function StrategySelector() {
  const { plan, setStrategy } = useMigrationStore()
  const [selected, setSelected] = useState<MigrationStrategy | null>(plan.strategy)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 pt-5 pb-4 border-b border-border-subtle shrink-0">
        <p className="text-base font-semibold text-ink">Design System Planning</p>
        <p className="text-xs text-ink-3 mt-1">How would you like to build your future typography system?</p>
      </div>
      <div className="flex-1 px-5 py-4 space-y-2">
        {STRATEGIES.map(s => (
          <button key={s.id} onClick={() => setSelected(s.id)}
            className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors ${
              selected === s.id ? 'border-accent bg-accent-subtle' : 'border-border bg-surface-1 hover:border-border-strong'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
              selected === s.id ? 'border-accent' : 'border-border-strong'
            }`}>
              {selected === s.id && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
            </div>
            <div>
              <p className={`text-sm font-medium ${selected === s.id ? 'text-accent' : 'text-ink'}`}>{s.label}</p>
              <p className="text-xs text-ink-3 mt-0.5">{s.description}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="shrink-0 border-t border-border-subtle px-5 py-3 bg-surface-1">
        <Button variant="primary" size="md" disabled={!selected} onClick={() => selected && setStrategy(selected)} className="w-full justify-center">
          Start Planning
        </Button>
        <p className="text-2xs text-ink-disabled text-center mt-2">You can change strategy or override individual families at any time.</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main planning workspace
// ---------------------------------------------------------------------------

export function PlanningPage() {
  const { navigate }  = useUIStore()
  const { result }    = useAuditStore()
  const families      = useCandidateFamilies()
  const { plan, initPlan, setStatus, setStrategy } = useMigrationStore()
  const { loaded }    = usePlanningDataStore()
  const allSuggestions = useSmartSuggestions()

  const [activeFilter, setActiveFilter] = useState<FamilyFilter>('all')

  // Fetch planning data once
  useEffect(() => { if (!loaded) sendToPlugin({ type: 'GET_PLANNING_DATA' }) }, [loaded])

  // Sync plan when families change
  useEffect(() => { if (families.length > 0) initPlan(families) }, [families, initPlan])

  // Upgrade needs-review → suggestions-available for families that have suggestions
  useEffect(() => {
    for (const family of families) {
      const entry = plan.entries[family.id]
      if (!entry || entry.status !== 'needs-review') continue
      const sgs = allSuggestions.get(family.id) ?? []
      if (sgs.length > 0) setStatus(family.id, 'suggestions-available')
    }
  }, [families, allSuggestions, plan.entries, setStatus])

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState icon={GitBranch} title="No scan data"
          description="Run a scan to generate Typography Families for planning."
          action={<Button variant="primary" size="sm" onClick={() => navigate('scan')}>Run Scan</Button>}
        />
      </div>
    )
  }

  if (!plan.strategy) return <StrategySelector />

  // Progress
  const entries = Object.values(plan.entries)
  const total     = entries.length
  const planned   = entries.filter(e => e.status === 'planned' || e.status === 'modified').length
  const skipped   = entries.filter(e => e.status === 'skipped').length
  const remaining = total - planned - skipped
  const progressPct = total > 0 ? Math.round((planned + skipped) / total * 100) : 0

  // Validation warnings
  const warnings = useMemo(() => {
    const issues: string[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newStyleNames = entries.filter(e => e.target?.type === 'new-style').map(e => ((e.target as any).name as string).toLowerCase().trim())
    const dupes = newStyleNames.filter((n, i) => n && newStyleNames.indexOf(n) !== i)
    if (dupes.length > 0) issues.push(`Duplicate planned style names: “${[...new Set(dupes)].join('”, “')}”`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emptyNames = entries.filter(e => e.target?.type === 'new-style' && !((e.target as any).name as string).trim())
    if (emptyNames.length > 0) issues.push(`${emptyNames.length} planned styles have no name.`)
    return issues
  }, [entries])

  // Sort by suggestion confidence (best suggestions first)
  const sorted = useMemo(() => {
    return [...families].sort((a, b) => {
      const aSugs = allSuggestions.get(a.id) ?? []
      const bSugs = allSuggestions.get(b.id) ?? []
      const aTop = aSugs[0]?.confidence ?? 0
      const bTop = bSugs[0]?.confidence ?? 0
      return bTop - aTop
    })
  }, [families, allSuggestions])

  // Apply active filter
  const filtered = useMemo(
    () => applyFilter(sorted, activeFilter, plan.entries, allSuggestions),
    [sorted, activeFilter, plan.entries, allSuggestions]
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Progress header */}
      <div className="shrink-0 border-b border-border bg-surface-1 px-5 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm font-semibold text-ink">Design System Planning</p>
          <div className="flex items-center gap-2">
            <BulkActions families={sorted} allSuggestions={allSuggestions} />
            <button onClick={() => setStrategy(null)} className="text-2xs text-ink-disabled hover:text-ink-3 transition-colors">Strategy</button>
          </div>
        </div>
        <div className="h-1 bg-surface-hover rounded-full overflow-hidden mb-1.5">
          <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex items-center gap-3 text-2xs text-ink-3">
          <span className="text-success font-medium">{planned} Planned</span>
          <span>{skipped} Skipped</span>
          <span>{remaining} Remaining</span>
          <span className="ml-auto">{progressPct}% complete</span>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-b border-border-subtle bg-warning-subtle">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-warning">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <FamilyFilters active={activeFilter} onChange={setActiveFilter}
        families={sorted} allSuggestions={allSuggestions} entries={plan.entries} />

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-ink-disabled">No families match this filter.</p>
          </div>
        ) : (
          filtered.map((family) => {
            const entry = plan.entries[family.id]
            if (!entry) return null
            return (
              <PlanningCard
                key={family.id}
                family={family}
                entry={entry}
                suggestions={allSuggestions.get(family.id) ?? []}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
