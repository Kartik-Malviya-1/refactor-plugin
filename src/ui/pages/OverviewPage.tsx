import { useMemo } from 'react'
import { ArrowRight, Type, FileText } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useUIStore } from '../store/ui'
import { useAuditStore } from '../store/audit'
import type { SourceType } from '../../shared/types'

function StatCard({
  label, value, sub, dim = false,
}: { label: string; value: string | number; sub?: string; dim?: boolean }) {
  return (
    <div className={`flex-1 bg-surface-1 border border-border rounded px-3 py-2.5 min-w-0 ${
      dim ? 'opacity-50' : ''
    }`}>
      <p className="text-2xs text-ink-3 font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-semibold tabular-nums leading-none ${
        dim ? 'text-ink-3' : 'text-ink'
      }`}>
        {value}
      </p>
      {sub && <p className="text-xs text-ink-3 mt-1 truncate">{sub}</p>}
    </div>
  )
}

function ComingSoonCard({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex-1 bg-surface-0 border border-dashed border-border rounded px-3 py-2.5 min-w-0">
      <p className="text-2xs text-ink-disabled font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-ink-disabled">—</p>
      <p className="text-xs text-ink-disabled mt-1 leading-relaxed">{description}</p>
    </div>
  )
}

interface Observation { level: 'info' | 'warning'; message: string }

function ObsBadge({ obs }: { obs: Observation }) {
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded border text-xs leading-relaxed ${
      obs.level === 'warning'
        ? 'bg-warning-subtle border-warning/20 text-warning'
        : 'bg-surface-0 border-border text-ink-3'
    }`}>
      <span className="shrink-0">{obs.level === 'warning' ? '⚠️' : 'ℹ️'}</span>
      <span>{obs.message}</span>
    </div>
  )
}

export function OverviewPage() {
  const { navigate } = useUIStore()
  const { result } = useAuditStore()

  const { stats, bySource, observations } = useMemo(() => {
    if (!result) return { stats: null, bySource: new Map<SourceType, number>(), observations: [] }

    const uniquePages = new Set<string>()
    result.groups.forEach((g) => g.items.forEach((item) => uniquePages.add(item.pageId)))

    // Source breakdown
    const src = new Map<SourceType, number>()
    for (const g of result.groups) {
      const s: SourceType = (g.source as SourceType) ?? 'Unknown'
      src.set(s, (src.get(s) ?? 0) + g.count)
    }

    // Health observations
    const obs: Observation[] = []
    const rawLayers = src.get('Raw Values') ?? 0
    if (rawLayers > result.totalItems * 0.5) {
      obs.push({ level: 'warning', message: `${Math.round(rawLayers / result.totalItems * 100)}% of text layers use raw values. Consider adopting text styles.` })
    }
    const sourcesPresent = [...src.keys()].filter(s => s !== 'Unknown')
    if (sourcesPresent.length > 1) {
      obs.push({ level: 'info', message: `Multiple typography sources detected: ${sourcesPresent.join(', ')}.` })
    }
    if (result.groups.length > 200) {
      obs.push({ level: 'warning', message: `${result.groups.length.toLocaleString()} unique Typography Signatures. A well-maintained system typically uses fewer.` })
    }

    return {
      stats: {
        totalLayers: result.totalItems,
        signatures: result.groups.length,
        pagesScanned: uniquePages.size,
        mostUsed: result.groups[0] ?? null,
        scopeLabel: result.scopeLabel,
        scannedAt: new Date(result.scannedAt).toLocaleTimeString(),
        durationSec: (result.durationMs / 1000).toFixed(1),
      },
      bySource: src,
      observations: obs,
    }
  }, [result])

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
            <p className="text-xs text-ink-3 leading-relaxed mb-4">
              Scan this document to see a summary of typography signatures, sources, and consistency metrics.
            </p>
            <Button variant="primary" size="md" onClick={() => navigate('scan')}>Run Scan</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-surface-0">
      {/* Scan meta */}
      <div className="px-5 pt-4 pb-3 border-b border-border-subtle bg-surface-1 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-ink">Overview</h1>
          <p className="text-xs text-ink-3 mt-0.5">
            Scope: <span className="font-medium text-ink-2">{stats.scopeLabel}</span>
            <span className="mx-2 text-border-strong">·</span>Scanned at {stats.scannedAt}
            <span className="mx-2 text-border-strong">·</span>{stats.durationSec}s
          </p>
        </div>
      </div>

      <div className="flex-1 px-5 py-4 space-y-5">
        {/* Health observations */}
        {observations.length > 0 && (
          <section>
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Observations</p>
            <div className="space-y-1.5">
              {observations.map((obs, i) => <ObsBadge key={i} obs={obs} />)}
            </div>
          </section>
        )}

        {/* Audit results */}
        <section>
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Audit Results</p>
          <div className="flex gap-2 flex-wrap">
            <StatCard label="Text Layers" value={stats.totalLayers.toLocaleString()} sub={`in ${stats.scopeLabel}`} />
            <StatCard label="Typography Signatures" value={stats.signatures.toLocaleString()} sub={stats.mostUsed ? `Most used: ${stats.mostUsed.count.toLocaleString()}` : undefined} />
            <StatCard label="Pages Scanned" value={stats.pagesScanned} />
          </div>
        </section>

        {/* Source breakdown — real data from Sprint 2 */}
        {bySource.size > 0 && (
          <section>
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">Source Breakdown</p>
            <div className="flex gap-2 flex-wrap">
              {bySource.get('Raw Values') !== undefined && (
                <StatCard label="Raw Values" value={(bySource.get('Raw Values') ?? 0).toLocaleString()} sub="layers" />
              )}
              {bySource.get('Local Text Style') !== undefined && (
                <StatCard label="Local Styles" value={(bySource.get('Local Text Style') ?? 0).toLocaleString()} sub="layers" />
              )}
              {bySource.get('Library Text Style') !== undefined && (
                <StatCard label="Library Styles" value={(bySource.get('Library Text Style') ?? 0).toLocaleString()} sub="layers" />
              )}
              {bySource.get('Variable') !== undefined && (
                <StatCard label="Variables" value={(bySource.get('Variable') ?? 0).toLocaleString()} sub="layers" />
              )}
            </div>
          </section>
        )}

        {/* Coming Soon */}
        <section>
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">
            Platform Insights <span className="normal-case font-normal">Coming Soon</span>
          </p>
          <div className="flex gap-2 flex-wrap">
            <ComingSoonCard label="Typography Families" description="Clusters of visually similar signatures" />
            <ComingSoonCard label="Migration Readiness" description="Percentage of layers ready to migrate" />
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            <ComingSoonCard label="Suggested Reduction" description="Estimated signatures after standardisation" />
            <ComingSoonCard label="AI Readiness" description="Suitability for automated migration" />
          </div>
        </section>

        {/* CTAs */}
        <div className="flex gap-2 pt-1">
          <Button variant="primary" size="sm" onClick={() => navigate('signatures')}>
            View Signatures <ArrowRight className="w-3.5 h-3.5" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('sources')}>
            <FileText className="w-3.5 h-3.5" /> Sources
          </Button>
        </div>
      </div>
    </div>
  )
}
