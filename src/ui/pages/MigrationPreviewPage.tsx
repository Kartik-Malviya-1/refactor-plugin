import { useMemo, useState } from 'react'
import { Download, AlertTriangle, CheckCircle, XCircle, Search, GitMerge } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { SearchInput } from '../components/ui/SearchInput'
import { PreviewCard } from '../components/preview/PreviewCard'
import { useUIStore } from '../store/ui'
import { useAuditStore } from '../store/audit'
import { useCandidateFamilies } from '../hooks/useCandidateFamilies'
import { useMigrationStore } from '../store/migration'
import { usePlanningDataStore } from '../store/planningData'
import { buildPreviewItems } from '../../preview/analysis'
import { detectConflicts, runValidation } from '../../preview/conflicts'
import { generateStatistics } from '../../preview/statistics'
import { exportToJSON, exportToMarkdown } from '../../preview/export'
import type { RiskLevel } from '../../preview/types'
import { cn } from '../lib/cn'

// ---------------------------------------------------------------------------
// Risk badge
// ---------------------------------------------------------------------------

const RISK_STYLE: Record<RiskLevel, string> = {
  'Low':       'bg-success-subtle text-success border-success/20',
  'Medium':    'bg-warning-subtle text-warning border-warning/20',
  'High':      'bg-danger-subtle text-danger border-danger/20',
  'Very High': 'bg-danger text-white border-danger',
}

// ---------------------------------------------------------------------------
// usePreviewData hook — memoized derivation of all preview state
// ---------------------------------------------------------------------------

function usePreviewData() {
  const families          = useCandidateFamilies()
  const { plan }          = useMigrationStore()
  const { textStyles, variables } = usePlanningDataStore()

  return useMemo(() => {
    if (families.length === 0) return null
    const conflicts  = detectConflicts(families, plan.entries)
    const items      = buildPreviewItems(families, plan.entries, textStyles, variables, conflicts)
    const validation = runValidation(families, plan.entries, textStyles, variables)
    const statistics = generateStatistics(families, plan.entries, items, conflicts.length, validation.errors.length, validation.warnings.length)

    // Attach validation issues to items
    const issueMap = new Map<string, typeof validation.errors>()
    for (const issue of [...validation.errors, ...validation.warnings]) {
      const arr = issueMap.get(issue.familyId) ?? []
      arr.push(issue)
      issueMap.set(issue.familyId, arr)
    }
    for (const item of items) {
      item.validationIssues = issueMap.get(item.familyId) ?? []
    }

    return { items, conflicts, validation, statistics }
  }, [families, plan, textStyles, variables])
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type PreviewFilter = 'all' | 'low' | 'medium' | 'high' | 'very-high' | 'conflicts'

export function MigrationPreviewPage() {
  const { navigate }   = useUIStore()
  const { result }     = useAuditStore()
  const preview        = usePreviewData()
  const [search, setSearch]               = useState('')
  const [filter, setFilter]               = useState<PreviewFilter>('all')
  const [validationOpen, setValidationOpen] = useState(false)

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState icon={GitMerge} title="No scan data"
          description="Run a scan and complete Design System Planning before reviewing the Migration Preview."
          action={<Button variant="primary" size="sm" onClick={() => navigate('scan')}>Run Scan</Button>}
        />
      </div>
    )
  }

  if (!preview || preview.items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState icon={GitMerge} title="No planned changes"
          description="Plan Typography Families in Design System Planning before reviewing the Migration Preview."
          action={<Button variant="primary" size="sm" onClick={() => navigate('planning')}>Open Planning</Button>}
        />
      </div>
    )
  }

  const { items, conflicts, validation, statistics } = preview

  // Filter
  const filtered = useMemo(() => {
    let result = items
    if (filter === 'low')       result = result.filter(i => i.risk === 'Low')
    if (filter === 'medium')    result = result.filter(i => i.risk === 'Medium')
    if (filter === 'high')      result = result.filter(i => i.risk === 'High')
    if (filter === 'very-high') result = result.filter(i => i.risk === 'Very High')
    if (filter === 'conflicts') result = result.filter(i => conflicts.some(c => c.familyId === i.familyId))
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(i =>
        i.before.fontFamily.toLowerCase().includes(q) ||
        i.before.fontStyle.toLowerCase().includes(q) ||
        i.after.displayName.toLowerCase().includes(q) ||
        String(i.before.fontSize).includes(q)
      )
    }
    return result
  }, [items, filter, search, conflicts])

  const FILTER_TABS: { id: PreviewFilter; label: string }[] = [
    { id: 'all',       label: `All (${items.length})` },
    { id: 'very-high', label: `Very High (${items.filter(i => i.risk === 'Very High').length})` },
    { id: 'high',      label: `High (${items.filter(i => i.risk === 'High').length})` },
    { id: 'medium',    label: `Medium (${items.filter(i => i.risk === 'Medium').length})` },
    { id: 'low',       label: `Low (${items.filter(i => i.risk === 'Low').length})` },
    ...(conflicts.length > 0 ? [{ id: 'conflicts' as PreviewFilter, label: `Conflicts (${conflicts.length})` }] : []),
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-surface-1 px-5 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">Migration Preview</p>
            <p className="text-xs text-ink-3 mt-0.5">
              {statistics.plannedFamilies} planned · {statistics.estimatedLayerChanges.toLocaleString()} layer changes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => exportToJSON(items, statistics, conflicts, validation)}>
              <Download className="w-3.5 h-3.5" />JSON
            </Button>
            <Button variant="secondary" size="sm" onClick={() => exportToMarkdown(items, statistics, conflicts, validation)}>
              <Download className="w-3.5 h-3.5" />Markdown
            </Button>
          </div>
        </div>
      </div>

      {/* Statistics bar */}
      <div className="shrink-0 px-5 py-3 border-b border-border-subtle bg-surface-0">
        <div className="flex items-center gap-2 text-xs overflow-x-auto">
          {[
            [statistics.totalSignatures.toLocaleString(), 'Signatures'],
            [statistics.totalFamilies.toLocaleString(), 'Families'],
            [statistics.plannedFamilies.toLocaleString(), 'Planned'],
            [statistics.estimatedLayerChanges.toLocaleString(), 'Layer Changes'],
            [statistics.estimatedDuplicateReduction.toLocaleString(), 'Reduction'],
          ].map(([value, label], i, arr) => (
            <div key={label} className="flex items-center gap-2 shrink-0">
              <div className="text-center">
                <p className="text-base font-semibold text-ink tabular-nums">{value}</p>
                <p className="text-2xs text-ink-3">{label}</p>
              </div>
              {i < arr.length - 1 && <span className="text-border-strong">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Validation + conflicts */}
      {(validation.errors.length > 0 || validation.warnings.length > 0 || conflicts.length > 0) && (
        <div className="shrink-0 border-b border-border-subtle">
          <button
            onClick={() => setValidationOpen(!validationOpen)}
            className="w-full flex items-center gap-3 px-5 py-2 hover:bg-surface-hover transition-colors text-left"
          >
            {validation.errors.length > 0 ? (
              <XCircle className="w-4 h-4 text-danger shrink-0" />
            ) : validation.warnings.length > 0 || conflicts.length > 0 ? (
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-success shrink-0" />
            )}
            <span className="text-xs font-medium text-ink flex-1">
              {validation.errors.length > 0 && `${validation.errors.length} error${validation.errors.length !== 1 ? 's' : ''}`}
              {validation.errors.length > 0 && (validation.warnings.length > 0 || conflicts.length > 0) && ' · '}
              {(validation.warnings.length > 0 || conflicts.length > 0) && `${validation.warnings.length + conflicts.length} warning${(validation.warnings.length + conflicts.length) !== 1 ? 's' : ''}`}
            </span>
            <span className="text-2xs text-ink-3">{validationOpen ? 'Hide' : 'Show'}</span>
          </button>
          {validationOpen && (
            <div className="px-5 pb-3 space-y-1">
              {validation.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-danger">
                  <XCircle className="w-3 h-3 shrink-0 mt-0.5" /><span>{e.message}</span>
                </div>
              ))}
              {[...validation.warnings, ...conflicts].map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-warning">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /><span>{w.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters + search */}
      <div className="shrink-0 border-b border-border">
        <div className="flex items-center gap-0.5 px-2 overflow-x-auto">
          {FILTER_TABS.map(tab => (
            <button key={tab.id} onClick={() => setFilter(tab.id)}
              className={cn('px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                filter === tab.id ? 'border-accent text-accent' : 'border-transparent text-ink-3 hover:text-ink')}
            >{tab.label}</button>
          ))}
          <div className="ml-auto pr-2 py-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search…" className="w-44" />
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="shrink-0 grid bg-surface-0 border-b border-border text-2xs font-semibold text-ink-3 uppercase tracking-wider px-3"
        style={{ gridTemplateColumns: '1fr 140px 80px 90px 70px' }}>
        <div className="py-2">Family → Target</div>
        <div className="py-2">Risk</div>
        <div className="py-2 text-right">Layers</div>
        <div className="py-2 text-right">Changes</div>
        <div className="py-2 text-right">Issues</div>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-ink-disabled">No items match this filter.</p>
          </div>
        ) : (
          filtered.map(item => <PreviewCard key={item.familyId} item={item} />)
        )}
      </div>
    </div>
  )
}
