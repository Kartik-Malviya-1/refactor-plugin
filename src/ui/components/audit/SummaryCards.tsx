import type { AuditResult } from '../../../shared/types'
import { cn } from '../../lib/cn'

interface SummaryCardsProps {
  result: AuditResult
  className?: string
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex-1 bg-surface-1 border border-border rounded px-3 py-2.5 min-w-0">
      <p className="text-2xs text-ink-3 font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-semibold text-ink tabular-nums leading-none">{value}</p>
      {sub && <p className="text-xs text-ink-3 mt-1 truncate">{sub}</p>}
    </div>
  )
}

export function SummaryCards({ result, className }: SummaryCardsProps) {
  const topGroup = result.groups[0]
  const avgLayersPerGroup =
    result.groups.length > 0
      ? (result.totalItems / result.groups.length).toFixed(1)
      : '—'

  return (
    <div className={cn('flex gap-2', className)}>
      <StatCard label="Text Layers" value={result.totalItems.toLocaleString()} sub={`in ${result.scopeLabel}`} />
      <StatCard label="Unique Styles" value={result.groups.length.toLocaleString()} sub={`avg ${avgLayersPerGroup} layers each`} />
      <StatCard label="Most Used" value={topGroup ? topGroup.count.toLocaleString() : '—'} sub={topGroup ? topGroup.label : undefined} />
      <StatCard label="Scan Time" value={`${(result.durationMs / 1000).toFixed(1)}s`} sub={new Date(result.scannedAt).toLocaleTimeString()} />
    </div>
  )
}
