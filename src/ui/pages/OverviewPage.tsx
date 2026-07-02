import { useMemo } from 'react'
import { ArrowRight, Type, FileText, Clock, Hash } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useUIStore } from '../store/ui'
import { useAuditStore } from '../store/audit'

// ---------------------------------------------------------------------------
// Overview — Platform landing screen
//
// Pre-scan: welcome state, prompt to run scan.
// Post-scan: summary cards from AuditResult, coming-soon placeholders.
// ---------------------------------------------------------------------------

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

export function OverviewPage() {
  const { navigate } = useUIStore()
  const { result } = useAuditStore()

  // Compute stats from existing AuditResult data.
  // Only what we can determine reliably — no fake values.
  const stats = useMemo(() => {
    if (!result) return null

    const uniquePages = new Set<string>()
    result.groups.forEach((g) => g.items.forEach((item) => uniquePages.add(item.pageId)))

    return {
      totalLayers:   result.totalItems,
      signatures:    result.groups.length,
      pagesScanned:  uniquePages.size,
      mostUsed:      result.groups[0] ?? null,
      scopeLabel:    result.scopeLabel,
      scannedAt:     new Date(result.scannedAt).toLocaleTimeString(),
      durationSec:   (result.durationMs / 1000).toFixed(1),
    }
  }, [result])

  // ── Pre-scan empty state ────────────────────────────────────────────────
  if (!stats) {
    return (
      <div className="flex flex-col h-full overflow-y-auto bg-surface-0">
        <div className="px-6 pt-6 pb-4 border-b border-border-subtle bg-surface-1 shrink-0">
          <h1 className="text-lg font-semibold text-ink mb-0.5">Overview</h1>
          <p className="text-xs text-ink-3 leading-relaxed">
            Run a scan to understand your design system.
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-xs">
            <div className="w-12 h-12 rounded-xl bg-surface-hover flex items-center justify-center mx-auto mb-4">
              <Type className="w-6 h-6 text-ink-3" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-ink mb-1">No scan data yet</p>
            <p className="text-xs text-ink-3 leading-relaxed mb-4">
              Scan this document to see a summary of typography signatures,
              sources, and consistency metrics.
            </p>
            <Button variant="primary" size="md" onClick={() => navigate('scan')}>
              Run Scan
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Post-scan overview ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-surface-0">
      {/* Scan meta bar */}
      <div className="px-5 pt-4 pb-3 border-b border-border-subtle bg-surface-1 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-ink">Overview</h1>
            <p className="text-xs text-ink-3 mt-0.5">
              Scope: <span className="font-medium text-ink-2">{stats.scopeLabel}</span>
              <span className="mx-2 text-border-strong">·</span>
              Scanned at {stats.scannedAt}
              <span className="mx-2 text-border-strong">·</span>
              {stats.durationSec}s
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-4 space-y-5">
        {/* Audit Results */}
        <section>
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">
            Audit Results
          </p>
          <div className="flex gap-2 flex-wrap">
            <StatCard
              label="Text Layers"
              value={stats.totalLayers.toLocaleString()}
              sub={`in ${stats.scopeLabel}`}
            />
            <StatCard
              label="Typography Signatures"
              value={stats.signatures.toLocaleString()}
              sub={stats.mostUsed ? `Most used: ${stats.mostUsed.count.toLocaleString()} layers` : undefined}
            />
            <StatCard
              label="Pages Scanned"
              value={stats.pagesScanned}
            />
          </div>
        </section>

        {/* Source Breakdown — requires Sprint 2 scan enhancement */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest">
              Source Breakdown
            </p>
            <span className="text-2xs text-ink-disabled bg-surface-active px-1.5 py-0.5 rounded">Sprint 2</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <StatCard label="Raw Values"        value="—" dim />
            <StatCard label="Local Text Styles"  value="—" dim />
            <StatCard label="Library Styles"     value="—" dim />
            <StatCard label="Variable-bound"     value="—" dim />
          </div>
          <p className="text-xs text-ink-disabled mt-2 leading-relaxed">
            Source classification requires additional scan data. Planned for Sprint 2.
          </p>
        </section>

        {/* More fields coming */}
        <section>
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">
            Deeper Metrics
          </p>
          <div className="flex gap-2 flex-wrap">
            <StatCard label="Existing Text Styles"       value="—" dim />
            <StatCard label="Components with Text"       value="—" dim />
          </div>
        </section>

        {/* Coming Soon — future platform metrics */}
        <section>
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest mb-2">
            Platform Insights
            <span className="ml-2 normal-case font-normal">Coming Soon</span>
          </p>
          <div className="flex gap-2 flex-wrap">
            <ComingSoonCard
              label="Typography Families"
              description="Clusters of visually similar signatures"
            />
            <ComingSoonCard
              label="Migration Readiness"
              description="Percentage of layers ready to migrate"
            />
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            <ComingSoonCard
              label="Suggested Reduction"
              description="Estimated signatures after standardisation"
            />
            <ComingSoonCard
              label="AI Readiness"
              description="Suitability for automated migration"
            />
          </div>
        </section>

        {/* CTA */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('signatures')}
          >
            View Typography Signatures
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('sources')}
          >
            <FileText className="w-3.5 h-3.5" />
            Sources
          </Button>
        </div>
      </div>
    </div>
  )
}
