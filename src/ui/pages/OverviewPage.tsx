import { useMemo } from 'react'
import { ArrowRight, Type, FileText, GitBranch } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useUIStore } from '../store/ui'
import { useAuditStore } from '../store/audit'
import { useCandidateFamilies } from '../hooks/useCandidateFamilies'
import { useMigrationStore } from '../store/migration'
import { useSmartSuggestions } from '../hooks/useSmartSuggestions'
import type { SourceType } from '../../shared/types'

const STRATEGY_LABEL: Record<string, string> = {
  'existing-design-system': 'Existing Design System',
  'existing-variables': 'Existing Variables',
  'create-new': 'Create New',
  manual: 'Manual',
  hybrid: 'Hybrid',
}

function StatCard({ label, value, sub, dim = false }: { label: string; value: string|number; sub?: string; dim?: boolean }) {
  return (
    <div className={`flex-1 bg-surface-1 border border-border rounded px-3 py-2.5 min-w-0 ${dim ? 'opacity-50' : ''}`}>
      <p className="text-2xs text-ink-3 font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-semibold tabular-nums leading-none ${dim ? 'text-ink-3' : 'text-ink'}`}>{value}</p>
      {sub && <p className="text-xs text-ink-3 mt-1 truncate">{sub}</p>}
    </div>
  )
}

function ComingSoon({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex-1 bg-surface-0 border border-dashed border-border rounded px-3 py-2.5 min-w-0">
      <p className="text-2xs text-ink-disabled font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-ink-disabled">—</p>
      <p className="text-xs text-ink-disabled mt-1 leading-relaxed">{description}</p>
    </div>
  )
}

function ObsBadge({ obs }: { obs: { level: 'info'|'warning'; message: string } }) {
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded border text-xs leading-relaxed ${
      obs.level === 'warning' ? 'bg-warning-subtle border-warning/20 text-warning' : 'bg-surface-0 border-border text-ink-3'
    }`}>
      <span className="shrink-0">{obs.level === 'warning' ? '⚠️' : 'ℹ️'}</span><span>{obs.message}</span>
    </div>
  )
}

export function OverviewPage() {
  const { navigate } = useUIStore()
  const { result } = useAuditStore()
  const families = useCandidateFamilies()
  const { plan } = useMigrationStore()
  const allSuggestions = useSmartSuggestions()

  const { stats, bySource, observations } = useMemo(() => {
    if (!result) return { stats: null, bySource: new Map<SourceType, number>(), observations: [] }

    const uniquePages = new Set<string>()
    result.groups.forEach((g) => g.items.forEach((item) => uniquePages.add(item.pageId)))

    const src = new Map<SourceType, number>()
    for (const g of result.groups) {
      const s = (g.source ?? 'Unknown') as SourceType
      src.set(s, (src.get(s) ?? 0) + g.count)
    }

    const familyStats = families.length > 0 ? {
      total: families.length,
      avgSize: Math.round((result.groups.length / families.length) * 10) / 10,
      avgConf: Math.round(families.reduce((s, f) => s + f.confidence, 0) / families.length),
      outliers: families.reduce((s, f) => s + f.outlierCount, 0),
      consolidate: families.filter(f => f.signatureCount > 1).length,
    } : null

    const planEntries = Object.values(plan.entries)
    const planStats = planEntries.length > 0 ? {
      total:     planEntries.length,
      planned:   planEntries.filter(e => e.status === 'planned' || e.status === 'modified').length,
      skipped:   planEntries.filter(e => e.status === 'skipped').length,
      remaining: planEntries.filter(e => e.status === 'needs-review' || e.status === 'suggestions-available').length,
      readiness: Math.round((planEntries.filter(e => ['planned','modified','skipped'].includes(e.status)).length / planEntries.length) * 100),
      strategy:  plan.strategy,
      existingStylesUsed: planEntries.filter(e => e.target?.type === 'existing-style').length,
      variablesUsed:      planEntries.filter(e => e.target?.type === 'existing-variable').length,
      newStylesPlanned:   planEntries.filter(e => e.target?.type === 'new-style').length,
      manualTargets:      planEntries.filter(e => e.target?.type === 'manual-values').length,
    } : null

    // Suggestion analytics
    let totalSugs = 0, veryHighCount = 0
    for (const [, sgs] of allSuggestions) {
      totalSugs += sgs.length
      veryHighCount += sgs.filter(s => s.confidence >= 90).length
    }
    const sugStats = allSuggestions.size > 0 ? {
      generated: totalSugs,
      veryHighOpportunities: veryHighCount,
      avgConfidence: families.length > 0 ? Math.round(
        [...allSuggestions.values()].flat().reduce((s, sg) => s + sg.confidence, 0) /
        Math.max(1, [...allSuggestions.values()].flat().length)
      ) : 0,
    } : null

    const obs: { level: 'info'|'warning'; message: string }[] = []
    const rawLayers = src.get('Raw Values') ?? 0
    if (rawLayers > result.totalItems * 0.5) obs.push({ level: 'warning', message: `${Math.round(rawLayers / result.totalItems * 100)}% of text layers use raw values.` })
    const srcPresent = [...src.keys()].filter(s => s !== 'Unknown')
    if (srcPresent.length > 1) obs.push({ level: 'info', message: `Multiple sources: ${srcPresent.join(', ')}.` })
    if (result.groups.length > 200) obs.push({ level: 'warning', message: `${result.groups.length.toLocaleString()} unique Typography Signatures.` })

    return { stats: { totalLayers: result.totalItems, signatures: result.groups.length, pagesScanned: uniquePages.size, mostUsed: result.groups[0] ?? null, scopeLabel: result.scopeLabel, scannedAt: new Date(result.scannedAt).toLocaleTimeString(), durationSec: (result.durationMs / 1000).toFixed(1), familyStats, planStats, sugStats }, bySource: src, observations: obs }
  }, [result, families, plan, allSuggestions])

  if (!stats) {
    return (
      <div className="flex flex-col h-full overflow-y-auto bg-surface-0">
        <div className="px-6 pt-6 pb-4 border-b border-border-subtle bg-surface-1 shrink-0">
          <h1 className="text-lg font-semibold text-ink mb-0.5">Overview</h1>
          <p className="text-xs text-ink-3 leading-relaxed">Run a scan to understand your design system.</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-xs">
            <div className="w-12 h-12 rounded-xl bg-surface-hover flex items-center justify-center mx-auto mb-4">
              <Type className="w-6 h-6 text-ink-3" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-ink mb-1">No scan data yet</p>
            <p className="text-xs text-ink-3 leading-relaxed mb-4">Scan to see typography signatures, sources, families and planning progress.</p>
            <Button variant="primary" size="md" onClick={() => navigate('scan')}>Run Scan</Button>
          </div>
        </div>
      </div>
    )
  }

  const { familyStats, planStats, sugStats } = stats

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-surface-0">
      <div className="px-5 pt-4 pb-3 border-b border-border-subtle bg-surface-1 shrink-0">
        <h1 className="text-base font-semibold text-ink">Overview</h1>
        <p className="text-xs text-ink-3 mt-0.5">Scope: <span className="font-medium text-ink-2">{stats.scopeLabel}</span><span className="mx-2 text-border-strong">·</span>Scanned at {stats.scannedAt}<span className="mx-2 text-border-strong">·</span>{stats.durationSec}s</p>
      </div>

      <div className="flex-1 px-5 py-4 space-y-5">
        {observations.length > 0 && (
          <section>
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Observations</p>
            <div className="space-y-1.5">{observations.map((obs, i) => <ObsBadge key={i} obs={obs} />)}</div>
          </section>
        )}

        <section>
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Audit Results</p>
          <div className="flex gap-2 flex-wrap">
            <StatCard label="Text Layers" value={stats.totalLayers.toLocaleString()} sub={`in ${stats.scopeLabel}`} />
            <StatCard label="Typography Signatures" value={stats.signatures.toLocaleString()} sub={stats.mostUsed ? `Most used: ${stats.mostUsed.count.toLocaleString()}` : undefined} />
            <StatCard label="Pages Scanned" value={stats.pagesScanned} />
          </div>
        </section>

        {bySource.size > 0 && (
          <section>
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Source Breakdown</p>
            <div className="flex gap-2 flex-wrap">
              {bySource.get('Raw Values') !== undefined && <StatCard label="Raw Values" value={(bySource.get('Raw Values')??0).toLocaleString()} sub="layers" />}
              {bySource.get('Local Text Style') !== undefined && <StatCard label="Local Styles" value={(bySource.get('Local Text Style')??0).toLocaleString()} sub="layers" />}
              {bySource.get('Library Text Style') !== undefined && <StatCard label="Library Styles" value={(bySource.get('Library Text Style')??0).toLocaleString()} sub="layers" />}
              {bySource.get('Variable') !== undefined && <StatCard label="Variables" value={(bySource.get('Variable')??0).toLocaleString()} sub="layers" />}
            </div>
          </section>
        )}

        {familyStats && (
          <section>
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Typography Families</p>
            <div className="flex gap-2 flex-wrap">
              <StatCard label="Families" value={familyStats.total} sub={`avg ${familyStats.avgSize} sigs`} />
              <StatCard label="Avg Confidence" value={`${familyStats.avgConf}%`} />
              <StatCard label="Consolidatable" value={familyStats.consolidate} sub="families" />
              {familyStats.outliers > 0 && <StatCard label="Outliers" value={familyStats.outliers} />}
            </div>
          </section>
        )}

        {sugStats && (
          <section>
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Smart Suggestions</p>
            <div className="flex gap-2 flex-wrap">
              <StatCard label="Generated" value={sugStats.generated} sub={`for ${allSuggestions.size} families`} />
              <StatCard label="Very High" value={sugStats.veryHighOpportunities} sub="suggestions ≥90%" />
              <StatCard label="Avg Confidence" value={`${sugStats.avgConfidence}%`} />
            </div>
          </section>
        )}

        {planStats && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest">Planning Progress</p>
              {planStats.strategy && <span className="text-2xs text-ink-3">{STRATEGY_LABEL[planStats.strategy] ?? planStats.strategy}</span>}
            </div>
            <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden mb-2">
              <div className="h-full bg-accent rounded-full" style={{ width: `${planStats.readiness}%` }} />
            </div>
            <div className="flex gap-2 flex-wrap">
              <StatCard label="Planned" value={planStats.planned} />
              <StatCard label="Skipped" value={planStats.skipped} />
              <StatCard label="Remaining" value={planStats.remaining} />
              <StatCard label="Readiness" value={`${planStats.readiness}%`} />
            </div>
            {(planStats.existingStylesUsed > 0 || planStats.variablesUsed > 0 || planStats.newStylesPlanned > 0) && (
              <div className="flex gap-2 flex-wrap mt-2">
                {planStats.existingStylesUsed > 0 && <StatCard label="Existing Styles" value={planStats.existingStylesUsed} sub="families" />}
                {planStats.variablesUsed > 0 && <StatCard label="Variables" value={planStats.variablesUsed} sub="families" />}
                {planStats.newStylesPlanned > 0 && <StatCard label="New Styles" value={planStats.newStylesPlanned} sub="planned" />}
                {planStats.manualTargets > 0 && <StatCard label="Manual" value={planStats.manualTargets} sub="families" />}
              </div>
            )}
          </section>
        )}

        <section>
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Platform Insights <span className="normal-case font-normal">Coming Soon</span></p>
          <div className="flex gap-2 flex-wrap">
            <ComingSoon label="Migration Readiness" description="% of layers ready to migrate" />
            <ComingSoon label="Suggested Reduction" description="Estimated signatures after standardisation" />
          </div>
        </section>

        <div className="flex gap-2 pt-1 flex-wrap">
          <Button variant="primary" size="sm" onClick={() => navigate('signatures')}>
            View Signatures <ArrowRight className="w-3.5 h-3.5" />
          </Button>
          {familyStats && (
            <Button variant="secondary" size="sm" onClick={() => navigate('planning')}>
              <GitBranch className="w-3.5 h-3.5" /> Design System Planning
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate('sources')}>
            <FileText className="w-3.5 h-3.5" /> Sources
          </Button>
        </div>
      </div>
    </div>
  )
}
