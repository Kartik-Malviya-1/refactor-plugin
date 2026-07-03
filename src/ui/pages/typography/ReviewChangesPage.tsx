import { useMemo } from 'react'
import { AlertTriangle, ArrowRight, Layers, FileText, Lock, Target, SkipForward } from 'lucide-react'
import { useAuditStore } from '../../store/audit'
import { useAssignmentStore } from '../../store/assignment'
import { useUIStore } from '../../store/ui'
import { computeReview, type MappingCard, type ReviewConflict } from '../../lib/review-changes'
import { sendToPlugin } from '../../hooks/useSendMessage'
import { locationFromItem } from '../../../shared/navigation'
import type { TypographyProperties } from '../../../modules/typography/types'
import type { AuditGroup } from '../../../shared/types'
import { cn } from '../../lib/cn'

// ---------------------------------------------------------------------------
// Target type badge
// ---------------------------------------------------------------------------

const TARGET_BADGE: Record<string, { label: string; cls: string }> = {
  'existing-style':    { label: 'Library Style', cls: 'bg-success-subtle text-success border border-success/20' },
  'existing-variable': { label: 'Variable',       cls: 'bg-warning-subtle text-warning border border-warning/20' },
  'new-style':         { label: 'New Style',       cls: 'bg-accent-subtle text-accent border border-accent/20' },
  'new-variable':      { label: 'New Variable',    cls: 'bg-accent-subtle text-accent border border-accent/20' },
  'manual-values':     { label: 'Manual',          cls: 'bg-surface-active text-ink-2 border border-border' },
  'skip':              { label: 'Skip',             cls: 'bg-surface-0 text-ink-disabled border border-border-subtle' },
}

// ---------------------------------------------------------------------------
// Mapping card
// ---------------------------------------------------------------------------

function MappingCardView({
  card,
  onRemove,
  onViewUsage,
}: {
  card:        MappingCard<TypographyProperties>
  onRemove:    () => void
  onViewUsage: () => void
}) {
  const { group, assignment } = card
  const p      = group.descriptor
  const t      = assignment.target
  const isSkip = t.type === 'skip'
  const badge  = TARGET_BADGE[t.type] ?? TARGET_BADGE['manual-values']

  return (
    <div className={cn(
      'border border-border rounded-lg overflow-hidden bg-surface-0',
      isSkip && 'opacity-50'
    )}>
      {/* FROM → TO */}
      <div className="flex items-stretch min-h-[56px]">
        {/* Source signature */}
        <div className="flex-1 px-3 py-2.5 min-w-0">
          <p className="text-2xs text-ink-disabled mb-0.5">From</p>
          <p className="text-xs font-medium text-ink truncate">
            {p.fontFamily} {p.fontStyle} / {p.fontSize}px
          </p>
          {group.source && (
            <p className="text-2xs text-ink-3 mt-0.5">{group.source}</p>
          )}
        </div>

        {/* Arrow */}
        <div className="flex items-center px-2 shrink-0 text-ink-disabled">
          {isSkip
            ? <SkipForward className="w-3.5 h-3.5" />
            : <ArrowRight  className="w-3.5 h-3.5" />
          }
        </div>

        {/* Target */}
        <div className="flex-1 px-3 py-2.5 min-w-0 border-l border-border-subtle">
          <p className="text-2xs text-ink-disabled mb-0.5">To</p>
          <p className={cn(
            'text-xs font-medium truncate',
            isSkip ? 'text-ink-disabled' : 'text-ink'
          )}>
            {isSkip ? '—' : assignment.label}
          </p>
          <span className={cn(
            'inline-block text-2xs px-1.5 py-0.5 rounded mt-0.5 font-medium',
            badge.cls
          )}>
            {badge.label}
          </span>
        </div>
      </div>

      {/* Stats + Actions */}
      <div className="px-3 py-1.5 border-t border-border-subtle bg-surface-1 flex items-center gap-3">
        {!isSkip && (
          <div className="flex items-center gap-3 flex-1 text-2xs text-ink-3">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {card.layerCount.toLocaleString()} layer{card.layerCount !== 1 ? 's' : ''}
            </span>
            {card.pageCount > 1 && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {card.pageCount} pages
              </span>
            )}
            {card.componentCount > 0 && (
              <span>{card.componentCount.toLocaleString()} in components</span>
            )}
          </div>
        )}
        {isSkip && <div className="flex-1" />}

        <div className="flex items-center gap-3 shrink-0 ml-auto">
          {!isSkip && (
            <button
              onClick={onViewUsage}
              className="text-2xs text-ink-3 hover:text-accent transition-colors"
            >
              View Usage
            </button>
          )}
          <button
            onClick={onRemove}
            className="text-2xs text-ink-3 hover:text-warning transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Conflict banner
// ---------------------------------------------------------------------------

function ConflictBanner({ conflicts }: { conflicts: ReviewConflict[] }) {
  if (conflicts.length === 0) return null
  return (
    <div className="shrink-0 border-b border-border bg-warning-subtle/40 px-3 py-2 space-y-1.5">
      {conflicts.map((c, i) => (
        <div key={i} className="flex items-start gap-2">
          <AlertTriangle className={cn(
            'w-3.5 h-3.5 shrink-0 mt-0.5',
            c.severity === 'error' ? 'text-error' : 'text-warning'
          )} />
          <span className="text-xs text-ink-2 leading-relaxed">{c.message}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ReviewChangesPage() {
  const { result }              = useAuditStore()
  const { assignments, remove } = useAssignmentStore()
  const { navigate }            = useUIStore()

  const allGroups = useMemo(() =>
    (result?.groups ?? []) as unknown as AuditGroup<TypographyProperties>[],
    [result]
  )

  const review = useMemo(() =>
    computeReview(allGroups, assignments),
    [allGroups, assignments]
  )

  const { cards, conflicts, stats, isReady } = review

  function handleViewUsage(card: MappingCard<TypographyProperties>) {
    const locations = card.group.items.map(locationFromItem)
    sendToPlugin({ type: 'SELECT_NODES', payload: { locations } })
  }

  // ── Empty states ──────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <Target className="w-8 h-8 text-ink-disabled" strokeWidth={1.5} />
        <p className="text-sm font-medium text-ink">No scan data</p>
        <p className="text-xs text-ink-3">Run a scan to start planning typography changes.</p>
        <button onClick={() => navigate('scan')}
          className="text-xs text-accent hover:underline transition-colors">
          Run Scan
        </button>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <Target className="w-8 h-8 text-ink-disabled" strokeWidth={1.5} />
        <p className="text-sm font-medium text-ink">No changes planned</p>
        <p className="text-xs text-ink-3 max-w-xs leading-relaxed">
          Select typography signatures in Raw Values and assign them to
          target styles, variables, or new definitions.
        </p>
        <button onClick={() => navigate('typography/raw')}
          className="text-xs text-accent hover:underline transition-colors">
          Go to Raw Values
        </button>
      </div>
    )
  }

  // ── Main view ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header stats — 4-column grid */}
      <div className="shrink-0 grid grid-cols-4 divide-x divide-border border-b border-border bg-surface-0">
        {[
          { label: 'Planned Changes', value: stats.totalMappings },
          { label: 'Target Styles',   value: stats.uniqueTargets },
          { label: 'Affected Layers', value: stats.totalLayers.toLocaleString() },
          { label: 'Affected Pages',  value: stats.totalPages },
        ].map(({ label, value }) => (
          <div key={label} className="px-3 py-2.5">
            <p className="text-2xs text-ink-disabled">{label}</p>
            <p className="text-base font-semibold text-ink tabular-nums leading-tight">{value}</p>
          </div>
        ))}
      </div>

      {/* Conflict warnings */}
      <ConflictBanner conflicts={conflicts} />

      {/* Mapping card list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-2xs font-semibold text-ink-disabled uppercase tracking-widest">
            {cards.length} Planned Change{cards.length !== 1 ? 's' : ''}
          </p>
          {stats.skipCount > 0 && (
            <span className="text-2xs text-ink-disabled">{stats.skipCount} skipped</span>
          )}
        </div>

        {cards.map(card => (
          <MappingCardView
            key={card.signatureKey}
            card={card as MappingCard<TypographyProperties>}
            onRemove={()    => remove([card.signatureKey])}
            onViewUsage={() => handleViewUsage(card)}
          />
        ))}
      </div>

      {/* Apply footer — Apply is disabled in v0.3 */}
      <div className="shrink-0 border-t border-border bg-surface-1 px-4 py-3 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-ink-2">
            <span className="font-semibold">{stats.activeMappings}</span>
            {' '}active change{stats.activeMappings !== 1 ? 's' : ''}
            {stats.totalLayers > 0 && (
              <> · <span className="font-semibold">{stats.totalLayers.toLocaleString()}</span> layers</>
            )}
            {stats.skipCount > 0 && (
              <> · <span className="text-ink-disabled">{stats.skipCount} skipped</span></>
            )}
          </p>
          {conflicts.length > 0 && !isReady && (
            <p className="text-2xs text-warning mt-0.5">
              {conflicts.length} warning{conflicts.length !== 1 ? 's' : ''} — resolve before applying
            </p>
          )}
          {isReady && (
            <p className="text-2xs text-success mt-0.5">Ready to apply</p>
          )}
        </div>
        <button
          disabled
          className="flex items-center gap-1.5 px-4 h-8 rounded bg-surface-active text-ink-disabled text-xs font-medium cursor-not-allowed select-none shrink-0"
          title="Apply is not yet available — coming in the next release"
        >
          <Lock className="w-3.5 h-3.5" />
          Apply Changes
        </button>
      </div>
    </div>
  )
}
